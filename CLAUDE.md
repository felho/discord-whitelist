# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Discord whitelist system built as a Tampermonkey userscript that dynamically loads from a local development server. The project enables filtering Discord content based on a user-managed whitelist with persistent storage.

## Development Setup

### Starting the Development Server

```bash
npx http-server . -S -C /Users/felho/dev/mkcert/localhost.pem -K /Users/felho/dev/mkcert/localhost-key.pem -p 5173
```

Note: The project requires HTTPS for local development due to Discord's security policies. You'll need to generate SSL certificates using `mkcert` or similar tools.

### Available Scripts

- `npm test` - Currently placeholder, exits with error message

## Architecture

### Core Components

**tm-loader.js** - Tampermonkey loader script that:

- Runs on `https://discord.com/*`
- Fetches and executes `whitelist.js` from `https://localhost:5174/`
- Uses Function constructor to inject Tampermonkey APIs (`GM_*`) into execution context
- Provides visual feedback through a temporary badge indicator
- Requires Tampermonkey grants: `GM_xmlhttpRequest`, `GM_addStyle`, `GM_getValue`, `GM_setValue`, `GM_deleteValue`

**whitelist.js** - Advanced Whitelist Management System with User Interface:

- Object-oriented architecture with specialized managers (WhitelistManager, CollectionManager, UIManager)
- Multi-tier storage system (localStorage → Tampermonkey storage → memory fallback)
- Multiple whitelist collections with metadata and settings
- Event-driven state management with real-time notifications
- Import/export functionality (JSON, CSV, TXT formats)
- Advanced search and analytics capabilities
- **Message Filtering Engine**: Real-time Discord message filtering with MutationObserver
- **Multiple Display Modes**: Normal (collapse), Hard Hide (remove), Show All (temporary override)
- **Advanced DOM Processing**: Comprehensive text node filtering with TreeWalker API
- **User Interface Panel**: Floating, draggable control panel integrated into Discord
- **Collection Management UI**: Complete interface for creating, editing, and managing collections
- **Real-time Controls**: Live filter toggles, whitelist editor, and statistics display
- **Keyboard Shortcuts**: Ctrl+Shift+W to toggle panel visibility
- **Performance Optimization**: Debounced processing, batch operations, caching
- Comprehensive developer API exposed on `window.WL`
- Legacy API compatibility for backward compatibility

### Storage Architecture

The system implements a sophisticated multi-tier storage strategy:

1. **Primary**: Page `localStorage` (preferred for performance)
2. **Secondary**: Tampermonkey storage (`GM_getValue`/`GM_setValue`) for persistence across page reloads
3. **Fallback**: In-memory storage (non-persistent, issues warning)

**Storage Keys**:
- `tm_discord_whitelist_filter_v1` - Legacy data (migrated automatically)
- `tm_discord_whitelist_collections_v1` - Whitelist collections
- `tm_discord_whitelist_config_v1` - System configuration

### Enhanced Data Models

**WhitelistEntry**:
```javascript
{
  username: string,      // Discord username (normalized)
  dateAdded: Date,       // When user was added
  lastSeen: Date,        // Last message processed
  source: string,        // How added ('manual', 'import', 'legacy')
  notes: string          // Optional user notes
}
```

**WhitelistCollection**:
```javascript
{
  id: string,            // Unique collection ID
  name: string,          // User-defined name
  entries: Map,          // Username entries (case-insensitive keys)
  settings: Object,      // Collection-specific settings
  metadata: Object       // Creation/modification timestamps
}
```

**System Configuration**:
```javascript
{
  activeCollection: string,     // Currently active collection ID
  collections: Array,           // Available collections
  globalSettings: {
    enabled: true,              // Master toggle
    hardHide: false,           // Display mode
    showAllTemp: false,        // Temporary override
    caseSensitive: false,      // Username matching
    maxEntries: 1000          // Per-collection limit
  }
}
```

### Developer API

**Legacy API (Backward Compatible)**:
- `getState()` - Returns current state snapshot
- `setState(partial)` - Updates state with partial object
- `resetState()` - Resets to defaults and clears storage
- `addToWhitelist(name)` - Adds username (case-insensitive, duplicate prevention)
- `removeFromWhitelist(name)` - Removes username (case-insensitive)
- `clearWhitelist()` - Empties the whitelist array

**Advanced API**:
- `whitelist.*` - WhitelistManager operations (add, remove, isWhitelisted, getStats, bulkUpdate)
- `collections.*` - Collection management (create, delete, switch, getAll, getActive)
- `search.*` - Search functionality (users, fuzzy matching)
- `data.*` - Import/export operations (JSON, CSV, TXT formats)
- `events.*` - Event system (on, off, emit for state changes)
- `system.*` - System information and configuration management:
  - `getConfig()` - Get current configuration with deep copy
  - `setConfig(partial)` - Safely merge configuration changes (deep merge for nested objects)
  - `setEnabled(boolean)` - Safe toggle for filtering enabled state
  - `setHardHide(boolean)` - Safe toggle for hard hide mode
  - `setShowAllTemp(boolean)` - Safe toggle for temporary show all mode
- `dev.*` - Developer utilities (debugging, data migration, cleanup)
- **`filter.*`** - Message filtering controls (start, stop, refresh, clear, getStats)
- **`ui.*`** - User interface controls (show, hide, toggle, isVisible)

## Development Workflow

1. **Setup**: Install SSL certificates for HTTPS localhost
2. **Development**: Start `http-server` with SSL on port 5174 (or 5173)
3. **Testing**: Install `tm-loader.js` in Tampermonkey, navigate to Discord
4. **Debugging**: Use `window.WL` API in browser console for comprehensive testing
5. **Iteration**: Edit `whitelist.js`, reload Discord page (cache-busted automatically)

## Technical Notes

- **Version**: Currently v0.4.1 (User Interface Implementation + Critical Bug Fixes)
- **Cache Busting**: Automatic timestamp parameter prevents caching issues
- **Error Handling**: Comprehensive try-catch blocks with graceful fallback behavior
- **Logging**: Debug logging with `[WL]` prefix, configurable via `DEBUG` constant
- **Security**: Uses Function constructor to inject Tampermonkey APIs into execution context
- **Storage**: Tampermonkey storage properly accessible via Function constructor injection
- **Testing**: Comprehensive test suite available in `/test/` directory
- **Filtering**: Real-time message processing with MutationObserver and TreeWalker API
- **Performance**: Optimized with debouncing, batch processing, and message caching
- **API Safety**: Deep merge configuration updates prevent nested object corruption
- **Filter Reliability**: Immediate visibility restoration when filtering is disabled, no page refresh required
- **Real-time Updates**: Whitelist changes immediately update message visibility without page refresh
- **Cache Synchronization**: Automatic lookup cache rebuilding ensures whitelist changes take effect instantly

## Current Development Status

### ✅ Completed Milestones

**Milestone 0: Whitelist Management System (v0.2.0)**
- Advanced object-oriented architecture with specialized managers
- Multi-collection whitelist support with metadata
- Enhanced storage system with automatic migration
- Import/export functionality (JSON, CSV, TXT)
- Event-driven state management
- Comprehensive developer API

**Milestone 1: Message Filtering Foundation (v0.3.0)**
- Real-time Discord message detection with MutationObserver
- MessageObserver class for DOM monitoring with debouncing
- FilterEngine class with comprehensive filtering logic
- Multiple display modes (normal collapse, hard hide, show all)
- Advanced text node processing with TreeWalker API
- Performance optimization with batch processing and caching
- Integration with existing whitelist management system
- Comprehensive test suite in `/test/test-filtering.html`

**Milestone 2: User Interface Implementation (v0.4.0)**
- Complete UIManager class with Discord-integrated floating panel
- Draggable, collapsible control panel with position persistence
- Real-time whitelist editor with collection-specific functionality
- Complete collection management UI (create/delete/rename/switch)
- Filter controls interface for all display modes and settings
- Live statistics display with collection and filtering metrics
- Keyboard shortcut integration (Ctrl+Shift+W)
- Discord-themed CSS styling matching platform design
- Event-driven UI updates with comprehensive error handling
- Unsaved changes protection and user confirmation dialogs

**Milestone 2.1: Critical Bug Fixes (v0.4.1)**
- Fixed whitelist editor save functionality to immediately update message visibility
- Resolved lookup cache synchronization issue where changes required page refresh
- Enhanced refresh logic with proper cache clearing and message reprocessing
- Improved error handling and debugging for save operations

### 🚧 Next Development Phase

Based on `spec/spec.md`, the upcoming roadmap includes:

**Future Development**:
- Discord bot integration with discord.js
- Database storage (SQLite/MongoDB) replacing JSON
- Role-based access control
- Comprehensive testing and deployment preparation
