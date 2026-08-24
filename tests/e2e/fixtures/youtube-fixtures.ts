type CreatorCardOptions = {
  displayName: string;
  handle: string;
  id: string;
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
  menu = true,
  tag = "ytd-rich-item-renderer",
  title = `A video from ${displayName}`
}: CreatorCardOptions): string {
  const safeId = escapeHtml(id);
  const safeName = escapeHtml(displayName);
  const safeHandle = escapeHtml(handle.startsWith("@") ? handle : `@${handle}`);
  const safeTitle = escapeHtml(title);
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

export function channelHeader(displayName: string, handle: string): string {
  const safeName = escapeHtml(displayName);
  const safeHandle = escapeHtml(handle.startsWith("@") ? handle : `@${handle}`);
  return `
    <yt-page-header-renderer data-testid="channel-header">
      <h1>${safeName}</h1>
      <a href="/${safeHandle}">${safeHandle}</a>
    </yt-page-header-renderer>`;
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
          ytd-comment-thread-renderer, ytd-watch-metadata, yt-page-header-renderer {
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
