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

**whitelist.js** - Advanced Whitelist Management System with:

- Object-oriented architecture with specialized managers (WhitelistManager, CollectionManager, etc.)
- Multi-tier storage system (localStorage → Tampermonkey storage → memory fallback)
- Multiple whitelist collections with metadata and settings
- Event-driven state management with real-time notifications
- Import/export functionality (JSON, CSV, TXT formats)
- Advanced search and analytics capabilities
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
- `system.*` - System information (version, storageType, config)
- `dev.*` - Developer utilities (debugging, data migration, cleanup)

## Development Workflow

1. **Setup**: Install SSL certificates for HTTPS localhost
2. **Development**: Start `http-server` with SSL on port 5174 (or 5173)
3. **Testing**: Install `tm-loader.js` in Tampermonkey, navigate to Discord
4. **Debugging**: Use `window.WL` API in browser console for comprehensive testing
5. **Iteration**: Edit `whitelist.js`, reload Discord page (cache-busted automatically)

## Technical Notes

- **Version**: Currently v0.2.0 (Whitelist Management System)
- **Cache Busting**: Automatic timestamp parameter prevents caching issues
- **Error Handling**: Comprehensive try-catch blocks with graceful fallback behavior
- **Logging**: Debug logging with `[WL]` prefix, configurable via `DEBUG` constant
- **Security**: Uses Function constructor to inject Tampermonkey APIs into execution context
- **Storage**: Tampermonkey storage properly accessible via Function constructor injection
- **Testing**: Comprehensive test suite available in `/test/` directory

## Future Development

Based on `spec/spec.md`, the project roadmap includes:

- Discord bot integration with discord.js
- Database storage (SQLite/MongoDB) replacing JSON
- Role-based access control
- Comprehensive testing and deployment preparation
