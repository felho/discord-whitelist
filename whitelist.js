(() => {
  "use strict";

  const VERSION = "v0.2.0 (Whitelist Management System)";

  // --- Storage adapter (prefers page localStorage, falls back to TM storage) ---
  const Storage = (() => {
    // Page localStorage first
    try {
      if (window && window.localStorage) {
        const testKey = "__wl_test__";
        window.localStorage.setItem(testKey, "ok");
        window.localStorage.removeItem(testKey);
        return {
          type: "localStorage",
          get: (k, fallback = null) => {
            const s = window.localStorage.getItem(k);
            return s == null ? fallback : JSON.parse(s);
          },
          set: (k, v) => window.localStorage.setItem(k, JSON.stringify(v)),
          remove: (k) => window.localStorage.removeItem(k),
        };
      }
    } catch (_) {
      /* fall through to TM storage */
    }

    // Tampermonkey value storage
    try {
      // @ts-ignore
      if (
        typeof GM_getValue === "function" &&
        typeof GM_setValue === "function"
      ) {
        return {
          type: "tampermonkey",
          // @ts-ignore
          get: (k, fallback = null) => GM_getValue(k, fallback),
          // @ts-ignore
          set: (k, v) => GM_setValue(k, v),
          // @ts-ignore
          remove: (k) =>
            typeof GM_deleteValue === "function"
              ? GM_deleteValue(k)
              : GM_setValue(k, undefined),
        };
      }
    } catch (_) {
      /* ignore */
    }

    // Last resort in-memory (non-persistent)
    const mem = new Map();
    return {
      type: "memory",
      get: (k, fallback = null) => (mem.has(k) ? mem.get(k) : fallback),
      set: (k, v) => mem.set(k, v),
      remove: (k) => mem.delete(k),
    };
  })();

  // --- Storage keys & defaults ---
  const STORAGE_KEY = "tm_discord_whitelist_filter_v1";
  const COLLECTIONS_KEY = "tm_discord_whitelist_collections_v1";
  const CONFIG_KEY = "tm_discord_whitelist_config_v1";

  const DEFAULTS = {
    whitelist: [],
    enabled: true,
    hardHide: false,
    showAllTemp: false,
  };

  const DEFAULT_CONFIG = {
    activeCollection: "default",
    collections: [],
    globalSettings: {
      caseSensitive: false,
      maxEntries: 1000,
      enableAnalytics: true,
      enabled: true,
      hardHide: false,
      showAllTemp: false,
    },
    storagePreferences: {
      autoBackup: true,
      syncFrequency: 5000,
    },
  };

  // --- Helpers: logging ---
  const DEBUG = true;
  function log(...args) {
    if (DEBUG) console.log("[WL]", ...args);
  }

  // --- Event System ---
  class EventEmitter {
    constructor() {
      this.events = new Map();
    }

    on(event, handler) {
      if (!this.events.has(event)) {
        this.events.set(event, new Set());
      }
      this.events.get(event).add(handler);
      return () => this.off(event, handler);
    }

    off(event, handler) {
      if (this.events.has(event)) {
        this.events.get(event).delete(handler);
      }
    }

    emit(event, data = {}) {
      if (this.events.has(event)) {
        this.events.get(event).forEach(handler => {
          try {
            handler(data);
          } catch (e) {
            console.error(`[WL] Event handler error for ${event}:`, e);
          }
        });
      }
    }
  }

  const eventBus = new EventEmitter();

  // --- Utility Functions ---
  function generateId() {
    return Math.random().toString(36).substring(2, 11);
  }

  function validateUsername(username) {
    if (typeof username !== 'string') return false;
    const trimmed = username.trim();
    return trimmed.length > 0 && trimmed.length <= 32;
  }

  function normalizeUsername(username) {
    return String(username).trim();
  }

  // --- Data Models ---
  class WhitelistEntry {
    constructor(username, options = {}) {
      this.username = normalizeUsername(username);
      this.dateAdded = options.dateAdded || new Date();
      this.lastSeen = options.lastSeen || null;
      this.source = options.source || 'manual';
      this.notes = options.notes || '';
    }

    toJSON() {
      return {
        username: this.username,
        dateAdded: this.dateAdded,
        lastSeen: this.lastSeen,
        source: this.source,
        notes: this.notes,
      };
    }

    static fromJSON(data) {
      return new WhitelistEntry(data.username, {
        dateAdded: new Date(data.dateAdded),
        lastSeen: data.lastSeen ? new Date(data.lastSeen) : null,
        source: data.source,
        notes: data.notes,
      });
    }
  }

  class WhitelistCollection {
    constructor(name, options = {}) {
      this.id = options.id || generateId();
      this.name = name;
      this.entries = new Map();
      this.settings = options.settings || {};
      this.metadata = {
        created: options.created || new Date(),
        modified: options.modified || new Date(),
        ...options.metadata,
      };
    }

    addEntry(username, options = {}) {
      if (!validateUsername(username)) {
        throw new Error('Invalid username format');
      }

      const normalizedName = normalizeUsername(username);
      const key = normalizedName.toLowerCase();

      if (this.entries.has(key)) {
        return false; // Already exists
      }

      const entry = new WhitelistEntry(normalizedName, options);
      this.entries.set(key, entry);
      this.metadata.modified = new Date();
      return true;
    }

    removeEntry(username) {
      const key = normalizeUsername(username).toLowerCase();
      const removed = this.entries.delete(key);
      if (removed) {
        this.metadata.modified = new Date();
      }
      return removed;
    }

    hasEntry(username) {
      const key = normalizeUsername(username).toLowerCase();
      return this.entries.has(key);
    }

    getEntry(username) {
      const key = normalizeUsername(username).toLowerCase();
      return this.entries.get(key) || null;
    }

    getEntries() {
      return Array.from(this.entries.values());
    }

    clear() {
      this.entries.clear();
      this.metadata.modified = new Date();
    }

    getSize() {
      return this.entries.size;
    }

    toJSON() {
      return {
        id: this.id,
        name: this.name,
        entries: Array.from(this.entries.values()).map(e => e.toJSON()),
        settings: this.settings,
        metadata: this.metadata,
      };
    }

    static fromJSON(data) {
      const collection = new WhitelistCollection(data.name, {
        id: data.id,
        settings: data.settings,
        created: new Date(data.metadata.created),
        modified: new Date(data.metadata.modified),
        metadata: data.metadata,
      });

      // Load entries
      if (data.entries) {
        data.entries.forEach(entryData => {
          const entry = WhitelistEntry.fromJSON(entryData);
          collection.entries.set(entry.username.toLowerCase(), entry);
        });
      }

      return collection;
    }
  }

  // --- Storage Layer ---
  class StorageManager {
    constructor() {
      this.config = this.loadConfig();
      this.collections = new Map();
      this.loadCollections();

      // Migrate legacy data if needed
      this.migrateLegacyData();
    }

    loadConfig() {
      try {
        const stored = Storage.get(CONFIG_KEY, null);
        return stored ? { ...DEFAULT_CONFIG, ...stored } : { ...DEFAULT_CONFIG };
      } catch (e) {
        log("Config load error, using defaults:", e);
        return { ...DEFAULT_CONFIG };
      }
    }

    saveConfig() {
      try {
        Storage.set(CONFIG_KEY, this.config);
        return true;
      } catch (e) {
        console.error("[WL] Config save failed:", e);
        return false;
      }
    }

    loadCollections() {
      try {
        const stored = Storage.get(COLLECTIONS_KEY, []);
        stored.forEach(collectionData => {
          const collection = WhitelistCollection.fromJSON(collectionData);
          this.collections.set(collection.id, collection);
        });

        // Ensure default collection exists
        if (!this.collections.has('default')) {
          const defaultCollection = new WhitelistCollection('Default', { id: 'default' });
          this.collections.set('default', defaultCollection);
        }

        // Ensure active collection exists
        if (!this.collections.has(this.config.activeCollection)) {
          this.config.activeCollection = 'default';
        }
      } catch (e) {
        log("Collections load error:", e);
        // Create default collection
        const defaultCollection = new WhitelistCollection('Default', { id: 'default' });
        this.collections.set('default', defaultCollection);
        this.config.activeCollection = 'default';
      }
    }

    saveCollections() {
      try {
        const collectionsArray = Array.from(this.collections.values()).map(c => c.toJSON());
        Storage.set(COLLECTIONS_KEY, collectionsArray);
        return true;
      } catch (e) {
        console.error("[WL] Collections save failed:", e);
        return false;
      }
    }

    migrateLegacyData() {
      try {
        const legacyData = Storage.get(STORAGE_KEY, null);
        if (legacyData && legacyData.whitelist && legacyData.whitelist.length > 0) {
          log("Migrating legacy data...");
          const defaultCollection = this.collections.get('default');

          legacyData.whitelist.forEach(username => {
            try {
              defaultCollection.addEntry(username, { source: 'legacy' });
            } catch (e) {
              log("Failed to migrate username:", username, e);
            }
          });

          // Preserve other legacy settings
          if (typeof legacyData.enabled === 'boolean') {
            this.config.globalSettings.enabled = legacyData.enabled;
          }
          if (typeof legacyData.hardHide === 'boolean') {
            this.config.globalSettings.hardHide = legacyData.hardHide;
          }
          if (typeof legacyData.showAllTemp === 'boolean') {
            this.config.globalSettings.showAllTemp = legacyData.showAllTemp;
          }

          this.saveCollections();
          this.saveConfig();
          log(`Migrated ${legacyData.whitelist.length} entries from legacy format`);
        }
      } catch (e) {
        log("Migration error:", e);
      }
    }

    getActiveCollection() {
      return this.collections.get(this.config.activeCollection);
    }

    getAllCollections() {
      return Array.from(this.collections.values());
    }

    getCollection(id) {
      return this.collections.get(id);
    }

    createCollection(name, options = {}) {
      const id = options.id || generateId();
      if (this.collections.has(id)) {
        throw new Error(`Collection with ID ${id} already exists`);
      }

      const collection = new WhitelistCollection(name, { ...options, id });
      this.collections.set(id, collection);
      this.saveCollections();

      eventBus.emit('collection:created', { collection: collection.toJSON() });
      return id;
    }

    deleteCollection(id) {
      if (id === 'default') {
        throw new Error('Cannot delete default collection');
      }
      if (!this.collections.has(id)) {
        return false;
      }

      this.collections.delete(id);

      // If deleting active collection, switch to default
      if (this.config.activeCollection === id) {
        this.config.activeCollection = 'default';
        this.saveConfig();
      }

      this.saveCollections();
      eventBus.emit('collection:deleted', { id });
      return true;
    }

    switchActiveCollection(id) {
      if (!this.collections.has(id)) {
        throw new Error(`Collection ${id} does not exist`);
      }

      const oldId = this.config.activeCollection;
      this.config.activeCollection = id;
      this.saveConfig();

      eventBus.emit('collection:switched', { from: oldId, to: id });
      return true;
    }
  }

  // --- Whitelist Manager ---
  class WhitelistManager {
    constructor(storageManager) {
      this.storage = storageManager;
      this.userLookup = new Map(); // Fast O(1) lookup cache
      this.rebuildLookupCache();
    }

    rebuildLookupCache() {
      this.userLookup.clear();
      const activeCollection = this.storage.getActiveCollection();
      if (activeCollection) {
        activeCollection.getEntries().forEach(entry => {
          this.userLookup.set(entry.username.toLowerCase(), entry);
        });
      }
    }

    async addUser(username, options = {}) {
      try {
        if (!validateUsername(username)) {
          throw new Error('Invalid username format');
        }

        const activeCollection = this.storage.getActiveCollection();
        const added = activeCollection.addEntry(username, options);

        if (added) {
          const entry = activeCollection.getEntry(username);
          this.userLookup.set(entry.username.toLowerCase(), entry);
          this.storage.saveCollections();

          eventBus.emit('whitelist:user_added', {
            username: entry.username,
            collection: activeCollection.id,
            entry: entry.toJSON()
          });

          log(`Added to whitelist: "${entry.username}"`);
          return true;
        } else {
          log(`Already in whitelist: "${username}"`);
          return false;
        }
      } catch (e) {
        console.error("[WL] Add user failed:", e);
        throw e;
      }
    }

    async removeUser(username) {
      try {
        const activeCollection = this.storage.getActiveCollection();
        const normalizedName = normalizeUsername(username);
        const key = normalizedName.toLowerCase();

        const removed = activeCollection.removeEntry(normalizedName);

        if (removed) {
          this.userLookup.delete(key);
          this.storage.saveCollections();

          eventBus.emit('whitelist:user_removed', {
            username: normalizedName,
            collection: activeCollection.id
          });

          log(`Removed from whitelist: "${normalizedName}"`);
          return true;
        }

        return false;
      } catch (e) {
        console.error("[WL] Remove user failed:", e);
        throw e;
      }
    }

    isWhitelisted(username) {
      const key = normalizeUsername(username).toLowerCase();
      return this.userLookup.has(key);
    }

    getWhitelist() {
      const activeCollection = this.storage.getActiveCollection();
      return activeCollection ? activeCollection.getEntries().map(e => e.toJSON()) : [];
    }

    async bulkUpdate(operations) {
      const results = [];
      const errors = [];

      try {
        for (const op of operations) {
          try {
            let result = false;
            if (op.action === 'add') {
              result = await this.addUser(op.username, op.options);
            } else if (op.action === 'remove') {
              result = await this.removeUser(op.username);
            }
            results.push({ ...op, success: result });
          } catch (e) {
            errors.push({ ...op, error: e.message });
          }
        }

        eventBus.emit('whitelist:bulk_update', { results, errors });
        return { results, errors };
      } catch (e) {
        console.error("[WL] Bulk update failed:", e);
        throw e;
      }
    }

    clearWhitelist() {
      const activeCollection = this.storage.getActiveCollection();
      if (activeCollection) {
        activeCollection.clear();
        this.userLookup.clear();
        this.storage.saveCollections();

        eventBus.emit('whitelist:cleared', { collection: activeCollection.id });
        log("Whitelist cleared");
      }
    }

    getStats() {
      const activeCollection = this.storage.getActiveCollection();
      if (!activeCollection) return { total: 0, recent: 0 };

      const entries = activeCollection.getEntries();
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      return {
        total: entries.length,
        recent: entries.filter(e => e.dateAdded > dayAgo).length,
        sources: entries.reduce((acc, e) => {
          acc[e.source] = (acc[e.source] || 0) + 1;
          return acc;
        }, {}),
      };
    }
  }

  // --- Search Manager ---
  class SearchManager {
    constructor(whitelistManager) {
      this.whitelist = whitelistManager;
    }

    searchUsers(query, options = {}) {
      const entries = this.whitelist.getWhitelist();
      const normalizedQuery = query.toLowerCase();

      const matches = entries.filter(entry => {
        if (options.exactMatch) {
          return entry.username.toLowerCase() === normalizedQuery;
        }

        return entry.username.toLowerCase().includes(normalizedQuery) ||
               (entry.notes && entry.notes.toLowerCase().includes(normalizedQuery));
      });

      // Sort by relevance (exact matches first, then by username length)
      matches.sort((a, b) => {
        const aExact = a.username.toLowerCase() === normalizedQuery;
        const bExact = b.username.toLowerCase() === normalizedQuery;

        if (aExact && !bExact) return -1;
        if (bExact && !aExact) return 1;

        return a.username.length - b.username.length;
      });

      return matches.slice(0, options.limit || 50);
    }
  }

  // --- Data Manager (Import/Export) ---
  class DataManager {
    constructor(storageManager) {
      this.storage = storageManager;
    }

    exportWhitelist(format = 'json') {
      const activeCollection = this.storage.getActiveCollection();
      if (!activeCollection) {
        throw new Error('No active collection to export');
      }

      const entries = activeCollection.getEntries();

      switch (format.toLowerCase()) {
        case 'json':
          return JSON.stringify({
            version: VERSION,
            collection: activeCollection.toJSON(),
            exportDate: new Date(),
          }, null, 2);

        case 'csv':
          const headers = 'username,dateAdded,source,notes\n';
          const rows = entries.map(e =>
            `"${e.username}","${e.dateAdded.toISOString()}","${e.source}","${e.notes}"`
          ).join('\n');
          return headers + rows;

        case 'txt':
          return entries.map(e => e.username).join('\n');

        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    }

    async importWhitelist(data, format = 'json') {
      const results = { imported: 0, skipped: 0, errors: [] };

      try {
        let entries = [];

        switch (format.toLowerCase()) {
          case 'json':
            const parsed = JSON.parse(data);
            if (parsed.collection && parsed.collection.entries) {
              entries = parsed.collection.entries.map(e => ({
                username: e.username,
                options: { source: 'import', notes: e.notes }
              }));
            }
            break;

          case 'csv':
            const lines = data.split('\n').slice(1); // Skip header
            entries = lines.filter(line => line.trim()).map(line => {
              const [username, , , notes] = line.split(',').map(s => s.replace(/"/g, ''));
              return { username, options: { source: 'import', notes: notes || '' } };
            });
            break;

          case 'txt':
            entries = data.split('\n')
              .map(line => line.trim())
              .filter(line => line)
              .map(username => ({ username, options: { source: 'import' } }));
            break;

          default:
            throw new Error(`Unsupported import format: ${format}`);
        }

        // Import entries
        const activeCollection = this.storage.getActiveCollection();
        for (const { username, options } of entries) {
          try {
            if (activeCollection.addEntry(username, options)) {
              results.imported++;
            } else {
              results.skipped++;
            }
          } catch (e) {
            results.errors.push({ username, error: e.message });
          }
        }

        this.storage.saveCollections();
        eventBus.emit('whitelist:imported', results);

        return results;
      } catch (e) {
        console.error("[WL] Import failed:", e);
        throw e;
      }
    }
  }

  // --- Message Filtering Engine ---

  // Discord DOM selectors for message detection
  const MESSAGE_SELECTORS = {
    messageContainer: 'li[id^="chat-messages-"], li.message',
    messageList: '[data-list-id^="chat-messages"]',
    authorElement: '[class*="username"]',
    messageContent: '[id^="message-content-"]',
    replyAuthor: '[class*="repliedTextPreview"] [class*="username"]',
    systemMessage: '[class*="systemMessage"]'
  };

  // CSS classes for filtering modes
  const FILTER_CLASSES = {
    hidden: 'wl-hidden',
    collapsed: 'wl-collapsed',
    placeholder: 'wl-placeholder',
    indicator: 'wl-filtered-indicator'
  };

  // Inject CSS styles for filtering
  function injectFilterStyles() {
    const styleId = 'whitelist-filter-styles';
    if (document.getElementById(styleId)) return; // Already injected

    const styles = `
      .${FILTER_CLASSES.hidden} {
        display: none !important;
      }

      .${FILTER_CLASSES.collapsed} {
        opacity: 0.3;
        background: rgba(114, 137, 218, 0.1);
        border-left: 3px solid #7289da;
        margin: 2px 0;
        transition: all 0.2s ease;
      }

      .${FILTER_CLASSES.collapsed}:hover {
        opacity: 1;
        background: rgba(114, 137, 218, 0.2);
      }

      .${FILTER_CLASSES.placeholder} {
        padding: 8px 16px;
        font-size: 12px;
        color: #72767d;
        font-style: italic;
        cursor: pointer;
        user-select: none;
      }

      .${FILTER_CLASSES.indicator} {
        position: relative;
      }

      .${FILTER_CLASSES.indicator}::before {
        content: "●";
        position: absolute;
        left: -10px;
        top: 50%;
        transform: translateY(-50%);
        color: #7289da;
        font-size: 8px;
      }
    `;

    const styleElement = document.createElement('style');
    styleElement.id = styleId;
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
    log("Filter styles injected");
  }

  // MessageObserver class for detecting Discord messages
  class MessageObserver {
    constructor(filterEngine) {
      this.filterEngine = filterEngine;
      this.observer = null;
      this.debounceTimer = null;
      this.isObserving = false;
      this.pendingMutations = [];
      this.debounceMs = 50;
    }

    start() {
      if (this.isObserving) return;

      try {
        const targetNode = document.querySelector('#app-mount') || document.body;

        this.observer = new MutationObserver((mutations) => {
          this.handleMutations(mutations);
        });

        this.observer.observe(targetNode, {
          childList: true,
          subtree: true,
          attributes: false
        });

        this.isObserving = true;
        log("MessageObserver started");

        // Process existing messages
        this.processExistingMessages();
      } catch (e) {
        console.error("[WL] Failed to start MessageObserver:", e);
      }
    }

    stop() {
      if (!this.isObserving) return;

      try {
        if (this.observer) {
          this.observer.disconnect();
          this.observer = null;
        }

        if (this.debounceTimer) {
          clearTimeout(this.debounceTimer);
          this.debounceTimer = null;
        }

        this.isObserving = false;
        this.pendingMutations = [];
        log("MessageObserver stopped");
      } catch (e) {
        console.error("[WL] Failed to stop MessageObserver:", e);
      }
    }

    handleMutations(mutations) {
      // Add to pending mutations
      this.pendingMutations.push(...mutations);

      // Debounce processing
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      this.debounceTimer = setTimeout(() => {
        this.processPendingMutations();
      }, this.debounceMs);
    }

    processPendingMutations() {
      const mutations = [...this.pendingMutations];
      this.pendingMutations = [];

      const messagesToProcess = new Set();

      try {
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Direct message container
              if (this.isMessageContainer(node)) {
                messagesToProcess.add(node);
              }

              // Search for message containers within added nodes
              const messageContainers = node.querySelectorAll?.(MESSAGE_SELECTORS.messageContainer);
              if (messageContainers) {
                messageContainers.forEach(container => messagesToProcess.add(container));
              }
            }
          });
        });

        // Process unique messages in batch
        if (messagesToProcess.size > 0) {
          this.filterEngine.processMessages(Array.from(messagesToProcess));
        }
      } catch (e) {
        console.error("[WL] Error processing mutations:", e);
      }
    }

    processExistingMessages() {
      try {
        const existingMessages = document.querySelectorAll(MESSAGE_SELECTORS.messageContainer);
        log(`processExistingMessages: Found ${existingMessages.length} messages with selector "${MESSAGE_SELECTORS.messageContainer}"`);

        // Debug: try alternative selectors
        const altMessages = document.querySelectorAll('li.message');
        log(`processExistingMessages: Found ${altMessages.length} messages with selector "li.message"`);

        if (existingMessages.length > 0) {
          log(`Processing ${existingMessages.length} existing messages`);
          this.filterEngine.processMessages(Array.from(existingMessages));
        } else if (altMessages.length > 0) {
          log(`Using alternative selector - processing ${altMessages.length} existing messages`);
          this.filterEngine.processMessages(Array.from(altMessages));
        }
      } catch (e) {
        console.error("[WL] Error processing existing messages:", e);
      }
    }

    isMessageContainer(element) {
      return element.matches && (
        element.matches('li[id^="chat-messages-"]') ||
        element.matches('li.message')
      );
    }
  }

  // FilterEngine class for applying whitelist-based filtering
  class FilterEngine {
    constructor(whitelistManager, storageManager) {
      this.whitelist = whitelistManager;
      this.storage = storageManager;
      this.observer = new MessageObserver(this);
      this.isInitialized = false;
      this.messageCache = new Map(); // Cache filtering results
      this.stats = {
        processed: 0,
        filtered: 0,
        whitelisted: 0
      };
    }

    initialize() {
      if (this.isInitialized) return;

      try {
        // Inject CSS styles
        injectFilterStyles();

        // Listen for whitelist changes
        eventBus.on('whitelist:user_added', () => this.refreshAllMessages());
        eventBus.on('whitelist:user_removed', () => this.refreshAllMessages());
        eventBus.on('whitelist:cleared', () => this.refreshAllMessages());
        eventBus.on('collection:switched', () => this.refreshAllMessages());

        // Start observing
        this.observer.start();

        this.isInitialized = true;
        log("FilterEngine initialized");
      } catch (e) {
        console.error("[WL] Failed to initialize FilterEngine:", e);
      }
    }

    shutdown() {
      if (!this.isInitialized) return;

      try {
        this.observer.stop();
        this.clearAllFiltering();
        this.messageCache.clear();
        this.isInitialized = false;
        log("FilterEngine shutdown");
      } catch (e) {
        console.error("[WL] Error shutting down FilterEngine:", e);
      }
    }

    processMessages(messageElements) {
      if (!this.isEnabled()) return;

      try {
        const config = this.storage.config.globalSettings;
        const batchSize = 20; // Process in smaller batches for performance

        for (let i = 0; i < messageElements.length; i += batchSize) {
          const batch = messageElements.slice(i, i + batchSize);
          batch.forEach(messageElement => {
            this.filterMessage(messageElement);
          });

          // Yield control to prevent blocking
          if (i + batchSize < messageElements.length) {
            setTimeout(() => {}, 0);
          }
        }

        this.stats.processed += messageElements.length;
        log(`Processed ${messageElements.length} messages (${this.stats.processed} total)`);
      } catch (e) {
        console.error("[WL] Error processing message batch:", e);
      }
    }

    filterMessage(messageElement) {
      if (!messageElement || !this.isEnabled()) {
        log(`filterMessage: Skipped - element: ${!!messageElement}, enabled: ${this.isEnabled()}`);
        return;
      }

      try {
        const messageId = messageElement.id;
        log(`filterMessage: Processing message ${messageId}`);

        // Check cache first
        if (this.messageCache.has(messageId)) {
          const cached = this.messageCache.get(messageId);
          log(`filterMessage: Using cached result for ${messageId} - username: ${cached.username}, whitelisted: ${cached.isWhitelisted}`);
          this.applyDisplayMode(messageElement, cached.isWhitelisted, cached.username);
          return;
        }

        // Extract username
        const username = this.extractUsername(messageElement);
        log(`filterMessage: Extracted username: "${username}" from message ${messageId}`);

        if (!username) {
          // Keep non-user messages visible (system messages, etc.)
          log(`filterMessage: No username found, keeping message ${messageId} visible`);
          this.removeFilterClasses(messageElement);
          return;
        }

        // Check whitelist
        const isWhitelisted = this.whitelist.isWhitelisted(username);
        log(`filterMessage: Username "${username}" is ${isWhitelisted ? 'WHITELISTED' : 'NOT WHITELISTED'}`);

        // Cache result
        this.messageCache.set(messageId, { isWhitelisted, username });

        // Apply filtering
        log(`filterMessage: Applying display mode for ${username} (whitelisted: ${isWhitelisted})`);
        this.applyDisplayMode(messageElement, isWhitelisted, username);

        // Update stats
        if (isWhitelisted) {
          this.stats.whitelisted++;
        } else {
          this.stats.filtered++;
        }

      } catch (e) {
        console.error("[WL] Error filtering message:", e);
        // On error, keep message visible
        this.removeFilterClasses(messageElement);
      }
    }

    extractUsername(messageElement) {
      try {
        // Try multiple selectors for different Discord message types
        const selectors = [
          MESSAGE_SELECTORS.authorElement,
          MESSAGE_SELECTORS.replyAuthor,
          '[class*="headerText"] [class*="username"]',
          '[class*="header"] [class*="username"]'
        ];

        for (const selector of selectors) {
          const authorElement = messageElement.querySelector(selector);
          if (authorElement && authorElement.textContent) {
            const username = authorElement.textContent.trim();
            if (username && username.length > 0) {
              return username;
            }
          }
        }

        // Fallback: look for any username-like text
        const usernameElements = messageElement.querySelectorAll('[class*="username"]');
        for (const element of usernameElements) {
          const text = element.textContent?.trim();
          if (text && text.length > 0 && text.length <= 32) {
            return text;
          }
        }

        return null;
      } catch (e) {
        console.error("[WL] Error extracting username:", e);
        return null;
      }
    }

    applyDisplayMode(messageElement, isWhitelisted, username) {
      const config = this.storage.config.globalSettings;

      // Remove all filter classes first
      this.removeFilterClasses(messageElement);

      // If showing all temporarily or globally disabled, don't filter
      if (config.showAllTemp || !config.enabled) {
        return;
      }

      // If whitelisted, just add indicator
      if (isWhitelisted) {
        messageElement.classList.add(FILTER_CLASSES.indicator);
        return;
      }

      // Apply filtering based on mode
      if (config.hardHide) {
        // Hard hide mode: completely remove from DOM
        messageElement.classList.add(FILTER_CLASSES.hidden);
      } else {
        // Normal mode: collapse with placeholder
        this.applyCollapseMode(messageElement, username);
      }

      // Also apply filtering to all child elements to handle complex Discord structure
      this.applyFilteringToChildren(messageElement, isWhitelisted);
    }

    applyCollapseMode(messageElement, username) {
      messageElement.classList.add(FILTER_CLASSES.collapsed);

      // Add click handler to expand/collapse
      const handleClick = (e) => {
        e.stopPropagation();
        if (messageElement.classList.contains(FILTER_CLASSES.collapsed)) {
          messageElement.classList.remove(FILTER_CLASSES.collapsed);
          messageElement.style.opacity = '1';
        } else {
          messageElement.classList.add(FILTER_CLASSES.collapsed);
          messageElement.style.opacity = '0.3';
        }
      };

      // Remove existing click handlers
      messageElement.removeEventListener('click', handleClick);
      messageElement.addEventListener('click', handleClick);

      // Add placeholder text if message is very short
      const messageHeight = messageElement.offsetHeight;
      if (messageHeight < 50) {
        this.addPlaceholderText(messageElement, username);
      }
    }

    addPlaceholderText(messageElement, username) {
      // Check if placeholder already exists
      if (messageElement.querySelector(`.${FILTER_CLASSES.placeholder}`)) {
        return;
      }

      const placeholder = document.createElement('div');
      placeholder.className = FILTER_CLASSES.placeholder;
      placeholder.textContent = `Message from ${username} (click to expand)`;

      // Insert placeholder at the beginning
      const firstChild = messageElement.firstElementChild;
      if (firstChild) {
        messageElement.insertBefore(placeholder, firstChild);
      } else {
        messageElement.appendChild(placeholder);
      }
    }

    applyFilteringToChildren(messageElement, isWhitelisted) {
      if (isWhitelisted) return;

      try {
        log(`applyFilteringToChildren: Processing message ${messageElement.id}`);
        const totalTextBefore = messageElement.textContent.length;

        // NUCLEAR OPTION: Apply filtering to EVERY element with text content
        // This brute force approach should catch everything Discord throws at us

        const allElements = messageElement.querySelectorAll('*');
        log(`Found ${allElements.length} total elements in message`);

        // Apply to all elements that contain text content
        allElements.forEach(element => {
          if (element.textContent && element.textContent.trim().length > 0) {
            // Skip already processed elements
            if (!element.classList.contains('wl-filtered-child')) {
              element.classList.add('wl-filtered-child');
              this.applyFilterStyle(element);
            }
          }
        });

        // Also find ALL text nodes and filter their immediate parents
        const walker = document.createTreeWalker(
          messageElement,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: function(node) {
              return node.textContent.trim().length > 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            }
          }
        );

        const textNodes = [];
        let node;
        while (node = walker.nextNode()) {
          textNodes.push(node);
        }

        log(`Found ${textNodes.length} text nodes in message`);

        // Apply filtering to immediate parent of every text node
        textNodes.forEach((textNode, index) => {
          const parent = textNode.parentElement;
          if (parent && parent !== messageElement) {
            if (!parent.classList.contains('wl-filtered-child')) {
              parent.classList.add('wl-filtered-child');
              this.applyFilterStyle(parent);
              log(`Filtered text node ${index}: "${textNode.textContent.trim().substring(0, 30)}..."`);
            }
          }
        });

        // Schedule multiple re-checks to catch any dynamically added content
        setTimeout(() => {
          this.recheckMessage(messageElement);
        }, 100);

        // Additional recheck after 250ms for stubborn messages
        setTimeout(() => {
          this.recheckMessage(messageElement);
        }, 250);

        log(`applyFilteringToChildren: Completed message ${messageElement.id}, processed ${allElements.length} elements and ${textNodes.length} text nodes`);

      } catch (e) {
        console.error("[WL] Error applying filtering to children:", e);
      }
    }

    recheckMessage(messageElement) {
      try {
        // Double-check for any remaining visible text content
        const visibleElements = [];
        const walker = document.createTreeWalker(
          messageElement,
          NodeFilter.SHOW_ALL,
          {
            acceptNode: function(node) {
              if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0) {
                const parent = node.parentElement;
                const computedStyle = parent ? window.getComputedStyle(parent) : null;

                // Check if this text is actually visible (not hidden by our filtering)
                if (computedStyle &&
                    computedStyle.opacity !== '0.2' &&
                    computedStyle.display !== 'none' &&
                    !parent.classList.contains('wl-filtered-child')) {
                  return NodeFilter.FILTER_ACCEPT;
                }
              }
              return NodeFilter.FILTER_REJECT;
            }
          }
        );

        let node;
        while (node = walker.nextNode()) {
          visibleElements.push({
            text: node.textContent.trim().substring(0, 50),
            parent: node.parentElement ? {
              tag: node.parentElement.tagName,
              className: node.parentElement.className,
              id: node.parentElement.id
            } : null
          });

          // Apply emergency filtering to any remaining visible text
          if (node.parentElement) {
            log(`EMERGENCY FILTER: Applying to remaining visible text: "${node.textContent.trim().substring(0, 30)}..."`);
            node.parentElement.classList.add('wl-filtered-child');
            this.applyFilterStyle(node.parentElement);
          }
        }

        if (visibleElements.length > 0) {
          log(`RECHECK: Message ${messageElement.id} still has ${visibleElements.length} visible text elements:`, visibleElements);
        }

      } catch (e) {
        console.error("[WL] Error in recheckMessage:", e);
      }
    }

    applyFilterStyle(element) {
      if (!element) return;

      try {
        if (this.storage.config.globalSettings.hardHide) {
          element.style.display = 'none';
        } else {
          element.style.opacity = '0.2';
          element.style.filter = 'blur(2px)';
          element.style.pointerEvents = 'none';
          element.style.userSelect = 'none';
        }
      } catch (e) {
        console.error("[WL] Error applying filter style:", e);
      }
    }

    removeFilterClasses(messageElement) {
      Object.values(FILTER_CLASSES).forEach(className => {
        messageElement.classList.remove(className);
      });

      // Remove placeholder text
      const placeholder = messageElement.querySelector(`.${FILTER_CLASSES.placeholder}`);
      if (placeholder) {
        placeholder.remove();
      }

      // Reset inline styles on main element
      messageElement.style.opacity = '';

      // Reset inline styles on child elements
      try {
        const allChildren = messageElement.querySelectorAll('*');
        allChildren.forEach(element => {
          element.style.opacity = '';
          element.style.display = '';
          element.style.filter = '';
          element.style.pointerEvents = '';
          element.style.userSelect = '';
          element.classList.remove('wl-filtered-child');
        });
      } catch (e) {
        console.error("[WL] Error removing filter styles from children:", e);
      }
    }

    refreshAllMessages() {
      try {
        // Clear cache
        this.messageCache.clear();

        // Re-process all visible messages
        const allMessages = document.querySelectorAll(MESSAGE_SELECTORS.messageContainer);
        log(`Found ${allMessages.length} messages with selector "${MESSAGE_SELECTORS.messageContainer}"`);

        // Debug: try alternative selectors
        const altMessages = document.querySelectorAll('li.message');
        log(`Found ${altMessages.length} messages with selector "li.message"`);

        const anyLi = document.querySelectorAll('li');
        log(`Found ${anyLi.length} total li elements`);

        if (allMessages.length > 0) {
          log(`Refreshing ${allMessages.length} messages after whitelist change`);
          this.processMessages(Array.from(allMessages));
        } else if (altMessages.length > 0) {
          log(`Using alternative selector - processing ${altMessages.length} messages`);
          this.processMessages(Array.from(altMessages));
        }
      } catch (e) {
        console.error("[WL] Error refreshing messages:", e);
      }
    }

    clearAllFiltering() {
      try {
        const allMessages = document.querySelectorAll(MESSAGE_SELECTORS.messageContainer);
        allMessages.forEach(message => {
          this.removeFilterClasses(message);
        });
        log("Cleared all message filtering");
      } catch (e) {
        console.error("[WL] Error clearing filtering:", e);
      }
    }

    isEnabled() {
      return this.storage.config.globalSettings.enabled;
    }

    getStats() {
      return { ...this.stats };
    }

    resetStats() {
      this.stats = {
        processed: 0,
        filtered: 0,
        whitelisted: 0
      };
    }
  }

  // --- Initialize System ---
  const storageManager = new StorageManager();
  const whitelistManager = new WhitelistManager(storageManager);
  const searchManager = new SearchManager(whitelistManager);
  const dataManager = new DataManager(storageManager);
  const filterEngine = new FilterEngine(whitelistManager, storageManager);

  // Handle collection switches
  eventBus.on('collection:switched', () => {
    whitelistManager.rebuildLookupCache();
  });

  // Initialize filtering when DOM is ready
  function initializeFiltering() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => filterEngine.initialize(), 1000);
      });
    } else {
      // DOM is already ready
      setTimeout(() => filterEngine.initialize(), 1000);
    }
  }

  // Start filtering initialization
  initializeFiltering();

  // --- Legacy State Management for Backward Compatibility ---
  function getLegacyState() {
    const activeCollection = storageManager.getActiveCollection();
    const config = storageManager.config.globalSettings;

    return {
      whitelist: activeCollection ? activeCollection.getEntries().map(e => e.username) : [],
      enabled: config.enabled !== undefined ? config.enabled : DEFAULTS.enabled,
      hardHide: config.hardHide !== undefined ? config.hardHide : DEFAULTS.hardHide,
      showAllTemp: config.showAllTemp !== undefined ? config.showAllTemp : DEFAULTS.showAllTemp,
    };
  }

  function setLegacyState(partial = {}) {
    if (partial && typeof partial === "object") {
      const config = storageManager.config.globalSettings;

      // Handle whitelist changes
      if (Array.isArray(partial.whitelist)) {
        const activeCollection = storageManager.getActiveCollection();
        if (activeCollection) {
          activeCollection.clear();
          partial.whitelist.forEach(username => {
            try {
              activeCollection.addEntry(username, { source: 'legacy_api' });
            } catch (e) {
              log("Failed to add username via legacy API:", username, e);
            }
          });
          storageManager.saveCollections();
          whitelistManager.rebuildLookupCache();
        }
      }

      // Handle other settings
      if (typeof partial.enabled === "boolean") {
        config.enabled = partial.enabled;
      }
      if (typeof partial.hardHide === "boolean") {
        config.hardHide = partial.hardHide;
      }
      if (typeof partial.showAllTemp === "boolean") {
        config.showAllTemp = partial.showAllTemp;
      }

      storageManager.saveConfig();
      log("Legacy state updated via window.WL API");
    }
    return getLegacyState();
  }

  function resetLegacyState() {
    try {
      // Clear active collection
      const activeCollection = storageManager.getActiveCollection();
      if (activeCollection) {
        activeCollection.clear();
      }

      // Reset config to defaults
      storageManager.config.globalSettings = { ...DEFAULT_CONFIG.globalSettings };
      storageManager.saveConfig();
      storageManager.saveCollections();
      whitelistManager.rebuildLookupCache();

      log("Legacy state reset to defaults");
    } catch (e) {
      console.error("[WL] resetLegacyState failed", e);
    }
  }

  // --- Enhanced Public API (exposed on window for dev/testing) ---
  const API = {
    version: VERSION,

    // Legacy API for backward compatibility
    getState: getLegacyState,
    setState: setLegacyState,
    resetState: resetLegacyState,

    addToWhitelist: async (name) => {
      try {
        return await whitelistManager.addUser(name, { source: 'legacy_api' });
      } catch (e) {
        console.error("[WL] Legacy addToWhitelist failed:", e);
        return false;
      }
    },

    removeFromWhitelist: async (name) => {
      try {
        return await whitelistManager.removeUser(name);
      } catch (e) {
        console.error("[WL] Legacy removeFromWhitelist failed:", e);
        return false;
      }
    },

    clearWhitelist: () => {
      whitelistManager.clearWhitelist();
    },

    // New Advanced API
    whitelist: {
      manager: whitelistManager,
      add: (username, options) => whitelistManager.addUser(username, options),
      remove: (username) => whitelistManager.removeUser(username),
      isWhitelisted: (username) => whitelistManager.isWhitelisted(username),
      getAll: () => whitelistManager.getWhitelist(),
      clear: () => whitelistManager.clearWhitelist(),
      bulkUpdate: (operations) => whitelistManager.bulkUpdate(operations),
      getStats: () => whitelistManager.getStats(),
    },

    collections: {
      manager: storageManager,
      getActive: () => storageManager.getActiveCollection()?.toJSON(),
      getAll: () => storageManager.getAllCollections().map(c => c.toJSON()),
      create: (name, options) => storageManager.createCollection(name, options),
      delete: (id) => storageManager.deleteCollection(id),
      switch: (id) => storageManager.switchActiveCollection(id),
      get: (id) => storageManager.getCollection(id)?.toJSON(),
    },

    search: {
      manager: searchManager,
      users: (query, options) => searchManager.searchUsers(query, options),
    },

    data: {
      manager: dataManager,
      export: (format) => dataManager.exportWhitelist(format),
      import: (data, format) => dataManager.importWhitelist(data, format),
    },

    events: {
      on: (event, handler) => eventBus.on(event, handler),
      off: (event, handler) => eventBus.off(event, handler),
      emit: (event, data) => eventBus.emit(event, data),
    },

    // System information
    system: {
      version: VERSION,
      storageType: Storage.type,
      getConfig: () => ({ ...storageManager.config }),
      setConfig: (partial) => {
        Object.assign(storageManager.config, partial);
        storageManager.saveConfig();
      },
    },

    // Message Filtering
    filter: {
      engine: filterEngine,
      initialize: () => filterEngine.initialize(),
      shutdown: () => filterEngine.shutdown(),
      refresh: () => filterEngine.refreshAllMessages(),
      clear: () => filterEngine.clearAllFiltering(),
      getStats: () => filterEngine.getStats(),
      resetStats: () => filterEngine.resetStats(),
      isEnabled: () => filterEngine.isEnabled(),
    },

    // Developer utilities
    dev: {
      rebuildCache: () => whitelistManager.rebuildLookupCache(),
      migrateData: () => storageManager.migrateLegacyData(),
      clearAllData: () => {
        Storage.remove(STORAGE_KEY);
        Storage.remove(COLLECTIONS_KEY);
        Storage.remove(CONFIG_KEY);
        location.reload();
      },
      exportDebugInfo: () => ({
        version: VERSION,
        storageType: Storage.type,
        config: storageManager.config,
        collections: storageManager.getAllCollections().map(c => c.toJSON()),
        stats: whitelistManager.getStats(),
        filterStats: filterEngine.getStats(),
        timestamp: new Date(),
      }),
    },
  };

  // Expose globally for dev/testing in console
  window.WL = API;

  // System startup logging
  log("Storage backend:", Storage.type);
  if (Storage.type === "memory") {
    console.warn(
      "[WL] WARNING: Using non-persistent in-memory storage. State will be lost on reload. Add GM grants to the loader or enable page localStorage."
    );
  }

  const activeCollection = storageManager.getActiveCollection();
  log("Loaded", VERSION);
  log("Active collection:", activeCollection?.name, `(${activeCollection?.getSize()} entries)`);
  log("Legacy state:", getLegacyState());
  log("Collections available:", storageManager.getAllCollections().length);

  // Expose internal system for advanced debugging
  if (DEBUG) {
    window.WL_INTERNAL = {
      storageManager,
      whitelistManager,
      searchManager,
      dataManager,
      filterEngine,
      eventBus,
      Storage,
    };
  }
})();
