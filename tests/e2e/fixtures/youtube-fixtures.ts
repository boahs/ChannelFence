type CreatorCardOptions = {
  displayName: string;
  handle: string;
  id: string;
  mentionedHandle?: string;
  menu?: boolean;
  tag?: string;
  title?: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function creatorCard({
  displayName,
  handle,
  id,
  mentionedHandle,
  menu = true,
  tag = "ytd-rich-item-renderer",
  title = `A video from ${displayName}`
}: CreatorCardOptions): string {
  const safeId = escapeHtml(id);
  const safeName = escapeHtml(displayName);
  const safeHandle = escapeHtml(handle.startsWith("@") ? handle : `@${handle}`);
  const safeTitle = escapeHtml(title);
  const safeMentionedHandle = mentionedHandle
    ? escapeHtml(mentionedHandle.startsWith("@") ? mentionedHandle : `@${mentionedHandle}`)
    : "";
  const menuMarkup = menu
    ? `<ytd-menu-renderer><button data-testid="${safeId}-menu" aria-label="Action menu">More</button></ytd-menu-renderer>`
    : "";

  return `
    <${tag} data-testid="${safeId}">
      <a class="thumbnail" href="/watch?v=${safeId}"><span class="duration">8:41</span></a>
      <h3>${safeTitle}</h3>
      <ytd-channel-name id="channel-name">
        <a href="/${safeHandle}" aria-label="${safeName}">${safeName}</a>
      </ytd-channel-name>
      ${safeMentionedHandle
        ? `<p class="description">Featuring <a href="/${safeMentionedHandle}">${safeMentionedHandle}</a></p>`
        : ""}
      ${menuMarkup}
    </${tag}>`;
}

export function rightRailLockup({
  displayName,
  id,
  menu = true,
  title = `A recommendation from ${displayName}`
}: Omit<CreatorCardOptions, "handle" | "tag">): string {
  const safeId = escapeHtml(id);
  const safeName = escapeHtml(displayName);
  const safeTitle = escapeHtml(title);
  const menuMarkup = menu
    ? `<div class="ytLockupViewModelMenuButton">
        <button-view-model>
          <button data-testid="${safeId}-menu" aria-label="More actions">More</button>
        </button-view-model>
      </div>`
    : "";

  // Mirrors YouTube's linkless watch-page recommendation lockup. The creator
  // appears as text/accessibility metadata but the only anchors are video URLs.
  return `
    <yt-lockup-view-model class="ytd-item-section-renderer lockup ytLockupViewModelWrapper" data-testid="${safeId}">
      <a class="thumbnail" href="/watch?v=${safeId}"><span class="duration">16:51</span></a>
      <div class="ytLockupViewModelMetadata">
        <yt-lockup-metadata-view-model>
          <div class="ytLockupMetadataViewModelAvatar">
            <div role="button" aria-label="Go to channel ${safeName}"></div>
          </div>
          <div class="ytLockupMetadataViewModelTextContainer">
            <h3>${safeTitle}</h3>
            <div class="ytLockupMetadataViewModelMetadata">
              <div class="ytContentMetadataViewModelMetadataRow">
                <span class="ytContentMetadataViewModelMetadataText ytContentMetadataViewModelMetadataTextLastPart" role="text">${safeName}</span>
              </div>
              <div class="ytContentMetadataViewModelMetadataRow"><span role="text">274K views · 21 hours ago</span></div>
            </div>
          </div>
          ${menuMarkup}
        </yt-lockup-metadata-view-model>
      </div>
    </yt-lockup-view-model>`;
}

export function courseLockup(displayName: string, id = "course-lockup"): string {
  const safeId = escapeHtml(id);
  const safeName = escapeHtml(displayName);
  return `
    <yt-lockup-view-model class="ytd-rich-grid-renderer lockup ytLockupViewModelWrapper" data-testid="${safeId}">
      <a class="thumbnail" href="/playlist?list=${safeId}"><span>8 lessons</span></a>
      <div class="ytLockupViewModelMetadata">
        <yt-lockup-metadata-view-model>
          <div class="ytLockupMetadataViewModelTextContainer">
            <h3>Fixture learning course</h3>
            <div class="ytLockupMetadataViewModelMetadata">
              <div class="ytContentMetadataViewModelMetadataRow">
                <span class="ytContentMetadataViewModelMetadataTextFirstPart" role="text">${safeName}</span>
                <span aria-hidden="true"> &middot; </span>
                <span class="ytContentMetadataViewModelMetadataTextLastPart" role="text">Course</span>
              </div>
              <div class="ytContentMetadataViewModelMetadataRow"><span>View full course</span></div>
            </div>
          </div>
        </yt-lockup-metadata-view-model>
      </div>
    </yt-lockup-view-model>`;
}

export function promotedHomeCard(advertiser: string, id = "promoted-home-card"): string {
  const safeId = escapeHtml(id);
  const safeAdvertiser = escapeHtml(advertiser);
  return `
    <ytd-rich-item-renderer data-testid="${safeId}">
      <ytd-ad-slot-renderer>
        <ytd-in-feed-ad-layout-renderer>
          <yt-lockup-view-model>
            <a class="thumbnail" href="/watch?v=${safeId}">Promotional video</a>
            <yt-lockup-metadata-view-model>
              <div class="ytContentMetadataViewModelMetadataRow">
                <span class="ytContentMetadataViewModelMetadataTextFirstPart" role="text">${safeAdvertiser}</span>
              </div>
              <span>Sponsored</span>
              <button data-testid="${safeId}-menu" aria-label="More actions">More</button>
            </yt-lockup-metadata-view-model>
          </yt-lockup-view-model>
        </ytd-in-feed-ad-layout-renderer>
      </ytd-ad-slot-renderer>
    </ytd-rich-item-renderer>`;
}

export function comment({ displayName, handle, id }: Omit<CreatorCardOptions, "tag">): string {
  const safeId = escapeHtml(id);
  const safeName = escapeHtml(displayName);
  const safeHandle = escapeHtml(handle.startsWith("@") ? handle : `@${handle}`);
  return `
    <ytd-comment-thread-renderer data-testid="${safeId}">
      <a id="author-text" href="/${safeHandle}">${safeName}</a>
      <p>A comment from ${safeName}</p>
    </ytd-comment-thread-renderer>`;
}

export function watchOwner(displayName: string, handle: string): string {
  const safeName = escapeHtml(displayName);
  const safeHandle = escapeHtml(handle.startsWith("@") ? handle : `@${handle}`);
  return `
    <ytd-watch-metadata>
      <h1>Fixture watch page</h1>
      <div id="owner">
        <ytd-channel-name id="channel-name">
          <a href="/${safeHandle}">${safeName}</a>
        </ytd-channel-name>
      </div>
      <ytd-menu-renderer>
        <button data-testid="watch-menu" aria-label="More actions">More</button>
      </ytd-menu-renderer>
    </ytd-watch-metadata>`;
}

export function watchOwners(owners: Array<{ displayName: string; handle: string }>): string {
  const ownerLinks = owners.map(({ displayName, handle }) => {
    const safeName = escapeHtml(displayName);
    const safeHandle = escapeHtml(handle.startsWith("@") ? handle : `@${handle}`);
    return `<a href="/${safeHandle}" aria-label="${safeName}">${safeName}</a>`;
  }).join(" and ");
  return `
    <ytd-watch-metadata>
      <h1>Fixture collaboration watch page</h1>
      <div id="owner">
        <ytd-channel-name id="channel-name">${ownerLinks}</ytd-channel-name>
      </div>
      <ytd-menu-renderer>
        <button data-testid="watch-menu" aria-label="More actions">More</button>
      </ytd-menu-renderer>
    </ytd-watch-metadata>`;
}

export function channelHeader(displayName: string, handle: string): string {
  const safeName = escapeHtml(displayName);
  const safeHandle = escapeHtml(handle.startsWith("@") ? handle : `@${handle}`);
  return `
    <yt-page-header-renderer data-testid="channel-header">
      <h1>${safeName}</h1>
      <a href="/${safeHandle}">${safeHandle}</a>
    </yt-page-header-renderer>`;
}

export function shortsShelf(): string {
  return `
    <ytd-guide-entry-renderer data-testid="shorts-guide" title="Shorts">
      <a href="/shorts">Shorts</a>
    </ytd-guide-entry-renderer>
    <ytd-mini-guide-entry-renderer data-testid="shorts-mini-guide" aria-label="Shorts">
      <a href="/shorts">Shorts</a>
    </ytd-mini-guide-entry-renderer>
    <ytd-rich-section-renderer data-testid="shorts-section">
      <ytd-reel-shelf-renderer data-testid="shorts-shelf">
        <ytd-reel-item-renderer data-testid="shelf-short">
          <a href="/shorts/shelf-one">Shelf Short</a>
        </ytd-reel-item-renderer>
      </ytd-reel-shelf-renderer>
    </ytd-rich-section-renderer>
    <ytd-rich-item-renderer data-testid="standalone-short">
      <a href="/shorts/standalone-one">Standalone Short</a>
    </ytd-rich-item-renderer>
    <grid-shelf-view-model data-testid="modern-shorts-shelf">
      <div class="ytGridShelfViewModelGridShelfRow" data-testid="compact-row-one">
        <div class="ytGridShelfViewModelGridShelfItem" data-testid="compact-slot-one">
          <ytm-shorts-lockup-view-model data-testid="compact-short">
            <ytm-shorts-lockup-view-model-v2>
              <a href="/shorts/compact-one">Compact Short</a>
              <div class="shortsLockupViewModelHostOutsideMetadata">
                <span>Compact Short title</span>
                <div class="shortsLockupViewModelHostOutsideMetadataMenu">
                  <button data-testid="compact-short-menu" aria-label="More actions">More</button>
                </div>
              </div>
            </ytm-shorts-lockup-view-model-v2>
          </ytm-shorts-lockup-view-model>
        </div>
        <div class="ytGridShelfViewModelGridShelfItem" data-testid="compact-slot-two">
          <ytm-shorts-lockup-view-model data-testid="compact-short-two">
            <a href="/shorts/compact-two">Allowed Compact Short</a>
            <div class="shortsLockupViewModelHostOutsideMetadataMenu">
              <button aria-label="More actions">More</button>
            </div>
          </ytm-shorts-lockup-view-model>
        </div>
      </div>
      <div class="ytGridShelfViewModelGridShelfRow" data-testid="compact-row-two">
        <div class="ytGridShelfViewModelGridShelfItem" data-testid="compact-slot-three">
          <ytm-shorts-lockup-view-model data-testid="compact-short-three">
            <a href="/shorts/compact-three">Another Allowed Compact Short</a>
            <div class="shortsLockupViewModelHostOutsideMetadataMenu">
              <button aria-label="More actions">More</button>
            </div>
          </ytm-shorts-lockup-view-model>
        </div>
      </div>
    </grid-shelf-view-model>
    <ytd-rich-item-renderer data-testid="regular-video">
      <a href="/watch?v=regular-one">Regular video</a>
      <ytd-channel-name><a href="/@regularcreator">Regular Creator</a></ytd-channel-name>
    </ytd-rich-item-renderer>`;
}

export function shortsViewer(displayName: string, handle: string): string {
  const safeName = escapeHtml(displayName);
  const safeHandle = escapeHtml(handle.startsWith("@") ? handle : `@${handle}`);
  return `
    <ytd-shorts>
      <div id="shorts-container" style="height: 500px; overflow-y: scroll">
        <div id="shorts-inner-container">
          <ytd-reel-video-renderer data-testid="shorts-viewer" style="height: 480px">
            <div id="player"><video data-testid="shorts-video" muted></video></div>
            <yt-reel-player-overlay-view-model>
              <yt-reel-channel-bar-view-model data-testid="shorts-channel-bar">
                <a href="/${safeHandle}/shorts" aria-label="${safeName}">${safeName}</a>
              </yt-reel-channel-bar-view-model>
              <reel-action-bar-view-model data-testid="shorts-action-bar">
                <button-view-model data-testid="shorts-like">
                  <button aria-label="Like this video">Like</button>
                </button-view-model>
                <button data-testid="shorts-menu" aria-label="More">More</button>
              </reel-action-bar-view-model>
            </yt-reel-player-overlay-view-model>
          </ytd-reel-video-renderer>
          <div data-testid="next-short-placeholder" style="height: 500px">Next Short</div>
        </div>
      </div>
    </ytd-shorts>`;
}

export function youtubeDocument(body: string): string {
  return `<!doctype html>
    <html lang="en" style="--yt-spec-text-secondary: #606060">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>ChannelFence YouTube fixture</title>
        <style>
          body { background: #fff; color: #0f0f0f; font: 14px Arial, sans-serif; margin: 24px; }
          ytd-rich-item-renderer, ytd-video-renderer, yt-lockup-view-model,
          ytd-comment-thread-renderer, ytd-watch-metadata, yt-page-header-renderer,
          ytd-rich-section-renderer, ytd-reel-shelf-renderer, ytd-reel-item-renderer,
          ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer, ytd-shorts,
          ytd-reel-video-renderer, yt-reel-channel-bar-view-model {
            border: 1px solid #ddd; display: block; margin: 12px; padding: 12px;
          }
          ytd-channel-name, ytd-menu-renderer { display: inline-block; margin-right: 10px; }
          ytd-menu-popup-renderer { background: #202020; display: block; padding: 8px; width: 260px; }
          [role='menuitem'] { align-items: center; display: flex; min-height: 48px; padding: 0 12px; }
        </style>
      </head>
      <body>${body}</body>
    </html>`;
}
