(() => {
  "use strict";

  const VERSION = "v0.1.0 (Milestone 1: State & Storage)";

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
  const DEFAULTS = {
    whitelist: [],
    enabled: true,
    hardHide: false,
    showAllTemp: false,
  };

  // --- Helpers: logging ---
  const DEBUG = true;
  function log(...args) {
    if (DEBUG) console.log("[WL]", ...args);
  }

  // --- Load / Save / Reset ---
  function loadState() {
    try {
      const parsed = Storage.get(STORAGE_KEY, null);
      if (!parsed) return null;
      return {
        whitelist: Array.isArray(parsed.whitelist) ? parsed.whitelist : [],
        enabled:
          typeof parsed.enabled === "boolean"
            ? parsed.enabled
            : DEFAULTS.enabled,
        hardHide:
          typeof parsed.hardHide === "boolean"
            ? parsed.hardHide
            : DEFAULTS.hardHide,
        showAllTemp:
          typeof parsed.showAllTemp === "boolean"
            ? parsed.showAllTemp
            : DEFAULTS.showAllTemp,
      };
    } catch (e) {
      console.warn("[WL] loadState parse error; falling back to defaults", e);
      return null;
    }
  }

  function saveState(s) {
    try {
      Storage.set(STORAGE_KEY, s);
      return true;
    } catch (e) {
      console.error("[WL] saveState failed", e);
      return false;
    }
  }

  let state = loadState() || { ...DEFAULTS };
  // Ensure persisted once on first run
  saveState(state);

  function resetState() {
    try {
      Storage.remove(STORAGE_KEY);
      state = { ...DEFAULTS };
      saveState(state);
      log("State reset to defaults");
    } catch (e) {
      console.error("[WL] resetState failed", e);
    }
  }

  // --- Public dev API (exposed on window for quick testing) ---
  const API = {
    version: VERSION,
    getState: () => ({
      whitelist: [...state.whitelist],
      enabled: state.enabled,
      hardHide: state.hardHide,
      showAllTemp: state.showAllTemp,
    }),
    setState: (partial = {}) => {
      if (partial && typeof partial === "object") {
        if (Array.isArray(partial.whitelist)) {
          state.whitelist = partial.whitelist
            .map((x) => String(x))
            .map((s) => s.trim())
            .filter(Boolean);
        }
        if (typeof partial.enabled === "boolean")
          state.enabled = partial.enabled;
        if (typeof partial.hardHide === "boolean")
          state.hardHide = partial.hardHide;
        if (typeof partial.showAllTemp === "boolean")
          state.showAllTemp = partial.showAllTemp;
        saveState(state);
        log("State updated", state);
      }
      return API.getState();
    },
    resetState,
    addToWhitelist: (name) => {
      if (!name) return false;
      const s = String(name).trim();
      if (!s) return false;
      const lower = s.toLowerCase();
      const has = state.whitelist.some(
        (w) => String(w).toLowerCase() === lower
      );
      if (!has) {
        state.whitelist.push(s);
        saveState(state);
        log(`Added to whitelist: "${s}"`);
        return true;
      } else {
        log(`Already in whitelist: "${s}"`);
        return false;
      }
    },
    removeFromWhitelist: (name) => {
      if (!name) return false;
      const lower = String(name).trim().toLowerCase();
      const prevLen = state.whitelist.length;
      state.whitelist = state.whitelist.filter(
        (w) => String(w).toLowerCase() !== lower
      );
      const changed = state.whitelist.length !== prevLen;
      if (changed) {
        saveState(state);
        log(`Removed from whitelist: "${name}"`);
      }
      return changed;
    },
    clearWhitelist: () => {
      state.whitelist = [];
      saveState(state);
      log("Whitelist cleared");
    },
  };

  // Expose globally for dev/testing in console
  window.WL = API;
  log("Storage backend:", Storage.type);
  if (Storage.type === "memory") {
    console.warn(
      "[WL] WARNING: Using non-persistent in-memory storage. State will be lost on reload. Add GM grants to the loader or enable page localStorage."
    );
  }
  log("Loaded", VERSION, "Initial state:", state);
})();
