(function () {
  "use strict";

  function get(key, substitutions) {
    return chrome.i18n.getMessage(key, substitutions);
  }

  function localize(document) {
    document.documentElement.lang = get("languageCode");
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

  globalThis.ChannelFenceI18n = { get, localize };
  // Content scripts use the messages without changing YouTube's document language.
  if (globalThis.document && globalThis.location?.protocol === "chrome-extension:") {
    localize(document);
  }
}());
