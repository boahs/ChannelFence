# Optional Google Search test

This campaign is optional. Do not create, fund, or launch it before Day 11, and do not start it unless the Day 10 checkpoint is green. A green checkpoint is necessary but is not authorization: get separate explicit approval before creating the campaign, adding billing, or spending the first dollar.

## Budget

- Initial test budget ceiling: $150, released in stages rather than committed up front.
- Absolute campaign cap: $250.
- Do not raise the cap during the 30-day campaign.
- Start with a daily budget that cannot spend the full cap before the first $50 review.
- Get a second explicit approval before continuing beyond the first $50, and another before increasing the approved ceiling from $150 to $250.

## Campaign settings

- Network: Google Search only.
- Disable Search Partners and Display Network expansion.
- Devices: computers only. Exclude mobile phones and tablets.
- Locations: United States, Canada, United Kingdom, Australia, and New Zealand.
- Location option: people in or regularly in the targeted locations, not people merely interested in them.
- Language: English.
- Bidding: begin with clicks or a conservative manual strategy until real conversion data exists. Do not use a guessed conversion value.
- Final URL: the tagged `channelfence.app` landing page in [utm-links.md](utm-links.md), not the Store page directly.

## Keywords

Use only these exact and phrase match keywords at launch:

```text
[block youtube channel]
[youtube channel blocker]
"block youtube creators"
"hide youtube channels"
"youtube shorts blocker"
```

## Negative keywords

```text
android
iphone
mobile
parental control
youtube downloader
ad blocker
unblock
```

Review actual search terms daily. Add irrelevant terms as negatives without broadening the product claim.

## Landing and attribution

- Use one `utm_content` value per ad group.
- The landing page must state desktop Chrome support before the main call to action.
- Before launch, implement and test an ad-group-specific Store call to action so the landing page does not replace paid traffic with its normal organic website tag. If that mapping is not available, measure only at the supported source, medium, and campaign level and do not claim ad-group attribution.
- The Store call to action must use the `google` and `paid_search` values in [utm-links.md](utm-links.md).
- Record spend, clicks, tagged Store visits, attributable gross installs, uninstalls, disables, active users, and retention evidence in private copies of the campaign templates.
- Do not add analytics to the extension or website to run this test.

## Review and stop rules

Review after either $50 has been spent or 50 tagged Store visits have occurred, whichever comes first. Chrome Web Store data can lag and be thresholded, so wait at least 48 hours after the review window closes before treating the result as final.

Stop if any of these are true:

- Fewer than 10 attributable gross installs at the first $50 review.
- Store conversion falls below 10 percent.
- Most traffic is mobile or otherwise ineligible.
- Support complaints or expectation mismatches increase.
- Uninstall or disable rate rises above 20 percent.
- Retention evidence is unavailable, too immature, or adverse. Do not substitute gross installs for retained users.

Continue from $50 toward the approved $150 ceiling only when all of these are true:

- At least 10 attributable gross installs are visible for the final review window.
- Active-user, uninstall, and disable data provide credible retention evidence after the reporting lag.
- Store conversion is at least 15 percent.
- Traffic is qualified desktop traffic and support signals remain healthy.
- The user separately approves the continuation spend.

Scale from $150 to $250 only when:

- Cost per retained install is $5 or less.
- Uninstall or disable rate remains at or below 20 percent.
- The traffic is qualified desktop traffic.
- The Store listing continues converting at 15 percent or better.
- The user separately approves the scale step after reviewing the final $150 results.

Do not use display ads, influencer sponsorships, remarketing, or paid directory placement during this campaign.
