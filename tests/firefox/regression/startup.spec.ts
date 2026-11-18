import manifest from "../../../manifest.json";
import { expect, test, expectAttribute, expectCount, expectVisible } from "../extension.fixture";
import { shortsRendererTags } from "../../e2e/fixtures/shorts-renderers";
import { exerciseStartupScans, startupControls, startupDocument, startupUrl } from "../../e2e/fixtures/startup";

const sourceRoot = process.env.CHANNELFENCE_FIREFOX_EXTENSION_PATH || `dist/ChannelFence-${manifest.version}-firefox`;

for (const tag of shortsRendererTags) {
  test.describe(`Settings startup ${tag}`, () => {
    test.beforeEach(async ({ addon }) => {
      await addon.page.bringToFront();
      await addon.page.setRequestInterception(true);
    });

    test("waits for saved settings before allowing a block and retains preloaded blocked creators", async ({ addon }) => {
      const page = addon.page;
      const html = await startupDocument(sourceRoot, tag);
      page.on("request", (request) => request.url() === startupUrl
        ? request.respond({ contentType: "text/html", body: html }) : request.abort());
      await page.goto(startupUrl);
      await expect.poll(() => page.evaluate(() => window.cfStartup.settingsReads)).toBe(1);
      const saved = await page.evaluate(() => window.cfStartup.stored);
      await page.evaluate(exerciseStartupScans);
      await expectCount(page, startupControls, 0);
      expect(await page.evaluate(() => window.cfStartup.writes)).toEqual([]);
      expect(await page.evaluate(() => window.cfStartup.stored)).toEqual(saved);

      await page.evaluate(() => window.cfStartup.resolveSettings());
      const first = '[data-testid="first-reel"] .cf-shorts-action';
      await expectAttribute(page, first, "data-cf-identity", "handle:@firstcreator");
      await page.click(first);
      await expect.poll(() => page.url()).toBe("https://channelfence.test/shorts/third");
      await expectVisible(page, '[data-testid="third-reel"] .cf-shorts-action');
      expect(await page.evaluate(() => window.cfStartup.stored.cfBlockedChannels
        .flatMap((entry) => entry.aliases).sort())).toEqual(["handle:@firstcreator", "handle:@secondcreator"]);
      await expectCount(page, "html.cf-watch-pending", 0);
    });

    test("keeps controls absent when the delayed saved setting is paused", async ({ addon }) => {
      const page = addon.page;
      const html = await startupDocument(sourceRoot, tag, false);
      page.on("request", (request) => request.url() === startupUrl
        ? request.respond({ contentType: "text/html", body: html }) : request.abort());
      await page.goto(startupUrl);
      await expect.poll(() => page.evaluate(() => window.cfStartup.settingsReads)).toBe(1);
      await page.evaluate(exerciseStartupScans);
      await expectCount(page, startupControls, 0);
      await page.evaluate(() => window.cfStartup.resolveSettings());
      await page.evaluate(exerciseStartupScans);
      await expectCount(page, startupControls, 0);
      expect(await page.evaluate(() => window.cfStartup.writes)).toEqual([]);
      expect(page.url()).toBe(startupUrl);
    });

    test("keeps controls absent after all initial settings reads fail", async ({ addon }) => {
      const page = addon.page;
      const html = await startupDocument(sourceRoot, tag);
      page.on("request", (request) => request.url() === startupUrl
        ? request.respond({ contentType: "text/html", body: html }) : request.abort());
      await page.goto(startupUrl);
      const saved = await page.evaluate(() => window.cfStartup.stored);
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        await expect.poll(() => page.evaluate(() => window.cfStartup.settingsReads)).toBe(attempt);
        await page.evaluate(() => window.cfStartup.rejectSettings());
      }
      await page.evaluate(exerciseStartupScans);
      await expect.poll(() => page.evaluate(() => window.cfStartup.pendingTimers)).toBe(0);
      await page.evaluate(exerciseStartupScans);
      await expectCount(page, startupControls, 0);
      expect(await page.evaluate(() => window.cfStartup.writes)).toEqual([]);
      expect(await page.evaluate(() => window.cfStartup.stored)).toEqual(saved);
      expect(page.url()).toBe(startupUrl);
      await expectCount(page, "html.cf-watch-pending", 0);
    });
  });
}
