# Changelog

<a id="v0-2-8"></a>

## [0.2.8](#v0-2-8) - 2026-11-01

- Added Japanese, Brazilian Portuguese, Russian, Spanish, French, German, Simplified Chinese, Traditional Chinese, Hindi, Indonesian, Bengali, Turkish, Vietnamese, Arabic, Italian, and Dutch interfaces alongside English and Korean.
- Translated settings, the popup, onboarding, privacy information, and blocking controls. ChannelFence follows Chrome's interface language by default.
- Added a language choice in settings. Choose any supported language or return to automatic detection, with open ChannelFence controls updating immediately. YouTube keeps its own language setting.
- Kept creator names and block-list backups unchanged, with English as the fallback for untranslated browser languages.
- Fixed long privacy headings overflowing narrow windows.
- Kept long translated Shorts action labels readable by allowing them to wrap without overlapping the next button.
- Added right-to-left layouts for Arabic, including mixed-language controls on YouTube and readable creator names and URLs.

<details markdown="1">
<summary>Technical details and tests</summary>

### Changed

- Added bundled `ja`, `pt_BR`, `ru`, `es`, `fr`, `de`, `zh_CN`, `zh_TW`, `hi`, `id`, `bn`, `tr`, `vi`, `ar`, `it`, and `nl` message catalogs using the existing Chrome localization system.
- Used count-neutral Russian wording where a single plural form would be incorrect.
- Saved the language preference locally and reused bundled catalogs for manual overrides.

### Tests

- Extended shared browser regressions to all eighteen supported interfaces, including Unicode handles, block and Undo controls, import feedback, privacy links, and narrow layouts.
- Added checks for saved language overrides, switching back to automatic detection, and updates across open extension pages and YouTube controls.
- Added YouTube fixtures for statistics, creator menus, and collaborator identities in each new language.
- Extended live YouTube checks to these languages for channel headers, search results, watch recommendations, compact Shorts, and the Shorts viewer action layout. The checks verify both Chrome's interface language and YouTube's rendered language.
- Attached screenshots of extension pages, blocking controls, and open menus to the browser test reports for visual review.
- Added mixed-direction checks for Arabic ChannelFence on English YouTube and English ChannelFence on Arabic YouTube.

There are no new permissions, additional external network requests, remote code, or extension analytics in this release. Translations are bundled locally; website and store-listing translations are separate.

</details>

<a id="v0-2-7"></a>

## [0.2.7](#v0-2-7) - 2026-10-30

- Added a Korean interface for settings, the popup, onboarding, privacy information, and blocking controls. English remains the fallback for other browser languages.
- Fixed block buttons incorrectly appearing beside Korean view counts and upload ages.
- Improved creator blocking from menus on Korean YouTube.

<details markdown="1">
<summary>Technical details and tests</summary>

### Changed

- Added bundled English and Korean message catalogs using Chrome's built-in localization. Chrome's interface language selects the translation independently of YouTube's language.
- Preserved creator names, channel identities, and block-list backups without translating them.

### Fixed

- Used YouTube metadata groups and menu containers to identify statistics and menu controls without depending on their English labels.
- Cleared stale menu context when a card has no identified creator, preventing unrelated or generic creator actions from appearing.

### Tests

- Added Korean interface checks, English fallback checks, and mixed browser/YouTube language coverage.
- Added regression fixtures for Korean, Japanese, and Arabic metadata, plus Unicode creator identities. These checks do not establish full support for those additional interfaces or YouTube locales.
- Added live Korean YouTube checks for channel pages, search results, watch recommendations, and compact Shorts.

There are no new permissions, additional network requests, remote code, or extension analytics in this release. Translations are bundled locally.

</details>

<a id="v0-2-6"></a>

## [0.2.6](#v0-2-6) - 2026-09-30

- Fixed upload ages such as "16h ago" being mistaken for creator names on channel Videos pages.
- Kept real creator controls working beside compact video statistics.

<details markdown="1">
<summary>Technical details and tests</summary>

### Fixed

- Stopped abbreviated upload ages such as `16h ago` and `5d ago` from being mistaken for creator names on channel Videos cards.
- Preserved legitimate avatar and text creator controls beside compact video statistics.

### Tests

- Added browser regressions for compact timestamps and for blocking a real creator beside abbreviated statistics.

Includes the collaboration and feed layout fixes from 0.2.5. The release ZIP now includes the existing MIT license. There are no new permissions, additional network requests, remote code, or analytics in this release.

</details>

<a id="v0-2-5"></a>

## [0.2.5](#v0-2-5) - 2026-09-15

- Fixed empty spaces left by blocked videos in some Home layouts.
- Let remaining videos fill those gaps while keeping their order and full-width shelves in place.

<details markdown="1">
<summary>Technical details and tests</summary>

### Fixed

- Collapsed the enclosing grid tile when a blocked video's inner card is hidden, removing the empty tile left in some Home layouts.
- Allowed remaining video cards to fill gaps across fixed Home rows while preserving their order and full-width shelf boundaries.

### Tests

- Added browser checks of actual card positions after blocking, Undo, pause/resume, collaboration label updates, and reused cards, including feeds with a full-width shelf.

Includes the collaboration matching fixes from 0.2.4. There are no new permissions, additional network requests, remote code, or analytics in this release.

</details>

<a id="v0-2-4"></a>

## [0.2.4](#v0-2-4) - 2026-09-15

- Improved blocking for videos with multiple creators, including some bylines without channel links.
- Kept collaborators with different channel links separate even when their names match.
- Preserved existing individual blocks. If YouTube only shows "A and 2 more," unnamed collaborators still cannot be identified from that count alone.

<details markdown="1">
<summary>Technical details and tests</summary>

### Fixed

- Recognized individual creator names in combined collaboration bylines, including two- and three-creator cards without channel links, so existing individual blocks can hide matching collaborations.
- Stopped treating summary text such as `Business Insider and 2 more` as a single creator; used fuller creator labels when YouTube exposes them.
- Kept collaborators with separate channel links distinct even when their display names match.
- Kept shared-byline controls bound to the selected collaborator and refreshed enclosing feed cards when YouTube reuses their metadata.

### Changed

- Documented collaboration matching limits and Chrome Canary testing before Web Store upload. When YouTube exposes only `A and 2 more`, only A can match; unnamed collaborators cannot be inferred from the count.
- Preserved existing individual block entries. Older combined-name entries can be removed manually and the named creator blocked from their channel page if needed.

### Tests

- Added 19 browser regressions for collaboration matching, individual inline/menu actions, collapsed and full labels, same-named channels, card reuse, and Undo.

There are no new permissions, no additional network requests, no remote code, and no analytics in this release.

</details>

<a id="v0-2-3"></a>

## [0.2.3](#v0-2-3) - 2026-09-03

- Made popup footer links easier to read in light and dark themes.
- Added an optional Chrome Web Store review link in settings.

<details markdown="1">
<summary>Technical details and tests</summary>

### Changed

- Improved the popup footer-link contrast in both light and dark themes.
- Added an optional link in settings for users who want to leave an honest Chrome Web Store review.

### Tests

- Added extension UI coverage for the Chrome Web Store review link.

There are no new permissions, no remote code, and no analytics in this release.

</details>

<a id="v0-2-2"></a>

## [0.2.2](#v0-2-2) - 2026-08-29

- Fixed unexpected returns to Home, double advances, and repeated navigation while blocking Shorts.
- Used stable YouTube handles for saved creator labels and kept different channels with matching names separate.
- Made the channel-profile block control easier to recognize.

<details markdown="1">
<summary>Technical details and tests</summary>

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

</details>

<a id="v0-2-1"></a>

## [0.2.1](#v0-2-1) - 2026-08-28

- Removed duplicate block controls and improved creator detection as YouTube updates its pages.
- Reduced cases where video statistics were mistaken for creator names.
- Improved handling of large block lists, with faster matching and a searchable, paged settings list.

<details markdown="1">
<summary>Technical details and tests</summary>

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

</details>
