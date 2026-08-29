(function initializeChannelFenceContent() {
  "use strict";

  const Shared = globalThis.ChannelFenceShared;
  if (!Shared || globalThis.__channelFenceLoaded) {
    return;
  }
  globalThis.__channelFenceLoaded = true;

  const SHORTS_IDENTITY_MAX_SETTLE_MS = 4500;
  const BLOCKED_SHORT_CONTROL_WAIT_MS = 3000;
  const BLOCKED_SHORT_RETRY_MS = 250;
  const BLOCKED_SHORT_MAX_WAIT_MS = 10000;

  const CONTENT_SELECTOR = [
    "ytd-rich-item-renderer",
    "ytd-video-renderer",
    "ytd-grid-video-renderer",
    "ytd-compact-video-renderer",
    "ytd-playlist-video-renderer",
    "ytd-playlist-panel-video-renderer",
    "ytd-reel-item-renderer",
    "ytd-reel-video-renderer",
    "ytm-shorts-lockup-view-model",
    "ytm-shorts-lockup-view-model-v2",
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

  const PROMOTED_CONTENT_SELECTOR = [
    "ytd-ad-slot-renderer",
    "ytd-in-feed-ad-layout-renderer",
    "ytd-promoted-video-renderer",
    "ytd-display-ad-renderer",
    "ytd-banner-promo-renderer"
  ].join(",");

  const SHORTS_SHELF_SELECTOR = [
    "ytd-reel-shelf-renderer",
    "ytd-rich-shelf-renderer[is-shorts]",
    "yt-horizontal-list-renderer[is-shorts]",
    "grid-shelf-view-model"
  ].join(",");

  const SHORTS_CARD_SELECTOR = [
    "ytd-reel-item-renderer",
    "ytm-shorts-lockup-view-model",
    "ytm-shorts-lockup-view-model-v2",
    "ytd-rich-item-renderer",
    "ytd-video-renderer",
    "ytd-grid-video-renderer",
    "ytd-compact-video-renderer",
    "yt-lockup-view-model",
    ".yt-lockup-view-model",
    ".yt-lockup-view-model--wrapper",
    "ytm-video-with-context-renderer",
    "ytm-compact-video-renderer"
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

  const LINKLESS_LOCKUP_CREATOR_ROW_SELECTOR =
    ".ytContentMetadataViewModelMetadataRow:first-child";

  const LINKLESS_LOCKUP_AVATAR_SELECTOR =
    ".ytLockupMetadataViewModelAvatar [aria-label^='Go to channel ']";

  const COMPACT_SHORTS_SELECTOR =
    "ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2";

  const PAGE_OWNER_SELECTORS = [
    "ytd-shorts ytd-reel-video-renderer",
    "ytd-shorts yt-reel-channel-bar-view-model",
    "yt-reel-channel-bar-view-model",
    "yt-page-header-renderer",
    "ytd-c4-tabbed-header-renderer #channel-header-container",
    "ytd-watch-metadata #owner",
    "ytd-video-owner-renderer",
    "ytd-channel-name#channel-name",
    "ytd-reel-video-renderer[is-active]",
    "ytm-slim-owner-renderer"
  ];

  const PAGE_OWNER_SELECTOR = PAGE_OWNER_SELECTORS.join(",");
  const CHANNEL_PAGE_HEADER_SELECTOR = [
    "yt-page-header-renderer",
    "ytd-c4-tabbed-header-renderer #channel-header-container"
  ].join(",");
  const MUTATION_ROOT_SELECTOR = [
    CONTENT_SELECTOR,
    COMMENT_SELECTOR,
    MENU_POPUP_SELECTOR
  ].join(",");
  const SHORTS_VISIBILITY_SELECTOR = [
    SHORTS_SHELF_SELECTOR,
    SHORTS_CARD_SELECTOR,
    "ytd-rich-section-renderer",
    ".cf-hidden-shorts-by-channelfence"
  ].join(",");

  const state = {
    enabled: true,
    hideComments: true,
    hideHomeShorts: false,
    blocked: [],
    blockedLookup: Shared.createBlockedLookup([]),
    channelPageIdentity: null,
    currentUrl: location.href,
    scanScheduled: false,
    scanWhenVisible: false,
    mutationScanScheduled: false,
    mutationRoots: new Set(),
    mutationShortsRoots: new Set(),
    mutationRouteDirty: false,
    menuScanScheduled: false,
    navigationInProgress: false,
    pendingMenuContext: null,
    pendingTimer: null,
    blockedShortSkipKey: "",
    blockedShortSkipTimer: null,
    blockedShortAdvanceAttempted: false,
    blockedShortScrollAttempted: false,
    blockedShortFailedOpenKey: "",
    shortsRouteSettleUntil: 0,
    shortsRouteSettleTimer: null,
    shortsRoutePreviousOwnerKeys: [],
    shortsStableOwnerKeys: [],
    shortsStableRenderer: null,
    shortsRouteRenderer: null,
    shortsOwnerMutationVersions: new WeakMap(),
    shortsRouteOwnerMutationVersion: 0,
    shortsUnresolvedRouteIdentity: "",
    shortsUnresolvedOwnerKeys: [],
    compactShortContexts: new Map(),
    compactShortLookups: new Map(),
    compactShortFailures: new Map(),
    toastTimer: null
  };

  function isShortsRoute() {
    return location.pathname === "/shorts" || location.pathname.startsWith("/shorts/");
  }

  function isWatchLikeRoute() {
    return location.pathname === "/watch" || isShortsRoute();
  }

  function routeHasCurrentCreator() {
    return isWatchLikeRoute() || Boolean(Shared.normalizeChannelRef(location.href));
  }

  function markWatchPending() {
    clearTimeout(state.pendingTimer);
    if (!state.enabled || state.blocked.length === 0 || !isWatchLikeRoute()) {
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
    state.pendingTimer = null;
    document.documentElement.classList.remove("cf-watch-pending");
  }

  function holdWatchPending() {
    clearTimeout(state.pendingTimer);
    state.pendingTimer = null;
    document.documentElement.classList.add("cf-watch-pending");
  }

  function rebuildBlockedLookup() {
    state.blockedLookup = Shared.createBlockedLookup(state.blocked);
    state.blocked = state.blockedLookup.entries;
  }

  function blockedListsEqual(left, right) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false;
    }
    const arraysEqual = (first, second) => {
      if (!Array.isArray(first) || !Array.isArray(second) || first.length !== second.length) {
        return false;
      }
      return first.every((value, index) => value === second[index]);
    };
    return left.every((entry, index) => {
      const candidate = right[index];
      return Boolean(candidate &&
        entry.key === candidate.key &&
        entry.displayName === candidate.displayName &&
        entry.url === candidate.url &&
        entry.blockedAt === candidate.blockedAt &&
        arraysEqual(entry.aliases, candidate.aliases) &&
        arraysEqual(entry.nameAliases, candidate.nameAliases) &&
        arraysEqual(entry.shortPaths, candidate.shortPaths));
    });
  }

  function requestActionUpdate() {
    chrome.runtime.sendMessage({ type: "CF_SYNC_ACTION" }).catch(() => undefined);
  }

  async function loadState() {
    const values = await chrome.storage.local.get(Object.keys(Shared.DEFAULTS));
    state.enabled = values[Shared.STORAGE.enabled] !== false;
    state.hideComments = values[Shared.STORAGE.hideComments] !== false;
    state.hideHomeShorts = values[Shared.STORAGE.hideHomeShorts] === true;
    const storedBlocked = values[Shared.STORAGE.blocked] || [];
    state.blocked = storedBlocked;
    rebuildBlockedLookup();
    if (!blockedListsEqual(storedBlocked, state.blocked)) {
      await chrome.storage.local.set({ [Shared.STORAGE.blocked]: state.blocked });
    }
  }

  async function initializeState() {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await loadState();
        markWatchPending();
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

  function refsFromElement(root, knownOwnerContexts) {
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

    const ownerContexts = knownOwnerContexts ?? ownerContextsFromElement(root);
    for (const context of ownerContexts) {
      refs.push(...context.refs);
      if (refs.length >= 8) {
        break;
      }
    }
    return Shared.uniqueRefs(refs);
  }

  function ownerNamesFromElement(root, knownOwnerContexts) {
    if (!root || typeof root.querySelectorAll !== "function") {
      return [];
    }

    const names = new Set();
    const ownerContexts = knownOwnerContexts ?? ownerContextsFromElement(root);
    for (const context of ownerContexts) {
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

    for (const name of collaborationNamesFromElement(root)) {
      const normalized = Shared.normalizeCreatorName(name);
      if (normalized) {
        names.add(normalized);
      }
    }
    return [...names];
  }

  function collaborationNamesFromElement(root) {
    if (!root?.querySelector?.(
      "yt-avatar-stack-view-model[aria-label*='Collaboration' i]"
    )) {
      return [];
    }

    const label = [...root.querySelectorAll("#attributed-channel-name")]
      .map((element) => Shared.cleanCreatorDisplayName(element.textContent))
      .find((name) => /\s(?:and|&)\s|,/.test(name));
    if (!label) {
      return [];
    }

    return label
      .split(/\s+(?:and|&)\s+|,\s*/i)
      .map((name) => Shared.cleanCreatorDisplayName(name))
      .filter(Boolean)
      .slice(0, 8);
  }

  function linklessCollaborationNames(root, ownerContexts) {
    const remaining = collaborationNamesFromElement(root).map((displayName) => ({
      displayName,
      normalizedName: Shared.normalizeCreatorName(displayName)
    }));
    if (remaining.length === 0) {
      return [];
    }

    const stableOwners = (Array.isArray(ownerContexts) ? ownerContexts : [])
      .filter((owner) => owner.refs?.some((ref) => ref.type !== "name"));
    for (const owner of stableOwners) {
      const normalizedOwnerName = Shared.normalizeCreatorName(owner.displayName);
      const matchIndex = remaining.findIndex(
        (candidate) => candidate.normalizedName === normalizedOwnerName
      );
      if (!normalizedOwnerName || matchIndex === -1) {
        // If the linked owners cannot be reconciled with the explicit
        // collaboration label, guessing could block an unrelated same-named
        // channel. Stable identity wins, so fail open for name-only owners.
        return [];
      }
      remaining.splice(matchIndex, 1);
    }
    return remaining.map((candidate) => candidate.displayName);
  }

  function isLockupRoot(root) {
    return Boolean(root?.matches?.(
      "yt-lockup-view-model, .yt-lockup-view-model, .yt-lockup-view-model--wrapper"
    ));
  }

  function isHiddenWithin(root, element) {
    for (let current = element; current && current !== root; current = current.parentElement) {
      const style = getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden") {
        return true;
      }
    }
    return false;
  }

  function linklessLockupCreatorElements(root) {
    if (!isLockupRoot(root) || typeof root.querySelectorAll !== "function") {
      return [];
    }
    const placementScore = (element) => Math.max(
      elementVisibilityScore(element),
      elementVisibilityScore(element.closest(
        ".ytLockupMetadataViewModelAvatar, .ytContentMetadataViewModelMetadataRow"
      ))
    );
    const avatar = [...root.querySelectorAll(LINKLESS_LOCKUP_AVATAR_SELECTOR)]
      .filter((candidate) =>
        cleanLinklessLockupCreatorName(linklessLockupCreatorLabel(candidate)))
      .sort((left, right) => {
        const hiddenDifference = Number(isHiddenWithin(root, left)) -
          Number(isHiddenWithin(root, right));
        return hiddenDifference || placementScore(right) - placementScore(left);
      })[0];
    if (avatar) {
      // Modern lockups expose the creator through an accessibility-only avatar.
      // That signal is authoritative. Parsing the metadata row as well would turn
      // its view count and upload age into additional, bogus creators.
      return [avatar];
    }

    // Treat a metadata row atomically. YouTube splits one row into FirstPart,
    // LastPart, and role=text fragments; reading every fragment independently is
    // what previously produced three controls from "11 views · 16 hours ago".
    const rows = [...root.querySelectorAll(LINKLESS_LOCKUP_CREATOR_ROW_SELECTOR)]
      .filter((row) => !isHiddenWithin(root, row) &&
        cleanLinklessLockupCreatorName(linklessLockupCreatorLabel(row)))
      .sort((left, right) => placementScore(right) - placementScore(left));
    return rows.slice(0, 1);
  }

  function cleanLinklessLockupCreatorName(value) {
    const name = Shared.cleanCreatorDisplayName(value)
      .replace(/\s+[·•]\s*(?:course|playlist|podcast)\s*$/i, "")
      .trim();
    if (!name || /^(?:course|playlist|podcast|view full course|\d+\s+lessons?)$/i.test(name)) {
      return "";
    }
    const metadataOnly = [
      /(?:^|\s)(?:no|\d[\d,.]*\s*[KMBT]?)\s+views?\b/i,
      /\b\d+\s+(?:seconds?|minutes?|hours?|days?|weeks?|months?|years?)\s+ago\b/i,
      /^(?:streamed|premiered|scheduled)\b/i,
      /(?:^|\s)\d[\d,.]*\s*[KMBT]?\s+subscribers?\b/i,
      /^(?:new|live|members only|4k|8k|cc)$/i,
      /^(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2},?\s+\d{4}$/i
    ].some((pattern) => pattern.test(name));
    if (metadataOnly) {
      return "";
    }
    return name;
  }

  function linklessLockupCreatorLabel(element) {
    const accessibilityLabel = element.getAttribute("aria-label") || element.getAttribute("title");
    if (accessibilityLabel) {
      return accessibilityLabel;
    }
    const copy = element.cloneNode(true);
    copy.querySelectorAll?.(".cf-block-button, .cf-shorts-action, .cf-menu-item")
      .forEach((control) => control.remove());
    return copy.textContent || "";
  }

  function linklessLockupCreatorNames(root) {
    const names = [];
    const seen = new Set();
    for (const element of linklessLockupCreatorElements(root)) {
      const name = cleanLinklessLockupCreatorName(linklessLockupCreatorLabel(element));
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

  function elementVisibilityScore(element) {
    if (!element || typeof element.getBoundingClientRect !== "function") {
      return 0;
    }
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") {
      return -1;
    }

    const rect = element.getBoundingClientRect();
    const hasArea = rect.width > 0 && rect.height > 0;
    const inViewport = hasArea && rect.bottom > 0 && rect.right > 0 &&
      rect.top < innerHeight && rect.left < innerWidth;
    return (hasArea ? 10 : 0) + (inViewport ? 20 : 0) +
      (element.hasAttribute("is-active") ? 8 : 0);
  }

  function shortsVideoIdFromPath(pathname) {
    const match = String(pathname || "").match(/^\/shorts\/([^/?#]+)/);
    return match ? match[1] : "";
  }

  function shortsVideoIdFromUrl(value) {
    if (!value) {
      return "";
    }
    try {
      return shortsVideoIdFromPath(new URL(value, location.href).pathname);
    } catch {
      return "";
    }
  }

  function shortsRouteIdentityFromUrl(value) {
    if (!value) {
      return "";
    }
    try {
      const pathname = new URL(value, location.href).pathname;
      const videoId = shortsVideoIdFromPath(pathname);
      if (videoId) {
        return `short:${videoId}`;
      }
      return pathname === "/shorts" || pathname === "/shorts/"
        ? "shorts:index"
        : "";
    } catch {
      return "";
    }
  }

  function currentShortsRouteIdentity() {
    return shortsRouteIdentityFromUrl(location.href);
  }

  function shortsRendererVideoId(renderer) {
    for (const anchor of renderer?.querySelectorAll?.("a[href]") || []) {
      const videoId = shortsVideoIdFromUrl(anchor.href || anchor.getAttribute("href"));
      if (videoId) {
        return videoId;
      }
    }
    return "";
  }

  function shortsRendererMatchesRoute(renderer = currentShortsRenderer()) {
    if (!renderer) {
      return false;
    }
    const routeVideoId = shortsVideoIdFromPath(location.pathname);
    return !routeVideoId || shortsRendererVideoId(renderer) === routeVideoId;
  }

  function currentShortsRenderer() {
    if (!isShortsRoute()) {
      return null;
    }

    const scroller = document.querySelector("ytd-shorts #shorts-container");
    const scrollerRect = scroller?.getBoundingClientRect();
    const viewportCenter = scrollerRect && scrollerRect.height > 0
      ? scrollerRect.top + (scrollerRect.height / 2)
      : innerHeight / 2;
    const renderers = [...document.querySelectorAll(
      "ytd-shorts ytd-reel-video-renderer"
    )].filter((renderer) => {
      const style = getComputedStyle(renderer);
      return style.display !== "none" && style.visibility !== "hidden";
    });
    const viewportTop = scrollerRect?.top ?? 0;
    const viewportBottom = scrollerRect?.bottom ?? innerHeight;
    const visibleRenderers = renderers.filter((renderer) => {
      const rect = renderer.getBoundingClientRect();
      return rect.width > 0 && Math.min(rect.bottom, viewportBottom) >
        Math.max(rect.top, viewportTop);
    });
    const candidates = visibleRenderers.length > 0 ? visibleRenderers : renderers;
    const routeVideoId = shortsVideoIdFromPath(location.pathname);
    let best = null;
    let bestScore = -Infinity;

    for (const renderer of candidates) {
      const rect = renderer.getBoundingClientRect();
      const visibleHeight = Math.max(
        0,
        Math.min(rect.bottom, viewportBottom) - Math.max(rect.top, viewportTop)
      );
      const centerDistance = Math.abs(((rect.top + rect.bottom) / 2) - viewportCenter);
      const routeMatches = routeVideoId && shortsRendererVideoId(renderer) === routeVideoId;
      const score = (routeMatches ? 1_000_000_000 : 0) +
        (visibleHeight * 100) - centerDistance +
        (renderer.hasAttribute("is-active") ? 10 : 0);
      if (score > bestScore) {
        best = renderer;
        bestScore = score;
      }
    }

    return best;
  }

  function currentShortsDomOwnerKeys(renderer = currentShortsRenderer()) {
    if (!renderer) {
      return [];
    }
    return refsFromElement(renderer)
      .map((ref) => ref.key)
      .sort();
  }

  function shortsOwnerMutationVersion(renderer) {
    return renderer ? (state.shortsOwnerMutationVersions.get(renderer) || 0) : 0;
  }

  function sameStringKeys(left, right) {
    return left.length === right.length && left.every((key, index) => key === right[index]);
  }

  function rememberCurrentShortsOwner() {
    if (!isShortsRoute()) {
      state.shortsStableOwnerKeys = [];
      state.shortsStableRenderer = null;
      return;
    }
    const renderer = currentShortsRenderer();
    const keys = currentShortsDomOwnerKeys(renderer);
    if (keys.length > 0) {
      state.shortsStableOwnerKeys = keys;
      state.shortsStableRenderer = renderer;
    }
  }

  function pageOwnerRoot() {
    const shortsRenderer = currentShortsRenderer();
    if (shortsRenderer) {
      return shortsRenderer;
    }

    let best = null;
    let bestScore = -Infinity;
    PAGE_OWNER_SELECTORS.forEach((selector, selectorIndex) => {
      for (const candidate of document.querySelectorAll(selector)) {
        const hasIdentity = refsFromElement(candidate).length > 0 ||
          Boolean(Shared.cleanCreatorDisplayName(candidate.textContent));
        if (!hasIdentity) {
          continue;
        }
        const score = (elementVisibilityScore(candidate) * 100) - selectorIndex;
        if (score > bestScore) {
          best = candidate;
          bestScore = score;
        }
      }
    });
    return best;
  }

  function channelPageHeaderForRoute(routeRef) {
    const headers = [...document.querySelectorAll(CHANNEL_PAGE_HEADER_SELECTOR)]
      .filter((header) => header.isConnected)
      .sort((left, right) => elementVisibilityScore(right) - elementVisibilityScore(left));
    if (!routeRef) {
      return headers[0] || null;
    }
    return headers.find((header) => channelPageAnchorForRoute(header, routeRef)) ||
      headers[0] ||
      null;
  }

  function channelPageAnchorForRoute(root, routeRef) {
    if (!root || !routeRef) {
      return null;
    }
    return [...root.querySelectorAll("a[href]")]
      .filter((anchor) => {
        const ref = Shared.normalizeChannelRef(
          anchor.href || anchor.getAttribute("href"),
          location.href
        );
        return ref?.key === routeRef.key && !isHiddenWithin(root, anchor);
      })
      .sort((left, right) => anchorPlacementScore(right) - anchorPlacementScore(left))[0] ||
      null;
  }

  function channelPageTitleElement(root) {
    if (!root) {
      return null;
    }
    const selectors = [
      "h1.dynamicTextViewModelH1",
      ".ytPageHeaderViewModelTitle",
      "h1",
      "#channel-name",
      "[class*='page-header-title']"
    ];
    for (const selector of selectors) {
      const candidates = [...root.querySelectorAll(selector)]
        .filter((element) => !isHiddenWithin(root, element))
        .sort((left, right) => elementVisibilityScore(right) - elementVisibilityScore(left));
      const title = candidates.find((element) =>
        Shared.cleanCreatorDisplayName(element.textContent));
      if (title) {
        return title;
      }
    }
    return null;
  }

  function channelMetadataMatchesRoute(routeRef) {
    if (!routeRef) {
      return false;
    }
    const identityUrls = [
      document.querySelector("link[rel='canonical'][href]")?.getAttribute("href"),
      document.querySelector("meta[property='og:url'][content]")?.getAttribute("content")
    ];
    return identityUrls.some((value) => {
      const ref = Shared.normalizeChannelRef(value || "", location.href);
      return ref?.key === routeRef.key;
    });
  }

  function channelPageDisplayName(routeRef, header) {
    const title = channelPageTitleElement(header);
    if (title) {
      return Shared.cleanCreatorDisplayName(title.textContent);
    }
    if (channelMetadataMatchesRoute(routeRef)) {
      const metadataTitle = [
        document.querySelector("meta[property='og:title'][content]")?.getAttribute("content"),
        document.querySelector("meta[name='twitter:title'][content]")?.getAttribute("content"),
        document.querySelector("meta[itemprop='name'][content]")?.getAttribute("content")
      ].map((value) => Shared.cleanCreatorDisplayName(value)).find(Boolean);
      if (metadataTitle) {
        return metadataTitle;
      }
    }
    return routeRef?.value || "creator";
  }

  function channelPageContext(routeRef) {
    const header = channelPageHeaderForRoute(routeRef);
    const refs = Shared.uniqueRefs([
      routeRef,
      ...(channelMetadataMatchesRoute(routeRef) ? metadataRefs() : [])
    ]);
    const displayName = channelPageDisplayName(routeRef, header);
    const owner = { refs, displayName };
    return {
      refs,
      displayName,
      owners: [owner]
    };
  }

  function currentPageContext() {
    if (!routeHasCurrentCreator()) {
      return { refs: [], displayName: "", owners: [] };
    }

    const channelRouteRef = Shared.normalizeChannelRef(location.href);
    if (channelRouteRef) {
      // A direct channel URL is the authoritative identity. Modern YouTube
      // headers can contain unrelated, hidden channel links (for example its
      // "Community" product link), so never merge every header anchor here.
      return channelPageContext(channelRouteRef);
    }

    const owner = pageOwnerRoot();
    let owners = owner ? ownerContextsFromElement(owner) : [];
    let ownerRefs = owner ? refsFromElement(owner, owners) : [];
    const shortsRouteIdentity = currentShortsRouteIdentity();
    if (isShortsRoute() &&
      state.shortsUnresolvedRouteIdentity === shortsRouteIdentity) {
      const ownerKeys = ownerRefs.map((ref) => ref.key).sort();
      const ownerChanged = ownerKeys.length > 0 && (
        state.shortsUnresolvedOwnerKeys.length === 0 ||
        !sameStringKeys(ownerKeys, state.shortsUnresolvedOwnerKeys)
      );
      const rendererChanged = Boolean(owner && state.shortsStableRenderer &&
        owner !== state.shortsStableRenderer);
      const ownerRerendered = owner === state.shortsRouteRenderer &&
        shortsOwnerMutationVersion(owner) > state.shortsRouteOwnerMutationVersion;
      if (shortsRendererMatchesRoute(owner) &&
        (ownerChanged || rendererChanged || ownerRerendered)) {
        state.shortsUnresolvedRouteIdentity = "";
        state.shortsUnresolvedOwnerKeys = [];
      } else {
        owners = [];
        ownerRefs = [];
      }
    }
    const refs = [];
    if (isShortsRoute()) {
      // Shorts reuses renderers while navigating. Once a current renderer exists,
      // its owner is authoritative; page metadata can still belong to the prior Short.
      if (ownerRefs.length > 0) {
        refs.push(...ownerRefs);
      } else if (!owner &&
        state.shortsUnresolvedRouteIdentity !== shortsRouteIdentity) {
        refs.push(...metadataRefs());
      }
    } else {
      refs.push(...metadataRefs(), ...ownerRefs);
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
    let displayName = owners[0]?.displayName || "";
    if (!isShortsRoute()) {
      for (const selector of nameSelectors) {
        if (displayName) {
          break;
        }
        displayName = Shared.cleanDisplayName(document.querySelector(selector)?.textContent);
        if (displayName) {
          break;
        }
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
    return Shared.findMatchingEntryInLookup(state.blockedLookup, refs, ownerNames);
  }

  function repairCanonicalChannelEntryLabel(entry, context) {
    const detectedTitle = Shared.cleanCreatorDisplayName(context?.displayName);
    if (!entry || !detectedTitle) {
      return entry;
    }
    const index = state.blocked.findIndex((candidate) => candidate.key === entry.key);
    if (index === -1) {
      return entry;
    }
    const repaired = Shared.createBlockedEntry(
      state.blocked[index].aliases,
      detectedTitle,
      state.blocked[index].blockedAt,
      state.blocked[index].shortPaths,
      []
    );
    if (!repaired || blockedListsEqual([state.blocked[index]], [repaired])) {
      return entry;
    }

    state.blocked = state.blocked.map((candidate, candidateIndex) =>
      candidateIndex === index ? repaired : candidate);
    rebuildBlockedLookup();
    chrome.storage.local.set({ [Shared.STORAGE.blocked]: state.blocked })
      .catch(() => undefined);
    return matchingEntry(context.refs) || repaired;
  }

  function refreshChannelPageIdentity() {
    const routeRef = Shared.normalizeChannelRef(location.href);
    if (!routeRef) {
      state.channelPageIdentity = null;
      return;
    }

    const context = channelPageContext(routeRef);
    const name = Shared.normalizeCreatorName(context.displayName);

    state.channelPageIdentity = {
      stableKeys: new Set(context.refs
        .filter((ref) => ref.type !== "name")
        .map((ref) => ref.key)),
      names: new Set(name ? [name] : [])
    };
  }

  function ownerBelongsToCurrentChannel(ownerContext) {
    const pageIdentity = state.channelPageIdentity;
    if (!pageIdentity || !ownerContext) {
      return false;
    }
    const refs = Shared.uniqueRefs(ownerContext.refs);
    const stableRefs = refs.filter((ref) => ref.type !== "name");
    if (stableRefs.length > 0) {
      return stableRefs.every((ref) => pageIdentity.stableKeys.has(ref.key));
    }
    const ownerName = Shared.normalizeCreatorName(ownerContext.displayName);
    return Boolean(ownerName && pageIdentity.names.has(ownerName));
  }

  function bestAnchor(root) {
    if (!root) {
      return null;
    }
    return channelAnchorsFromElement(root)[0] || null;
  }

  function buttonHost(root, pageButton) {
    if (pageButton && Shared.normalizeChannelRef(location.href)) {
      const title = channelPageTitleElement(root);
      return title?.parentElement || title || root;
    }
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
      const identityHost = linklessCreator.closest(
        ".ytContentMetadataViewModelMetadataRow, .ytLockupMetadataViewModelAvatar"
      ) || linklessCreator.parentElement;
      if (identityHost && !isHiddenWithin(root, identityHost)) {
        return identityHost;
      }

      // Accessibility-only creator avatars can live in a hidden legacy copy.
      // Keep their identity, but place the control in the visible metadata row.
      const visibleRow = [...root.querySelectorAll(LINKLESS_LOCKUP_CREATOR_ROW_SELECTOR)]
        .filter((row) => !isHiddenWithin(root, row))
        .sort((left, right) => elementVisibilityScore(right) - elementVisibilityScore(left))[0];
      if (visibleRow) {
        return visibleRow;
      }
      return null;
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
    const isShortsControl = Boolean(control.closest(
      "ytd-reel-video-renderer, yt-reel-player-overlay-view-model, reel-action-bar-view-model"
    ));
    return Boolean(control.closest("ytd-menu-renderer, yt-menu-renderer")) ||
      /action menu|more actions/i.test(label) ||
      (isShortsControl && /^more$/i.test(label.trim()));
  }

  function isPromotedContentRoot(root) {
    if (!root) {
      return false;
    }
    return Boolean(
      root.matches?.(PROMOTED_CONTENT_SELECTOR) ||
      root.closest?.(PROMOTED_CONTENT_SELECTOR) ||
      root.querySelector?.(PROMOTED_CONTENT_SELECTOR)
    );
  }

  function compactShortPath(root) {
    const value = root?.querySelector?.("a[href^='/shorts/']")?.getAttribute("href") || "";
    try {
      const path = new URL(value, location.href).pathname;
      return path.startsWith("/shorts/") ? path : "";
    } catch {
      return "";
    }
  }

  function compactShortLayoutItem(root) {
    return root?.closest?.(".ytGridShelfViewModelGridShelfItem") || root;
  }

  function reflowCompactShortShelf(root) {
    const shelf = root?.closest?.("grid-shelf-view-model");
    if (!shelf) {
      return;
    }
    const rows = [...shelf.querySelectorAll(".ytGridShelfViewModelGridShelfRow")];
    const items = rows.flatMap((row) => [...row.children].filter((child) =>
      child.classList.contains("ytGridShelfViewModelGridShelfItem")));
    if (rows.length === 0 || items.length === 0) {
      return;
    }

    if (!Number.isInteger(shelf.__channelFenceRowCapacity)) {
      shelf.__channelFenceRowCapacity = Math.max(...rows.map((row) => row.children.length), 1);
      shelf.__channelFenceNextOrder = 0;
    }
    for (const item of items) {
      if (!Number.isInteger(item.__channelFenceGridOrder)) {
        item.__channelFenceGridOrder = shelf.__channelFenceNextOrder;
        shelf.__channelFenceNextOrder += 1;
      }
    }

    const byOriginalOrder = (left, right) =>
      left.__channelFenceGridOrder - right.__channelFenceGridOrder;
    const visible = items.filter((item) =>
      !item.classList.contains("cf-hidden-by-channelfence")).sort(byOriginalOrder);
    const hidden = items.filter((item) =>
      item.classList.contains("cf-hidden-by-channelfence")).sort(byOriginalOrder);
    const ordered = [...visible, ...hidden];
    const capacity = shelf.__channelFenceRowCapacity;

    rows.forEach((row) => {
      row.classList.toggle("cf-compact-short-row-reflow", hidden.length > 0);
    });

    rows.forEach((row, rowIndex) => {
      const start = rowIndex * capacity;
      const end = rowIndex === rows.length - 1 ? ordered.length : start + capacity;
      const desired = ordered.slice(start, end);
      const current = [...row.children].filter((child) =>
        child.classList.contains("ytGridShelfViewModelGridShelfItem"));
      if (current.length === desired.length &&
        current.every((item, index) => item === desired[index])) {
        return;
      }
      desired.forEach((item) => row.append(item));
    });
  }

  function setCompactShortPending(root, pending) {
    compactShortLayoutItem(root)?.classList.toggle("cf-compact-short-pending", pending);
  }

  function setCompactShortHidden(root, hidden) {
    const target = compactShortLayoutItem(root);
    if (!target) {
      return;
    }
    root.classList.remove("cf-hidden-by-channelfence");
    target.classList.toggle("cf-hidden-by-channelfence", hidden);
    target.classList.remove("cf-compact-short-pending");
    reflowCompactShortShelf(target);
  }

  async function resolveCompactShortContext(path) {
    const cached = state.compactShortContexts.get(path);
    if (cached) {
      return cached;
    }
    const failedAt = state.compactShortFailures.get(path);
    if (failedAt && Date.now() - failedAt < 300000) {
      return null;
    }
    const activeLookup = state.compactShortLookups.get(path);
    if (activeLookup) {
      return activeLookup;
    }

    const lookup = (async () => {
      try {
        const endpoint = new URL("/oembed", location.origin);
        endpoint.searchParams.set("url", new URL(path, location.origin).href);
        endpoint.searchParams.set("format", "json");
        const response = await fetch(endpoint, {
          cache: "force-cache",
          credentials: "omit"
        });
        if (!response.ok) {
          throw new Error(`YouTube metadata request failed with ${response.status}`);
        }
        const metadata = await response.json();
        const displayName = Shared.cleanCreatorDisplayName(metadata?.author_name);
        const channelRef = Shared.normalizeChannelRef(metadata?.author_url);
        const refs = refsWithNameFallback(channelRef ? [channelRef] : [], displayName);
        if (!displayName || refs.length === 0) {
          throw new Error("YouTube metadata did not include a creator");
        }
        const context = { refs, displayName };
        state.compactShortContexts.set(path, context);
        state.compactShortFailures.delete(path);
        return context;
      } catch {
        state.compactShortFailures.set(path, Date.now());
        return null;
      } finally {
        state.compactShortLookups.delete(path);
      }
    })();
    state.compactShortLookups.set(path, lookup);
    return lookup;
  }

  function inspectCompactShortCreator(root) {
    const path = compactShortPath(root);
    if (!path || state.blocked.length === 0 || state.compactShortContexts.has(path)) {
      return;
    }
    const failedAt = state.compactShortFailures.get(path);
    if (failedAt && Date.now() - failedAt < 300000) {
      setCompactShortPending(root, false);
      return;
    }
    if (root.querySelector(COMPACT_SHORTS_SELECTOR)) {
      return;
    }
    setCompactShortPending(root, true);
    resolveCompactShortContext(path).finally(() => {
      setCompactShortPending(root, false);
      scheduleMutationElement(root);
    });
  }

  async function blockCompactShortCreator(root) {
    const path = compactShortPath(root);
    if (!path) {
      showToast("ChannelFence couldn't identify this Short.");
      return;
    }
    const buttons = buttonsOwnedByRoot(root);
    buttons.forEach((button) => {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
    });

    try {
      state.compactShortFailures.delete(path);
      const context = await resolveCompactShortContext(path);
      if (!context) {
        throw new Error("YouTube metadata did not include a creator");
      }

      if (!await blockCreator(context.refs, context.displayName, path)) {
        state.compactShortContexts.delete(path);
      }
    } catch {
      showToast("ChannelFence couldn't identify this creator. Try opening the Short first.");
    } finally {
      buttons.forEach((button) => {
        if (button.isConnected) {
          button.disabled = false;
          button.removeAttribute("aria-busy");
        }
      });
    }
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
    if (isPromotedContentRoot(root)) {
      state.pendingMenuContext = null;
      scheduleMenuScan();
      return;
    }
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

    const deferredShort = Boolean(root?.matches?.(COMPACT_SHORTS_SELECTOR) &&
      compactShortPath(root) && refs.length === 0);
    if (deferredShort) {
      state.pendingMenuContext = {
        root,
        trigger: control,
        refs: [],
        ownerNames: [],
        displayName: "Shorts creator",
        owners: [],
        deferredShort: true,
        expiresAt: Date.now() + 5000
      };
      scheduleMenuScan();
      return;
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
    scheduleMenuScan();
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

  function creatorMenuContextKey(context) {
    if (context.deferredShort) {
      return `short:${compactShortPath(context.root)}`;
    }
    const owners = context.owners?.length > 0
      ? context.owners
      : [{ refs: context.refs, displayName: context.displayName }];
    return owners.map((owner) => {
      const blocked = matchingEntry(owner.refs, [owner.displayName]) ? "blocked" : "open";
      return `${identityKey(owner.refs)}:${blocked}`;
    }).join("|");
  }

  function ensureCreatorMenuItems(popup) {
    if (!popup) {
      return;
    }
    const context = state.pendingMenuContext;
    if (!state.enabled || !context || context.expiresAt < Date.now()) {
      popup.querySelectorAll(".cf-menu-item").forEach((item) => item.remove());
      delete popup.dataset.cfMenuContextKey;
      state.pendingMenuContext = null;
      return;
    }

    const contextKey = creatorMenuContextKey(context);
    const existingItems = popup.querySelectorAll(".cf-menu-item");
    if (existingItems.length > 0 && popup.dataset.cfMenuContextKey === contextKey) {
      return;
    }
    existingItems.forEach((item) => item.remove());
    popup.dataset.cfMenuContextKey = contextKey;

    const host = popup.querySelector("#items, tp-yt-paper-listbox, [role='menu']") || popup;
    const menuTextColor = nativeMenuTextColor(host);
    if (context.deferredShort) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cf-menu-item";
      button.setAttribute("role", "menuitem");
      button.setAttribute("aria-label", "Block this Short's creator with ChannelFence");
      if (menuTextColor) {
        button.style.setProperty("--cf-menu-text-color", menuTextColor);
      }

      const symbol = document.createElement("span");
      symbol.className = "cf-menu-item__symbol";
      symbol.setAttribute("aria-hidden", "true");
      symbol.textContent = "\u2298";

      const label = document.createElement("span");
      label.className = "cf-menu-item__label";
      label.textContent = "ChannelFence: Block creator";
      button.append(symbol, label);
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        state.pendingMenuContext = null;
        closeCreatorMenu();
        await blockCompactShortCreator(context.root);
      }, true);
      host.append(button);
      return;
    }

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

  function scheduleMenuScan() {
    if (state.menuScanScheduled) {
      return;
    }
    state.menuScanScheduled = true;
    requestAnimationFrame(() => {
      state.menuScanScheduled = false;
      processCreatorMenus();
    });
  }

  function buttonsOwnedByRoot(root) {
    return [...root.querySelectorAll(".cf-block-button")].filter((button) => {
      return button.__channelFenceRoot === root;
    });
  }

  function shortsActionsOwnedByRoot(root) {
    return [...root.querySelectorAll(".cf-shorts-action")].filter((action) => {
      return action.__channelFenceRoot === root;
    });
  }

  function identityKey(refs) {
    return Shared.uniqueRefs(refs).map((ref) => ref.key).sort().join("|");
  }

  function setAttributeIfChanged(element, name, value) {
    if (element.getAttribute(name) !== value) {
      element.setAttribute(name, value);
    }
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
    const host = ownerContext?.anchor?.parentElement || buttonHost(root, pageButton);
    if (!host || host.closest("#cf-hard-block-overlay")) {
      return;
    }
    const existingButton = buttonsOwnedByRoot(root)
      .find((button) => button.dataset.cfIdentity === key);
    if (existingButton) {
      existingButton.title = `Block ${displayName} with ChannelFence`;
      setAttributeIfChanged(existingButton, "aria-label", `Block ${displayName}`);
      if (ownerContext?.anchor?.isConnected &&
          existingButton.__channelFenceAnchor !== ownerContext.anchor) {
        ownerContext.anchor.insertAdjacentElement("afterend", existingButton);
        existingButton.__channelFenceAnchor = ownerContext.anchor;
      } else if (!ownerContext?.anchor && existingButton.parentElement !== host) {
        // YouTube swaps hidden and visible metadata containers while hydrating
        // cards. Keep a retained control attached to the current visible host.
        host.append(existingButton);
      }
      return;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = pageButton
      ? "cf-block-button cf-channel-header-block"
      : "cf-block-button";
    button.dataset.cfIdentity = key;
    button.__channelFenceRoot = root;
    button.__channelFenceAnchor = ownerContext?.anchor || null;
    button.title = `Block ${displayName} with ChannelFence`;
    button.setAttribute("aria-label", `Block ${displayName}`);

    if (pageButton) {
      const icon = document.createElement("img");
      icon.className = "cf-channel-header-block__icon";
      icon.src = chrome.runtime.getURL("assets/icons/channelfence-48.png");
      icon.alt = "";
      icon.setAttribute("aria-hidden", "true");
      button.append(icon);
    } else {
      const symbol = document.createElement("span");
      symbol.className = "cf-block-button__symbol";
      symbol.setAttribute("aria-hidden", "true");
      symbol.textContent = "⊘";
      button.append(symbol);
    }

    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const channelRouteRef = pageButton
        ? Shared.normalizeChannelRef(location.href)
        : null;
      if (channelRouteRef) {
        const freshPageContext = channelPageContext(channelRouteRef);
        await blockCreator(freshPageContext.refs, freshPageContext.displayName);
        return;
      }

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

  function ensureCompactShortButton(root) {
    if (root.querySelector(COMPACT_SHORTS_SELECTOR)) {
      return;
    }
    const path = compactShortPath(root);
    const host = root.querySelector(
      ".shortsLockupViewModelHostOutsideMetadataMenu, [class*='MetadataMenu']"
    );
    if (!path || !host) {
      return;
    }

    const key = `short:${path}`;
    const existingButton = buttonsOwnedByRoot(root)
      .find((button) => button.dataset.cfIdentity === key);
    if (existingButton) {
      return;
    }

    buttonsOwnedByRoot(root).forEach((button) => button.remove());
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cf-block-button cf-compact-shorts-block";
    button.dataset.cfIdentity = key;
    button.__channelFenceRoot = root;
    button.title = "Block this Short's creator with ChannelFence";
    button.setAttribute("aria-label", "Block this Short's creator with ChannelFence");

    const symbol = document.createElement("span");
    symbol.className = "cf-block-button__symbol";
    symbol.setAttribute("aria-hidden", "true");
    symbol.textContent = "\u2298";
    button.append(symbol);
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      await blockCompactShortCreator(root);
    }, true);
    host.before(button);
  }

  function ensureShortsAction(root, ownerContext) {
    if (!state.enabled || !root || !ownerContext) {
      return;
    }

    const actionBar = root.querySelector("reel-action-bar-view-model");
    const refs = refsWithNameFallback(ownerContext.refs, ownerContext.displayName);
    if (!actionBar || refs.length === 0) {
      return;
    }

    const displayName = ownerContext.displayName || displayNameFromRoot(root, refs);
    const key = identityKey(refs);
    const ownedActions = shortsActionsOwnedByRoot(root);
    for (const action of ownedActions) {
      if (action.dataset.cfIdentity !== key) {
        action.remove();
      }
    }

    const existingAction = ownedActions.find((action) => action.dataset.cfIdentity === key);
    if (existingAction) {
      const existingButton = existingAction.querySelector(".cf-shorts-action__button");
      existingButton.title = `Block ${displayName} with ChannelFence`;
      setAttributeIfChanged(
        existingButton,
        "aria-label",
        `Block ${displayName} with ChannelFence`
      );
      if (existingAction.parentElement !== actionBar ||
          actionBar.firstElementChild !== existingAction) {
        actionBar.prepend(existingAction);
      }
      return;
    }

    const action = document.createElement("div");
    action.className = "cf-shorts-action";
    action.dataset.cfIdentity = key;
    action.__channelFenceRoot = root;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "cf-shorts-action__button";
    button.title = `Block ${displayName} with ChannelFence`;
    button.setAttribute("aria-label", `Block ${displayName} with ChannelFence`);

    const icon = document.createElement("img");
    icon.className = "cf-shorts-action__icon";
    icon.src = chrome.runtime.getURL("assets/icons/channelfence-48.png");
    icon.alt = "";
    icon.setAttribute("aria-hidden", "true");

    const label = document.createElement("span");
    label.className = "cf-shorts-action__label";
    label.setAttribute("aria-hidden", "true");
    label.textContent = "Block";

    button.append(icon);
    action.append(button, label);

    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const freshOwners = ownerContextsFromElement(root);
      const freshOwner = freshOwners.find((candidate) => candidate.refs.some((ref) =>
        ownerContext.refs.some((previousRef) => previousRef.key === ref.key))) ||
        freshOwners[0] || ownerContext;
      await blockCreator(
        refsWithNameFallback(freshOwner.refs, freshOwner.displayName),
        freshOwner.displayName
      );
    }, true);

    actionBar.prepend(action);
  }

  function ensureOwnerButtons(root, pageButton, knownOwnerContexts) {
    const discoveredOwners = knownOwnerContexts ?? ownerContextsFromElement(root);
    const channelRouteRef = pageButton
      ? Shared.normalizeChannelRef(location.href)
      : null;
    const owners = channelRouteRef ? (() => {
      const context = channelPageContext(channelRouteRef);
      return [{
        refs: context.refs,
        displayName: context.displayName,
        anchor: channelPageAnchorForRoute(root, channelRouteRef)
      }];
    })() : discoveredOwners.filter((context) => {
      if (pageButton || !context.anchor) {
        return true;
      }
      return context.anchor.closest(`${CONTENT_SELECTOR},${COMMENT_SELECTOR}`) === root;
    }).filter((context) => {
      return pageButton || !root.matches?.(CONTENT_SELECTOR) ||
        !ownerBelongsToCurrentChannel(context);
    });
    if (root.matches?.(COMPACT_SHORTS_SELECTOR)) {
      shortsActionsOwnedByRoot(root).forEach((action) => action.remove());
      if (!pageButton && state.channelPageIdentity && owners.length === 0) {
        buttonsOwnedByRoot(root).forEach((button) => button.remove());
        return;
      }
      ensureCompactShortButton(root);
      return;
    }
    if (discoveredOwners.length > 0 && owners.length === 0) {
      buttonsOwnedByRoot(root).forEach((button) => button.remove());
      shortsActionsOwnedByRoot(root).forEach((action) => action.remove());
      return;
    }

    const isCurrentShortsViewer = isShortsRoute() &&
      root.matches?.("ytd-reel-video-renderer");
    if (isCurrentShortsViewer) {
      buttonsOwnedByRoot(root).forEach((button) => button.remove());
      ensureShortsAction(root, owners[0] || null);
      return;
    }

    shortsActionsOwnedByRoot(root).forEach((action) => action.remove());
    const contexts = owners.length > 0 ? owners : (pageButton ? [null] : []);
    if (contexts.length === 0) {
      buttonsOwnedByRoot(root).forEach((button) => button.remove());
      shortsActionsOwnedByRoot(root).forEach((action) => action.remove());
      return;
    }
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
    if (!isComment && isPromotedContentRoot(item)) {
      item.classList.remove("cf-hidden-by-channelfence");
      item.querySelectorAll(".cf-block-button, .cf-shorts-action")
        .forEach((control) => control.remove());
      return;
    }
    const isCompactShort = Boolean(item.matches?.(COMPACT_SHORTS_SELECTOR));
    const compactPath = isCompactShort ? compactShortPath(item) : "";
    const compactContext = compactPath
      ? state.compactShortContexts.get(compactPath)
      : null;
    const exactShortEntry = compactPath
      ? state.blockedLookup.byShortPath.get(compactPath) || null
      : null;
    if (isCompactShort && !compactContext && !exactShortEntry) {
      inspectCompactShortCreator(item);
    }
    const discoveredOwners = compactContext ? [] : ownerContextsFromElement(item);
    const refs = compactContext?.refs || refsFromElement(item, discoveredOwners);
    const ownerNames = compactContext?.displayName
      ? [compactContext.displayName]
      : ownerNamesFromElement(item, discoveredOwners);
    const collaborationNames = compactContext
      ? []
      : linklessCollaborationNames(item, discoveredOwners);
    const hasStableRef = refs.some((ref) => ref.type !== "name");
    const blocked = Boolean(
      exactShortEntry ||
      matchingEntry(refs, hasStableRef ? [] : ownerNames) ||
      // YouTube collaboration cards can expose a stable link for only one
      // creator while listing the remaining creators as attributed text. The
      // explicit collaboration marker makes name fallback safe for those
      // linkless collaborators without letting a same-named, different handle
      // match on ordinary cards.
      (collaborationNames.length > 0 && matchingEntry([], collaborationNames))
    );
    const isShortsViewer = isShortsRoute() && item.matches("ytd-reel-video-renderer");
    const shouldHide = state.enabled && blocked && (!isComment || state.hideComments) &&
      !isShortsViewer;
    if (isCompactShort) {
      if (!state.compactShortLookups.has(compactPath)) {
        setCompactShortHidden(item, shouldHide);
      }
    } else {
      item.classList.toggle("cf-hidden-by-channelfence", shouldHide);
    }

    if (!state.enabled || blocked) {
      item.querySelectorAll(".cf-block-button, .cf-shorts-action")
        .forEach((button) => button.remove());
      return;
    }
    ensureOwnerButtons(item, false, discoveredOwners);
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
    if (existing?.dataset.mode === "creator" && existing.dataset.entryKey === entry.key) {
      return;
    }
    existing?.remove();

    const overlay = document.createElement("section");
    overlay.id = "cf-hard-block-overlay";
    overlay.dataset.mode = "creator";
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

  function clearBlockedShortSkip() {
    clearTimeout(state.blockedShortSkipTimer);
    state.blockedShortSkipTimer = null;
    state.blockedShortSkipKey = "";
    state.blockedShortAdvanceAttempted = false;
    state.blockedShortScrollAttempted = false;
  }

  function clearBlockedShortFailedOpen() {
    state.blockedShortFailedOpenKey = "";
  }

  function clearShortsRouteSettle() {
    clearTimeout(state.shortsRouteSettleTimer);
    state.shortsRouteSettleTimer = null;
    state.shortsRouteSettleUntil = 0;
    state.shortsRoutePreviousOwnerKeys = [];
  }

  function clearUnresolvedShortsIdentity() {
    state.shortsUnresolvedRouteIdentity = "";
    state.shortsUnresolvedOwnerKeys = [];
  }

  function markShortsRouteSettling() {
    clearShortsRouteSettle();
    clearUnresolvedShortsIdentity();
    if (!state.enabled || state.blocked.length === 0 || !isShortsRoute()) {
      clearWatchPending();
      return;
    }
    holdWatchPending();
    state.shortsRoutePreviousOwnerKeys = [...state.shortsStableOwnerKeys];
    state.shortsRouteRenderer = currentShortsRenderer();
    state.shortsRouteOwnerMutationVersion = shortsOwnerMutationVersion(
      state.shortsRouteRenderer
    );
    state.shortsRouteSettleUntil = Date.now() + SHORTS_IDENTITY_MAX_SETTLE_MS;
    state.shortsRouteSettleTimer = setTimeout(() => {
      state.shortsRouteSettleTimer = null;
      scheduleScan();
    }, SHORTS_IDENTITY_MAX_SETTLE_MS);
  }

  function shortsRouteIsSettling() {
    if (!state.shortsRouteSettleUntil) {
      return false;
    }
    if (!state.enabled || state.blocked.length === 0 || !isShortsRoute()) {
      clearShortsRouteSettle();
      clearUnresolvedShortsIdentity();
      return false;
    }

    const renderer = currentShortsRenderer();
    const currentOwnerKeys = currentShortsDomOwnerKeys(renderer);
    const ownerChanged = currentOwnerKeys.length > 0 && (
      state.shortsRoutePreviousOwnerKeys.length === 0 ||
      !sameStringKeys(currentOwnerKeys, state.shortsRoutePreviousOwnerKeys)
    );
    const rendererChanged = Boolean(renderer && state.shortsStableRenderer &&
      renderer !== state.shortsStableRenderer);
    const ownerRerendered = renderer === state.shortsRouteRenderer &&
      shortsOwnerMutationVersion(renderer) > state.shortsRouteOwnerMutationVersion;
    if (currentOwnerKeys.length > 0 && shortsRendererMatchesRoute(renderer) &&
      (ownerChanged || rendererChanged || ownerRerendered)) {
      state.shortsStableOwnerKeys = currentOwnerKeys;
      state.shortsStableRenderer = renderer;
      clearUnresolvedShortsIdentity();
      clearShortsRouteSettle();
      return false;
    }
    if (Date.now() >= state.shortsRouteSettleUntil) {
      // Without an owner signal tied to this Short, fail open instead of using
      // the previous renderer's creator and potentially skipping allowed content.
      state.shortsUnresolvedRouteIdentity = currentShortsRouteIdentity();
      state.shortsUnresolvedOwnerKeys = [...state.shortsRoutePreviousOwnerKeys];
      state.shortsRouteRenderer = renderer;
      state.shortsRouteOwnerMutationVersion = shortsOwnerMutationVersion(renderer);
      clearShortsRouteSettle();
      clearWatchPending();
      return false;
    }
    return true;
  }

  function syncCurrentRoute() {
    if (location.href === state.currentUrl) {
      return false;
    }
    const previousShortsIdentity = shortsRouteIdentityFromUrl(state.currentUrl);
    const nextShortsIdentity = currentShortsRouteIdentity();
    const sameShortsRoute = Boolean(previousShortsIdentity && nextShortsIdentity &&
      previousShortsIdentity === nextShortsIdentity);
    state.currentUrl = location.href;
    if (sameShortsRoute) {
      return true;
    }
    state.channelPageIdentity = null;
    clearBlockedShortSkip();
    clearBlockedShortFailedOpen();
    removeOverlay();
    markWatchPending();
    if (isShortsRoute()) {
      markShortsRouteSettling();
    } else {
      clearShortsRouteSettle();
      clearUnresolvedShortsIdentity();
      state.shortsStableOwnerKeys = [];
      state.shortsStableRenderer = null;
      state.shortsRouteRenderer = null;
    }
    return true;
  }

  function scrollTowardNextShort() {
    const scroller = document.querySelector("ytd-shorts #shorts-container");
    if (!scroller) {
      return false;
    }

    const renderers = [...document.querySelectorAll("ytd-shorts ytd-reel-video-renderer")];
    const current = currentShortsRenderer();
    const currentIndex = renderers.indexOf(current);
    const next = currentIndex >= 0 ? renderers[currentIndex + 1] : null;
    if (next) {
      next.scrollIntoView({ behavior: "auto", block: "center" });
    } else {
      scroller.scrollBy({
        top: Math.max(scroller.clientHeight, 640),
        behavior: "auto"
      });
    }
    return true;
  }

  function attemptBlockedShortAdvance(sourceRouteIdentity, skipKey, startedAt) {
    if (state.blockedShortSkipKey !== skipKey || !isShortsRoute()) {
      return;
    }
    if (currentShortsRouteIdentity() !== sourceRouteIdentity) {
      syncCurrentRoute();
      scheduleScan();
      return;
    }
    if (location.href !== state.currentUrl) {
      syncCurrentRoute();
    }
    if (Date.now() - startedAt >= BLOCKED_SHORT_MAX_WAIT_MS) {
      const failedOpenKey = state.blockedShortSkipKey;
      clearBlockedShortSkip();
      state.blockedShortFailedOpenKey = failedOpenKey;
      clearWatchPending();
      // YouTube may not have another Short ready. Stay on the current route
      // rather than unexpectedly ejecting the user to Home.
      return;
    }

    if (state.navigationInProgress) {
      state.blockedShortSkipTimer = setTimeout(() => {
        state.blockedShortSkipTimer = null;
        attemptBlockedShortAdvance(sourceRouteIdentity, skipKey, startedAt);
      }, BLOCKED_SHORT_RETRY_MS);
      return;
    }

    const nextButton = document.querySelector(
      "ytd-shorts #navigation-button-down button"
    );
    const nextButtonEnabled = nextButton && !nextButton.disabled &&
      nextButton.getAttribute("aria-disabled") !== "true";
    const waitedForControls = Date.now() - startedAt >= BLOCKED_SHORT_CONTROL_WAIT_MS;
    const advanceAlreadyAttempted = state.blockedShortAdvanceAttempted ||
      state.blockedShortScrollAttempted;
    if (!advanceAlreadyAttempted && nextButtonEnabled) {
      state.blockedShortAdvanceAttempted = true;
      nextButton.click();
    } else if (!advanceAlreadyAttempted && waitedForControls &&
      scrollTowardNextShort()) {
      state.blockedShortScrollAttempted = true;
    }

    state.blockedShortSkipTimer = setTimeout(() => {
      state.blockedShortSkipTimer = null;
      attemptBlockedShortAdvance(sourceRouteIdentity, skipKey, startedAt);
    }, BLOCKED_SHORT_RETRY_MS);
  }

  function advancePastBlockedShort(entry) {
    const sourceRouteIdentity = currentShortsRouteIdentity();
    const skipKey = `${sourceRouteIdentity}|${entry.key}`;

    if (state.blockedShortFailedOpenKey === skipKey) {
      clearWatchPending();
      removeOverlay();
      return;
    }

    holdWatchPending();
    removeOverlay();

    if (state.blockedShortSkipKey === skipKey) {
      return;
    }
    clearBlockedShortSkip();
    state.blockedShortSkipKey = skipKey;
    attemptBlockedShortAdvance(sourceRouteIdentity, skipKey, Date.now());
  }

  function applyRouteGuard() {
    syncCurrentRoute();
    if (state.navigationInProgress) {
      removeOverlay();
      return;
    }

    if (!state.enabled) {
      clearBlockedShortSkip();
      clearShortsRouteSettle();
      clearUnresolvedShortsIdentity();
      clearWatchPending();
      removeOverlay();
      return;
    }

    if (state.blocked.length === 0) {
      clearShortsRouteSettle();
      clearUnresolvedShortsIdentity();
      clearWatchPending();
    }

    if (isShortsRoute() && shortsRouteIsSettling()) {
      holdWatchPending();
      removeOverlay();
      return;
    }

    const context = currentPageContext();
    if (isShortsRoute() &&
      state.shortsUnresolvedRouteIdentity === currentShortsRouteIdentity() &&
      context.refs.length === 0) {
      clearWatchPending();
      removeOverlay();
      return;
    }
    if (isShortsRoute()) {
      rememberCurrentShortsOwner();
    }
    const pathIsChannel = Boolean(Shared.normalizeChannelRef(location.href));
    const routeNeedsIdentity = pathIsChannel || isWatchLikeRoute();
    if (!routeNeedsIdentity) {
      clearWatchPending();
      removeOverlay();
      return;
    }

    let entry = matchingEntry(context.refs);
    if (entry && pathIsChannel) {
      // A canonical channel page is authoritative for the friendly label. This
      // also repairs entries created by older builds that accidentally saved a
      // tab or product-link label such as "Community" for the correct handle.
      entry = repairCanonicalChannelEntryLabel(entry, context);
    }
    if (entry) {
      if (isShortsRoute()) {
        advancePastBlockedShort(entry);
        return;
      }
      showOverlay(entry, context.refs);
      return;
    }

    if (state.blockedShortSkipKey) {
      clearBlockedShortSkip();
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

  function pathFromElement(element) {
    if (!element) {
      return "";
    }
    const anchor = element.matches?.("a") ? element : element.querySelector?.("a");
    const value = anchor?.href || anchor?.getAttribute?.("href") || "";
    try {
      return new URL(value, location.href).pathname;
    } catch {
      return "";
    }
  }

  function hasDirectShortsLink(root) {
    if (!root) {
      return false;
    }
    const anchors = root.matches?.("a") ? [root] : [...root.querySelectorAll("a")];
    return anchors.some((anchor) => pathFromElement(anchor).startsWith("/shorts/"));
  }

  function clearHiddenShorts(root = document) {
    const items = [];
    if (root instanceof Element && root.matches(".cf-hidden-shorts-by-channelfence")) {
      items.push(root);
    }
    root.querySelectorAll?.(".cf-hidden-shorts-by-channelfence").forEach((item) => {
      items.push(item);
    });
    items.forEach((item) => item.classList.remove("cf-hidden-shorts-by-channelfence"));
  }

  function shouldHideShortsItem(item) {
    if (!state.enabled || !state.hideHomeShorts || isShortsRoute()) {
      return false;
    }
    if (item.matches("ytd-rich-section-renderer")) {
      return Boolean(item.querySelector(SHORTS_SHELF_SELECTOR)) || hasDirectShortsLink(item);
    }
    if (item.matches(SHORTS_SHELF_SELECTOR)) {
      const knownShortsShelf = item.matches(
        "ytd-reel-shelf-renderer, ytd-rich-shelf-renderer[is-shorts], " +
        "yt-horizontal-list-renderer[is-shorts]"
      );
      return knownShortsShelf || hasDirectShortsLink(item);
    }
    return item.matches(SHORTS_CARD_SELECTOR) && hasDirectShortsLink(item);
  }

  function processShortsVisibilityWithin(root) {
    const items = new Set();
    if (root instanceof Element && root.matches(SHORTS_VISIBILITY_SELECTOR)) {
      items.add(root);
    }
    root.querySelectorAll?.(SHORTS_VISIBILITY_SELECTOR).forEach((item) => items.add(item));
    for (const item of items) {
      item.classList.toggle(
        "cf-hidden-shorts-by-channelfence",
        shouldHideShortsItem(item)
      );
    }
  }

  function processShortsVisibility() {
    processShortsVisibilityWithin(document);
  }

  function scan() {
    state.scanScheduled = false;
    state.mutationRoots.clear();
    state.mutationShortsRoots.clear();
    state.mutationRouteDirty = false;

    syncCurrentRoute();

    if (!state.enabled) {
      document.querySelectorAll(".cf-hidden-by-channelfence").forEach((item) => {
        item.classList.remove("cf-hidden-by-channelfence");
      });
      document.querySelectorAll(".cf-compact-short-pending").forEach((item) => {
        item.classList.remove("cf-compact-short-pending");
      });
      document.querySelectorAll("grid-shelf-view-model").forEach(reflowCompactShortShelf);
      document.querySelectorAll(".cf-block-button").forEach((button) => button.remove());
      document.querySelectorAll(".cf-shorts-action").forEach((action) => action.remove());
      document.querySelectorAll(".cf-menu-item").forEach((button) => button.remove());
      clearHiddenShorts();
      state.pendingMenuContext = null;
      applyRouteGuard();
      return;
    }

    refreshChannelPageIdentity();
    processShortsVisibility();
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

  const CHANNELFENCE_ELEMENT_SELECTOR = [
    ".cf-block-button",
    ".cf-shorts-action",
    ".cf-menu-item",
    "#cf-toast",
    "#cf-hard-block-overlay"
  ].join(",");

  function isChannelFenceNode(node) {
    const element = node instanceof Element ? node : node?.parentElement;
    return Boolean(element?.closest?.(CHANNELFENCE_ELEMENT_SELECTOR));
  }

  function elementContainsShortsOwnerIdentity(element) {
    if (!(element instanceof Element)) {
      return false;
    }
    if (element.matches("yt-reel-channel-bar-view-model")) {
      return true;
    }
    const anchors = element.matches("a")
      ? [element]
      : [...element.querySelectorAll("a")];
    return anchors.some((anchor) => Boolean(Shared.normalizeChannelRef(
      anchor.href || anchor.getAttribute("href"),
      location.href
    )));
  }

  function mutationTouchesShortsOwner(mutation) {
    const ownerSelector = "ytd-shorts yt-reel-channel-bar-view-model";
    const target = mutation.target instanceof Element
      ? mutation.target
      : mutation.target.parentElement;
    const ownerBar = target?.closest?.(ownerSelector);
    if (mutation.type === "attributes") {
      return Boolean(ownerBar && target?.matches?.("a") &&
        elementContainsShortsOwnerIdentity(target));
    }
    if (ownerBar && target?.matches?.("a") &&
      elementContainsShortsOwnerIdentity(target)) {
      // Text replacement inside the creator link is reported as child-list churn.
      return true;
    }
    return [...mutation.addedNodes, ...mutation.removedNodes].some((node) => {
      if (!(node instanceof Element)) {
        return false;
      }
      if (node.matches?.("yt-reel-channel-bar-view-model") ||
        node.querySelector?.("yt-reel-channel-bar-view-model")) {
        return true;
      }
      return Boolean(ownerBar && elementContainsShortsOwnerIdentity(node));
    });
  }

  function shortsOwnerRendererForMutation(mutation) {
    const target = mutation.target instanceof Element
      ? mutation.target
      : mutation.target.parentElement;
    const targetRenderer = target?.closest?.("ytd-reel-video-renderer");
    if (targetRenderer) {
      return targetRenderer;
    }
    for (const node of [...mutation.addedNodes, ...mutation.removedNodes]) {
      if (!(node instanceof Element)) {
        continue;
      }
      if (node.matches?.("ytd-reel-video-renderer")) {
        return node;
      }
      const nestedRenderer = node.querySelector?.("ytd-reel-video-renderer");
      if (nestedRenderer) {
        return nestedRenderer;
      }
    }
    return null;
  }

  function addMutationRoots(element, selector, collection, includeDescendants) {
    const closest = element.closest?.(selector);
    if (closest) {
      collection.add(closest);
    }
    if (element.matches?.(selector)) {
      collection.add(element);
    }
    if (includeDescendants) {
      element.querySelectorAll?.(selector).forEach((root) => collection.add(root));
    }
  }

  function scheduleMutationFlush() {
    if (state.mutationScanScheduled || state.scanScheduled) {
      return;
    }
    state.mutationScanScheduled = true;
    requestAnimationFrame(flushMutationScan);
  }

  function scheduleMutationElement(element, includeDescendants = false) {
    if (!(element instanceof Element) || isChannelFenceNode(element)) {
      return;
    }

    addMutationRoots(
      element,
      MUTATION_ROOT_SELECTOR,
      state.mutationRoots,
      includeDescendants
    );
    addMutationRoots(
      element,
      SHORTS_VISIBILITY_SELECTOR,
      state.mutationShortsRoots,
      includeDescendants
    );

    const pageOwnerChanged = isShortsRoute()
      ? routeHasCurrentCreator() && Boolean(
        element.closest?.("yt-reel-channel-bar-view-model") ||
        element.matches?.("yt-reel-channel-bar-view-model") ||
        (includeDescendants && element.querySelector?.("yt-reel-channel-bar-view-model"))
      )
      : (() => {
        const ownerSelector = Shared.normalizeChannelRef(location.href)
          ? CHANNEL_PAGE_HEADER_SELECTOR
          : PAGE_OWNER_SELECTOR;
        return routeHasCurrentCreator() && Boolean(
          element.closest?.(ownerSelector) ||
          element.matches?.(ownerSelector) ||
          (includeDescendants && element.querySelector?.(ownerSelector)) ||
          element.matches?.("meta[itemprop='channelId']") ||
          (includeDescendants && element.querySelector?.("meta[itemprop='channelId']"))
        );
      })();
    if (pageOwnerChanged) {
      state.mutationRouteDirty = true;
    }
    scheduleMutationFlush();
  }

  function flushMutationScan() {
    state.mutationScanScheduled = false;
    if (state.scanScheduled) {
      return;
    }

    const roots = [...state.mutationRoots];
    const shortsRoots = [...state.mutationShortsRoots];
    const routeDirty = state.mutationRouteDirty;
    state.mutationRoots.clear();
    state.mutationShortsRoots.clear();
    state.mutationRouteDirty = false;

    if (routeDirty) {
      refreshChannelPageIdentity();
    }

    shortsRoots.filter((root) => root.isConnected)
      .forEach((root) => processShortsVisibilityWithin(root));
    for (const root of roots) {
      if (!root.isConnected) {
        continue;
      }
      if (root.matches(MENU_POPUP_SELECTOR)) {
        ensureCreatorMenuItems(root);
      } else if (root.matches(COMMENT_SELECTOR)) {
        processItem(root, true);
      } else if (root.matches(CONTENT_SELECTOR)) {
        processItem(root, false);
      }
    }
    if (routeDirty) {
      applyRouteGuard();
    }
  }

  async function blockCreator(refs, displayName, shortPath) {
    const entry = Shared.createBlockedEntry(
      refs,
      displayName,
      undefined,
      shortPath ? [shortPath] : []
    );
    if (!entry) {
      showToast("ChannelFence couldn't identify this creator yet.");
      return false;
    }
    const nextBlocked = Shared.mergeBlockedEntry(state.blocked, entry);
    if (!blockedListsEqual(state.blocked, nextBlocked)) {
      clearBlockedShortFailedOpen();
    }
    state.blocked = nextBlocked;
    rebuildBlockedLookup();
    await chrome.storage.local.set({ [Shared.STORAGE.blocked]: state.blocked });
    showToast(`Blocked ${Shared.labelForEntry(entry)}`, {
      label: "Undo",
      action: () => unblockCreator(entry.aliases)
    });
    scheduleScan();
    return true;
  }

  async function unblockCreator(refs) {
    const nextBlocked = Shared.removeEntriesMatchingRefs(state.blocked, refs);
    if (!blockedListsEqual(state.blocked, nextBlocked)) {
      clearBlockedShortFailedOpen();
    }
    state.blocked = nextBlocked;
    rebuildBlockedLookup();
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

  function scheduleStorageScan() {
    if (document.visibilityState === "hidden") {
      state.scanWhenVisible = true;
      return;
    }

    if (isShortsRoute() && shortsRouteIsSettling()) {
      holdWatchPending();
      removeOverlay();
      return;
    }
    state.scanWhenVisible = false;
    scheduleScan();
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }
    if (changes[Shared.STORAGE.enabled]) {
      const nextEnabled = changes[Shared.STORAGE.enabled].newValue !== false;
      if (state.enabled !== nextEnabled) {
        clearBlockedShortFailedOpen();
      }
      state.enabled = nextEnabled;
    }
    if (changes[Shared.STORAGE.hideComments]) {
      state.hideComments = changes[Shared.STORAGE.hideComments].newValue !== false;
    }
    if (changes[Shared.STORAGE.hideHomeShorts]) {
      state.hideHomeShorts = changes[Shared.STORAGE.hideHomeShorts].newValue === true;
    }
    if (changes[Shared.STORAGE.blocked]) {
      const nextBlocked = changes[Shared.STORAGE.blocked].newValue || [];
      if (!blockedListsEqual(state.blocked, nextBlocked)) {
        state.blocked = nextBlocked;
        rebuildBlockedLookup();
        clearBlockedShortFailedOpen();
      }
    }
    if (changes[Shared.STORAGE.enabled] || changes[Shared.STORAGE.blocked]) {
      requestActionUpdate();
    }
    scheduleStorageScan();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && state.scanWhenVisible) {
      state.scanWhenVisible = false;
      scheduleScan();
    }
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
    for (const mutation of mutations) {
      const target = mutation.target instanceof Element
        ? mutation.target
        : mutation.target.parentElement;
      if (!target || isChannelFenceNode(target)) {
        continue;
      }

      if (isShortsRoute() && mutationTouchesShortsOwner(mutation)) {
        const renderer = shortsOwnerRendererForMutation(mutation);
        if (renderer) {
          state.shortsOwnerMutationVersions.set(
            renderer,
            shortsOwnerMutationVersion(renderer) + 1
          );
        }
      }

      if (mutation.type === "attributes") {
        if (isShortsRoute() && mutation.attributeName === "is-active" &&
          target.matches("ytd-reel-video-renderer")) {
          state.mutationRouteDirty = true;
        }
        scheduleMutationElement(target);
        continue;
      }

      const changedNodes = [...mutation.addedNodes, ...mutation.removedNodes]
        .filter((node) => !isChannelFenceNode(node));
      if (changedNodes.length === 0) {
        continue;
      }
      scheduleMutationElement(target);
      changedNodes.forEach((node) => {
        if (node instanceof Element) {
          scheduleMutationElement(node, true);
        }
      });
    }
  });
  observer.observe(document.documentElement, {
    attributeFilter: ["href", "aria-label", "title", "is-active"],
    attributes: true,
    childList: true,
    subtree: true
  });

  document.addEventListener("pointerdown", rememberMenuContext, true);
  document.addEventListener("click", rememberMenuContext, true);

  document.addEventListener("yt-navigate-start", () => {
    state.navigationInProgress = true;
    state.channelPageIdentity = null;
    state.pendingMenuContext = null;
    removeOverlay();
    markWatchPending();
  }, true);
  document.addEventListener("yt-navigate-finish", () => {
    state.navigationInProgress = false;
    scheduleScan();
  }, true);
  document.addEventListener("yt-page-data-updated", (event) => {
    if (event.target instanceof Element && event.target !== document.documentElement) {
      scheduleMutationElement(event.target);
      state.mutationRouteDirty = true;
      scheduleMutationFlush();
      return;
    }
    scheduleScan();
  }, true);
  window.addEventListener("popstate", scheduleScan, true);

  initializeState();
})();
