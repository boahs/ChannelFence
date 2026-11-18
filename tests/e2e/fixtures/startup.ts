import { readFile } from "node:fs/promises";
import path from "node:path";
import { blockedCreator } from "./extension.fixture";
import { shortsRendererQueue, shortsRendererTags } from "./shorts-renderers";
import { youtubeDocument } from "./youtube-fixtures";

type StoredValues = Record<string, unknown> & {
  cfBlockedChannels: Array<{ aliases: string[] }>;
};
type Catalog = Record<string, { message: string }>;

declare global {
  interface Window {
    cfStartup: {
      stored: StoredValues;
      writes: Array<Record<string, unknown>>;
      settingsReads: number;
      pendingTimers: number;
      resolveSettings(): void;
      rejectSettings(): void;
    };
  }
}

// Mock only extension APIs. The production scripts, DOM observers, scans, and
// block/skip behavior execute in the browser without exposing production hooks.
function installStorageMock(stored: StoredValues, catalog: Catalog, iconUrl: string): void {
  const listeners: Array<(changes: Record<string, unknown>, area: string) => void> = [];
  let resolveSettings: (values: StoredValues) => void;
  let rejectSettings: (reason: Error) => void;
  const timers = new Set<number>();
  const timerWindow: Window = window;
  const nativeSetTimeout = timerWindow.setTimeout.bind(window);
  const nativeClearTimeout = timerWindow.clearTimeout.bind(window);
  timerWindow.setTimeout = (handler, delay, ...args) => {
    const timer = nativeSetTimeout(() => {
      timers.delete(timer);
      if (typeof handler === "function") handler(...args);
      else window.eval(handler);
    }, delay);
    timers.add(timer);
    return timer;
  };
  timerWindow.clearTimeout = (timer) => {
    timers.delete(timer!);
    nativeClearTimeout(timer);
  };
  const control = window.cfStartup = {
    stored,
    writes: [] as Array<Record<string, unknown>>,
    settingsReads: 0,
    // Observe completion of the real bounded retry timers, without sleeps or
    // changing their timing. No timer is pending while a settings read is held.
    get pendingTimers() { return timers.size; },
    resolveSettings() { resolveSettings(structuredClone(stored)); },
    rejectSettings() { rejectSettings(new Error("Initial settings unavailable")); }
  };
  Object.assign(globalThis, { chrome: {
    storage: {
      local: {
        get(keys: string | string[]) {
          if (keys === "cfLanguage") return Promise.resolve({ cfLanguage: "en" });
          control.settingsReads += 1;
          return new Promise<StoredValues>((resolve, reject) => {
            resolveSettings = resolve;
            rejectSettings = reject;
          });
        },
        async set(values: Record<string, unknown>) {
          control.writes.push(structuredClone(values));
          const changes = Object.fromEntries(Object.entries(values).map(([key, value]) =>
            [key, { oldValue: stored[key], newValue: structuredClone(value) }]));
          Object.assign(stored, structuredClone(values));
          listeners.forEach((listener) => listener(changes, "local"));
        }
      },
      onChanged: { addListener: (listener: typeof listeners[number]) => listeners.push(listener) }
    },
    runtime: {
      getURL: () => iconUrl,
      sendMessage: async (message: { type: string }) => message.type === "CF_GET_MESSAGES" ? catalog : undefined,
      onMessage: { addListener() {} }
    },
    i18n: { getMessage: (key: string) => catalog[key]?.message || key }
  } });
}

export const startupUrl = "https://channelfence.test/shorts/first";
export const startupControls = ".cf-shorts-action, .cf-block-button, .cf-menu-item, #cf-page-block-button";

export async function startupDocument(sourceRoot: string, tag: typeof shortsRendererTags[number], enabled = true): Promise<string> {
  const [shared, i18n, content, css, catalog, icon] = await Promise.all([
    readFile(path.join(sourceRoot, "src/shared.js"), "utf8"),
    readFile(path.join(sourceRoot, "src/i18n.js"), "utf8"),
    readFile(path.join(sourceRoot, "src/content.js"), "utf8"),
    readFile(path.join(sourceRoot, "src/content.css"), "utf8"),
    readFile(path.join(sourceRoot, "_locales/en/messages.json"), "utf8"),
    readFile(path.join(sourceRoot, "assets/icons/channelfence-48.png"))
  ]);
  const stored = {
    cfEnabled: enabled,
    cfLanguage: "en",
    cfBlockedChannels: [{ ...blockedCreator("@secondcreator", "second creator"), shortPaths: [] }]
  };
  const install = `(${installStorageMock.toString()})(${JSON.stringify(stored)}, ${catalog},
    "data:image/png;base64,${icon.toString("base64")}");`;
  // This origin is outside the installed extension's matches. Absolute creator
  // links retain real YouTube identities; only our injected source runs here.
  const body = shortsRendererQueue(tag).replaceAll("/@", "https://www.youtube.com/@");
  return youtubeDocument(body).replace("</head>", `<style>${css}</style>
    <script>${install}\n${shared}\n${i18n}\n${content}</script></head>`);
}

export async function exerciseStartupScans(): Promise<void> {
  const owner = document.querySelector('[data-testid="first-reel"] yt-reel-channel-bar-view-model a')!;
  owner.replaceWith(owner.cloneNode(true));
  // Let the mutation scan run separately from the coalesced full scan.
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  document.dispatchEvent(new Event("yt-page-data-updated"));
  document.querySelector('[data-testid="first-menu"]')!
    .dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  document.querySelector("ytd-menu-popup-renderer")?.remove();
  const menu = document.createElement("ytd-menu-popup-renderer");
  menu.innerHTML = '<div id="items" role="menu"><div role="menuitem">Report</div></div>';
  document.body.append(menu);
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}
