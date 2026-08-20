(function initializeChannelFenceContent() {
  "use strict";

  const Shared = globalThis.ChannelFenceShared;
  if (!Shared || globalThis.__channelFenceLoaded) {
    return;
  }
  globalThis.__channelFenceLoaded = true;

  const CONTENT_SELECTOR = [
    "ytd-rich-item-renderer",
    "ytd-video-renderer",
    "ytd-grid-video-renderer",
    "ytd-compact-video-renderer",
    "ytd-playlist-video-renderer",
    "ytd-playlist-panel-video-renderer",
    "ytd-reel-item-renderer",
    "ytd-reel-video-renderer",
    "ytd-channel-renderer",
    "ytd-radio-renderer",
    "yt-lockup-view-model",
    ".yt-lockup-view-model",
    ".yt-lockup-view-model--wrapper",
    "ytm-video-with-context-renderer",
    "ytm-compact-video-renderer"
  ].join(",");

  const COMMENT_SELECTOR = [
    "ytd-comment-thread-renderer",
    "ytd-comment-view-model",
    "ytm-comment-thread-renderer"
  ].join(",");

  const MENU_POPUP_SELECTOR = [
    "ytd-menu-popup-renderer",
    "yt-sheet-view-model"
  ].join(",");

  const CHANNEL_ANCHOR_SELECTOR = [
    "a#avatar-link[href]",
    "ytd-channel-name a[href]",
    "#channel-name a[href]",
    "a#author-text[href]",
    "#owner-name a[href]",
    "a.yt-simple-endpoint[href^='/@']",
    "a.yt-simple-endpoint[href^='/channel/']",
    "a.yt-simple-endpoint[href^='/c/']",
    "a.yt-simple-endpoint[href^='/user/']",
    "a[href^='/@']",
    "a[href^='/channel/']",
    "a[href^='/c/']",
    "a[href^='/user/']",
    "a[href^='https://www.youtube.com/@']",
    "a[href^='https://www.youtube.com/channel/']",
    "a[href^='https://www.youtube.com/c/']",
    "a[href^='https://www.youtube.com/user/']",
    "a[href^='https://youtube.com/@']",
    "a[href^='https://youtube.com/channel/']",
    "a[href^='https://m.youtube.com/@']",
    "a[href^='https://m.youtube.com/channel/']",
    "yt-lockup-view-model a[href]",
    ".yt-lockup-view-model a[href]",
    ".yt-lockup-view-model--wrapper a[href]",
    "[class*='metadata-view-model'] a[href]"
  ].join(",");

  const PAGE_OWNER_SELECTORS = [
    "yt-page-header-renderer",
    "ytd-c4-tabbed-header-renderer #channel-header-container",
    "ytd-watch-metadata #owner",
    "ytd-video-owner-renderer",
    "ytd-channel-name#channel-name",
    "ytd-reel-video-renderer[is-active]",
    "ytm-slim-owner-renderer"
  ];

  const state = {
    enabled: true,
    hideComments: true,
    blocked: [],
    blockedKeys: new Set(),
    currentUrl: location.href,
    scanScheduled: false,
    navigationInProgress: false,
    pendingMenuContext: null,
    pendingTimer: null,
    toastTimer: null
  };

  markWatchPending();

  function isWatchLikeRoute() {
    return location.pathname === "/watch" || location.pathname.startsWith("/shorts/");
  }

  function markWatchPending() {
    clearTimeout(state.pendingTimer);
    if (!isWatchLikeRoute()) {
      document.documentElement.classList.remove("cf-watch-pending");
      return;
    }
    document.documentElement.classList.add("cf-watch-pending");
    state.pendingTimer = setTimeout(() => {
      document.documentElement.classList.remove("cf-watch-pending");
    }, 4500);
  }

  function clearWatchPending() {
    clearTimeout(state.pendingTimer);
    document.documentElement.classList.remove("cf-watch-pending");
  }

  function rebuildBlockedKeys() {
    state.blocked = Shared.sanitizeBlockedEntries(state.blocked);
    state.blockedKeys = new Set(state.blocked.flatMap((entry) => entry.aliases));
  }

  async function loadState() {
    const values = await chrome.storage.local.get(Object.keys(Shared.DEFAULTS));
    state.enabled = values[Shared.STORAGE.enabled] !== false;
    state.hideComments = values[Shared.STORAGE.hideComments] !== false;
    state.blocked = values[Shared.STORAGE.blocked] || [];
    rebuildBlockedKeys();
  }

  async function initializeState() {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await loadState();
        scheduleScan();
        return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
      }
    }
    // Keep the default enabled/empty state usable if Chrome is still settling
    // immediately after a fresh unpacked install. Storage changes will sync in.
    scheduleScan();
  }

  function refsFromElement(root) {
    if (!root || typeof root.querySelectorAll !== "function") {
      return [];
    }

    const refs = [];
    if (root.matches && root.matches("a[href]")) {
      const own = Shared.normalizeChannelRef(root.href || root.getAttribute("href"), location.href);
      if (own) {
        refs.push(own);
      }
    }

    for (const anchor of root.querySelectorAll(CHANNEL_ANCHOR_SELECTOR)) {
      if (anchor.closest("#cf-hard-block-overlay, #cf-toast")) {
        continue;
      }
      const ref = Shared.normalizeChannelRef(anchor.href || anchor.getAttribute("href"), location.href);
      if (ref) {
        refs.push(ref);
      }
      if (refs.length >= 8) {
        break;
      }
    }
    return Shared.uniqueRefs(refs);
  }

  function ownerNamesFromElement(root) {
    if (!root || typeof root.querySelectorAll !== "function") {
      return [];
    }

    const names = new Set();
    for (const anchor of root.querySelectorAll(CHANNEL_ANCHOR_SELECTOR)) {
      const ref = Shared.normalizeChannelRef(anchor.href || anchor.getAttribute("href"), location.href);
      if (!ref) {
        continue;
      }

      const candidates = [
        anchor.textContent,
        anchor.getAttribute("aria-label"),
        anchor.getAttribute("title"),
        ref.type === "handle" ? ref.value : ""
      ];
      for (const candidate of candidates) {
        const normalized = Shared.normalizeCreatorName(candidate);
        if (normalized) {
          names.add(normalized);
        }
      }
    }
    return [...names];
  }

  function metadataRefs() {
    const refs = [];
    const channelId = document.querySelector("meta[itemprop='channelId'][content]")?.content;
    if (channelId) {
      const ref = Shared.normalizeChannelRef(`/channel/${channelId}`, location.href);
      if (ref) {
        refs.push(ref);
      }
    }
    return refs;
  }

  function pageOwnerRoot() {
    for (const selector of PAGE_OWNER_SELECTORS) {
      for (const candidate of document.querySelectorAll(selector)) {
        const hasIdentity = refsFromElement(candidate).length > 0 ||
          Boolean(Shared.cleanCreatorDisplayName(candidate.textContent));
        if (hasIdentity) {
          return candidate;
        }
      }
    }
    return null;
  }

  function currentPageContext() {
    const refs = [];
    const pathRef = Shared.normalizeChannelRef(location.href);
    if (pathRef) {
      refs.push(pathRef);
    }
    refs.push(...metadataRefs());

    const owner = pageOwnerRoot();
    if (owner) {
      refs.push(...refsFromElement(owner));
    }

    const cleanRefs = Shared.uniqueRefs(refs);
    const nameSelectors = [
      "ytd-watch-metadata #owner #channel-name a",
      "#owner-name a",
      "yt-page-header-renderer h1",
      "ytd-c4-tabbed-header-renderer #channel-name",
      "ytd-reel-video-renderer[is-active] #channel-name",
      "ytd-reel-video-renderer[is-active] a[href^='/@']"
    ];
    let displayName = "";
    for (const selector of nameSelectors) {
      displayName = Shared.cleanDisplayName(document.querySelector(selector)?.textContent);
      if (displayName) {
        break;
      }
    }

    return {
      refs: cleanRefs,
      displayName: displayName || (cleanRefs[0]?.value ?? "")
    };
  }

  function matchingEntry(refs, ownerNames) {
    const wanted = Shared.uniqueRefs(refs).map((ref) => ref.key);
    if (wanted.some((key) => state.blockedKeys.has(key))) {
      return Shared.findMatchingEntry(state.blocked, refs);
    }
    return Shared.findMatchingEntryByNames(state.blocked, ownerNames);
  }

  function bestAnchor(root) {
    if (!root) {
      return null;
    }
    for (const anchor of root.querySelectorAll(CHANNEL_ANCHOR_SELECTOR)) {
      if (anchor.closest("#cf-hard-block-overlay, #cf-toast")) {
        continue;
      }
      if (Shared.normalizeChannelRef(anchor.href || anchor.getAttribute("href"), location.href)) {
        return anchor;
      }
    }
    return null;
  }

  function buttonHost(root, pageButton) {
    const anchor = bestAnchor(root);
    if (anchor) {
      return anchor.closest("ytd-channel-name, #channel-name, #owner-name, #author-text") || anchor.parentElement;
    }
    if (!pageButton) {
      return null;
    }
    return root.querySelector("#channel-name, h1, [class*='page-header-title']") || root;
  }

  function displayNameFromRoot(root, refs) {
    const channelAnchors = [...root.querySelectorAll(CHANNEL_ANCHOR_SELECTOR)].filter((anchor) => {
      return Shared.normalizeChannelRef(anchor.href || anchor.getAttribute("href"), location.href);
    });
    const sources = [
      (anchor) => anchor.textContent,
      (anchor) => anchor.getAttribute("aria-label"),
      (anchor) => anchor.getAttribute("title")
    ];

    for (const source of sources) {
      for (const anchor of channelAnchors) {
        const name = Shared.cleanCreatorDisplayName(source(anchor));
        if (name) {
          return name;
        }
      }
    }

    return refs.find((ref) => ref.type === "handle")?.value ||
      refs[0]?.value ||
      "creator";
  }

  function isCreatorMenuTrigger(control) {
    if (!control) {
      return false;
    }
    const label = [
      control.getAttribute("aria-label"),
      control.getAttribute("title"),
      control.querySelector("button")?.getAttribute("aria-label")
    ].filter(Boolean).join(" ");
    return Boolean(control.closest("ytd-menu-renderer, yt-menu-renderer")) ||
      /action menu|more actions/i.test(label);
  }

  function rememberMenuContext(event) {
    if (!state.enabled || !(event.target instanceof Element)) {
      return;
    }
    const control = event.target.closest(
      "button, yt-icon-button, tp-yt-paper-icon-button, button-view-model, [role='button']"
    );
    if (!isCreatorMenuTrigger(control)) {
      return;
    }

    let root = event.target.closest(CONTENT_SELECTOR);
    let refs = root ? refsFromElement(root) : [];
    let ownerNames = root ? ownerNamesFromElement(root) : [];
    let displayName = root ? displayNameFromRoot(root, refs) : "";

    if (!root && control.closest("ytd-watch-metadata, ytd-video-primary-info-renderer")) {
      const pageContext = currentPageContext();
      const owner = pageOwnerRoot();
      root = owner || control.closest("ytd-watch-metadata, ytd-video-primary-info-renderer");
      refs = pageContext.refs;
      ownerNames = owner ? ownerNamesFromElement(owner) : [];
      displayName = pageContext.displayName;
    }

    if (refs.length === 0) {
      return;
    }
    state.pendingMenuContext = {
      root,
      trigger: control,
      refs,
      ownerNames,
      displayName,
      expiresAt: Date.now() + 5000
    };
    scheduleScan();
  }

  function closeCreatorMenu() {
    document.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Escape",
      code: "Escape",
      bubbles: true,
      composed: true
    }));
  }

  function nativeMenuTextColor(host) {
    const nativeItem = [...host.querySelectorAll(
      "ytd-menu-service-item-renderer, yt-list-item-view-model, tp-yt-paper-item, [role='menuitem']"
    )].find((item) => !item.classList.contains("cf-menu-item"));
    if (!nativeItem) {
      return "";
    }

    const label = nativeItem.querySelector(
      "yt-formatted-string, .yt-core-attributed-string, #label, [class*='label'], [class*='text']"
    );
    for (const element of [label, nativeItem]) {
      if (!element) {
        continue;
      }
      const color = getComputedStyle(element).color;
      if (color && color !== "transparent" && color !== "rgba(0, 0, 0, 0)") {
        return color;
      }
    }
    return "";
  }

  function ensureCreatorMenuItem(popup) {
    if (!state.enabled || !popup || popup.querySelector(".cf-menu-item")) {
      return;
    }
    const context = state.pendingMenuContext;
    if (!context || context.expiresAt < Date.now()) {
      state.pendingMenuContext = null;
      return;
    }

    const host = popup.querySelector("#items, tp-yt-paper-listbox, [role='menu']") || popup;
    const existingEntry = matchingEntry(context.refs, context.ownerNames);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cf-menu-item";
    button.setAttribute("role", "menuitem");
    button.setAttribute("aria-label", existingEntry
      ? "Unblock creator with ChannelFence"
      : "Block creator with ChannelFence");
    const menuTextColor = nativeMenuTextColor(host);
    if (menuTextColor) {
      button.style.setProperty("--cf-menu-text-color", menuTextColor);
    }

    const symbol = document.createElement("span");
    symbol.className = "cf-menu-item__symbol";
    symbol.setAttribute("aria-hidden", "true");
    symbol.textContent = "⊘";

    const label = document.createElement("span");
    label.className = "cf-menu-item__label";
    label.textContent = existingEntry
      ? "ChannelFence: Unblock"
      : "ChannelFence: Block";
    button.append(symbol, label);

    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      state.pendingMenuContext = null;
      closeCreatorMenu();

      if (existingEntry) {
        await unblockCreator(context.refs);
        showToast(`Unblocked ${Shared.labelForEntry(existingEntry)}`);
        return;
      }
      await blockCreator(context.refs, context.displayName);
    }, true);

    host.append(button);
  }

  function processCreatorMenus() {
    document.querySelectorAll(MENU_POPUP_SELECTOR).forEach(ensureCreatorMenuItem);
  }

  function ensureBlockButton(root, pageButton) {
    if (!state.enabled || !root || root.querySelector(":scope .cf-block-button")) {
      return;
    }
    const refs = Shared.uniqueRefs([
      ...refsFromElement(root),
      ...(pageButton ? currentPageContext().refs : [])
    ]);
    if (refs.length === 0) {
      return;
    }
    const host = buttonHost(root, pageButton);
    if (!host || host.closest("#cf-hard-block-overlay")) {
      return;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "cf-block-button";
    button.title = "Block this creator with ChannelFence";
    button.setAttribute("aria-label", "Block this creator");

    const symbol = document.createElement("span");
    symbol.className = "cf-block-button__symbol";
    symbol.setAttribute("aria-hidden", "true");
    symbol.textContent = "⊘";
    button.append(symbol);

    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const pageContext = pageButton ? currentPageContext() : null;
      const freshRefs = Shared.uniqueRefs([
        ...refs,
        ...refsFromElement(root),
        ...(pageContext?.refs || [])
      ]);
      await blockCreator(
        freshRefs,
        pageContext?.displayName || displayNameFromRoot(root, freshRefs)
      );
    }, true);

    host.append(button);
  }

  function processItem(item, isComment) {
    const refs = refsFromElement(item);
    const ownerNames = ownerNamesFromElement(item);
    const blocked = Boolean(matchingEntry(refs, ownerNames));
    const shouldHide = state.enabled && blocked && (!isComment || state.hideComments);
    item.classList.toggle("cf-hidden-by-channelfence", shouldHide);

    if (!state.enabled || blocked) {
      item.querySelectorAll(".cf-block-button").forEach((button) => button.remove());
      return;
    }
    ensureBlockButton(item, false);
  }

  function pauseVisibleVideos() {
    for (const video of document.querySelectorAll("video")) {
      try {
        video.pause();
      } catch {
        // A detached player can reject media operations during navigation.
      }
    }
  }

  function removeOverlay() {
    document.getElementById("cf-hard-block-overlay")?.remove();
  }

  function showOverlay(entry, refs) {
    clearWatchPending();
    pauseVisibleVideos();

    const existing = document.getElementById("cf-hard-block-overlay");
    if (existing?.dataset.entryKey === entry.key) {
      return;
    }
    existing?.remove();

    const overlay = document.createElement("section");
    overlay.id = "cf-hard-block-overlay";
    overlay.dataset.entryKey = entry.key;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "cf-hard-block-title");

    const card = document.createElement("div");
    card.className = "cf-hard-block-card";

    const icon = document.createElement("div");
    icon.className = "cf-hard-block-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "⊘";

    const title = document.createElement("h1");
    title.id = "cf-hard-block-title";
    title.textContent = "Creator blocked";

    const message = document.createElement("p");
    message.textContent = `${Shared.labelForEntry(entry)} is on your ChannelFence block list.`;

    const actions = document.createElement("div");
    actions.className = "cf-hard-block-actions";

    const home = document.createElement("button");
    home.type = "button";
    home.textContent = "Go to Home";
    home.addEventListener("click", () => location.assign("/"));

    const unblock = document.createElement("button");
    unblock.type = "button";
    unblock.textContent = "Unblock and continue";
    unblock.addEventListener("click", async () => {
      await unblockCreator(refs);
      removeOverlay();
      scheduleScan();
    });

    actions.append(home, unblock);
    card.append(icon, title, message, actions);
    overlay.append(card);
    (document.body || document.documentElement).append(overlay);
    home.focus();
  }

  function applyRouteGuard() {
    if (state.navigationInProgress) {
      removeOverlay();
      return;
    }

    if (!state.enabled) {
      clearWatchPending();
      removeOverlay();
      return;
    }

    const context = currentPageContext();
    const pathIsChannel = Boolean(Shared.normalizeChannelRef(location.href));
    const routeNeedsIdentity = pathIsChannel || isWatchLikeRoute();
    if (!routeNeedsIdentity) {
      clearWatchPending();
      removeOverlay();
      return;
    }

    const entry = matchingEntry(context.refs);
    if (entry) {
      showOverlay(entry, context.refs);
      return;
    }

    removeOverlay();
    if (pathIsChannel || context.refs.length > 0) {
      clearWatchPending();
    }

    const owner = pageOwnerRoot();
    if (owner) {
      ensureBlockButton(owner, true);
    }
  }

  function scan() {
    state.scanScheduled = false;

    if (location.href !== state.currentUrl) {
      state.currentUrl = location.href;
      removeOverlay();
      markWatchPending();
    }

    if (!state.enabled) {
      document.querySelectorAll(".cf-hidden-by-channelfence").forEach((item) => {
        item.classList.remove("cf-hidden-by-channelfence");
      });
      document.querySelectorAll(".cf-block-button").forEach((button) => button.remove());
      document.querySelectorAll(".cf-menu-item").forEach((button) => button.remove());
      state.pendingMenuContext = null;
      applyRouteGuard();
      return;
    }

    document.querySelectorAll(CONTENT_SELECTOR).forEach((item) => processItem(item, false));
    document.querySelectorAll(COMMENT_SELECTOR).forEach((item) => processItem(item, true));
    processCreatorMenus();
    applyRouteGuard();
  }

  function scheduleScan() {
    if (state.scanScheduled) {
      return;
    }
    state.scanScheduled = true;
    requestAnimationFrame(scan);
  }

  async function blockCreator(refs, displayName) {
    const entry = Shared.createBlockedEntry(refs, displayName);
    if (!entry) {
      showToast("ChannelFence couldn't identify this creator yet.");
      return false;
    }
    state.blocked = Shared.mergeBlockedEntry(state.blocked, entry);
    rebuildBlockedKeys();
    await chrome.storage.local.set({ [Shared.STORAGE.blocked]: state.blocked });
    showToast(`Blocked ${Shared.labelForEntry(entry)}`, {
      label: "Undo",
      action: () => unblockCreator(entry.aliases)
    });
    scheduleScan();
    return true;
  }

  async function unblockCreator(refs) {
    state.blocked = Shared.removeEntriesMatchingRefs(state.blocked, refs);
    rebuildBlockedKeys();
    await chrome.storage.local.set({ [Shared.STORAGE.blocked]: state.blocked });
    scheduleScan();
  }

  function showToast(message, action) {
    clearTimeout(state.toastTimer);
    document.getElementById("cf-toast")?.remove();

    const toast = document.createElement("div");
    toast.id = "cf-toast";
    toast.setAttribute("role", "status");

    const text = document.createElement("span");
    text.textContent = message;
    toast.append(text);

    if (action) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = action.label;
      button.addEventListener("click", async () => {
        toast.remove();
        await action.action();
      });
      toast.append(button);
    }

    (document.body || document.documentElement).append(toast);
    state.toastTimer = setTimeout(() => toast.remove(), 6000);
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }
    if (changes[Shared.STORAGE.enabled]) {
      state.enabled = changes[Shared.STORAGE.enabled].newValue !== false;
    }
    if (changes[Shared.STORAGE.hideComments]) {
      state.hideComments = changes[Shared.STORAGE.hideComments].newValue !== false;
    }
    if (changes[Shared.STORAGE.blocked]) {
      state.blocked = changes[Shared.STORAGE.blocked].newValue || [];
      rebuildBlockedKeys();
    }
    scheduleScan();
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== "CF_GET_PAGE_CONTEXT") {
      return false;
    }
    const context = currentPageContext();
    sendResponse({
      ok: context.refs.length > 0,
      refs: context.refs,
      displayName: context.displayName,
      blocked: Boolean(matchingEntry(context.refs))
    });
    return false;
  });

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)) {
      scheduleScan();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener("pointerdown", rememberMenuContext, true);
  document.addEventListener("click", rememberMenuContext, true);

  document.addEventListener("yt-navigate-start", () => {
    state.navigationInProgress = true;
    state.pendingMenuContext = null;
    removeOverlay();
    markWatchPending();
  }, true);
  document.addEventListener("yt-navigate-finish", () => {
    state.navigationInProgress = false;
    scheduleScan();
  }, true);
  window.addEventListener("popstate", scheduleScan, true);

  initializeState();
})();
