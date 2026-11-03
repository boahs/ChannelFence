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

All 18 manual interface choices are exercised on settings, popup, onboarding, privacy, feed buttons, menus, Shorts and blocked-page controls, including Arabic direction. The Automatic setting is checked against the actual English Firefox UI language. This suite does not claim that setting Accept-Language alone tests automatic selection in 18 localized Firefox installations; those require the corresponding browser builds or language packs.

The popup is opened as an extension page for these checks. Firefox's native toolbar popup placement and permission dialogs still need a manual release check.

## Live YouTube

The **Live YouTube Playwright tests** GitHub Actions workflow runs Firefox daily at 12:17 in `America/New_York`, following daylight saving time. To validate a branch manually, choose **Run workflow** and select `firefox` in its `browser` input. The Firefox job runs four real YouTube checks: channel blocking and search-menu blocking in English and Korean, using logged-out Firefox profiles. Chromium continues to run at 00:17 and 12:17 daily. Scheduled runs use the latest default-branch commit; GitHub may delay their start. The separate **Firefox extension checks** workflow runs deterministic fixtures on pull requests, pushes to `main`, and manual requests.

Do not count intercepted fixtures as live-site coverage. The live tests are under `tests/firefox/live` and use unmodified YouTube responses.

Reports are written to `firefox-playwright-report/` and `firefox-test-results/`. Failed tests attach page HTML, page errors and screenshots where Firefox permits capture. Per-language YouTube menu screenshots are included in successful deterministic reports too. Extension pages have DOM and layout assertions; Firefox BiDi currently restricts screenshot capture on these privileged pages. CI retains diagnostics and the unsigned ZIP for 14 days.

References: [Puppeteer Firefox/BiDi support](https://pptr.dev/webdriver-bidi), [runtime extension installation](https://pptr.dev/api/puppeteer.browser.installextension), and [Mozilla temporary installation](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/).
