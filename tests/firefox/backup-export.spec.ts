import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { blockedCreator } from "../e2e/fixtures/extension.fixture";
import { expect, expectText, openOptions, test } from "./extension.fixture";

test("downloads a real block-list backup and restores it after clearing storage", async ({ addon }, testInfo) => {
  const creator = { ...blockedCreator("@firefoxbackup", "Firefox Backup Creator"), shortPaths: [] };
  await addon.setStorage({ cfBlockedChannels: [creator] });
  const downloadPath = testInfo.outputPath("downloads");
  await mkdir(downloadPath, { recursive: true });
  await openOptions(addon);
  await expectText(addon.ui, "#blockedCount", "1");
  await addon.ui.locator("#exportButton").click();

  const backupFiles = async () => (await readdir(downloadPath))
    .filter((file) => /^channelfence-block-list-\d{4}-\d{2}-\d{2}\.json$/.test(file));
  await expect.poll(backupFiles, { message: "Firefox downloaded the JSON backup" }).toHaveLength(1);
  const [filename] = await backupFiles();
  const backupPath = path.join(downloadPath, filename);
  await expect.poll(async () => {
    try {
      return JSON.parse(await readFile(backupPath, "utf8"));
    } catch (error) {
      // The filename can appear before Firefox finishes writing its contents.
      if (error instanceof SyntaxError) return null;
      throw error;
    }
  }, { message: "The downloaded backup contains the complete blocked creator" }).toEqual({
    product: "ChannelFence", formatVersion: 1,
    exportedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
    blockedChannels: [creator]
  });
  await testInfo.attach("downloaded-block-list", { path: backupPath, contentType: "application/json" });

  await addon.setStorage({ cfBlockedChannels: [] });
  await expectText(addon.ui, "#blockedCount", "0");
  expect(await addon.getStorage("cfBlockedChannels")).toEqual({ cfBlockedChannels: [] });
  // Firefox BiDi cannot set files on privileged extension pages. Feed the
  // actual downloaded contents through the page's unmodified import handler.
  await addon.ui.evaluate(({ name, contents }) => {
    const input = document.querySelector<HTMLInputElement>("#importFile");
    if (!input) throw new Error("Missing backup import input");
    const transfer = new DataTransfer();
    transfer.items.add(new File([contents], name, { type: "application/json" }));
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, { name: filename, contents: await readFile(backupPath, "utf8") });
  await expectText(addon.ui, "#blockedCount", "1");
  await expect.poll(() => addon.getStorage("cfBlockedChannels")).toEqual({ cfBlockedChannels: [creator] });
});
