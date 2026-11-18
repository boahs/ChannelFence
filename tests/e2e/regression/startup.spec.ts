import { expect, test } from "../fixtures/extension.fixture";
import { shortsRendererTags } from "../fixtures/shorts-renderers";
import { exerciseStartupScans, startupControls, startupDocument, startupUrl } from "../fixtures/startup";

for (const tag of shortsRendererTags) {
  test.describe(`Settings startup ${tag}`, () => {
    test.beforeEach(async ({ extensionPage }) => {
      await extensionPage.route("**/*", (route) => route.abort());
    });

    test("waits for saved settings before allowing a block and retains preloaded blocked creators", async ({ extensionPage }) => {
      const html = await startupDocument(process.env.CHANNELFENCE_EXTENSION_PATH || ".", tag);
      await extensionPage.route(startupUrl, (route) => route.fulfill({ contentType: "text/html", body: html }));
      await extensionPage.goto(startupUrl);
      await expect.poll(() => extensionPage.evaluate(() => window.cfStartup.settingsReads)).toBe(1);
      const saved = await extensionPage.evaluate(() => window.cfStartup.stored);
      await extensionPage.evaluate(exerciseStartupScans);
      await expect(extensionPage.locator(startupControls)).toHaveCount(0);
      expect(await extensionPage.evaluate(() => window.cfStartup.writes)).toEqual([]);
      expect(await extensionPage.evaluate(() => window.cfStartup.stored)).toEqual(saved);

      await extensionPage.evaluate(() => window.cfStartup.resolveSettings());
      const first = extensionPage.locator('[data-testid="first-reel"] .cf-shorts-action');
      await expect(first).toHaveAttribute("data-cf-identity", "handle:@firstcreator");
      await first.click();
      await expect(extensionPage).toHaveURL("https://channelfence.test/shorts/third");
      await expect(extensionPage.locator('[data-testid="third-reel"] .cf-shorts-action')).toBeVisible();
      expect(await extensionPage.evaluate(() => window.cfStartup.stored.cfBlockedChannels
        .flatMap((entry) => entry.aliases).sort())).toEqual(["handle:@firstcreator", "handle:@secondcreator"]);
      await expect(extensionPage.locator("html")).not.toHaveClass(/cf-watch-pending/);
    });

    test("keeps controls absent when the delayed saved setting is paused", async ({ extensionPage }) => {
      const html = await startupDocument(process.env.CHANNELFENCE_EXTENSION_PATH || ".", tag, false);
      await extensionPage.route(startupUrl, (route) => route.fulfill({ contentType: "text/html", body: html }));
      await extensionPage.goto(startupUrl);
      await expect.poll(() => extensionPage.evaluate(() => window.cfStartup.settingsReads)).toBe(1);
      await extensionPage.evaluate(exerciseStartupScans);
      await expect(extensionPage.locator(startupControls)).toHaveCount(0);
      await extensionPage.evaluate(() => window.cfStartup.resolveSettings());
      await extensionPage.evaluate(exerciseStartupScans);
      await expect(extensionPage.locator(startupControls)).toHaveCount(0);
      expect(await extensionPage.evaluate(() => window.cfStartup.writes)).toEqual([]);
      await expect(extensionPage).toHaveURL(startupUrl);
    });

    test("keeps controls absent after all initial settings reads fail", async ({ extensionPage }) => {
      const html = await startupDocument(process.env.CHANNELFENCE_EXTENSION_PATH || ".", tag);
      await extensionPage.route(startupUrl, (route) => route.fulfill({ contentType: "text/html", body: html }));
      await extensionPage.goto(startupUrl);
      const saved = await extensionPage.evaluate(() => window.cfStartup.stored);
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        await expect.poll(() => extensionPage.evaluate(() => window.cfStartup.settingsReads)).toBe(attempt);
        await extensionPage.evaluate(() => window.cfStartup.rejectSettings());
      }
      await extensionPage.evaluate(exerciseStartupScans);
      await expect.poll(() => extensionPage.evaluate(() => window.cfStartup.pendingTimers)).toBe(0);
      await extensionPage.evaluate(exerciseStartupScans);
      await expect(extensionPage.locator(startupControls)).toHaveCount(0);
      expect(await extensionPage.evaluate(() => window.cfStartup.writes)).toEqual([]);
      expect(await extensionPage.evaluate(() => window.cfStartup.stored)).toEqual(saved);
      await expect(extensionPage).toHaveURL(startupUrl);
      await expect(extensionPage.locator("html")).not.toHaveClass(/cf-watch-pending/);
    });
  });
}
