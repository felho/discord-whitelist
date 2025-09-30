# Toggle Switch Feature Specification

## Overview

Add individual toggle switches to hidden messages that allow users to control the visibility of specific filtered messages without affecting the global filter state or other messages.

## Feature Description

When a message is filtered (collapsed or hidden), display a small toggle switch in the top-right corner of the message container that allows the user to temporarily show or hide that specific message independently of the whitelist status.

## Requirements

### Visual Design

- **Switch Position**: Top-right corner of the hidden/collapsed message container
- **Switch Style**: Small, Discord-themed toggle switch (similar to Discord's existing UI elements)
- **Default State**: OFF (message remains hidden as per whitelist filter)
- **Visual States**:
  - OFF: Message follows whitelist filter (hidden/collapsed)
  - ON: Message is temporarily visible regardless of whitelist status

### Behavior

- **Independence**: Toggle state is independent of whitelist membership
- **Persistence**: Toggle state persists during the current session but resets on page reload
- **Per-Message**: Each filtered message has its own independent toggle
- **Real-time**: Toggling immediately shows/hides the message content
- **Visual Feedback**: Clear indication of toggle state (on/off)

### Technical Implementation

#### Toggle Switch Component
```javascript
class MessageToggleSwitch {
  constructor(messageElement, messageId) {
    this.messageElement = messageElement;
    this.messageId = messageId;
    this.isVisible = false; // Default OFF
    this.switchElement = null;
  }

  create() {
    // Create toggle switch element
    // Add Discord-themed styling
    // Attach click event handler
  }

  toggle() {
    // Toggle visibility state
    // Update message display
    // Store state in session storage
  }

  updateDisplay() {
    // Show/hide message content based on toggle state
    // Update switch visual state
  }
}
```

#### Integration Points

1. **FilterEngine Integration**:
   - When filtering messages, create toggle switches for hidden messages
   - Toggle switches should not appear on visible (whitelisted) messages
   - Toggle switches override filter decisions when activated

2. **Message Observer Integration**:
   - Detect new messages and add toggles to filtered ones
   - Handle message updates and maintain toggle state
   - Clean up toggle state for removed messages

3. **Storage Management**:
   - Session-based storage for toggle states (not persistent across reloads)
   - Key format: `message_toggle_${messageId}`
   - Automatic cleanup of old toggle states

#### CSS Styling

```css
.wl-message-toggle {
  position: absolute;
  top: 8px;
  right: 12px;
  width: 32px;
  height: 18px;
  background: var(--background-secondary);
  border-radius: 12px;
  border: 2px solid var(--background-tertiary);
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 10;
}

.wl-message-toggle.active {
  background: var(--brand-experiment);
  border-color: var(--brand-experiment);
}

.wl-message-toggle::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 10px;
  height: 10px;
  background: white;
  border-radius: 50%;
  transition: transform 0.2s ease;
}

.wl-message-toggle.active::after {
  transform: translateX(14px);
}
```

### User Experience

#### Workflow
1. User has whitelist filtering enabled
2. Non-whitelisted messages are hidden/collapsed
3. Hidden messages display a toggle switch in the top-right corner
4. User can click toggle to temporarily show the specific message
5. Toggle state is remembered for the session
6. Page reload resets all toggles to OFF

#### Visual Feedback
- Clear visual distinction between ON and OFF states
- Smooth transition animations
- Consistent with Discord's design language
- Hover effects for better usability

### Implementation Plan

#### Phase 1: Core Toggle Component
- Create `MessageToggleSwitch` class
- Implement basic show/hide functionality
- Add session storage for toggle states

#### Phase 2: FilterEngine Integration
- Modify `FilterEngine` to create toggles for filtered messages
- Update filtering logic to respect toggle overrides
- Handle toggle cleanup for removed messages

#### Phase 3: Styling and UX
- Implement Discord-themed CSS styling
- Add transition animations
- Ensure responsive design
- Test with various message types

#### Phase 4: Testing and Optimization
- Test with different message layouts (replies, grouped messages, etc.)
- Performance optimization for large numbers of messages
- Edge case handling (message updates, DOM changes)

### API Extensions

#### FilterEngine Extensions
```javascript
// New methods for toggle management
createToggleForMessage(messageElement, messageId)
removeToggleForMessage(messageId)
getToggleState(messageId)
setToggleState(messageId, isVisible)
clearAllToggles()
```

#### Developer API Extensions
```javascript
// Add to window.WL.filter namespace
window.WL.filter.toggles = {
  get: (messageId) => {...},
  set: (messageId, state) => {...},
  clear: () => {...},
  getAll: () => {...}
};
```

### Technical Considerations

#### Performance
- Toggles only created for filtered messages (not all messages)
- Session storage used (lighter than persistent storage)
- Efficient DOM manipulation with minimal reflows
- Cleanup of unused toggle states

#### Compatibility
- Works with existing filtering modes (collapse, hard hide)
- Compatible with all message types (regular, replies, grouped)
- No interference with existing whitelist functionality
- Graceful degradation if toggle functionality fails

#### Accessibility
- Keyboard navigation support (Tab, Enter, Space)
- Screen reader compatibility with proper ARIA labels
- High contrast support
- Focus indicators

### Success Criteria

1. **Functionality**: Toggle switches successfully show/hide individual messages
2. **Visual Integration**: Toggles blend seamlessly with Discord's UI
3. **Performance**: No noticeable performance impact with 100+ messages
4. **Reliability**: Toggles work consistently across all message types
5. **User Experience**: Intuitive and responsive toggle interaction

### Future Enhancements

- **Persistent Toggles**: Option to remember toggle states across page reloads
- **Bulk Toggle Actions**: Select multiple messages and toggle visibility
- **Toggle Categories**: Different toggle types for different filtering reasons
- **Toggle Analytics**: Track usage patterns for UX improvements