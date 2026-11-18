import { expectedHomeMetadata, homeMetadataChecks, homeMetadataFixture } from "../../e2e/fixtures/home-metadata-layout";
import { expect, expectAttribute, expectCount, expectCSS, expectVisible, openFixture, test } from "../extension.fixture";

for (const direction of ["ltr", "rtl"] as const) {
  for (const size of ["native", "small", "medium", "large"]) {
    test(`keeps ${direction} Home names, views and timestamps readable in the ${size} grid`, async ({ addon }, testInfo) => {
      await addon.setStorage({ cfCompactHomeGrid: size !== "native", cfCompactHomeSize: size === "native" ? "medium" : size });
      await openFixture(addon.page, homeMetadataFixture(direction), "/");
      for (const width of [1536, 900, 390]) {
        await addon.page.setViewport({ width, height: 1100 });
        for (const position of ["before", "after"] as const) {
          await addon.setStorage({ cfBlockButtonPosition: position });
          await expectAttribute(addon.page, "[data-testid='ordinary'] .cf-block-button", "data-cf-position", position);
          await expect.poll(() => addon.page.evaluate(homeMetadataChecks)).toEqual(expectedHomeMetadata);
        }
        if (width === 1536) await testInfo.attach(`home-${size}-${direction}`, {
          body: Buffer.from(await addon.page.screenshot({ path: testInfo.outputPath(`home-${size}-${direction}.png`) })), contentType: "image/png"
        });
      }
      await addon.setStorage({ cfEnabled: false });
      await expectCount(addon.page, ".cf-block-button", 0);
      await expectCSS(addon.page, ".ytContentMetadataViewModelMetadataRow", "flex-wrap", "nowrap");
      await addon.setStorage({ cfEnabled: true });
      await expect.poll(() => addon.page.evaluate(homeMetadataChecks)).toEqual(expectedHomeMetadata);
      await addon.page.click("[data-testid='collaboration'] [data-cf-identity='handle:@collaboration1']");
      await expect.poll(() => addon.page.$eval("[data-testid='collaboration']", (card) => getComputedStyle(card).display)).toBe("none");
      await expectVisible(addon.page, "[data-testid='ordinary']");
      expect((await addon.getStorage<{ cfBlockedChannels: Array<{ key: string }> }>("cfBlockedChannels"))
        .cfBlockedChannels.map((entry) => entry.key)).toEqual(["handle:@collaboration1"]);
    });
  }
}
