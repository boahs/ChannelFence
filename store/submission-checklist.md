# Chrome and Firefox submission checklist

Use a fresh checklist for every store update. The items below describe required work, not completed validation. Record the release version, tested commit, workflow run, package checksums, and manual results with that release's artifacts.

Current target: **0.2.10**, prepared for submission. Store approval and availability must be confirmed separately for Chrome and Firefox.

## Every release: copy and website updates

- [ ] Update the full Chrome description, its version-specific **What's new** section, and the standalone release notes in [listing.md](listing.md). Provide the final description and release notes for pasting into the Chrome Web Store dashboard wherever requested.
- [ ] Update the full Firefox description, version-specific **Release Notes**, reviewer notes, package paths, and source build instructions in [firefox.md](firefox.md). Provide the final description and release notes for pasting into Mozilla's dashboard.
- [ ] Update the root changelog and the website's **What's new** page for the same version. Keep feature guides, download links, and browser-specific wording consistent with the release.
- [ ] Keep prepared/submitted updates distinct from versions already available in each store. Do not claim approval before the relevant store confirms it.
- [ ] Check the listing screenshots and captions still represent current behavior. Replace images when visible features or controls have changed; do not reuse a caption that promises different behavior.
- [ ] Review the small promotional tile and optional marquee image if branding or promotional claims changed.
- [ ] Compare both store descriptions, privacy disclosures, permission explanations, and website copy with the actual package. Preserve the source, support, privacy, and trademark links.

## Package and validation

- [ ] Update the version in the manifests and package metadata. Complete the required review and checks before merging the release changes.
- [ ] Run **Release package checks** on the intended release commit. Confirm the complete Chrome and Firefox jobs pass, including the extracted-package regressions and repeated checks.
- [ ] Download the matching Chrome and Firefox artifacts. Extract the outer GitHub artifact archives and use the **inner ChannelFence ZIPs** for store uploads.
- [ ] For 0.2.10, use `ChannelFence-0.2.10.zip` for Chrome and `ChannelFence-0.2.10-firefox.zip` for Firefox. Retain each accompanying `.validation.txt` file and verify its commit and checksum match the package being uploaded.
- [ ] Do not replace a validated ZIP with a later local rebuild. If runtime files or packaging change, validate the replacement package before uploading it.
- [ ] Create `ChannelFence-0.2.10-firefox-source.zip` from the exact tested commit using [the Firefox source instructions](firefox.md#source-package-for-mozilla-review). Rebuild from that source archive and compare the extracted runtime files with the tested Firefox ZIP.
- [ ] Confirm self-contained runtime code, the MIT license, expected icons, YouTube-only site access, and the narrow `storage` permission are present. Check for accidental development files or credentials in both upload packages and the source archive.
- [ ] Complete the manual checks below against the extracted release packages in separate test profiles. Record any untested checks explicitly.

## Manual acceptance checks in both browsers

1. Install the extracted Chrome package or load the Firefox package temporarily in a separate test profile. Avoid having another ChannelFence copy active in that profile. Confirm onboarding appears only on first install.
2. On Home, block a creator and confirm matching cards disappear. Use Undo and confirm they return. Repeat with Search, Watch Next/right-rail recommendations, playlists, and comments.
3. Open a blocked creator's channel and a supported direct video URL. Confirm the blocked-page screen appears and playback stops. Unblock from that screen and confirm access returns.
4. Pause blocking from the popup and confirm hidden content returns without deleting the list. Resume and confirm blocks apply again.
5. Add a creator by handle and by channel URL in settings; confirm invalid video URLs are rejected. Export, clear, and re-import a test list, including a backup transferred between Chrome and Firefox.
6. In the Shorts viewer, block the current creator using the inline control and the Short's menu. Confirm the viewer advances without displaying the blocked-page screen. Test supported compact Shorts controls without leaving the feed.
7. Enable Hide Shorts in feeds. Confirm Shorts shelves/cards disappear from Home, channel Home, and search. An unblocked channel's dedicated Shorts tab and the Shorts viewer must remain available. Navigate between these pages without a full reload and confirm the setting still applies correctly. Existing creator blocks must still apply.
8. Check each optional Home control independently: sponsored cards, annoying YouTube features, and the compact grid. Check Small, Medium, and Large thumbnails, narrow windows, and restoring the normal layout when disabled or paused. Normal recommendations and their controls should remain usable.
9. Under Appearance in full settings, change the inline block-button position from before to after the creator name. Check supported video cards and comments, including compact cards and both YouTube reading directions. Names can truncate; block buttons should stay visible. Header, menu, and Shorts viewer controls keep their positions.
10. Confirm the toolbar count is off by default, including when updating a profile with saved blocks. Enable it and check that it shows the total saved blocked-creator count rather than a page count. Add/remove a block, then disable the count again.
11. Check automatic browser-language selection, a manual override, and a representative right-to-left interface. Confirm long labels and the popup remain usable in narrow windows. On Firefox, check that the review link opens Firefox Add-ons.
12. Test collaboration cards with multiple identified creators. Blocking any identified collaborator should hide the card; the saved entry should identify the selected creator, not a combined byline. Undo should restore the card when no other collaborator is blocked. Do not infer hidden collaborators from an `and 2 more` count alone.
13. Block a Home card and check that videos fill the available grid space. Repeat after refresh, Undo, pause/resume, scrolling, and resizing. Full-width shelves should retain their width and position. Channel video cards that expose only view counts or upload ages should not receive invented creator controls.
14. Confirm browser site-access permissions and toolbar-popup behavior. Refresh YouTube after reloading the extension. A temporary Firefox installation is removed when Firefox closes; test signed Firefox restart/update behavior after Mozilla signs the package.
15. Confirm settings and blocks persist across reloads and, where the installed build supports it, browser restarts. Inspect the console and Network panel for unexpected errors or non-YouTube requests.

## Dashboard declarations and submission

- **Single purpose:** Give users local controls to customize their YouTube feeds by hiding selected creators and optional feed content, and adjusting the Home grid.
- **Storage permission:** Save settings, appearance preferences, and blocked creators locally.
- **Site access:** Identify creators and modify displayed content only on YouTube pages.
- **Remote code:** No.
- **External network requests:** While the block list is not empty, compact Shorts cards that omit their creators can be checked through YouTube's public oEmbed endpoint. Requests omit account credentials and the page referrer. No developer-controlled or non-YouTube server is involved.
- **Extension analytics or advertising:** No.
- **Data sale or unrelated transfer:** No.
- **Website content:** Public creator names/identifiers, public channel URLs, and user-selected compact Short paths are processed for blocking. Page structure is read for selected feed appearance controls. User-selected entries and preferences stay in local extension storage.
- **Web history:** Browsing history is not recorded or retained. A compact Short path is saved only when the user explicitly blocks from that card, as part of the selected creator record.
- **Firefox data declaration:** Keep `websiteContent` for the public compact Short URLs transmitted directly to YouTube. Do not claim that no data leaves the browser merely because none goes to the developer. Use the complete explanation in [firefox.md](firefox.md#mozilla-data-declaration).

- [ ] Confirm the public support and privacy-policy links resolve and are entered correctly in both dashboards. If using a verified website as Chrome's publisher URL, confirm the verification is complete.
- [ ] Paste the updated Chrome description and Firefox description/release notes prepared above. Answer each dashboard's current privacy questions consistently with the implementation and published policy.
- [ ] Upload the tested Chrome ZIP to Chrome and the tested Firefox ZIP to Mozilla. For Firefox, select **Yes** for source processing and attach the matching source ZIP separately; keep desktop Firefox selected unless Android has separately been validated.
- [ ] Add the exact tested source commit to the Firefox reviewer notes. Recheck filenames and version numbers before final submission.
- [ ] Record each submission's status. After approval, verify the public listing version and update any website wording that still calls it pending. Validate signed Firefox restart/update behavior and record the result.

## Chrome reviewer notes to paste

ChannelFence 0.2.10 gives users local controls for hiding selected YouTube creators and optional feed content, and adjusting the Home grid. No login is required. On youtube.com, select the ChannelFence control beside a creator or in a supported video menu, confirm matching content is hidden, and use Undo to restore it. The popup can pause blocking or block the current page's identified creator. Manage block list opens full settings for manually adding creators, changing language and appearance preferences, and importing, exporting, or clearing the local list.

This update places inline block buttons before creator names by default and adds a before/after setting under Appearance. The setting follows YouTube's reading direction on supported video cards and comments; header, menu, and Shorts viewer controls keep their positions. It also keeps controls inside narrow/compact cards and makes the toolbar's total saved blocked-creator count optional and off by default. With Hide Shorts in feeds on, Home, channel Home, and search Shorts shelves are hidden, but an unblocked channel's dedicated Shorts tab and the Shorts viewer remain available. Existing creator blocks still apply.

While the block list is not empty, compact Shorts that omit their creators can be checked through YouTube's oEmbed endpoint. Requests omit account credentials and the page referrer; parsed creator metadata is kept in memory. Explicitly blocking from a compact Short stores that public path locally with the creator record. Appearance settings and the toolbar count add no network requests. Permissions and data handling are unchanged. The extension makes no requests to a developer-controlled or non-YouTube server and contains no remote code or extension analytics.

Use the separate [Firefox reviewer notes](firefox.md#reviewer-notes) for Mozilla, including the matching source archive and reproducible build instructions.

## Branding check

- Do not use the YouTube play-button logo or a modified/crossed-out version as the extension icon.
- Refer to compatibility in prose and include the Google trademark attribution.
- Use screenshots that accurately demonstrate the extension's current behavior on YouTube.
