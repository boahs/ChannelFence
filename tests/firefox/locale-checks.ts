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
  await expectVisible(page, selector);
  await expect.poll(async () => {
    const element = await page.$(selector);
    if (!element) return false;
    try {
      return await element.isIntersectingViewport({ threshold: 1 });
    } finally {
      await element.dispose();
    }
  }, { message: `${selector} fully in viewport` }).toBe(true);
}

export async function captureAction(page: Page, selector: string, testInfo: TestInfo, name: string): Promise<void> {
  await expectVisible(page, selector);
  const element = await page.$(selector);
  if (!element) throw new Error(`The capture control disappeared: ${selector}`);
  try {
    if (!await element.isIntersectingViewport({ threshold: 1 })) await element.scrollIntoView();
  } finally {
    await element.dispose();
  }
  await expectInViewport(page, selector);
  await testInfo.attach(name, { body: Buffer.from(await page.screenshot()), contentType: "image/png" });
}

export async function captureExtensionDom(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  // Firefox BiDi cannot screenshot privileged extension pages. Retain their
  // real DOM; layout assertions still execute against the rendered browser.
  await testInfo.attach(name, { body: await page.content(), contentType: "text/html" });
}
