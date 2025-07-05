// extension.js - Improved with smart folder detection and configuration
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

    // [Previous path finding functions remain the same...]
    function getSemanticPath(document, position) {
        try {
            const text = document.getText();
            const jsonObj = JSON.parse(text);
            const offset = document.offsetAt(position);
            return findSemanticPathAtPosition(text, jsonObj, offset);
        } catch (error) {
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
                const positions = findObjectPositionsInContext(text, currentObj, semanticPath);
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

    function findObjectPositionsInContext(text, obj, semanticPath) {
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
        } catch (error) {
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

        // Find path pattern around cursor - now handles quoted paths too
        const quotedPathPattern = /"([\w\.]+)"/g;
        const plainPathPattern = /[\w\.]+/g;
        
        // First try to find quoted paths
        let match;
        while ((match = quotedPathPattern.exec(text)) !== null) {
            const start = match.index;
            const end = match.index + match[0].length;
            
            if (cursorChar >= start && cursorChar <= end) {
                const pathString = match[1]; // Extract content without quotes
                if (pathString.includes('.') && pathString.match(/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/)) {
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
                if (pathString.includes('.') && pathString.match(/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/)) {
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
        
        const pathComponents = semanticPath.split('.');
        const rootName = pathComponents[0];

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
                    actualPath: pathInfo.actualPath || semanticPath,  // Include actual path with correct casing
                    searchedPath: semanticPath
                };
            }
        } catch (error) {
            // Skip invalid JSON files or access errors
            return null;
        }
        return null;
    }

    function findPathInJson(obj, targetPath, fileContent) {
        const pathComponents = targetPath.split('.');
        
        function searchObject(currentObj, currentPath = '', startPos = 0) {
            if (!currentObj || typeof currentObj !== 'object') return null;
            
            if (currentObj.Name) {
                const newPath = currentPath ? `${currentPath}.${currentObj.Name}` : currentObj.Name;
                
                // Check if this matches our target path (case-insensitive)
                if (newPath.toLowerCase() === targetPath.toLowerCase()) {
                    // Find the position of this object in the file
                    const namePattern = `"Name"\\s*:\\s*"${escapeRegex(currentObj.Name)}"`;
                    const regex = new RegExp(namePattern, 'g');
                    let match;
                    
                    while ((match = regex.exec(fileContent)) !== null) {
                        const objBounds = findObjectBoundsFromName(fileContent, match.index);
                        if (objBounds && validateObjectByContent(fileContent, objBounds, currentObj)) {
                            // Convert text positions to VS Code positions
                            const lines = fileContent.substring(0, match.index).split('\n');
                            const line = lines.length - 1;
                            const character = lines[lines.length - 1].length;
                            
                            return {
                                position: new vscode.Position(line, character),
                                range: new vscode.Range(
                                    line, character,
                                    line, character + currentObj.Name.length
                                ),
                                actualPath: newPath  // Return the actual path with correct casing
                            };
                        }
                    }
                }
                
                // Continue searching in children
                if (currentObj.Children && Array.isArray(currentObj.Children)) {
                    for (const child of currentObj.Children) {
                        const result = searchObject(child, newPath);
                        if (result) return result;
                    }
                }
            }
            return null;
        }
        
        return searchObject(obj);
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

    // NEW: Copy path without quotes
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

    // IMPROVED: Go to path with better error handling and progress
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
                    
                    // Show message with case correction if needed
                    if (result.actualPath.toLowerCase() !== result.searchedPath.toLowerCase()) {
                        vscode.window.showWarningMessage(`⚠️ Found similar path: ${result.actualPath} in ${result.fileName} (case mismatch)`);
                    } else if (result.actualPath !== result.searchedPath) {
                        vscode.window.showInformationMessage(`✅ Found: ${result.actualPath} in ${result.fileName} (corrected case)`);
                    } else {
                        vscode.window.showInformationMessage(`✅ Found: ${pathInfo.path} in ${result.fileName}`);
                    }
                } else {
                    vscode.window.showWarningMessage(`❌ Path "${pathInfo.path}" not found in any JSON files in workspace. Check spelling and case sensitivity.`);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Error searching for path: ${error.message}`);
            }
        });
    });

    // NEW: Configure search paths command
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