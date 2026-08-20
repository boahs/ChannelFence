(function initializeChannelFenceShared(globalScope) {
  "use strict";

  const STORAGE = Object.freeze({
    enabled: "cfEnabled",
    blocked: "cfBlockedChannels",
    hideComments: "cfHideComments"
  });

  const DEFAULTS = Object.freeze({
    [STORAGE.enabled]: true,
    [STORAGE.blocked]: [],
    [STORAGE.hideComments]: true
  });

  const CHANNEL_TYPES = new Set(["channel", "handle", "custom", "user"]);

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
    const ranking = { channel: 0, handle: 1, custom: 2, user: 3 };
    return [...refs].sort((left, right) => {
      return (ranking[left.type] ?? 99) - (ranking[right.type] ?? 99);
    })[0] || null;
  }

  function createBlockedEntry(refs, displayName, blockedAt) {
    const cleanRefs = uniqueRefs(refs);
    if (cleanRefs.length === 0) {
      return null;
    }

    const primary = preferredRef(cleanRefs);
    const handle = cleanRefs.find((ref) => ref.type === "handle");
    const name = cleanCreatorDisplayName(displayName) ||
      handle?.value ||
      (primary.type === "handle" ? primary.value : "Blocked creator");

    return {
      key: primary.key,
      aliases: cleanRefs.map((ref) => ref.key),
      displayName: name,
      url: primary.url,
      blockedAt: blockedAt || new Date().toISOString()
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
        typeof raw.blockedAt === "string" ? raw.blockedAt : undefined
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
      if (ref?.type === "handle") {
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

  function mergeBlockedEntry(entries, incoming) {
    const clean = sanitizeBlockedEntries(entries);
    const normalizedIncoming = incoming && createBlockedEntry(
      incoming.aliases || [incoming.key, incoming.url],
      incoming.displayName,
      incoming.blockedAt
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
      existing.blockedAt
    );
    const rest = clean.filter((_, index) => index !== matchIndex);
    return [merged, ...rest];
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
    normalizeChannelRef,
    refFromKey,
    uniqueRefs,
    createBlockedEntry,
    sanitizeBlockedEntries,
    entryMatchesRefs,
    findMatchingEntry,
    entryNameKeys,
    findMatchingEntryByNames,
    mergeBlockedEntry,
    removeEntriesMatchingRefs,
    labelForEntry
  });
})(globalThis);
