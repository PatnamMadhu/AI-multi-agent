import { z } from "zod";

// Schema for visual diff configuration
export const visualDiffConfigSchema = z.object({
  disabled: z.boolean().optional(),
  similarityThreshold: z.number().min(0).max(1).optional(),
}).optional();

export type VisualDiffConfig = z.infer<typeof visualDiffConfigSchema>;

// Schema for capturing workflow tasks
export const taskRequestSchema = z.object({
  question: z.string().min(1, "Question is required"),
  targetUrl: z.string().url("Valid URL is required").optional(),
  cookies: z.array(z.object({
    name: z.string(),
    value: z.string(),
    domain: z.string().optional(),
    path: z.string().optional(),
  })).optional(),
  visualDiff: visualDiffConfigSchema,
});

export type TaskRequest = z.infer<typeof taskRequestSchema>;

// Schema for individual navigation steps
export const navigationStepSchema = z.object({
  stepNumber: z.number(),
  action: z.string(),
  description: z.string(),
  selector: z.string().optional(),
  value: z.string().optional(),
  waitFor: z.string().optional(),
});

export type NavigationStep = z.infer<typeof navigationStepSchema>;

// Schema for captured screenshots
export const screenshotSchema = z.object({
  stepNumber: z.number(),
  description: z.string(),
  imageBase64: z.string(),
  timestamp: z.string(),
  url: z.string().optional(),
});

export type Screenshot = z.infer<typeof screenshotSchema>;

// Schema for task analysis result from LLM
export const taskAnalysisSchema = z.object({
  targetApplication: z.string(),
  estimatedSteps: z.number(),
  navigationPlan: z.array(navigationStepSchema),
  startingUrl: z.string(),
});

export type TaskAnalysis = z.infer<typeof taskAnalysisSchema>;

// Schema for duplicate detection metadata
export const duplicateInfoSchema = z.object({
  stepNumber: z.number(),
  originalStepNumber: z.number(),
  similarity: z.number(),
  reason: z.string(),
});

export type DuplicateInfo = z.infer<typeof duplicateInfoSchema>;

// Schema for visual diff metadata in response
export const visualDiffMetadataSchema = z.object({
  duplicates: z.array(duplicateInfoSchema),
  totalScreenshots: z.number(),
  uniqueScreenshots: z.number(),
  duplicatesSkipped: z.number(),
});

export type VisualDiffMetadata = z.infer<typeof visualDiffMetadataSchema>;

// Schema for the complete workflow response
export const workflowResponseSchema = z.object({
  taskId: z.string(),
  question: z.string(),
  analysis: taskAnalysisSchema,
  screenshots: z.array(screenshotSchema),
  processingDuration: z.number(),
  completedAt: z.string(),
  status: z.enum(["success", "partial", "failed"]),
  error: z.string().optional(),
  visualDiff: visualDiffMetadataSchema.optional(),
});

export type WorkflowResponse = z.infer<typeof workflowResponseSchema>;

// Schema for real-time progress updates
export const progressUpdateSchema = z.object({
  currentStep: z.number(),
  totalSteps: z.number(),
  status: z.string(),
  message: z.string(),
});

export type ProgressUpdate = z.infer<typeof progressUpdateSchema>;
