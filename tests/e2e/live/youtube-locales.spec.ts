import { expect, test } from "../fixtures/extension.fixture";

test.use({ locale: "ko-KR" });

const koreanSurfaces = [
  {
    name: "channel videos",
    url: "https://www.youtube.com/@BoahsLoL/videos?hl=ko",
    selector: "yt-lockup-view-model",
    capture: "yt-page-header-renderer, yt-lockup-view-model"
  },
  {
    name: "search and compact Shorts",
    url: "https://www.youtube.com/results?search_query=cat+videos&hl=ko",
    selector: "ytd-video-renderer",
    capture: "ytd-video-renderer, ytm-shorts-lockup-view-model"
  },
  {
    name: "watch recommendations",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&hl=ko",
    selector: "ytd-watch-next-secondary-results-renderer yt-lockup-view-model",
    capture: "ytd-watch-next-secondary-results-renderer yt-lockup-view-model"
  },
  {
    name: "Shorts player",
    url: "https://www.youtube.com/shorts/E4PB_V8yZso?hl=ko",
    selector: "ytd-shorts yt-reel-channel-bar-view-model",
    capture: "yt-reel-channel-bar-view-model, reel-action-bar-view-model"
  }
];

for (const surface of koreanSurfaces) {
  test(`inspects Korean YouTube ${surface.name}`, async ({ extensionPage }, testInfo) => {
    // Allow the existing 30-second live navigation and renderer waits to finish.
    test.setTimeout(60_000);
    try {
      await extensionPage.goto(surface.url, {
        waitUntil: "domcontentloaded",
        timeout: 30_000
      });
      await expect(extensionPage.locator("html")).toHaveAttribute("lang", /^ko(?:-|$)/);
      await expect(extensionPage.locator(surface.selector).first()).toBeVisible({
        timeout: 30_000
      });
    } finally {
      // These fresh profiles are logged out. Keep only the public renderers needed
      // to reproduce locale-dependent creator and overflow-menu detection.
      const snapshot = await extensionPage.evaluate((selector) => ({
        url: location.href,
        documentLanguage: document.documentElement.lang,
        browserLanguage: navigator.language,
        elements: [...document.querySelectorAll(selector)].slice(0, 8).map((element) => {
          const copy = element.cloneNode(true) as Element;
          copy.querySelectorAll("script, style").forEach((node) => node.remove());
          return {
            tag: element.tagName.toLowerCase(),
            labels: [...element.querySelectorAll("[aria-label]")].map((node) =>
              node.getAttribute("aria-label")),
            html: copy.outerHTML
          };
        })
      }), surface.capture);
      await testInfo.attach("korean-youtube-dom.json", {
        body: JSON.stringify(snapshot, null, 2),
        contentType: "application/json"
      });
    }
  });
}
