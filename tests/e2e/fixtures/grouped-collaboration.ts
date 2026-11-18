export const groupedCollaborationCases = [
  { title: "captured Home row with views and age", names: ["Asmongold Clips", "Asmongold TV"], connector: "and ", live: false },
  { title: "live Home row with conjunctions inside creator names", names: ["Simon and Martina", "Arts & Crafts, and Co."], connector: "& ", live: true }
];

export function groupedCollaboration({
  id = "collaboration", names, connector = "and ", live = false
}: { id?: string; names: string[]; connector?: string; live?: boolean }): string {
  const escape = (value: string) => value.replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const delimiter = '<span class="ytContentMetadataViewModelDelimiter" aria-hidden="true"></span>';
  // Native Home keeps creators, badges and statistics as separate row siblings.
  // Adjacent fields have no text-node spaces to rescue whole-row text parsing.
  const creators = names.map((name, index) =>
    `<span class="ytContentMetadataViewModelMetadataText" role="text">${escape((index ? connector : "") + name)}</span>` +
    '<span class="ytContentMetadataViewModelIcon" title="Verified" aria-label="Verified">✓</span>' + delimiter
  ).join("");
  const statistics = live
    ? '<span class="ytContentMetadataViewModelMetadataText ytContentMetadataViewModelMetadataTextLastPart" role="text" data-stat="age">596 watching</span>'
    : '<span class="ytContentMetadataViewModelLeadingIcon" aria-hidden="true">▷</span>' +
      '<span class="ytContentMetadataViewModelMetadataText" role="text" data-stat="views">711K</span>' + delimiter +
      '<span class="ytContentMetadataViewModelMetadataText ytContentMetadataViewModelMetadataTextLastPart" role="text" data-stat="age">5h ago</span>';
  return `<yt-lockup-view-model class="yt-lockup-view-model" data-testid="${escape(id)}">
    <a class="thumbnail" href="/watch?v=${escape(id)}">Collaboration video</a>
    <yt-lockup-metadata-view-model>
      <div class="ytLockupMetadataViewModelAvatar"><yt-avatar-stack-view-model></yt-avatar-stack-view-model></div>
      <div class="ytLockupMetadataViewModelTextContainer">
        <h3>Two creators with separate native metadata fields</h3>
        <yt-content-metadata-view-model class="ytContentMetadataViewModelHost">
          <div class="ytContentMetadataViewModelMetadataRow" role="group">${creators}${statistics}</div>
        </yt-content-metadata-view-model>
      </div>
    </yt-lockup-metadata-view-model>
  </yt-lockup-view-model>`;
}

export function groupedCollaborationLayoutChecks() {
  const card = document.querySelector<HTMLElement>('[data-testid="native-collaboration"]')!;
  const outer = card.getBoundingClientRect();
  const row = card.querySelector<HTMLElement>(".ytContentMetadataViewModelMetadataRow")!;
  const inside = (bounds: DOMRect) => bounds.left >= outer.left - 1 && bounds.right <= outer.right + 1 &&
    bounds.top >= outer.top - 1 && bounds.bottom <= outer.bottom + 1;
  const names = [...row.querySelectorAll<HTMLElement>(".ytContentMetadataViewModelMetadataText:not([data-stat])")];
  const statistics = [...row.querySelectorAll<HTMLElement>("[data-stat]")];
  const buttons = [...row.querySelectorAll<HTMLButtonElement>(".cf-block-button")];
  return {
    controls: buttons.length,
    readableNames: names.length === 2 && names.every((name) => name.clientWidth >= 25 && inside(name.getBoundingClientRect())),
    readableStatistics: statistics.every((stat) => {
      const bounds = stat.getBoundingClientRect();
      return stat.clientWidth > 0 && stat.clientHeight > 0 &&
        stat.scrollWidth <= stat.clientWidth + 1 && stat.scrollHeight <= stat.clientHeight + 1 &&
        inside(bounds) && stat.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2));
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
    visibleControlsAboveStatistics: buttons.every((button) => {
      const bounds = button.getBoundingClientRect();
      return bounds.width >= 24 && inside(bounds) &&
        bounds.bottom <= Math.min(...statistics.map((stat) => stat.getBoundingClientRect().top)) + 1 &&
        button.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2));
    }),
    containedRow: row.scrollWidth <= row.clientWidth + 1
  };
}

export const expectedGroupedCollaborationLayout = {
  controls: 2, readableNames: true, readableStatistics: true, badgesBesideNames: true, playBesideViews: true,
  visibleControlsAboveStatistics: true, containedRow: true
};
