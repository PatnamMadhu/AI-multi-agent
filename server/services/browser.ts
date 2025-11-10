import puppeteer, { Browser, Page } from "puppeteer";
import { NavigationStep, Screenshot, TaskAnalysis } from "@shared/schema";

export class BrowserAutomation {
  private browser: Browser | null = null;
  private page: Page | null = null;

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

    for (let i = 0; i < plan.length; i++) {
      const step = plan[i];
      
      if (progressCallback) {
        progressCallback(i + 1, `Executing: ${step.description}`);
      }

      try {
        await this.executeStep(step);
        
        // Wait a bit for UI to settle
        await this.page.waitForTimeout(1000);

        // Capture screenshot
        const screenshot = await this.captureScreenshot(step);
        screenshots.push(screenshot);
        
      } catch (error) {
        console.error(`Error executing step ${step.stepNumber}:`, error);
        
        // Try to capture error state screenshot
        try {
          const errorScreenshot = await this.captureScreenshot({
            ...step,
            description: `${step.description} (Error occurred)`,
          });
          screenshots.push(errorScreenshot);
        } catch (screenshotError) {
          console.error("Failed to capture error screenshot:", screenshotError);
        }
        
        // Continue with next steps despite error
      }
    }

    return screenshots;
  }

  private async executeStep(step: NavigationStep): Promise<void> {
    if (!this.page) {
      throw new Error("Page not initialized");
    }

    switch (step.action.toLowerCase()) {
      case "navigate":
        await this.page.goto(step.value || step.selector || "about:blank", {
          waitUntil: step.waitFor as any || "networkidle2",
          timeout: 30000,
        });
        break;

      case "click":
        if (step.selector) {
          await this.page.waitForSelector(step.selector, { timeout: 10000 });
          await this.page.click(step.selector);
        }
        break;

      case "type":
        if (step.selector && step.value) {
          await this.page.waitForSelector(step.selector, { timeout: 10000 });
          await this.page.type(step.selector, step.value, { delay: 50 });
        }
        break;

      case "wait":
        if (step.selector) {
          await this.page.waitForSelector(step.selector, { timeout: 15000 });
        } else {
          await this.page.waitForTimeout(parseInt(step.value || "2000"));
        }
        break;

      case "screenshot":
        // Screenshot will be taken after this step
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
