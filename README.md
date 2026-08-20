# ChannelFence — Block YouTube Channels and Creators

ChannelFence is a privacy-first Chrome extension that lets you block YouTube channels and creators across Home, search, recommendations, Shorts, comments, channel pages, and supported direct video pages. Block a creator once and their matching content disappears wherever ChannelFence can identify the channel.

## How to block a YouTube channel in Chrome

1. Install ChannelFence.
2. Open YouTube and find the creator you want to block.
3. Select **ChannelFence: Block** from the video’s three-dot menu, or use the ⊘ button beside the creator’s name.
4. The creator’s matching content is hidden across supported YouTube surfaces.

You can undo immediately, pause filtering without losing your list, or manage every blocked creator from the extension’s settings. ChannelFence does not block reuploads posted by a different creator.

## Privacy and permissions

- Uses only the `storage` extension permission.
- Runs content scripts only on `www.youtube.com` and `m.youtube.com`.
- Stores settings and the user’s block list in `chrome.storage.local`.
- Makes no network requests and contains no analytics, advertising, remote code, or account integration.

## Load locally

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose this project directory.
5. Open YouTube and use the three-dot menu or ⊘ button beside a creator.

After editing the extension, select **Reload** on its `chrome://extensions` card and refresh open YouTube tabs.

## Tests

Run:

```powershell
node --test tests/*.test.cjs
```

The `scripts/smoke-youtube.mjs` and `scripts/smoke-menu.mjs` browser checks validate live direct-page blocking and the three-dot-menu block/unblock flow against a Chrome DevTools test session.

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
- `tests/` — Node-based data-model and package checks.

## License

ChannelFence is open source software released under the [MIT License](LICENSE).

YouTube is a trademark of Google LLC. ChannelFence is an independent extension and is not affiliated with, endorsed by, or sponsored by Google LLC.
