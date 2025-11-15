import type { Page, WaitForSelectorOptions } from "puppeteer";
import { WaitTimeoutError } from "./errors";

export interface StabilityOptions {
  timeout?: number;
  stabilityDelay?: number;
}

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
}

export class WaitManager {
  private page: Page;
  private navigationInProgress = false;

  constructor(page: Page) {
    this.page = page;
  }

  onNavigationStart() {
    this.navigationInProgress = true;
  }

  onNavigationEnd() {
    this.navigationInProgress = false;
  }

  /**
   * Waits for DOM to be stable for a small window.
   * Very generic, works for any app.
   */
  async waitForStability(options: StabilityOptions = {}): Promise<void> {
    const timeout = options.timeout ?? 2000;
    const stabilityDelay = options.stabilityDelay ?? 300;

    const start = Date.now();
    let lastHtml = "";
    let stableSince = Date.now();

    while (Date.now() - start < timeout) {
      const html = await this.page.content();

      if (html === lastHtml) {
        if (Date.now() - stableSince >= stabilityDelay) {
          return;
        }
      } else {
        lastHtml = html;
        stableSince = Date.now();
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Not fatal – we just log
    console.warn("[WaitManager] Stability timeout reached");
  }

  async waitForSelector(
    selector: string,
    options: WaitForSelectorOptions = {},
  ): Promise<void> {
    try {
      await this.page.waitForSelector(selector, options);
      await this.waitForStability();
    } catch (err) {
      throw new WaitTimeoutError(
        `Waiting for selector \`${selector}\` failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /**
   * Generic retry helper.
   */
  async withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {},
  ): Promise<T> {
    const maxRetries = options.maxRetries ?? 2;
    const baseDelay = options.baseDelay ?? 500;

    let attempt = 0;
    let lastError: unknown = null;

    while (attempt <= maxRetries) {
      try {
        if (attempt > 0) {
          const delay = baseDelay * attempt;
          console.log(
            `Retry attempt ${attempt}/${maxRetries} after ${delay}ms`,
          );
          await new Promise((r) => setTimeout(r, delay));
        }

        const result = await fn();
        return result;
      } catch (err) {
        lastError = err;
        attempt++;

        if (attempt > maxRetries) {
          break;
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(`Operation failed after ${maxRetries + 1} attempts`);
  }
}
