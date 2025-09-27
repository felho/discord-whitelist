(() => {
  "use strict";

  const VERSION = "v0.4.0 (User Interface Implementation)";

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

        const messagesToProcess = allMessages.length > 0 ? Array.from(allMessages) : Array.from(altMessages);

        if (messagesToProcess.length > 0) {
          // If filtering is disabled, clear all filter classes instead of processing
          if (!this.isEnabled()) {
            log(`Filtering disabled - clearing all filter classes from ${messagesToProcess.length} messages`);
            messagesToProcess.forEach(messageElement => {
              this.removeFilterClasses(messageElement);
            });
          } else {
            log(`Refreshing ${messagesToProcess.length} messages after whitelist change`);
            this.processMessages(messagesToProcess);
          }
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

  // --- UI Manager for Discord Integration ---
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
      this.isDragging = false;
      this.dragOffset = { x: 0, y: 0 };

      // Initialize UI
      this.initialize();
    }

    initialize() {
      this.activeCollectionId = this.storageManager.config.activeCollection;

      // Load saved position
      if (this.storageManager.config.uiPosition) {
        this.position = this.storageManager.config.uiPosition;
      }

      this.createPanel();
      this.bindEvents();
      this.applyStyles();

      // Listen for collection changes
      eventBus.on('collection:switched', (data) => {
        this.activeCollectionId = data.newId;
        this.updateCollectionSelector();
        this.updateWhitelistDisplay();
        this.updateStats();
        this.clearUnsavedChanges();
      });

      eventBus.on('collection:created', () => {
        this.updateCollectionSelector();
      });

      eventBus.on('collection:deleted', () => {
        this.updateCollectionSelector();
      });
    }

    createPanel() {
      if (this.panel) return;

      this.panel = document.createElement('div');
      this.panel.className = 'wl-panel-container';
      this.panel.innerHTML = `
        <div class="wl-panel-header">
          <div class="wl-panel-title">
            <span class="wl-panel-icon">📝</span>
            <span>Whitelist Control</span>
          </div>
          <div class="wl-panel-header-controls">
            <select class="wl-collection-selector" title="Select Collection">
              <!-- Populated dynamically -->
            </select>
            <button class="wl-panel-minimize" title="Minimize">−</button>
            <button class="wl-panel-close" title="Hide Panel">×</button>
          </div>
        </div>

        <div class="wl-panel-content">
          <!-- Collection Management Section -->
          <div class="wl-panel-section wl-collection-section">
            <div class="wl-section-header">
              <h3>Collection Management</h3>
              <button class="wl-section-toggle" data-target="collection-controls">▼</button>
            </div>
            <div class="wl-section-content" id="collection-controls">
              <div class="wl-collection-info">
                <span class="wl-collection-name"></span>
                <span class="wl-collection-meta"></span>
              </div>
              <div class="wl-collection-actions">
                <button class="wl-btn wl-btn-small wl-new-collection">New Collection</button>
                <button class="wl-btn wl-btn-small wl-rename-collection">Rename</button>
                <button class="wl-btn wl-btn-small wl-delete-collection">Delete</button>
              </div>
            </div>
          </div>

          <!-- Whitelist Editor Section -->
          <div class="wl-panel-section">
            <div class="wl-section-header">
              <h3>Whitelist Editor</h3>
              <span class="wl-unsaved-indicator" style="display: none;">●</span>
            </div>
            <div class="wl-section-content">
              <textarea
                class="wl-whitelist-editor"
                placeholder="Enter usernames (one per line)..."
                rows="8"
              ></textarea>
              <div class="wl-editor-info">
                <span class="wl-line-count">0 users</span>
                <span class="wl-entry-limit"></span>
              </div>
              <div class="wl-editor-actions">
                <button class="wl-btn wl-save-changes">Save Changes</button>
                <button class="wl-btn wl-btn-secondary wl-clear-collection">Clear All</button>
              </div>
            </div>
          </div>

          <!-- Filter Controls Section -->
          <div class="wl-panel-section">
            <div class="wl-section-header">
              <h3>Filter Controls</h3>
            </div>
            <div class="wl-section-content">
              <div class="wl-filter-toggles">
                <label class="wl-toggle">
                  <input type="checkbox" class="wl-master-enable" checked>
                  <span class="wl-toggle-slider"></span>
                  <span class="wl-toggle-label">Enable Filtering</span>
                </label>

                <div class="wl-display-modes">
                  <label>Display Mode:</label>
                  <select class="wl-display-mode">
                    <option value="normal">Normal (Collapse)</option>
                    <option value="hard-hide">Hard Hide</option>
                    <option value="show-all">Show All</option>
                  </select>
                </div>

                <label class="wl-toggle">
                  <input type="checkbox" class="wl-temp-override">
                  <span class="wl-toggle-slider"></span>
                  <span class="wl-toggle-label">Temporary Override</span>
                </label>
              </div>

              <div class="wl-filter-status">
                <span class="wl-status-indicator"></span>
                <span class="wl-status-text">Filtering Active</span>
              </div>
            </div>
          </div>

          <!-- Statistics Section -->
          <div class="wl-panel-section">
            <div class="wl-section-header">
              <h3>Statistics</h3>
            </div>
            <div class="wl-section-content">
              <div class="wl-stats-grid">
                <div class="wl-stat-item">
                  <span class="wl-stat-label">Current Collection:</span>
                  <span class="wl-stat-value wl-current-collection">-</span>
                </div>
                <div class="wl-stat-item">
                  <span class="wl-stat-label">Users:</span>
                  <span class="wl-stat-value wl-user-count">0</span>
                </div>
                <div class="wl-stat-item">
                  <span class="wl-stat-label">Messages Filtered:</span>
                  <span class="wl-stat-value wl-filtered-count">0</span>
                </div>
                <div class="wl-stat-item">
                  <span class="wl-stat-label">Total Collections:</span>
                  <span class="wl-stat-value wl-collection-count">0</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Actions Section -->
          <div class="wl-panel-section">
            <div class="wl-section-header">
              <h3>Actions</h3>
            </div>
            <div class="wl-section-content">
              <div class="wl-actions-grid">
                <button class="wl-btn wl-import-data">Import</button>
                <button class="wl-btn wl-export-data">Export</button>
                <button class="wl-btn wl-btn-secondary wl-reset-data">Reset</button>
                <button class="wl-btn wl-btn-secondary wl-help">Help</button>
              </div>
            </div>
          </div>
        </div>
      `;

      // Inject into Discord
      document.body.appendChild(this.panel);

      // Set initial position
      this.panel.style.left = this.position.x + 'px';
      this.panel.style.top = this.position.y + 'px';

      // Initialize state
      this.updateCollectionSelector();
      this.updateWhitelistDisplay();
      this.updateFilterStatus();
      this.updateStats();
    }

    bindEvents() {
      if (!this.panel) return;

      // Header controls
      this.panel.querySelector('.wl-panel-close').addEventListener('click', () => this.hidePanel());
      this.panel.querySelector('.wl-panel-minimize').addEventListener('click', () => this.toggleMinimize());

      // Make draggable
      const header = this.panel.querySelector('.wl-panel-header');
      header.addEventListener('mousedown', (e) => this.startDrag(e));

      // Collection selector
      const selector = this.panel.querySelector('.wl-collection-selector');
      selector.addEventListener('change', (e) => this.handleCollectionSwitch(e.target.value));

      // Collection management
      this.panel.querySelector('.wl-new-collection').addEventListener('click', () => this.createNewCollection());
      this.panel.querySelector('.wl-rename-collection').addEventListener('click', () => this.renameCollection());
      this.panel.querySelector('.wl-delete-collection').addEventListener('click', () => this.deleteCollection());

      // Whitelist editor
      const editor = this.panel.querySelector('.wl-whitelist-editor');
      editor.addEventListener('input', () => this.handleWhitelistChange());

      // Editor actions
      this.panel.querySelector('.wl-save-changes').addEventListener('click', () => this.saveChanges());
      this.panel.querySelector('.wl-clear-collection').addEventListener('click', () => this.clearCurrentCollection());

      // Filter controls
      this.panel.querySelector('.wl-master-enable').addEventListener('change', (e) => {
        this.storageManager.config.globalSettings.enabled = e.target.checked;
        this.storageManager.saveConfig();
        this.updateFilterStatus();
        // Always refresh messages when enabled state changes to restore visibility when disabled
        this.filterEngine.refreshAllMessages();
      });

      this.panel.querySelector('.wl-display-mode').addEventListener('change', (e) => {
        const mode = e.target.value;
        this.storageManager.config.globalSettings.hardHide = mode === 'hard-hide';
        this.storageManager.config.globalSettings.showAllTemp = mode === 'show-all';
        this.storageManager.saveConfig();
        this.updateFilterStatus();
        // Always refresh when display mode changes to apply new visibility settings
        this.filterEngine.refreshAllMessages();
      });

      this.panel.querySelector('.wl-temp-override').addEventListener('change', (e) => {
        this.storageManager.config.globalSettings.showAllTemp = e.target.checked;
        this.storageManager.saveConfig();
        this.updateFilterStatus();
        // Always refresh when temp override changes to apply new visibility settings
        this.filterEngine.refreshAllMessages();
      });

      // Section toggles
      this.panel.querySelectorAll('.wl-section-toggle').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
          const target = e.target.dataset.target;
          const content = this.panel.querySelector('#' + target);
          const isExpanded = content.style.display !== 'none';
          content.style.display = isExpanded ? 'none' : 'block';
          e.target.textContent = isExpanded ? '▶' : '▼';
        });
      });

      // Import/Export
      this.panel.querySelector('.wl-import-data').addEventListener('click', () => this.showImportDialog());
      this.panel.querySelector('.wl-export-data').addEventListener('click', () => this.showExportDialog());

      // Global drag handlers
      document.addEventListener('mousemove', (e) => this.handleDrag(e));
      document.addEventListener('mouseup', () => this.stopDrag());

      // Keyboard shortcuts
      document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'W') {
          e.preventDefault();
          this.togglePanel();
        }
      });
    }

    // Panel visibility management
    showPanel() {
      if (!this.panel) this.createPanel();
      this.panel.style.display = 'block';
      this.isVisible = true;
    }

    hidePanel() {
      if (this.panel) {
        this.panel.style.display = 'none';
      }
      this.isVisible = false;
    }

    togglePanel() {
      if (this.isVisible) {
        this.hidePanel();
      } else {
        this.showPanel();
      }
    }

    toggleMinimize() {
      const content = this.panel.querySelector('.wl-panel-content');
      const button = this.panel.querySelector('.wl-panel-minimize');

      if (this.isMinimized) {
        content.style.display = 'block';
        button.textContent = '−';
        this.isMinimized = false;
      } else {
        content.style.display = 'none';
        button.textContent = '+';
        this.isMinimized = true;
      }
    }

    // Drag functionality
    startDrag(e) {
      this.isDragging = true;
      this.panel.classList.add('wl-panel-dragging');
      const rect = this.panel.getBoundingClientRect();
      this.dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }

    handleDrag(e) {
      if (!this.isDragging) return;

      const x = e.clientX - this.dragOffset.x;
      const y = e.clientY - this.dragOffset.y;

      // Keep panel within viewport
      const maxX = window.innerWidth - this.panel.offsetWidth;
      const maxY = window.innerHeight - this.panel.offsetHeight;

      this.position.x = Math.max(0, Math.min(x, maxX));
      this.position.y = Math.max(0, Math.min(y, maxY));

      this.panel.style.left = this.position.x + 'px';
      this.panel.style.top = this.position.y + 'px';
    }

    stopDrag() {
      if (this.isDragging) {
        this.isDragging = false;
        this.panel.classList.remove('wl-panel-dragging');
        // Save position to storage
        this.storageManager.config.uiPosition = this.position;
        this.storageManager.saveConfig();
      }
    }

    // Collection management
    updateCollectionSelector() {
      const selector = this.panel.querySelector('.wl-collection-selector');
      const collections = this.storageManager.getAllCollections();

      selector.innerHTML = '';
      collections.forEach(collection => {
        const option = document.createElement('option');
        option.value = collection.id;
        option.textContent = `${collection.name} (${collection.getSize()})`;
        if (collection.id === this.activeCollectionId) {
          option.selected = true;
        }
        selector.appendChild(option);
      });

      this.updateCollectionInfo();
    }

    updateCollectionInfo() {
      const collection = this.storageManager.getActiveCollection();
      if (!collection) return;

      const nameEl = this.panel.querySelector('.wl-collection-name');
      const metaEl = this.panel.querySelector('.wl-collection-meta');

      nameEl.textContent = collection.name;
      metaEl.textContent = `${collection.getSize()} users • Created \${collection.metadata.created.toLocaleDateString()}`;

      // Update action button states
      const isDefault = collection.id === 'default';
      this.panel.querySelector('.wl-rename-collection').disabled = isDefault;
      this.panel.querySelector('.wl-delete-collection').disabled = isDefault;
    }

    handleCollectionSwitch(newId) {
      if (newId === this.activeCollectionId) return;

      if (this.hasUnsavedChanges) {
        if (!this.showConfirmationDialog('You have unsaved changes. Switch collection anyway?')) {
          // Reset selector to current collection
          this.panel.querySelector('.wl-collection-selector').value = this.activeCollectionId;
          return;
        }
      }

      try {
        this.storageManager.switchActiveCollection(newId);
        // Events will handle the UI updates
      } catch (error) {
        console.error('[WL] Collection switch failed:', error);
        this.showError('Failed to switch collection: ' + error.message);
      }
    }

    createNewCollection() {
      const name = this.showPromptDialog('Enter collection name:', '');
      if (!name || !name.trim()) return;

      try {
        const id = this.storageManager.createCollection(name.trim());
        this.storageManager.switchActiveCollection(id);
        log('Created new collection:', name);
      } catch (error) {
        console.error('[WL] Collection creation failed:', error);
        this.showError('Failed to create collection: ' + error.message);
      }
    }

    renameCollection() {
      const collection = this.storageManager.getActiveCollection();
      if (!collection || collection.id === 'default') return;

      const newName = this.showPromptDialog('Enter new collection name:', collection.name);
      if (!newName || !newName.trim() || newName.trim() === collection.name) return;

      try {
        collection.name = newName.trim();
        collection.metadata.modified = new Date();
        this.storageManager.saveCollections();
        this.updateCollectionSelector();
        this.updateStats();
        log('Renamed collection to:', newName);
      } catch (error) {
        console.error('[WL] Collection rename failed:', error);
        this.showError('Failed to rename collection: ' + error.message);
      }
    }

    deleteCollection() {
      const collection = this.storageManager.getActiveCollection();
      if (!collection || collection.id === 'default') return;

      const confirmMsg = `Delete collection "${collection.name}" with ${collection.getSize()} users?`;
      if (!this.showConfirmationDialog(confirmMsg)) return;

      try {
        this.storageManager.deleteCollection(collection.id);
        log('Deleted collection:', collection.name);
      } catch (error) {
        console.error('[WL] Collection deletion failed:', error);
        this.showError('Failed to delete collection: ' + error.message);
      }
    }

    // Whitelist management
    updateWhitelistDisplay() {
      const collection = this.storageManager.getActiveCollection();
      if (!collection) return;

      const editor = this.panel.querySelector('.wl-whitelist-editor');
      const usernames = Array.from(collection.entries.values()).map(entry => entry.username);
      editor.value = usernames.join('\n');

      this.updateEditorInfo();
      this.clearUnsavedChanges();
    }

    updateEditorInfo() {
      const editor = this.panel.querySelector('.wl-whitelist-editor');
      const lines = editor.value.split('\n').filter(line => line.trim()).length;
      const maxEntries = this.storageManager.config.globalSettings.maxEntries;

      this.panel.querySelector('.wl-line-count').textContent = `${lines} users`;
      this.panel.querySelector('.wl-entry-limit').textContent = `(max: ${maxEntries})`;
    }

    handleWhitelistChange() {
      this.markUnsavedChanges();
      this.updateEditorInfo();
    }

    saveChanges() {
      const editor = this.panel.querySelector('.wl-whitelist-editor');
      const collection = this.storageManager.getActiveCollection();
      if (!collection) return;

      try {
        // Parse usernames from textarea
        const usernames = editor.value
          .split('\n')
          .map(line => line.trim())
          .filter(line => line);

        // Clear current collection
        collection.entries.clear();

        // Add new usernames
        let added = 0;
        const maxEntries = this.storageManager.config.globalSettings.maxEntries;

        for (const username of usernames) {
          if (added >= maxEntries) {
            this.showError(`Maximum ${maxEntries} entries allowed per collection`);
            break;
          }

          try {
            if (collection.addEntry(username, { source: 'manual' })) {
              added++;
            }
          } catch (error) {
            console.warn('[WL] Invalid username:', username, error.message);
          }
        }

        // Save changes
        this.storageManager.saveCollections();
        this.clearUnsavedChanges();
        this.updateStats();

        log(`Saved ${added} usernames to collection:`, collection.name);

        // Refresh filtering - always refresh when whitelist changes to apply new filter state
        this.filterEngine.refreshAllMessages();

      } catch (error) {
        console.error('[WL] Save failed:', error);
        this.showError('Failed to save changes: ' + error.message);
      }
    }

    clearCurrentCollection() {
      const collection = this.storageManager.getActiveCollection();
      if (!collection) return;

      if (!this.showConfirmationDialog(`Clear all ${collection.getSize()} users from "${collection.name}"?`)) {
        return;
      }

      collection.entries.clear();
      collection.metadata.modified = new Date();
      this.storageManager.saveCollections();
      this.updateWhitelistDisplay();
      this.updateStats();

      log('Cleared collection:', collection.name);
    }

    // UI state management
    markUnsavedChanges() {
      this.hasUnsavedChanges = true;
      this.panel.querySelector('.wl-unsaved-indicator').style.display = 'inline';
    }

    clearUnsavedChanges() {
      this.hasUnsavedChanges = false;
      this.panel.querySelector('.wl-unsaved-indicator').style.display = 'none';
    }

    // Status updates
    updateFilterStatus() {
      const config = this.storageManager.config.globalSettings;
      const statusEl = this.panel.querySelector('.wl-status-indicator');
      const textEl = this.panel.querySelector('.wl-status-text');

      // Update toggles
      this.panel.querySelector('.wl-master-enable').checked = config.enabled;
      this.panel.querySelector('.wl-temp-override').checked = config.showAllTemp;

      // Update display mode
      let mode = 'normal';
      if (config.hardHide) mode = 'hard-hide';
      if (config.showAllTemp) mode = 'show-all';
      this.panel.querySelector('.wl-display-mode').value = mode;

      // Update status indicator
      if (!config.enabled) {
        statusEl.className = 'wl-status-indicator wl-status-disabled';
        textEl.textContent = 'Filtering Disabled';
      } else if (config.showAllTemp) {
        statusEl.className = 'wl-status-indicator wl-status-temp';
        textEl.textContent = 'Show All (Temporary)';
      } else if (config.hardHide) {
        statusEl.className = 'wl-status-indicator wl-status-hard';
        textEl.textContent = 'Hard Hide Mode';
      } else {
        statusEl.className = 'wl-status-indicator wl-status-active';
        textEl.textContent = 'Filtering Active';
      }
    }

    updateStats() {
      const collection = this.storageManager.getActiveCollection();
      const allCollections = this.storageManager.getAllCollections();
      const filterStats = this.filterEngine.getStats();

      this.panel.querySelector('.wl-current-collection').textContent = collection?.name || '-';
      this.panel.querySelector('.wl-user-count').textContent = collection?.getSize() || 0;
      this.panel.querySelector('.wl-filtered-count').textContent = filterStats.messagesProcessed || 0;
      this.panel.querySelector('.wl-collection-count').textContent = allCollections.length;
    }

    // Dialog utilities
    showConfirmationDialog(message) {
      return confirm(message);
    }

    showPromptDialog(message, defaultValue = '') {
      return prompt(message, defaultValue);
    }

    showError(message) {
      console.error('[WL]', message);
      alert('Error: ' + message);
    }

    showImportDialog() {
      // TODO: Implement import dialog
      this.showError('Import functionality not yet implemented');
    }

    showExportDialog() {
      // TODO: Implement export dialog
      this.showError('Export functionality not yet implemented');
    }

    // CSS styles
    applyStyles() {
      if (document.querySelector('#wl-panel-styles')) return;

      const style = document.createElement('style');
      style.id = 'wl-panel-styles';
      style.textContent = `
        .wl-panel-container {
          position: fixed;
          width: 320px;
          background: #2f3136;
          border: 1px solid #202225;
          border-radius: 8px;
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.24);
          z-index: 10000;
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          font-size: 14px;
          color: #dcddde;
          display: none;
        }

        .wl-panel-header {
          background: #36393f;
          padding: 12px 16px;
          border-radius: 8px 8px 0 0;
          border-bottom: 1px solid #202225;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: move;
          user-select: none;
        }

        .wl-panel-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          flex: 1;
        }

        .wl-panel-icon {
          font-size: 16px;
        }

        .wl-panel-header-controls {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .wl-collection-selector {
          background: #40444b;
          border: 1px solid #202225;
          border-radius: 4px;
          color: #dcddde;
          padding: 4px 8px;
          font-size: 12px;
          min-width: 120px;
        }

        .wl-panel-minimize,
        .wl-panel-close {
          background: none;
          border: none;
          color: #b9bbbe;
          font-size: 16px;
          width: 24px;
          height: 24px;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .wl-panel-minimize:hover,
        .wl-panel-close:hover {
          background: #40444b;
          color: #fff;
        }

        .wl-panel-content {
          max-height: 600px;
          overflow-y: auto;
        }

        .wl-panel-section {
          border-bottom: 1px solid #202225;
          padding: 16px;
        }

        .wl-panel-section:last-child {
          border-bottom: none;
        }

        .wl-section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .wl-section-header h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #fff;
        }

        .wl-section-toggle {
          background: none;
          border: none;
          color: #b9bbbe;
          cursor: pointer;
          font-size: 12px;
        }

        .wl-unsaved-indicator {
          color: #faa61a;
          font-size: 16px;
          margin-left: 8px;
        }

        .wl-collection-info {
          background: #40444b;
          padding: 8px 12px;
          border-radius: 4px;
          margin-bottom: 8px;
        }

        .wl-collection-name {
          font-weight: 600;
          display: block;
        }

        .wl-collection-meta {
          font-size: 12px;
          color: #b9bbbe;
        }

        .wl-collection-actions {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }

        .wl-whitelist-editor {
          width: 100%;
          background: #40444b;
          border: 1px solid #202225;
          border-radius: 4px;
          color: #dcddde;
          padding: 8px;
          font-family: 'Consolas', 'Monaco', monospace;
          font-size: 13px;
          resize: vertical;
          margin-bottom: 8px;
        }

        .wl-whitelist-editor:focus {
          outline: none;
          border-color: #7289da;
        }

        .wl-editor-info {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: #b9bbbe;
          margin-bottom: 8px;
        }

        .wl-editor-actions,
        .wl-actions-grid {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .wl-btn {
          background: #7289da;
          border: none;
          border-radius: 4px;
          color: #fff;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }

        .wl-btn:hover {
          background: #677bc4;
        }

        .wl-btn:disabled {
          background: #4f545c;
          color: #72767d;
          cursor: not-allowed;
        }

        .wl-btn-secondary {
          background: #4f545c;
        }

        .wl-btn-secondary:hover {
          background: #5d6269;
        }

        .wl-btn-small {
          padding: 4px 8px;
          font-size: 11px;
        }

        .wl-filter-toggles {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .wl-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }

        .wl-toggle input[type="checkbox"] {
          display: none;
        }

        .wl-toggle-slider {
          width: 40px;
          height: 20px;
          background: #72767d;
          border-radius: 10px;
          position: relative;
          transition: background 0.2s;
        }

        .wl-toggle-slider::before {
          content: '';
          position: absolute;
          top: 2px;
          left: 2px;
          width: 16px;
          height: 16px;
          background: #fff;
          border-radius: 50%;
          transition: transform 0.2s;
        }

        .wl-toggle input:checked + .wl-toggle-slider {
          background: #7289da;
        }

        .wl-toggle input:checked + .wl-toggle-slider::before {
          transform: translateX(20px);
        }

        .wl-display-modes {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .wl-display-modes select {
          background: #40444b;
          border: 1px solid #202225;
          border-radius: 4px;
          color: #dcddde;
          padding: 4px 8px;
          font-size: 12px;
        }

        .wl-filter-status {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 12px;
          padding: 8px;
          background: #40444b;
          border-radius: 4px;
        }

        .wl-status-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .wl-status-active {
          background: #43b581;
        }

        .wl-status-disabled {
          background: #f04747;
        }

        .wl-status-temp {
          background: #faa61a;
        }

        .wl-status-hard {
          background: #7289da;
        }

        .wl-stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .wl-stat-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .wl-stat-label {
          font-size: 11px;
          color: #b9bbbe;
          text-transform: uppercase;
          font-weight: 600;
        }

        .wl-stat-value {
          font-size: 14px;
          font-weight: 600;
          color: #fff;
        }

        .wl-panel-dragging {
          opacity: 0.9;
          pointer-events: none;
        }

        /* Animations */
        .wl-panel-container {
          animation: wl-panel-fadein 0.2s ease-out;
        }

        @keyframes wl-panel-fadein {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `;

      document.head.appendChild(style);
    }
  }

  // Initialize UI Manager
  const uiManager = new UIManager(whitelistManager, filterEngine, storageManager);

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
        // Deep merge for nested objects like globalSettings
        function deepMerge(target, source) {
          for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
              target[key] = target[key] || {};
              deepMerge(target[key], source[key]);
            } else {
              target[key] = source[key];
            }
          }
        }

        deepMerge(storageManager.config, partial);
        storageManager.saveConfig();
      },
      // Convenience methods for common config updates
      setEnabled: (enabled) => {
        storageManager.config.globalSettings.enabled = enabled;
        storageManager.saveConfig();
      },
      setHardHide: (hardHide) => {
        storageManager.config.globalSettings.hardHide = hardHide;
        storageManager.saveConfig();
      },
      setShowAllTemp: (showAllTemp) => {
        storageManager.config.globalSettings.showAllTemp = showAllTemp;
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

    // User Interface
    ui: {
      manager: uiManager,
      show: () => uiManager.showPanel(),
      hide: () => uiManager.hidePanel(),
      toggle: () => uiManager.togglePanel(),
      isVisible: () => uiManager.isVisible,
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
      uiManager,
      eventBus,
      Storage,
    };
  }
})();
