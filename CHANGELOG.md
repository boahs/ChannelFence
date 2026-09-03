# Changelog

## 0.2.3 - 2026-09-03

### Changed

- Improved the popup footer-link contrast in both light and dark themes.
- Added an optional link in settings for users who want to leave an honest Chrome Web Store review.

### Tests

- Added extension UI coverage for the Chrome Web Store review link.

There are no new permissions, no remote code, and no analytics in this release.

## 0.2.2 - 2026-08-29

### Fixed

- Kept blocked Shorts navigation inside the Shorts viewer instead of returning to Home.
- Prevented stale creator metadata from blocking or advancing the wrong Short during YouTube's client-side navigation.
- Prevented native Next controls and scroll fallback from advancing twice for one blocked Short.
- Kept unresolved or unavailable Shorts routes stable instead of entering repeated navigation loops.
- Stored and displayed handle-backed creators by their stable YouTube handle without the leading `@`, instead of a mutable channel title or unrelated hidden header label such as "Community".
- Prevented matching display names from overriding a different stable channel handle, including collaboration cards.
- Migrated older handle-backed entries with title-based labels during extension startup or update, and retained current public titles only as non-visible fallbacks for linkless cards.

### Changed

- Replaced the subtle channel-profile header symbol with the larger ChannelFence icon.
- Updated the extension homepage to `https://channelfence.app/`.

### Tests

- Added deterministic coverage for slow Shorts controls, stale renderers, unresolved owners, canonical route changes, and double-advance races.
- Added live YouTube coverage for opening a pre-blocked Short without returning Home.
- Added deterministic and live coverage for canonical handle labels, legacy-label migration, and safe linked/linkless collaboration matching, including the real `@rokujones` profile.

There are no new permissions, no remote code, and no analytics in this release.

## 0.2.1 - 2026-08-28

The `0.2.1` package was prepared on August 28, 2026.

### Fixed

- Prevented duplicate block controls on channel Home and Videos pages.
- Preserved separate controls for real collaborators while keeping one channel header control.
- Stopped view counts, upload ages, durations, and other metadata from being mistaken for creators.
- Improved creator detection while YouTube hydrates or reuses cards.
- Refreshed channel identity during YouTube's client-side navigation.

### Performance

- Added indexed matching for aliases, creator names, and known Short paths.
- Avoided rebuilding an unchanged block list after storage events.
- Deferred storage-triggered rescans while a YouTube tab is hidden.
- Paged large block lists in settings while keeping the full list searchable.

### Tests

- Added coverage for duplicate controls, channel tabs, collaborations, delayed labels, courses, right-rail cards, sponsored cells, and client-side navigation.
- Added large-list coverage with 500 entries in settings and 1,000 blocked creators in feed matching.

There are no new permissions, no remote code, and no analytics in this release.
