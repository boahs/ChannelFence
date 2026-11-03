import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test as base } from "@playwright/test";
import puppeteer, { type Browser, type HTTPRequest, type Page } from "puppeteer-core";
import { youtubeDocument } from "../e2e/fixtures/youtube-fixtures";

type StoredValues = Record<string, unknown>;
type ExtensionApi = {
  tabs: {
    create(options: { url: string }): Promise<unknown>;
    getCurrent(): Promise<{ id: number }>;
    update(id: number, options: { active: boolean }): Promise<unknown>;
  };
  storage: { local: {
    get(keys: string | string[] | null): Promise<StoredValues>;
    set(values: StoredValues): Promise<void>;
  } };
};

export type FirefoxAddon = {
  browser: Browser;
  ui: Page;
  page: Page;
  origin: string;
  getStorage(keys?: string | string[]): Promise<StoredValues>;
  setStorage(values: StoredValues): Promise<void>;
};

export const test = base.extend<{ addon: FirefoxAddon }>({
  addon: async ({}, use, testInfo) => {
    const executablePath = process.env.CHANNELFENCE_FIREFOX_PATH;
    if (!executablePath) {
      throw new Error("Set CHANNELFENCE_FIREFOX_PATH to the stock Firefox executable. See tests/firefox/README.md.");
    }
    const sourceManifest = JSON.parse(await readFile(path.resolve("manifest.json"), "utf8"));
    const extensionPath = path.resolve(process.env.CHANNELFENCE_FIREFOX_EXTENSION_PATH ||
      `dist/ChannelFence-${sourceManifest.version}-firefox`);
    const manifest = JSON.parse(await readFile(path.join(extensionPath, "manifest.json"), "utf8"));
    const browser = await puppeteer.launch({
      browser: "firefox", executablePath, headless: true,
      // Firefox requires explicit automation access to its extension pages.
      // This is scoped to the disposable test process, never a user's profile.
      env: { ...process.env, MOZ_REMOTE_ALLOW_SYSTEM_ACCESS: "1" },
      args: ["--remote-allow-system-access"],
      extraPrefsFirefox: {
        "browser.download.dir": testInfo.outputPath("downloads"),
        "browser.download.folderList": 2,
        "browser.download.useDownloadDir": true,
        "browser.helperApps.neverAsk.saveToDisk": "application/json"
      },
      defaultViewport: { width: 1280, height: 900 }
    });
    const errors: string[] = [];
    let setupFailed = false;
    try {
      const initialTargets = new Set(browser.targets());
      const installedId = await browser.installExtension(extensionPath);
      expect(installedId).toBe(manifest.browser_specific_settings.gecko.id);
      const welcomeTarget = await browser.waitForTarget((target) =>
        target.type() === "page" && !initialTargets.has(target),
      { timeout: 15_000 });
      const ui = await welcomeTarget.page();
      if (!ui) throw new Error("The installed Firefox extension did not open its onboarding page.");
      // Firefox BiDi does not report extension navigation events consistently,
      // so target.url() can remain about:blank after onboarding has loaded.
      await ui.waitForFunction(() => location.protocol === "moz-extension:" &&
        location.pathname === "/ui/welcome.html" && document.readyState === "complete");
      const extensionUrl = new URL(await ui.evaluate(() => location.href));
      const origin = `${extensionUrl.protocol}//${extensionUrl.host}`;
      const page = await browser.newPage();
      for (const observedPage of [ui, page]) {
        observedPage.on("pageerror", (error) => errors.push(String(error)));
      }
      const addon: FirefoxAddon = {
        browser, ui, page, origin,
        getStorage: (keys) => ui.evaluate((requested) =>
          (globalThis as unknown as { browser: ExtensionApi }).browser.storage.local.get(requested), keys ?? null),
        setStorage: (values) => ui.evaluate((next) =>
          (globalThis as unknown as { browser: ExtensionApi }).browser.storage.local.set(next), values)
      };
      // The real background script initializes these values. Do not seed defaults
      // here: an installation/background failure must fail the Firefox tests.
      await expect.poll(() => addon.getStorage("cfEnabled")).toMatchObject({ cfEnabled: true });
      await use(addon);
    } catch (error) {
      setupFailed = true;
      errors.push(String(error));
      throw error;
    } finally {
      if (setupFailed || testInfo.status !== testInfo.expectedStatus) {
        const pages = await browser.pages();
        for (const [index, page] of pages.entries()) {
          try {
            const url = await page.evaluate(() => location.href);
            await testInfo.attach(`firefox-page-${index}-dom`, {
              body: JSON.stringify({ url, html: await page.content() }), contentType: "application/json"
            });
            // Firefox BiDi cannot capture privileged extension pages. Their
            // actual HTML is retained above; YouTube pages also get screenshots.
            if (!url.startsWith("moz-extension:")) {
              await testInfo.attach(`firefox-page-${index}`, {
                body: Buffer.from(await page.screenshot({ fullPage: true })), contentType: "image/png"
              });
            }
          } catch (error) {
            errors.push(`Could not capture page ${index}: ${error}`);
          }
        }
        await testInfo.attach("firefox-errors", { body: errors.join("\n"), contentType: "text/plain" });
      }
      await browser.close();
    }
  }
});

export { expect } from "@playwright/test";

export async function visible(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((query) => {
    const element = document.querySelector(query);
    return element?.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) ?? false;
  }, selector);
}

export async function expectVisible(page: Page, selector: string, expected = true): Promise<void> {
  await expect.poll(() => visible(page, selector), { message: `${selector} visible = ${expected}` }).toBe(expected);
}

export async function expectText(page: Page, selector: string, text: string): Promise<void> {
  await expect.poll(() => page.evaluate((query) => document.querySelector(query)?.textContent?.trim(), selector), {
    message: `${selector} text`
  }).toBe(text);
}

export async function openOptions(addon: FirefoxAddon): Promise<void> {
  await openExtensionPage(addon.ui, `${addon.origin}/ui/options.html`);
  await addon.ui.waitForFunction(() => {
    const select = document.querySelector<HTMLSelectElement>("#languageSelect");
    return select && !select.disabled;
  });
}

export async function openExtensionPage(page: Page, url: string): Promise<void> {
  // Use the loaded document because Firefox omits the extension-page events
  // that Puppeteer's goto/reload wait for. The marker also proves same-URL
  // reloads completed instead of accepting the previous document as ready.
  await page.evaluate(async () => {
    const api = (globalThis as unknown as { browser: ExtensionApi }).browser;
    const tab = await api.tabs.getCurrent();
    await api.tabs.update(tab.id, { active: true });
  });
  await page.evaluate((destination) => {
    document.documentElement.dataset.cfTestNavigation = "pending";
    location.assign(destination);
  }, url);
  await page.waitForFunction((destination) => location.href === destination &&
    document.readyState === "complete" && !document.documentElement.dataset.cfTestNavigation, {}, url);
}

export async function openExtensionTab(addon: FirefoxAddon, pathname: string): Promise<Page> {
  const url = `${addon.origin}${pathname}`;
  const existingTargets = new Set(addon.browser.targets());
  // about:blank scripts cannot navigate to privileged moz-extension pages.
  // Open the real extension tab through Firefox's own extension API.
  await addon.ui.evaluate((destination) =>
    (globalThis as unknown as { browser: ExtensionApi }).browser.tabs.create({ url: destination }), url);
  const target = await addon.browser.waitForTarget((candidate) =>
    candidate.type() === "page" && !existingTargets.has(candidate));
  const page = await target.page();
  if (!page) throw new Error(`Firefox did not open ${pathname}`);
  await page.waitForFunction((destination) => location.href === destination &&
    document.readyState === "complete", {}, url);
  return page;
}

export async function openCreatorMenu(page: Page, trigger: string): Promise<void> {
  await page.locator(trigger).click();
  await page.evaluate(() => {
    document.querySelector("ytd-menu-popup-renderer")?.remove();
    const popup = document.createElement("ytd-menu-popup-renderer");
    popup.style.color = "#f1f1f1";
    popup.innerHTML = '<div id="items" role="menu"><div role="menuitem"><span class="label">Report</span></div></div>';
    document.body.append(popup);
  });
  await expectVisible(page, ".cf-menu-item");
}

export type MetadataRequest = { url: string; headers: Record<string, string> };

// Keep the production https://www.youtube.com origin and the unmodified add-on.
// BiDi supplies our existing fixture HTML before any request reaches YouTube.
export async function openFixture(
  page: Page, body: string, pathname = "/", language = "en",
  metadata?: { requests: MetadataRequest[]; creator: string }
): Promise<void> {
  await page.bringToFront();
  page.removeAllListeners("request");
  await page.setRequestInterception(true);
  const html = youtubeDocument(body, language);
  page.on("request", (request: HTTPRequest) => {
    const url = new URL(request.url());
    if (url.origin === "https://www.youtube.com" && request.isNavigationRequest()) {
      return request.respond({ status: 200, contentType: "text/html", body: html });
    }
    if (metadata && url.origin === "https://www.youtube.com" && url.pathname === "/oembed") {
      metadata.requests.push({ url: request.url(), headers: request.headers() });
      const compactOne = url.searchParams.get("url")?.endsWith("/shorts/compact-one");
      const creator = compactOne ? metadata.creator : "allowedshortscreator";
      return request.respond({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ author_name: creator, author_url: `https://www.youtube.com/@${creator}` })
      });
    }
    return url.protocol === "moz-extension:" || url.protocol === "data:"
      ? request.continue() : request.abort();
  });
  await page.goto(`https://www.youtube.com${pathname}`, { waitUntil: "domcontentloaded" });
  await expect.poll(() => page.evaluate(() => {
    const probe = document.createElement("div");
    probe.className = "cf-hidden-by-channelfence";
    document.body.append(probe);
    const hidden = getComputedStyle(probe).display === "none";
    probe.remove();
    return hidden;
  }), { message: "The installed Firefox content script injected its stylesheet" }).toBe(true);
}
