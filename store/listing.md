# Chrome Web Store listing copy

## Product name

ChannelFence – YouTube Channel Blocker

## Summary

Block YouTube channels and creators across Home, search, recommendations, Shorts, comments, and direct visits.

## Detailed description

ChannelFence is an open-source, privacy-first YouTube channel blocker for Chrome. Block a YouTube channel or creator once, and ChannelFence hides their content across supported Home feeds, search results, recommendations, Watch Next, Shorts, playlists, comments, and direct pages.

What's new in 0.2.10:

- Block buttons now appear before creator names by default. Choose before or after in Appearance settings; the order follows YouTube's reading direction on supported video cards and comments.
- Improved creator-name and block-button layouts on narrow cards and compact Home grids.
- Hide Shorts in feeds now keeps a channel's dedicated Shorts tab available. Shorts shelves on Home, channel Home, and search stay hidden, and blocked creators stay blocked.
- The toolbar's saved block-list count is now optional and off by default. Turn it on in settings if you want to see your total number of blocked creators.
- Translated the new settings into all eighteen supported interface languages. Permissions and data handling are unchanged.

Features:

- Block creators beside their channel name or from supported video and compact Shorts menus, without leaving the feed.
- Choose whether inline block buttons appear before or after creator names on supported video cards and comments. Channel headers, menus, and Shorts viewer controls keep their positions.
- Add a creator manually using their YouTube handle or channel URL.
- Block the current creator in the Shorts viewer and continue to the next Short.
- Optionally hide Shorts shelves and cards from Home, channel Home, search, and other feeds while keeping channel Shorts tabs and the Shorts viewer available.
- Customize Home with separate controls for sponsored cards, annoying YouTube features, and thumbnail size. Regular recommendations, courses, mixes, and top category filters remain available; Shorts use their own setting. Attached surveys can be hidden without removing their videos. These controls do not hide search information panels or ads during video playback.
- Hide collaboration videos when YouTube identifies a creator you've blocked.
- Stop supported direct visits with a clear blocked-page screen.
- Undo a block immediately or manage your complete block list at any time.
- Pause blocking without deleting your list.
- Optionally show your total saved blocked-creator count on the toolbar icon. This is off by default and is not a count of content hidden on the current page.
- Import or export a private block-list backup.
- Use eighteen interface languages, including Arabic with right-to-left layouts. Follow Chrome's interface language or choose a language in settings; YouTube keeps its own language setting.
- No account, extension analytics, tracking, advertising, remote code, or developer-controlled server.

Privacy by design:

ChannelFence processes public creator names, channel identifiers, channel URLs, and user-selected compact Short paths only to provide its blocking feature. Your settings and block list remain in Chrome's local extension storage and are never transmitted to the developer.

Appearance preferences and the optional toolbar count are applied locally and make no additional network requests.

While your block list is not empty, ChannelFence may send public compact Short URLs directly to YouTube to look up their creators. These requests omit account credentials, and returned metadata is cached only in memory. ChannelFence makes no requests to a developer-controlled server or non-YouTube service.

ChannelFence is open-source software released under the MIT License.

Source code:
https://github.com/boahs/ChannelFence

Website:
https://channelfence.app/

What's new:
https://channelfence.app/changelog/

Support and bug reports:
https://channelfence.app/support/

Privacy policy:
https://channelfence.app/PRIVACY.html

ChannelFence is independent software and is not affiliated with, endorsed by, or sponsored by Google LLC.

YouTube is a trademark of Google LLC.

## Release notes for 0.2.10

Use this shorter update summary wherever the submission or release form asks for release notes. The detailed description above also includes a What's new section.

- Moved inline block buttons before creator names by default, with a before/after choice under Appearance in full settings.
- Kept creator names and block buttons inside narrow cards, including compact Home grids.
- Kept channel Shorts tabs available when Hide Shorts in feeds is on. Home, channel Home, and search Shorts shelves remain hidden; creator blocks still apply.
- Made the toolbar's total saved blocked-creator count optional and off by default.
- Translated the new settings into all eighteen supported interface languages.

No new permissions or additional network requests. Settings and block lists remain stored locally, with no extension analytics or developer-controlled server.

## Additional fields

- **Homepage URL:** https://channelfence.app/
- **Support URL:** https://channelfence.app/support/
- **Official URL:** Select the verified `channelfence.app` property after the custom domain is live and verified in Search Console.

## Category

Workflow & Planning

## Language

English (United States)

## Single purpose statement

ChannelFence gives users local controls to customize their YouTube feeds by hiding selected creators and optional feed content, and adjusting the Home grid.

## Permission justification

### storage

Required to save the user's enabled state, interface language, comment and feed appearance preferences, block-button position, toolbar-count preference, and blocked-creator list locally on the device.

### www.youtube.com and m.youtube.com site access

Required to read public creator identifiers and page structure, retrieve public creator metadata from YouTube when compact Shorts omit that identity and the block list is not empty, add user-facing block buttons, hide matching content, apply the user's optional Home appearance preferences, and display the direct-navigation block screen. The extension does not request access to other websites.

## Privacy practices answers

- **Does the extension collect or use user data?** Yes, conservatively disclose local processing of website content and user-generated block-list selections.
- **Website content:** Public creator display names, public channel handles/identifiers, public channel URLs, and a compact Short path that the user explicitly selects for blocking are processed to provide blocking. Page structure is read to apply selected feed appearance preferences. User-selected records and settings are stored locally.
- **Web history:** Not collected or recorded. The extension does not maintain browsing history. A compact Short path is saved only when the user explicitly blocks from that card, as part of the selected creator record.
- **Authentication, personal communications, location, financial, health, and personally identifiable information:** Not collected.
- **Data sale:** No.
- **Data use for unrelated purposes:** No.
- **Data use for creditworthiness or lending:** No.
- **Remote transmission:** While the block list is not empty, compact Shorts lookups send public Short URLs only to youtube.com so YouTube can return public creator metadata. Requests omit account credentials. Settings and block-list records are not transmitted.
- **Limited Use certification:** Yes. Data use is limited to the extension’s disclosed single purpose.

These answers must match the dashboard wording visible at submission time. If Google changes the questionnaire, answer conservatively and keep the dashboard, listing, and privacy policy consistent.

## Suggested screenshot captions

1. Block from a video's menu without opening the creator's channel.
2. One block follows the creator across supported YouTube surfaces.
3. Block a creator while viewing Shorts and continue to the next Short.
4. Hide Shorts in feeds while keeping channel Shorts tabs and the Shorts viewer available.
5. Search, edit, import, or export your private block list.

## Promotional copy

- **Primary headline:** Never see that creator again.
- **Supporting line:** One click. Every supported YouTube surface. Your list stays private.
- **Call to action:** Add to Chrome
