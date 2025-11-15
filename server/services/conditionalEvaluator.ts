import type { Page } from "puppeteer";
import type { ConditionalBranch, NavigationStep } from "@shared/schema";

/**
 * Evaluate a conditional branch and return the steps to execute.
 * Generic: works for any app by checking DOM / URL state.
 */
export async function evaluateConditional(
  conditional: ConditionalBranch,
  page: Page,
): Promise<NavigationStep[]> {
  try {
    const { type, selector, expectedValue } = conditional;
    let conditionMet = false;

    switch (type) {
      case "element-exists":
      case "if-else": {
        if (selector) {
          const handle = await page.$(selector);
          conditionMet = handle !== null;
          console.log(`[Conditional] ${type}: ${selector} => ${conditionMet}`);
        }
        break;
      }

      case "text-contains": {
        if (selector && expectedValue) {
          const text = await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            return el ? el.textContent || "" : "";
          }, selector);

          conditionMet = text.includes(expectedValue);
          console.log(
            `[Conditional] text-contains: "${text}" includes "${expectedValue}" => ${conditionMet}`,
          );
        }
        break;
      }

      case "url-matches": {
        if (expectedValue) {
          const currentUrl = page.url();
          conditionMet = currentUrl.includes(expectedValue);
          console.log(
            `[Conditional] url-matches: "${currentUrl}" includes "${expectedValue}" => ${conditionMet}`,
          );
        }
        break;
      }

      case "switch-case": {
        if (selector && conditional.cases) {
          const value = await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (!el) return null;

            const anyEl = el as any;
            if (anyEl.value !== undefined) return String(anyEl.value);
            if (el.hasAttribute("data-value")) {
              return el.getAttribute("data-value");
            }
            if (el.hasAttribute("value")) {
              return el.getAttribute("value");
            }
            return (el.textContent || "").trim();
          }, selector);

          if (value !== null) {
            console.log(
              `[Conditional] switch-case: extracted value "${value}" from ${selector}`,
            );

            const matched = conditional.cases.find(
              (c) => c.matchValue === value,
            );
            if (matched) {
              console.log(
                `[Conditional] switch-case: matched case "${matched.matchValue}" (${matched.steps.length} steps)`,
              );
              return matched.steps;
            }
          }

          console.log(
            `[Conditional] switch-case: no match, using default branch (${conditional.defaultBranch?.length || 0} steps)`,
          );
          return conditional.defaultBranch || [];
        }
        break;
      }
    }

    if (type !== "switch-case") {
      if (conditionMet) {
        console.log(
          `[Conditional] Taking ifBranch (${conditional.ifBranch.length} steps)`,
        );
        return conditional.ifBranch;
      } else {
        console.log(
          `[Conditional] Taking elseBranch (${conditional.elseBranch?.length || 0} steps)`,
        );
        return conditional.elseBranch || [];
      }
    }

    return [];
  } catch (error) {
    console.error("[Conditional] Error evaluating conditional:", error);
    return conditional.type !== "switch-case"
      ? conditional.elseBranch || []
      : conditional.defaultBranch || [];
  }
}
