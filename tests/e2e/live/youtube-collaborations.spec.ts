import { expect, test } from "../fixtures/extension.fixture";
import { assertLiveYouTubeAccess } from "../fixtures/live-youtube-access";
import { allLocales } from "../fixtures/locales";
import { reportedCollaborators } from "../fixtures/localized-collaboration";

for (const locale of allLocales) {
  test.describe(`${locale.name} live YouTube collaborations`, () => {
    test.use({ locale: locale.browserLocale });
    // Match the existing live locale checks: navigation and native hydration.
    test.setTimeout(60_000);

    test.afterEach(async ({ extensionPage }, testInfo) => {
      if (testInfo.status === testInfo.expectedStatus) return;
      const snapshot = await extensionPage.evaluate(() => ({
        url: location.href,
        documentLanguage: document.documentElement.lang,
        browserLanguage: navigator.language,
        cards: [...document.querySelectorAll("ytd-search ytd-video-renderer, ytd-search yt-lockup-view-model")]
          .slice(0, 12).map((element) => {
            const copy = element.cloneNode(true) as Element;
            copy.querySelectorAll("script, style").forEach((node) => node.remove());
            return copy.outerHTML;
          })
      }));
      await testInfo.attach(`${locale.catalogCode}-collaboration-dom`, {
        body: JSON.stringify(snapshot, null, 2), contentType: "application/json"
      });
      await testInfo.attach(`${locale.catalogCode}-collaboration-page`, {
        body: await extensionPage.screenshot(), contentType: "image/png"
      });
    });

    test("blocks only the selected guest from a native collaboration search result", async ({
      extensionPage, extensionStorage, serviceWorker
    }, testInfo) => {
      const uiLanguage = await serviceWorker.evaluate(() =>
        (globalThis as unknown as { chrome: { i18n: { getUILanguage(): string } } }).chrome.i18n.getUILanguage());
      expect(uiLanguage).toMatch(locale.uiLanguage);
      await extensionPage.goto(
        `https://www.youtube.com/results?search_query=Folk+Singers+Nagaraju+Ramu+hmtv+music&hl=${locale.youtubeLanguage}`,
        { waitUntil: "domcontentloaded", timeout: 30_000 }
      );
      assertLiveYouTubeAccess(extensionPage.url());
      await expect(extensionPage.locator("html")).toHaveAttribute("lang", locale.documentLanguage);

      const [lead, guest] = reportedCollaborators;
      // Select native creator metadata, never a title/description that merely
      // mentions both channels or an injected control whose absence is the bug.
      const byline = extensionPage.locator(
        "#attributed-channel-name, .ytContentMetadataViewModelMetadataRow:first-child"
      ).filter({ hasText: lead }).filter({ hasText: guest });
      const card = extensionPage.locator("ytd-search ytd-video-renderer, ytd-search yt-lockup-view-model")
        .filter({ has: byline }).first();
      await expect(card).toBeVisible({ timeout: 30_000 });
      const buttons = card.locator(".cf-block-button");
      await expect(buttons).toHaveCount(2);
      const labels = reportedCollaborators.map((name) => locale.messages.contentBlockNamed.message.replace("$CREATOR$", name));
      expect(await buttons.evaluateAll((elements) => elements.map((element) => element.getAttribute("aria-label")).sort()))
        .toEqual([...labels].sort());
      for (const label of labels) await expect(card.getByRole("button", { name: label, exact: true })).toBeVisible();
      const leadButton = card.getByRole("button", { name: labels[0], exact: true });
      const guestButton = card.getByRole("button", { name: labels[1], exact: true });
      const leadIdentity = await leadButton.getAttribute("data-cf-identity");
      const guestIdentity = await guestButton.getAttribute("data-cf-identity");
      expect(leadIdentity).toMatch(/^(?:name|handle|channel):/);
      expect(guestIdentity).toMatch(/^(?:name|handle|channel):/);
      const guestAliases = guestIdentity!.startsWith("name:") ? [guestIdentity!] : guestIdentity!.split("|");
      expect(guestAliases.every((alias) => !leadIdentity!.split("|").includes(alias))).toBe(true);

      await guestButton.scrollIntoViewIfNeeded();
      await expect(guestButton).toBeInViewport();
      await testInfo.attach(`${locale.catalogCode}-collaboration-buttons`, {
        body: await card.screenshot(), contentType: "image/png"
      });
      await guestButton.click();
      await expect(card).toBeHidden();
      await expect.poll(async () => (await extensionStorage.get<{
        cfBlockedChannels: Array<{ aliases: string[] }>;
      }>("cfBlockedChannels")).cfBlockedChannels.map((entry) => [...entry.aliases].sort()))
        .toEqual([[...guestAliases].sort()]);
      const { cfBlockedChannels: [blocked] } = await extensionStorage.get<{
        cfBlockedChannels: Array<{ displayName: string; nameAliases: string[] }>;
      }>("cfBlockedChannels");
      // Stable channel/handle identities can use a canonical display label, but
      // their saved names must still identify only the guest, never the byline.
      const savedNames = [blocked.displayName, ...blocked.nameAliases];
      expect(savedNames).toContain(guest);
      expect(savedNames.some((name) => name.includes(lead))).toBe(false);
    });
  });
}
