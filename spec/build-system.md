# Build System Specification - Discord Whitelist

## Overview

Specification for a build system that transforms the development environment's dynamic loader + whitelist.js structure into a static, installable TamperMonkey userscript.

## Current Architecture

### Development Setup
- `tm-loader.js` - TamperMonkey loader script
  - Fetches `whitelist.js` from `https://localhost:5174/`
  - Cache-busting with timestamp
  - GM API injection via Function constructor
  - Visual feedback with temporary badge
- `whitelist.js` - Main functionality
  - Self-contained Discord whitelist system
  - Storage abstraction (localStorage → Tampermonkey → memory)
  - Complete UI, filtering, and management features

### Current Workflow
1. Install `tm-loader.js` in TamperMonkey
2. Start HTTPS dev server on localhost:5174
3. Navigate to Discord → automatic code loading
4. Edit `whitelist.js` → refresh Discord page

## Build System Requirements

### Input Files
- `tm-loader.js` - Template for UserScript header and loader logic
- `whitelist.js` - Main functionality to be embedded
- `package.json` - Version and metadata source

### Output Requirements
- `dist/discord-whitelist-static.user.js` - Complete, standalone TamperMonkey script
- Self-contained: no external dependencies or network requests
- Preserves all functionality from dynamic version
- Ready for direct TamperMonkey installation

### Version Management
- Extract version from `whitelist.js` VERSION constant
- Update UserScript header with proper version
- Maintain version consistency across builds

## Technical Specifications

### UserScript Header Transformation
```javascript
// Development version (tm-loader.js)
// @name         Discord Whitelist Loader (DEV, sandbox eval)
// @namespace    local-dev

// Static version (build output)
// @name         Discord Whitelist
// @namespace    discord-whitelist
// @version      0.4.4
// @description  Discord message filtering based on user whitelist
```

### Code Integration Strategy
1. **Header Generation**: Create proper UserScript metadata block
2. **Code Embedding**: Inline `whitelist.js` content directly
3. **GM API Injection**: Preserve Function constructor pattern for GM APIs
4. **Cleanup**: Remove development-specific code (cache-busting, dev indicators)

### Build Script Features
- **Input Validation**: Verify source files exist and are readable
- **Version Extraction**: Parse VERSION constant from whitelist.js
- **Template Processing**: Generate static version from loader template
- **Output Generation**: Write to dist/ directory with proper naming
- **Error Handling**: Comprehensive error reporting and validation

### File Structure After Build
```
discord-whitelist/
├── tm-loader.js           # Development loader (unchanged)
├── whitelist.js           # Main functionality (unchanged)
├── build.js               # Build script
├── dist/
│   └── discord-whitelist-static.user.js  # Generated static version
└── package.json           # Updated with build scripts
```

## Build Commands

### NPM Scripts
- `npm run build` - Generate static version
- `npm run build:clean` - Clean dist/ directory before build
- `npm run build:watch` - Watch for changes and rebuild (optional)

### Command Line Usage
```bash
# Basic build
npm run build

# Clean build
npm run build:clean

# Output should be at: dist/discord-whitelist-static.user.js
```

## Validation Requirements

### Build Success Criteria
1. **File Generation**: Output file created in correct location
2. **Syntax Validation**: Generated JavaScript is syntactically valid
3. **Header Validation**: UserScript metadata is properly formatted
4. **Version Consistency**: Version matches source VERSION constant
5. **Size Validation**: Output file size is reasonable (not empty, not excessive)

### Testing Strategy
- **Automated**: Build script validates generated syntax
- **Manual**: Install generated script in TamperMonkey for functional testing
- **Comparison**: Verify static version has same functionality as dynamic version

## Future Enhancements

### Optional Features (Not in Initial Implementation)
- **Minification**: Optional code minification for smaller file size
- **Source Maps**: Development debugging support
- **Multiple Targets**: Different builds for different environments
- **Auto-versioning**: Automatic version bumping based on git tags
- **CI Integration**: Automated builds on version tags

## Implementation Notes

### Dependencies
- Node.js built-in modules only (fs, path)
- No external build tools required
- Keep it simple and maintainable

### Error Handling
- Graceful failure with helpful error messages
- Validation of all inputs before processing
- Clear indication of build success/failure

### Compatibility
- Generated script must work in all TamperMonkey-supported browsers
- Preserve all GM_* API functionality
- Maintain Discord compatibility

## Success Metrics

### Immediate Goals
1. **Repeatability**: Build process can be run multiple times with consistent results
2. **Functionality**: Generated script has 100% feature parity with dynamic version
3. **Usability**: Simple `npm run build` generates deployable script
4. **Maintainability**: Build process is easy to understand and modify

### Long-term Goals
1. **Automation**: Integration with version management workflow
2. **Distribution**: Easy sharing of static versions
3. **Updates**: Seamless process for releasing new versions