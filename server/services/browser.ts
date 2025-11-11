import puppeteer, { Browser, Page } from "puppeteer";
import {
  NavigationStep,
  Screenshot,
  TaskAnalysis,
  BoundingBox,
} from "@shared/schema";
import { WaitManager } from "./waitManager";
import {
  NavigationError,
  ElementNotFoundError,
  isRetryableError,
} from "./errors";
import { VisualDiffDetector } from "./visualDiff";
import { evaluateConditional } from "./conditionalEvaluator";

/**
 * Type guard for Puppeteer lifecycle events
 */
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

  constructor(visualDiffDetector?: VisualDiffDetector) {
    this.visualDiffDetector = visualDiffDetector || null;
  }

  async initialize(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: true,
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

  async executeNavigationPlan(
    analysis: TaskAnalysis,
    progressCallback?: (step: number, message: string) => void,
  ): Promise<Screenshot[]> {
    if (!this.page || !this.waitManager) {
      throw new Error("Browser not initialized");
    }

    const screenshots: Screenshot[] = [];
    const plan = analysis.navigationPlan;

    // Navigate to starting URL
    if (analysis.startingUrl && analysis.startingUrl !== "about:blank") {
      try {
        await this.waitManager.onNavigationStart();
        await this.page.goto(analysis.startingUrl, {
          waitUntil: "networkidle2",
          timeout: 30000,
        });
        await this.waitManager.onNavigationEnd();
        await this.waitManager.waitForStability({ timeout: 3000 });
      } catch (error) {
        console.error("Error navigating to starting URL:", error);
      }
    }

    // Execute navigation plan
    for (let i = 0; i < plan.length; i++) {
      const step = plan[i];

      if (progressCallback) {
        progressCallback(i + 1, `Executing: ${step.description}`);
      }

      try {
        const stepScreenshots = await this.executeStepWithScreenshots(step);
        screenshots.push(...stepScreenshots);
      } catch (error) {
        const retryable = isRetryableError(error);
        console.error(
          `Error executing step ${step.stepNumber} (${retryable ? "retryable" : "non-retryable"}):`,
          error,
        );

        try {
          const errorScreenshot = await this.captureScreenshot({
            ...step,
            description: `${step.description} (Error: ${
              error instanceof Error ? error.message : String(error)
            })`,
          });
          if (errorScreenshot) screenshots.push(errorScreenshot);
        } catch (screenshotError) {
          console.error("Failed to capture error screenshot:", screenshotError);
        }
      }
    }

    return screenshots;
  }

  private async executeStepWithScreenshots(
    step: NavigationStep,
  ): Promise<Screenshot[]> {
    const screenshots: Screenshot[] = [];

    if (!step.action) {
      console.warn(`[Step ${step.stepNumber}] Missing action, skipping`);
      return screenshots;
    }

    if (step.action.toLowerCase() === "conditional") {
      if (!this.page)
        throw new Error("Page not initialized - cannot evaluate conditional");

      if (step.conditional) {
        console.log(
          `[Step ${step.stepNumber}] Evaluating conditional: ${step.description}`,
        );
        const branchSteps = await evaluateConditional(
          step.conditional,
          this.page,
        );

        for (const branchStep of branchSteps) {
          const branchScreens =
            await this.executeStepWithScreenshots(branchStep);
          screenshots.push(...branchScreens);
        }
      } else {
        console.warn(
          `[Step ${step.stepNumber}] Conditional step missing conditional field`,
        );
      }
    } else {
      await this.executeStep(step);
      const shot = await this.captureScreenshot(step);
      if (shot) screenshots.push(shot);
    }

    return screenshots;
  }

  private async executeStep(step: NavigationStep): Promise<void> {
    if (!this.page || !this.waitManager) {
      throw new Error("Page or WaitManager not initialized");
    }

    switch (step.action.toLowerCase()) {
      case "navigate":
        await this.handleNavigate(step);
        break;

      case "click":
        if (step.selector) {
          await this.waitManager.waitForSelector(step.selector, {
            timeout: 10000,
          });
          this.lastBoundingBox = await this.captureBoundingBox(
            step.selector,
            "click",
          );

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

          await this.waitManager.waitForStability({
            timeout: 2000,
            stabilityDelay: 300,
          });
        }
        break;

      case "type":
        if (step.selector && step.value) {
          await this.waitManager.waitForSelector(step.selector, {
            timeout: 10000,
          });
          this.lastBoundingBox = await this.captureBoundingBox(
            step.selector,
            "type",
          );

          await this.waitManager.withRetry(
            async () => {
              try {
                await this.page!.click(step.selector!, { clickCount: 3 });
                await this.page!.type(step.selector!, step.value!, {
                  delay: 50,
                });
              } catch {
                throw new ElementNotFoundError(step.selector!, step.stepNumber);
              }
            },
            { maxRetries: 2, baseDelay: 500 },
          );

          await this.waitManager.waitForStability({
            timeout: 2000,
            stabilityDelay: 300,
          });
        }
        break;

      case "wait":
        if (step.selector) {
          await this.waitManager.waitForSelector(step.selector, {
            timeout: 15000,
          });
        } else {
          const waitTime = parseInt(step.value || "2000");
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
        break;

      case "screenshot":
        await this.waitManager.waitForStability({ timeout: 2000 });
        break;

      default:
        console.warn(`Unknown action: ${step.action}`);
    }
  }

  /**
   * Safe navigation logic with selector fallback.
   */
  private async handleNavigate(step: NavigationStep): Promise<void> {
    const url = step.value || step.selector;
    if (!url || url === "about:blank") {
      console.warn(`Navigation step ${step.stepNumber} missing or invalid URL`);
      return;
    }

    const waitFor = step.waitFor;
    const isLifecycleEvent = isWaitUntilEvent(waitFor);

    try {
      await this.waitManager!.onNavigationStart();

      const response = await this.page!.goto(url, {
        waitUntil: isLifecycleEvent ? waitFor : "networkidle2",
        timeout: 30000,
      });

      this.waitManager!.onNavigationEnd();

      if (!response || !response.ok()) {
        console.warn(
          `[BrowserAutomation] Navigation to ${url} returned status: ${response ? response.status() : "no response"}`,
        );
      }

      // If waitFor is a selector, wait for it explicitly
      if (waitFor && !isLifecycleEvent) {
        console.log(`[BrowserAutomation] Waiting for selector: ${waitFor}`);
        await this.page!.waitForSelector(waitFor, { timeout: 10000 });
      }

      await this.waitManager!.waitForStability({ timeout: 3000 });
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
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      }, selector);

      return box ? { ...box, label } : null;
    } catch (error) {
      console.warn(`Failed to capture bounding box for ${selector}:`, error);
      return null;
    }
  }

  private async captureScreenshot(
    step: NavigationStep,
  ): Promise<Screenshot | null> {
    if (!this.page) throw new Error("Page not initialized");

    let buffer: Buffer;
    try {
      buffer = (await this.page.screenshot({
        type: "png",
        fullPage: false,
      })) as Buffer;
    } catch (err) {
      console.error("Failed to capture screenshot:", err);
      return null;
    }

    if (this.visualDiffDetector) {
      const duplicateOf = await this.visualDiffDetector.isDuplicate(
        step.stepNumber,
        buffer,
      );
      if (duplicateOf !== null) {
        console.log(
          `Skipping screenshot ${step.stepNumber} - duplicate of ${duplicateOf}`,
        );
        this.lastBoundingBox = null;
        return null;
      }
    }

    const base64Image = buffer.toString("base64");
    const url = this.page.url();

    const annotations = this.lastBoundingBox
      ? [this.lastBoundingBox]
      : undefined;
    this.lastBoundingBox = null;

    return {
      stepNumber: step.stepNumber,
      description: step.description,
      imageBase64: base64Image,
      timestamp: new Date().toISOString(),
      url,
      annotations,
    };
  }

  async setCookies(cookies: any[]): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");
    await this.page.setCookie(...cookies);
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}
