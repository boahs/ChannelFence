export function homeMetadataFixture(direction: "ltr" | "rtl" = "ltr"): string {
  // Native Home captures from November 2026 have separate creator, verified
  // badge, play icon, views and age flex items. Only the final age is clipped.
  const cases = [
    { id: "ordinary", creators: ["A Creator With A Long Channel Name"], views: "8.1M", age: "3 weeks ago" },
    { id: "collaboration", creators: ["60 Minutes Australia", "Lawyer With A Long Channel Name"], views: "1.3M", age: "2 days ago" },
    { id: "live", creators: ["A Live Creator"], views: "47K watching", age: "" }
  ];
  const cards = cases.map(({ id, creators, views, age }) => {
    const byline = creators.map((name, index) => `<span class="ytAttributedStringHost ytContentMetadataViewModelMetadataText" dir="auto"><span><a class="creator-link" href="/@${id}${index}">${index ? "and " : ""}${name}</a></span></span><span class="ytContentMetadataViewModelIcon" aria-label="Verified">✓</span>`)
      .join('<span class="ytContentMetadataViewModelDelimiter"> </span>');
    const statistics = age
      ? `<span class="ytContentMetadataViewModelLeadingIcon" aria-hidden="true">▷</span>
         <span class="ytContentMetadataViewModelMetadataText" role="text" data-stat="views">${views}</span>
         <span class="ytContentMetadataViewModelDelimiter"> </span>
         <span class="ytContentMetadataViewModelMetadataText ytContentMetadataViewModelMetadataTextLastPart" role="text" data-stat="age">${age}</span>`
      : `<span class="ytContentMetadataViewModelMetadataText ytContentMetadataViewModelMetadataTextLastPart" role="text" data-stat="views">${views}</span>`;
    return `<ytd-rich-item-renderer data-testid="${id}"><yt-lockup-view-model>
      <a class="thumbnail" href="/watch?v=${id}">Video thumbnail</a>
      <yt-lockup-metadata-view-model><div class="ytLockupMetadataViewModelAvatar" aria-hidden="true"></div>
        <div class="ytLockupMetadataViewModelTextContainer"><h3>A Home video with readable metadata</h3>
          <yt-content-metadata-view-model class="ytContentMetadataViewModelHost">
            <div class="ytContentMetadataViewModelMetadataRow" role="group">
              ${byline}
              <span class="ytContentMetadataViewModelDelimiter"> </span>
              ${statistics}
            </div>
          </yt-content-metadata-view-model>
        </div>
      </yt-lockup-metadata-view-model>
    </yt-lockup-view-model></ytd-rich-item-renderer>`;
  }).join("");
  return `<style>
    body { margin: 16px; }
    ytd-browse, ytd-rich-grid-renderer { display: block; width: 100%; }
    ytd-rich-grid-renderer > #contents { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 420px), 1fr)); gap: 24px 16px; }
    ytd-rich-item-renderer, yt-lockup-view-model { display: block; border: 0; padding: 0; margin: 0; min-width: 0; }
    .thumbnail { display: block; height: 88px; background: #ddd; border-radius: 12px; }
    yt-lockup-metadata-view-model { display: flex; margin-top: 12px; gap: 12px; }
    .ytLockupMetadataViewModelAvatar { width: 32px; height: 32px; border-radius: 50%; background: #aaa; flex: 0 0 32px; }
    .ytLockupMetadataViewModelTextContainer { flex: 1; min-width: 0; }
    h3 { margin: 0 0 4px; font: 600 16px/22px Arial, sans-serif; }
    .ytContentMetadataViewModelHost { display: block; font: 14px/20px Arial, sans-serif; }
    .ytContentMetadataViewModelMetadataRow { display: flex; align-items: center; overflow: hidden; }
    .ytContentMetadataViewModelMetadataText { white-space: nowrap; text-overflow: ellipsis; }
    .ytContentMetadataViewModelMetadataTextLastPart { min-width: 0; overflow: hidden; }
    .ytContentMetadataViewModelAvatarStack { display: flex; min-width: 0; }
    .ytAvatarStackViewModelAvatarStackText { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .creator-link { color: inherit; text-decoration: none; white-space: nowrap; }
    .ytContentMetadataViewModelIcon, .ytContentMetadataViewModelLeadingIcon { flex: 0 0 14px; margin-inline-start: 4px; }
    .ytContentMetadataViewModelDelimiter { flex: 0 0 auto; white-space: pre; min-width: 8px; }
  </style><ytd-browse page-subtype="home" dir="${direction}"><ytd-rich-grid-renderer><div id="contents">${cards}</div></ytd-rich-grid-renderer></ytd-browse>`;
}

export function homeMetadataChecks() {
  return [...document.querySelectorAll<HTMLElement>("ytd-rich-item-renderer")].map((card) => {
    const outer = card.getBoundingClientRect();
    const row = card.querySelector<HTMLElement>(".ytContentMetadataViewModelMetadataRow")!;
    const inside = (bounds: DOMRect) => bounds.left >= outer.left - 1 && bounds.right <= outer.right + 1 &&
      bounds.top >= outer.top - 1 && bounds.bottom <= outer.bottom + 1;
    const buttons = [...card.querySelectorAll<HTMLButtonElement>(".cf-block-button")];
    const links = [...card.querySelectorAll<HTMLElement>(".creator-link")];
    return {
      id: card.dataset.testid,
      controls: buttons.length,
      readableStatistics: [...row.querySelectorAll<HTMLElement>("[data-stat]")].every((stat) => {
        const bounds = stat.getBoundingClientRect();
        return stat.clientWidth > 0 && stat.clientHeight > 0 &&
          stat.scrollWidth <= stat.clientWidth + 1 && stat.scrollHeight <= stat.clientHeight + 1 &&
          inside(bounds) && stat.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2));
      }),
      readableNames: links.every((link) => link.getBoundingClientRect().width >= 25 && inside(link.getBoundingClientRect())),
      visibleControls: buttons.every((button) => {
        const bounds = button.getBoundingClientRect();
        return bounds.width >= 24 && inside(bounds) &&
          button.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2));
      }),
      badgesBesideNames: [...row.querySelectorAll<HTMLElement>(".ytContentMetadataViewModelIcon")].every((badge) => {
        const name = badge.previousElementSibling!.getBoundingClientRect();
        const bounds = badge.getBoundingClientRect();
        const gap = Math.max(bounds.left - name.right, name.left - bounds.right);
        return inside(bounds) && gap >= -1 && gap <= 12 &&
          Math.abs(bounds.top + bounds.height / 2 - name.top - name.height / 2) <= 2;
      }),
      playBesideViews: [...row.querySelectorAll<HTMLElement>(".ytContentMetadataViewModelLeadingIcon")].every((icon) => {
        const views = icon.nextElementSibling!.getBoundingClientRect();
        const bounds = icon.getBoundingClientRect();
        const gap = Math.max(bounds.left - views.right, views.left - bounds.right);
        return inside(bounds) && gap >= -1 && gap <= 12 &&
          Math.abs(bounds.top + bounds.height / 2 - views.top - views.height / 2) <= 2;
      }),
      containedRow: row.scrollWidth <= row.clientWidth + 1
    };
  });
}

export const expectedHomeMetadata = ["ordinary", "collaboration", "live"].map((id) => ({
  id, controls: id === "collaboration" ? 2 : 1,
  readableStatistics: true, readableNames: true, visibleControls: true,
  badgesBesideNames: true, playBesideViews: true, containedRow: true
}));
