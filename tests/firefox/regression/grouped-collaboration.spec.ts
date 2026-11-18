import { expect, expectAttribute, expectCount, expectVisible, openFixture, test } from "../extension.fixture";
import {
  expectedGroupedCollaborationLayout, groupedCollaboration, groupedCollaborationCases, groupedCollaborationLayoutChecks
} from "../../e2e/fixtures/grouped-collaboration";
import { homeMetadataFixture } from "../../e2e/fixtures/home-metadata-layout";
import { rightRailLockup } from "../../e2e/fixtures/youtube-fixtures";

for (const scenario of groupedCollaborationCases) {
  test(`keeps separate creator identities in the ${scenario.title}`, async ({ addon }) => {
    const page = addon.page;
    await openFixture(page, groupedCollaboration(scenario) + scenario.names.map((displayName, index) =>
      rightRailLockup({ id: `solo-${index}`, displayName })
    ).join(""), "/");
    const card = '[data-testid="collaboration"]';
    const controls = card + " .cf-block-button";
    const identities = scenario.names.map((name) => `name:${name.toLowerCase()}`);
    await expectCount(page, controls, 2);
    expect(await page.$$eval(controls, (buttons) => buttons.map((button) => button.getAttribute("data-cf-identity"))))
      .toEqual(identities);

    await page.$eval(card + " [data-stat='age']", (stat, text) => {
      stat.textContent = text;
    }, scenario.live ? "597 watching" : "6h ago");
    await addon.setStorage({ cfBlockButtonPosition: "after" });
    await expectAttribute(page, controls, "data-cf-position", "after");
    await expectCount(page, controls, 2);
    expect(await page.$$eval(controls, (buttons) => buttons.map((button) => button.getAttribute("data-cf-identity"))))
      .toEqual(identities);
    await page.locator(`${card} button[aria-label=${JSON.stringify(`Block ${scenario.names[1]}`)}]`).click();
    await expectVisible(page, card, false);
    await expectVisible(page, '[data-testid="solo-1"]', false);
    await expectVisible(page, '[data-testid="solo-0"]');
    expect((await addon.getStorage<{ cfBlockedChannels: unknown[] }>("cfBlockedChannels")).cfBlockedChannels)
      .toEqual([expect.objectContaining({ key: identities[1], aliases: [identities[1]], displayName: scenario.names[1] })]);
  });
}

test("keeps a collapsed collaboration's named creator without its Home statistics", async ({ addon }) => {
  await openFixture(addon.page, groupedCollaboration({ names: ["Business Insider and 2 more"] }), "/");
  await expectCount(addon.page, '[data-testid="collaboration"] .cf-block-button', 1);
  await addon.page.locator('[data-testid="collaboration"] button[aria-label="Block Business Insider"]').click();
  await expectVisible(addon.page, '[data-testid="collaboration"]', false);
  expect((await addon.getStorage<{ cfBlockedChannels: unknown[] }>("cfBlockedChannels")).cfBlockedChannels)
    .toEqual([expect.objectContaining({ key: "name:business insider", aliases: ["name:business insider"], displayName: "Business Insider" })]);
});

test("does not invent creators from unknown grouped Home fields", async ({ addon }) => {
  const page = addon.page;
  await openFixture(page, groupedCollaboration(groupedCollaborationCases[0]) +
    groupedCollaboration({ id: "missing-connector", names: ["Lead", "Guest"], connector: "" }) +
    groupedCollaboration({ id: "extra-field", names: ["Lead", "Guest", "Third"] }), "/");
  await expectCount(page, '[data-testid="collaboration"] .cf-block-button', 2);
  for (const id of ["missing-connector", "extra-field"]) {
    await expectVisible(page, `[data-testid="${id}"]`);
    await expectCount(page, `[data-testid="${id}"] .cf-block-button`, 0);
  }
});

test("keeps linkless Home collaborators, controls and statistics readable", async ({ addon }, testInfo) => {
  const markup = homeMetadataFixture().replace('<div id="contents">', '<div id="contents"><ytd-rich-item-renderer>' +
    groupedCollaboration({ ...groupedCollaborationCases[0], id: "native-collaboration" }) + '</ytd-rich-item-renderer>');
  await openFixture(addon.page, markup, "/");
  for (const compact of [false, true]) {
    await addon.setStorage({ cfCompactHomeGrid: compact, cfCompactHomeSize: "small" });
    for (const width of [1536, 900, 390]) {
      await addon.page.setViewport({ width, height: 1100 });
      for (const position of ["before", "after"] as const) {
        await addon.setStorage({ cfBlockButtonPosition: position });
        await expectAttribute(addon.page, '[data-testid="native-collaboration"] .cf-block-button', "data-cf-position", position);
        await expect.poll(() => addon.page.evaluate(groupedCollaborationLayoutChecks), {
          message: `Linkless collaborators fit ${compact ? "compact" : "native"} Home at ${width}px with controls ${position}`
        }).toEqual(expectedGroupedCollaborationLayout);
      }
    }
  }
  await testInfo.attach("linkless-home-collaborators", { body: Buffer.from(await addon.page.screenshot()), contentType: "image/png" });
});
