import type { Page } from "puppeteer-core";
import type { TestInfo } from "@playwright/test";
import overrides from "../../scripts/firefox-locales.json";
import { allLocales } from "../e2e/fixtures/locales";
import { expect, expectVisible, type FirefoxAddon } from "./extension.fixture";

export type Locale = (typeof allLocales)[number];

export function firefoxMessages(locale: Locale): Locale["messages"] {
  const replacements = overrides[locale.catalogCode as keyof typeof overrides];
  return Object.fromEntries(Object.entries(locale.messages).map(([key, value]) => [key, {
    ...value, message: replacements[key as keyof typeof replacements] ?? value.message
  }])) as Locale["messages"];
}

export async function expectNativeLanguage(addon: FirefoxAddon, language: RegExp): Promise<void> {
  expect(await addon.ui.evaluate(() => (globalThis as unknown as {
    browser: { i18n: { getUILanguage(): string } };
  }).browser.i18n.getUILanguage())).toMatch(language);
}

export async function expectInViewport(page: Page, selector: string): Promise<void> {
  await expect.poll(() => page.$eval(selector, (element) => {
    const rect = element.getBoundingClientRect();
    if (!element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) ||
      rect.width === 0 || rect.height === 0 || rect.top < -1 || rect.left < -1 ||
      rect.bottom > innerHeight + 1 || rect.right > innerWidth + 1) return false;
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      const bounds = parent.getBoundingClientRect();
      if (/auto|scroll|hidden|clip/.test(style.overflowY) &&
        (rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1)) return false;
      if (/auto|scroll|hidden|clip/.test(style.overflowX) &&
        (rect.left < bounds.left - 1 || rect.right > bounds.right + 1)) return false;
    }
    return true;
  }), { message: `${selector} fully in viewport` }).toBe(true);
}

export async function captureAction(page: Page, selector: string, testInfo: TestInfo, name: string): Promise<void> {
  await expectVisible(page, selector);
  await page.$eval(selector, (element) => element.scrollIntoView({ block: "center", inline: "nearest" }));
  await expectInViewport(page, selector);
  await testInfo.attach(name, { body: Buffer.from(await page.screenshot()), contentType: "image/png" });
}

export async function captureExtensionDom(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  // Firefox BiDi cannot screenshot privileged extension pages. Retain their
  // real DOM; layout assertions still execute against the rendered browser.
  await testInfo.attach(name, { body: await page.content(), contentType: "text/html" });
}
