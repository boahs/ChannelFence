# GitHub Release: ChannelFence v0.2.2

Use this file after Chrome Web Store version `0.2.2` is publicly available. Creating the tag, Release, or upload remains a separate public action.

## Release fields

- Tag: `v0.2.2`
- Target: `main`
- Title: `ChannelFence v0.2.2`
- Attachment: `dist/ChannelFence-0.2.2.zip`
- Package size: 330,860 bytes.
- SHA-256: `F8C92340BDA5EA7608066A514387B72D0EAA11E35611824C8BF71D4850658166`

Recalculate the hash immediately before publishing. If it differs, confirm why before uploading the ZIP.

## Release notes

ChannelFence 0.2.2 improves Shorts navigation and makes the block control on channel profiles easier to recognize.

### Fixed

- Kept blocked Shorts navigation inside the Shorts viewer instead of returning to Home.
- Prevented stale creator metadata from blocking or advancing the wrong Short.
- Prevented native Next controls and scroll fallback from advancing twice.
- Avoided repeated navigation loops when YouTube does not expose a usable next Short.
- Stored and displayed handle-backed creators by their stable YouTube handle without the leading `@`, instead of a mutable channel title or unrelated hidden header label such as "Community".
- Prevented same-named channels with different stable handles from being treated as the same creator.
- Migrated older handle-backed entries with title-based labels during extension startup or update, while retaining current public titles only as non-visible fallbacks for linkless cards.

### Changed

- Replaced the subtle channel-profile header symbol with the larger ChannelFence icon.
- Updated the packaged extension homepage to `https://channelfence.app/`.

### Tests

- Added deterministic coverage for slow controls, stale renderers, unresolved owners, route changes, sequential blocks, and double-advance races.
- Added live YouTube coverage for opening a pre-blocked Short without returning Home.
- Added deterministic and live coverage for canonical handle labels, legacy-label migration, and safe collaboration matching, including the real `@rokujones` profile.

There are no new permissions, no remote code, and no analytics in this release.

Install from the Chrome Web Store:

```text
https://chromewebstore.google.com/detail/channelfence-%E2%80%93-youtube-ch/koeingndpmmgabfoihkcoikiopgkjenm?utm_source=github&utm_medium=organic&utm_campaign=30day_growth&utm_content=v0_2_2_release
```
