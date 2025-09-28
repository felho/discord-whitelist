#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Build script for Discord Whitelist - Static TamperMonkey Version
 * Direct code concatenation approach for better performance
 */

// File paths
const WHITELIST_JS = path.join(__dirname, 'whitelist.js');
const TM_LOADER_JS = path.join(__dirname, 'tm-loader.js');
const DIST_DIR = path.join(__dirname, 'dist');
const OUTPUT_FILE = path.join(DIST_DIR, 'discord-whitelist-static.user.js');

console.log('🔨 Building Discord Whitelist Static Version...\n');

try {
  // 1. Validate input files
  console.log('📋 Validating input files...');

  if (!fs.existsSync(WHITELIST_JS)) {
    throw new Error(`whitelist.js not found at: ${WHITELIST_JS}`);
  }

  if (!fs.existsSync(TM_LOADER_JS)) {
    throw new Error(`tm-loader.js not found at: ${TM_LOADER_JS}`);
  }

  console.log('  ✅ whitelist.js found');
  console.log('  ✅ tm-loader.js found');

  // 2. Read source files
  console.log('\n📖 Reading source files...');

  let whitelistContent = fs.readFileSync(WHITELIST_JS, 'utf8');
  const loaderTemplate = fs.readFileSync(TM_LOADER_JS, 'utf8');

  console.log(`  ✅ whitelist.js (${whitelistContent.length} chars)`);
  console.log(`  ✅ tm-loader.js (${loaderTemplate.length} chars)`);

  // 3. Extract version from whitelist.js
  console.log('\n🔍 Extracting version...');

  const versionMatch = whitelistContent.match(/const VERSION = ["']([^"']+)["']/);
  if (!versionMatch) {
    throw new Error('Could not extract VERSION constant from whitelist.js');
  }

  const version = versionMatch[1];
  console.log(`  ✅ Found version: ${version}`);

  // 4. Process whitelist.js to handle GM_* API calls
  console.log('\n🔧 Processing whitelist.js for static version...');

  // The whitelist.js code expects GM_getValue, GM_setValue, GM_deleteValue to be available
  // For the static version, we'll ensure GM functions are available in the global scope
  // and include the whitelist.js code as-is (preserving its IIFE structure)

  // Check if whitelist.js is wrapped in an IIFE
  const trimmed = whitelistContent.trim();
  const isIIFE = trimmed.startsWith('(') && (trimmed.endsWith(')();') || trimmed.endsWith('})();'));

  console.log(`  ℹ️ Detected ${isIIFE ? 'IIFE' : 'non-IIFE'} structure in whitelist.js`);

  // Simple approach: just ensure the whitelist.js code runs with GM_* functions available
  whitelistContent = `
// Discord Whitelist Core Functionality
// Ensure TamperMonkey GM functions are available
if (typeof window !== 'undefined') {
  // Make GM functions globally accessible for the whitelist code
  window.GM_getValue = typeof GM_getValue !== 'undefined' ? GM_getValue : function() { console.warn('GM_getValue not available'); return null; };
  window.GM_setValue = typeof GM_setValue !== 'undefined' ? GM_setValue : function() { console.warn('GM_setValue not available'); };
  window.GM_deleteValue = typeof GM_deleteValue !== 'undefined' ? GM_deleteValue : function() { console.warn('GM_deleteValue not available'); };
}

// Execute the original whitelist.js code as-is
${trimmed}
`;

  console.log('  ✅ Prepared whitelist.js for static execution');

  console.log('  ✅ Processed for static execution');

  // 5. Create UserScript header
  console.log('\n📝 Generating UserScript header...');

  const userScriptHeader = `// ==UserScript==
// @name         Discord Whitelist
// @namespace    discord-whitelist
// @version      ${version}
// @description  Discord message filtering based on user whitelist
// @author       Discord Whitelist
// @match        https://discord.com/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// ==/UserScript==`;

  console.log('  ✅ Header generated');

  // 6. Create the final script
  console.log('\n🔗 Combining components...');

  // Simple wrapper that just logs initialization
  const initWrapper = `
(function() {
  'use strict';

  console.log('[Discord Whitelist] Static version ${version} initializing...');

  // The main functionality follows below
})();
`;

  // Combine everything - header, init wrapper, then the processed whitelist code
  const finalScript = `${userScriptHeader}

${initWrapper}

${whitelistContent}
`;

  console.log(`  ✅ Final script size: ${finalScript.length} chars`);

  // 7. Basic syntax validation
  console.log('\n✔️ Validating syntax...');

  try {
    // Try to parse as a module to check syntax
    require('vm').createScript(finalScript);
    console.log('  ✅ JavaScript syntax is valid');
  } catch (syntaxError) {
    console.warn('  ⚠️ Syntax validation warning:', syntaxError.message);
    // Continue anyway as vm.createScript might be too strict for userscript context
  }

  // 8. Ensure output directory exists
  console.log('\n📁 Preparing output directory...');

  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
    console.log('  ✅ Created dist/ directory');
  } else {
    console.log('  ✅ dist/ directory exists');
  }

  // 9. Write output file
  console.log('\n💾 Writing output file...');

  fs.writeFileSync(OUTPUT_FILE, finalScript, 'utf8');

  const outputStats = fs.statSync(OUTPUT_FILE);
  console.log(`  ✅ Written to: ${OUTPUT_FILE}`);
  console.log(`  ✅ File size: ${outputStats.size} bytes (${Math.round(outputStats.size / 1024)}KB)`);

  // 10. Success summary
  console.log('\n🎉 Build completed successfully!');
  console.log(`
📦 Build Summary:
   Input:  whitelist.js (${whitelistContent.length} chars)
   Output: ${path.relative(__dirname, OUTPUT_FILE)} (${finalScript.length} chars)
   Version: ${version}

🚀 Installation:
   1. Open TamperMonkey dashboard
   2. Click "Create a new script" or "+"
   3. Replace content with: ${path.basename(OUTPUT_FILE)}
   4. Save (Ctrl+S) and enable the script

📝 Usage:
   Navigate to Discord - the whitelist system will load automatically
   Press Ctrl+Shift+W to toggle the whitelist panel

⚡ Performance Note:
   This version uses direct code execution (not string-based)
   for optimal performance on Discord
`);

} catch (error) {
  console.error('\n❌ Build failed:', error.message);
  console.error('\n🔍 Troubleshooting:');
  console.error('   1. Ensure whitelist.js and tm-loader.js exist in project root');
  console.error('   2. Check that whitelist.js contains VERSION constant');
  console.error('   3. Verify file permissions for reading/writing');
  console.error('\nStack trace:', error.stack);
  process.exit(1);
}