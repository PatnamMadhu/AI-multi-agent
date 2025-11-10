import { randomUUID } from "crypto";
import { TaskRequest, WorkflowResponse, TaskAnalysis, Screenshot } from "@shared/schema";
import { analyzeTask } from "./openai";
import { BrowserAutomation } from "./browser";

export class WorkflowOrchestrator {
  async captureWorkflow(
    request: TaskRequest,
    progressCallback?: (step: number, total: number, message: string) => void
  ): Promise<WorkflowResponse> {
    const taskId = randomUUID();
    const startTime = Date.now();

    let analysis: TaskAnalysis | null = null;
    let screenshots: Screenshot[] = [];
    let browser: BrowserAutomation | null = null;

    try {
      // Step 1: Analyze the task with AI
      if (progressCallback) {
        progressCallback(1, 5, "Analyzing task with AI...");
      }

      analysis = await analyzeTask(request.question);

      // Step 2: Initialize browser
      if (progressCallback) {
        progressCallback(2, 5, "Initializing browser automation...");
      }

      browser = new BrowserAutomation();
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

      const response: WorkflowResponse = {
        taskId,
        question: request.question,
        analysis,
        screenshots,
        processingDuration,
        completedAt: new Date().toISOString(),
        status: screenshots.length > 0 ? "success" : "partial",
      };

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
