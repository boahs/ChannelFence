# Chrome Web Store listing copy

## Product name

ChannelFence – YouTube Channel Blocker

## Summary

Block YouTube channels and creators across Home, search, recommendations, Shorts, comments, and direct visits.

## Detailed description

ChannelFence is an open-source, privacy-first YouTube channel blocker for Chrome. Block a YouTube channel or creator once, and ChannelFence hides their content across supported Home feeds, search results, recommendations, Watch Next, Shorts, playlists, comments, and direct pages.

Features:

- Block creators with one click beside their channel name.
- Block directly from supported video and compact Shorts three-dot menus with a clearly labeled ChannelFence action.
- Add a creator manually by pasting their YouTube handle or channel URL.
- Block the current creator directly from the YouTube Shorts viewer and move to the next Short.
- Block a creator from a compact Shorts card without opening the Short or leaving the feed.
- Optionally hide Shorts shelves and cards from Home, search, and other feeds while keeping the Shorts viewer available.
- Hide videos, Shorts, recommendations, and comments from blocked creators.
- Stop direct visits with a clear blocked-page screen.
- Undo a block immediately or manage your complete block list at any time.
- Pause blocking without deleting your list.
- Import or export a private block-list backup.
- No account, analytics, tracking, advertising, remote code, or developer-controlled server.

Privacy by design:

ChannelFence processes public creator names, channel identifiers, channel URLs, and user-selected compact Short paths only to provide its blocking feature. Your settings and block list remain in Chrome’s local extension storage and are never transmitted to the developer. While your block list is not empty, public compact Short URLs are sent only to YouTube's oEmbed endpoint to retrieve creator metadata and determine whether their creators are blocked. Requests omit account credentials, and returned metadata is cached only in memory. ChannelFence makes no requests to a developer-controlled server or non-YouTube service.

ChannelFence is open-source software released under the MIT License.

Source code: https://github.com/boahs/ChannelFence

ChannelFence is an independent extension and is not affiliated with, endorsed by, or sponsored by Google LLC.

YouTube is a trademark of Google LLC.

## Additional fields

- **Homepage URL:** https://boahs.github.io/ChannelFence/
- **Support URL:** https://github.com/boahs/ChannelFence/issues
- **Official URL:** Select the verified `boahs.github.io/ChannelFence` property when it is available in the dashboard.

## Category

Workflow & Planning

## Language

English (United States)

## Single purpose statement

ChannelFence gives users local controls for hiding selected YouTube creators and optional Shorts shelves in YouTube feeds.

## Permission justification

### storage

Required to save the user's enabled state, comment and feed-level Shorts preferences, and blocked-creator list locally on the device.

### www.youtube.com and m.youtube.com site access

Required to read public creator identifiers from the page, retrieve public creator metadata from YouTube when compact Shorts omit that identity and the block list is not empty, add user-facing block buttons, hide matching content, and display the direct-navigation block screen. The extension does not request access to other websites.

## Privacy practices answers

- **Does the extension collect or use user data?** Yes, conservatively disclose local processing of website content and user-generated block-list selections.
- **Website content:** Public creator display names, public channel handles/identifiers, public channel URLs, and a compact Short path that the user explicitly selects for blocking are processed to provide blocking. User-selected records are stored locally.
- **Web history:** Not collected or recorded. The extension does not maintain browsing history. A compact Short path is saved only when the user explicitly blocks from that card, as part of the selected creator record.
- **Authentication, personal communications, location, financial, health, and personally identifiable information:** Not collected.
- **Data sale:** No.
- **Data use for unrelated purposes:** No.
- **Data use for creditworthiness or lending:** No.
- **Remote transmission:** While the block list is not empty, compact Shorts lookups send public Short URLs only to youtube.com so YouTube can return public creator metadata. Requests omit account credentials. Settings and block-list records are not transmitted.
- **Limited Use certification:** Yes. Data use is limited to the extension’s disclosed single purpose.

These answers must match the dashboard wording visible at submission time. If Google changes the questionnaire, answer conservatively and keep the dashboard, listing, and privacy policy consistent.

## Suggested screenshot captions

1. Block any creator from the three-dot menu or beside their channel name.
2. Their videos disappear across Home, search, and recommendations.
3. Direct visits are stopped too.
4. Add by handle, or review, search, export, and edit your private block list.
5. Local-only storage. No account and no tracking.

## Promotional copy

- **Primary headline:** Never see that creator again.
- **Supporting line:** One click. Every supported YouTube surface. Your list stays private.
- **Call to action:** Add to Chrome
