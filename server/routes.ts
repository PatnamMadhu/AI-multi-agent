import type { Express } from "express";
import { createServer, type Server } from "http";
import type { TaskRequest } from "@shared/schema";
import { WorkflowOrchestrator } from "./services/workflow";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  app.post("/api/capture-workflow", async (req, res) => {
    try {
      const body = req.body as TaskRequest | undefined;

      if (!body || typeof body.question !== "string") {
        return res.status(400).json({
          error: "Invalid request",
          message: "Missing 'question' field",
        });
      }

      const orchestrator = new WorkflowOrchestrator();
      const result = await orchestrator.captureWorkflow(body);

      return res.json(result);
    } catch (error) {
      console.error("Error in /api/capture-workflow:", error);
      return res.status(500).json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      openaiConfigured: !!process.env.OPENAI_API_KEY,
    });
  });

  return httpServer;
}
