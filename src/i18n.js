(function () {
  "use strict";

  const languages = [
    "en", "ko", "ja", "pt_BR", "ru", "es", "fr", "de", "zh_CN", "zh_TW", "hi",
    "id", "bn", "tr", "vi", "ar", "it", "nl"
  ];
  const listeners = new Set();
  const extensionPage = globalThis.document && globalThis.location?.protocol === "chrome-extension:";
  let language = "auto";
  let messages = null;
  let revision = 0;

  async function loadCatalog(locale) {
    if (!languages.includes(locale)) {
      return null;
    }
    // Only bundled files are readable; callers cannot supply a path or URL.
    const response = await fetch(chrome.runtime.getURL(`_locales/${locale}/messages.json`));
    if (!response.ok) {
      throw new Error("Could not load bundled language");
    }
    return response.json();
  }

  function get(key, substitutions) {
    const entry = messages?.[key];
    if (!entry) {
      return chrome.i18n.getMessage(key, substitutions);
    }
    const values = Array.isArray(substitutions) ? substitutions : [substitutions];
    // Replace in one pass so creator names containing dollar signs remain literal.
    return entry.message.replace(/\$\$|\$([a-z][a-z0-9_]*)\$/gi, (match, name) => {
      if (match === "$$") {
        return "$";
      }
      const placeholder = entry.placeholders?.[name.toLowerCase()];
      return values[Number(placeholder?.content.slice(1)) - 1] ?? "";
    });
  }

  function localize(document) {
    document.documentElement.lang = get("languageCode");
    document.documentElement.dir = direction();
    for (const element of document.querySelectorAll("[data-i18n]")) {
      const key = element.getAttribute("data-i18n");
      const link = element.querySelector("[data-i18n-link]");
      if (link) {
        // Keep the existing, trusted link while translating the whole sentence.
        const [before, after] = get(key, "\uFFFC").split("\uFFFC");
        element.replaceChildren(before, link, after);
      } else {
        element.textContent = get(key);
      }
    }
    for (const attribute of ["title", "placeholder", "aria-label", "alt"]) {
      for (const element of document.querySelectorAll(`[data-i18n-${attribute}]`)) {
        element.setAttribute(attribute, get(element.getAttribute(`data-i18n-${attribute}`)));
      }
    }
  }

  function direction() {
    return get("languageCode") === "ar" ? "rtl" : "ltr";
  }

  async function changeLanguage(preference) {
    const currentRevision = ++revision;
    let nextLanguage = languages.includes(preference) ? preference : "auto";
    let nextMessages = null;
    if (nextLanguage !== "auto") {
      try {
        // Content scripts ask the worker for bundled text instead of exposing
        // catalogs as web-accessible resources or requesting them from YouTube.
        nextMessages = globalThis.document && !extensionPage
          ? await chrome.runtime.sendMessage({ type: "CF_GET_MESSAGES", language: nextLanguage })
          : await loadCatalog(nextLanguage);
        if (!nextMessages?.languageCode?.message) {
          throw new Error("Missing bundled language");
        }
      } catch {
        nextLanguage = "auto";
        nextMessages = null;
      }
    }
    if (currentRevision !== revision) {
      return;
    }
    language = nextLanguage;
    messages = nextMessages;
    if (extensionPage) {
      localize(document);
    }
    for (const listener of listeners) {
      listener();
    }
  }

  let ready = chrome.storage.local.get("cfLanguage").then((values) => {
    // A settings change that arrives during startup takes precedence.
    if (revision === 0) {
      return changeLanguage(values.cfLanguage);
    }
  }, () => {
    if (revision === 0) {
      return changeLanguage("auto");
    }
  });
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.cfLanguage) {
      ready = changeLanguage(changes.cfLanguage.newValue);
    }
  });

  globalThis.ChannelFenceI18n = {
    get, localize, loadCatalog,
    get ready() { return ready; },
    get language() { return language; },
    get direction() { return direction(); },
    onChange(listener) { listeners.add(listener); }
  };
  // Content scripts never change YouTube's document language.
  if (extensionPage) {
    localize(document);
  }
}());
