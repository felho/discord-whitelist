# Context Menu Integration Specification

## Overview

Add right-click context menu functionality to Discord messages, allowing users to quickly add or remove users from the whitelist without opening the control panel.

## Feature Requirements

### Core Functionality

1. **Context Menu Trigger**

   - Right-click on any Discord message to open context menu
   - Right-click on username elements specifically
   - Right-click on message content area
   - Support for both collapsed and visible messages

2. **Menu Options**

   **For Non-Whitelisted Users:**

   - ✅ "Add to Whitelist" - Add user to active collection
   - 📊 "View User Info" - Show message count, first seen, etc.

   **For Whitelisted Users:**

   - ❌ "Remove from Whitelist" - Remove from active collection
   - 📊 "View User Info" - Show stats and metadata

   **General Options:**

   - 🔄 "Switch Collection" - Quick collection switcher submenu
   - ⚙️ "Whitelist Settings" - Open main control panel

3. **Visual Design**
   - Match Discord's native context menu styling
   - Dark theme with subtle hover effects
   - Icons for each menu option
   - Separator lines between option groups
   - Position near cursor without going off-screen

### Technical Architecture

#### New Components

**ContextMenuManager Class**

```javascript
class ContextMenuManager {
  constructor(whitelistManager, uiManager) {
    this.whitelistManager = whitelistManager;
    this.uiManager = uiManager;
    this.activeMenu = null;
    this.targetUsername = null;
    this.targetElement = null;
  }

  // Core methods
  initialize() {} // Set up event listeners
  handleContextMenu(e) {} // Process right-click events
  extractUsername(element) {} // Get username from clicked element
  createMenu(options) {} // Build menu DOM
  showMenu(x, y) {} // Position and display menu
  hideMenu() {} // Remove menu from DOM

  // Action handlers
  addToWhitelist() {} // Add user to active collection
  removeFromWhitelist() {} // Remove user from collection
  showUserInfo() {} // Display user statistics
  editNotes() {} // Open notes editor
  switchCollection(id) {} // Change active collection
}
```

#### Integration Points

1. **With WhitelistManager**

   - Check if user is whitelisted: `whitelistManager.isWhitelisted(username)`
   - Add user: `whitelistManager.add(username, { source: 'context-menu' })`
   - Remove user: `whitelistManager.remove(username)`
   - Get user info: `whitelistManager.getUserInfo(username)`

2. **With UIManager**

   - Update UI after changes: `uiManager.refresh()`
   - Open control panel: `uiManager.show()`
   - Show notifications: `uiManager.showNotification(message)`

3. **With FilterEngine**
   - Refresh filtered messages after changes
   - Update message visibility immediately

### Implementation Details

#### Event Handling

```javascript
// Prevent default Discord context menu
document.addEventListener(
  "contextmenu",
  (e) => {
    if (this.isMessageElement(e.target)) {
      e.preventDefault();
      e.stopPropagation();
      this.handleContextMenu(e);
    }
  },
  true
); // Use capture phase to intercept before Discord

// Close menu on outside click
document.addEventListener("click", (e) => {
  if (!this.menuElement?.contains(e.target)) {
    this.hideMenu();
  }
});

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && this.activeMenu) {
    this.hideMenu();
  }
});
```

#### Username Detection

```javascript
extractUsername(element) {
  // Try multiple strategies to find username

  // 1. Check if clicked directly on username element
  const usernameEl = element.closest('[class*="username"]');
  if (usernameEl) {
    return usernameEl.textContent.trim();
  }

  // 2. Find username within parent message container
  const messageEl = element.closest('li[id^="chat-messages-"]');
  if (messageEl) {
    // Look for username in message header
    const headerUsername = messageEl.querySelector('[class*="username"]');
    if (headerUsername) {
      return headerUsername.textContent.trim();
    }

    // Check for grouped message (inherit from previous)
    return this.findUsernameFromPreviousMessage(messageEl);
  }

  // 3. Check for reply or mention
  const mention = element.closest('[class*="mention"]');
  if (mention) {
    return mention.textContent.replace('@', '').trim();
  }

  return null;
}
```

#### Menu Positioning

```javascript
showMenu(x, y) {
  const menu = this.activeMenu;
  const menuRect = menu.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Adjust position to keep menu in viewport
  let posX = x;
  let posY = y;

  // Flip horizontally if too close to right edge
  if (x + menuRect.width > viewportWidth - 10) {
    posX = x - menuRect.width;
  }

  // Flip vertically if too close to bottom
  if (y + menuRect.height > viewportHeight - 10) {
    posY = y - menuRect.height;
  }

  // Ensure minimum distance from edges
  posX = Math.max(10, Math.min(posX, viewportWidth - menuRect.width - 10));
  posY = Math.max(10, Math.min(posY, viewportHeight - menuRect.height - 10));

  menu.style.left = `${posX}px`;
  menu.style.top = `${posY}px`;
  menu.style.display = 'block';
}
```

### User Experience

#### Visual Feedback

1. **Hover Effects**

   - Highlight menu items on hover
   - Show tooltips for additional information
   - Cursor changes to pointer

2. **Action Feedback**

   - Brief notification when user added/removed
   - Visual confirmation animation
   - Update message visibility immediately

3. **Error Handling**
   - Show error if username can't be detected
   - Handle collection limits gracefully
   - Provide helpful error messages

#### Accessibility

1. **Keyboard Navigation**

   - Arrow keys to navigate menu items
   - Enter to select
   - Escape to close
   - Tab order support

2. **Screen Reader Support**
   - ARIA labels for menu items
   - Role attributes for menu structure
   - Announce actions to screen readers

### CSS Styling

```css
.wl-context-menu {
  position: fixed;
  z-index: 10000;
  background: #2b2d31;
  border: 1px solid #1e1f22;
  border-radius: 4px;
  padding: 6px 8px;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.24);
  min-width: 188px;
  max-width: 320px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Helvetica Neue", Arial, sans-serif;
  font-size: 14px;
  color: #dbdee1;
  user-select: none;
}

.wl-context-menu-item {
  display: flex;
  align-items: center;
  padding: 6px 8px;
  margin: 2px 0;
  border-radius: 2px;
  cursor: pointer;
  transition: background-color 0.1s ease;
}

.wl-context-menu-item:hover {
  background-color: #4752c4;
  color: #ffffff;
}

.wl-context-menu-item-icon {
  width: 18px;
  height: 18px;
  margin-right: 8px;
  flex-shrink: 0;
}

.wl-context-menu-separator {
  height: 1px;
  background-color: #3f4147;
  margin: 4px 8px;
}

.wl-context-menu-submenu {
  position: relative;
}

.wl-context-menu-submenu-arrow {
  position: absolute;
  right: 8px;
  opacity: 0.6;
}

.wl-context-menu-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.wl-context-menu-disabled:hover {
  background-color: transparent;
  color: #dbdee1;
}
```

### Testing Requirements

1. **Functional Tests**

   - Right-click on various message elements
   - Verify username extraction accuracy
   - Test add/remove functionality
   - Verify immediate filtering updates
   - Test collection switching
   - Test with grouped messages

2. **Integration Tests**

   - Verify WhitelistManager integration
   - Confirm UIManager updates
   - Test FilterEngine refresh
   - Check storage persistence

3. **User Experience Tests**

   - Menu positioning near edges
   - Keyboard navigation
   - Visual feedback timing
   - Error message clarity
   - Performance with rapid clicks

4. **Edge Cases**
   - System messages without usernames
   - Bot messages
   - Webhook messages
   - Deleted messages
   - Edited messages
   - Reply chains
   - Mentions and references

### Performance Considerations

1. **Event Delegation**

   - Use single contextmenu listener
   - Delegate to specific elements
   - Avoid memory leaks

2. **DOM Operations**

   - Reuse menu element
   - Minimize reflows
   - Batch DOM updates

3. **Memory Management**
   - Clean up event listeners
   - Clear references on hide
   - Limit stored state

### Security Considerations

1. **Input Validation**

   - Sanitize extracted usernames
   - Validate collection IDs
   - Prevent injection attacks

2. **Event Security**
   - Prevent event bubbling issues
   - Handle untrusted events
   - Validate event sources

### Future Enhancements

1. **Bulk Operations**

   - Multi-select messages
   - Batch add/remove
   - Select all from user

2. **Advanced Options**

   - Temporary whitelist
   - Time-based whitelisting
   - Regex pattern matching

3. **Integration Features**
   - Export selected users
   - Copy username
   - Open user profile

## Implementation Timeline

### Phase 1: Core Context Menu (2-3 hours)

- Basic menu creation and positioning
- Username extraction logic
- Event handling setup

### Phase 2: Menu Actions (2-3 hours)

- Add/remove functionality
- User info display
- Collection switching

### Phase 3: Polish & UX (1-2 hours)

- CSS styling to match Discord
- Animations and transitions
- Keyboard navigation

### Phase 4: Testing & Edge Cases (1-2 hours)

- Comprehensive testing
- Edge case handling
- Performance optimization

## Success Metrics

1. **Functionality**

   - ✅ Right-click opens custom menu
   - ✅ Accurate username detection > 95%
   - ✅ Instant whitelist updates
   - ✅ No interference with Discord

2. **Performance**

   - Menu opens < 50ms
   - No memory leaks
   - Smooth animations 60fps

3. **User Experience**
   - Intuitive menu options
   - Clear visual feedback
   - Consistent with Discord UX
   - Accessible via keyboard

## Dependencies

- Existing WhitelistManager class
- Existing UIManager class
- Existing FilterEngine class
- No external libraries required

## Risks & Mitigation

1. **Discord Updates**

   - Risk: Discord DOM structure changes
   - Mitigation: Multiple fallback strategies for username detection

2. **Event Conflicts**

   - Risk: Interfering with Discord's context menu
   - Mitigation: Careful event handling with stopPropagation

3. **Performance Impact**
   - Risk: Slowing down Discord interface
   - Mitigation: Optimized event delegation and DOM operations

## Version & Compatibility

- Target Version: v0.5.0
- Minimum Discord Web: Current stable
- Browser Support: Chrome, Firefox, Edge (latest versions)
- Tampermonkey: v4.0+
