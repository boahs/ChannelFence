import { allLocales } from "../../e2e/fixtures/locales";
import { assertLiveYouTubeAccess } from "../../e2e/fixtures/live-youtube-access";
import { reportedCollaborators } from "../../e2e/fixtures/localized-collaboration";
import { expect, test } from "../extension.fixture";
import { expectNativeLanguage, firefoxMessages } from "../locale-checks";

for (const locale of allLocales) {
  test.describe(`${locale.name} live YouTube collaborations`, () => {
    test.use({ browserLocale: locale.browserLocale });
    test.setTimeout(60_000);

    test("blocks only the selected guest from a native collaboration search result", async ({ addon }, testInfo) => {
      await expectNativeLanguage(addon, locale.uiLanguage);
      await addon.page.setExtraHTTPHeaders({ "Accept-Language": locale.browserLocale });
      await addon.browser.defaultBrowserContext().setCookie({
        name: "PREF", value: `hl=${locale.youtubeLanguage}`, domain: ".youtube.com", path: "/", secure: true
      });
      await addon.page.goto(
        `https://www.youtube.com/results?search_query=Folk+Singers+Nagaraju+Ramu+hmtv+music&hl=${locale.youtubeLanguage}`,
        { waitUntil: "domcontentloaded", timeout: 30_000 }
      );
      assertLiveYouTubeAccess(addon.page.url());
      await expect.poll(() => addon.page.$eval("html", (element) => element.lang)).toMatch(locale.documentLanguage);

      const [lead, guest] = reportedCollaborators;
      // Select native creator metadata, not title/description mentions or the
      // injected controls. The Firefox fixture captures public DOM on failure.
      const result = await addon.page.waitForFunction((names) =>
        [...document.querySelectorAll("ytd-search ytd-video-renderer, ytd-search yt-lockup-view-model")].find((card) => {
          const byline = card.querySelector("#attributed-channel-name, .ytContentMetadataViewModelMetadataRow");
          return byline && names.every((name) => byline.textContent?.includes(name)) && card.checkVisibility();
        }), { timeout: 30_000 }, [...reportedCollaborators]);
      const card = result.asElement();
      if (!card) throw new Error("No visible search result exposes both collaboration creators in its native byline");
      await expect.poll(() => card.$$eval(".cf-block-button", (elements) => elements.length)).toBe(2);
      const messages = firefoxMessages(locale);
      const labels = reportedCollaborators.map((name) => messages.contentBlockNamed.message.replace("$CREATOR$", name));
      expect(await card.$$eval(".cf-block-button", (elements) => elements.map((element) => element.getAttribute("aria-label")).sort()))
        .toEqual([...labels].sort());
      for (const label of labels) {
        await card.waitForSelector(`button.cf-block-button[aria-label=${JSON.stringify(label)}]`, { visible: true });
      }
      const leadIdentity = await card.$eval(`button.cf-block-button[aria-label=${JSON.stringify(labels[0])}]`,
        (element) => element.getAttribute("data-cf-identity"));
      const guestButton = await card.$(`button.cf-block-button[aria-label=${JSON.stringify(labels[1])}]`);
      if (!guestButton) throw new Error("The guest's block control disappeared");
      const guestIdentity = await guestButton.evaluate((element) => element.getAttribute("data-cf-identity"));
      expect(leadIdentity).toMatch(/^(?:name|handle|channel):/);
      expect(guestIdentity).toMatch(/^(?:name|handle|channel):/);
      const guestAliases = guestIdentity!.startsWith("name:") ? [guestIdentity!] : guestIdentity!.split("|");
      expect(guestAliases.every((alias) => !leadIdentity!.split("|").includes(alias))).toBe(true);

      await guestButton.scrollIntoView();
      await expect.poll(() => guestButton.isIntersectingViewport()).toBe(true);
      await testInfo.attach(`${locale.catalogCode}-collaboration-buttons`, {
        body: Buffer.from(await card.screenshot()), contentType: "image/png"
      });
      await guestButton.click();
      await expect.poll(() => card.evaluate((element) => (element as Element).checkVisibility())).toBe(false);
      await expect.poll(async () => (await addon.getStorage<{
        cfBlockedChannels: Array<{ aliases: string[] }>;
      }>("cfBlockedChannels")).cfBlockedChannels.map((entry) => [...entry.aliases].sort()))
        .toEqual([[...guestAliases].sort()]);
      const { cfBlockedChannels: [blocked] } = await addon.getStorage<{
        cfBlockedChannels: Array<{ displayName: string; nameAliases: string[] }>;
      }>("cfBlockedChannels");
      // Stable channel/handle identities may have a canonical display label.
      // Check the native guest name independently of the button's identity.
      const savedNames = [blocked.displayName, ...blocked.nameAliases];
      expect(savedNames).toContain(guest);
      expect(savedNames.some((name) => name.includes(lead))).toBe(false);
    });
  });
}
