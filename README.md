# ChannelFence — Block YouTube Channels and Creators

[![ChannelFence CI](https://github.com/boahs/ChannelFence/actions/workflows/ci.yml/badge.svg)](https://github.com/boahs/ChannelFence/actions/workflows/ci.yml)
[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Install-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/channelfence-%E2%80%93-youtube-ch/koeingndpmmgabfoihkcoikiopgkjenm?utm_source=github&utm_medium=organic&utm_campaign=30day_growth&utm_content=readme_badge)
[![License: MIT](https://img.shields.io/badge/License-MIT-2ce2d8.svg)](LICENSE)

ChannelFence is an open-source, privacy-first Chrome extension that lets you block YouTube channels and creators across Home, search, recommendations, Shorts, comments, channel pages, and supported direct video pages. Block a creator once and their matching content disappears wherever ChannelFence can identify the channel.

## Install

[Install ChannelFence from the Chrome Web Store](https://chromewebstore.google.com/detail/channelfence-%E2%80%93-youtube-ch/koeingndpmmgabfoihkcoikiopgkjenm?utm_source=github&utm_medium=organic&utm_campaign=30day_growth&utm_content=readme_install)

[Visit the ChannelFence website](https://channelfence.app/) or [report a problem](https://github.com/boahs/ChannelFence/issues/new?template=bug_report.yml).

## Why ChannelFence?

YouTube's "Don't recommend channel" control changes recommendations. It is not a persistent creator block list across Home, search, Watch Next, Shorts, comments, and direct visits. ChannelFence is for people who want an explicit list they can view, edit, back up, and apply across supported YouTube surfaces.

## How to block a YouTube channel in Chrome

1. Install ChannelFence.
2. Open YouTube and find the creator you want to block.
3. Select **ChannelFence: Block** from the video’s three-dot menu, or use the ⊘ button beside the creator’s name.
4. The creator’s matching content is hidden across supported YouTube surfaces.

You can also open ChannelFence settings and paste a handle such as `@creator` or a YouTube channel URL into **Block by handle or channel URL**.

ChannelFence also works inside the Shorts viewer. Use the branded ChannelFence action beside the current Short or the ChannelFence action in its menu. After blocking the current creator, ChannelFence moves to the next Short instead of showing the blocked-page screen. Because compact Shorts cards omit their creators, ChannelFence requests their public creator metadata from YouTube while your block list is not empty. This lets ChannelFence keep matching Shorts hidden and block from a compact card without opening it or leaving the feed. These lookups are cached only in memory. When you explicitly block from a compact Short, its public `/shorts/...` path is stored locally with the creator record so that exact card stays hidden after a refresh. To remove intrusive Shorts shelves and cards from Home, search, and other feeds, turn on **Hide Shorts in feeds** in the popup or settings. The Shorts navigation and direct viewer remain available when you choose to open them.

You can undo immediately, pause filtering without losing your list, or manage every blocked creator from the extension’s settings. ChannelFence does not block reuploads posted by a different creator.

## Collaboration videos

ChannelFence checks each creator that YouTube identifies on a collaboration card. It also recognizes names in combined bylines such as `Creator A and Creator B` or `Creator A and Creator B and Creator C`, so an existing block for any identified collaborator can hide the card.

Some cards show only `Creator A and 2 more`. ChannelFence uses fuller creator labels when YouTube supplies them; if the card exposes only Creator A, it can match only Creator A. The words `2 more` are not treated as a creator. Blocking an unnamed collaborator cannot hide that card until YouTube exposes their identity.

Your existing individual creator blocks remain saved. If an older version added a combined entry such as `Business Insider and 2 more`, you can remove that entry in settings and block the named creator from their channel page if needed.

When a matching video is hidden, ChannelFence also collapses its enclosing grid tile and lets remaining cards fill gaps across Home rows. This fixes the blank space that could remain in version 0.2.4 even after the video itself was hidden. Full-width shelves keep their place in the feed.

## Privacy and permissions

- Uses only the `storage` extension permission.
- Runs content scripts only on `www.youtube.com` and `m.youtube.com`.
- Stores settings and the user’s block list in `chrome.storage.local`.
- Makes no requests outside youtube.com and contains no analytics, advertising, remote code, or account integration.
- The complete source is available in this repository under the MIT License.

## Load locally

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose this project directory.
5. Open YouTube and use the three-dot menu or ⊘ button beside a creator.

After editing the extension, select **Reload** on its `chrome://extensions` card and refresh open YouTube tabs.

### Test version 0.2.8 in Chrome Canary

1. Extract `dist/ChannelFence-0.2.8.zip` to a folder.
2. In Chrome Canary, open `chrome://extensions` and disable any other ChannelFence copy in that Canary profile to avoid duplicate controls and filtering.
3. Enable **Developer mode**, select **Load unpacked**, and choose the extracted folder containing `manifest.json`.
4. Confirm the extension shows version **0.2.8**. To reuse your block list from another Chrome profile, export it from ChannelFence settings there and import it into the Canary copy.
5. Refresh open YouTube tabs. Test a two-creator and a three-creator collaboration with one identified collaborator blocked at a time, including the second or third creator when their name is available.
6. Block from a collaboration card and check that the saved entry names the selected creator. Use **Undo**, confirm the card returns when no other collaborator is blocked, then block again and refresh to check persistence.
7. Test an `A and 2 more` card: blocking A should hide it. Other collaborators can match only when YouTube exposes their names or channel links on the card.
8. Block a video in the middle of a Home row and confirm nearby videos fill its slot. Check several rows, including any full-width shelves, then use **Undo** and pause/resume filtering to confirm cards return in their original order. Refresh and repeat with an existing block.

9. On a channel's Videos tab, confirm view counts and abbreviated upload ages such as `16h ago` have no creator block buttons. Real creator bylines and the channel header should keep their controls.

10. In ChannelFence settings, choose Japanese, Portuguese (Brazil), or Russian. Confirm the popup, settings, onboarding, privacy page, and blocking controls update, including already-open pages. Reopen settings to check the saved choice. Choose Automatic to return to Chrome's interface language. Check import feedback, readable text in narrow windows, and unchanged creator names.
11. Set YouTube's language separately. Check a channel's Videos page, search-result menus, watch recommendations, and compact Shorts in each supported YouTube language, including a different language from Chrome. Verify blocked creators stay hidden and Undo restores them.

After your Canary checks, upload the same `dist/ChannelFence-0.2.8.zip` through the Chrome Web Store Developer Dashboard.

## Languages

ChannelFence's interface is available in English, Korean, Japanese, Brazilian Portuguese, and Russian. By default, it follows Chrome's interface language; unsupported languages fall back to English. The Language setting lets you choose any supported language or return to Automatic. The choice stays on this device and updates open ChannelFence controls. YouTube keeps its own language setting. Creator names, channel identifiers, and block-list backups are preserved rather than translated.

Translations are bundled locally in `_locales/<language>/messages.json`. Automatic mode uses Chrome's built-in internationalization; manual choices read the same bundled catalogs. Chrome still selects the extension name and description shown in its own extension manager. No translation service or additional permission is needed. To add another Chrome-supported locale, translate the English catalog, preserve its message keys and placeholders, and add the locale to the language selector, runtime allowlist, and shared browser tests. Validate the interface, long text, count wording, and live YouTube behavior before advertising support. Native-speaker review is still welcome; automated tests verify completeness and behavior, not fluency.

The regression suite checks each translated interface, English fallback, and localized YouTube markup. A separate CI suite checks real YouTube pages for Korean, Japanese, Brazilian Portuguese, and Russian. Store descriptions and screenshots are localized separately in the Chrome Web Store dashboard. The website is currently English; visitors can use their browser's translation feature, but bundled extension translations do not translate the website.

## Tests

Install the developer dependencies and Playwright's pinned Chromium build once:

```powershell
npm install
npx playwright install chromium
```

Run the complete unit, type, and browser suite:

```powershell
npm test
```

Useful focused commands:

```powershell
npm run test:unit
npm run test:e2e
npm run test:e2e:headed
npm run test:e2e:ui
```

The Playwright suite launches the real unpacked extension in an isolated Chromium profile. Its normal CI tests use deterministic, local YouTube-shaped pages served on the YouTube origin, covering feeds, collaboration bylines, membership lockups, Shorts controls, comments, direct navigation, menus, the popup, and settings without depending on YouTube's current recommendations or experiments. Run `npm run test:e2e:live` for the separate live-origin smoke check.

GitHub Actions runs the complete deterministic suite on every push and pull request. A separate scheduled workflow runs the intentionally small live YouTube smoke check. See [`tests/e2e/README.md`](tests/e2e/README.md) for the test layout and extension fixture details.

## Website changelog

The website is published by GitHub Pages from `main`. Its [What's new page](https://channelfence.app/changelog/) renders `CHANGELOG.md` through `changelog.html`, so release notes have one source.

For each version, add a dated entry with a permanent `vX-Y-Z` anchor, a short list of user-facing changes, and optional technical details inside the existing collapsible format. Keep the recorded dates intact; they are changelog dates, not necessarily Chrome Web Store approval dates. Add changes when the release is ready, rather than advertising unmerged work. Update the changelog's `lastmod` in `sitemap.xml` alongside the entry.

The CI website job builds the page with GitHub Pages' Jekyll action and uploads the rendered page for review. Merging the PR lets the existing Pages deployment publish it; no separate hosting setup is needed.

## Create the Web Store ZIP

Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/package.ps1
```

The uploadable archive is written to `dist/`. Store listing materials and tests are deliberately excluded from the runtime ZIP.

## Project structure

- `manifest.json` — Manifest V3 declaration.
- `src/` — shared data model, content blocking, styles, and service worker.
- `ui/` — popup, options, onboarding, and bundled privacy policy.
- `assets/icons/` — extension icon assets.
- `store/` — listing copy and submission guidance.
- `site/` — public website styles and social-preview assets.
- `tests/` — Node-based data-model checks and Playwright extension tests.

## License

ChannelFence is open source software released under the [MIT License](LICENSE).

YouTube is a trademark of Google LLC. ChannelFence is an independent extension and is not affiliated with, endorsed by, or sponsored by Google LLC.
