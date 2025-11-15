export class WorkflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowError";
  }
}

export class NavigationError extends WorkflowError {
  url: string;
  stepNumber?: number;

  constructor(url: string, message: string, stepNumber?: number) {
    super(`Navigation to "${url}" failed: ${message}`);
    this.name = "NavigationError";
    this.url = url;
    this.stepNumber = stepNumber;
  }
}

export class ElementNotFoundError extends WorkflowError {
  selector: string;
  stepNumber?: number;

  constructor(selector: string, stepNumber?: number) {
    super(`Element not found: ${selector}`);
    this.name = "ElementNotFoundError";
    this.selector = selector;
    this.stepNumber = stepNumber;
  }
}

export class WaitTimeoutError extends WorkflowError {
  constructor(message: string) {
    super(message);
    this.name = "WaitTimeoutError";
  }
}

/**
 * Decide whether an error is safe to retry.
 */
export function isRetryableError(err: unknown): boolean {
  if (!err) return false;

  if (
    err instanceof ElementNotFoundError ||
    err instanceof NavigationError ||
    err instanceof WaitTimeoutError
  ) {
    return true;
  }

  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (
      msg.includes("timeout") ||
      msg.includes("failed to find") ||
      msg.includes("waiting for selector")
    ) {
      return true;
    }
  }

  return false;
}
