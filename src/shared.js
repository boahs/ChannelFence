(function initializeChannelFenceShared(globalScope) {
  "use strict";

  const STORAGE = Object.freeze({
    enabled: "cfEnabled",
    blocked: "cfBlockedChannels",
    hideComments: "cfHideComments",
    hideHomeShorts: "cfHideHomeShorts"
  });

  const DEFAULTS = Object.freeze({
    [STORAGE.enabled]: true,
    [STORAGE.blocked]: [],
    [STORAGE.hideComments]: true,
    [STORAGE.hideHomeShorts]: false
  });

  const CHANNEL_TYPES = new Set(["channel", "handle", "custom", "user", "name"]);

  function cleanDisplayName(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);
  }

  function cleanCreatorDisplayName(value) {
    const name = cleanDisplayName(value)
      .normalize("NFKC")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/^go to channel\s+/i, "")
      .trim();

    // YouTube duration badges can be nested inside a card link. They are not
    // creator names and should never be saved or shown as block-list labels.
    return /^\d{1,3}(?::\d{2}){1,2}$/.test(name) ? "" : name;
  }

  function normalizeCreatorName(value) {
    return cleanCreatorDisplayName(value)
      .replace(/^@/, "")
      .trim()
      .toLocaleLowerCase("en-US");
  }

  function normalizeCreatorNameRef(value) {
    const name = normalizeCreatorName(value);
    if (!name || name.length > 120) {
      return null;
    }
    return Object.freeze({
      type: "name",
      value: name,
      key: `name:${name}`,
      url: ""
    });
  }

  function safeDecode(value) {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  function normalizeChannelRef(input, baseUrl) {
    if (!input || typeof input !== "string") {
      return null;
    }

    let parsed;
    try {
      parsed = new URL(input, baseUrl || "https://www.youtube.com/");
    } catch {
      return null;
    }

    const hostname = parsed.hostname.toLowerCase();
    if (!["youtube.com", "www.youtube.com", "m.youtube.com"].includes(hostname)) {
      return null;
    }

    const segments = parsed.pathname
      .split("/")
      .filter(Boolean)
      .map(safeDecode);

    if (segments.length === 0) {
      return null;
    }

    let type;
    let value;

    if (segments[0].startsWith("@")) {
      type = "handle";
      value = segments[0].toLowerCase();
    } else if (["channel", "c", "user"].includes(segments[0]) && segments[1]) {
      type = segments[0] === "c" ? "custom" : segments[0];
      value = segments[1];
      if (type !== "channel") {
        value = value.toLowerCase();
      }
    } else {
      return null;
    }

    if (!value || value.length > 160) {
      return null;
    }

    const key = `${type}:${value}`;
    const pathType = type === "custom" ? "c" : type;
    const path = type === "handle" ? `/${value}` : `/${pathType}/${value}`;

    return Object.freeze({
      type,
      value,
      key,
      url: `https://www.youtube.com${path}`
    });
  }

  function normalizeManualChannelInput(input) {
    const value = String(input || "").normalize("NFKC").trim();
    if (!value) {
      return null;
    }

    if (value.startsWith("@") || value.startsWith("/")) {
      return normalizeChannelRef(value);
    }

    if (/^(?:(?:www|m)\.)?youtube\.com\//i.test(value)) {
      return normalizeChannelRef(`https://${value}`);
    }

    // YouTube handles may contain localized letters and marks in addition to
    // numbers, underscores, hyphens, and periods.
    if (value.length <= 100 && /^[\p{L}\p{M}\p{N}._-]+$/u.test(value)) {
      return normalizeChannelRef(`/@${value}`);
    }

    return normalizeChannelRef(value);
  }

  function refFromKey(key) {
    if (!key || typeof key !== "string") {
      return null;
    }

    const separator = key.indexOf(":");
    if (separator < 1) {
      return null;
    }

    const type = key.slice(0, separator);
    const value = key.slice(separator + 1);
    if (!CHANNEL_TYPES.has(type) || !value) {
      return null;
    }

    if (type === "name") {
      return normalizeCreatorNameRef(value);
    }

    const pathType = type === "custom" ? "c" : type;
    const path = type === "handle" ? `/${value}` : `/${pathType}/${value}`;
    return {
      type,
      value,
      key: `${type}:${value}`,
      url: `https://www.youtube.com${path}`
    };
  }

  function uniqueRefs(refs) {
    const unique = new Map();
    for (const candidate of Array.isArray(refs) ? refs : []) {
      let ref = candidate;
      if (typeof candidate === "string") {
        ref = refFromKey(candidate) || normalizeChannelRef(candidate);
      }
      if (ref && ref.key && !unique.has(ref.key)) {
        unique.set(ref.key, {
          type: ref.type,
          value: ref.value,
          key: ref.key,
          url: ref.url
        });
      }
    }
    return [...unique.values()];
  }

  function preferredRef(refs) {
    const ranking = { channel: 0, handle: 1, custom: 2, user: 3, name: 4 };
    return [...refs].sort((left, right) => {
      return (ranking[left.type] ?? 99) - (ranking[right.type] ?? 99);
    })[0] || null;
  }

  function normalizeShortPath(input) {
    if (!input || typeof input !== "string") {
      return "";
    }
    try {
      const parsed = new URL(input, "https://www.youtube.com/");
      if (!["youtube.com", "www.youtube.com", "m.youtube.com"].includes(
        parsed.hostname.toLowerCase()
      )) {
        return "";
      }
      return /^\/shorts\/[A-Za-z0-9_-]{3,128}$/.test(parsed.pathname)
        ? parsed.pathname
        : "";
    } catch {
      return "";
    }
  }

  function sanitizeShortPaths(values) {
    return [...new Set((Array.isArray(values) ? values : [])
      .map(normalizeShortPath)
      .filter(Boolean))].slice(0, 50);
  }

  function createBlockedEntry(refs, displayName, blockedAt, shortPaths) {
    const cleanRefs = uniqueRefs(refs);
    if (cleanRefs.length === 0) {
      return null;
    }

    const primary = preferredRef(cleanRefs);
    const handle = cleanRefs.find((ref) => ref.type === "handle");
    const name = cleanCreatorDisplayName(displayName) ||
      handle?.value ||
      (primary.type === "handle" || primary.type === "name" ? primary.value : "Blocked creator");

    return {
      key: primary.key,
      aliases: cleanRefs.map((ref) => ref.key),
      displayName: name,
      url: primary.url || "",
      blockedAt: blockedAt || new Date().toISOString(),
      shortPaths: sanitizeShortPaths(shortPaths)
    };
  }

  function sanitizeBlockedEntries(entries) {
    const result = [];
    const claimedKeys = new Set();

    for (const raw of Array.isArray(entries) ? entries : []) {
      if (!raw || typeof raw !== "object") {
        continue;
      }

      const candidates = [];
      if (raw.key) {
        candidates.push(raw.key);
      }
      if (Array.isArray(raw.aliases)) {
        candidates.push(...raw.aliases);
      }
      if (raw.url) {
        candidates.push(raw.url);
      }

      const refs = uniqueRefs(candidates);
      const unclaimed = refs.filter((ref) => !claimedKeys.has(ref.key));
      if (unclaimed.length === 0) {
        continue;
      }

      const entry = createBlockedEntry(
        unclaimed,
        raw.displayName,
        typeof raw.blockedAt === "string" ? raw.blockedAt : undefined,
        raw.shortPaths
      );

      if (!entry) {
        continue;
      }

      for (const alias of entry.aliases) {
        claimedKeys.add(alias);
      }
      result.push(entry);
    }

    return result;
  }

  function entryMatchesRefs(entry, refs) {
    if (!entry) {
      return false;
    }
    const wanted = new Set(uniqueRefs(refs).map((ref) => ref.key));
    const aliases = Array.isArray(entry.aliases) ? entry.aliases : [entry.key];
    return aliases.some((alias) => wanted.has(alias));
  }

  function findMatchingEntry(entries, refs) {
    return sanitizeBlockedEntries(entries).find((entry) => entryMatchesRefs(entry, refs)) || null;
  }

  function entryNameKeys(entry) {
    const names = new Set();
    const displayName = normalizeCreatorName(entry?.displayName);
    if (displayName && displayName !== "blocked creator") {
      names.add(displayName);
    }

    for (const alias of Array.isArray(entry?.aliases) ? entry.aliases : [entry?.key]) {
      const ref = refFromKey(alias);
      if (ref?.type === "handle" || ref?.type === "name") {
        const handleName = normalizeCreatorName(ref.value);
        if (handleName) {
          names.add(handleName);
        }
      }
    }
    return [...names];
  }

  function findMatchingEntryByNames(entries, names) {
    const wanted = new Set(
      (Array.isArray(names) ? names : [])
        .map(normalizeCreatorName)
        .filter(Boolean)
    );
    if (wanted.size === 0) {
      return null;
    }
    return sanitizeBlockedEntries(entries).find((entry) => {
      return entryNameKeys(entry).some((name) => wanted.has(name));
    }) || null;
  }

  function createBlockedLookup(entries) {
    const cleanEntries = sanitizeBlockedEntries(entries);
    const byAlias = new Map();
    const byName = new Map();
    const byShortPath = new Map();
    const rankByEntry = new Map();

    cleanEntries.forEach((entry, index) => {
      rankByEntry.set(entry, index);
      for (const alias of Array.isArray(entry.aliases) ? entry.aliases : [entry.key]) {
        if (alias && !byAlias.has(alias)) {
          byAlias.set(alias, entry);
        }
      }
      for (const name of entryNameKeys(entry)) {
        if (!byName.has(name)) {
          byName.set(name, entry);
        }
      }
      for (const shortPath of Array.isArray(entry.shortPaths) ? entry.shortPaths : []) {
        if (!byShortPath.has(shortPath)) {
          byShortPath.set(shortPath, entry);
        }
      }
    });

    return { entries: cleanEntries, byAlias, byName, byShortPath, rankByEntry };
  }

  function findMatchingEntryInLookup(lookup, refs, names) {
    if (!lookup) {
      return null;
    }
    let match = null;
    let matchRank = Number.POSITIVE_INFINITY;
    const cleanRefs = uniqueRefs(refs);
    const stableRefs = cleanRefs.filter((ref) => ref.type !== "name");
    const refsToMatch = stableRefs.length > 0 ? stableRefs : cleanRefs;
    for (const ref of refsToMatch) {
      const entry = lookup.byAlias?.get(ref.key);
      const rank = entry ? (lookup.rankByEntry?.get(entry) ?? 0) : undefined;
      if (entry && rank < matchRank) {
        match = entry;
        matchRank = rank;
      }
    }
    if (match) {
      return match;
    }
    // A stable but different handle/channel ID disproves a display-name match.
    // Name matching exists only for YouTube surfaces that expose no stable
    // creator link at all.
    if (stableRefs.length > 0) {
      return null;
    }
    for (const value of Array.isArray(names) ? names : []) {
      const name = normalizeCreatorName(value);
      const entry = name ? lookup.byName?.get(name) : null;
      const rank = entry ? (lookup.rankByEntry?.get(entry) ?? 0) : undefined;
      if (entry && rank < matchRank) {
        match = entry;
        matchRank = rank;
      }
    }
    return match;
  }

  function mergeBlockedEntry(entries, incoming) {
    const clean = sanitizeBlockedEntries(entries);
    const normalizedIncoming = incoming && createBlockedEntry(
      incoming.aliases || [incoming.key, incoming.url],
      incoming.displayName,
      incoming.blockedAt,
      incoming.shortPaths
    );

    if (!normalizedIncoming) {
      return clean;
    }

    const matchIndex = clean.findIndex((entry) => entryMatchesRefs(entry, normalizedIncoming.aliases));
    if (matchIndex === -1) {
      return [normalizedIncoming, ...clean];
    }

    const existing = clean[matchIndex];
    const mergedRefs = uniqueRefs([...existing.aliases, ...normalizedIncoming.aliases]);
    const merged = createBlockedEntry(
      mergedRefs,
      existing.displayName === "Blocked creator" ? normalizedIncoming.displayName : existing.displayName,
      existing.blockedAt,
      [...existing.shortPaths, ...normalizedIncoming.shortPaths]
    );
    const rest = clean.filter((_, index) => index !== matchIndex);
    return [merged, ...rest];
  }

  function mergeBlockedEntries(entries, incomingEntries) {
    const incomingList = Array.isArray(incomingEntries) ? incomingEntries : [];
    if (incomingList.length === 0) {
      return Array.isArray(entries) ? entries : [];
    }
    const existing = sanitizeBlockedEntries(entries);
    const activeNodes = new Set();
    const aliasToNodes = new Map();
    const pendingCanonicalNodes = new Set();
    let dirtyHead = null;

    function registerNode(node) {
      for (const alias of node.entry.aliases) {
        let nodes = aliasToNodes.get(alias);
        if (!nodes) {
          nodes = new Set();
          aliasToNodes.set(alias, nodes);
        }
        nodes.add(node);
      }
    }

    function unregisterNode(node) {
      for (const alias of node.entry.aliases) {
        const nodes = aliasToNodes.get(alias);
        if (!nodes) {
          continue;
        }
        nodes.delete(node);
        if (nodes.size === 0) {
          aliasToNodes.delete(alias);
        }
      }
    }

    function sanitizeDirtyHead() {
      if (!dirtyHead) {
        return;
      }

      unregisterNode(dirtyHead);
      const cleanHead = createBlockedEntry(
        [dirtyHead.entry.key, ...dirtyHead.entry.aliases, dirtyHead.entry.url],
        dirtyHead.entry.displayName,
        dirtyHead.entry.blockedAt,
        dirtyHead.entry.shortPaths
      );
      if (!cleanHead) {
        activeNodes.delete(dirtyHead);
        dirtyHead = null;
        return;
      }
      dirtyHead.entry = cleanHead;
      registerNode(dirtyHead);

      const claimed = new Set(cleanHead.aliases);
      const affectedNodes = new Set();
      for (const alias of claimed) {
        for (const node of aliasToNodes.get(alias) || []) {
          if (node !== dirtyHead) {
            affectedNodes.add(node);
          }
        }
      }

      for (const node of affectedNodes) {
        unregisterNode(node);
        const remainingRefs = uniqueRefs([
          node.entry.key,
          ...node.entry.aliases,
          node.entry.url
        ]).filter((ref) => !claimed.has(ref.key));
        const cleanEntry = createBlockedEntry(
          remainingRefs,
          node.entry.displayName,
          node.entry.blockedAt,
          node.entry.shortPaths
        );
        if (!cleanEntry) {
          activeNodes.delete(node);
          pendingCanonicalNodes.delete(node);
          continue;
        }
        node.entry = cleanEntry;
        registerNode(node);
        pendingCanonicalNodes.add(node);
      }

      dirtyHead = null;
    }

    function sanitizeCurrentEntries() {
      for (const node of pendingCanonicalNodes) {
        if (!activeNodes.has(node)) {
          continue;
        }
        unregisterNode(node);
        const cleanEntry = createBlockedEntry(
          [node.entry.key, ...node.entry.aliases, node.entry.url],
          node.entry.displayName,
          node.entry.blockedAt,
          node.entry.shortPaths
        );
        if (!cleanEntry) {
          activeNodes.delete(node);
          continue;
        }
        node.entry = cleanEntry;
        registerNode(node);
      }
      pendingCanonicalNodes.clear();
      sanitizeDirtyHead();
    }

    existing.forEach((entry, index) => {
      const node = { entry, rank: index };
      activeNodes.add(node);
      registerNode(node);
      if (entry.aliases[0] !== entry.key) {
        pendingCanonicalNodes.add(node);
      }
    });

    incomingList.forEach((incoming, index) => {
      if (index > 0) {
        sanitizeCurrentEntries();
      }
      if (!incoming || typeof incoming !== "object") {
        return;
      }
      const normalized = createBlockedEntry(
        incoming.aliases || [incoming.key, incoming.url],
        incoming.displayName,
        incoming.blockedAt,
        incoming.shortPaths
      );
      if (!normalized) {
        return;
      }

      const matches = new Set();
      for (const alias of normalized.aliases) {
        for (const node of aliasToNodes.get(alias) || []) {
          matches.add(node);
        }
      }
      const preferredExisting = [...matches]
        .sort((left, right) => left.rank - right.rank)[0];
      const refs = uniqueRefs([
        ...(preferredExisting?.entry.aliases || []),
        ...normalized.aliases
      ]);
      const merged = createBlockedEntry(
        refs,
        preferredExisting?.entry.displayName === "Blocked creator"
          ? normalized.displayName
          : preferredExisting?.entry.displayName || normalized.displayName,
        preferredExisting?.entry.blockedAt || normalized.blockedAt,
        [
          ...(preferredExisting?.entry.shortPaths || []),
          ...normalized.shortPaths
        ]
      );
      if (!merged) {
        return;
      }

      if (preferredExisting) {
        unregisterNode(preferredExisting);
        activeNodes.delete(preferredExisting);
        pendingCanonicalNodes.delete(preferredExisting);
      }
      const node = { entry: merged, rank: -(index + 1) };
      activeNodes.add(node);
      registerNode(node);
      dirtyHead = node;
    });

    return [...activeNodes]
      .sort((left, right) => left.rank - right.rank)
      .map((node) => node.entry);
  }

  function removeEntriesMatchingRefs(entries, refs) {
    return sanitizeBlockedEntries(entries).filter((entry) => !entryMatchesRefs(entry, refs));
  }

  function labelForEntry(entry) {
    const displayName = cleanCreatorDisplayName(entry?.displayName);
    if (displayName && displayName !== "Blocked creator") {
      return displayName;
    }
    const refs = uniqueRefs([...(entry?.aliases || []), entry?.key]);
    const ref = refs.find((candidate) => candidate.type === "handle") || refs[0];
    if (!ref) {
      return "Blocked creator";
    }
    return ref.type === "handle" ? ref.value : ref.value;
  }

  globalScope.ChannelFenceShared = Object.freeze({
    STORAGE,
    DEFAULTS,
    cleanDisplayName,
    cleanCreatorDisplayName,
    normalizeCreatorName,
    normalizeCreatorNameRef,
    normalizeChannelRef,
    normalizeManualChannelInput,
    normalizeShortPath,
    sanitizeShortPaths,
    refFromKey,
    uniqueRefs,
    createBlockedEntry,
    sanitizeBlockedEntries,
    entryMatchesRefs,
    findMatchingEntry,
    entryNameKeys,
    findMatchingEntryByNames,
    createBlockedLookup,
    findMatchingEntryInLookup,
    mergeBlockedEntry,
    mergeBlockedEntries,
    removeEntriesMatchingRefs,
    labelForEntry
  });
})(globalThis);
