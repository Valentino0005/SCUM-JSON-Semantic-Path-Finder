// extension.js - Fixed navigation bug for duplicate node names
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

// Cache for JSON file contents to avoid re-parsing (module scope)
const jsonFileCache = new Map();

function activate(context) {
    // Status bar item
    const statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right, 
        1000
    );
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
    statusBarItem.command = 'jsonSemanticPath.copyPath';
    statusBarItem.show();

    // Path finding functions
    function getSemanticPath(document, position) {
        try {
            const text = document.getText();
            const jsonObj = JSON.parse(text);
            const offset = document.offsetAt(position);
            return findSemanticPathAtPosition(text, jsonObj, offset);
        } catch {
            return null;
        }
    }

    function findSemanticPathAtPosition(text, rootObj, targetOffset) {
        const positionMap = buildPositionMap(text, rootObj);
        positionMap.sort((a, b) => {
            if (b.depth !== a.depth) return b.depth - a.depth;
            return (a.endPos - a.startPos) - (b.endPos - b.startPos);
        });

        for (const item of positionMap) {
            if (targetOffset >= item.startPos && targetOffset <= item.endPos) {
                return item.semanticPath;
            }
        }
        return null;
    }

    function buildPositionMap(text, obj, path = '', depth = 0) {
        const map = [];
        function traverse(currentObj, currentPath, currentDepth) {
            if (!currentObj || typeof currentObj !== 'object') return;
            if (currentObj.Name) {
                const semanticPath = currentPath ? `${currentPath}.${currentObj.Name}` : currentObj.Name;
                const positions = findObjectPositionsInContext(text, currentObj);
                if (positions) {
                    map.push({
                        semanticPath,
                        startPos: positions.start,
                        endPos: positions.end,
                        depth: currentDepth,
                        name: currentObj.Name,
                        objectSize: positions.end - positions.start
                    });
                }
                if (currentObj.Children && Array.isArray(currentObj.Children)) {
                    for (const child of currentObj.Children) {
                        traverse(child, semanticPath, currentDepth + 1);
                    }
                }
            }
        }
        traverse(obj, path, depth);
        return map;
    }

    function findObjectPositionsInContext(text, obj) {
        if (!obj.Name) return null;
        const nameValue = obj.Name;
        const namePattern = `"Name"\\s*:\\s*"${escapeRegex(nameValue)}"`;
        const regex = new RegExp(namePattern, 'g');
        let match;
        const candidates = [];

        while ((match = regex.exec(text)) !== null) {
            candidates.push({
                nameStart: match.index,
                nameEnd: match.index + match[0].length
            });
        }

        for (const candidate of candidates) {
            const objBounds = findObjectBoundsFromName(text, candidate.nameStart);
            if (objBounds && validateObjectByContent(text, objBounds, obj)) {
                return objBounds;
            }
        }
        return null;
    }

    function findObjectBoundsFromName(text, namePosition) {
        let start = namePosition;
        while (start > 0 && text[start] !== '{') start--;
        if (text[start] !== '{') return null;

        let braceCount = 0;
        let inString = false;
        let escapeNext = false;
        let end = start;
        
        while (end < text.length) {
            const char = text[end];
            if (escapeNext) {
                escapeNext = false;
            } else if (char === '\\') {
                escapeNext = true;
            } else if (char === '"' && !escapeNext) {
                inString = !inString;
            } else if (!inString) {
                if (char === '{') {
                    braceCount++;
                } else if (char === '}') {
                    braceCount--;
                    if (braceCount === 0) break;
                }
            }
            end++;
        }

        if (braceCount !== 0 || end >= text.length) return null;
        return { start, end };
    }

    function validateObjectByContent(text, bounds, targetObj) {
        try {
            const objectText = text.substring(bounds.start, bounds.end + 1);
            const parsedObj = JSON.parse(objectText);
            if (parsedObj.Name !== targetObj.Name) return false;
            if (targetObj.Rarity && parsedObj.Rarity !== targetObj.Rarity) return false;
            const targetKeys = Object.keys(targetObj).sort();
            const parsedKeys = Object.keys(parsedObj).sort();
            return targetKeys.every(key => parsedKeys.includes(key));
        } catch {
            return false;
        }
    }

    function escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function getSemanticPathUnderCursor(document, position) {
        const line = document.lineAt(position.line);
        const text = line.text;
        const cursorChar = position.character;

        // Find path pattern around cursor - now handles quoted paths with hyphens
        const quotedPathPattern = /"([\w\.\-]+)"/g;
        const plainPathPattern = /[\w\.\-]+/g;
        
        // First try to find quoted paths
        let match;
        while ((match = quotedPathPattern.exec(text)) !== null) {
            const start = match.index;
            const end = match.index + match[0].length;
            
            if (cursorChar >= start && cursorChar <= end) {
                const pathString = match[1]; // Extract content without quotes
                // Updated regex to allow numbers at start of segments and hyphens (for paths like "Cal_30-06_Ammobox_AP")
                if (pathString.includes('.') && pathString.match(/^[A-Za-z0-9_\-][A-Za-z0-9_\-]*(\.[A-Za-z0-9_\-][A-Za-z0-9_\-]*)+$/)) {
                    return {
                        path: pathString,
                        range: new vscode.Range(
                            position.line, start,
                            position.line, end
                        )
                    };
                }
            }
        }

        // Then try plain paths (without quotes)
        while ((match = plainPathPattern.exec(text)) !== null) {
            const start = match.index;
            const end = match.index + match[0].length;
            
            if (cursorChar >= start && cursorChar <= end) {
                const pathString = match[0];
                // Updated regex to allow numbers at start of segments and hyphens (for paths like "Cal_30-06_Ammobox_AP")
                if (pathString.includes('.') && pathString.match(/^[A-Za-z0-9_\-][A-Za-z0-9_\-]*(\.[A-Za-z0-9_\-][A-Za-z0-9_\-]*)+$/)) {
                    return {
                        path: pathString,
                        range: new vscode.Range(
                            position.line, start,
                            position.line, end
                        )
                    };
                }
            }
        }
        return null;
    }

    // IMPROVED: Smart workspace search with folder prioritization
    async function findJsonFileWithPath(semanticPath) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder opened. Please open your project folder.');
            return null;
        }

        // Get configuration for search paths
        const config = vscode.workspace.getConfiguration('jsonSemanticPath');
        const searchPaths = config.get('searchPaths', ['**/*.json']);
        const priorityFolders = config.get('priorityFolders', ['**/Nodes/**', '**/Override/**']);
        
        // Build search patterns
        const allPatterns = [
            ...priorityFolders.map(folder => `${folder}/*.json`),
            ...searchPaths
        ];

        vscode.window.showInformationMessage(`🔍 Searching in workspace for: ${semanticPath}`);

        // Search with different patterns, prioritizing likely locations
        for (const pattern of allPatterns) {
            try {
                const jsonFiles = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 50);
                
                for (const fileUri of jsonFiles) {
                    const result = await checkFileForPath(fileUri, semanticPath);
                    if (result) {
                        return result;
                    }
                }
            } catch (error) {
                console.warn(`Search pattern ${pattern} failed:`, error);
            }
        }

        // If not found in priority locations, do a broader search
        vscode.window.showInformationMessage('🔍 Expanding search to all JSON files...');
        
        try {
            const allJsonFiles = await vscode.workspace.findFiles('**/*.json', '**/node_modules/**', 200);
            
            for (const fileUri of allJsonFiles) {
                const result = await checkFileForPath(fileUri, semanticPath);
                if (result) {
                    return result;
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Search failed: ${error.message}`);
        }

        return null;
    }

    // Helper function to check individual file
    async function checkFileForPath(fileUri, semanticPath) {
        try {
            const filePath = fileUri.fsPath;
            let fileContent;
            
            // Check cache first
            if (jsonFileCache.has(filePath)) {
                const cached = jsonFileCache.get(filePath);
                const stats = fs.statSync(filePath);
                if (stats.mtime.getTime() === cached.mtime) {
                    fileContent = cached.content;
                } else {
                    jsonFileCache.delete(filePath);
                }
            }

            if (!fileContent) {
                const document = await vscode.workspace.openTextDocument(fileUri);
                fileContent = document.getText();
                const stats = fs.statSync(filePath);
                jsonFileCache.set(filePath, {
                    content: fileContent,
                    mtime: stats.mtime.getTime()
                });
            }

            const jsonObj = JSON.parse(fileContent);
            
            // Check if this file contains our path
            const pathInfo = findPathInJson(jsonObj, semanticPath, fileContent);
            if (pathInfo) {
                return {
                    fileUri,
                    position: pathInfo.position,
                    range: pathInfo.range,
                    fileName: path.basename(filePath),
                    actualPath: pathInfo.actualPath || semanticPath,
                    searchedPath: semanticPath
                };
            }
        } catch {
            // Skip invalid JSON files or access errors
            return null;
        }
        return null;
    }

    // FIXED: Enhanced path finding with context validation and improved case-insensitive search
    function findPathInJson(obj, targetPath, fileContent) {
        // First, build a complete map of ALL paths and their exact positions
        const pathMap = buildCompletePathMap(obj, fileContent);
        
        // Try exact match first (case-insensitive)
        let matchingEntry = pathMap.find(entry => 
            entry.semanticPath.toLowerCase() === targetPath.toLowerCase()
        );
        
        // If no exact match, try fuzzy matching for case sensitivity issues
        if (!matchingEntry) {
            const targetSegments = targetPath.toLowerCase().split('.');
            matchingEntry = pathMap.find(entry => {
                const entrySegments = entry.semanticPath.toLowerCase().split('.');
                if (entrySegments.length !== targetSegments.length) return false;
                
                // Check each segment matches
                return entrySegments.every((segment, index) => 
                    segment === targetSegments[index]
                );
            });
        }
        
        // If still no match, try a simpler validation without strict context checking
        if (!matchingEntry) {
            matchingEntry = findPathWithSimpleValidation(obj, targetPath, fileContent);
        }
        
        if (matchingEntry) {
            // Convert text positions to VS Code positions
            const lines = fileContent.substring(0, matchingEntry.namePosition).split('\n');
            const line = lines.length - 1;
            const character = lines[lines.length - 1].length;
            
            return {
                position: new vscode.Position(line, character),
                range: new vscode.Range(
                    line, character,
                    line, character + matchingEntry.name.length
                ),
                actualPath: matchingEntry.semanticPath
            };
        }
        
        return null;
    }

    function findPathWithSimpleValidation(obj, targetPath, fileContent) {
        // Fallback method with simpler validation for edge cases
        const pathSegments = targetPath.split('.');
        const targetLeafName = pathSegments[pathSegments.length - 1];
        
        function traverse(currentObj, currentPath = '', depth = 0) {
            if (!currentObj || typeof currentObj !== 'object') return null;
            
            if (currentObj.Name) {
                const newPath = currentPath ? `${currentPath}.${currentObj.Name}` : currentObj.Name;
                
                // Check if this path matches (case-insensitive)
                if (newPath.toLowerCase() === targetPath.toLowerCase()) {
                    // Find position of this object in the file
                    const namePattern = `"Name"\\s*:\\s*"${escapeRegex(currentObj.Name)}"`;
                    const regex = new RegExp(namePattern, 'g');
                    let match;
                    
                    while ((match = regex.exec(fileContent)) !== null) {
                        const objBounds = findObjectBoundsFromName(fileContent, match.index);
                        if (objBounds) {
                            // Simple validation - just check the name matches
                            try {
                                const objectText = fileContent.substring(objBounds.start, objBounds.end + 1);
                                const parsedObj = JSON.parse(objectText);
                                if (parsedObj.Name === currentObj.Name) {
                                    return {
                                        semanticPath: newPath,
                                        namePosition: match.index,
                                        name: currentObj.Name,
                                        objectBounds: objBounds
                                    };
                                }
                            } catch {
                                continue;
                            }
                        }
                    }
                }
                
                // Continue searching children
                if (currentObj.Children && Array.isArray(currentObj.Children)) {
                    for (const child of currentObj.Children) {
                        const result = traverse(child, newPath, depth + 1);
                        if (result) return result;
                    }
                }
            }
            return null;
        }
        
        return traverse(obj);
    }

    function buildCompletePathMap(obj, fileContent) {
        const pathMap = [];
        
        function traverse(currentObj, currentPath = '', parentContext = []) {
            if (!currentObj || typeof currentObj !== 'object') return;
            
            if (currentObj.Name) {
                const newPath = currentPath ? `${currentPath}.${currentObj.Name}` : currentObj.Name;
                const newContext = [...parentContext, currentObj.Name];
                
                // Find ALL occurrences of this name in the file
                const namePattern = `"Name"\\s*:\\s*"${escapeRegex(currentObj.Name)}"`;
                const regex = new RegExp(namePattern, 'g');
                let match;
                
                while ((match = regex.exec(fileContent)) !== null) {
                    const objBounds = findObjectBoundsFromName(fileContent, match.index);
                    if (objBounds) {
                        // Validate this is the RIGHT object by checking its context
                        if (validateObjectInContext(fileContent, objBounds, currentObj, newContext, newPath)) {
                            pathMap.push({
                                semanticPath: newPath,
                                namePosition: match.index,
                                name: currentObj.Name,
                                objectBounds: objBounds,
                                context: newContext
                            });
                            break; // Found the correct instance, stop searching
                        }
                    }
                }
                
                // Continue traversing children
                if (currentObj.Children && Array.isArray(currentObj.Children)) {
                    for (const child of currentObj.Children) {
                        traverse(child, newPath, newContext);
                    }
                }
            }
        }
        
        traverse(obj);
        return pathMap;
    }

    function validateObjectInContext(fileContent, bounds, targetObj, expectedContext, expectedPath) {
        try {
            const objectText = fileContent.substring(bounds.start, bounds.end + 1);
            const parsedObj = JSON.parse(objectText);
            
            // Basic validation
            if (parsedObj.Name !== targetObj.Name) return false;
            if (targetObj.Rarity && parsedObj.Rarity !== targetObj.Rarity) return false;
            
            // Enhanced context validation - check if this object appears in the right place
            // by examining the surrounding structure
            const contextValidation = validatePathContext(fileContent, bounds, expectedContext);
            if (!contextValidation) return false;
            
            // Additional validation: check if object properties match
            const targetKeys = Object.keys(targetObj).sort();
            const parsedKeys = Object.keys(parsedObj).sort();
            
            return targetKeys.every(key => parsedKeys.includes(key));
        } catch {
            return false;
        }
    }

    function validatePathContext(fileContent, objectBounds, expectedContext) {
        // Work backwards from the object to validate the path context
        // This ensures we're at the right "Other" node by checking parent structure
        
        if (expectedContext.length <= 1) return true; // Root level objects
        
        try {
            // Look for parent context by searching backwards for parent names
            const beforeObject = fileContent.substring(0, objectBounds.start);
            const parentName = expectedContext[expectedContext.length - 2]; // Parent node name
            
            // Check if parent name appears reasonably close before this object
            const parentPattern = `"Name"\\s*:\\s*"${escapeRegex(parentName)}"`;
            const parentMatches = [...beforeObject.matchAll(new RegExp(parentPattern, 'g'))];
            
            if (parentMatches.length === 0) return false;
            
            // Find the closest parent match
            const lastParentMatch = parentMatches[parentMatches.length - 1];
            const distanceToParent = objectBounds.start - (lastParentMatch.index + lastParentMatch[0].length);
            
            // If parent is too far away (more than 10000 chars), this might be wrong context
            if (distanceToParent > 10000) return false;
            
            // Additional check for grandparent if available
            if (expectedContext.length > 2) {
                const grandParentName = expectedContext[expectedContext.length - 3];
                const grandParentPattern = `"Name"\\s*:\\s*"${escapeRegex(grandParentName)}"`;
                const grandParentMatches = [...beforeObject.matchAll(new RegExp(grandParentPattern, 'g'))];
                
                if (grandParentMatches.length > 0) {
                    const lastGrandParentMatch = grandParentMatches[grandParentMatches.length - 1];
                    // Grandparent should come before parent
                    if (lastGrandParentMatch.index > lastParentMatch.index) return false;
                }
            }
            
            return true;
        } catch {
            return false;
        }
    }

    function updateStatusBar() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            statusBarItem.hide();
            return;
        }

        const document = editor.document;
        if (document.languageId !== 'json') {
            statusBarItem.hide();
            return;
        }

        const position = editor.selection.active;
        const path = getSemanticPath(document, position);
        
        if (path) {
            statusBarItem.text = `$(symbol-namespace) ${path}`;
            statusBarItem.tooltip = `JSON Path: "${path}"\nClick to copy with quotes`;
            statusBarItem.show();
        } else {
            statusBarItem.text = `$(symbol-namespace) No path`;
            statusBarItem.tooltip = 'Position not within a named object';
            statusBarItem.show();
        }
    }

    // Commands
    const copyPathCommand = vscode.commands.registerCommand('jsonSemanticPath.copyPath', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'json') {
            vscode.window.showWarningMessage('No active JSON editor');
            return;
        }

        const position = editor.selection.active;
        const path = getSemanticPath(editor.document, position);
        
        if (path) {
            // Wrap path in quotes for easier use in JSON files
            const quotedPath = `"${path}"`;
            vscode.env.clipboard.writeText(quotedPath);
            vscode.window.showInformationMessage(`✅ Copied: ${quotedPath}`);
        } else {
            vscode.window.showWarningMessage('No semantic path found at cursor position');
        }
    });

    // Copy path without quotes
    const copyPathPlainCommand = vscode.commands.registerCommand('jsonSemanticPath.copyPathPlain', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'json') {
            vscode.window.showWarningMessage('No active JSON editor');
            return;
        }

        const position = editor.selection.active;
        const path = getSemanticPath(editor.document, position);
        
        if (path) {
            vscode.env.clipboard.writeText(path);
            vscode.window.showInformationMessage(`✅ Copied: ${path}`);
        } else {
            vscode.window.showWarningMessage('No semantic path found at cursor position');
        }
    });

    // Go to path with better error handling and progress
    const goToPathCommand = vscode.commands.registerCommand('jsonSemanticPath.goToPath', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor');
            return;
        }

        const position = editor.selection.active;
        const pathInfo = getSemanticPathUnderCursor(editor.document, position);
        
        if (!pathInfo) {
            vscode.window.showWarningMessage('No semantic path found under cursor. Place cursor on a path like "ItemLootTreeNodes.Military.Ammo.12Gauge"');
            return;
        }

        // Show progress indicator
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Searching for: ${pathInfo.path}`,
            cancellable: true
        }, async (progress, token) => {
            try {
                progress.report({ increment: 20, message: "Scanning workspace..." });
                
                const result = await findJsonFileWithPath(pathInfo.path);
                
                if (token.isCancellationRequested) {
                    return;
                }
                
                progress.report({ increment: 80, message: "Opening file..." });
                
                if (result) {
                    // Open the file and navigate to the position
                    const document = await vscode.workspace.openTextDocument(result.fileUri);
                    const editor = await vscode.window.showTextDocument(document);
                    
                    // Set cursor position and reveal
                    editor.selection = new vscode.Selection(result.position, result.position);
                    editor.revealRange(new vscode.Range(result.position, result.position), vscode.TextEditorRevealType.InCenter);
                    
                    progress.report({ increment: 100 });
                    
                    // Show appropriate message based on path matching
                    if (result.actualPath !== result.searchedPath) {
                        if (result.actualPath.toLowerCase() === result.searchedPath.toLowerCase()) {
                            vscode.window.showInformationMessage(`✅ Found: ${result.actualPath} in ${result.fileName} (case corrected)`);
                        } else {
                            vscode.window.showInformationMessage(`✅ Found similar: ${result.actualPath} in ${result.fileName}`);
                        }
                    } else {
                        vscode.window.showInformationMessage(`✅ Found: ${pathInfo.path} in ${result.fileName}`);
                    }
                } else {
                    // Enhanced error message with case sensitivity hint
                    const pathSegments = pathInfo.path.split('.');
                    vscode.window.showWarningMessage(
                        `❌ Path "${pathInfo.path}" not found. ` +
                        `💡 Check: 1) Spelling 2) Case sensitivity (ammo vs Ammo) 3) File location in workspace`
                    );
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Error searching for path: ${error.message}`);
            }
        });
    });

    // Configure search paths command
    const configureSearchCommand = vscode.commands.registerCommand('jsonSemanticPath.configurePaths', async () => {
        const result = await vscode.window.showQuickPick([
            {
                label: '$(folder) Open Settings',
                description: 'Configure search paths and priority folders',
                detail: 'Open VS Code settings to customize JSON semantic path search'
            },
            {
                label: '$(file-directory) Set Priority Folders',
                description: 'Quick setup for common folder structures',
                detail: 'Set folders like Nodes, Override, etc. as priority search locations'
            }
        ], {
            placeHolder: 'Configure JSON Semantic Path extension'
        });

        if (result?.label.includes('Open Settings')) {
            vscode.commands.executeCommand('workbench.action.openSettings', 'jsonSemanticPath');
        } else if (result?.label.includes('Set Priority Folders')) {
            const folders = await vscode.window.showInputBox({
                prompt: 'Enter priority folder patterns (comma-separated)',
                value: '**/Nodes/**, **/Override/**, **/Spawners/**',
                placeHolder: 'e.g., **/Nodes/**, **/Override/**'
            });
            
            if (folders) {
                const config = vscode.workspace.getConfiguration('jsonSemanticPath');
                const folderArray = folders.split(',').map(f => f.trim());
                await config.update('priorityFolders', folderArray, vscode.ConfigurationTarget.Workspace);
                vscode.window.showInformationMessage('✅ Priority folders updated!');
            }
        }
    });

    // Register everything
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(updateStatusBar),
        vscode.window.onDidChangeTextEditorSelection(updateStatusBar),
        copyPathCommand,
        copyPathPlainCommand,
        goToPathCommand,
        configureSearchCommand,
        statusBarItem
    );

    updateStatusBar();
}

function deactivate() {
    // Clear cache on deactivation
    jsonFileCache.clear();
}

module.exports = { activate, deactivate };