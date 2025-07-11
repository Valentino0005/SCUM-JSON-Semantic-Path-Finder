# 🎯 JSON Semantic Path

**Navigate tree-structured JSON files with semantic paths - perfect for SCUM server admins and game developers**

Transform complex JSON navigation from `Children[0].Children[2].Name` to readable paths like `"ItemLootTreeNodes.Military.Gear.Knives"`.

---

## 🚀 Features

### ✨ **Bi-Directional Navigation**
- **Forward**: JSON Structure → Semantic Path (with copy)
- **Reverse**: Semantic Path String → Jump to Definition

### 📍 **Smart Path Display**
- Real-time path updates in status bar
- Click to copy with quotes: `"ItemLootTreeNodes.Military.Gear.tools.Knives"`
- Case-insensitive search and matching

### 🔍 **Intelligent Search**
- Workspace-wide file discovery
- Configurable priority folders
- Progress indicators with cancellation

### 🎮 **Perfect for Game Development**
- **SCUM Server Configs**: Navigate loot nodes effortlessly
- **Loot Tables**: Manage complex item hierarchies
- **Skill Trees**: Navigate nested progression systems
- **Configuration Files**: Any tree-structured JSON

---

## 💡 How It Works

**Before** (Standard JSON navigation):
```json
// Hard to read and error-prone
Children[0].Children[2].Children[1].Children[0].Name
```

**After** (Semantic path):
```json
// Clean, readable, copy-paste ready
"ItemLootTreeNodes.Military.Gear.tools.Knives"
```

---

## 🎮 SCUM Server Admin Example

### **Your Workflow:**
1. **Edit spawner config**: `Spawners/Buildings-Military.json`
   ```json
   {
       "Ids": ["ItemLootTreeNodes.Military.Gear.tools.Knives"]
   }
   ```

2. **Navigate to definition**: Click the path → Press `Ctrl+Shift+G`

3. **Auto-opens**: `Nodes/Override/Military.json` at exact location:
   ```json
   {
       "Name": "Knives",
       "Rarity": "Common",
       "Children": [...]
   }
   ```

4. **Edit and return**: Make changes, easily navigate back

---

## ⌨️ Quick Reference

| Action | Shortcut | Result |
|--------|----------|--------|
| Copy with quotes | `Ctrl+Shift+C` | `"ItemLootTreeNodes.Military.Gear.tools.Knives"` |
| Copy plain | `Ctrl+Shift+Alt+C` | `ItemLootTreeNodes.Military.Gear.tools.Knives` |
| Go to definition | `Ctrl+Shift+G` | Opens file and jumps to location |
| Configure | `Ctrl+Shift+Alt+G` | Setup search paths |

---

## 📦 Installation

**Quick install:**
1. Download [latest release]
2. VS Code → `Ctrl+Shift+P` → `Extensions: Install from VSIX...`
3. Select downloaded file
4. Restart VS Code

---

## 🔧 Configuration

### **For SCUM Servers:**
```json
{
    "jsonSemanticPath.priorityFolders": [
        "**/Nodes/**", 
        "**/Override/**", 
        "**/Spawners/**"
    ]
}
```

### **For Other Projects:**
Customize search patterns in VS Code settings → `jsonSemanticPath`

---

## 📚 Documentation

- **📦 [Installation Guide]** - Step-by-step setup
- **🎮 [SCUM Server Guide]** - Game-specific tutorial
- **📝 [Changelog]** - Version history
- **🐛 [Issues]** - Bug reports and feature requests

---

## 🤝 Contributing

Found a bug or have a feature idea? 

- **🐛 Report bugs**:
- **💡 Suggest features**:
- **🔧 Submit fixes**: Pull requests welcome!

---

## 📄 License

MIT License - see [LICENSE] file for details.

---

**Made with ❤️ for the JSON navigation community**

*Especially SCUM server admins who deserve better tools!* 🎮
