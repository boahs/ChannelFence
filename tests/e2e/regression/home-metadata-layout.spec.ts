import { expect, test } from "../fixtures/extension.fixture";
import { expectedHomeMetadata, homeMetadataChecks, homeMetadataFixture } from "../fixtures/home-metadata-layout";
import { YouTubeSurfacePage } from "../pages/youtube-surface.page";

for (const direction of ["ltr", "rtl"] as const) {
  for (const size of ["native", "small", "medium", "large"]) {
    test(`keeps ${direction} Home names, views and timestamps readable in the ${size} grid`, async ({ extensionPage, extensionStorage }, testInfo) => {
      await extensionStorage.set({ cfCompactHomeGrid: size !== "native", cfCompactHomeSize: size === "native" ? "medium" : size });
      const youtube = new YouTubeSurfacePage(extensionPage);
      await youtube.open(homeMetadataFixture(direction), "/");
      for (const width of [1536, 900, 390]) {
        await extensionPage.setViewportSize({ width, height: 1100 });
        for (const position of ["before", "after"] as const) {
          await extensionStorage.set({ cfBlockButtonPosition: position });
          await expect(youtube.blockButton("ordinary")).toHaveAttribute("data-cf-position", position);
          await expect.poll(() => extensionPage.evaluate(homeMetadataChecks)).toEqual(expectedHomeMetadata);
        }
        if (width === 1536) await testInfo.attach(`home-${size}-${direction}`, {
          body: await extensionPage.screenshot({ path: testInfo.outputPath(`home-${size}-${direction}.png`) }), contentType: "image/png"
        });
      }
      await extensionStorage.set({ cfEnabled: false });
      await expect(extensionPage.locator(".cf-block-button")).toHaveCount(0);
      await expect(extensionPage.locator(".ytContentMetadataViewModelMetadataRow").first()).toHaveCSS("flex-wrap", "nowrap");
      await extensionStorage.set({ cfEnabled: true });
      await expect.poll(() => extensionPage.evaluate(homeMetadataChecks)).toEqual(expectedHomeMetadata);
      await youtube.card("collaboration").locator("[data-cf-identity='handle:@collaboration1']").click();
      await expect(youtube.card("collaboration")).toBeHidden();
      await expect(youtube.card("ordinary")).toBeVisible();
      expect((await extensionStorage.get<{ cfBlockedChannels: Array<{ key: string }> }>("cfBlockedChannels"))
        .cfBlockedChannels.map((entry) => entry.key)).toEqual(["handle:@collaboration1"]);
    });
  }
}
