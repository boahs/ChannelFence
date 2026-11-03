import { blockedCreator } from "../../e2e/fixtures/extension.fixture";
import { channelHeader, watchOwner } from "../../e2e/fixtures/youtube-fixtures";
import { expect, expectContainsText, expectCount, expectText, expectVisible, openFixture, test } from "../extension.fixture";

test.describe("direct navigation guard", () => {
  test("stops a direct visit to a blocked channel and can unblock it", async ({ addon }) => {
    await addon.setStorage({ cfBlockedChannels: [blockedCreator("@alpha", "Alpha Creator")] });
    await openFixture(addon.page, channelHeader("Alpha Creator", "@alpha"), "/@alpha");
    await expectVisible(addon.page, "#cf-hard-block-overlay");
    await expectContainsText(addon.page, "#cf-hard-block-overlay", "alpha is on your ChannelFence block list.");
    await expectText(addon.page, "#cf-hard-block-overlay .cf-hard-block-actions button:last-child", "Unblock and continue");
    await addon.page.locator("#cf-hard-block-overlay .cf-hard-block-actions button:last-child").click();
    await expectCount(addon.page, "#cf-hard-block-overlay", 0);
    expect((await addon.getStorage("cfBlockedChannels")).cfBlockedChannels).toEqual([]);
  });

  test("stops direct watch-page playback for a blocked creator", async ({ addon }) => {
    await addon.setStorage({ cfBlockedChannels: [blockedCreator("@watchcreator", "Watch Creator")] });
    await openFixture(addon.page, watchOwner("Watch Creator", "@watchcreator"), "/watch?v=blocked-video");
    await expectVisible(addon.page, "#cf-hard-block-overlay");
    await expectVisible(addon.page, "#cf-hard-block-overlay h1");
    await expectContainsText(addon.page, "#cf-hard-block-overlay h1", "Creator blocked");
  });
});
