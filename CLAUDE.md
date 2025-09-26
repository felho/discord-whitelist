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
- Fetches and executes `whitelist.js` from `https://localhost:5173/`
- Uses sandbox eval to maintain access to Tampermonkey APIs (`GM_*`)
- Provides visual feedback through a temporary badge indicator
- Requires Tampermonkey grants: `GM_xmlhttpRequest`, `GM_addStyle`, `GM_getValue`, `GM_setValue`, `GM_deleteValue`

**whitelist.js** - Main userscript logic with:

- Multi-tier storage system (localStorage → Tampermonkey storage → memory fallback)
- State management for whitelist, enabled status, display modes
- Developer API exposed on `window.WL` for console debugging
- Comprehensive error handling and logging with `[WL]` prefix

### Storage Architecture

The system implements a three-tier storage fallback strategy:

1. **Primary**: Page `localStorage` (preferred for performance)
2. **Secondary**: Tampermonkey storage (`GM_getValue`/`GM_setValue`) for persistence across page reloads
3. **Fallback**: In-memory storage (non-persistent, issues warning)

Storage key: `tm_discord_whitelist_filter_v1`

### State Structure

```javascript
{
  whitelist: [],      // Array of whitelisted usernames (strings)
  enabled: true,      // Whether filtering is active
  hardHide: false,    // Display mode setting
  showAllTemp: false  // Temporary override setting
}
```

### Developer API

Exposed on `window.WL`:

- `getState()` - Returns current state snapshot
- `setState(partial)` - Updates state with partial object
- `resetState()` - Resets to defaults and clears storage
- `addToWhitelist(name)` - Adds username (case-insensitive, duplicate prevention)
- `removeFromWhitelist(name)` - Removes username (case-insensitive)
- `clearWhitelist()` - Empties the whitelist array

## Development Workflow

1. **Setup**: Install SSL certificates for HTTPS localhost
2. **Development**: Start `http-server` with SSL on port 5173
3. **Testing**: Install `tm-loader.js` in Tampermonkey, navigate to Discord
4. **Debugging**: Use `window.WL` API in browser console for state inspection
5. **Iteration**: Edit `whitelist.js`, reload Discord page (cache-busted automatically)

## Technical Notes

- **Version**: Currently v0.1.0 (Milestone 1: State & Storage)
- **Cache Busting**: Automatic timestamp parameter prevents caching issues
- **Error Handling**: Comprehensive try-catch blocks with fallback behavior
- **Logging**: Debug logging with `[WL]` prefix, configurable via `DEBUG` constant
- **Security**: Uses sandbox eval to maintain Tampermonkey API access while executing remote code

## Future Development

Based on `spec.md`, the project roadmap includes:

- Discord bot integration with discord.js
- Database storage (SQLite/MongoDB) replacing JSON
- Role-based access control
- Comprehensive testing and deployment preparation
