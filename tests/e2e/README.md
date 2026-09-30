# ChannelFence Playwright tests

The browser suite launches ChannelFence as a real unpacked Manifest V3 extension in Playwright's Chromium. Every test receives a new browser profile, so extension storage, tabs, and service-worker state cannot leak between tests.

## Layout

- `fixtures/extension.fixture.ts` launches the extension, exposes its ID and service worker, and provides a typed `chrome.storage.local` helper.
- `fixtures/youtube-fixtures.ts` builds small YouTube-shaped DOM surfaces for stable regression coverage.
- `pages/` contains page objects for YouTube surfaces and extension pages.
- `smoke/` covers the primary block, hide, and undo journey.
- `regression/` covers known bugs and secondary surfaces, including late-populated and hidden search bylines, description mentions, linked and combined-name collaboration owners, linkless right-rail recommendations, compact Shorts cards and menus, feed-wide Shorts hiding, and manual handle entry.
- `regression/feed-layout.spec.ts` checks card positions across Home rows after blocking, Undo, pause/resume, creator-label updates, and renderer reuse, including full-width shelf boundaries.
- `live/` verifies injection plus current search-result, compact Shorts blocking, and watch-page right-rail compatibility against the real YouTube origin; it is not part of the normal local or pull-request run.

The deterministic tests fulfill navigation requests at `https://www.youtube.com/` with local HTML. The real content scripts and styles still load because the document has a manifest-matched YouTube URL, while the test avoids network data, accounts, recommendations, ads, and YouTube A/B experiments.

## Commands

```powershell
npm run test:e2e
npm run test:e2e:headed
npm run test:e2e:ui
npm run test:e2e:live
npm run test:report
```

To test an extracted release ZIP, set `CHANNELFENCE_EXTENSION_PATH` to the extracted folder containing `manifest.json`. For example, after extracting to `dist/ChannelFence-0.2.6`:

```powershell
$env:CHANNELFENCE_EXTENSION_PATH = (Resolve-Path .\dist\ChannelFence-0.2.6).Path
try { npm run test:e2e } finally { Remove-Item Env:CHANNELFENCE_EXTENSION_PATH }
```

Without this override, the fixture loads the extension from the project directory.

When a YouTube DOM change causes a bug, first represent the smallest relevant markup in `youtube-fixtures.ts`, then add a focused spec named after the user-visible behavior. Keep the live suite small; behavior belongs in the deterministic suite whenever possible.

For release testing against the current YouTube layout, follow the [Chrome Canary steps in the README](../../README.md#test-version-026-in-chrome-canary) and the [collaboration and feed layout acceptance checks](../../store/submission-checklist.md#collaboration-and-feed-layout-checks-for-026). Test two- and three-creator bylines, collapsed `A and 2 more` labels, existing individual blocks, Undo, and persistence after refresh. Confirm remaining videos fill blocked grid slots across rows, including after pausing and resuming filtering, and that full-width shelves keep their position. A collapsed label can identify unnamed collaborators only if YouTube also exposes their full names or channel links.
