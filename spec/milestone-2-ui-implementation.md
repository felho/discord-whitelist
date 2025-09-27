# Milestone 2: User Interface Implementation Specification

## Overview

This milestone focuses on implementing a floating control panel that integrates directly into the Discord web interface, providing users with an intuitive way to manage their whitelist and filtering settings in real-time.

## Core Requirements

### Floating Control Panel

**Panel Design**:
- **Position**: Floating overlay that doesn't interfere with Discord's interface
- **Draggable**: Users can reposition the panel to their preference
- **Collapsible**: Minimize/maximize functionality to reduce screen real estate
- **Responsive**: Adapts to different screen sizes and Discord layouts
- **Theme Integration**: Matches Discord's dark/light theme styling

**Panel Components**:
1. **Header Bar**
   - Title: "Whitelist Control"
   - Collection selector dropdown (shows active collection)
   - Minimize/maximize button
   - Close button (hides panel)
   - Drag handle for repositioning

2. **Collection Management Section** (Collapsible)
   - Current collection display with metadata (name, entry count, last modified)
   - Collection dropdown/selector with creation timestamp
   - "New Collection" button with name input modal
   - "Rename Collection" button (disabled for default collection)
   - "Delete Collection" button (disabled for default collection, requires confirmation)
   - "Switch Collection" confirmation when unsaved changes exist

3. **Whitelist Editor Section**
   - Collection-specific textarea for username list (one per line)
   - Character/line count indicator + collection entry limit display
   - Auto-save indicator with collection context
   - Clear all button with confirmation (only clears current collection)
   - Search/filter box for large whitelists

4. **Filter Controls Section**
   - Master enable/disable toggle (affects all collections)
   - Display mode selector (Normal/Hard Hide/Show All)
   - Temporary override quick toggle
   - Status indicator showing current mode and active collection

5. **Statistics Section**
   - Current collection: name, entry count, creation date
   - Messages filtered count (session, all collections)
   - Total collections count
   - Last update timestamp

6. **Actions Section**
   - Save changes button (collection-specific)
   - Import/export with collection context
   - Collection management quick actions
   - Reset to defaults (with confirmation)
   - Help/documentation link

### Integration Requirements

**DOM Injection**:
- Panel injected into Discord's main container
- High z-index to ensure visibility over Discord elements
- Isolated CSS to prevent style conflicts
- Responsive positioning that adapts to Discord layout changes

**Event Handling**:
- Real-time synchronization with filtering engine
- Immediate UI updates when whitelist changes
- Keyboard shortcuts integration
- Click-outside-to-minimize functionality

**State Persistence**:
- Remember panel position between sessions
- Persist panel visibility state
- Auto-save whitelist changes with debouncing
- Restore last active collection

## Technical Implementation Details

### Panel Architecture

**UIManager Class Structure**:
```javascript
class UIManager {
  constructor(whitelistManager, filterEngine, storageManager) {
    this.whitelistManager = whitelistManager;
    this.filterEngine = filterEngine;
    this.storageManager = storageManager;
    this.panel = null;
    this.isVisible = false;
    this.position = { x: 20, y: 20 };
    this.isMinimized = false;
    this.activeCollectionId = null;
    this.hasUnsavedChanges = false;
  }

  // Core Methods
  createPanel()           // Build panel DOM structure
  showPanel()            // Make panel visible
  hidePanel()            // Hide panel
  togglePanel()          // Toggle visibility
  minimizePanel()        // Collapse to header only

  // Collection Management
  updateCollectionSelector() // Refresh collection dropdown
  switchCollection(id)   // Change active collection with unsaved check
  createNewCollection()  // Show create collection modal
  deleteCollection(id)   // Delete collection with confirmation
  renameCollection(id)   // Rename collection with validation

  // Whitelist Management
  updateWhitelistDisplay() // Sync textarea with current collection
  saveChanges()          // Persist current collection changes
  clearCurrentCollection() // Clear current collection with confirmation

  // UI State Management
  markUnsavedChanges()   // Track pending changes
  clearUnsavedChanges()  // Reset change tracking
  showConfirmationDialog(message, callback) // Generic confirmation
  showCollectionModal(type, data) // Collection create/rename modal

  // Event Handling
  bindEvents()           // Attach event listeners
  handleCollectionSwitch(newId) // Handle collection change
  handleWhitelistChange() // Handle textarea changes

  // Visual Updates
  applyStyles()          // Inject CSS styles
  updateStats()          // Refresh statistics display
  updateFilterStatus()   // Update filter mode indicators
}
```

### CSS Integration

**Styling Strategy**:
- Scoped CSS using unique class prefixes (`wl-panel-*`)
- CSS custom properties for theming
- Flexbox layout for responsive design
- Discord color palette integration
- Smooth animations for show/hide/minimize

**Key Style Classes**:
```css
.wl-panel-container      /* Main panel wrapper */
.wl-panel-header         /* Draggable header bar */
.wl-panel-content        /* Scrollable content area */
.wl-panel-section        /* Individual sections */
.wl-panel-minimized      /* Collapsed state */
.wl-panel-dragging       /* During drag operations */
```

### Event Integration

**Event Bindings**:
- Window resize → Adjust panel position if needed
- Whitelist changes → Update UI displays
- Filter mode changes → Update toggle states
- Discord navigation → Maintain panel state
- Keyboard shortcuts → Panel control actions

**Real-time Updates**:
- Bidirectional synchronization between UI and core system
- Debounced textarea changes (500ms delay)
- Immediate toggle responses
- Live statistics updates

## Collection Management Workflows

### Available API Operations

The existing system provides these collection management operations via `window.WL.collections`:

```javascript
// Collection Management API
WL.collections.getActive()     // Get active collection data
WL.collections.getAll()        // Get all collections array
WL.collections.create(name, options) // Create new collection
WL.collections.delete(id)      // Delete collection by ID
WL.collections.switch(id)      // Switch active collection
WL.collections.get(id)         // Get specific collection data
```

### Collection Data Structure

Each collection contains:
```javascript
{
  id: "unique-id",              // Auto-generated or custom
  name: "Collection Name",      // User-defined display name
  entries: Map,                 // Username entries (case-insensitive keys)
  settings: {},                 // Collection-specific settings
  metadata: {
    created: Date,              // Creation timestamp
    modified: Date,             // Last modification timestamp
  }
}
```

### UI Workflow Patterns

**Collection Switching**:
1. User selects different collection from dropdown
2. If current collection has unsaved changes → Show confirmation dialog
3. If confirmed or no changes → Switch to new collection
4. Update textarea with new collection's usernames
5. Update statistics and metadata display
6. Clear unsaved changes indicator

**Creating New Collection**:
1. User clicks "New Collection" button
2. Show modal dialog with name input field
3. Validate name (non-empty, not duplicate)
4. Create collection via API: `WL.collections.create(name)`
5. Switch to new collection automatically
6. Update collection selector and statistics

**Deleting Collection**:
1. User clicks delete button (disabled for default collection)
2. Show confirmation dialog with collection details
3. If confirmed → Delete via API: `WL.collections.delete(id)`
4. If deleted collection was active → Switch to default collection
5. Update collection selector and UI state

**Renaming Collection**:
1. User clicks rename button (disabled for default collection)
2. Show modal dialog with current name pre-filled
3. Validate new name (non-empty, not duplicate)
4. Update collection name via storage manager
5. Refresh collection selector and displays

### Collection-Aware Features

**Import/Export Context**:
- Import options: "Add to current collection" vs "Create new collection"
- Export options: "Current collection only" vs "All collections"
- Format preservation with collection metadata

**Search Functionality**:
- Search within current collection only
- Global search across all collections (with collection indicator)
- Filter results by collection in multi-collection scenarios

**Statistics Display**:
- Per-collection statistics (entry count, last modified)
- Cross-collection aggregated statistics
- Collection-specific filtering analytics

## User Experience Design

### Interaction Patterns

**Panel Access**:
- Keyboard shortcut to toggle panel (Ctrl+Shift+W)
- Right-click context menu option (future enhancement)
- Persistent but unobtrusive presence

**Whitelist Editing**:
- Simple textarea with one username per line
- Auto-trim whitespace and normalize case
- Duplicate detection with visual feedback
- Undo/redo support for editing operations

**Quick Actions**:
- One-click enable/disable filtering
- Quick mode switching without saving
- Instant temporary override toggle
- Fast collection switching (if multiple collections)

### Visual Feedback

**Status Indicators**:
- Color-coded filtering status (green=active, red=disabled, yellow=temp override)
- Badge showing filtered message count
- Visual confirmation for save operations
- Loading indicators for async operations

**Error Handling**:
- Validation messages for invalid usernames
- Network error indicators
- Storage failure notifications
- Graceful degradation messages

## Implementation Strategy

### Phase 1: Basic Panel Structure
1. Create UIManager class skeleton with collection awareness
2. Implement basic panel creation and DOM injection
3. Add show/hide functionality with basic styling
4. Test panel positioning and Discord integration

### Phase 2: Core Functionality
1. Implement collection selector and switching logic
2. Add whitelist editor with collection-specific textarea
3. Implement save/load functionality with collection context
4. Create filter control toggles
5. Integrate with existing collection management system

### Phase 3: Collection Management Features
1. Implement collection creation modal and workflow
2. Add collection deletion with confirmation and safeguards
3. Implement collection renaming functionality
4. Add unsaved changes detection and confirmation dialogs
5. Create collection-aware import/export interfaces

### Phase 4: Enhanced Features
1. Add drag and drop positioning
2. Implement minimize/maximize functionality
3. Add collection-specific statistics display
4. Create visual status indicators with collection context
5. Implement search functionality within collections

### Phase 5: Polish and Integration
1. Refine styling and animations
2. Add keyboard shortcut support
3. Implement auto-save with debouncing and collection awareness
4. Add comprehensive error handling for collection operations
5. Create collection management help documentation

## Testing Requirements

### Functional Testing
- Panel creation and destruction
- Collection selector functionality and switching
- Collection creation, deletion, and renaming workflows
- Whitelist editing and persistence within collections
- Filter toggle functionality across collections
- Position saving and restoration
- Multi-session state persistence with collection context
- Unsaved changes detection and confirmation dialogs

### Integration Testing
- Discord layout compatibility
- Theme switching adaptation
- Navigation state maintenance
- Performance impact assessment
- Memory leak prevention

### User Experience Testing
- Panel positioning across screen sizes
- Drag and drop smoothness
- Keyboard navigation accessibility
- Visual feedback clarity
- Error recovery scenarios

## Success Criteria

**Core Functionality**:
- ✅ Panel successfully injects into Discord interface
- ✅ Whitelist editing works with real-time synchronization
- ✅ Filter controls immediately affect message visibility
- ✅ Panel state persists across Discord page reloads
- ✅ No interference with Discord's core functionality

**User Experience**:
- ✅ Panel is easily accessible but non-intrusive
- ✅ Editing interface is intuitive and responsive
- ✅ Visual feedback provides clear status information
- ✅ Performance impact is negligible during normal Discord usage
- ✅ Error states are handled gracefully with user guidance

**Technical Quality**:
- ✅ CSS isolation prevents style conflicts
- ✅ Event handling doesn't leak memory
- ✅ Panel gracefully handles Discord DOM changes
- ✅ Code is maintainable and well-documented
- ✅ Comprehensive test coverage for UI components

## Future Enhancements

**Advanced UI Features**:
- Collection management interface
- Import/export wizard with preview
- Advanced search and filtering options
- User analytics dashboard
- Customizable keyboard shortcuts

**Integration Improvements**:
- Context menu integration
- Discord slash command support
- Notification system integration
- Mobile responsiveness
- Accessibility compliance (WCAG 2.1)