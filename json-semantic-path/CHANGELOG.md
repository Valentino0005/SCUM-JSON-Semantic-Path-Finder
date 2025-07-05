# Change Log

All notable changes to the "JSON Semantic Path" extension will be documented in this file.

## [0.2.0] - 2025-07-05

### Added
- **Reverse Navigation**: Go from semantic path string to JSON definition
- **Case-Insensitive Search**: Find paths regardless of case differences
- **Quoted Path Copying**: Default copy includes quotes for JSON compatibility
- **Smart Workspace Search**: Priority folders and configurable search paths
- **Progress Indicators**: Visual feedback during search operations
- **Enhanced Error Handling**: Better messages and fallback strategies
- **Configuration Options**: Customize search paths and priority folders

### Changed
- Copy command now includes quotes by default (`"path"`)
- Search is now case-insensitive for better usability
- Status bar moved to right side for better visibility
- Improved tooltips and user feedback

### Fixed
- Better object boundary detection for nested structures
- More accurate position mapping for leaf nodes
- Improved validation for complex JSON structures

## [0.1.0] - 2025-07-05

### Added
- Initial release
- Basic semantic path display in status bar
- Copy semantic path functionality
- Context menu integration
- Keyboard shortcuts
- Real-time path updates