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

### 🚧 **Next Phase - User Interface Panel**

- **Floating Panel**: Inject control panel into Discord web interface
- **Whitelist Editor**: Textarea for editing whitelist (one username per line)
- **Save Button**: Persist whitelist changes to storage
- **Toggle Controls**: Checkboxes for enabling/disabling filtering modes
- **Visual Feedback**: Show current filtering status and statistics

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

### 🚧 **Milestone 2: User Interface Implementation (NEXT)**

- Design and implement floating control panel
- Add whitelist editing interface with textarea
- Implement save/load functionality for whitelist
- Add toggle controls for filtering modes

### Milestone 3: Advanced Features

- Implement keyboard shortcuts system
- Add collapse mode with placeholder messages
- Create hard hide mode with DOM removal
- Add temporary show-all override functionality

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
