# Discord Whitelist System

A TamperMonkey userscript that enables filtering Discord messages based on a user-managed whitelist with advanced collection management and real-time UI.

## Quick Start

### Development
```bash
# Start development server
npx http-server . -S -C /path/to/localhost.pem -K /path/to/localhost-key.pem -p 5174

# Install tm-loader.js in TamperMonkey
# Navigate to Discord - whitelist system loads automatically
```

### Production
```bash
# Build static version
npm run build

# Install dist/discord-whitelist-static.user.js in TamperMonkey
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

**v0.4.4** (Grouped Message Filtering Fix + Build System)

## Architecture

- **tm-loader.js** - Development loader for dynamic code loading
- **whitelist.js** - Core functionality with advanced features
- **build.js** - Production build system for static deployment
- **spec/** - Complete project specifications
- **test/** - Comprehensive testing suite

## License

ISC