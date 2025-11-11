/**
 * Base class for workflow execution errors
 */
export class WorkflowError extends Error {
  constructor(message: string, public readonly stepNumber?: number) {
    super(message);
    this.name = "WorkflowError";
  }
}

/**
 * Errors that can be retried (transient failures)
 */
export class RetryableError extends WorkflowError {
  constructor(message: string, stepNumber?: number, public readonly attempt?: number) {
    super(message, stepNumber);
    this.name = "RetryableError";
  }
}

/**
 * Errors that should not be retried (permanent failures)
 */
export class NonRetryableError extends WorkflowError {
  constructor(message: string, stepNumber?: number) {
    super(message, stepNumber);
    this.name = "NonRetryableError";
  }
}

/**
 * Specific error for wait/selector timeouts
 */
export class WaitTimeoutError extends RetryableError {
  constructor(selector: string, timeout: number, stepNumber?: number) {
    super(`Timeout waiting for selector "${selector}" after ${timeout}ms`, stepNumber);
    this.name = "WaitTimeoutError";
  }
}

/**
 * Specific error for element not found/visible
 */
export class ElementNotFoundError extends RetryableError {
  constructor(selector: string, stepNumber?: number) {
    super(`Element not found or not visible: "${selector}"`, stepNumber);
    this.name = "ElementNotFoundError";
  }
}

/**
 * Navigation failures (usually non-retryable)
 */
export class NavigationError extends NonRetryableError {
  constructor(url: string, reason: string, stepNumber?: number) {
    super(`Navigation to "${url}" failed: ${reason}`, stepNumber);
    this.name = "NavigationError";
  }
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): error is RetryableError {
  if (error instanceof RetryableError) {
    return true;
  }

  // Check error message for known retryable patterns
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  const retryablePatterns = [
    "timeout",
    "waiting for selector",
    "no node found",
    "cannot find element",
    "element is not visible",
    "element is not attached",
    "detached from document",
  ];

  return retryablePatterns.some((pattern) => message.includes(pattern));
}
