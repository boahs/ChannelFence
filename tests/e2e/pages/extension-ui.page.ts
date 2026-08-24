import { type Page } from "@playwright/test";

export class PopupPage {
  constructor(
    readonly page: Page,
    private readonly extensionId: string
  ) {}

  async open(): Promise<void> {
    await this.page.goto(`chrome-extension://${this.extensionId}/ui/popup.html`);
  }
}

export class OptionsPage {
  constructor(
    readonly page: Page,
    private readonly extensionId: string
  ) {}

  async open(): Promise<void> {
    await this.page.goto(`chrome-extension://${this.extensionId}/ui/options.html`);
  }
}
