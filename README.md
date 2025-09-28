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
2. Press `Ctrl+Shift+W` to open the whitelist control panel
3. Add usernames to your whitelist and enable filtering
4. Messages from non-whitelisted users will be collapsed or hidden

That's it! The script will automatically filter Discord messages based on your whitelist.

## For Developers

### Quick Start

### Development
```bash
# Start development server
npx http-server . -S -C /path/to/localhost.pem -K /path/to/localhost-key.pem -p 5174

# Install tm-loader.js in TamperMonkey
# Navigate to Discord - whitelist system loads automatically
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

- ✅ **Real-time Message Filtering** - Filter Discord messages based on whitelist
- ✅ **Multiple Collections** - Organize whitelists into collections with metadata
- ✅ **Advanced UI Panel** - Draggable, Discord-integrated control panel (Ctrl+Shift+W)
- ✅ **Multiple Display Modes** - Normal (collapse), Hard Hide, Show All temporarily
- ✅ **Import/Export** - JSON, CSV, TXT format support
- ✅ **Persistent Storage** - Multi-tier storage (localStorage → TamperMonkey → memory)
- ✅ **Developer API** - Comprehensive `window.WL` API for programmatic control
- ✅ **Performance Optimized** - Debounced processing, batch operations, caching

## Documentation

- **[CLAUDE.md](CLAUDE.md)** - Complete development guide and architecture
- **[spec/](spec/)** - Detailed specifications and requirements
- **[test/](test/)** - Testing suite documentation

## Current Version

**v0.4.4** (Grouped Message Filtering Fix + Build System + Built Files in Git)

## Architecture

- **tm-loader.js** - Development loader for dynamic code loading
- **whitelist.js** - Core functionality with advanced features
- **build.js** - Production build system for static deployment
- **dist/** - Pre-built production files (ready for TamperMonkey)
- **spec/** - Complete project specifications
- **test/** - Comprehensive testing suite

## License

ISC