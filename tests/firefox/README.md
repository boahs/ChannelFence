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

Each test gets a fresh temporary browser profile. No personal Firefox profile is used, and no signing preference is changed. Temporary installation is the same development lifecycle as loading an unsigned add-on in `about:debugging`; it does not prove signed installation or persistence across a browser restart.

Coverage includes background defaults and messaging, local storage, manual blocking and import, popup/settings synchronization, block/Undo and direct visits, Home cleanup, responsive compact layouts, Shorts controls, and credential-free/referrer-free compact Shorts metadata requests.

All 18 manual interface choices are exercised on settings, popup, onboarding, privacy, feed buttons, menus, Shorts and blocked-page controls, including Arabic direction. The Automatic setting is checked against the actual English Firefox UI language. This suite does not claim that setting Accept-Language alone tests automatic selection in 18 localized Firefox installations; those require the corresponding browser builds or language packs.

The popup is opened as an extension page for these checks. Firefox's native toolbar popup placement and permission dialogs still need a manual release check.

## Live YouTube

Use the **Live YouTube Playwright tests** GitHub Actions workflow and select `firefox` in its `browser` input. The separate live job runs four real YouTube checks: channel blocking and search-menu blocking in English and Korean. These run in logged-out Firefox profiles. The current Chrome live schedule is unchanged, and Firefox has no recurring schedule yet.

Do not count intercepted fixtures as live-site coverage. The live tests are under `tests/firefox/live` and use unmodified YouTube responses.

Reports are written to `firefox-playwright-report/` and `firefox-test-results/`. Failed tests attach screenshots, page HTML and page errors. Per-language popup screenshots are included in successful deterministic reports too. CI retains diagnostics and the unsigned ZIP for 14 days.

References: [Puppeteer Firefox/BiDi support](https://pptr.dev/webdriver-bidi), [runtime extension installation](https://pptr.dev/api/puppeteer.browser.installextension), and [Mozilla temporary installation](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/).
