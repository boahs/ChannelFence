import { expect, test } from "../fixtures/extension.fixture";

test("injects ChannelFence on the live YouTube origin", async ({ extensionPage }) => {
  await extensionPage.goto("https://www.youtube.com/@YouTube", {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });

  await expect.poll(() => extensionPage.evaluate(() => {
    const probe = document.createElement("div");
    probe.className = "cf-hidden-by-channelfence";
    document.body.append(probe);
    const display = getComputedStyle(probe).display;
    probe.remove();
    return display;
  })).toBe("none");
});
