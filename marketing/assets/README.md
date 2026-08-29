# Marketing asset provenance

These files are working and final assets for ChannelFence's 30-day growth campaign. They are not included in the Chrome extension package.

## Final assets

- `youtube-thumbnail-1280x720-v2.png` - custom thumbnail for the current long-form demo.
- `../../store/assets/store-01-menu-v2.png` through `store-05-block-list-v2.png` - current-version Chrome Web Store gallery sequence.

All final PNGs are composited as 24-bit RGB images without alpha. The Store images are 1280x800 and the YouTube thumbnail is 1280x720.

## Real product sources

- `source/menu-frame-v2.png`, `source/blocked-frame.png`, and `source/shorts-frame.png` were selected from the locally recorded ChannelFence demo footage.
- `source/options-0.2.1-1280x800.png` and `source/popup-hide-shorts-0.2.1.png` are deterministic captures of the real unpacked extension at version 0.2.1.
- The existing ChannelFence icon is composited from `../../assets/icons/channelfence-512.png`.

## Generated background

`source/generated-growth-background-v1.png` was generated as an abstract background only. It contains no product UI, logo, people, text, or third-party brand artwork. The real ChannelFence icon and real UI were added by the deterministic compositor.

Exact generation prompt:

> Create a premium, futuristic but restrained abstract background for a browser-extension marketing thumbnail. 16:9 composition, exact visual target 1280x720. Deep midnight navy background with subtle layered glass panels, a soft cyan/teal glow and a small coral-orange accent, clean high-contrast lighting, polished privacy/security software aesthetic, spacious left-center area for a large white headline, spacious right area for an existing product icon and real UI screenshot to be composited later. No people, no browser logos, no YouTube logo, no shield icon, no text, no letters, no numbers, no watermark, no fake UI. Professional, modern, sharp, not noisy, not cyberpunk, not generic stock art.

## Regenerate

Capture the deterministic popup and options sources:

```powershell
node scripts/capture-growth-assets.mjs
```

Rebuild every final marketing image:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/create-growth-assets.ps1
```

The three footage frames and generated background are intentionally retained as stable source inputs so the final images can be reproduced without relying on a live YouTube layout.
