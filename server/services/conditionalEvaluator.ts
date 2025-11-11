import { Page } from "puppeteer";
import { ConditionalBranch, NavigationStep } from "@shared/schema";

/**
 * Evaluate a conditional branch and return the steps to execute
 * This is a shared utility used by both WorkflowOrchestrator and BrowserAutomation
 */
export async function evaluateConditional(
  conditional: ConditionalBranch,
  page: Page
): Promise<NavigationStep[]> {
  try {
    const { type, selector, expectedValue } = conditional;

    // Determine which branch to take based on condition type
    let conditionMet = false;

    switch (type) {
      case "element-exists":
        // Check if element exists on the page
        if (selector) {
          conditionMet = await page.$(selector) !== null;
          console.log(`[Conditional] element-exists: ${selector} => ${conditionMet}`);
        }
        break;

      case "text-contains":
        // Check if element contains expected text (execute in browser context)
        if (selector && expectedValue) {
          const text = await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            return el ? el.textContent || "" : "";
          }, selector);
          
          conditionMet = text.includes(expectedValue);
          console.log(`[Conditional] text-contains: "${text}" includes "${expectedValue}" => ${conditionMet}`);
        }
        break;

      case "url-matches":
        // Check if current URL matches expected pattern
        if (expectedValue) {
          const currentUrl = page.url();
          conditionMet = currentUrl.includes(expectedValue);
          console.log(`[Conditional] url-matches: "${currentUrl}" includes "${expectedValue}" => ${conditionMet}`);
        }
        break;

      case "if-else":
        // Generic if-else based on element existence (fallback to element-exists behavior)
        if (selector) {
          conditionMet = await page.$(selector) !== null;
          console.log(`[Conditional] if-else: ${selector} => ${conditionMet}`);
        }
        break;

      case "switch-case":
        // For switch-case, get the value from selector and match against cases
        if (selector && conditional.cases) {
          // Extract value in browser context using page.evaluate
          const value = await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (!el) return null;
            
            // Try to get value from different attributes (runs in browser context)
            if ((el as any).value !== undefined) return (el as any).value;
            if (el.hasAttribute("data-value")) return el.getAttribute("data-value");
            if (el.hasAttribute("value")) return el.getAttribute("value");
            return el.textContent?.trim() || "";
          }, selector);

          if (value !== null) {
            console.log(`[Conditional] switch-case: extracted value "${value}" from ${selector}`);

            // Find matching case
            const matchedCase = conditional.cases.find(
              (c) => c.matchValue === value
            );

            if (matchedCase) {
              console.log(`[Conditional] switch-case: matched case "${matchedCase.matchValue}" (${matchedCase.steps.length} steps)`);
              return matchedCase.steps;
            }
          }

          // Return default branch if no case matched
          console.log(`[Conditional] switch-case: no match, using default branch (${conditional.defaultBranch?.length || 0} steps)`);
          return conditional.defaultBranch || [];
        }
        break;
    }

    // For binary conditionals, return appropriate branch
    if (type !== "switch-case") {
      if (conditionMet) {
        console.log(`[Conditional] Taking ifBranch (${conditional.ifBranch.length} steps)`);
        return conditional.ifBranch;
      } else {
        console.log(`[Conditional] Taking elseBranch (${conditional.elseBranch?.length || 0} steps)`);
        return conditional.elseBranch || [];
      }
    }

    return [];
  } catch (error) {
    console.error("[Conditional] Error evaluating conditional:", error);
    // On error, return else branch or default branch for safe fallback
    return conditional.type !== "switch-case" 
      ? (conditional.elseBranch || [])
      : (conditional.defaultBranch || []);
  }
}
