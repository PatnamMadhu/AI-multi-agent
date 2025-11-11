import { Page } from "puppeteer";
import { RetryableError, WaitTimeoutError, ElementNotFoundError, isRetryableError } from "./errors";

export interface WaitOptions {
  timeout?: number;
  networkIdle?: boolean;
  stabilityDelay?: number;
  mutationObserver?: boolean;
}

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  jitter?: boolean;
}

export class WaitManager {
  private page: Page;
  private observers: Set<string> = new Set();

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Lifecycle: Called when page navigates to teardown observers
   */
  async onNavigationStart(): Promise<void> {
    // Clean up any existing mutation observers in the page
    try {
      await this.page.evaluate(() => {
        if ((window as any).__mutationObserver) {
          (window as any).__mutationObserver.disconnect();
          delete (window as any).__mutationObserver;
          delete (window as any).__mutationCounter;
        }
      });
    } catch (error) {
      // Page may be navigating, ignore errors
    }
    this.observers.clear();
  }

  /**
   * Lifecycle: Called after navigation completes to re-attach observers
   */
  onNavigationEnd(): void {
    // Observers will be re-created on next waitForStability call
    this.observers.clear();
  }

  /**
   * Smart wait that combines multiple signals:
   * - Network idle
   * - DOM mutations stopped
   * - Animations complete
   */
  async waitForStability(options: WaitOptions = {}): Promise<void> {
    const {
      timeout = 10000,
      networkIdle = true,
      stabilityDelay = 500,
      mutationObserver = true,
    } = options;

    const startTime = Date.now();

    // Wait for network idle if requested
    if (networkIdle) {
      try {
        await this.page.waitForNetworkIdle({ 
          timeout: Math.min(timeout, 5000),
          idleTime: 500 
        });
      } catch (e) {
        // Network idle timeout is not critical, continue
        console.log("Network idle timeout, continuing...");
      }
    }

    // Wait for DOM mutations to settle if requested
    if (mutationObserver) {
      await this.waitForDOMStability(stabilityDelay, timeout - (Date.now() - startTime));
    }

    // Wait for animations to complete
    await this.waitForAnimations(Math.max(500, timeout - (Date.now() - startTime)));
  }

  /**
   * Wait for DOM to stop mutating
   */
  private async waitForDOMStability(stabilityDelay: number, timeout: number): Promise<void> {
    try {
      // Inject mutation counter into the page
      await this.page.evaluate(() => {
        if (!(window as any).__mutationCounter) {
          (window as any).__mutationCounter = 0;
          (window as any).__mutationObserver = new MutationObserver(() => {
            (window as any).__mutationCounter++;
          });
          (window as any).__mutationObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true,
          });
        }
      });

      const startTime = Date.now();
      let lastMutationCount = await this.page.evaluate(() => (window as any).__mutationCounter || 0);
      let stableStartTime = Date.now();

      // Poll mutation counter until stable
      while (Date.now() - startTime < timeout) {
        await this.sleep(100);

        const currentMutationCount = await this.page.evaluate(
          () => (window as any).__mutationCounter || 0
        );

        if (currentMutationCount === lastMutationCount) {
          // No new mutations - check if we've been stable long enough
          if (Date.now() - stableStartTime >= stabilityDelay) {
            break; // Stable!
          }
        } else {
          // New mutations detected - reset stability timer
          lastMutationCount = currentMutationCount;
          stableStartTime = Date.now();
        }
      }

      // Clean up observer
      await this.page.evaluate(() => {
        if ((window as any).__mutationObserver) {
          (window as any).__mutationObserver.disconnect();
          delete (window as any).__mutationObserver;
          delete (window as any).__mutationCounter;
        }
      });
    } catch (error) {
      // If DOM stability check fails, just continue
      console.log("DOM stability check failed:", error);
    }
  }

  /**
   * Wait for CSS animations and transitions to complete
   */
  private async waitForAnimations(timeout: number): Promise<void> {
    try {
      await this.page.evaluate((maxWait) => {
        return new Promise((resolve) => {
          const startTime = Date.now();
          
          const checkAnimations = () => {
            if (Date.now() - startTime > maxWait) {
              resolve(undefined);
              return;
            }

            // Use modern document.getAnimations() API if available
            if (typeof document.getAnimations === 'function') {
              const animations = document.getAnimations();
              const runningAnimations = animations.filter(
                (anim) => anim.playState === 'running' || anim.playState === 'pending'
              );

              if (runningAnimations.length > 0) {
                setTimeout(checkAnimations, 100);
              } else {
                resolve(undefined);
              }
            } else {
              // Fallback: check computed styles
              const elements = document.querySelectorAll('*');
              let hasAnimations = false;

              for (const el of Array.from(elements)) {
                const styles = window.getComputedStyle(el);
                const animation = styles.getPropertyValue('animation-name');
                const transition = styles.getPropertyValue('transition-duration');

                if (animation && animation !== 'none') {
                  hasAnimations = true;
                  break;
                }

                if (transition && transition !== '0s' && transition !== 'none') {
                  hasAnimations = true;
                  break;
                }
              }

              if (hasAnimations) {
                setTimeout(checkAnimations, 100);
              } else {
                resolve(undefined);
              }
            }
          };

          checkAnimations();
        });
      }, timeout);
    } catch (e) {
      // Ignore evaluation errors
      console.log("Animation check failed, continuing...");
    }
  }

  /**
   * Execute an action with retry logic and exponential backoff
   */
  async withRetry<T>(
    action: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      baseDelay = 500,
      maxDelay = 10000,
      jitter = true,
    } = options;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await action();
      } catch (error) {
        lastError = error as Error;

        // Check if error is retryable using type system
        if (!isRetryableError(error) || attempt === maxRetries) {
          throw error;
        }

        // Calculate exponential backoff delay with optional jitter
        let delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        if (jitter) {
          // Add ±25% jitter to prevent thundering herd
          const jitterAmount = delay * 0.25;
          delay += (Math.random() * 2 - 1) * jitterAmount;
        }

        console.log(
          `Retry attempt ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms: ${
            error instanceof Error ? error.message : String(error)
          }`
        );

        await this.sleep(delay);
      }
    }

    // Wrap final error as RetryableError with attempt count
    throw new RetryableError(
      `Max retries (${maxRetries}) exceeded: ${lastError?.message}`,
      undefined,
      maxRetries
    );
  }

  /**
   * Wait for a selector with intelligent waiting
   */
  async waitForSelector(
    selector: string,
    options: WaitOptions & { visible?: boolean } = {}
  ): Promise<void> {
    const { timeout = 10000, visible = true } = options;

    await this.withRetry(
      async () => {
        await this.page.waitForSelector(selector, {
          timeout,
          visible,
        });
      },
      {
        maxRetries: 2,
        baseDelay: 500,
      }
    );

    // Wait for stability after selector appears
    await this.waitForStability({
      timeout: 2000,
      stabilityDelay: 300,
    });
  }

  /**
   * Simple sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
