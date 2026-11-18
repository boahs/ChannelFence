// Modern comments use a block-level author link inside a heading, followed by
// badges and a timestamp. Replies keep the same header at a narrower width.
export function commentLayoutFixture(direction: "ltr" | "rtl"): string {
  const comment = (id: string, name: string, owner = false) => `
    <ytd-comment-view-model data-testid="${id}" data-comment-case="${id}">
      <div id="header"><div id="header-author">
        <h3><a id="author-text" href="/@${id}"><span${owner ? ' class="author-is-channel-owner"' : ""}>${name}</span></a></h3>
        <span id="author-comment-badge"></span>
        ${owner ? '<span class="author-badge-container" aria-label="Verified">✓</span>' : ""}
        <span id="published-time-text" dir="auto"><a href="/watch?v=fixture-video&amp;lc=${id}">2 days ago</a></span>
      </div></div>
      <p id="content-text">A comment from ${name}.</p>
    </ytd-comment-view-model>`;
  return `<style>
    body { margin: 16px; }
    #comment-layout { max-width: 800px; }
    #comment-layout ytd-comment-thread-renderer { margin: 0 0 16px; padding: 0; border: 0; }
    ytd-comment-view-model { display: block; margin-bottom: 12px; }
    #replies { margin-inline-start: 48px; }
    #header-author { display: flex; align-items: baseline; }
    #header-author h3 { margin: 0; margin-inline-end: 4px; font-size: 0; font-weight: 500; }
    #author-text { display: block; color: inherit; text-decoration: none; font: 500 13px/18px Arial, sans-serif; }
    #author-text > span { white-space: nowrap; }
    .author-is-channel-owner { display: inline-block; padding: 0 6px; border-radius: 12px; background: #606060; color: white; }
    .author-badge-container { flex: 0 0 14px; margin-inline-end: 4px; font-size: 12px; }
    #published-time-text { flex: 0 0 auto; color: #606060; font: 12px/18px Arial, sans-serif; white-space: nowrap; }
    #published-time-text a { color: inherit; text-decoration: none; }
    #content-text { margin: 6px 0 0; font: 14px/20px Arial, sans-serif; overflow-wrap: anywhere; }
  </style>
  <section id="comment-layout" dir="${direction}">
    <ytd-comment-thread-renderer>${comment("regular", "@regular")}</ytd-comment-thread-renderer>
    <ytd-comment-thread-renderer>
      ${comment("parent", "@parent")}
      <div id="replies">
        ${comment("reply", "@reply")}
        ${comment("ownerreply", "@ownerreply", true)}
      </div>
    </ytd-comment-thread-renderer>
    <ytd-comment-thread-renderer>${comment("longname", "@a_creator_with_a_very_long_comment_author_name_that_needs_truncation")}</ytd-comment-thread-renderer>
    <ytd-comment-thread-renderer><div id="replies">${comment("longowner", "@a_channel_owner_with_a_very_long_highlighted_reply_name", true)}</div></ytd-comment-thread-renderer>
  </section>`;
}

// This runs in either browser; keep geometry assertions identical between suites.
export function commentLayoutChecks({ position, direction }: {
  position: "before" | "after";
  direction: "ltr" | "rtl";
}) {
  return [...document.querySelectorAll<HTMLElement>("[data-comment-case]")].map((comment) => {
    const author = comment.querySelector<HTMLElement>("#author-text")!;
    const name = author.firstElementChild!.getBoundingClientRect();
    const heading = author.parentElement!;
    const buttons = comment.querySelectorAll<HTMLButtonElement>(".cf-block-button");
    const button = buttons[0];
    if (!button) return { id: comment.dataset.commentCase, ready: false };
    const bounds = button.getBoundingClientRect();
    const timestamp = comment.querySelector("#published-time-text")!.getBoundingClientRect();
    const outer = comment.getBoundingClientRect();
    const verified = comment.querySelector(".author-badge-container")?.getBoundingClientRect();
    const badge = author.querySelector<HTMLElement>(".author-is-channel-owner");
    const badgeStyle = badge && getComputedStyle(badge);
    const buttonOnLeft = (position === "before") === (direction === "ltr");
    const separate = (a: DOMRect, b: DOMRect) => a.right <= b.left + 1 || b.right <= a.left + 1;
    const inside = (rect: DOMRect) => rect.left >= outer.left - 1 && rect.right <= outer.right + 1;
    return {
      id: comment.dataset.commentCase,
      ready: true,
      singleControl: buttons.length === 1,
      correctIdentity: button.dataset.cfIdentity === `handle:@${comment.dataset.commentCase}`,
      correctSide: buttonOnLeft ? bounds.right <= name.left + 1 : bounds.left >= name.right - 1,
      sameRow: Math.abs((bounds.top + bounds.bottom - name.top - name.bottom) / 2) <= 2 &&
        Math.abs((timestamp.top + timestamp.bottom - name.top - name.bottom) / 2) <= 4,
      readableName: name.width >= 40 && name.height >= 18 && inside(name),
      visibleControl: bounds.width >= 24 && inside(bounds) &&
        button.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)),
      visibleTimestamp: timestamp.width >= 50 && inside(timestamp) && separate(timestamp, name) && separate(timestamp, bounds),
      intactOwnerBadge: !badgeStyle || (badgeStyle.borderRadius === "12px" &&
        badgeStyle.backgroundColor === "rgb(96, 96, 96)" && badgeStyle.color === "rgb(255, 255, 255)" &&
        badgeStyle.paddingInlineStart === "6px" && badgeStyle.paddingInlineEnd === "6px" &&
        name.height === 18 && heading.getBoundingClientRect().height >= name.height &&
        Boolean(verified && verified.width >= 14 && inside(verified) && separate(verified, name) && separate(verified, bounds)))
    };
  });
}

export const expectedCommentLayout = ["regular", "parent", "reply", "ownerreply", "longname", "longowner"].map((id) => ({
  id, ready: true, singleControl: true, correctIdentity: true, correctSide: true,
  sameRow: true, readableName: true, visibleControl: true, visibleTimestamp: true, intactOwnerBadge: true
}));

export function nativeCommentLayout() {
  return [...document.querySelectorAll("[data-comment-case] #header-author")].map((header) =>
    [...header.querySelectorAll("h3, #author-text, #author-text > span, #published-time-text")].map((element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      const { display, backgroundColor, borderRadius } = getComputedStyle(element);
      return { x, y, width, height, display, backgroundColor, borderRadius };
    }));
}
