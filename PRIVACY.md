# ChannelFence Privacy Policy

Effective date: November 1, 2026

Applies to ChannelFence for Chrome and desktop Firefox. Browser references clarified November 8, 2026; data practices are unchanged.

ChannelFence is designed to work without an account, analytics, advertising, or a developer-controlled server. Its single purpose is to give users local controls to customize their YouTube feeds by hiding selected creators and optional feed content, and adjusting the Home grid.

## Information ChannelFence processes

While you use YouTube, ChannelFence reads limited page content needed to identify creator names and channel links, determine whether a creator is on your block list, add block controls, and hide matching content. When your block list is not empty, compact Shorts cards that omit their creators are checked using YouTube's oEmbed endpoint so ChannelFence can determine whether their creators are blocked. ChannelFence keeps parsed compact Shorts metadata only in memory and does not add it to browsing history or extension storage. When you choose to block a creator, ChannelFence stores that creator’s displayed name, public channel identifier or handle, public channel URL, and the time the block was created. If you block from a compact Short, ChannelFence also stores that user-selected public Short path with the creator record so the exact card remains hidden after a refresh.

ChannelFence also reads page structure to apply your selected Home appearance preferences. These preferences are applied locally without additional network requests.

## Storage and transmission

The saved settings include whether ChannelFence is enabled, the interface language, and the user's comment, Shorts visibility, and Home appearance preferences.

Settings and blocked-creator records are stored only in your browser’s local extension storage on your device and are never transmitted to the developer. Compact Shorts lookups send only public Short URLs to youtube.com so YouTube can return their public creator names and channel URLs. Requests omit account credentials and the current page referrer. ChannelFence keeps parsed creator metadata in memory; the browser may also cache the HTTP response. ChannelFence makes no requests to a developer-controlled server or any non-YouTube service. It does not sell data, use data for advertising, or permit humans to read user data.

## Permissions

- **Storage:** saves the enabled state, language preference, comment and feed appearance preferences, and blocked-creator list locally.
- **Access to youtube.com:** identifies creators on YouTube pages, adds user-facing block controls, hides matching content, and applies your selected Home appearance preferences.
- **Firefox website-content disclosure:** covers the public compact Short URLs sent directly to YouTube for creator lookups. No data is sent to the developer.

## Data control and deletion

You can view, export, unblock, or clear blocked creators from ChannelFence settings. Uninstalling ChannelFence causes your browser to remove the extension’s locally stored data.

## Limited Use

ChannelFence’s use of information is limited to providing and improving its single user-facing purpose. Information is not transferred for advertising, credit decisions, data brokerage, or unrelated purposes.

## Changes

If ChannelFence’s data practices change, this policy and the Chrome Web Store and Firefox Add-ons disclosures will be updated before the changed practice is introduced.

## Contact

For privacy and support questions, contact [@GetChannelFence on X](https://x.com/GetChannelFence) or use the [ChannelFence issue tracker](https://github.com/boahs/ChannelFence/issues).
