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

  const OWNER_CHANNEL_ANCHOR_SELECTOR = [
    "a#avatar-link[href]",
    "ytd-channel-name a[href]",
    "#channel-name a[href]",
    "a#author-text[href]",
    "#owner-name a[href]",
    "#channel-info a[href]",
    ".ytLockupMetadataViewModelAvatar a[href]",
    ".ytContentMetadataViewModelMetadataRow:first-child a[href]",
    "yt-content-metadata-view-model .ytContentMetadataViewModelMetadataRow:first-child a[href]"
  ].join(",");

  const LINKLESS_LOCKUP_CREATOR_SELECTOR = [
    ".ytContentMetadataViewModelMetadataRow:first-child .ytContentMetadataViewModelMetadataTextLastPart",
    ".ytContentMetadataViewModelMetadataRow:first-child [role='text']",
    "yt-content-metadata-view-model .ytContentMetadataViewModelMetadataTextLastPart"
  ].join(",");

  const LINKLESS_LOCKUP_AVATAR_SELECTOR =
    ".ytLockupMetadataViewModelAvatar [aria-label^='Go to channel ']";

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

  function requestActionUpdate() {
    chrome.runtime.sendMessage({ type: "CF_SYNC_ACTION" }).catch(() => undefined);
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
        requestActionUpdate();
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

  function channelAnchorsFromElement(root) {
    if (!root || typeof root.querySelectorAll !== "function") {
      return [];
    }

    const normalizedAnchors = (selector) => [...root.querySelectorAll(selector)].filter((anchor) => {
      if (anchor.closest("#cf-hard-block-overlay, #cf-toast")) {
        return false;
      }
      return Boolean(Shared.normalizeChannelRef(
        anchor.href || anchor.getAttribute("href"),
        location.href
      ));
    });

    // Prefer links in known uploader/owner containers. The broad fallback is
    // needed for new YouTube renderers, but can also include @mentions in a
    // description, which must not become aliases of the uploader.
    const ownerAnchors = normalizedAnchors(OWNER_CHANNEL_ANCHOR_SELECTOR);
    return ownerAnchors.length > 0
      ? ownerAnchors
      : normalizedAnchors(CHANNEL_ANCHOR_SELECTOR);
  }

  function displayNameFromAnchor(anchor, ref) {
    const candidates = [
      anchor?.textContent,
      anchor?.getAttribute?.("aria-label"),
      anchor?.getAttribute?.("title"),
      ref?.type === "handle" ? ref.value : ""
    ];
    for (const candidate of candidates) {
      const name = Shared.cleanCreatorDisplayName(candidate);
      if (name) {
        return name;
      }
    }
    return ref?.value || "creator";
  }

  function anchorPlacementScore(anchor) {
    if (!anchor) {
      return 0;
    }
    const hasLayout = anchor.getClientRects().length > 0;
    const hasText = Boolean(Shared.cleanCreatorDisplayName(anchor.textContent));
    return (hasLayout ? 10 : 0) + (hasText ? 2 : 0) +
      (anchor.getAttribute("aria-label") ? 1 : 0);
  }

  function ownerContextsFromElement(root) {
    const contexts = new Map();
    for (const anchor of channelAnchorsFromElement(root)) {
      const ref = Shared.normalizeChannelRef(
        anchor.href || anchor.getAttribute("href"),
        location.href
      );
      if (!ref) {
        continue;
      }

      const displayName = displayNameFromAnchor(anchor, ref);
      const normalizedName = Shared.normalizeCreatorName(displayName);
      const contextKey = normalizedName || ref.key;
      const existing = contexts.get(contextKey);
      if (existing) {
        existing.refs = Shared.uniqueRefs([...existing.refs, ref]);
        if (anchorPlacementScore(anchor) > anchorPlacementScore(existing.anchor)) {
          existing.anchor = anchor;
          existing.displayName = displayName;
        }
        continue;
      }
      contexts.set(contextKey, {
        refs: [ref],
        displayName,
        anchor
      });
    }

    if (contexts.size === 0) {
      for (const name of linklessLockupCreatorNames(root)) {
        const ref = Shared.normalizeCreatorNameRef(name);
        if (ref) {
          contexts.set(ref.key, { refs: [ref], displayName: name, anchor: null });
        }
      }
    }
    return [...contexts.values()];
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

    for (const context of ownerContextsFromElement(root)) {
      refs.push(...context.refs);
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
    for (const context of ownerContextsFromElement(root)) {
      const normalized = Shared.normalizeCreatorName(context.displayName);
      if (normalized) {
        names.add(normalized);
      }
    }

    for (const name of linklessLockupCreatorNames(root)) {
      const normalized = Shared.normalizeCreatorName(name);
      if (normalized) {
        names.add(normalized);
      }
    }
    return [...names];
  }

  function isLockupRoot(root) {
    return Boolean(root?.matches?.(
      "yt-lockup-view-model, .yt-lockup-view-model, .yt-lockup-view-model--wrapper"
    ));
  }

  function linklessLockupCreatorElements(root) {
    if (!isLockupRoot(root) || typeof root.querySelectorAll !== "function") {
      return [];
    }
    const metadata = root.querySelector(LINKLESS_LOCKUP_CREATOR_SELECTOR);
    const avatar = root.querySelector(LINKLESS_LOCKUP_AVATAR_SELECTOR);
    return [metadata, avatar].filter(Boolean);
  }

  function linklessLockupCreatorNames(root) {
    const names = [];
    const seen = new Set();
    for (const element of linklessLockupCreatorElements(root)) {
      const name = Shared.cleanCreatorDisplayName(
        element.textContent || element.getAttribute("aria-label") || element.getAttribute("title")
      );
      const normalized = Shared.normalizeCreatorName(name);
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        names.push(name);
      }
    }
    return names;
  }

  function refsWithNameFallback(refs, displayName) {
    const stableRefs = Shared.uniqueRefs(refs);
    if (stableRefs.length > 0) {
      return stableRefs;
    }
    return Shared.uniqueRefs([Shared.normalizeCreatorNameRef(displayName)]);
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
    const owners = owner ? ownerContextsFromElement(owner) : [];
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
      displayName: displayName || (cleanRefs[0]?.value ?? ""),
      owners: owners.map((context) => ({
        refs: context.refs,
        displayName: context.displayName
      }))
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
    return channelAnchorsFromElement(root)[0] || null;
  }

  function buttonHost(root, pageButton) {
    const anchor = bestAnchor(root);
    if (anchor) {
      return anchor.closest("ytd-channel-name, #channel-name, #owner-name, #author-text") || anchor.parentElement;
    }
    const linklessCreator = linklessLockupCreatorElements(root).find((element) => {
      return Boolean(Shared.cleanCreatorDisplayName(
        element.textContent || element.getAttribute("aria-label")
      ));
    });
    if (linklessCreator) {
      return linklessCreator.closest(".ytContentMetadataViewModelMetadataRow") ||
        linklessCreator.parentElement;
    }
    if (!pageButton) {
      return null;
    }
    return root.querySelector("#channel-name, h1, [class*='page-header-title']") || root;
  }

  function displayNameFromRoot(root, refs) {
    const channelAnchors = channelAnchorsFromElement(root);
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

    const linklessName = linklessLockupCreatorNames(root)[0];
    if (linklessName) {
      return linklessName;
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
    let owners = root ? ownerContextsFromElement(root) : [];

    if (!root && control.closest("ytd-watch-metadata, ytd-video-primary-info-renderer")) {
      const pageContext = currentPageContext();
      const owner = pageOwnerRoot();
      root = owner || control.closest("ytd-watch-metadata, ytd-video-primary-info-renderer");
      refs = pageContext.refs;
      ownerNames = owner ? ownerNamesFromElement(owner) : [];
      displayName = pageContext.displayName;
      owners = owner ? ownerContextsFromElement(owner) : [];
    }

    refs = refsWithNameFallback(refs, displayName);
    if (refs.length === 0) {
      return;
    }
    state.pendingMenuContext = {
      root,
      trigger: control,
      refs,
      ownerNames,
      displayName,
      owners: owners.length > 0
        ? owners.map((context) => ({ refs: context.refs, displayName: context.displayName }))
        : [{ refs, displayName }],
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

  function ensureCreatorMenuItems(popup) {
    if (!state.enabled || !popup || popup.querySelector(".cf-menu-item")) {
      return;
    }
    const context = state.pendingMenuContext;
    if (!context || context.expiresAt < Date.now()) {
      state.pendingMenuContext = null;
      return;
    }

    const host = popup.querySelector("#items, tp-yt-paper-listbox, [role='menu']") || popup;
    const menuTextColor = nativeMenuTextColor(host);
    const owners = context.owners?.length > 0
      ? context.owners
      : [{ refs: context.refs, displayName: context.displayName }];
    const showOwnerName = owners.length > 1;

    for (const owner of owners) {
      const existingEntry = matchingEntry(owner.refs, [owner.displayName]);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cf-menu-item";
      button.setAttribute("role", "menuitem");
      button.setAttribute("aria-label", existingEntry
        ? `Unblock ${owner.displayName} with ChannelFence`
        : `Block ${owner.displayName} with ChannelFence`);
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
        ? `ChannelFence: Unblock${showOwnerName ? ` ${owner.displayName}` : ""}`
        : `ChannelFence: Block${showOwnerName ? ` ${owner.displayName}` : ""}`;
      button.append(symbol, label);

      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        state.pendingMenuContext = null;
        closeCreatorMenu();

        if (existingEntry) {
          await unblockCreator(existingEntry.aliases);
          showToast(`Unblocked ${Shared.labelForEntry(existingEntry)}`);
          return;
        }
        await blockCreator(owner.refs, owner.displayName);
      }, true);

      host.append(button);
    }
  }

  function processCreatorMenus() {
    document.querySelectorAll(MENU_POPUP_SELECTOR).forEach(ensureCreatorMenuItems);
  }

  function buttonsOwnedByRoot(root) {
    return [...root.querySelectorAll(".cf-block-button")].filter((button) => {
      return button.__channelFenceRoot === root;
    });
  }

  function identityKey(refs) {
    return Shared.uniqueRefs(refs).map((ref) => ref.key).sort().join("|");
  }

  function ensureBlockButton(root, pageButton, ownerContext) {
    if (!state.enabled || !root) {
      return;
    }
    const pageContext = pageButton ? currentPageContext() : null;
    const displayName = ownerContext?.displayName ||
      pageContext?.displayName ||
      displayNameFromRoot(root, []);
    const refs = ownerContext?.refs || refsWithNameFallback([
      ...refsFromElement(root),
      ...(pageContext?.refs || [])
    ], displayName);
    if (refs.length === 0) {
      return;
    }
    const key = identityKey(refs);
    const existingButton = buttonsOwnedByRoot(root)
      .find((button) => button.dataset.cfIdentity === key);
    if (existingButton) {
      existingButton.title = `Block ${displayName} with ChannelFence`;
      existingButton.setAttribute("aria-label", `Block ${displayName}`);
      if (ownerContext?.anchor?.isConnected &&
          existingButton.__channelFenceAnchor !== ownerContext.anchor) {
        ownerContext.anchor.insertAdjacentElement("afterend", existingButton);
        existingButton.__channelFenceAnchor = ownerContext.anchor;
      }
      return;
    }

    const host = ownerContext?.anchor?.parentElement || buttonHost(root, pageButton);
    if (!host || host.closest("#cf-hard-block-overlay")) {
      return;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "cf-block-button";
    button.dataset.cfIdentity = key;
    button.__channelFenceRoot = root;
    button.__channelFenceAnchor = ownerContext?.anchor || null;
    button.title = `Block ${displayName} with ChannelFence`;
    button.setAttribute("aria-label", `Block ${displayName}`);

    const symbol = document.createElement("span");
    symbol.className = "cf-block-button__symbol";
    symbol.setAttribute("aria-hidden", "true");
    symbol.textContent = "⊘";
    button.append(symbol);

    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const freshOwners = ownerContextsFromElement(root);
      const freshOwner = ownerContext
        ? freshOwners.find((candidate) => candidate.anchor === ownerContext.anchor) ||
          freshOwners.find((candidate) => candidate.refs.some((ref) =>
            ownerContext.refs.some((previousRef) => previousRef.key === ref.key)))
        : null;
      const freshPageContext = pageButton && !ownerContext ? currentPageContext() : null;
      const freshDisplayName = freshOwner?.displayName ||
        freshPageContext?.displayName ||
        displayNameFromRoot(root, refs);
      const freshRefs = freshOwner?.refs || refsWithNameFallback([
        ...refsFromElement(root),
        ...(freshPageContext?.refs || [])
      ], freshDisplayName);
      await blockCreator(
        freshRefs,
        freshDisplayName
      );
    }, true);

    if (ownerContext?.anchor?.isConnected) {
      ownerContext.anchor.insertAdjacentElement("afterend", button);
    } else {
      host.append(button);
    }
  }

  function ensureOwnerButtons(root, pageButton) {
    const discoveredOwners = ownerContextsFromElement(root);
    const owners = discoveredOwners.filter((context) => {
      if (pageButton || !context.anchor) {
        return true;
      }
      return context.anchor.closest(`${CONTENT_SELECTOR},${COMMENT_SELECTOR}`) === root;
    });
    if (discoveredOwners.length > 0 && owners.length === 0) {
      buttonsOwnedByRoot(root).forEach((button) => button.remove());
      return;
    }
    const contexts = owners.length > 0 ? owners : [null];
    const expectedKeys = new Set(
      contexts.filter(Boolean).map((context) => identityKey(context.refs))
    );

    for (const button of buttonsOwnedByRoot(root)) {
      if (expectedKeys.size > 0 && !expectedKeys.has(button.dataset.cfIdentity)) {
        button.remove();
      }
    }
    for (const context of contexts) {
      ensureBlockButton(root, pageButton, context);
    }
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
    ensureOwnerButtons(item, false);
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
      await unblockCreator(entry.aliases);
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
      ensureOwnerButtons(owner, true);
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
    if (changes[Shared.STORAGE.enabled] || changes[Shared.STORAGE.blocked]) {
      requestActionUpdate();
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
      owners: context.owners,
      blocked: Boolean(matchingEntry(context.refs))
    });
    return false;
  });

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.type === "attributes" ||
        mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)) {
      scheduleScan();
    }
  });
  observer.observe(document.documentElement, {
    attributeFilter: ["href"],
    attributes: true,
    childList: true,
    subtree: true
  });

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
  document.addEventListener("yt-page-data-updated", scheduleScan, true);
  document.addEventListener("yt-rendererstamper-finished", scheduleScan, true);
  window.addEventListener("popstate", scheduleScan, true);

  initializeState();
})();
