# GitHub Release: ChannelFence v0.2.1

Use this file when creating the public GitHub Release. Creating the tag, Release, or upload remains a separate public action.

## Release fields

- Tag: `v0.2.1`
- Target: `main`
- Title: `ChannelFence v0.2.1`
- Attachment: `dist/ChannelFence-0.2.1.zip`
- Current package size: 325,572 bytes.
- Current SHA-256: `857B83319F206D1F4CDB90F6F54A62B61705C69DC7CCDCD2FE1C7F5CEEAAA185`

Recalculate the hash immediately before publishing. If it differs, confirm why before uploading the ZIP.

## Release notes

ChannelFence 0.2.1 focuses on reliability and large block lists.

### Fixed

- Prevented duplicate block controls on channel Home and Videos pages.
- Kept one channel header control while preserving separate controls for real collaborators.
- Stopped view counts, upload ages, durations, and other metadata from being mistaken for creators.
- Improved handling of visible and hidden creator bylines while YouTube hydrates or reuses cards.
- Refreshed channel identity correctly during YouTube's client-side navigation.

### Performance

- Added indexed matching for aliases, creator names, and known Short paths instead of repeatedly scanning the full block list.
- Avoided rebuilding an unchanged block list after storage events.
- Deferred storage-triggered rescans while a YouTube tab is hidden.
- Paged large lists in the options screen while keeping the full list searchable.

### Tests

- Added regression coverage for duplicate controls, channel tabs, collaborations, delayed creator labels, courses, right-rail cards, sponsored cells, and client-side channel navigation.
- Added large-list coverage with 500 entries in the options screen and 1,000 blocked creators in feed matching.

There are no new permissions, no remote code, and no analytics in this release.

Install from the Chrome Web Store:

```text
https://chromewebstore.google.com/detail/channelfence-%E2%80%93-youtube-ch/koeingndpmmgabfoihkcoikiopgkjenm?utm_source=github&utm_medium=organic&utm_campaign=30day_growth&utm_content=v0_2_1_release
```
