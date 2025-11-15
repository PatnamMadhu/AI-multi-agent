CREATE TABLE "openai_analysis_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question" text NOT NULL,
	"model" varchar(100),
	"analysis" jsonb NOT NULL,
	"tokens_used" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "workflow_cache" (
	"cache_key" varchar(255) PRIMARY KEY NOT NULL,
	"question" text NOT NULL,
	"response" jsonb NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "workflow_screenshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"step_number" integer NOT NULL,
	"description" text NOT NULL,
	"url" text,
	"image_base64" text NOT NULL,
	"annotations" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "workflow_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question" text NOT NULL,
	"auth_preference" varchar(50),
	"starting_url" text,
	"cache_hit" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "workflow_screenshots" ADD CONSTRAINT "workflow_screenshots_session_id_workflow_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."workflow_sessions"("id") ON DELETE no action ON UPDATE no action;