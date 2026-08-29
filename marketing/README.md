# ChannelFence 30-day growth campaign

This directory is the working handbook for the proposed ChannelFence growth campaign. It does not authorize a DNS change, public account change, release, post, submission, advertising launch, or advertising spend. Each external action still needs the user's approval. Start Day 1 on the first Monday after the Day 0 readiness checks are complete.

## Files

- [domain-cutover.md](domain-cutover.md): Namecheap, GitHub Pages, HTTPS, Search Console, and support forwarding.
- [utm-links.md](utm-links.md): exact attribution links for every approved channel.
- [measurement.md](measurement.md): local Store-reporting setup, snapshot commands, and the 48-hour backfill routine.
- [daily-funnel-template.csv](daily-funnel-template.csv): copy this to a private local file for daily Store and retention snapshots.
- [asset-performance-template.csv](asset-performance-template.csv): copy this to a private local file for channel- and asset-level results.
- [external-updates.md](external-updates.md): fields to change on public listings after the domain is live.
- [show-hn-checklist.md](show-hn-checklist.md): readiness rules without generated submission copy.
- [paid-search.md](paid-search.md): optional Day 11 test and hard stop rules.
- [release-v0.2.1.md](release-v0.2.1.md): prepared GitHub Release fields and changelog.
- [release-v0.2.2.md](release-v0.2.2.md): prepared GitHub Release fields for the next Store update.

## Goal and funnel math

- Baseline: about 7 active Chrome Web Store users.
- Goal: 250 active users by Day 30.
- Net growth needed: 243 active users.
- Retention assumption: 80 percent of gross installs remain active.
- Gross installs needed: about 304.
- Qualified Store visits needed at a 15 to 20 percent conversion rate: about 1,500 to 2,050.
- Daily average: 10 gross installs and 50 to 70 qualified Store visits.
- Available time: up to two hours per day.
- Base case: 100 to 175 active users.
- Stretch case: 250 active users, most likely after one Short or Show HN submission breaks out.
- Optional paid test: up to $150 after separate approval, with a hard lifetime cap of $250 and another approval required before any scale step.

The campaign optimizes for retained users, not raw clicks. Chrome Web Store discovery considers ratings, downloads compared with uninstalls, usability, design, and listing quality. Do not send a large traffic spike to a listing that is inaccurate or converting poorly.

## Current readiness state

- `channelfence.app` is registered, verified, and serving the GitHub Pages site over HTTPS. The old Pages URL and `www` redirect to the apex domain.
- The repository publishes the custom domain through `CNAME`; rerun the routing checks in [domain-cutover.md](domain-cutover.md) after every Pages or DNS change.
- The prepared Store package is `0.2.2`. Publish its matching GitHub release only after the Chrome Web Store reports version `0.2.2` publicly.
- Day 0 is setup and verification. Day 1 is the first campaign measurement day after all Day 0 checks pass; record the actual calendar date and Eastern time in both private logs.

## Audience and message

Primary audience: desktop YouTube users who know specific creators they do not want to encounter again.

Secondary audiences:

- Heavy Shorts users who want to block creators or hide Shorts shelves.
- Privacy-conscious users who prefer open-source, local-only extensions.
- Power users who find YouTube's recommendation controls insufficient.
- ChromeOS users who can install desktop Chrome extensions.

Do not target mobile users, parental-control shoppers, ad-blocking searches, enterprise buyers, or people looking to block reuploads across unrelated channels.

Use this message order:

1. A persistent block list for YouTube creators.
2. Block a creator once across supported Home feeds, search, Watch Next, Shorts, comments, and direct visits.
3. YouTube's "Don't recommend channel" changes recommendations. It is not a persistent site-wide creator block list.
4. Free, open source, and local-only. No account or extension analytics.

Treat Hide Shorts as a secondary benefit. Do not claim that ChannelFence retrains YouTube's algorithm or removes copies uploaded by other channels.

## Day 0: Readiness and measurement setup

- [x] Confirm `channelfence.app` is registered in the intended Namecheap account, then enable the security settings in [domain-cutover.md](domain-cutover.md).
- [x] Complete the DNS and GitHub Pages routing steps in [domain-cutover.md](domain-cutover.md).
- [ ] Confirm the homepage, `www` redirect, HTTPS certificate, canonical URL, Search Console ownership, and sitemap.
- [ ] Publish and test `https://channelfence.app/support/` before using it as a public support URL.
- [ ] Deploy all four search-intent pages together and verify their canonical URLs, social cards, and Store links.
- [ ] Confirm every public call to action reaches the correct Store listing.
- [ ] Confirm every campaign link follows [utm-links.md](utm-links.md).
- [ ] Replace the Store gallery with the current readable captures in the approved order.
- [ ] Replace the YouTube auto-thumbnail with `A REAL YOUTUBE BLOCK LIST` and current UI.
- [ ] Confirm the Store description, website, privacy policy, and extension behavior make the same claims.
- [ ] Run CI, unit, regression, live YouTube, and performance checks.
- [ ] Confirm the public Chrome Web Store detail page reports version `0.2.2` before publishing the matching GitHub release or promoting its features.
- [ ] Record the baseline in private copies of [daily-funnel-template.csv](daily-funnel-template.csv) and [asset-performance-template.csv](asset-performance-template.csv).
- [ ] Wait until updated Store media is publicly visible before Show HN or paid traffic.

## Measurement rules

- Chrome Web Store reporting can take 24 to 48 hours to settle and may suppress small samples. Label recent rows `provisional`; only use a row for decisions after at least 48 hours and then label it `final`.
- Keep dashboard totals separate from attributed Store analytics. Do not subtract or combine values from different reporting windows.
- Chrome Web Store documentation guarantees forwarding for `utm_source`, `utm_medium`, and `utm_campaign`. Keep `utm_content` stable as an internal asset registry, but do not claim content-level attribution until it is visibly reported and validated.
- Store conversion rate is attributable gross installs divided by tagged Store page views for the same final window. Retained installs require later evidence from active users, uninstalls, and disables; they are not the same as gross installs.
- Use one row per daily snapshot in the funnel log and one row per asset and snapshot in the asset log. Record the capture time and data status on every row.

## Days 1 to 3: Initial promotion and conversion

- Finalize the Day 0 baseline after its reporting window has settled.
- Recheck the live domain, Store gallery, YouTube thumbnail, support page, and tagged calls to action.
- Update approved GitHub metadata and, with separate approval, publish the `v0.2.2` release only after the Store publicly reports `0.2.2`.
- Promote the channel-blocking and recommendation-preference articles that were deployed on Day 0.
- Update only the owned public profiles approved for this campaign.

## Day 4: YouTube relaunch

- Update the long-form title to `How to Block YouTube Creators Across Home, Search, and Shorts | ChannelFence`.
- Put the tagged Store link in the first two description lines.
- Add the website and GitHub repository below it.
- Pin a comment containing the tagged Store link.
- Put the video in a dedicated ChannelFence playlist.
- Publish a Community post only if the channel has access.

## Day 5: LinkedIn native video

- Upload the demo as native video from the personal account.
- Open with the user problem, then show the block and immediate result.
- Briefly mention the live and Playwright tests needed to keep up with YouTube.
- Say it is free, open source, and local-only.
- End with: `Where would you expect a blocked creator to disappear?`
- Put the Store and GitHub links in the first comment.
- Use no more than three relevant hashtags.

## Day 6: Show HN preparation

- Request a human-alias rename for the existing project-name account.
- Do not submit unless the account is suitable and four hours are available for replies.
- Follow [show-hn-checklist.md](show-hn-checklist.md).
- Skip Show HN during this campaign if the account is not ready by Day 20.

## Days 7 to 10: Short-form sprint

Publish two 15 to 25 second vertical Shorts:

1. `"Don't recommend channel" is not a site-wide block`
2. `Hide Shorts shelves without removing the Shorts tab`

Each Short must show the result within two seconds, cover one feature, use readable captions, and point to the long demo and profile link.

On X:

- Publish one native 15-second clip.
- Spend 20 minutes per day finding recent, genuine questions about blocking YouTube channels or hiding Shorts.
- Write 3 to 5 personalized replies per day.
- Disclose ownership whenever linking ChannelFence.
- Do not paste identical replies or send unsolicited DMs.

Also update AlternativeTo and submit complete profiles to SaaSHub and OpenAlternative.

## Day 10 checkpoint

### Green

- At least 75 active users or 100 gross installs.
- Uninstall or disable rate at or below 20 percent.
- Qualified Store-view-to-install conversion at or above 15 percent.

Proceed with the optional test in [paid-search.md](paid-search.md).

### Yellow

- 40 to 74 active users.
- Conversion below 15 percent while retention remains acceptable.

Do not scale traffic. Change the weakest part of the funnel, such as the thumbnail, screenshot order, call to action, or lead message.

### Red

- Fewer than 40 active users.
- Uninstall or disable rate above 25 percent.
- Repeated compatibility or support complaints.

Pause promotion and fix product or expectation problems.

## Days 11 to 20: Repeatable discovery

- Publish Short 3: block from a three-dot menu without opening the video.
- Publish Short 4: stop supported direct visits to blocked creators.
- Promote the Hide Shorts article and dated BlockTube comparison that were deployed on Day 0.
- Publish a second LinkedIn post about what browser automation uncovered, not another launch announcement.
- Continue useful X replies and limit original X posts to three per week.
- Submit to one maintained open-source or browser-extension list only when ChannelFence meets its rules.
- Run Show HN on a weekday only if the account and response window are ready.

## Days 21 to 30: Scale the winner

- Rank hooks by attributable installs per tagged Store visit.
- Produce one genuinely different Short from the winning hook.
- Change the homepage hero or Store screenshot order if one feature converts better.
- Publish a transparent results post with views, Store visits, installs, uninstalls, active users, and what worked.
- Continue only channels that produced attributable installs.
- Do not create a Discord unless ChannelFence reaches 250 active users or receives at least ten recurring support or community requests per month.

## Campaign rules

- Keep the website and extension tracker-free.
- Use the Chrome Web Store dashboard as the primary measurement source because public counts and reporting lag.
- Ask 3 to 5 real users for an honest review after they use the current version. Never ask for five stars.
- Do not promote on 4chan. Its [global Rule 11](https://www.4chan.org/rules) says advertising in all forms is not welcome, so a project link would risk deletion or a ban and conflict with the non-shill goal.
- Do not repeat the Product Hunt launch, rely on Reddit, buy reviews, coordinate votes, mass-DM, link-drop in YouTube comments, or pretend to be an unaffiliated user.
- Do not add extension or website tracking during this campaign.
