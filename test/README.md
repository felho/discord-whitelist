# Test Suite for Discord Whitelist Management System

This directory contains testing files for the Whitelist Management System.

## Test Files

### `test-wms.html`
**Comprehensive Test Suite**
- Full automated test suite for all WMS functionality
- Tests legacy API compatibility, advanced features, collections, events
- Browser-based testing with visual pass/fail indicators
- Access: `https://localhost:5174/test/test-wms.html`

### `debug-test.html`
**Basic Diagnostic Tool**
- Simple diagnostic test for basic functionality
- Useful for isolating issues and debugging
- Minimal test set for quick verification
- Access: `https://localhost:5174/test/debug-test.html`

### `reload-test.html`
**Persistence Testing**
- Specifically tests data persistence across page reloads
- Step-by-step testing with manual reload verification
- Validates Tampermonkey storage functionality
- Access: `https://localhost:5174/test/reload-test.html`

### `test-console.js`
**Console Testing Script**
- JavaScript commands for manual console testing
- Copy-paste friendly for Discord console testing
- Sequential test commands for validation
- Use: Load in browser console after whitelist.js loads

## Usage

1. **Start Development Server**:
   ```bash
   npx http-server . -S -C /path/to/localhost.pem -K /path/to/localhost-key.pem -p 5174
   ```

2. **Run Tests**:
   - **Browser Tests**: Navigate to the HTML test files
   - **Discord Integration**: Use console scripts in Discord with Tampermonkey
   - **Persistence Tests**: Use reload-test.html with manual page reloads

3. **Expected Results**:
   - All tests should pass (green indicators)
   - Storage type should be "tampermonkey" (not "memory")
   - Data should persist across page reloads

## Test Coverage

- ✅ Legacy API compatibility
- ✅ Advanced API functionality
- ✅ Storage persistence (localStorage/Tampermonkey/memory fallback)
- ✅ Collections management
- ✅ Import/export operations
- ✅ Event system
- ✅ Search functionality
- ✅ Error handling
- ✅ Bulk operations
- ✅ Data migration