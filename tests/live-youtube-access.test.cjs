"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { assertLiveYouTubeAccess } = require("./e2e/fixtures/live-youtube-access.ts");

test("Google unusual-traffic redirects fail explicitly for every requested language", () => {
  for (const language of ["en", "ar", "nl"]) {
    const target = encodeURIComponent(`https://www.youtube.com/watch?v=example&hl=${language}`);
    for (const host of ["google.com", "www.google.com"]) {
      assert.throws(() => assertLiveYouTubeAccess(`https://${host}/sorry/index?continue=${target}`),
        /\[YOUTUBE_ACCESS_BLOCKED\].*ChannelFence behavior could not be tested/);
    }
  }
});

test("real YouTube URLs still proceed to their language and behavior assertions", () => {
  for (const url of [
    "https://www.youtube.com/watch?v=example&hl=ar",
    "https://www.youtube.com/results?search_query=google.com%2Fsorry%2Findex",
    "https://www.youtube.com/shorts/example",
    "https://www.youtube.com/@BoahsLoL/videos"
  ]) {
    assert.doesNotThrow(() => assertLiveYouTubeAccess(url));
  }
});

test("unrelated destinations are not mislabeled as Google's access challenge", () => {
  assert.doesNotThrow(() => assertLiveYouTubeAccess("https://example.com/sorry/index"));
  assert.doesNotThrow(() => assertLiveYouTubeAccess("https://www.google.com/search?q=youtube"));
});
