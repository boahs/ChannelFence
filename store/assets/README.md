# Store graphic assets

Upload the current `v2` gallery files in this exact order:

1. `store-01-menu-v2.png` - block from a supported video's three-dot menu.
2. `store-02-across-youtube-v2.png` - the direct creator block screen.
3. `store-03-shorts-v2.png` - the ChannelFence action in the Shorts viewer.
4. `store-04-hide-shorts-v2.png` - the Hide Shorts in feeds setting.
5. `store-05-block-list-v2.png` - current-version settings and private block-list management.

Also available:

- `small-promo-440x280.png` - small promotional tile.
- `marquee-1400x560.png` - marquee promotional image.

The earlier `screenshot-*.png` files are retained as historical source material. Do not upload `screenshot-settings-1280x800.png`; it visibly shows version 0.1.8.

The `v2` screenshots are 1280 by 800, use 24-bit PNG output without transparency, and combine current ChannelFence UI with genuine product captures. Regenerate them with:

```powershell
node scripts/capture-growth-assets.mjs
powershell -ExecutionPolicy Bypass -File scripts/create-growth-assets.ps1
```

The YouTube thumbnail is generated separately at `site/assets/youtube-thumbnail-1280x720-v2.png`.
