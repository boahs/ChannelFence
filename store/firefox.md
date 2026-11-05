# Firefox preparation

Status: desktop Firefox version 0.2.8 has been submitted to Mozilla and is awaiting approval. It matches the Chrome feature set and is available for temporary local testing. A public Firefox Add-ons install link will be added after publication.

## Build and load

Use Node.js 22.12 or later and run `npm ci`, then `npm run build:firefox`.

- Temporary testing folder: `dist/ChannelFence-0.2.9-firefox/`.
- Unsigned Mozilla upload package: `dist/ChannelFence-0.2.9-firefox.zip`.
- Firefox minimum: 142.0. Desktop only; Android has not been validated.
- Add-on ID: `channelfence@channelfence.app`. This identifies the add-on; it is not a contact email address. Keep it stable for future updates.

In a separate Firefox test profile, open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select the generated folder's `manifest.json`. Allow YouTube access if Firefox prompts, then refresh existing YouTube tabs. Temporary add-ons are removed when Firefox closes. After rebuilding, use **Reload** in `about:debugging` and refresh YouTube.

The package keeps the original Chrome manifest and catalogs unchanged. The build applies `manifest.firefox.json` and `scripts/firefox-locales.json`, removes the Chrome review link, validates the generated package using Mozilla's linter, and archives only runtime files and the license. No compilation, minification, remote code, or runtime dependencies are added.

## Source package for Mozilla review

The Firefox build preprocesses the manifest, translations, and HTML. Select **Yes** when Mozilla asks whether source code is needed, and attach the matching source archive under its source-code field, separately from the installable Firefox ZIP.

Create the source archive from the exact commit recorded in the tested ZIP's `.validation.txt` file. With that commit checked out, run:

```powershell
git -c core.autocrlf=false archive --format=zip --output=dist/ChannelFence-0.2.9-firefox-source.zip HEAD LICENSE package.json package-lock.json manifest.json manifest.firefox.json scripts/build-firefox.mjs scripts/firefox-locales.json src ui _locales assets/icons store/firefox.md
```

Reviewer build instructions: extract the source archive, use Node.js 24, and run `npm ci` followed by `npm run build:firefox` from its root. The build downloads the locked developer dependencies and writes `dist/ChannelFence-0.2.9-firefox.zip`. No credentials or private files are required. The release package workflow builds on Ubuntu; its validation record identifies the commit and tested archive. ZIP timestamps may differ when rebuilding, so compare extracted file contents.

See [Mozilla's source-code submission requirements](https://extensionworkshop.com/documentation/publish/source-code-submission/).

## Validation

`npm run test:unit` checks the shared runtime, both background environments, localization, and Firefox packaging. `npm run typecheck` checks the browser tests. `npm run test:e2e` retains the existing Chromium regressions.

Set `CHANNELFENCE_FIREFOX_PATH` to an installed Firefox executable and run `npm run test:firefox` after building. This suite installs the actual Firefox package into a temporary browser profile and uses intercepted YouTube fixtures. It does not inject a replacement extension API. Reports and screenshots are kept as local test artifacts.

**Firefox regression tests** runs the deterministic scenarios on pull requests, pushes to `main`, and manual requests. **Firefox live YouTube tests** runs daily at 12:17 in `America/New_York` and accepts manual runs. Chromium has a separate live workflow at 00:17 and 12:17 daily. Firefox covers the equivalent Chromium fixture scenarios and live journeys across all 18 languages. CI installs matching signed Firefox language packs and verifies native UI language selection. The Firefox test guide documents privileged file-picker and toolbar-popup checks that still need manual release validation.

For each release, manually check toolbar-popup behavior, automatic browser-language selection, all three compact thumbnail sizes, JSON import/export between Chrome and Firefox, site-access permissions, and representative real Home/search/watch/Shorts pages. Test the signed build's restart/update behavior after Mozilla signs it. The automatic suite and Mozilla validation complement these checks.

## Mozilla data declaration

The Firefox manifest declares required `websiteContent` under `browser_specific_settings.gecko.data_collection_permissions`. Public compact Short links are visible website content that ChannelFence sends directly to YouTube's oEmbed endpoint to identify creators. This can happen while the block list is nonempty, not only when a lookup button is clicked.

The request omits account credentials and the page referrer. ChannelFence keeps parsed creator metadata in memory and does not write it to extension storage. Firefox may also cache the HTTP response. Settings and the block list stay in local extension storage; the developer receives none of this data. There is no extension analytics or developer server.

This declaration reflects Mozilla's definition of transmission outside the browser, including data sent to services other than the developer. Do not select “no data transmitted” just because no developer server is involved. `websiteContent` is our classification of the public link payload using Mozilla's taxonomy, subject to Mozilla's review.

References: [built-in data consent](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/), [manifest settings](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings), [porting guide](https://extensionworkshop.com/documentation/develop/porting-a-google-chrome-extension/).

## Draft listing

Name: ChannelFence - YouTube Channel Blocker

Summary: Block unwanted YouTube creators, hide Shorts, and tidy your Home feed. Free, open source, with no account or tracking.

Description:

ChannelFence is a free, open-source YouTube channel blocker for Firefox. Block a creator once and hide their matching content across supported Home feeds, search results, recommendations, Watch Next, Shorts, playlists, comments, and direct pages.

- Block beside a creator's name or from supported video and compact Shorts menus.
- Add creators by YouTube handle or channel URL.
- Block the current Shorts creator and continue to the next Short.
- Optionally hide Shorts shelves and cards while keeping the Shorts viewer available.
- Hide supported sponsored cards on Home, promotional banners, Explore more topics, Playables, and similar Home inserts.
- Choose a compact Home grid with Small, Medium, or Large thumbnails.
- Hide collaboration videos when YouTube identifies a creator you have blocked.
- Undo immediately, pause blocking, and manage or back up your block list.
- Use eighteen interface languages, including Arabic with right-to-left layouts. Follow Firefox's interface language or choose a language in settings.

Home appearance options are off by default. ChannelFence does not skip ads during video playback or sponsored Shorts. Blocking depends on the creator information YouTube exposes.

No account, extension analytics, tracking, advertising, remote code, or developer-controlled server. Settings and the block list stay in Firefox's local extension storage. Compact Shorts creator lookups send public Short URLs directly to YouTube, without account credentials or the current page referrer. ChannelFence keeps parsed creator metadata in memory, without adding it to extension storage.

Source code: https://github.com/boahs/ChannelFence

Website: https://channelfence.app/

Support: https://channelfence.app/support/

License: MIT

ChannelFence is independent software and is not affiliated with, endorsed by, or sponsored by Mozilla or Google. YouTube is a trademark of Google LLC.

## Privacy policy text for Mozilla

ChannelFence stores settings, creator identifiers, creator names, channel links, and the user's block list in Firefox's local extension storage. These records are never transmitted to the developer.

When the block list is nonempty, ChannelFence may send public compact Short URLs directly to YouTube's oEmbed endpoint to identify creators and apply blocks. These requests omit account credentials and the current page referrer. ChannelFence keeps parsed public creator names and channel URLs in memory and does not write them to extension storage. Firefox may also cache the HTTP response.

ChannelFence makes no requests to a developer-controlled server or a non-YouTube service. It has no account system, extension analytics, tracking, advertising, or remote code. It does not sell data or use it for advertising.

Users can inspect, export, import, unblock, or clear blocked creators through settings. Uninstalling the extension removes its local extension storage. Backups saved by the user remain where the user saved them.

Privacy and support questions: https://channelfence.app/support/ or https://github.com/boahs/ChannelFence/issues

## Reviewer notes

This is the Firefox build of the open-source ChannelFence extension. The ZIP contains readable JavaScript, HTML, CSS, translations, and icons. Source is at https://github.com/boahs/ChannelFence; reference the exact reviewed commit when submitting.

Firefox uses an MV3 event page instead of Chrome's service worker. Content scripts run only on www.youtube.com and m.youtube.com. The only API permission is storage. The websiteContent declaration covers public compact Short URLs sent to YouTube's same-origin oEmbed endpoint. Those requests omit credentials and referrers. No data goes to the developer.

No account is required. Load desktop YouTube, use the ChannelFence control beside a creator or the supported three-dot menu, and confirm matching cards disappear. Use Undo to restore them. Settings also allow manually adding a handle, changing language, and enabling optional Home controls.

Choose **On this site** when submitting for a public Mozilla listing. Upload the Firefox ZIP, complete the privacy declaration and listing, and review before final submission. Uploading this source package does not itself make it a signed downloadable release. Add a Firefox review link only after Mozilla assigns and publishes the real listing URL.
