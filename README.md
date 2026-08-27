# ChannelFence — Block YouTube Channels and Creators

ChannelFence is an open-source, privacy-first Chrome extension that lets you block YouTube channels and creators across Home, search, recommendations, Shorts, comments, channel pages, and supported direct video pages. Block a creator once and their matching content disappears wherever ChannelFence can identify the channel.

## Install

[Install ChannelFence from the Chrome Web Store](https://chromewebstore.google.com/detail/channelfence-%E2%80%93-creator-bl/koeingndpmmgabfoihkcoikiopgkjenm)

[Visit the ChannelFence website](https://boahs.github.io/ChannelFence/) or [report a problem](https://github.com/boahs/ChannelFence/issues/new?template=bug_report.yml).

## How to block a YouTube channel in Chrome

1. Install ChannelFence.
2. Open YouTube and find the creator you want to block.
3. Select **ChannelFence: Block** from the video’s three-dot menu, or use the ⊘ button beside the creator’s name.
4. The creator’s matching content is hidden across supported YouTube surfaces.

You can also open ChannelFence settings and paste a handle such as `@creator` or a YouTube channel URL into **Block by handle or channel URL**.

ChannelFence also works inside the Shorts viewer. Use the branded ChannelFence action beside the current Short or the ChannelFence action in its menu. After blocking the current creator, ChannelFence moves to the next Short instead of showing the blocked-page screen. Because compact Shorts cards omit their creators, ChannelFence requests their public creator metadata from YouTube while your block list is not empty. This lets ChannelFence keep matching Shorts hidden and block from a compact card without opening it or leaving the feed. These lookups are cached only in memory. When you explicitly block from a compact Short, its public `/shorts/...` path is stored locally with the creator record so that exact card stays hidden after a refresh. To remove intrusive Shorts shelves and cards from Home, search, and other feeds, turn on **Hide Shorts in feeds** in the popup or settings. The Shorts navigation and direct viewer remain available when you choose to open them.

You can undo immediately, pause filtering without losing your list, or manage every blocked creator from the extension’s settings. ChannelFence does not block reuploads posted by a different creator.

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

The Playwright suite launches the real unpacked extension in an isolated Chromium profile. Its normal CI tests use deterministic, local YouTube-shaped pages served on the YouTube origin, covering feeds, membership lockups, Shorts controls, comments, direct navigation, menus, the popup, and settings without depending on YouTube's current recommendations or experiments. Run `npm run test:e2e:live` for the separate live-origin smoke check.

GitHub Actions runs the complete deterministic suite on every push and pull request. A separate scheduled workflow runs the intentionally small live YouTube smoke check. See [`tests/e2e/README.md`](tests/e2e/README.md) for the test layout and extension fixture details.

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
- `tests/` — Node-based data-model checks and Playwright extension tests.

## License

ChannelFence is open source software released under the [MIT License](LICENSE).

YouTube is a trademark of Google LLC. ChannelFence is an independent extension and is not affiliated with, endorsed by, or sponsored by Google LLC.
