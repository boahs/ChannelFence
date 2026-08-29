# ChannelFence Privacy Policy

Effective date: August 27, 2026

ChannelFence is designed to work without an account, analytics, advertising, or a developer-controlled server. Its single purpose is to give users local controls for hiding selected creators and optional Shorts shelves in YouTube feeds.

## Information ChannelFence processes

While you use YouTube, ChannelFence reads limited page content needed to identify creator names and channel links, determine whether a creator is on your block list, add block controls, and hide matching content. When your block list is not empty, compact Shorts cards that omit their creators are checked using YouTube's oEmbed endpoint so ChannelFence can determine whether their creators are blocked. The returned compact Shorts metadata is cached only in memory and is not added to browsing history or extension storage. When you choose to block a creator, ChannelFence stores that creator’s displayed name, public channel identifier or handle, public channel URL, and the time the block was created. If you block from a compact Short, ChannelFence also stores that user-selected public Short path with the creator record so the exact card remains hidden after a refresh.

## Storage and transmission

The saved settings include whether ChannelFence is enabled and the user's comment and feed-level Shorts visibility preferences.

Settings and blocked-creator records are stored only in Chrome’s local extension storage on your device and are never transmitted to the developer. Compact Shorts lookups send only public Short URLs to youtube.com so YouTube can return their public creator names and channel URLs. Requests omit account credentials. ChannelFence makes no requests to a developer-controlled server or any non-YouTube service. It does not sell data, use data for advertising, or permit humans to read user data.

## Permissions

- **Storage:** saves the enabled state, comment and feed-level Shorts preferences, and blocked-creator list locally.
- **Access to youtube.com:** identifies creators on YouTube pages, adds user-facing block controls, and hides content from blocked creators.

## Data control and deletion

You can view, export, unblock, or clear blocked creators from ChannelFence settings. Uninstalling ChannelFence causes Chrome to remove the extension’s locally stored data.

## Limited Use

ChannelFence’s use of information is limited to providing and improving its single user-facing purpose. Information is not transferred for advertising, credit decisions, data brokerage, or unrelated purposes.

## Changes

If ChannelFence’s data practices change, this policy and the Chrome Web Store disclosures will be updated before the changed practice is introduced.

## Contact

Privacy and support questions can be sent to `support@channelfence.app` or submitted through the [ChannelFence issue tracker](https://github.com/boahs/ChannelFence/issues).
