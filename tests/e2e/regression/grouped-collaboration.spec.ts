import { expect, test } from "../fixtures/extension.fixture";
import {
  expectedGroupedCollaborationLayout, groupedCollaboration, groupedCollaborationCases, groupedCollaborationLayoutChecks
} from "../fixtures/grouped-collaboration";
import { homeMetadataFixture } from "../fixtures/home-metadata-layout";
import { rightRailLockup } from "../fixtures/youtube-fixtures";
import { YouTubeSurfacePage } from "../pages/youtube-surface.page";

for (const scenario of groupedCollaborationCases) {
  test(`keeps separate creator identities in the ${scenario.title}`, async ({ extensionPage, extensionStorage }) => {
    const youtube = new YouTubeSurfacePage(extensionPage);
    await youtube.open(groupedCollaboration(scenario) + scenario.names.map((displayName, index) =>
      rightRailLockup({ id: `solo-${index}`, displayName })
    ).join(""), "/");
    const controls = youtube.blockButton("collaboration");
    const identities = scenario.names.map((name) => `name:${name.toLowerCase()}`);
    await expect(controls).toHaveCount(2);
    expect(await controls.evaluateAll((buttons) => buttons.map((button) => button.getAttribute("data-cf-identity"))))
      .toEqual(identities);

    await youtube.card("collaboration").locator("[data-stat='age']").evaluate((stat, text) => {
      stat.textContent = text;
    }, scenario.live ? "597 watching" : "6h ago");
    await extensionStorage.set({ cfBlockButtonPosition: "after" });
    await expect(controls.first()).toHaveAttribute("data-cf-position", "after");
    await expect(controls).toHaveCount(2);
    expect(await controls.evaluateAll((buttons) => buttons.map((button) => button.getAttribute("data-cf-identity"))))
      .toEqual(identities);
    await youtube.card("collaboration").getByRole("button", { name: `Block ${scenario.names[1]}`, exact: true }).click();
    await expect(youtube.card("collaboration")).toBeHidden();
    await expect(youtube.card("solo-1")).toBeHidden();
    await expect(youtube.card("solo-0")).toBeVisible();
    expect((await extensionStorage.get<{ cfBlockedChannels: unknown[] }>("cfBlockedChannels")).cfBlockedChannels)
      .toEqual([expect.objectContaining({ key: identities[1], aliases: [identities[1]], displayName: scenario.names[1] })]);
  });
}

test("keeps a collapsed collaboration's named creator without its Home statistics", async ({ extensionPage, extensionStorage }) => {
  const youtube = new YouTubeSurfacePage(extensionPage);
  await youtube.open(groupedCollaboration({ names: ["Business Insider and 2 more"] }), "/");
  await expect(youtube.blockButton("collaboration")).toHaveCount(1);
  await youtube.card("collaboration").getByRole("button", { name: "Block Business Insider", exact: true }).click();
  await expect(youtube.card("collaboration")).toBeHidden();
  expect((await extensionStorage.get<{ cfBlockedChannels: unknown[] }>("cfBlockedChannels")).cfBlockedChannels)
    .toEqual([expect.objectContaining({ key: "name:business insider", aliases: ["name:business insider"], displayName: "Business Insider" })]);
});

test("does not invent creators from unknown grouped Home fields", async ({ extensionPage }) => {
  const youtube = new YouTubeSurfacePage(extensionPage);
  await youtube.open(groupedCollaboration(groupedCollaborationCases[0]) +
    groupedCollaboration({ id: "missing-connector", names: ["Lead", "Guest"], connector: "" }) +
    groupedCollaboration({ id: "extra-field", names: ["Lead", "Guest", "Third"] }), "/");
  await expect(youtube.blockButton("collaboration")).toHaveCount(2);
  for (const id of ["missing-connector", "extra-field"]) {
    await expect(youtube.card(id)).toBeVisible();
    await expect(youtube.blockButton(id)).toHaveCount(0);
  }
});

test("keeps linkless Home collaborators, controls and statistics readable", async ({ extensionPage, extensionStorage }, testInfo) => {
  const markup = homeMetadataFixture().replace('<div id="contents">', '<div id="contents"><ytd-rich-item-renderer>' +
    groupedCollaboration({ ...groupedCollaborationCases[0], id: "native-collaboration" }) + '</ytd-rich-item-renderer>');
  await new YouTubeSurfacePage(extensionPage).open(markup, "/");
  for (const compact of [false, true]) {
    await extensionStorage.set({ cfCompactHomeGrid: compact, cfCompactHomeSize: "small" });
    for (const width of [1536, 900, 390]) {
      await extensionPage.setViewportSize({ width, height: 1100 });
      for (const position of ["before", "after"] as const) {
        await extensionStorage.set({ cfBlockButtonPosition: position });
        await expect(extensionPage.locator('[data-testid="native-collaboration"] .cf-block-button').first())
          .toHaveAttribute("data-cf-position", position);
        await expect.poll(() => extensionPage.evaluate(groupedCollaborationLayoutChecks), {
          message: `Linkless collaborators fit ${compact ? "compact" : "native"} Home at ${width}px with controls ${position}`
        }).toEqual(expectedGroupedCollaborationLayout);
      }
    }
  }
  await testInfo.attach("linkless-home-collaborators", { body: await extensionPage.screenshot(), contentType: "image/png" });
});
