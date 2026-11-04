# Firefox extension tests

These tests install the generated Firefox add-on in stock Firefox using Puppeteer's WebDriver BiDi support. Playwright Test provides the runner, assertions, TypeScript transform and HTML/JUnit reports. They do not load the extension through Playwright's Chromium-only extension API.

The deterministic tests reuse the existing YouTube HTML fixtures. Request interception serves them at the production YouTube origin, with other page network requests blocked. The installed package and its content-script match patterns are unchanged. Extension storage and background messages use the real Firefox extension APIs.

## Run deterministic checks

Use Node.js 24 and an English stock Firefox installation. Build first, then set its executable path:

```powershell
npm ci
npm run build:firefox
$env:CHANNELFENCE_FIREFOX_PATH = 'C:\Program Files\Mozilla Firefox\firefox.exe'
npm run test:firefox
```

On Linux, set `CHANNELFENCE_FIREFOX_PATH` to the installed Firefox executable. `CHANNELFENCE_FIREFOX_EXTENSION_PATH` can optionally identify another generated package directory. The default is `dist/ChannelFence-<manifest version>-firefox`.

Each test gets a fresh temporary browser profile. No personal Firefox profile is used, and no signing preference is changed. The test process allows automation access to extension pages and saves downloads in that test's output directory. Temporary installation is the same development lifecycle as loading an unsigned add-on in `about:debugging`; it does not prove signed installation or persistence across a browser restart.

Coverage includes background defaults and messaging, local storage, manual blocking, real JSON backup downloads and import, popup/settings synchronization, block/Undo and direct visits, Home cleanup, responsive compact layouts, Shorts controls, and credential-free/referrer-free compact Shorts metadata requests. Firefox BiDi cannot set file inputs on extension pages, so import tests supply a File and dispatch the input's change event. The backup test uses the downloaded file's actual contents and the extension's real import handler.

The `regression/` and `smoke/` specs mirror the Chromium scenarios, including collaboration identity, reused renderers, late metadata, themed menus, feed packing, settings synchronization, and delayed Shorts navigation. Existing Firefox installation/background tests remain alongside them. Shared fixture builders and locale data describe the same YouTube markup in both browsers.

All 18 interface languages are exercised on settings, popup, onboarding, privacy, feed buttons, menus, Shorts and blocked-page controls, including Arabic direction. CI installs signed language packs matching the stock Firefox version through `scripts/install-firefox-locales.mjs`. The fixture enables distribution add-ons in its temporary profiles, selects the requested browser locale, and tests the real `browser.i18n.getUILanguage()` result before asserting automatic translations. It also covers regional Spanish fallback and an untranslated Polish browser. The separate settings tests exercise all manual language choices and returning to Automatic.

Running the complete suite locally requires those Firefox language packs too. The installer targets CI's Linux x64 build; an English-only local investigation can select a spec that does not require additional native locales, for example `npm run test:firefox -- tests/firefox/extension.spec.ts`.

The popup is opened as an extension page for these checks. Firefox's native toolbar popup placement and permission dialogs still need a manual release check.

## Live YouTube

The **Firefox live YouTube tests** workflow runs daily at 12:17 in `America/New_York`, following daylight saving time. Choose **Run workflow** to validate a branch manually. **Firefox regression tests** also exposes a `live` suite choice that calls the same job. Chrome live checks have their own workflow at 00:17 and 12:17 daily. Scheduled runs use the latest default-branch commit; GitHub may delay their start.

Firefox runs the same five live journeys in each of the 18 supported languages: channel headers without false creator controls on statistics, search-menu blocking, watch recommendations, compact Shorts menus, and Shorts viewer controls. The 11 general live checks cover injection, blocking, navigation and Shorts stress behavior. Every test uses a fresh, logged-out Firefox profile and real YouTube responses. Native Firefox and rendered YouTube languages are both asserted; setting an HTTP header alone does not establish language coverage.

The browser appears in workflow, run and job names, including GitHub's native failure notifications. Email delivery depends on the repository owner's GitHub Actions notification preferences. No separate mail service is configured.

Manual runs accept an optional test-title filter for investigating a failure. Leave it blank to run the complete suite. Pull requests, pushes and scheduled runs always use the complete suite. In CI, the runner stops after 14 minutes so it can save reports before the job's 16-minute deadline.

Do not count intercepted fixtures as live-site coverage. The live tests are under `tests/firefox/live` and use unmodified YouTube responses.

Watch-page checks report `[YOUTUBE_ACCESS_BLOCKED]` when Google redirects the runner to its unusual-traffic/CAPTCHA page. That result remains a failure: the affected watch-page behavior was not verified. Inspect the saved URL and screenshot before attributing a language or selector failure to the extension. Recommendation creator assertions use the native avatar's channel label instead of movie genre/year metadata.

Reports are written to `firefox-playwright-report/` and `firefox-test-results/`. Failed tests attach page HTML, page errors and screenshots where Firefox permits capture. Per-language YouTube menu screenshots are included in successful deterministic reports too. Extension pages have DOM and layout assertions; Firefox BiDi currently restricts screenshot capture on these privileged pages. CI retains diagnostics and the unsigned ZIP for 14 days.

References: [Puppeteer Firefox/BiDi support](https://pptr.dev/webdriver-bidi), [runtime extension installation](https://pptr.dev/api/puppeteer.browser.installextension), and [Mozilla temporary installation](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/).
