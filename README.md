# Discord Whitelist System

A TamperMonkey userscript that enables filtering Discord messages based on a user-managed whitelist with advanced collection management and real-time UI.

## For Regular Users (Just Want to Use the Script)

### Step 1: Install TamperMonkey
1. Install the [TamperMonkey browser extension](https://www.tampermonkey.net/)
   - Chrome: [Chrome Web Store](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - Firefox: [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
   - Edge: [Microsoft Store](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

### Step 2: Install the Discord Whitelist Script
1. Download the latest script: **[discord-whitelist-static.user.js](https://raw.githubusercontent.com/felho/discord-whitelist/main/dist/discord-whitelist-static.user.js)**
2. Click the downloaded file or drag it into your browser - TamperMonkey will prompt to install
3. Click "Install" in the TamperMonkey dialog

### Step 3: Use on Discord
1. Navigate to [Discord](https://discord.com/) in your browser
2. **Right-click any message** to open the context menu with whitelist options
3. Or press `Ctrl+Shift+W` to open the whitelist control panel
4. Add usernames to your whitelist and enable filtering
5. Messages from non-whitelisted users will be collapsed or hidden

That's it! The script will automatically filter Discord messages based on your whitelist.

## For Developers

### Development Philosophy

This project uses a unique **dynamic loading development setup** designed for rapid iteration and efficient development workflow:

**Why this setup?**
- **Fast Iteration**: Edit `whitelist.js` in your IDE and simply refresh Discord - no copy-pasting into TamperMonkey
- **Live Development**: Main code lives in the filesystem where you can use proper debugging, version control, and IDE features
- **No Manual Updates**: Changes are automatically loaded without manually updating the TamperMonkey script
- **Real Development Environment**: Work with actual files instead of textarea boxes in browser extensions

**How it works:**
1. **tm-loader.js** - Minimal TamperMonkey script that fetches the real code from localhost
2. **whitelist.js** - Your actual development code that gets dynamically loaded
3. **HTTPS localhost** - Required for Discord's security policies
4. **Automatic cache-busting** - Ensures fresh code loads on every page refresh

This approach transforms TamperMonkey development from a tedious copy-paste workflow into a proper development experience.

### Quick Start

### Development Setup
```bash
# 1. Generate SSL certificates (one-time setup)
# Install mkcert: https://github.com/FiloSottile/mkcert
mkcert localhost

# 2. Start development server with HTTPS
npx http-server . -S -C localhost.pem -K localhost-key.pem -p 5174

# 3. Install tm-loader.js in TamperMonkey (one-time)
# 4. Navigate to Discord - whitelist system loads automatically from localhost
# 5. Edit whitelist.js and refresh Discord page to see changes
```

### Production (Built Version Included)
```bash
# Option 1: Use pre-built version (recommended for end users)
# Install dist/discord-whitelist-static.user.js directly in TamperMonkey

# Option 2: Build from source (for developers)
npm run build
# Then install dist/discord-whitelist-static.user.js in TamperMonkey
```

## Features

- ✅ **Individual Message Toggle Switches** - Per-message visibility control with toggle switches (top-left corner)
- ✅ **Right-Click Context Menu** - Quick whitelist management directly from Discord messages
- ✅ **Real-time Message Filtering** - Filter Discord messages based on whitelist
- ✅ **Multiple Collections** - Organize whitelists into collections with metadata
- ✅ **Advanced UI Panel** - Draggable, Discord-integrated control panel (Ctrl+Shift+W)
- ✅ **Multiple Display Modes** - Normal (collapse), Hard Hide, Show All temporarily
- ✅ **Smart Username Detection** - Handles grouped messages, replies, and mentions correctly
- ✅ **Import/Export** - JSON, CSV, TXT format support
- ✅ **Persistent Storage** - Multi-tier storage (localStorage → TamperMonkey → memory)
- ✅ **Developer API** - Comprehensive `window.WL` API for programmatic control
- ✅ **Performance Optimized** - Debounced processing, batch operations, caching

## Documentation

- **[CLAUDE.md](CLAUDE.md)** - Complete development guide and architecture
- **[spec/](spec/)** - Detailed specifications and requirements
- **[test/](test/)** - Testing suite documentation

## Current Version

**v0.6.0** (Individual Message Toggle Switches)

## Architecture

- **tm-loader.js** - Development loader for dynamic code loading
- **whitelist.js** - Core functionality with advanced features
- **build.js** - Production build system for static deployment
- **dist/** - Pre-built production files (ready for TamperMonkey)
- **spec/** - Complete project specifications
- **test/** - Comprehensive testing suite

## License

ISC