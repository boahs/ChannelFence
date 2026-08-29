# `channelfence.app` domain cutover

## Current status and execution gate

`channelfence.app` was registered, verified with GitHub, and connected to GitHub Pages on August 29, 2026. The apex serves over HTTPS, `www` redirects to the apex, and the old GitHub Pages URL redirects to the custom domain. Search Console, support forwarding, and external listing updates still require their own verification. This file is an execution checklist, not authorization to change DNS, GitHub Pages, Search Console, the Chrome Web Store, or any other public service.

Reference pricing recorded August 29, 2026:

- Registration: $10.98 for the first year.
- Renewal: $22.98 per year.
- A possible $0.20 annual ICANN fee is not included.
- Eligible Namecheap registrations include domain privacy.

The selected domain is `channelfence.app`; no additional domain purchase is needed for this cutover. Keep the visible product name as `ChannelFence` and decline unrelated domain, hosting, SSL, and email upsells.

## 1. Confirm and secure the registration

- [ ] Confirm the domain appears in the intended Namecheap account and save the registration invoice privately.
- [ ] Confirm the listed renewal price and auto-renewal date in the account.
- [ ] Enable domain privacy.
- [ ] Enable registrar lock.
- [ ] Enable auto-renewal with a valid backup payment method.
- [ ] Enable two-factor authentication on the Namecheap account.
- [ ] Do not buy a Namecheap SSL certificate. GitHub Pages supplies HTTPS.
- [ ] Keep Namecheap BasicDNS selected so email forwarding can be configured.

## 2. Verify the domain with GitHub first

1. Open GitHub account settings.
2. Go to Pages, then Verified domains.
3. Add `channelfence.app`.
4. GitHub will provide a TXT record with a host similar to `_github-pages-challenge-boahs` and a unique value.
5. Add that TXT record in Namecheap Advanced DNS exactly as GitHub provides it.
6. Wait for DNS propagation, then complete verification in GitHub.
7. Leave the verification TXT record in DNS after verification.

Domain verification reduces the risk of another repository claiming a subdomain. Do this before configuring the repository's custom domain.

## 3. Set the GitHub Pages custom domain

Do this after profile-level domain verification and before pointing Namecheap DNS at GitHub Pages.

1. Open `boahs/ChannelFence` on GitHub.
2. Go to Settings, Pages.
3. Enter `channelfence.app` under Custom domain and save.
4. GitHub will create or update the repository `CNAME` file because this site deploys from a branch.
5. Pull that GitHub-created commit with `git pull --ff-only` before pushing other local work.
6. Leave Enforce HTTPS off until GitHub provisions the certificate after DNS is configured.

GitHub recommends adding the custom domain to the repository before configuring the provider's routing records. The profile-level TXT verification from the previous section should remain in place.

## 4. Configure Namecheap BasicDNS

Delete conflicting parking, URL redirect, or duplicate records for `@` and `www`. Do not add a wildcard record.

Add these apex records:

| Type | Host | Value | TTL |
|---|---|---|---|
| A | `@` | `185.199.108.153` | Automatic |
| A | `@` | `185.199.109.153` | Automatic |
| A | `@` | `185.199.110.153` | Automatic |
| A | `@` | `185.199.111.153` | Automatic |
| AAAA | `@` | `2606:50c0:8000::153` | Automatic |
| AAAA | `@` | `2606:50c0:8001::153` | Automatic |
| AAAA | `@` | `2606:50c0:8002::153` | Automatic |
| AAAA | `@` | `2606:50c0:8003::153` | Automatic |
| CNAME | `www` | `boahs.github.io` | Automatic |

Before saving, compare these values with GitHub's current Pages documentation. GitHub can update its recommended records.

## 5. Finish HTTPS and verify routing

1. Return to repository Settings, Pages.
2. Wait for the DNS check and TLS certificate provisioning.
3. Enable Enforce HTTPS only after GitHub offers the checkbox.
4. Verify all four URLs:
   - `http://channelfence.app/`
   - `https://channelfence.app/`
   - `http://www.channelfence.app/`
   - `https://www.channelfence.app/`
5. Confirm every variant reaches one canonical destination: `https://channelfence.app/`.

The `.app` registry is HTTPS-preloaded. A working certificate is required before normal browsers will load the site.

## 6. Configure support forwarding

1. In Namecheap, open Domain List, Manage, Advanced DNS.
2. Find Mail Settings and select Email Forwarding.
3. Create `support@channelfence.app` and forward it to the private support inbox.
4. Save the setting and wait for DNS propagation.
5. Send a test message from an unrelated address.
6. Reply from the support inbox and verify the visible From address meets the intended privacy setup. Basic forwarding alone does not provide outbound sending as the custom address.

Do not add forwarding records on top of unrelated MX records. Choose one mail setup and test it.

Before changing any public support field:

1. Publish `https://channelfence.app/support/` with the support address, GitHub Issues link, expected response scope, and privacy contact.
2. Test the page, mail link, and issue link in a signed-out browser.
3. Keep the existing public support URL until this page and forwarding both work.
4. Update the Chrome Web Store Support URL to `/support/` only as a separately approved dashboard change. The support URL change does not require an extension package release.

## 7. Verify Search Console and submit the sitemap

1. Use the same Google account that owns or publishes the Chrome Web Store item. This keeps Search Console ownership available when selecting the Store listing's Official URL.
2. Add a Domain property for `channelfence.app` in Google Search Console.
3. Add the TXT record Google provides at Namecheap.
4. Complete ownership verification.
5. Submit `https://channelfence.app/sitemap.xml`.
6. Inspect the homepage and request indexing after the canonical URL is live.
7. Inspect each intent-focused page and confirm Google sees its self-referencing canonical.

## 8. Update public surfaces

Use [external-updates.md](external-updates.md) to update the Chrome Web Store, GitHub, YouTube, AlternativeTo, Product Hunt, X, SaaSHub, and OpenAlternative. Test every link after saving.

Do not create an extension release only to change the domain. Update `homepage_url` in the next functional extension release.

## DNS and TLS rollback

Use this rollback if GitHub Pages routing is wrong, the certificate does not provision, or any canonical URL becomes unreachable:

1. Stop public-profile and campaign-link updates immediately.
2. Remove or reset the repository custom domain in GitHub Pages so `https://boahs.github.io/ChannelFence/` can become the working public URL again.
3. Restore the prior Namecheap parking or routing records only after recording the failed records and confirming the GitHub Pages URL works.
4. Revert custom-domain canonicals and sitemap URLs in a separate, reviewed site change if the outage will last beyond the same maintenance window.
5. Restore any public URL already changed to the last working URL.
6. Resume promotion only after the old URL or a repaired custom domain passes the complete acceptance checklist.

Do not delete the GitHub or Search Console verification TXT records during a routing rollback unless ownership itself is being intentionally removed.

## Final acceptance checks

- [ ] Apex and `www` load over HTTPS.
- [ ] `www` redirects to the apex.
- [ ] The old GitHub Pages URL reaches the custom domain.
- [ ] The certificate is valid and Enforce HTTPS is enabled.
- [ ] Page source uses `https://channelfence.app/` as canonical.
- [ ] Search Console verifies ownership and accepts the sitemap.
- [ ] `support@channelfence.app` forwards successfully.
- [ ] `/support/` loads publicly and its email and GitHub Issues links work while signed out.
- [ ] Search Console and Chrome Web Store ownership are accessible from the same Google account.
- [ ] No wildcard DNS record exists.
- [ ] Every public call to action reaches the correct Store listing.
