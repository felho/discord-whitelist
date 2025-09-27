// Console test for Whitelist Management System
// Run this in browser console after loading whitelist.js

console.log('=== Whitelist Management System Test ===');

// Test basic functionality
console.log('1. Version:', window.WL.version);
console.log('2. Storage type:', window.WL.system.storageType);

// Test legacy API compatibility
console.log('3. Initial state:', window.WL.getState());

// Test adding users
console.log('4. Adding users...');
window.WL.addToWhitelist('testuser1').then(result => {
    console.log('   testuser1 added:', result);
});
window.WL.addToWhitelist('TestUser2').then(result => {
    console.log('   TestUser2 added:', result);
});

// Test whitelist checking
setTimeout(() => {
    console.log('5. Checking whitelist:');
    console.log('   testuser1 whitelisted:', window.WL.whitelist.isWhitelisted('testuser1'));
    console.log('   testuser2 whitelisted (case insensitive):', window.WL.whitelist.isWhitelisted('testuser2'));
    console.log('   unknownuser whitelisted:', window.WL.whitelist.isWhitelisted('unknownuser'));

    // Test stats
    console.log('6. Statistics:', window.WL.whitelist.getStats());

    // Test collections
    console.log('7. Creating test collection...');
    const collectionId = window.WL.collections.create('Test Collection');
    console.log('   Created collection:', collectionId);
    console.log('   All collections:', window.WL.collections.getAll().map(c => c.name));

    // Test search
    console.log('8. Search results for "test":', window.WL.search.users('test'));

    // Test export
    console.log('9. Export sample (first 100 chars):', window.WL.data.export('txt').substring(0, 100));

    // Test events
    console.log('10. Testing event system...');
    window.WL.events.on('whitelist:user_added', (data) => {
        console.log('    Event fired for user:', data.username);
    });

    window.WL.whitelist.add('eventtest').then(() => {
        console.log('    Event test user added');
    });

    // Final state
    setTimeout(() => {
        console.log('11. Final state:', window.WL.getState());
        console.log('=== Test Complete ===');
    }, 200);

}, 100);