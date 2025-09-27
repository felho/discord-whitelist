# Discord Whitelist Tampermonkey Script Specification

## Project Overview

A Tampermonkey userscript that filters Discord web interface to show only messages from whitelisted users. The script provides a floating control panel for managing the whitelist and implements real-time message filtering with multiple display modes.

## Current Implementation Status

### ✅ **Completed - Whitelist Management System (v0.2.0)**

- **Advanced Architecture**: Object-oriented system with specialized managers (WhitelistManager, CollectionManager, SearchManager, DataManager)
- **Multi-Collection Support**: Create and manage multiple whitelist collections with metadata
- **Enhanced Storage**: Three-tier fallback strategy with automatic legacy data migration
- **Import/Export**: Support for JSON, CSV, and TXT formats with bulk operations
- **Event System**: Real-time notifications for state changes and updates
- **Search & Analytics**: Advanced search functionality with usage statistics
- **Developer API**: Comprehensive API with both legacy compatibility and advanced features
- **Tampermonkey Integration**: Function constructor injection ensures proper GM API access
- **Testing Suite**: Comprehensive test infrastructure in `/test/` directory

### 🔧 **Technical Implementation**

- Loader script fetches and executes `whitelist.js` from `https://localhost:5174/` (configurable)
- Local HTTPS development setup using `mkcert` and `http-server`
- Storage adapter with preference order: page `localStorage` → Tampermonkey storage → memory fallback
- Function constructor execution context provides proper access to GM APIs
- Automatic cache-busting prevents stale code issues during development
- Comprehensive error handling with graceful degradation

## Core Functionality Requirements

### ✅ **Completed - Message Filtering Foundation (v0.3.0)**

The core Discord message filtering functionality has been implemented:

### ✅ **Completed - User Interface Implementation (v0.4.0)**

Complete floating control panel with Discord integration has been implemented:

#### User Interface Panel

- ✅ **Floating Control Panel**: Draggable, collapsible interface integrated into Discord
- ✅ **Collection Management UI**: Create, delete, rename, and switch between collections
- ✅ **Real-time Whitelist Editor**: Textarea-based editor with validation and change tracking
- ✅ **Filter Controls Interface**: Toggles for all display modes and filtering settings
- ✅ **Live Statistics Display**: Real-time collection and filtering metrics
- ✅ **Keyboard Shortcuts**: Ctrl+Shift+W for panel toggle
- ✅ **Discord Theme Integration**: CSS styling matching Discord's design language
- ✅ **Position Persistence**: Panel position saved across browser sessions
- ✅ **Unsaved Changes Protection**: Confirmation dialogs prevent data loss
- ✅ **Event-driven Updates**: Real-time UI synchronization with backend changes

#### Message Filtering Engine

- ✅ **Real-time Filtering**: Filter messages as they appear in Discord channels
- ✅ **DOM Scanning**: Scan Discord message containers (`li` elements) for username detection
- ✅ **Author Extraction**: Extract username from Discord's message structure
- ✅ **Dynamic Content**: Handle Discord's infinite scroll and dynamic message loading
- ✅ **Advanced Processing**: TreeWalker API for comprehensive text node filtering
- ✅ **Performance Optimization**: Debounced MutationObserver with batch processing

### Display Modes

- ✅ **Normal Mode**: Show whitelisted messages, collapse non-whitelisted with placeholder
- ✅ **Hard Hide Mode**: Completely remove non-whitelisted messages from DOM
- ✅ **Show All Temporary**: Override filtering temporarily to show all messages
- ✅ **Enabled/Disabled**: Global toggle for all filtering functionality

### ✅ **Completed - Critical Bug Fixes (v0.4.1)**

Bug fixes and reliability improvements:

- ✅ **Real-time Updates**: Fixed whitelist editor save functionality to immediately update message visibility
- ✅ **Cache Synchronization**: Resolved lookup cache synchronization issue where changes required page refresh
- ✅ **Enhanced Refresh Logic**: Improved message reprocessing with proper cache clearing
- ✅ **Error Handling**: Better error handling and debugging for save operations
- ✅ **Immediate Feedback**: Whitelist changes now take effect instantly without page refresh

### ✅ **Completed - Grouped Message Filtering Fix (v0.4.4)**

Enhanced message filtering for Discord's message grouping behavior:

- ✅ **Consecutive Message Handling**: Fixed filtering of grouped messages from same user without username elements
- ✅ **Username Inheritance**: Enhanced `extractUsername()` to search previous messages when username not found
- ✅ **Backward Search Logic**: Added `findUsernameFromPreviousMessage()` method with intelligent search limits
- ✅ **Message Element Detection**: Improved `isMessageElement()` helper for reliable message container identification
- ✅ **Performance Optimization**: Limited search to 10 previous messages to prevent infinite loops
- ✅ **Logical Grouping**: Stops search when encountering different user's message to respect natural message boundaries

## Technical Implementation Requirements

### ✅ **MutationObserver Integration (COMPLETED)**

- ✅ **DOM Watching**: Monitor Discord DOM for dynamically added message elements
- ✅ **Performance Optimization**: Efficient handling of rapid message updates
- ✅ **Debouncing**: Prevent excessive filtering operations during bulk updates
- ✅ **Error Recovery**: Graceful handling of Discord DOM structure changes

### Keyboard Shortcuts

- **Toggle Filtering**: Quick enable/disable of filtering functionality
- **Add Current User**: Add hovered/selected username to whitelist
- **Show Panel**: Open/close control panel
- **Temporary Override**: Quick show-all toggle

### Developer Utilities

- **Console API**: Global functions for debugging and testing
- **Logging System**: Comprehensive logging with `[WL]` prefix
- **State Inspection**: Easy access to current filtering state
- **Reset Functionality**: Quick reset to default settings

## State Management Schema

```javascript
{
  whitelist: [],           // Array of whitelisted usernames
  enabled: true,           // Master enable/disable switch
  hardHide: false,         // Use hard hide mode vs collapse mode
  showAllTemp: false,      // Temporary override to show all messages
  panelVisible: false,     // Control panel visibility state
  keyboardEnabled: true    // Keyboard shortcuts enabled
}
```

## Discord Integration Requirements

### Message Detection

- **Message Containers**: Identify Discord message `li` elements
- **Username Extraction**: Extract author names from various Discord message formats
- **Content Preservation**: Maintain Discord functionality while filtering
- **React Compatibility**: Work with Discord's React-based interface

### Context Handling

- **Text Channels**: Filter messages in server text channels
- **Direct Messages**: Handle DM conversations
- **Group Chats**: Support group message filtering
- **Search Results**: Filter search result messages
- **Thread Messages**: Handle threaded conversations

### Performance Considerations

- **Memory Efficiency**: Minimize memory impact of filtering operations
- **CPU Optimization**: Efficient username matching and DOM operations
- **Scroll Performance**: Maintain smooth scrolling in large channels
- **Startup Time**: Fast initialization without blocking Discord loading

## Milestone Implementation Plan

### ✅ **Milestone 0: Whitelist Management System (COMPLETED)**

- ✅ Advanced object-oriented architecture with specialized managers
- ✅ Multi-collection whitelist support with metadata
- ✅ Enhanced storage system with automatic migration
- ✅ Import/export functionality (JSON, CSV, TXT)
- ✅ Event-driven state management
- ✅ Comprehensive developer API
- ✅ Testing infrastructure and documentation

### ✅ **Milestone 1: Message Filtering Foundation (COMPLETED)**

- ✅ Implement basic message detection and username extraction
- ✅ Create MutationObserver for dynamic content handling
- ✅ Build core filtering logic with whitelist checking
- ✅ Add basic CSS-based hiding mechanisms
- ✅ Advanced text node processing with TreeWalker API
- ✅ Performance optimization with debouncing and batch processing
- ✅ Comprehensive test suite with `/test/test-filtering.html`

### ✅ **Milestone 2: User Interface Implementation (COMPLETED)**

- ✅ Complete UIManager class with Discord-integrated floating panel
- ✅ Draggable, collapsible control panel with position persistence
- ✅ Real-time whitelist editor with collection-specific functionality
- ✅ Complete collection management UI (create/delete/rename/switch)
- ✅ Filter controls interface for all display modes and settings
- ✅ Live statistics display with collection and filtering metrics
- ✅ Keyboard shortcut integration (Ctrl+Shift+W)
- ✅ Discord-themed CSS styling matching platform design
- ✅ Event-driven UI updates with comprehensive error handling
- ✅ Unsaved changes protection and user confirmation dialogs

### 🚧 **Milestone 3: Advanced Features (NEXT)**

- ✅ Keyboard shortcuts system (Ctrl+Shift+W implemented)
- ✅ Collapse mode with placeholder messages (implemented)
- ✅ Hard hide mode with DOM removal (implemented)
- ✅ Temporary show-all override functionality (implemented)
- 📋 Import/export user interface integration
- 📋 Advanced keyboard shortcuts for collection management
- 📋 Context menu integration

### Milestone 4: Polish and Optimization

- Optimize performance for large channels
- Add visual feedback and status indicators
- Implement error handling and recovery
- Add comprehensive logging and debugging tools

### Milestone 5: Testing and Documentation

- Test across different Discord contexts
- Verify compatibility with Discord updates
- Create user documentation and setup guide
- Implement automated testing where possible
