import puppeteer, { Browser, Page } from "puppeteer";
import { NavigationStep, Screenshot, TaskAnalysis } from "@shared/schema";
import { WaitManager } from "./waitManager";
import { NavigationError, ElementNotFoundError, isRetryableError } from "./errors";

export class BrowserAutomation {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private waitManager: WaitManager | null = null;

  async initialize(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    this.page = await this.browser.newPage();
    
    // Initialize WaitManager with the page
    this.waitManager = new WaitManager(this.page);
    
    // Set a reasonable viewport
    await this.page.setViewport({
      width: 1280,
      height: 720,
      deviceScaleFactor: 1,
    });

    // Set a modern user agent
    await this.page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
  }

  async executeNavigationPlan(
    analysis: TaskAnalysis,
    progressCallback?: (step: number, message: string) => void
  ): Promise<Screenshot[]> {
    if (!this.page) {
      throw new Error("Browser not initialized");
    }

    const screenshots: Screenshot[] = [];
    const plan = analysis.navigationPlan;

    // Navigate to the starting URL first
    if (analysis.startingUrl && analysis.startingUrl !== "about:blank") {
      try {
        if (this.waitManager) {
          await this.waitManager.onNavigationStart();
        }
        await this.page.goto(analysis.startingUrl, {
          waitUntil: "networkidle2",
          timeout: 30000,
        });
        if (this.waitManager) {
          this.waitManager.onNavigationEnd();
          // Wait for stability after initial navigation
          await this.waitManager.waitForStability({ timeout: 3000 });
        }
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
        await this.executeStep(step);

        // Capture screenshot (waitForStability already called in executeStep)
        const screenshot = await this.captureScreenshot(step);
        screenshots.push(screenshot);
        
      } catch (error) {
        const isRetryable = isRetryableError(error);
        console.error(
          `Error executing step ${step.stepNumber} (${isRetryable ? 'retryable' : 'non-retryable'}):`,
          error
        );
        
        // Try to capture error state screenshot
        try {
          const errorScreenshot = await this.captureScreenshot({
            ...step,
            description: `${step.description} (Error: ${
              error instanceof Error ? error.message : String(error)
            })`,
          });
          screenshots.push(errorScreenshot);
        } catch (screenshotError) {
          console.error("Failed to capture error screenshot:", screenshotError);
        }
        
        // Continue with next steps despite error (partial results)
      }
    }

    return screenshots;
  }

  private async executeStep(step: NavigationStep): Promise<void> {
    if (!this.page || !this.waitManager) {
      throw new Error("Page or WaitManager not initialized");
    }

    switch (step.action.toLowerCase()) {
      case "navigate":
        const url = step.value || step.selector;
        if (!url) {
          console.warn(`Navigation step ${step.stepNumber} missing URL, skipping`);
          break;
        }
        if (url === "about:blank") {
          console.warn(`Navigation step ${step.stepNumber} has about:blank, skipping`);
          break;
        }

        // Navigation failures are non-retryable (state reset)
        try {
          await this.waitManager.onNavigationStart();
          await this.page.goto(url, {
            waitUntil: step.waitFor as any || "networkidle2",
            timeout: 30000,
          });
          this.waitManager.onNavigationEnd();
          
          // Wait for page stability after navigation
          await this.waitManager.waitForStability({ timeout: 3000 });
        } catch (error) {
          throw new NavigationError(
            url,
            error instanceof Error ? error.message : String(error),
            step.stepNumber
          );
        }
        break;

      case "click":
        if (step.selector) {
          // Use retries for selector waiting (idempotent)
          await this.waitManager.waitForSelector(step.selector, { timeout: 10000 });
          
          // Click operation with retry
          await this.waitManager.withRetry(
            async () => {
              try {
                await this.page!.click(step.selector!);
              } catch (error) {
                throw new ElementNotFoundError(step.selector!, step.stepNumber);
              }
            },
            { maxRetries: 2, baseDelay: 500 }
          );
          
          // Wait for UI to settle after click
          await this.waitManager.waitForStability({ timeout: 2000, stabilityDelay: 300 });
        }
        break;

      case "type":
        if (step.selector && step.value) {
          // Wait for input element with retry
          await this.waitManager.waitForSelector(step.selector, { timeout: 10000 });
          
          // Type operation with retry
          await this.waitManager.withRetry(
            async () => {
              try {
                // Clear existing value first
                await this.page!.click(step.selector!, { clickCount: 3 });
                await this.page!.type(step.selector!, step.value!, { delay: 50 });
              } catch (error) {
                throw new ElementNotFoundError(step.selector!, step.stepNumber);
              }
            },
            { maxRetries: 2, baseDelay: 500 }
          );
          
          // Wait for any dynamic updates (autocomplete, validation, etc.)
          await this.waitManager.waitForStability({ timeout: 2000, stabilityDelay: 300 });
        }
        break;

      case "wait":
        if (step.selector) {
          await this.waitManager.waitForSelector(step.selector, { timeout: 15000 });
        } else {
          const waitTime = parseInt(step.value || "2000");
          await this.page.waitForTimeout(waitTime);
        }
        break;

      case "screenshot":
        // Screenshot will be taken after this step automatically
        // Wait for UI to fully settle
        await this.waitManager.waitForStability({ timeout: 2000 });
        break;

      default:
        console.warn(`Unknown action: ${step.action}`);
    }
  }

  private async captureScreenshot(step: NavigationStep): Promise<Screenshot> {
    if (!this.page) {
      throw new Error("Page not initialized");
    }

    const screenshotBuffer = await this.page.screenshot({
      type: "png",
      fullPage: false,
    });

    const base64Image = screenshotBuffer.toString("base64");
    const url = this.page.url();

    return {
      stepNumber: step.stepNumber,
      description: step.description,
      imageBase64: base64Image,
      timestamp: new Date().toISOString(),
      url,
    };
  }

  async setCookies(cookies: any[]): Promise<void> {
    if (!this.page) {
      throw new Error("Page not initialized");
    }

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
