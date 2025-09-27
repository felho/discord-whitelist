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

  // --- Initialize System ---
  const storageManager = new StorageManager();
  const whitelistManager = new WhitelistManager(storageManager);
  const searchManager = new SearchManager(whitelistManager);
  const dataManager = new DataManager(storageManager);

  // Handle collection switches
  eventBus.on('collection:switched', () => {
    whitelistManager.rebuildLookupCache();
  });

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
      eventBus,
      Storage,
    };
  }
})();
