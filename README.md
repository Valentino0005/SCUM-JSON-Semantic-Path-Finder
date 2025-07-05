# JSON Semantic Path Extension

Navigate and manage semantic paths in tree-structured JSON files with "Name" properties effortlessly.

## 🚀 Features

### ✨ **Bi-Directional Navigation**
- **Forward**: JSON Structure → Semantic Path (with copy)
- **Reverse**: Semantic Path String → Jump to Definition

### 📍 **Real-time Path Display**
- **Status Bar**: Shows current semantic path on the right side
- **Live Updates**: Path updates as you move your cursor
- **Smart Tooltips**: Helpful information and click-to-copy functionality

### 📋 **Flexible Copy Options**
- **With Quotes**: `"ItemLootTreeNodes.Military.Gear.tools.Knives"` (default)
- **Plain Text**: `ItemLootTreeNodes.Military.Gear.tools.Knives`
- **One-Click Copy**: Click status bar to copy instantly

### 🔍 **Smart Search & Navigation**
- **Case-Insensitive**: Finds `tools` even if you search for `Tools`
- **Workspace-Wide**: Searches all JSON files in your project
- **Priority Folders**: Searches common folders first for better performance
- **Progress Indicators**: Shows search progress with cancellation option

## 📚 How It Works

Transform complex JSON paths from this:
```
Children[0].Children[2].Children[1].Children[0].Name
```

To this semantic path:
```
"ItemLootTreeNodes.Military.Gear.tools.Knives"
```

### Example JSON Structure:
```json
{
    "Name": "ItemLootTreeNodes",
    "Children": [
        {
            "Name": "Military",
            "Children": [
                {
                    "Name": "Gear",
                    "Children": [
                        {
                            "Name": "tools",
                            "Children": [
                                {
                                    "Name": "Knives",
                                    "Rarity": "Common"
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    ]
}
```

**Result**: `ItemLootTreeNodes.Military.Gear.tools.Knives`

## 🎮 Usage

### **Forward Navigation** (JSON → Path)
1. **Open** any JSON file with tree structure
2. **Click** anywhere in the JSON structure
3. **See** the semantic path in the status bar (right side)
4. **Copy** using right-click menu or keyboard shortcuts

### **Reverse Navigation** (Path → JSON)
1. **Place cursor** on a semantic path string like `"ItemLootTreeNodes.Military.Gear.tools.Knives"`
2. **Press** `Ctrl+Shift+G` or right-click → "Go to JSON Semantic Path"
3. **Extension will** automatically find and open the file containing that path
4. **Cursor jumps** to the exact location in the tree

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+C` | Copy path with quotes |
| `Ctrl+Shift+Alt+C` | Copy path without quotes |
| `Ctrl+Shift+G` | Go to path definition |
| `Ctrl+Shift+Alt+G` | Configure search settings |

## 🖱️ Right-Click Menu

- **Copy JSON Semantic Path (with quotes)** - Copies `"path"` ready for JSON
- **Copy JSON Semantic Path (plain)** - Copies `path` without quotes  
- **Go to JSON Semantic Path** - Navigate to definition

## ⚙️ Configuration

### **Smart Folder Search**
Configure priority folders for faster searches:

```json
{
    "jsonSemanticPath.priorityFolders": [
        "**/Nodes/**",
        "**/Override/**", 
        "**/Spawners/**"
    ],
    "jsonSemanticPath.searchPaths": [
        "**/*.json"
    ]
}
```

### **Quick Setup**
- **Command Palette**: "Configure JSON Semantic Path Search"
- **Keyboard**: `Ctrl+Shift+Alt+G`

## 🎯 Perfect For

- **Game Development**: Loot tables, skill trees, item hierarchies
- **Configuration Files**: Nested settings, menu structures
- **Data Management**: Any tree-structured JSON with named nodes

## 🔧 Requirements

- **VS Code**: 1.60.0 or higher
- **JSON Files**: Must have "Name" properties in tree structure
- **Workspace**: Open your project folder for reverse navigation

## 🚀 Advanced Features

### **Case-Insensitive Search**
- Searches for `Tools` will find `tools`
- Shows corrected case in results

### **Smart Caching**
- Caches parsed JSON files for better performance
- Automatically updates when files change

### **Error Handling** 
- Clear error messages and suggestions
- Fallback search strategies

### **Progress Tracking**
- Visual progress indicators for long searches
- Cancellable operations

## 📁 Example Folder Structure Support

```
📂 Your Project
├── 📂 Nodes/Override/
│   ├── Military.json           ← Tree definitions
│   └── Civilian.json
├── 📂 Spawners/Presets/
│   ├── Buildings-Military.json ← Path references
│   └── Vehicles.json
└── 📂 Config/
    └── Settings.json
```

**Works seamlessly** across different folder structures!

## 🔄 Release Notes

### 0.2.0
- ✅ **Reverse navigation**: Go from path string to JSON definition
- ✅ **Case-insensitive search**: Find paths regardless of case
- ✅ **Quoted path copying**: Default copy includes quotes
- ✅ **Smart workspace search**: Priority folders and progress indicators
- ✅ **Enhanced error handling**: Better messages and fallback strategies
- ✅ **Configurable search paths**: Customize where extension looks for files

### 0.1.0
- ✅ **Initial release**: Basic semantic path display and copying
- ✅ **Status bar integration**: Real-time path updates
- ✅ **Context menu**: Right-click copy functionality
- ✅ **Keyboard shortcuts**: Quick access to features

## 🤝 Contributing

Found a bug or have a feature request? Please open an issue or submit a pull request!

## 📄 License

MIT License - feel free to use and modify as needed.

---

**Happy coding!** 🎉 Make your JSON navigation semantic and effortless.
