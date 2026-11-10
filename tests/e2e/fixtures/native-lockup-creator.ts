// Runs inside either browser against YouTube's own avatar, independently of
// ChannelFence controls. A movie's first metadata row can be a genre and year.
export function readNativeLockupCreator(
  root: Element, labels: { creator: string; goToChannel: string }
): string {
  const normalize = (value: string) => value.normalize("NFKC").replace(/\s+/g, " ").trim();
  const label = normalize(root.querySelector(".ytLockupMetadataViewModelAvatar [aria-label]:not(.cf-block-button)")
    ?.getAttribute("aria-label") || "");
  // YouTube can retain the English avatar label on an otherwise localized page.
  const english = label.match(/^Go to channel\s+(.+)$/i);
  if (english) return english[1].trim();

  const [prefix, suffix] = normalize(labels.goToChannel).split(normalize(labels.creator));
  if (suffix !== undefined && label.startsWith(prefix) && label.endsWith(suffix)) {
    return label.slice(prefix.length, label.length - suffix.length).trim();
  }
  return "";
}
