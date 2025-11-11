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

// Define base navigation step type
type BaseNavigationStep = {
  stepNumber: number;
  action: string;
  description: string;
  selector?: string;
  value?: string;
  waitFor?: string;
};

// Discriminated union for conditional branches
export type ConditionalBranch =
  | {
      type: "if-else" | "element-exists" | "text-contains" | "url-matches";
      condition: string;
      selector?: string;
      expectedValue?: string;
      ifBranch: NavigationStep[];
      elseBranch?: NavigationStep[];
    }
  | {
      type: "switch-case";
      condition: string;
      selector?: string;
      expectedValue?: string;
      cases: Array<{ matchValue: string; steps: NavigationStep[] }>;
      defaultBranch?: NavigationStep[];
    };

export type NavigationStep = BaseNavigationStep & {
  conditional?: ConditionalBranch;
};

// Base navigation step schema without conditional
const baseNavigationStepSchema = z.object({
  stepNumber: z.number(),
  action: z.string(),
  description: z.string(),
  selector: z.string().optional(),
  value: z.string().optional(),
  waitFor: z.string().optional(),
});

// Schema for switch-case branches
const switchCaseSchema: z.ZodType<{ matchValue: string; steps: NavigationStep[] }> = z.object({
  matchValue: z.string(),
  steps: z.array(z.lazy(() => navigationStepSchema as any)),
}) as any;

// Binary conditional schema (if-else, element-exists, etc.)
const binaryConditionalSchema: z.ZodType<Extract<ConditionalBranch, { type: "if-else" }>> = z.object({
  type: z.enum(["if-else", "element-exists", "text-contains", "url-matches"]),
  condition: z.string(),
  selector: z.string().optional(),
  expectedValue: z.string().optional(),
  ifBranch: z.array(z.lazy(() => navigationStepSchema as any)),
  elseBranch: z.array(z.lazy(() => navigationStepSchema as any)).optional(),
}) as any;

// Switch-case conditional schema
const switchCaseConditionalSchema: z.ZodType<Extract<ConditionalBranch, { type: "switch-case" }>> = z.object({
  type: z.literal("switch-case"),
  condition: z.string(),
  selector: z.string().optional(),
  expectedValue: z.string().optional(),
  cases: z.array(switchCaseSchema),
  defaultBranch: z.array(z.lazy(() => navigationStepSchema as any)).optional(),
}) as any;

// Discriminated union for conditional branch schema
const conditionalBranchSchema: z.ZodType<ConditionalBranch> = z.discriminatedUnion("type", [
  binaryConditionalSchema as any,
  switchCaseConditionalSchema as any,
]) as any;

// Complete navigation step schema with conditional support
export const navigationStepSchema: z.ZodType<NavigationStep> = baseNavigationStepSchema.extend({
  conditional: conditionalBranchSchema.optional(),
}) as any;

// Schema for bounding box annotation
export const boundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  label: z.string().optional(), // e.g., "click", "type", "hover"
});

export type BoundingBox = z.infer<typeof boundingBoxSchema>;

// Schema for captured screenshots
export const screenshotSchema = z.object({
  stepNumber: z.number(),
  description: z.string(),
  imageBase64: z.string(),
  timestamp: z.string(),
  url: z.string().optional(),
  annotations: z.array(boundingBoxSchema).optional(), // Element annotations
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
