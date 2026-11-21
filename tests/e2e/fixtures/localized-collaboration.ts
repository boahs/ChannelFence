import { allLocales } from "./locales";

export const collaborationLayouts = ["modern-search", "legacy-search", "right-rail"] as const;
export const reportedCollaborators = ["hmtv Music", "hmtv Telugu News"] as const;

// Captured from the reported video's native search bylines in all 18 YouTube
// languages. Japanese uses an ideographic comma; Bengali uses এবং, not ও.
const capturedJoins: Record<string, string> = {
  en: " and ", ko: " 및 ", ja: "、", pt_BR: " e ", ru: " и ", es: " y ", fr: " et ",
  de: " und ", zh_CN: "和", zh_TW: "和", hi: " और ", id: " dan ", bn: " এবং ",
  tr: " ve ", vi: " và ", ar: " و", it: " e ", nl: " en "
};

export const collaborationLocales = allLocales.map((locale) => {
  const join = capturedJoins[locale.catalogCode];
  const guestPrefix = join.trimStart();
  return {
    ...locale,
    guestPrefix,
    beforeGuest: join.slice(0, join.length - guestPrefix.length),
    leadingMark: locale.catalogCode === "ar" ? "\u202b" : "",
    pageLanguage: locale.catalogCode === "en" ? "en" : locale.catalogCode === "zh_CN" ? "zh-Hans-CN" :
      locale.catalogCode === "zh_TW" ? "zh-Hant-TW" : locale.browserLocale
  };
});

type CollaborationLocale = typeof collaborationLocales[number];
const inlineBadge = '<span class="ytAttributedStringLinkInheritColor"><span class="ytAttributedStringInlineBlockMod"><span class="ytIconWrapperHost ytAttributedStringImageElement" role="img" aria-hidden="true"><span class="yt-icon-shape"></span></span></span></span>';

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function localizedCollaboration(
  layout: typeof collaborationLayouts[number],
  locale: CollaborationLocale,
  names: readonly string[] = reportedCollaborators
): string {
  const fields = names.map((name, index) => (index ? locale.guestPrefix : locale.leadingMark) + name);
  const menu = `<button data-testid="${layout}-menu" aria-label="More actions">More</button>`;
  const avatar = "<yt-avatar-stack-view-model></yt-avatar-stack-view-model>";
  const delimiter = '<span class="ytContentMetadataViewModelDelimiter" aria-hidden="true"></span>';
  const badge = '<span class="ytIconWrapperHost ytContentMetadataViewModelIcon" role="img" aria-label="Verified"><span class="yt-icon-shape"></span></span>';

  if (layout === "legacy-search") {
    // Captured Spanish search uses nested attributed text with badge boundaries,
    // a hidden legacy byline and a hidden, localized lead-avatar link.
    const label = locale.goToChannel.replace(locale.creator, names[0]);
    return `<ytd-video-renderer data-testid="${layout}">
      <a id="video-title" href="/watch?v=s195RJ6rLWw">Folk Singers Nagaraju, Ramu</a>
      <a id="channel-thumbnail" href="/@hmtvmusic" aria-label="${escapeHtml(label)}" hidden></a>
      ${avatar}
      <div id="attributed-channel-name"><yt-text-view-model>
        <span class="ytAttributedStringHost" role="text"><span>${fields.map((field) =>
          escapeHtml(field) + inlineBadge).join(locale.beforeGuest)}</span></span>
      </yt-text-view-model></div>
      <ytd-channel-name id="channel-name" hidden style="display:none">
        <yt-formatted-string title="${escapeHtml(fields.join(locale.beforeGuest))}"><a>${escapeHtml(fields.join(locale.beforeGuest))}</a></yt-formatted-string>
      </ytd-channel-name>
      <div id="metadata-line">
        <span class="inline-metadata-item">${escapeHtml(locale.views)}</span>
        <span class="inline-metadata-item">${escapeHtml(locale.age)}</span>
      </div>
      <ytd-menu-renderer>${menu}</ytd-menu-renderer>
    </ytd-video-renderer>`;
  }

  // Captured modern search puts views/age after the creators on the same row.
  // Captured recommendations use a separate stats row and mark the guest's
  // creator field LastPart, which is also used for age and live-viewer fields.
  const creators = fields.map((field, index) =>
    `<span class="ytContentMetadataViewModelMetadataText${layout === "right-rail" && index === fields.length - 1 ? " ytContentMetadataViewModelMetadataTextLastPart" : ""}" role="text">${escapeHtml(field)}</span>${badge}`
  ).join(delimiter);
  const stats = '<span class="ytContentMetadataViewModelLeadingIcon" aria-hidden="true"><span class="yt-icon-shape"></span></span>' +
    `<span class="ytContentMetadataViewModelMetadataText" role="text">${escapeHtml(locale.views)}</span>${delimiter}` +
    `<span class="ytContentMetadataViewModelMetadataText ytContentMetadataViewModelMetadataTextLastPart" role="text">${escapeHtml(locale.age)}</span>`;
  const rows = layout === "right-rail"
    ? `<div class="ytContentMetadataViewModelMetadataRow" role="group">${creators}</div><div class="ytContentMetadataViewModelMetadataRow" role="group">${stats}</div>`
    : `<div class="ytContentMetadataViewModelMetadataRow" role="group">${creators}${delimiter}${stats}</div>`;
  return `<yt-lockup-view-model class="yt-lockup-view-model" data-testid="${layout}">
    <a class="thumbnail" href="/watch?v=s195RJ6rLWw">Collaboration video</a>
    <yt-lockup-metadata-view-model>
      <div class="ytLockupMetadataViewModelAvatar">${avatar}</div>
      <div class="ytLockupMetadataViewModelTextContainer">
        <h3>Folk Singers Nagaraju, Ramu</h3>
        <div class="ytLockupMetadataViewModelMetadata"><yt-content-metadata-view-model>${rows}</yt-content-metadata-view-model></div>
      </div>
      <div class="ytLockupMetadataViewModelMenuButton"><button-view-model>${menu}</button-view-model></div>
    </yt-lockup-metadata-view-model>
  </yt-lockup-view-model>`;
}

export function unstructuredChineseCollaboration(id: string, linkedLead = false): string {
  // Without creator fields or badges, 和 may be part of a channel's name.
  // Only an explicit uploader URL establishes an independently known owner.
  return `<ytd-video-renderer data-testid="${escapeHtml(id)}">
    <a id="video-title" href="/watch?v=s195RJ6rLWw">Collaboration video</a>
    ${linkedLead ? '<a id="channel-thumbnail" href="/@hmtvmusic" aria-label="前往頻道：hmtv Music" hidden></a>' : ""}
    <yt-avatar-stack-view-model></yt-avatar-stack-view-model>
    <div id="attributed-channel-name"><yt-text-view-model>
      <span class="ytAttributedStringHost" role="text">hmtv Music和hmtv Telugu News</span>
    </yt-text-view-model></div>
  </ytd-video-renderer>`;
}

export function partiallyBadgedSpanishCollaboration(): string {
  const spanish = collaborationLocales.find((locale) => locale.youtubeLanguage === "es")!;
  return localizedCollaboration("legacy-search", spanish, ["Cocina y Amigos", "Artes y Oficios"])
    .replace(inlineBadge, "");
}
