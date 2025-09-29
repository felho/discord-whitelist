// Debug script for context menu troubleshooting
// Paste this into Discord's console to debug context menu issues

console.log('🔧 Context Menu Debug Tool v1.0');

// Check if WL is available
if (typeof window.WL === 'undefined') {
  console.error('❌ WL object not found - userscript not loaded');
} else {
  console.log('✅ WL object found, version:', window.WL.version);

  // Check context menu manager
  if (window.WL.contextMenu) {
    console.log('✅ Context menu API available');

    if (window.WL.contextMenu.manager) {
      const manager = window.WL.contextMenu.manager;
      console.log('✅ Context menu manager found');
      console.log('📊 Manager state:', {
        initialized: manager.initialized,
        activeMenu: !!manager.activeMenu,
        targetUsername: manager.targetUsername
      });

      // Test message detection
      const testMessageDetection = () => {
        console.log('🧪 Testing message detection...');
        const messages = document.querySelectorAll('li[id^="chat-messages-"]');
        console.log(`📨 Found ${messages.length} Discord messages`);

        if (messages.length > 0) {
          const firstMessage = messages[0];
          console.log('🔍 Testing first message:', firstMessage.id);
          console.log('🔍 isMessageElement result:', manager.isMessageElement(firstMessage));

          // Try to extract username
          const username = manager.extractUsername(firstMessage);
          console.log('👤 Extracted username:', username);
        } else {
          console.warn('⚠️ No Discord messages found. Make sure you\'re in a channel with messages.');
        }
      };

      testMessageDetection();

      // Add manual test function
      window.testContextMenu = (x = 200, y = 200) => {
        console.log('🧪 Manual context menu test at:', x, y);
        const testEvent = new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y
        });

        const messages = document.querySelectorAll('li[id^="chat-messages-"]');
        if (messages.length > 0) {
          messages[0].dispatchEvent(testEvent);
        } else {
          console.warn('⚠️ No messages to test with');
        }
      };

      console.log('💡 Use testContextMenu(x, y) to manually trigger context menu');

    } else {
      console.error('❌ Context menu manager not found');
    }
  } else {
    console.error('❌ Context menu API not available');
  }
}

// Add global right-click listener for debugging
let debugListener = (e) => {
  console.log('🖱️ Right-click detected on:', e.target.tagName, e.target.className);
  const messageEl = e.target.closest('li[id^="chat-messages-"]');
  if (messageEl) {
    console.log('📨 Right-click on message:', messageEl.id);

    // Check if context menu manager would handle this
    if (window.WL && window.WL.contextMenu && window.WL.contextMenu.manager) {
      const manager = window.WL.contextMenu.manager;
      console.log('🔍 isMessageElement check:', manager.isMessageElement(e.target));

      const username = manager.extractUsername(e.target);
      console.log('👤 Would extract username:', username);
    }
  } else {
    console.log('❌ Not a Discord message');
  }
};

document.addEventListener('contextmenu', debugListener, true);

console.log('🎯 Debug listener added. Right-click on Discord messages to see debug info.');
console.log('🚮 Run removeDebugListener() to clean up when done.');

window.removeDebugListener = () => {
  document.removeEventListener('contextmenu', debugListener, true);
  console.log('🚮 Debug listener removed');
};