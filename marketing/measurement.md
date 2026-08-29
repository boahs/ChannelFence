# Campaign measurement runbook

ChannelFence keeps both the extension and website tracker-free. Campaign measurement uses aggregate Chrome Web Store reports, Search Console, and each publishing platform's own dashboard.

The `@google-analytics/data` package is developer-only tooling for reading the Store's aggregate GA4 property. It is not included in the extension ZIP and it does not add analytics to ChannelFence or the website.

## One-time local setup

1. Copy `.env.example` to `.env` and set `GA4_PROPERTY_ID` to the numeric Analytics property ID. Do not use the `G-` measurement ID.
2. Confirm the signed-in Google account has at least Viewer access to the Analytics property, then enable the Google Analytics Data API in the Cloud project used for local reporting.
3. Authenticate Application Default Credentials with the Google Cloud CLI's built-in client and that same account:

   ```powershell
   gcloud auth application-default login --scopes="https://www.googleapis.com/auth/analytics.readonly,openid,https://www.googleapis.com/auth/userinfo.email"
   ```

   Do not pass a downloaded OAuth client-secret file for this local reader. The Cloud CLI flow avoids maintaining a separate public OAuth app and verification screen.

4. Keep `.env`, OAuth client files, tokens, and downloaded reports local. They are ignored by Git.

## Download a snapshot

The default end date is two days ago because low-volume Store analytics can take 24 to 48 hours to settle.

```powershell
npm run analytics:store
```

For an explicit range:

```powershell
npm run analytics:store -- --start-date 2026-08-29 --end-date 2026-09-07
```

Snapshots are written under `.analytics/<timestamp>/`, with a convenience copy at `.analytics/latest.json`. The output includes daily, event, source/medium/campaign, best-effort `utm_content`, and audience reports.

If the Chrome Web Store property does not expose `sessionManualAdContent`, the asset-level report will be listed as unavailable while the source/medium/campaign report still succeeds. Treat all attribution as directional at this volume.

## Daily routine

1. Record Store dashboard totals and the snapshot time in a private copy of `daily-funnel-template.csv`.
2. Run the analytics command and record source and asset rows in `asset-performance-template.csv`.
3. Mark new rows `provisional`.
4. After 48 hours, rerun the overlapping date range and replace provisional values with finalized values.
5. Record thresholding or unavailable-report warnings in `notes`; never silently treat missing data as zero.

Use `America/New_York` for the campaign log timezone. The Chrome Web Store developer dashboard remains the source of truth for active users, installs, uninstalls, and disables.
