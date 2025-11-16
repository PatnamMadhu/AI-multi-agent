import crypto from "crypto";
import type {
  TaskRequest,
  WorkflowResponse,
  Screenshot,
  TaskAnalysis,
  NavigationStep,
} from "@shared/schema";
import { BrowserAutomation } from "./browser";
import { VisualDiffDetector } from "./visualDiff";
import { analyzeTask } from "./openai";
import Cache from "./cache";

import fs from "fs-extra";
import path from "path";

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
    console.log("[Orchestrator] Incoming request:", {
      question: request.question,
      authPreference: request.authPreference,
      targetUrl: request.targetUrl,
      hasCookies: !!request.cookies?.length,
      hasCredentials: !!request.credentials,
      hasVerificationCode:
        "verificationCode" in request && request.verificationCode !== undefined,
    });

    const hasCredentials = !!request.credentials;
    const hasVerificationCode =
      "verificationCode" in request && request.verificationCode !== undefined;
    const hasSensitiveData = hasCredentials || hasVerificationCode;

    // ------------------------------
    // Create screenshot folder (NEW)
    // ------------------------------
    const screenshotFolder = path.join(
      process.cwd(),
      "screenshots",
      Date.now().toString(),
    );

    await fs.ensureDir(screenshotFolder);

    if (hasSensitiveData) {
      const reason = hasCredentials ? "credentials" : "verification code";
      console.log(
        `[Orchestrator] Skipping cache for request with ${reason} (security)`,
      );
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

    // Pass screenshot folder into browser automation
    const automation = new BrowserAutomation(this.visualDiff, screenshotFolder);
    await automation.initialize();

    let analysis: TaskAnalysis | undefined;
    
    // Get analysis first to extract first navigation URL for cookie domain inference
    try {
      analysis = await analyzeTask(
        request.question,
        request.authPreference,
        request.credentials,
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[Orchestrator] Error during task analysis:", err);
      await automation.close();
      return {
        taskId: crypto.randomUUID(),
        question: request.question,
        status: "partial",
        errorMessage: `Failed to analyze task: ${errorMsg}`,
        analysis: undefined,
        screenshots: [],
        timestamp: new Date().toISOString(),
        screenshotFolder,
        cacheHit: false,
      };
    }

    // Apply cookies with domain-aware bootstrap if provided
    if (request.cookies?.length && analysis) {
      try {
        console.log(
          `[Orchestrator] Applying ${request.cookies.length} cookies…`,
        );
        
        // Extract first navigation URL from analysis for domain inference (null-safe)
        const firstNavigationUrl = analysis.navigationPlan?.find((s: NavigationStep) => s.action === 'navigate')?.value;
        
        await automation.setCookies(request.cookies, firstNavigationUrl);
      } catch (err) {
        console.error("[Orchestrator] Failed to apply cookies:", err);
      }
    }
    let screenshots: Screenshot[] = [];
    let status: WorkflowResponse["status"] = "success";
    let errorMessage: string | undefined;

    try {
      screenshots = await automation.executeNavigationPlan(
        analysis,
        (step, message) => {
          console.log(`[Progress] Step ${step}: ${message}`);
        },
        request.credentials,
        request.verificationCode,
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
      screenshotFolder, // <-- NEW
      cacheHit: false,
      errorMessage,
    };

    if (!hasSensitiveData) {
      const cacheKey = Cache.generateCacheKey(request);
      Cache.workflowCache.set(cacheKey, response);
      console.log(`[Orchestrator] Cached result for: "${request.question}"`);
    }

    return response;
  }
}
