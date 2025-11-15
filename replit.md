# AI Workflow Capture System

## Overview

This is an AI-powered browser automation tool that captures screenshots of web application workflows. Users describe a task they want to automate (e.g., "How do I create a project in Linear?"), and the system uses GPT-5 to analyze the task, generate a step-by-step navigation plan, execute the plan using Puppeteer, and capture screenshots at each step.

The application enables non-technical users to document UI workflows automatically by simply asking questions in natural language.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript using Vite as the build tool

**UI Component System**: The application uses shadcn/ui components built on Radix UI primitives with Tailwind CSS for styling. The design follows Material Design 3 principles adapted for developer tools, emphasizing clarity and information density.

**Design Philosophy**: 
- Single-page application with focused workflow (no multi-column layouts)
- Information hierarchy that clearly separates input, process, and output states
- Typography using Inter font family throughout
- Spacing follows Tailwind's 2/4/6/8 unit system consistently

**State Management**: React Query (@tanstack/react-query) handles server state and API communication. Local component state managed with React hooks.

**Routing**: Wouter for lightweight client-side routing

**Theme System**: Custom theme provider supporting light/dark modes with CSS variables for all colors and design tokens

### Backend Architecture

**Runtime**: Node.js with Express.js server

**API Design**: RESTful API with two main endpoints:
- `POST /api/capture-workflow` - Main endpoint accepting natural language task descriptions
- `GET /api/health` - Health check endpoint

**Service Layer Architecture**:
1. **WorkflowOrchestrator** (`server/services/workflow.ts`) - Main coordinator that orchestrates the entire capture workflow
2. **OpenAI Service** (`server/services/openai.ts`) - Handles AI task analysis using GPT-5 to convert natural language into structured navigation plans
3. **BrowserAutomation** (`server/services/browser.ts`) - Controls Puppeteer for browser automation and screenshot capture

**Workflow Execution Pattern**:
The system follows a multi-stage pipeline:
1. User submits natural language question
2. Cache check: If identical question was recently asked, return cached results instantly
3. GPT-5 analyzes and generates navigation plan with specific actions (navigate, click, type, wait, screenshot, conditional)
4. Puppeteer executes the plan step-by-step with support for conditional branching
5. Screenshots captured at specified steps with element bounding box annotations
6. Results cached and returned with metadata

**Conditional Branching Support** (Added Nov 2025):
The system supports multi-step workflows with conditional navigation:
- **Binary Conditionals**: if-else, element-exists, text-contains, url-matches logic
- **Switch-Case Conditionals**: Multi-path routing based on page state (3+ branches)
- **Discriminated Union Schema**: Type-safe conditional branch structures
- **Shared Evaluator**: `conditionalEvaluator` utility runs in browser context for accurate condition checking
- **Recursive Execution**: Nested conditionals supported with proper screenshot capture at each branch

**Authentication Flow Handling** (Enhanced Nov 2025):
The system provides flexible authentication handling with manual user control:
- **Manual Authentication Selection**: Users can choose their authentication state via radio buttons:
  - `Auto-detect` (default): Checks login state and documents both logged-in/logged-out scenarios
  - `Already logged in`: Skips all auth checks, proceeds directly with main task using imported cookies
  - `Need to sign in`: Focuses on documenting the sign-in workflow in detail (with optional credential input)
  - `Need to sign up`: Focuses on documenting the sign-up/registration workflow (with optional credential input)
- **Credential Input Feature** (Nov 2025): When "Need to sign in" or "Need to sign up" is selected:
  - Optional credential fields appear for username/email, password, and display name (signup only)
  - If credentials provided: System PERFORMS the actual login/signup, then continues with main workflow
  - If credentials omitted: System DOCUMENTS the login/signup forms without filling them (placeholder mode)
  - Credentials are NEVER stored or cached - used only transiently for workflow execution
  - Workflows with credentials are NOT cached to prevent credential persistence
  - Works with standard login forms and can be combined with OAuth buttons
- **Cookie Import Feature** (Nov 2025): When "Already logged in" is selected:
  - Collapsible UI allows users to paste browser cookies exported from extensions
  - Supports two formats: JSON array `[{"name":"...","value":"..."}]` and cookie format `name=value; domain=...; path=...`
  - Validates and parses cookies with clear error messages
  - Component state automatically resets when switching auth modes (prevents data leaks)
  - Cookies are only transmitted to backend when in "already-logged-in" mode
  - Supports OAuth provider cookies (Google, GitHub, etc.) for session reuse across apps
- **OAuth Popup Handling** (Nov 2025):
  - Automatically detects OAuth buttons ("Continue with Google", "Sign in with GitHub", etc.)
  - Handles popup windows for OAuth providers (Google, GitHub, Microsoft, Apple)
  - Waits for OAuth flow completion and popup closure before continuing
  - Supports cookie reuse: if OAuth provider session exists, auto-confirms without credential entry
  - Documents OAuth button clicks without revealing popup internals
  - Works seamlessly with both auto-detect and explicit sign-in modes
- **Dual-Path Documentation**: Auto-detect mode captures workflows for BOTH logged-in and logged-out states
- **Login Form Documentation**: Takes screenshots showing where users enter credentials (or actual values if provided)
- **Flexible Modes**: Choose between documentation-only (placeholders) and execution (real credentials)
- **Conditional Routing**: If already logged in, skips to main task; if not, handles login/signup flow
- **Visual Guidance**: Screenshots show login forms, sign-up options, and authentication steps
- **Cache Isolation**: Different auth preferences, cookie states, and credentials maintain separate cache entries to ensure correct behavior

**Screenshot Annotations** (Added Nov 2025):
Each screenshot can include visual annotations showing interacted elements:
- **Bounding Box Tracking**: Automatically captures element coordinates for click/type actions
- **Canvas Rendering**: HTML5 Canvas overlays with semi-transparent rectangles and labels
- **HiDPI Support**: Device pixel ratio handling with transform reset prevents scaling artifacts
- **Responsive Updates**: ResizeObserver ensures annotations scale correctly on window resize

**Browser Automation**: Puppeteer runs in headless mode with specific arguments for containerized environments (no-sandbox, disable-setuid-sandbox). The browser viewport is set to 1280x720 for consistent screenshots.

### Data Storage Solutions

**Current Implementation**: In-memory storage using `MemStorage` class for user data (if needed for future authentication)

**Database Ready**: Drizzle ORM configured with PostgreSQL schema defined in `shared/schema.ts`, though not currently used for core workflow functionality. The system is prepared to add database persistence with migrations stored in `./migrations`.

**Data Flow**: Workflows are cached in-memory for performance. Identical questions return cached results instantly. No persistent database storage of workflow results.

**Caching Layer** (Added Nov 2025):
LRU cache implementation for workflow result optimization:
- **Cache Service**: `server/services/cache.ts` provides LRUCache<T> with configurable size and TTL
- **Configuration**: Max 50 entries, 30-minute TTL for workflow results
- **Key Composition**: `generateCacheKey(request)` creates unique cache keys from:
  - Normalized question (lowercase, trimmed)
  - Normalized target URL (lowercase, trimmed)
  - Normalized auth preference (lowercase, defaults to "auto-detect")
  - Cookie hash (SHA-256 of complete cookie data including values for session isolation)
  - **Credentials are never processed**: Cache key generation is skipped entirely when credentials are provided
- **Cache Isolation**: Different auth preferences and cookie states maintain separate cache entries
- **Security Guarantee**: Workflows with credentials are never cached - orchestrator short-circuits before cache key generation
- **LRU Eviction**: Least Recently Used eviction when cache is full (O(n) acceptable for size 50)
- **TTL Expiration**: Automatic cleanup of expired entries before size enforcement prevents deadlock
- **Deep Cloning**: JSON serialization ensures cache integrity - consumers cannot corrupt cached data
- **Cache Orchestration**: WorkflowOrchestrator checks credentials first, then cache; stores successful results only for non-credential workflows
- **UI Indicators**: Frontend displays "Cached" badge with Database icon when results come from cache

### Schema & Validation

**Validation**: Zod schemas define all data contracts between frontend and backend:
- `taskRequestSchema` - Validates incoming workflow requests
- `navigationStepSchema` - Defines structure of AI-generated steps with conditional branch support
- `conditionalBranchSchema` - Discriminated union for if-else and switch-case branches
- `boundingBoxSchema` - Element annotation coordinates and labels
- `screenshotSchema` - Captured screenshot metadata with optional annotations array
- `taskAnalysisSchema` - AI analysis output structure
- `workflowResponseSchema` - Complete API response format with cacheHit indicator

This ensures type safety across the full stack with shared types generated from schemas.

**Recent Schema Extensions** (Nov 2025):
- Added `conditional` field to NavigationStep for branching logic
- Added `annotations` array to Screenshot for bounding box metadata
- Added `cacheHit` boolean to WorkflowResponse for cache status indication
- Added `authPreference` enum and optional field to TaskRequest for manual authentication control
- Added `AuthPreference` type with values: "auto-detect", "already-logged-in", "need-sign-in", "need-sign-up"

### Authentication & Authorization

**Current State**: No authentication implemented. The health check endpoint exposes whether OpenAI API key is configured.

**Design Decision**: Authentication infrastructure exists (session-based with connect-pg-simple) but is not actively used, allowing the tool to function as a utility service.

### External Dependencies

**AI Service**: 
- OpenAI API (GPT-4.1-mini model) for natural language task analysis
- Requires `OPENAI_API_KEY` environment variable
- The AI generates structured navigation plans from freeform questions
- Enhanced with authentication detection and dual-state workflow documentation

**Database**:
- PostgreSQL via Neon serverless driver (`@neondatabase/serverless`)
- Drizzle ORM for schema management and queries
- Requires `DATABASE_URL` environment variable (though not currently used for core functionality)

**Browser Automation**:
- Puppeteer (v5.4.7 types) for headless Chrome automation
- Captures screenshots as base64-encoded PNG images
- Executes navigation plans with configurable timeout (30s for page loads)

**Development Tools**:
- Replit-specific plugins for development environment (cartographer, dev-banner, runtime-error-modal)
- These are conditionally loaded only in development mode

**UI Component Libraries**:
- Radix UI primitives for accessible components
- Tailwind CSS for styling with custom design tokens
- shadcn/ui component system following "new-york" style preset

**Fonts**: Google Fonts CDN serving Inter font family