# ChannelFence Playwright tests

The browser suite launches ChannelFence as a real unpacked Manifest V3 extension in Playwright's Chromium. Every test receives a new browser profile, so extension storage, tabs, and service-worker state cannot leak between tests.

## Layout

- `fixtures/extension.fixture.ts` launches the extension, exposes its ID and service worker, and provides a typed `chrome.storage.local` helper.
- `fixtures/youtube-fixtures.ts` builds small YouTube-shaped DOM surfaces for stable regression coverage.
- `pages/` contains page objects for YouTube surfaces and extension pages.
- `smoke/` covers the primary block, hide, and undo journey.
- `regression/` covers known bugs and secondary surfaces, including late-populated and hidden search bylines, description mentions, collaboration owners, linkless right-rail recommendations, and manual handle entry.
- `live/` verifies injection plus current search-result and watch-page right-rail compatibility against the real YouTube origin; it is not part of the normal local or pull-request run.

The deterministic tests fulfill navigation requests at `https://www.youtube.com/` with local HTML. The real content scripts and styles still load because the document has a manifest-matched YouTube URL, while the test avoids network data, accounts, recommendations, ads, and YouTube A/B experiments.

## Commands

```powershell
npm run test:e2e
npm run test:e2e:headed
npm run test:e2e:ui
npm run test:e2e:live
npm run test:report
```

When a YouTube DOM change causes a bug, first represent the smallest relevant markup in `youtube-fixtures.ts`, then add a focused spec named after the user-visible behavior. Keep the live suite small; behavior belongs in the deterministic suite whenever possible.
