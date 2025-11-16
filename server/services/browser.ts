import puppeteer, { Browser, Page } from "puppeteer";
import type {
  NavigationStep,
  Screenshot,
  TaskAnalysis,
  BoundingBox,
  CookieData,
  Credentials,
} from "@shared/schema";
import { KNOWN_OAUTH_PROVIDERS } from "@shared/schema";
import { WaitManager } from "./waitManager";
import {
  NavigationError,
  ElementNotFoundError,
  isRetryableError,
} from "./errors";
import { VisualDiffDetector } from "./visualDiff";
import { evaluateConditional } from "./conditionalEvaluator";

import fs from "fs-extra";
import path from "path";

const validWaitUntilEvents = [
  "load",
  "domcontentloaded",
  "networkidle0",
  "networkidle2",
] as const;

type WaitUntilEvent = (typeof validWaitUntilEvents)[number];

function isWaitUntilEvent(value: unknown): value is WaitUntilEvent {
  return (
    typeof value === "string" &&
    validWaitUntilEvents.includes(value as WaitUntilEvent)
  );
}

export class BrowserAutomation {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private waitManager: WaitManager | null = null;
  private visualDiffDetector: VisualDiffDetector | null = null;
  private lastBoundingBox: BoundingBox | null = null;
  private baseUrl: string | null = null;
  private credentials: Credentials | null = null;
  private verificationCode: string | null = null;

  private screenshotDir: string | null = null;  // NEW

  constructor(
    visualDiffDetector?: VisualDiffDetector,
    screenshotDir?: string // NEW
  ) {
    this.visualDiffDetector = visualDiffDetector || null;
    this.screenshotDir = screenshotDir || null; // NEW
  }

  async initialize(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: true,
      executablePath:
        "/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

    this.page = await this.browser.newPage();
    this.waitManager = new WaitManager(this.page);

    await this.page.setViewport({
      width: 1280,
      height: 720,
      deviceScaleFactor: 1,
    });

    await this.page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );
  }

  async setCookies(cookies: any[]): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");
    if (!cookies || cookies.length === 0) return;

    console.log(
      `[BrowserAutomation] Applying ${cookies.length} session cookies before navigation`,
    );
    await this.page.setCookie(...cookies);
  }

  private isOAuthButton(selector: string, description: string): boolean {
    const combined = `${selector} ${description}`.toLowerCase();
    return KNOWN_OAUTH_PROVIDERS.some((provider) =>
      provider.buttonPatterns.some((pattern) =>
        combined.includes(pattern.toLowerCase())
      )
    );
  }

  private resolveUrl(rawUrl: string): string {
    if (!rawUrl) return "";
    if (/^https?:\/\//i.test(rawUrl)) return rawUrl;

    if (rawUrl.startsWith("/")) {
      const base = this.baseUrl || (this.page ? this.page.url() : "");
      try {
        if (base && base.startsWith("http")) {
          const u = new URL(base);
          u.pathname = rawUrl;
          u.search = "";
          u.hash = "";
          return u.toString();
        }
      } catch {}
    }

    if (this.page) {
      try {
        return new URL(rawUrl, this.page.url()).toString();
      } catch {}
    }

    return rawUrl;
  }

  async executeNavigationPlan(
    analysis: TaskAnalysis,
    progressCallback?: (step: number, message: string) => void,
    credentials?: Credentials,
    verificationCode?: string,
  ): Promise<Screenshot[]> {
    if (!this.page || !this.waitManager) {
      throw new Error("Browser not initialized");
    }

    this.baseUrl = analysis.startingUrl || null;
    this.credentials = credentials || null;
    this.verificationCode = verificationCode || null;

    const screenshots: Screenshot[] = [];
    const plan = analysis.navigationPlan || [];

    if (analysis.startingUrl && analysis.startingUrl !== "about:blank") {
      const url = this.resolveUrl(analysis.startingUrl);
      try {
        this.waitManager.onNavigationStart();
        await this.page.goto(url, {
          waitUntil: "networkidle2",
          timeout: 30000,
        });
        this.waitManager.onNavigationEnd();
        await this.waitManager.waitForStability({ timeout: 3000 });
      } catch (error) {
        console.error("Error navigating to starting URL:", error);
      }
    }

    for (let i = 0; i < plan.length; i++) {
      const step = plan[i];

      if (progressCallback) {
        progressCallback(i + 1, `Executing: ${step.description}`);
      }

      try {
        const stepScreens = await this.executeStepWithScreenshots(step);
        screenshots.push(...stepScreens);
      } catch (error) {
        const retryable = isRetryableError(error);
        console.error(
          `Error executing step ${step.stepNumber} (${retryable ? "retryable" : "non-retryable"}):`,
          error,
        );

        try {
          const errorShot = await this.captureScreenshot({
            ...step,
            description: `${step.description} (Error: ${
              error instanceof Error ? error.message : String(error)
            })`,
          });
          if (errorShot) screenshots.push(errorShot);
        } catch {}

      }
    }

    return screenshots;
  }

  private async executeStepWithScreenshots(
    step: NavigationStep,
  ): Promise<Screenshot[]> {
    const screenshots: Screenshot[] = [];

    if (!this.page || !this.waitManager) {
      throw new Error("Browser not initialized");
    }

    if (!step.action) return screenshots;

    if (step.action.toLowerCase() === "conditional" && step.conditional) {
      const branchSteps = await evaluateConditional(step.conditional, this.page);
      for (const bStep of branchSteps) {
        const branchScreens = await this.executeStepWithScreenshots(bStep);
        screenshots.push(...branchScreens);
      }
      return screenshots;
    }

    await this.executeStep(step);

    const shot = await this.captureScreenshot(step);
    if (shot) screenshots.push(shot);

    return screenshots;
  }

  private async executeStep(step: NavigationStep): Promise<void> {
    if (!this.page || !this.waitManager) {
      throw new Error("Browser or WaitManager not initialized");
    }

    const action = step.action.toLowerCase();

    switch (action) {
      case "navigate":
        await this.handleNavigate(step);
        break;

      case "click":
        if (!step.selector) return;

        await this.waitManager.waitForSelector(step.selector, { timeout: 10000 });
        this.lastBoundingBox = await this.captureBoundingBox(step.selector, "click");

        const isOAuth = this.isOAuthButton(step.selector, step.description || "");
        let popupPromise: Promise<Page | null> | null = null;

        if (isOAuth) {
          popupPromise = new Promise<Page | null>((resolve) => {
            const timeout = setTimeout(() => resolve(null), 5000);
            this.page!.once("popup", async (popup) => {
              clearTimeout(timeout);
              resolve(popup || null);
            });
          });
        }

        await this.waitManager.withRetry(
          async () => {
            try {
              await this.page!.click(step.selector!);
            } catch {
              throw new ElementNotFoundError(step.selector!, step.stepNumber);
            }
          },
          { maxRetries: 2, baseDelay: 500 },
        );

        if (isOAuth && popupPromise) {
          const popup = await popupPromise;

          if (popup) {
            await new Promise<void>((resolve) => {
              const timeout = setTimeout(resolve, 60000);
              const interval = setInterval(() => {
                if (popup.isClosed()) {
                  clearTimeout(timeout);
                  clearInterval(interval);
                  resolve();
                }
              }, 300);
            });
          }

          await this.waitManager.waitForStability({
            timeout: 3000,
            stabilityDelay: 500,
          });
        } else {
          await this.waitManager.waitForStability({
            timeout: 2000,
            stabilityDelay: 300,
          });
        }
        break;

      case "type":
        if (!step.selector || !step.value) return;

        await this.waitManager.waitForSelector(step.selector, { timeout: 10000 });
        this.lastBoundingBox = await this.captureBoundingBox(step.selector, "type");

        let valueToType = step.value;
        const sel = step.selector.toLowerCase();
        const desc = (step.description || "").toLowerCase();

        if (this.credentials) {
          if (
            (sel.includes("email") || sel.includes("username") || desc.includes("email")) &&
            this.credentials.username
          ) {
            valueToType = this.credentials.username;
          } else if (
            (sel.includes("password") || desc.includes("password")) &&
            this.credentials.password
          ) {
            valueToType = this.credentials.password;
          } else if (
            (sel.includes("name") || desc.includes("name")) &&
            this.credentials.displayName
          ) {
            valueToType = this.credentials.displayName;
          }
        }

        if (this.verificationCode) {
          if (
            sel.includes("code") ||
            sel.includes("otp") ||
            sel.includes("mfa") ||
            sel.includes("verification") ||
            desc.includes("code")
          ) {
            valueToType = this.verificationCode;
          }
        }

        await this.waitManager.withRetry(
          async () => {
            await this.page!.click(step.selector!, { clickCount: 3 });
            await this.page!.type(step.selector!, valueToType, { delay: 50 });
          },
          { maxRetries: 2, baseDelay: 500 },
        );

        await this.waitManager.waitForStability({ timeout: 2000 });
        break;

      case "wait":
        if (step.selector) {
          await this.waitManager.waitForSelector(step.selector, { timeout: 15000 });
        } else {
          await new Promise((res) => setTimeout(res, parseInt(step.value || "2000", 10)));
        }
        break;

      case "screenshot":
        await this.waitManager.waitForStability({ timeout: 2000 });
        break;

      default:
        console.warn(`Unknown action: ${step.action}`);
    }
  }

  private async handleNavigate(step: NavigationStep): Promise<void> {
    if (!this.page || !this.waitManager) throw new Error("Browser not initialized");

    const rawUrl = step.value || step.selector || "";
    const url = this.resolveUrl(rawUrl);

    if (!url) return;

    const waitFor = step.waitFor;
    const isLifecycle = isWaitUntilEvent(waitFor);

    try {
      this.waitManager.onNavigationStart();

      const resp = await this.page.goto(url, {
        waitUntil: isLifecycle ? waitFor : "networkidle2",
        timeout: 30000,
      });

      this.waitManager.onNavigationEnd();

      if (waitFor && !isLifecycle) {
        await this.page.waitForSelector(waitFor, { timeout: 10000 });
      }

      await this.waitManager.waitForStability({ timeout: 3000 });
    } catch (error) {
      throw new NavigationError(
        url,
        error instanceof Error ? error.message : String(error),
        step.stepNumber,
      );
    }
  }

  private async captureBoundingBox(
    selector: string,
    label: string,
  ): Promise<BoundingBox | null> {
    if (!this.page) return null;

    try {
      const box = await this.page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        };
      }, selector);

      return box ? { ...box, label } : null;
    } catch {
      return null;
    }
  }

  private async captureScreenshot(step: NavigationStep): Promise<Screenshot | null> {
    if (!this.page) throw new Error("Page not initialized");

    let buffer: Buffer;
    try {
      buffer = (await this.page.screenshot({
        type: "png",
        fullPage: false,
      })) as Buffer;
    } catch {
      return null;
    }

    if (this.visualDiffDetector) {
      const dup = await this.visualDiffDetector.isDuplicate(step.stepNumber, buffer);
      if (dup !== null) return null;
    }

    const base64 = buffer.toString("base64");

    let filePath: string | undefined = undefined;

    // ---------------------------------
    // 🚀 SAVE SCREENSHOT TO DISK (NEW)
    // ---------------------------------
    if (this.screenshotDir) {
      const filename = `step-${step.stepNumber}.png`;
      filePath = path.join(this.screenshotDir, filename);
      await fs.writeFile(filePath, buffer);
    }

    const url = this.page.url();
    const annotations = this.lastBoundingBox ? [this.lastBoundingBox] : undefined;
    this.lastBoundingBox = null;

    return {
      stepNumber: step.stepNumber,
      description: step.description,
      imageBase64: base64,
      timestamp: new Date().toISOString(),
      url,
      annotations,
      filePath, // NEW
    };
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.waitManager = null;
    }
  }
}
