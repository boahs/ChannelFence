import { blockedCreator } from "../../e2e/fixtures/extension.fixture";
import { creatorCard } from "../../e2e/fixtures/youtube-fixtures";
import { expect, expectCount, expectText, expectVisible, openFixture, test } from "../extension.fixture";

test.describe("feed blocking", () => {
  test("blocks a creator, hides every matching card, and supports Undo", async ({ addon }) => {
    const page = addon.page;
    await openFixture(page, [
      creatorCard({ displayName: "Alpha Creator", handle: "@alpha", id: "alpha-one" }),
      creatorCard({ displayName: "Alpha Creator", handle: "@alpha", id: "alpha-two" }),
      creatorCard({ displayName: "Beta Creator", handle: "@beta", id: "beta" })
    ].join(""));

    await expectVisible(page, '[data-testid="alpha-one"] .cf-block-button');
    await page.locator('[data-testid="alpha-one"] .cf-block-button').click();
    await expectVisible(page, '[data-testid="alpha-one"]', false);
    await expectVisible(page, '[data-testid="alpha-two"]', false);
    await expectVisible(page, '[data-testid="beta"]');

    const values = await addon.getStorage("cfBlockedChannels");
    const entries = values.cfBlockedChannels as Array<{ aliases: string[]; displayName: string }>;
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ aliases: ["handle:@alpha"], displayName: "alpha" });
    expect(entries[0].displayName).not.toBe("8:41");

    await expectText(page, "#cf-toast button", "Undo");
    await page.locator("#cf-toast button").click();
    await expectVisible(page, '[data-testid="alpha-one"]');
    await expectVisible(page, '[data-testid="alpha-two"]');
    expect((await addon.getStorage("cfBlockedChannels")).cfBlockedChannels).toEqual([]);
  });

  test("processes cards added after the initial YouTube render", async ({ addon }) => {
    await openFixture(addon.page, creatorCard({
      displayName: "Initial Creator", handle: "@initial", id: "initial"
    }));
    await addon.page.evaluate((html) => document.body.insertAdjacentHTML("beforeend", html), creatorCard({
      displayName: "Late Creator", handle: "@late", id: "late"
    }));
    await expectVisible(addon.page, '[data-testid="late"] .cf-block-button');
  });

  test("recognizes membership-style lockups", async ({ addon }) => {
    await openFixture(addon.page, creatorCard({
      displayName: "Members Creator", handle: "@members", id: "membership", tag: "yt-lockup-view-model"
    }));
    await expectVisible(addon.page, '[data-testid="membership"] .cf-block-button');
  });

  test("keeps a busy feed responsive with 1,000 blocked creators", async ({ addon }) => {
    const blockedEntries = Array.from({ length: 1_000 }, (_, index) =>
      blockedCreator(`@large-block-${index}`, `Large Block ${index}`));
    await addon.setStorage({ cfBlockedChannels: blockedEntries });
    const cards = Array.from({ length: 60 }, (_, index) => {
      const isBlocked = index % 2 === 0;
      return creatorCard({
        displayName: isBlocked ? `Large Block ${900 + index}` : `Allowed ${index}`,
        handle: isBlocked ? `@large-block-${900 + index}` : `@allowed-${index}`,
        id: `${isBlocked ? "large-blocked" : "large-allowed"}-${index}`
      });
    });
    await openFixture(addon.page, cards.join(""));
    await expectCount(addon.page,
      'ytd-rich-item-renderer[data-testid^="large-blocked-"].cf-hidden-by-channelfence', 30);
    await expectCount(addon.page,
      'ytd-rich-item-renderer[data-testid^="large-allowed-"]:not(.cf-hidden-by-channelfence)', 30);
    await expectCount(addon.page, '[data-testid^="large-allowed-"] .cf-block-button', 30);

    await addon.setStorage({ cfBlockedChannels: [...blockedEntries, blockedCreator("@allowed-1", "Allowed 1")] });
    await expectVisible(addon.page, '[data-testid="large-allowed-1"]', false);
    await addon.setStorage({ cfBlockedChannels: blockedEntries });
    await expectVisible(addon.page, '[data-testid="large-allowed-1"]');
    await expectCount(addon.page, '[data-testid="large-allowed-1"] .cf-block-button', 1);
  });

  test("paused mode restores blocked cards and resumes without losing the list", async ({ addon }) => {
    await addon.setStorage({
      cfBlockedChannels: [blockedCreator("@alpha", "Alpha Creator")], cfEnabled: false
    });
    await openFixture(addon.page, creatorCard({ displayName: "Alpha Creator", handle: "@alpha", id: "alpha" }));
    await expectVisible(addon.page, '[data-testid="alpha"]');
    await expectCount(addon.page, '[data-testid="alpha"] .cf-block-button', 0);
    await addon.setStorage({ cfEnabled: true });
    await expectVisible(addon.page, '[data-testid="alpha"]', false);
  });
});
