# Discord Whitelist Tampermonkey Script Specification

## Project Overview

A Tampermonkey userscript that filters Discord web interface to show only messages from whitelisted users. The script provides a floating control panel for managing the whitelist and implements real-time message filtering with multiple display modes.

## Current Implementation Details

- Loader script in Tampermonkey that fetches and executes `whitelist.js` from `https://localhost:5173/`.
- Local HTTPS development setup using `mkcert` and `http-server`.
- Storage adapter implemented with preference order: page `localStorage` → Tampermonkey storage (`GM_*`) → memory fallback.
- Developer API exposed on `window.WL` with functions: `getState`, `setState`, `resetState`, `addToWhitelist`, `removeFromWhitelist`, `clearWhitelist`.
- Verified console logging, versioning, and `[WL]` debug prefix.
- State persists correctly when using Tampermonkey storage backend.

## Core Functionality Requirements

### Whitelist Management System

- **Whitelist Storage**: Maintain a list of allowed Discord usernames per channel
- **Persistence**: Store whitelist in browser localStorage with Tampermonkey storage fallback
- **Case Sensitivity**: Handle usernames with case-insensitive matching
- **Duplicate Prevention**: Automatically prevent duplicate entries in whitelist

### Message Filtering Engine

- **Real-time Filtering**: Filter messages as they appear in Discord channels
- **DOM Scanning**: Scan Discord message containers (`li` elements) for username detection
- **Author Extraction**: Extract username from Discord's message structure
- **Dynamic Content**: Handle Discord's infinite scroll and dynamic message loading

### Display Modes

- **Normal Mode**: Show whitelisted messages, collapse non-whitelisted with placeholder
- **Hard Hide Mode**: Completely remove non-whitelisted messages from DOM
- **Show All Temporary**: Override filtering temporarily to show all messages
- **Enabled/Disabled**: Global toggle for all filtering functionality

### User Interface Panel

- **Floating Panel**: Inject control panel into Discord web interface
- **Whitelist Editor**: Textarea for editing whitelist (one username per line)
- **Save Button**: Persist whitelist changes to storage
- **Toggle Controls**: Checkboxes for enabling/disabling filtering modes
- **Visual Feedback**: Show current filtering status and statistics

## Technical Implementation Requirements

### MutationObserver Integration

- **DOM Watching**: Monitor Discord DOM for dynamically added message elements
- **Performance Optimization**: Efficient handling of rapid message updates
- **Debouncing**: Prevent excessive filtering operations during bulk updates
- **Error Recovery**: Graceful handling of Discord DOM structure changes

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

### Milestone 1: Core Filtering Foundation

- Implement basic message detection and username extraction
- Create MutationObserver for dynamic content handling
- Build core filtering logic with whitelist checking
- Add basic CSS-based hiding mechanisms

### Milestone 2: User Interface Implementation

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
