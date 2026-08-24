import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  chromium,
  expect,
  test as base,
  type BrowserContext,
  type Page,
  type Worker
} from "@playwright/test";

const extensionPath = path.resolve(__dirname, "../../..");

type ExtensionStorageValues = Record<string, unknown>;

interface ExtensionChrome {
  storage: {
    local: {
      clear(): Promise<void>;
      get(keys?: string | string[] | null): Promise<ExtensionStorageValues>;
      set(values: ExtensionStorageValues): Promise<void>;
    };
  };
}

export class ExtensionStorage {
  constructor(private readonly worker: Worker) {}

  async clear(): Promise<void> {
    await this.worker.evaluate(async () => {
      const extensionChrome = (globalThis as unknown as { chrome: ExtensionChrome }).chrome;
      await extensionChrome.storage.local.clear();
    });
  }

  async get<T extends ExtensionStorageValues = ExtensionStorageValues>(keys?: string | string[]): Promise<T> {
    return this.worker.evaluate(async (requestedKeys) => {
      const extensionChrome = (globalThis as unknown as { chrome: ExtensionChrome }).chrome;
      return extensionChrome.storage.local.get(requestedKeys ?? null) as Promise<T>;
    }, keys);
  }

  async set(values: ExtensionStorageValues): Promise<void> {
    await this.worker.evaluate(async (nextValues) => {
      const extensionChrome = (globalThis as unknown as { chrome: ExtensionChrome }).chrome;
      await extensionChrome.storage.local.set(nextValues);
    }, values);
  }
}

type ExtensionFixtures = {
  extensionContext: BrowserContext;
  extensionId: string;
  extensionPage: Page;
  extensionStorage: ExtensionStorage;
  serviceWorker: Worker;
};

export const test = base.extend<ExtensionFixtures>({
  extensionContext: async ({}, use) => {
    const userDataDir = await mkdtemp(path.join(tmpdir(), "channelfence-playwright-"));
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: "chromium",
      headless: true,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`
      ]
    });

    try {
      await use(context);
    } finally {
      await context.close().catch(() => undefined);
      await rm(userDataDir, { force: true, recursive: true }).catch(() => undefined);
    }
  },

  serviceWorker: async ({ extensionContext }, use) => {
    let [worker] = extensionContext.serviceWorkers();
    worker ??= await extensionContext.waitForEvent("serviceworker");
    await use(worker);
  },

  extensionId: async ({ serviceWorker }, use) => {
    const extensionId = new URL(serviceWorker.url()).host;
    expect(extensionId).toMatch(/^[a-p]{32}$/);
    await use(extensionId);
  },

  extensionStorage: async ({ serviceWorker }, use) => {
    const storage = new ExtensionStorage(serviceWorker);
    await storage.clear();
    await storage.set({
      cfEnabled: true,
      cfBlockedChannels: [],
      cfHideComments: true
    });
    await use(storage);
  },

  extensionPage: async ({ extensionContext, serviceWorker }, use) => {
    await serviceWorker.evaluate(() => true);
    for (const existingPage of extensionContext.pages()) {
      await existingPage.close().catch(() => undefined);
    }
    const page = await extensionContext.newPage();
    await use(page);
  }
});

export { expect } from "@playwright/test";

export function blockedCreator(handle: string, displayName: string) {
  const normalizedHandle = handle.startsWith("@") ? handle.toLowerCase() : `@${handle.toLowerCase()}`;
  return {
    key: `handle:${normalizedHandle}`,
    aliases: [`handle:${normalizedHandle}`],
    displayName,
    url: `https://www.youtube.com/${normalizedHandle}`,
    blockedAt: "2026-08-20T12:00:00.000Z"
  };
}
