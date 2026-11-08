# ChannelFence — Block YouTube Channels and Creators

[![Chrome regression tests](https://github.com/boahs/ChannelFence/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/boahs/ChannelFence/actions/workflows/ci.yml)
[![Firefox regression tests](https://github.com/boahs/ChannelFence/actions/workflows/firefox.yml/badge.svg?branch=main&event=push)](https://github.com/boahs/ChannelFence/actions/workflows/firefox.yml)
[![Chrome live YouTube tests](https://github.com/boahs/ChannelFence/actions/workflows/live-youtube.yml/badge.svg?branch=main&event=schedule)](https://github.com/boahs/ChannelFence/actions/workflows/live-youtube.yml?query=event%3Aschedule)
[![Firefox live YouTube tests](https://github.com/boahs/ChannelFence/actions/workflows/firefox-live.yml/badge.svg?branch=main&event=schedule)](https://github.com/boahs/ChannelFence/actions/workflows/firefox-live.yml?query=event%3Aschedule)
[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Install-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/channelfence-%E2%80%93-youtube-ch/koeingndpmmgabfoihkcoikiopgkjenm?utm_source=github&utm_medium=organic&utm_campaign=30day_growth&utm_content=readme_badge)
[![Firefox Add-ons](https://img.shields.io/badge/Firefox_Add--ons-Install-FF7139?logo=firefoxbrowser&logoColor=white)](https://addons.mozilla.org/addon/channelfence/)
[![License: MIT](https://img.shields.io/badge/License-MIT-2ce2d8.svg)](LICENSE)

ChannelFence is an open-source, privacy-first extension for Chrome and desktop Firefox that lets you block YouTube channels and creators across Home, search, recommendations, Shorts, comments, channel pages, and supported direct video pages. Block a creator once and their matching content disappears wherever ChannelFence can identify the channel.

## Install

[Install ChannelFence from the Chrome Web Store](https://chromewebstore.google.com/detail/channelfence-%E2%80%93-youtube-ch/koeingndpmmgabfoihkcoikiopgkjenm?utm_source=github&utm_medium=organic&utm_campaign=30day_growth&utm_content=readme_install)

[Install ChannelFence from Firefox Add-ons](https://addons.mozilla.org/addon/channelfence/) (desktop Firefox 142 or later).

[Visit the ChannelFence website](https://channelfence.app/) or [report a problem](https://github.com/boahs/ChannelFence/issues/new?template=bug_report.yml).

## Why ChannelFence?

YouTube's "Don't recommend channel" control changes recommendations. It is not a persistent creator block list across Home, search, Watch Next, Shorts, comments, and direct visits. ChannelFence is for people who want an explicit list they can view, edit, back up, and apply across supported YouTube surfaces.

## How to block a YouTube channel

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

## Home feed appearance

The popup and settings include three optional controls for desktop YouTube Home, all off by default:

- **Hide sponsored cards on Home** hides supported sponsored feed cards and their slots.
- **Hide annoying YouTube features** hides supported Home inserts: Explore more topics, Playables/game shelves, featured and promotional banners, Premium/Primetime offers, recommendation prompts, and feedback surveys.
- **Compact Home grid** lets you choose Small, Medium, or Large thumbnails. The grid adapts to the available width, with up to six, five, or four columns respectively.

These preferences are saved locally and work with an empty block list. Regular recommendations, courses, mixes, and the top category filters remain available. Sponsored cards and **Hide Shorts in feeds** have separate controls. An attached survey is hidden without removing its ordinary video. The Home controls do not hide search information panels or ads during video playback. Their labels are available in all eighteen supported interface languages, and they require no new permissions or network requests.

## Privacy and permissions

- Uses only the `storage` extension permission.
- Runs content scripts only on `www.youtube.com` and `m.youtube.com`.
- Stores settings and the user's block list in the browser's local extension storage.
- Makes no requests outside youtube.com and contains no analytics, advertising, remote code, or account integration.
- The complete source is available in this repository under the MIT License.

## Load locally in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose this project directory.
5. Open YouTube and use the three-dot menu or ⊘ button beside a creator.

After editing the extension, select **Reload** on its `chrome://extensions` card and refresh open YouTube tabs.

### Load locally in Firefox

The desktop Firefox release is available from [Firefox Add-ons](https://addons.mozilla.org/addon/channelfence/). For development, build a separate package using the instructions below. It shares the blocking code and all eighteen languages with Chrome, with a Firefox background page and browser-specific copy.

Use Node.js 22.12 or later (CI uses Node.js 24), then build and validate the package:

```powershell
npm ci
npm run build:firefox
```

The build produces `dist/ChannelFence-0.2.9-firefox/` and `dist/ChannelFence-0.2.9-firefox.zip`. In Firefox 142 or later, open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select the generated folder's `manifest.json`. Temporary installation ends when Firefox closes. The ZIP is an unsigned package for Mozilla submission, not a signed public download.

See [Firefox build and listing guidance](store/firefox.md) for testing, privacy disclosures, and submission details. Chrome packages continue to use the original manifest and catalogs.

### Test version 0.2.9 in Chrome Canary

1. Extract `dist/ChannelFence-0.2.9.zip` to a folder.
2. In Chrome Canary, open `chrome://extensions` and disable any other ChannelFence copy in that Canary profile to avoid duplicate controls and filtering.
3. Enable **Developer mode**, select **Load unpacked**, and choose the extracted folder containing `manifest.json`.
4. Confirm the extension shows version **0.2.9**. To reuse your block list from another Chrome profile, export it from ChannelFence settings there and import it into the Canary copy.
5. Refresh open YouTube tabs. Test a two-creator and a three-creator collaboration with one identified collaborator blocked at a time, including the second or third creator when their name is available.
6. Block from a collaboration card and check that the saved entry names the selected creator. Use **Undo**, confirm the card returns when no other collaborator is blocked, then block again and refresh to check persistence.
7. Test an `A and 2 more` card: blocking A should hide it. Other collaborators can match only when YouTube exposes their names or channel links on the card.
8. Block a video in the middle of a Home row and confirm nearby videos fill its slot. Check several rows, including any full-width shelves, then use **Undo** and pause/resume filtering to confirm cards return in their original order. Refresh and repeat with an existing block.

9. On a channel's Videos tab, confirm view counts and abbreviated upload ages such as `16h ago` have no creator block buttons. Real creator bylines and the channel header should keep their controls.

10. In ChannelFence settings, try the supported languages, including both Chinese variants, Hindi, Bengali, and Arabic. Confirm the popup, settings, onboarding, privacy page, and blocking controls update, including already-open pages. Reopen settings to check the saved choice. Choose Automatic to return to Chrome's interface language. Check import feedback, readable text in narrow windows, and unchanged creator names. Arabic should use a right-to-left layout while handles and URLs remain readable.
11. Set YouTube's language separately. Check a channel's Videos page, search-result menus, watch recommendations, and compact Shorts in each supported YouTube language, including a different language from Chrome. Verify blocked creators stay hidden and Undo restores them.
12. On Home, try **Hide sponsored cards on Home** and **Hide annoying YouTube features** separately, including with an empty block list. Check available Explore more topics, Playables, promotional offers, prompts, and surveys. Regular videos, courses, mixes, and the top category filters should remain; Shorts follow their own preference. An attached survey should disappear without hiding its video. Turn each option off to restore its content.
13. Enable the compact Home grid and try each thumbnail size at wide and narrow window sizes. Confirm cards stay readable and in order, shelves keep their place, and disabling the option restores YouTube's layout. Reopen the popup and settings to check that your choices are saved.

After your Canary checks, upload the same `dist/ChannelFence-0.2.9.zip` through the Chrome Web Store Developer Dashboard.

## Languages

ChannelFence's interface is available in English, Korean, Japanese, Brazilian Portuguese, Russian, Spanish, French, German, Simplified Chinese, Traditional Chinese, Hindi, Indonesian, Bengali, Turkish, Vietnamese, Arabic, Italian, and Dutch. By default, it follows your browser's interface language; unsupported languages fall back to English. The Language setting lets you choose any supported language or return to Automatic. The choice stays on this device and updates open ChannelFence controls. Arabic uses a right-to-left layout. YouTube keeps its own language and direction settings. Creator names, channel identifiers, and block-list backups are preserved rather than translated.

Translations are bundled locally in `_locales/<language>/messages.json`. Automatic mode uses the browser's built-in internationalization; manual choices read the same bundled catalogs. The browser still selects the extension name and description shown in its own extension manager. No translation service or additional permission is needed. To add another supported locale, translate the English catalog, preserve its message keys and placeholders, and add the locale to the language selector, runtime allowlist, Firefox copy, and shared browser tests. Validate the interface, long text, count wording, and live YouTube behavior in both browsers before advertising support. Native-speaker review is still welcome; automated tests verify completeness and behavior, not fluency.

The regression suite checks each translated interface, English fallback, and localized YouTube markup. A separate CI suite checks real YouTube pages in every supported language. Store descriptions and screenshots are localized separately in each store's dashboard. The website is currently English; visitors can use their browser's translation feature, but bundled extension translations do not translate the website.

## Tests

Install the developer dependencies and Playwright's pinned Chromium build once:

```powershell
npm install
npx playwright install chromium
```

Run the unit tests, typecheck, and Chromium browser suite:

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

GitHub Actions separates repeatable fixture tests from checks against real YouTube:

| Workflow | When it runs | What it checks |
| --- | --- | --- |
| [Chrome regression tests](https://github.com/boahs/ChannelFence/actions/workflows/ci.yml) | Pull requests, pushes to `main`, or manually | Website build, unit tests, typecheck, and Chromium fixture regressions |
| [Firefox regression tests](https://github.com/boahs/ChannelFence/actions/workflows/firefox.yml) | Pull requests, pushes to `main`, or manually | Firefox package validation, typecheck, and equivalent installed-add-on fixture regressions, including all 18 native and manually selected interface languages |
| [Release package checks](https://github.com/boahs/ChannelFence/actions/workflows/release-packages.yml) | Manually before upload, and on pull requests changing this workflow or the packaging scripts | Complete fixture suites against extracted Chrome and Firefox ZIPs with no retries, followed by three runs of selected stability checks |
| [Chrome live YouTube tests](https://github.com/boahs/ChannelFence/actions/workflows/live-youtube.yml) | Daily at 00:17 and 12:17, or manually | Real YouTube checks in Chromium, including channel headers, search menus, watch recommendations, compact Shorts, and the Shorts viewer across all 18 supported languages |
| [Firefox live YouTube tests](https://github.com/boahs/ChannelFence/actions/workflows/firefox-live.yml) | Daily at 12:17, or manually | Equivalent real YouTube journeys in Firefox across all 18 supported languages, plus the general blocking and Shorts stress checks |

Times use `America/New_York` and follow daylight saving time. Scheduled runs test the latest default-branch commit; GitHub may delay their start. For a manual live run, open the workflow for the intended browser and choose **Run workflow**. Leave the optional `grep` filter blank for the complete suite, or enter a test-title pattern for a focused investigation. Scheduled runs always use the complete suite. **Firefox regression tests** also offers a `live` suite choice that calls the same Firefox live workflow. Each browser has a separate scheduled status badge and workflow name, so a successful Chrome run cannot replace the Firefox badge's failure status.

Firefox's installed-add-on suite uses Puppeteer with Firefox's WebDriver BiDi support under the Playwright test runner. Both browsers share YouTube fixture markup, locale data, and the behavior scenarios. CI installs matching signed Firefox language packs and asserts the actual browser UI language before checking automatic translations. Manual language overrides and YouTube's independent language setting are tested separately. See the [Chromium test guide](tests/e2e/README.md) and [Firefox test guide](tests/firefox/README.md) for setup, coverage and release-check limits.

CI also runs `node scripts/check-browser-coverage.mjs` to compare the discovered fixture and live scenarios. Adding a Chrome scenario without a corresponding Firefox scenario fails this check. Browser execution and assertion review remain necessary; matching test names alone does not prove equivalent behavior.

Failure notifications use GitHub's native Actions notifications. Workflow and job names identify Chrome or Firefox. Enable **Email** under Actions in [GitHub notification settings](https://github.com/settings/notifications); **Send notifications for failed workflows only** is optional. Delivery and the recipient for scheduled workflows follow [GitHub's notification rules](https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs). ChannelFence does not send a separate email or require mail credentials.

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

Before a store upload, run **Release package checks** in GitHub Actions on the intended release branch. Set `stability_grep` to a test-title pattern covering the changed or previously failing behavior; the default covers localized recommendation menus, movie creators, and Chinese collaboration identities. The full regression suites always run first. The filter only selects the cases repeated three times afterward, and both stages disable retries.

Each browser job builds its final ZIP, extracts it into a fresh directory, and loads that extracted extension for every browser test. Firefox runs on Linux with matching native language packs, so all supported interface languages are checked. Full-suite and repeat reports are saved separately, including test durations and failure diagnostics.

Download the successful browser job's package artifact for upload. It contains the tested ZIP and its SHA-256 checksum and commit details. Upload that ZIP to keep the store submission tied to the recorded test result. A failed full or repeated check prevents that browser's package artifact from being published. These are deterministic package checks, so scheduled live YouTube tests and manual browser/store installation checks are still necessary. The workflow uses the manifest's current version and does not bump it or submit either store listing.

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
