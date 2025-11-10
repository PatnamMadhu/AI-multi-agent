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
2. GPT-5 analyzes and generates navigation plan with specific actions (navigate, click, type, wait, screenshot)
3. Puppeteer executes the plan step-by-step
4. Screenshots captured at specified steps
5. Results returned with metadata

**Browser Automation**: Puppeteer runs in headless mode with specific arguments for containerized environments (no-sandbox, disable-setuid-sandbox). The browser viewport is set to 1280x720 for consistent screenshots.

### Data Storage Solutions

**Current Implementation**: In-memory storage using `MemStorage` class for user data (if needed for future authentication)

**Database Ready**: Drizzle ORM configured with PostgreSQL schema defined in `shared/schema.ts`, though not currently used for core workflow functionality. The system is prepared to add database persistence with migrations stored in `./migrations`.

**Data Flow**: Request/response cycle is stateless - each workflow capture is independent with no persistent storage of results (results returned directly to client).

### Schema & Validation

**Validation**: Zod schemas define all data contracts between frontend and backend:
- `taskRequestSchema` - Validates incoming workflow requests
- `navigationStepSchema` - Defines structure of AI-generated steps
- `screenshotSchema` - Captured screenshot metadata
- `taskAnalysisSchema` - AI analysis output structure
- `workflowResponseSchema` - Complete API response format

This ensures type safety across the full stack with shared types generated from schemas.

### Authentication & Authorization

**Current State**: No authentication implemented. The health check endpoint exposes whether OpenAI API key is configured.

**Design Decision**: Authentication infrastructure exists (session-based with connect-pg-simple) but is not actively used, allowing the tool to function as a utility service.

### External Dependencies

**AI Service**: 
- OpenAI API (GPT-5 model) for natural language task analysis
- Requires `OPENAI_API_KEY` environment variable
- The AI generates structured navigation plans from freeform questions

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