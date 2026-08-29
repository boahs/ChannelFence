import { blockedCreator, expect, test } from "../fixtures/extension.fixture";
import { OptionsPage, PopupPage } from "../pages/extension-ui.page";

test.describe("extension UI", () => {
  test("popup shows the block list and unblocks a creator", async ({
    extensionId,
    extensionPage,
    extensionStorage
  }) => {
    await extensionStorage.set({
      cfBlockedChannels: [blockedCreator("@alpha", "Alpha Creator")]
    });
    const popup = new PopupPage(extensionPage, extensionId);
    await popup.open();

    await expect(extensionPage.locator("#blockedCount")).toHaveText("1");
    await expect(extensionPage.locator("#recentList")).toContainText("alpha");
    await expect(extensionPage.getByRole("link", { name: "Report a bug" })).toHaveAttribute(
      "href",
      "https://github.com/boahs/ChannelFence/issues/new?template=bug_report.yml"
    );
    await extensionPage.getByRole("button", { name: "Unblock alpha" }).click();
    await expect(extensionPage.locator("#blockedCount")).toHaveText("0");
    expect((await extensionStorage.get<{ cfBlockedChannels: unknown[] }>("cfBlockedChannels"))
      .cfBlockedChannels).toEqual([]);
  });

  test("options searches and updates the local block list", async ({
    extensionId,
    extensionPage,
    extensionStorage
  }) => {
    await extensionStorage.set({
      cfBlockedChannels: [
        blockedCreator("@alpha", "Alpha Creator"),
        blockedCreator("@beta", "Beta Creator")
      ]
    });
    const options = new OptionsPage(extensionPage, extensionId);
    await options.open();

    await expect(extensionPage.locator("#blockedCount")).toHaveText("2");
    await extensionPage.getByRole("searchbox", { name: "Search blocked creators" }).fill("beta");
    await expect(extensionPage.locator("#blockList")).toContainText("beta");
    await expect(extensionPage.locator("#blockList")).not.toContainText("alpha");

    await extensionPage.locator("#blockList").getByRole("button", { name: "Unblock" }).click();
    await expect(extensionPage.locator("#blockedCount")).toHaveText("1");
    const stored = await extensionStorage.get<{ cfBlockedChannels: Array<{ displayName: string }> }>(
      "cfBlockedChannels"
    );
    expect(stored.cfBlockedChannels.map((entry) => entry.displayName)).toEqual(["alpha"]);
  });

  test("options pages a 500-creator list while keeping every entry searchable", async ({
    extensionId,
    extensionPage,
    extensionStorage
  }) => {
    await extensionStorage.set({
      cfBlockedChannels: Array.from({ length: 500 }, (_, index) =>
        blockedCreator(`@creator-${index}`, `Creator ${index}`))
    });
    const options = new OptionsPage(extensionPage, extensionId);
    await options.open();

    await expect(extensionPage.locator("#blockedCount")).toHaveText("500");
    await expect(extensionPage.locator("#blockList > li")).toHaveCount(200);
    await expect(extensionPage.locator("#listStatus"))
      .toHaveText("Showing 200 of 500 matching creators.");

    await extensionPage.getByRole("button", { name: "Show 200 more" }).click();
    await expect(extensionPage.locator("#blockList > li")).toHaveCount(400);

    await extensionPage.getByRole("searchbox", { name: "Search blocked creators" })
      .fill("Creator 499");
    await expect(extensionPage.locator("#blockList > li")).toHaveCount(1);
    await expect(extensionPage.locator("#blockList")).toContainText("creator-499");
    await expect(extensionPage.locator("#listPagination")).toBeHidden();
  });

  test("options toggles settings and imports a ChannelFence backup", async ({
    extensionId,
    extensionPage,
    extensionStorage
  }) => {
    const options = new OptionsPage(extensionPage, extensionId);
    await options.open();

    await extensionPage.getByRole("checkbox", { name: "Enable ChannelFence" }).locator("..").click();
    await extensionPage.getByRole("checkbox", { name: "Hide comments from blocked creators" })
      .locator("..")
      .click();
    await extensionPage.getByRole("checkbox", { name: "Hide Shorts in YouTube feeds" })
      .locator("..")
      .click();
    await extensionPage.locator("#importFile").setInputFiles({
      name: "channelfence-backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({
        product: "ChannelFence",
        formatVersion: 1,
        blockedChannels: [blockedCreator("@imported", "Imported Creator")]
      }))
    });

    await expect(extensionPage.locator("#toast")).toContainText("Imported 1 creator");
    const stored = await extensionStorage.get<{
      cfBlockedChannels: Array<{ displayName: string }>;
      cfEnabled: boolean;
      cfHideComments: boolean;
      cfHideHomeShorts: boolean;
    }>(["cfBlockedChannels", "cfEnabled", "cfHideComments", "cfHideHomeShorts"]);
    expect(stored).toMatchObject({
      cfEnabled: false,
      cfHideComments: false,
      cfHideHomeShorts: true
    });
    expect(stored.cfBlockedChannels[0].displayName).toBe("imported");
  });

  test("popup toggles the Hide Shorts in feeds preference", async ({
    extensionId,
    extensionPage,
    extensionStorage
  }) => {
    const popup = new PopupPage(extensionPage, extensionId);
    await popup.open();

    const toggle = extensionPage.getByRole("checkbox", { name: "Hide Shorts in YouTube feeds" });
    await expect(toggle).not.toBeChecked();
    await toggle.locator("..").click();
    await expect(toggle).toBeChecked();

    const stored = await extensionStorage.get<{ cfHideHomeShorts: boolean }>("cfHideHomeShorts");
    expect(stored.cfHideHomeShorts).toBe(true);
  });

  test("keeps an open options tab and popup synchronized", async ({
    extensionContext,
    extensionId,
    extensionPage
  }) => {
    const options = new OptionsPage(extensionPage, extensionId);
    await options.open();
    const optionsToggle = extensionPage.getByRole("checkbox", {
      name: "Hide Shorts in YouTube feeds"
    });
    await expect(optionsToggle).not.toBeChecked();

    const popupPage = await extensionContext.newPage();
    const popup = new PopupPage(popupPage, extensionId);
    await popup.open();
    const popupToggle = popupPage.getByRole("checkbox", {
      name: "Hide Shorts in YouTube feeds"
    });
    await popupToggle.locator("..").click();

    await expect(popupToggle).toBeChecked();
    await expect(optionsToggle).toBeChecked();

    await optionsToggle.locator("..").click();
    await expect(optionsToggle).not.toBeChecked();
    await expect(popupToggle).not.toBeChecked();
    await popupPage.close();
  });

  test("options validates and manually blocks a YouTube handle", async ({
    extensionId,
    extensionPage,
    extensionStorage
  }) => {
    const options = new OptionsPage(extensionPage, extensionId);
    await options.open();

    const input = extensionPage.getByLabel("Block by handle or channel URL");
    await input.fill("not a handle");
    await extensionPage.getByRole("button", { name: "Block creator" }).click();
    await expect(extensionPage.locator("#toast")).toContainText("Enter a valid YouTube handle");
    await expect(extensionPage.locator("#blockedCount")).toHaveText("0");

    await input.fill("youtube.com/@ManualCreator/videos");
    await extensionPage.getByRole("button", { name: "Block creator" }).click();
    await expect(extensionPage.locator("#blockedCount")).toHaveText("1");
    await expect(extensionPage.locator("#blockList .block-list__name"))
      .toHaveText("manualcreator");

    const stored = await extensionStorage.get<{
      cfBlockedChannels: Array<{ key: string; displayName: string }>;
    }>("cfBlockedChannels");
    expect(stored.cfBlockedChannels).toEqual([
      expect.objectContaining({ key: "handle:@manualcreator", displayName: "manualcreator" })
    ]);

    await input.fill("@ManualCreator");
    await extensionPage.getByRole("button", { name: "Block creator" }).click();
    await expect(extensionPage.locator("#toast")).toContainText("already blocked");
    await expect(extensionPage.locator("#blockedCount")).toHaveText("1");
  });

  test("exports a valid private block-list backup", async ({
    extensionId,
    extensionPage,
    extensionStorage
  }) => {
    await extensionStorage.set({
      cfBlockedChannels: [blockedCreator("@alpha", "Alpha Creator")]
    });
    const options = new OptionsPage(extensionPage, extensionId);
    await options.open();

    const downloadPromise = extensionPage.waitForEvent("download");
    await extensionPage.getByRole("button", { name: "Export" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^channelfence-block-list-\d{4}-\d{2}-\d{2}\.json$/);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    expect(payload).toMatchObject({ product: "ChannelFence", formatVersion: 1 });
    expect(payload.blockedChannels[0].displayName).toBe("alpha");
  });
});
