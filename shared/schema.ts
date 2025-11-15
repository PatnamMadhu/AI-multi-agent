import {
  pgTable,
  text,
  varchar,
  uuid,
  jsonb,
  timestamp,
  serial,
  boolean,
  integer,
} from "drizzle-orm/pg-core";

/* -------------------------------------------------------
   WORKFLOW SESSION (one run of "How do I create X…")
------------------------------------------------------- */
export const workflowSessions = pgTable("workflow_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  question: text("question").notNull(),
  authPreference: varchar("auth_preference", { length: 50 }),
  startingUrl: text("starting_url"),
  cacheHit: boolean("cache_hit").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

/* -------------------------------------------------------
   SCREENSHOTS (one-to-many → session)
------------------------------------------------------- */
export const workflowScreenshots = pgTable("workflow_screenshots", {
  id: serial("id").primaryKey(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => workflowSessions.id),
  stepNumber: integer("step_number").notNull(),
  description: text("description").notNull(),
  url: text("url"),
  imageBase64: text("image_base64").notNull(),
  annotations: jsonb("annotations"), // bounding boxes
  createdAt: timestamp("created_at").defaultNow(),
});

/* -------------------------------------------------------
   CACHED WORKFLOWS (optional DB cache)
------------------------------------------------------- */
export const workflowCacheTable = pgTable("workflow_cache", {
  cacheKey: varchar("cache_key", { length: 255 }).primaryKey(),
  question: text("question").notNull(),
  response: jsonb("response").notNull(), // full WorkflowResponse JSON
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

/* -------------------------------------------------------
   OPENAI NAVIGATION ANALYSIS LOG
------------------------------------------------------- */
export const openaiAnalysisLog = pgTable("openai_analysis_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  question: text("question").notNull(),
  model: varchar("model", { length: 100 }),
  analysis: jsonb("analysis").notNull(), // {startingUrl, plan, steps}
  tokensUsed: integer("tokens_used"),
  createdAt: timestamp("created_at").defaultNow(),
});

/* -------------------------------------------------------
   Drizzle row types
------------------------------------------------------- */

export type WorkflowSession = typeof workflowSessions.$inferSelect;
export type WorkflowScreenshot = typeof workflowScreenshots.$inferSelect;
export type WorkflowCacheRow = typeof workflowCacheTable.$inferSelect;
export type OpenAIAnalysisLogRow = typeof openaiAnalysisLog.$inferSelect;

/* -------------------------------------------------------
   Shared TS types for client + server
------------------------------------------------------- */

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
}

export interface Screenshot {
  stepNumber: number;
  description: string;
  imageBase64: string;
  url?: string;
  annotations?: BoundingBox[];
  timestamp: string;
}

export type ActionType =
  | "navigate"
  | "click"
  | "type"
  | "wait"
  | "screenshot"
  | "conditional";

export interface NavigationStep {
  stepNumber: number;
  action: ActionType;
  description: string;
  selector?: string;
  value?: string;
  waitFor?: string;
  conditional?: ConditionalBranch;
}

export interface ConditionalCase {
  matchValue: string;
  steps: NavigationStep[];
}

export interface ConditionalBranch {
  type:
    | "element-exists"
    | "text-contains"
    | "url-matches"
    | "if-else"
    | "switch-case";
  selector?: string;
  expectedValue?: string; // For text / url checks
  ifBranch: NavigationStep[];
  elseBranch?: NavigationStep[];
  cases?: ConditionalCase[];
  defaultBranch?: NavigationStep[];
}

export type AuthPreference =
  | "auto-detect"
  | "already-logged-in"
  | "need-sign-in"
  | "need-sign-up";

export interface TaskAnalysis {
  targetApplication: string;
  estimatedSteps: number;
  startingUrl: string;
  navigationPlan: NavigationStep[];
}

export interface CookieData {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: "Lax" | "Strict" | "None" | "lax" | "strict" | "none";
  provider?: string; // OAuth provider domain (e.g., "google.com", "github.com")
}

export interface VisualDiffConfig {
  similarityThreshold?: number;
  disabled?: boolean;
}

export interface Credentials {
  username?: string; // Email or username
  password?: string;
  displayName?: string; // For signup flows
}

export interface TaskRequest {
  question: string;
  targetUrl?: string;
  cookies?: CookieData[]; // App cookies + OAuth provider cookies
  visualDiff?: VisualDiffConfig;
  authPreference?: AuthPreference;
  credentials?: Credentials; // Login/signup credentials
}

// OAuth configuration for known providers
export interface OAuthProviderConfig {
  name: string; // "Google", "GitHub", "Microsoft", etc.
  domain: string; // "google.com", "github.com", etc.
  buttonPatterns: string[]; // Text patterns to detect OAuth buttons
}

export const KNOWN_OAUTH_PROVIDERS: OAuthProviderConfig[] = [
  {
    name: "Google",
    domain: "google.com",
    buttonPatterns: [
      "Continue with Google",
      "Sign in with Google",
      "Log in with Google",
      "Google",
    ],
  },
  {
    name: "GitHub",
    domain: "github.com",
    buttonPatterns: [
      "Continue with GitHub",
      "Sign in with GitHub",
      "Log in with GitHub",
      "GitHub",
    ],
  },
  {
    name: "Microsoft",
    domain: "microsoft.com",
    buttonPatterns: [
      "Continue with Microsoft",
      "Sign in with Microsoft",
      "Log in with Microsoft",
      "Microsoft",
    ],
  },
  {
    name: "Apple",
    domain: "apple.com",
    buttonPatterns: [
      "Continue with Apple",
      "Sign in with Apple",
      "Log in with Apple",
      "Apple",
    ],
  },
];

export type WorkflowStatus = "success" | "partial" | "failed";

export interface WorkflowResponse {
  taskId: string;
  question: string;
  screenshots: Screenshot[];
  analysis?: TaskAnalysis;
  status: WorkflowStatus;
  timestamp: string;
  cacheHit?: boolean;
  errorMessage?: string;
}
