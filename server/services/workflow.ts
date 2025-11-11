import { randomUUID } from "crypto";
import { TaskRequest, WorkflowResponse, TaskAnalysis, Screenshot } from "@shared/schema";
import { analyzeTask } from "./openai";
import { BrowserAutomation } from "./browser";
import { VisualDiffDetector } from "./visualDiff";
import { workflowCache, generateCacheKey } from "./cache";

export class WorkflowOrchestrator {
  async captureWorkflow(
    request: TaskRequest,
    progressCallback?: (step: number, total: number, message: string) => void
  ): Promise<WorkflowResponse> {
    const taskId = randomUUID();
    const startTime = Date.now();

    // Check cache first
    const cacheKey = generateCacheKey(request.question, request.targetUrl);
    const cachedResult = workflowCache.get(cacheKey);
    
    if (cachedResult) {
      console.log(`[Orchestrator] Cache HIT for: "${request.question}"`);
      
      // Deep clone cached result to prevent mutation of cached object
      // This ensures consumers cannot corrupt the cache by mutating arrays/objects
      const clonedResult = JSON.parse(JSON.stringify(cachedResult)) as WorkflowResponse;
      
      // Update metadata on the cloned result (don't spread - that creates shallow copy!)
      clonedResult.taskId = taskId;
      clonedResult.cacheHit = true;
      clonedResult.processingDuration = Date.now() - startTime;
      clonedResult.completedAt = new Date().toISOString();
      
      return clonedResult;
    }

    console.log(`[Orchestrator] Cache MISS for: "${request.question}"`);

    let analysis: TaskAnalysis | null = null;
    let screenshots: Screenshot[] = [];
    let browser: BrowserAutomation | null = null;
    let visualDiffDetector: VisualDiffDetector | null = null;

    try {
      // Step 1: Analyze the task with AI
      if (progressCallback) {
        progressCallback(1, 5, "Analyzing task with AI...");
      }

      analysis = await analyzeTask(request.question);
      
      // Use targetUrl from request as fallback if AI didn't provide a valid URL
      if (request.targetUrl && (!analysis.startingUrl || analysis.startingUrl === "about:blank")) {
        analysis.startingUrl = request.targetUrl;
      }

      // Step 2: Initialize visual diff detector and browser
      if (progressCallback) {
        progressCallback(2, 5, "Initializing browser automation...");
      }

      // Create visual diff detector with configuration from request
      visualDiffDetector = new VisualDiffDetector({
        enabled: !request.visualDiff?.disabled,
        similarityThreshold: request.visualDiff?.similarityThreshold,
      });

      browser = new BrowserAutomation(visualDiffDetector);
      await browser.initialize();

      // Set cookies if provided
      if (request.cookies && request.cookies.length > 0) {
        await browser.setCookies(request.cookies);
      }

      // Step 3: Execute navigation plan
      if (progressCallback) {
        progressCallback(3, 5, "Executing navigation plan...");
      }

      screenshots = await browser.executeNavigationPlan(
        analysis,
        (step, message) => {
          if (progressCallback) {
            progressCallback(3, 5, message);
          }
        }
      );

      // Step 4: Process results
      if (progressCallback) {
        progressCallback(4, 5, "Processing screenshots...");
      }

      const processingDuration = Date.now() - startTime;

      // Step 5: Complete
      if (progressCallback) {
        progressCallback(5, 5, "Workflow capture complete!");
      }

      // Collect visual diff metadata
      const duplicates = visualDiffDetector?.getDuplicates() || [];
      const visualDiffMetadata = visualDiffDetector
        ? {
            duplicates,
            totalScreenshots: analysis.navigationPlan.length,
            uniqueScreenshots: screenshots.length,
            duplicatesSkipped: duplicates.length,
          }
        : undefined;

      const response: WorkflowResponse = {
        taskId,
        question: request.question,
        analysis,
        screenshots,
        processingDuration,
        completedAt: new Date().toISOString(),
        status: screenshots.length > 0 ? "success" : "partial",
        visualDiff: visualDiffMetadata,
        cacheHit: false,
      };

      // Store successful results in cache (only cache success/partial, not failures)
      if (response.status === "success" || response.status === "partial") {
        // Deep clone response before caching to prevent mutation
        // This ensures the cached copy remains immutable
        const clonedResponse = JSON.parse(JSON.stringify(response));
        workflowCache.set(cacheKey, clonedResponse);
        console.log(`[Orchestrator] Cached result for: "${request.question}"`);
      }

      // Clear detector to free memory
      visualDiffDetector?.clear();

      return response;

    } catch (error) {
      console.error("Workflow capture error:", error);

      const processingDuration = Date.now() - startTime;

      return {
        taskId,
        question: request.question,
        analysis: analysis || {
          targetApplication: "Unknown",
          estimatedSteps: 0,
          navigationPlan: [],
          startingUrl: "",
        },
        screenshots: screenshots || [],
        processingDuration,
        completedAt: new Date().toISOString(),
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    } finally {
      // Always clean up browser resources
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.error("Error closing browser:", closeError);
        }
      }
    }
  }
}
