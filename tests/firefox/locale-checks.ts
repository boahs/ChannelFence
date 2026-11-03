import type { Page } from "puppeteer-core";
import type { TestInfo } from "@playwright/test";
import overrides from "../../scripts/firefox-locales.json";
import { allLocales } from "../e2e/fixtures/locales";
import { expect, expectVisible, test, type FirefoxAddon } from "./extension.fixture";

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

export async function expectInViewport(page: Page, selector: string, ratio = 1): Promise<void> {
  await expectVisible(page, selector);
  let lastIntersection: unknown = null;
  try {
    await expect.poll(async () => {
      const intersection = await page.evaluate(async (query) => {
        const element = document.querySelector(query);
        if (!element) return null;
        const entry = await new Promise<IntersectionObserverEntry>((resolve) => {
          const observer = new IntersectionObserver(([observed]) => {
            observer.disconnect();
            resolve(observed);
          });
          observer.observe(element);
          requestAnimationFrame(() => {});
        });
        return {
          ratio: entry.intersectionRatio,
          bounds: entry.boundingClientRect.toJSON(),
          intersection: entry.intersectionRect.toJSON(),
          root: entry.rootBounds?.toJSON(),
          viewport: { width: innerWidth, height: innerHeight, scrollX, scrollY },
          ancestors: [document.body, document.documentElement].map((ancestor) => ({
            tag: ancestor.tagName, bounds: ancestor.getBoundingClientRect().toJSON(),
            clientWidth: ancestor.clientWidth, scrollWidth: ancestor.scrollWidth,
            clientHeight: ancestor.clientHeight, scrollHeight: ancestor.scrollHeight,
            direction: getComputedStyle(ancestor).direction,
            overflow: getComputedStyle(ancestor).overflow
          }))
        };
      }, selector);
      lastIntersection = intersection;
      return intersection?.ratio ?? 0;
    }, { message: `${selector} viewport intersection >= ${ratio}` })
      // Match Playwright's toBeInViewport: positive intersection, allowing only
      // its 1e-9 floating-point tolerance at the requested ratio.
      .toBeGreaterThan(Math.max(0, ratio - 1e-9));
  } catch (error) {
    await test.info().attach(`viewport-${selector}`, {
      body: JSON.stringify(lastIntersection), contentType: "application/json"
    });
    throw error;
  }
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
  // Match Chrome's capture assertion: any intersection. Layout checks call
  // expectInViewport separately and retain the full-visibility requirement.
  await expectInViewport(page, selector, 0);
  await testInfo.attach(name, { body: Buffer.from(await page.screenshot()), contentType: "image/png" });
}

export async function captureExtensionDom(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  // Firefox BiDi cannot screenshot privileged extension pages. Retain their
  // real DOM; layout assertions still execute against the rendered browser.
  await testInfo.attach(name, { body: await page.content(), contentType: "text/html" });
}
