# Chrome Web Store submission checklist

## Required before upload

- [x] Manifest V3 package with self-contained code.
- [x] Narrow `storage` permission and YouTube-only content-script matches.
- [x] 16, 32, 48, and 128px icons.
- [x] Clear single-purpose listing copy.
- [x] Privacy policy source matching actual behavior.
- [x] Import/export and complete local data deletion controls.
- [ ] Test the unpacked extension against current YouTube Home, Search, Watch, Shorts, channel, and comments pages.
- [x] Publish a public support channel in `PRIVACY.md` and `ui/privacy.html`.
- [x] Host the final privacy policy on a public HTTPS URL.
- [x] Add the public privacy-policy URL in the Developer Dashboard.
- [ ] Add and verify an official website in Google Search Console if one will be shown as the publisher URL.
- [x] Capture current 1280×800 product screenshots; five are recommended.
- [x] Review the small promotional tile and optional marquee image.
- [x] Run the complete tests and create the final ZIP.
- [x] Add the source repository, homepage, and support URLs to the listing copy.

## Dashboard declarations

- **Single purpose:** Hide content from creators explicitly blocked by the user while the user browses YouTube.
- **Storage permission:** Save settings and blocked creators locally.
- **Host access:** Identify creators and modify displayed content only on YouTube pages.
- **Remote code:** No.
- **External network requests:** No.
- **Analytics or advertising:** No.
- **Data sale or unrelated transfer:** No.
- **Website content:** Disclose public creator names/identifiers processed on the page and user-selected entries stored locally.
- **Web history:** Not recorded or retained.

## Manual acceptance test

1. Install unpacked and confirm the welcome page opens only on first install.
2. On Home, block a creator and confirm all visible cards for that creator disappear.
3. Select Undo and confirm the cards return.
4. Block again and test Search, Watch Next/right-rail recommendations, Shorts, playlists, and comments.
5. Navigate directly to the blocked creator’s channel and a video by that creator; confirm the block screen appears and playback is paused.
6. Unblock from the direct-navigation screen and confirm the page becomes available.
7. Pause ChannelFence from the popup and confirm hidden content returns without deleting the list.
8. Export, clear, and re-import the list.
9. In settings, add a creator by handle and by channel URL, then confirm invalid video URLs are rejected.
10. Refresh and restart Chrome; confirm settings persist.
11. Review the console on each tested surface for errors.

## Reviewer notes to paste with the submission

ChannelFence has one purpose: users select YouTube creators whose content should be hidden. To test, open youtube.com, select the small ⊘ control beside a creator name, and observe that matching content is hidden. The toolbar popup can pause the feature or block the creator on the current channel/video page. The options page can add a handle or channel URL manually and manages, exports, imports, or clears the local block list. No login is required. The extension makes no external network requests and contains no remote code.

## Branding check

- Do not use the YouTube play-button logo or a modified/crossed-out version as the extension icon.
- Refer to compatibility in prose and include the Google trademark attribution.
- Use only standard, unaltered YouTube screenshots to demonstrate the extension in context.
