import type { Express } from "express";
import { createServer, type Server } from "http";
import { taskRequestSchema } from "@shared/schema";
import { WorkflowOrchestrator } from "./services/workflow";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // POST /api/capture-workflow - Main endpoint to capture workflows
  app.post("/api/capture-workflow", async (req, res) => {
    try {
      // Validate request body
      const validationResult = taskRequestSchema.safeParse(req.body);
      console.log("Validation result:", validationResult);

      if (!validationResult.success) {
        return res.status(400).json({
          error: "Invalid request",
          details: validationResult.error.errors,
        });
      }

      const taskRequest = validationResult.data;

      // Create workflow orchestrator
      const orchestrator = new WorkflowOrchestrator();

      // Execute workflow capture
      const result = await orchestrator.captureWorkflow(taskRequest);

      // Return result
      return res.json(result);
    } catch (error) {
      console.error("Error in /api/capture-workflow:", error);
      return res.status(500).json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // GET /api/health - Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      openaiConfigured: !!process.env.OPENAI_API_KEY,
    });
  });

  return httpServer;
}
