// ==UserScript==
// @name         Discord Whitelist Loader (DEV, sandbox eval)
// @namespace    local-dev
// @match        https://discord.com/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @connect      localhost
// ==/UserScript==

(function () {
  const SRC = "https://localhost:5173/whitelist.js";
  const url = `${SRC}?ts=${Date.now()}`; // cache-buster

  GM_addStyle(`
    #wl-dev-indicator {
      position: fixed; z-index: 2147483647; right: 8px; bottom: 8px;
      background: rgba(0,0,0,.6); color: #fff; padding: 2px 6px; border-radius: 6px;
      font: 11px/1.4 system-ui, sans-serif; pointer-events: none;
    }
  `);
  const badge = document.createElement("div");
  badge.id = "wl-dev-indicator";
  badge.textContent = "WL loader…";
  document.documentElement.appendChild(badge);

  GM_xmlhttpRequest({
    method: "GET",
    url,
    nocache: true,
    onload: (res) => {
      try {
        if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
        const code = res.responseText + "\n//# sourceURL=whitelist.js";
        // FONTOS: sandbox eval → látja a GM_* API-kat
        (0, eval)(code);
        console.log(
          "[Whitelist Loader] executed (sandbox eval):",
          url,
          "GM_getValue:",
          typeof GM_getValue
        );
        badge.textContent = "WL ok";
        setTimeout(() => badge.remove(), 1500);
      } catch (e) {
        console.error("[Whitelist Loader] exec error:", e);
        badge.textContent = "WL exec error";
      }
    },
    onerror: (e) => {
      console.error("[Whitelist Loader] request failed:", e);
      badge.textContent = "WL net error";
    },
  });
})();
