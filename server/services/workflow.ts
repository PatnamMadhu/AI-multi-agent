import crypto from "crypto";
import type {
  TaskRequest,
  WorkflowResponse,
  Screenshot,
  TaskAnalysis,
} from "@shared/schema";
import { BrowserAutomation } from "./browser";
import { VisualDiffDetector } from "./visualDiff";
import { analyzeTask } from "./openai";
import Cache from "./cache";

export class WorkflowOrchestrator {
  private visualDiff: VisualDiffDetector;

  constructor() {
    this.visualDiff = new VisualDiffDetector({
      hashBits: 16,
      similarityThreshold: 0.92,
      enabled: true,
    });
  }

  async captureWorkflow(request: TaskRequest): Promise<WorkflowResponse> {
    // Log question but NEVER log credentials or verification codes for security
    console.log("[Orchestrator] Incoming request:", {
      question: request.question,
      authPreference: request.authPreference,
      targetUrl: request.targetUrl,
      hasCookies: !!request.cookies?.length,
      hasCredentials: !!request.credentials,
      hasVerificationCode: "verificationCode" in request && request.verificationCode !== undefined,
    });

    // SECURITY: Skip cache entirely if credentials or verification code exists
    // This ensures sensitive data is never processed, hashed, cached, or logged
    // We check for presence of properties regardless of values (even empty strings)
    // to prevent any bypass attacks
    const hasCredentials = !!request.credentials;
    const hasVerificationCode = "verificationCode" in request && request.verificationCode !== undefined;
    const hasSensitiveData = hasCredentials || hasVerificationCode;

    if (hasSensitiveData) {
      const reason = hasCredentials ? "credentials" : "verification code";
      console.log(`[Orchestrator] Skipping cache for request with ${reason} (security)`);
    } else {
      const cacheKey = Cache.generateCacheKey(request);
      const cached = Cache.workflowCache.get(cacheKey);

      if (cached) {
        console.log(`[Orchestrator] Cache HIT for: "${request.question}"`);
        return {
          ...cached,
          cacheHit: true,
        };
      }

      console.log(`[Orchestrator] Cache MISS for: "${request.question}"`);
    }

    const automation = new BrowserAutomation(this.visualDiff);
    await automation.initialize();

    if (request.cookies?.length) {
      try {
        console.log(
          `[Orchestrator] Applying ${request.cookies.length} cookies…`,
        );
        await automation.setCookies(request.cookies);
      } catch (err) {
        console.error("[Orchestrator] Failed to apply cookies:", err);
      }
    }

    let analysis: TaskAnalysis | undefined;
    let screenshots: Screenshot[] = [];
    let status: WorkflowResponse["status"] = "success";
    let errorMessage: string | undefined;

    try {
      analysis = await analyzeTask(request.question, request.authPreference, request.credentials);

      screenshots = await automation.executeNavigationPlan(
        analysis,
        (step, message) => {
          console.log(`[Progress] Step ${step}: ${message}`);
        },
        request.credentials, // Pass credentials to browser automation for auto-fill
        request.verificationCode, // Pass verification code for 2FA/MFA auto-fill
      );
    } catch (err) {
      status = "partial";
      errorMessage = err instanceof Error ? err.message : String(err);
      console.error("[Orchestrator] Error during execution:", err);
    } finally {
      await automation.close();
    }

    const response: WorkflowResponse = {
      taskId: crypto.randomUUID(),
      question: request.question,
      screenshots,
      analysis,
      status,
      timestamp: new Date().toISOString(),
      cacheHit: false,
      errorMessage,
    };

    // Cache the response only if no sensitive data was provided
    if (!hasSensitiveData) {
      const cacheKey = Cache.generateCacheKey(request);
      Cache.workflowCache.set(cacheKey, response);
      console.log(`[Orchestrator] Cached result for: "${request.question}"`);
    }

    return response;
  }
}
