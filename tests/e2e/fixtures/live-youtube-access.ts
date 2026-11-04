// Check the navigation result before asserting YouTube language or renderers.
// A Google challenge is a failed live check, never a passing or skipped test.
export function assertLiveYouTubeAccess(url: string): void {
  const destination = new URL(url);
  if ((destination.hostname === "www.google.com" || destination.hostname === "google.com") &&
      destination.pathname.startsWith("/sorry/")) {
    throw new Error(
      "[YOUTUBE_ACCESS_BLOCKED] Google redirected this live YouTube visit to its unusual-traffic/CAPTCHA page. " +
      "ChannelFence behavior could not be tested on this page. " +
      `Destination: ${destination.origin}${destination.pathname}`
    );
  }
}
