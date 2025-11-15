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
  private credentials: Credentials | null = null; // Stored for auto-fill during execution
  private verificationCode: string | null = null; // Stored for 2FA/MFA auto-fill

  constructor(visualDiffDetector?: VisualDiffDetector) {
    this.visualDiffDetector = visualDiffDetector || null;
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

  /**
   * Detect if a selector might be an OAuth button
   */
  private isOAuthButton(selector: string, description: string): boolean {
    const combined = `${selector} ${description}`.toLowerCase();
    return KNOWN_OAUTH_PROVIDERS.some((provider) =>
      provider.buttonPatterns.some(
        (pattern) => combined.includes(pattern.toLowerCase())
      )
    );
  }

  private resolveUrl(rawUrl: string): string {
    if (!rawUrl) return "";

    // Absolute URL
    if (/^https?:\/\//i.test(rawUrl)) {
      return rawUrl;
    }

    // If it starts with "/" – resolve against baseUrl or current page
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
      } catch {
        // fall through
      }
    }

    // Fallback: resolve relative to current page
    if (this.page) {
      const current = this.page.url();
      try {
        return new URL(rawUrl, current).toString();
      } catch {
        return rawUrl;
      }
    }

    return rawUrl;
  }

  async executeNavigationPlan(
    analysis: TaskAnalysis,
    progressCallback?: (step: number, message: string) => void,
    credentials?: Credentials, // Credentials for auto-filling login/signup forms
    verificationCode?: string, // 2FA/MFA verification code for auto-filling
  ): Promise<Screenshot[]> {
    if (!this.page || !this.waitManager) {
      throw new Error("Browser not initialized");
    }

    this.baseUrl = analysis.startingUrl || null;
    this.credentials = credentials || null; // Store for use during form filling
    this.verificationCode = verificationCode || null; // Store for 2FA/MFA auto-filling

    const screenshots: Screenshot[] = [];
    const plan = analysis.navigationPlan || [];

    // Starting URL navigation
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

        // Capture error screenshot for debugging
        try {
          const errorShot = await this.captureScreenshot({
            ...step,
            description: `${step.description} (Error: ${
              error instanceof Error ? error.message : String(error)
            })`,
          });
          if (errorShot) screenshots.push(errorShot);
        } catch (shotErr) {
          console.error("Failed to capture error screenshot:", shotErr);
        }

        // For now, continue to next step even on error.
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

    if (!step.action) {
      console.warn(`[Step ${step.stepNumber}] Missing action, skipping`);
      return screenshots;
    }

    if (step.action.toLowerCase() === "conditional") {
      if (!step.conditional) {
        console.warn(
          `[Step ${step.stepNumber}] Conditional step missing "conditional" field`,
        );
        return screenshots;
      }

      console.log(
        `[Step ${step.stepNumber}] Evaluating conditional: ${step.description}`,
      );

      const branchSteps = await evaluateConditional(
        step.conditional,
        this.page,
      );

      for (const bStep of branchSteps) {
        const branchScreens = await this.executeStepWithScreenshots(bStep);
        screenshots.push(...branchScreens);
      }

      return screenshots;
    }

    // Non-conditional step
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
        if (step.selector) {
          await this.waitManager.waitForSelector(step.selector, {
            timeout: 10000,
          });

          this.lastBoundingBox = await this.captureBoundingBox(
            step.selector,
            "click",
          );

          // Check if this is an OAuth button - set up popup listener BEFORE clicking
          const isOAuth = this.isOAuthButton(
            step.selector,
            step.description || ""
          );

          let popupPromise: Promise<Page | null> | null = null;

          if (isOAuth) {
            console.log(`[OAuth] Detected OAuth button: ${step.description}`);
            console.log(`[OAuth] Setting up popup listener before click...`);

            // Set up popup listener BEFORE clicking
            popupPromise = new Promise<Page | null>((resolve) => {
              const timeout = setTimeout(() => {
                console.log("[OAuth] No popup detected within 5 seconds");
                resolve(null);
              }, 5000);

              this.page!.once("popup", async (popup) => {
                clearTimeout(timeout);
                if (popup) {
                  console.log(`[OAuth] Popup detected: ${popup.url()}`);
                  resolve(popup);
                } else {
                  console.log("[OAuth] Popup event fired but popup is null");
                  resolve(null);
                }
              });
            });
          }

          // Click the element (potentially triggering OAuth popup)
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

          // If OAuth button, wait for popup to complete
          if (isOAuth && popupPromise) {
            const popup = await popupPromise;

            if (popup) {
              // Detect which OAuth provider
              const popupUrl = popup.url();
              const provider = KNOWN_OAUTH_PROVIDERS.find((p) =>
                popupUrl.includes(p.domain)
              );

              if (provider) {
                console.log(`[OAuth] Detected ${provider.name} OAuth flow at ${popupUrl}`);
              }

              // Wait for popup to close
              console.log("[OAuth] Waiting for OAuth popup to close...");
              try {
                await new Promise<void>((resolve) => {
                  const timeout = setTimeout(() => {
                    console.log("[OAuth] Popup timeout - continuing anyway");
                    resolve();
                  }, 60000);

                  const checkClosed = setInterval(() => {
                    if (popup.isClosed()) {
                      clearTimeout(timeout);
                      clearInterval(checkClosed);
                      console.log("[OAuth] OAuth popup closed successfully");
                      resolve();
                    }
                  }, 500);
                });
              } catch (err) {
                console.log("[OAuth] Error waiting for popup:", err);
              }

              // Wait for main page to stabilize after OAuth
              await this.waitManager.waitForStability({
                timeout: 3000,
                stabilityDelay: 500,
              });
            } else {
              console.log("[OAuth] No popup appeared - treating as regular click");
              await this.waitManager.waitForStability({
                timeout: 2000,
                stabilityDelay: 300,
              });
            }
          } else {
            // Regular click - normal stability wait
            await this.waitManager.waitForStability({
              timeout: 2000,
              stabilityDelay: 300,
            });
          }
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

          // Auto-fill credentials and verification codes if available
          let valueToType = step.value;
          const selectorLower = step.selector.toLowerCase();
          const descriptionLower = (step.description || "").toLowerCase();
          
          if (this.credentials) {
            // Check if this is an email/username field
            if ((selectorLower.includes('email') || selectorLower.includes('username') || selectorLower.includes("type='email'") ||
                 descriptionLower.includes('email') || descriptionLower.includes('username')) &&
                this.credentials.username) {
              valueToType = this.credentials.username;
              console.log(`[BrowserAutomation] Auto-filling email/username field`);
            }
            // Check if this is a password field
            else if ((selectorLower.includes('password') || selectorLower.includes("type='password'") ||
                      descriptionLower.includes('password')) &&
                     this.credentials.password) {
              valueToType = this.credentials.password;
              console.log(`[BrowserAutomation] Auto-filling password field`);
            }
            // Check if this is a name/display name field
            else if ((selectorLower.includes('name') || selectorLower.includes('display') ||
                      descriptionLower.includes('name') || descriptionLower.includes('display')) &&
                     this.credentials.displayName) {
              valueToType = this.credentials.displayName;
              console.log(`[BrowserAutomation] Auto-filling name field`);
            }
          }
          
          // Check if this is a verification code field (2FA/MFA)
          if (this.verificationCode && 
              (selectorLower.includes('code') || selectorLower.includes('verification') || 
               selectorLower.includes('2fa') || selectorLower.includes('mfa') || 
               selectorLower.includes('otp') || selectorLower.includes('token') ||
               descriptionLower.includes('code') || descriptionLower.includes('verification') ||
               descriptionLower.includes('2fa') || descriptionLower.includes('mfa') ||
               descriptionLower.includes('otp') || descriptionLower.includes('token'))) {
            valueToType = this.verificationCode;
            console.log(`[BrowserAutomation] Auto-filling verification code field`);
          }

          await this.waitManager.withRetry(
            async () => {
              try {
                await this.page!.click(step.selector!, {
                  clickCount: 3,
                });
                await this.page!.type(step.selector!, valueToType, {
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
          const waitTime = parseInt(step.value || "2000", 10);
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

  private async handleNavigate(step: NavigationStep): Promise<void> {
    if (!this.page || !this.waitManager) {
      throw new Error("Browser or WaitManager not initialized");
    }

    const rawUrl = step.value || step.selector || "";
    const url = this.resolveUrl(rawUrl);

    if (!url || url === "about:blank") {
      console.warn(
        `Navigation step ${step.stepNumber} missing or invalid URL: "${rawUrl}"`,
      );
      return;
    }

    const waitFor = step.waitFor;
    const isLifecycleEvent = isWaitUntilEvent(waitFor);

    try {
      this.waitManager.onNavigationStart();

      const response = await this.page.goto(url, {
        waitUntil: isLifecycleEvent ? waitFor : "networkidle2",
        timeout: 30000,
      });

      this.waitManager.onNavigationEnd();

      if (!response || !response.ok()) {
        console.warn(
          `[BrowserAutomation] Navigation to ${url} returned status: ${
            response ? response.status() : "no response"
          }`,
        );
      }

      if (waitFor && !isLifecycleEvent) {
        console.log(`[BrowserAutomation] Waiting for selector: ${waitFor}`);
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

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.waitManager = null;
    }
  }
}
