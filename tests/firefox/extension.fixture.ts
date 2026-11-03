import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test as base } from "@playwright/test";
import puppeteer, { type Browser, type HTTPRequest, type Page } from "puppeteer-core";
import { youtubeDocument } from "../e2e/fixtures/youtube-fixtures";

type StoredValues = Record<string, unknown>;
type ExtensionApi = {
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
      defaultViewport: { width: 1280, height: 900 }
    });
    const errors: string[] = [];
    try {
      const installedId = await browser.installExtension(extensionPath);
      expect(installedId).toBe(manifest.browser_specific_settings.gecko.id);
      const welcomeTarget = await browser.waitForTarget((target) =>
        target.url().startsWith("moz-extension://") && target.url().endsWith("/ui/welcome.html"),
      { timeout: 15_000 });
      const ui = await welcomeTarget.page();
      if (!ui) throw new Error("The installed Firefox extension did not open its onboarding page.");
      const extensionUrl = new URL(ui.url());
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
    } finally {
      if (testInfo.status !== testInfo.expectedStatus) {
        const pages = await browser.pages();
        for (const [index, page] of pages.entries()) {
          try {
            await testInfo.attach(`firefox-page-${index}`, {
              body: Buffer.from(await page.screenshot({ fullPage: true })), contentType: "image/png"
            });
            await testInfo.attach(`firefox-page-${index}-dom`, {
              body: JSON.stringify({ url: page.url(), html: await page.content() }), contentType: "application/json"
            });
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
  await addon.ui.goto(`${addon.origin}/ui/options.html`);
  await addon.ui.waitForFunction(() => !document.querySelector<HTMLSelectElement>("#languageSelect")?.disabled);
}

export async function openCreatorMenu(page: Page, trigger: string): Promise<void> {
  await page.locator(trigger).click();
  await page.evaluate(() => {
    document.querySelector("ytd-menu-popup-renderer")?.remove();
    const popup = document.createElement("ytd-menu-popup-renderer");
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
