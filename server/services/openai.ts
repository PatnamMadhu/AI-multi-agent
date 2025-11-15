import OpenAI from "openai";
import type {
  TaskAnalysis,
  NavigationStep,
  AuthPreference,
  Credentials,
} from "@shared/schema";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function analyzeTask(
  question: string,
  authPreference?: AuthPreference,
  credentials?: Credentials,
): Promise<TaskAnalysis> {
  // Build authentication-specific instructions
  let authInstructions = "";

  if (authPreference === "already-logged-in") {
    authInstructions = `
AUTH MODE: already-logged-in
- Assume the user has a valid session
- Do NOT navigate to /login or /signup
- Skip all login/signup forms
- Go directly to the page needed for the main task (dashboard, project list, etc.)`;
  } else if (authPreference === "need-sign-in") {
    if (credentials && (credentials.username || credentials.password)) {
      authInstructions = `
AUTH MODE: need-sign-in (with credentials)
- Explicitly document AND PERFORM the sign-in flow
- User provided credentials: ${credentials.username ? `username="${credentials.username}"` : ""} ${credentials.password ? "(password provided)" : ""}
- Enter the ACTUAL credentials into the login form
- Wait for login to complete (check for dashboard, profile, or redirect)
- After successful login, continue with the main task.`;
    } else {
      authInstructions = `
AUTH MODE: need-sign-in
- Explicitly document the sign-in flow
- Show where email/username and password are entered
- Use placeholder text like "[User enters email]" – never real credentials
- After sign-in, continue with the main task.`;
    }
  } else if (authPreference === "need-sign-up") {
    if (credentials && (credentials.username || credentials.password || credentials.displayName)) {
      authInstructions = `
AUTH MODE: need-sign-up (with credentials)
- Explicitly document AND PERFORM the registration/sign-up flow
- User provided credentials: ${credentials.displayName ? `name="${credentials.displayName}"` : ""} ${credentials.username ? `email="${credentials.username}"` : ""} ${credentials.password ? "(password provided)" : ""}
- Enter the ACTUAL credentials into the sign-up form
- Wait for registration to complete (email confirmation, redirect, etc.)
- After successful registration, continue with the main task.`;
    } else {
      authInstructions = `
AUTH MODE: need-sign-up
- Explicitly document the registration/sign-up flow
- Show required fields (email, name, password, etc.)
- Use placeholder text for values
- After registration, continue with the main task.`;
    }
  } else {
    authInstructions = `
AUTH MODE: auto-detect
- FIRST step should be a "conditional" step that checks whether the user is logged in.
- The condition MUST be based on the DOM (e.g. profile avatar, logout button, or presence of a dashboard element).
- If logged in: go directly to the main flow (projects/tickets/boards/whatever matches the question).
- If not logged in: create steps for login, then continue with the main task.`;
  }

  const systemPrompt = `
You are an expert at analyzing arbitrary web application workflows and generating
a general, robust navigation plan with conditional branching.

You must work for ANY web app (Linear, Notion, Jira, GitHub, etc.) based only on
the user's question.

Your job:
1. Identify the target application and a reasonable starting URL.
2. Estimate the number of steps.
3. Generate a detailed navigation plan:
   - "navigate" (change URL)
   - "click"    (click element)
   - "type"     (type into input or textarea)
   - "wait"     (wait for a selector or a short delay)
   - "screenshot" (capture current UI)
   - "conditional" (branch based on DOM/URL state)

GENERAL RULES (VERY IMPORTANT):
- startingUrl MUST be a fully-qualified URL (https://...).
- DO NOT hardcode magic selectors that only work for one app version.
- Prefer stable selectors:
  - data-testid, data-test, aria-label, role, or clear CSS like "button[aria-label*='New project']".
- A "navigate" step:
  - put the target URL in "value".
  - selector can be empty.
- A "click" or "type" step:
  - put the CSS selector in "selector".
  - "value" is used only for "type" (the text to type).
- "wait" steps:
  - If waiting for a selector, put that selector in "selector".
  - Otherwise, use "value" as milliseconds (string), e.g. "1500".
- "screenshot" steps:
  - selector and value are empty strings.
- NEVER use non-standard selectors like "button:has-text('New Project')" – only standard CSS.

${authInstructions}

OAUTH / SSO AUTHENTICATION:
- If the login page only shows OAuth buttons (e.g., "Continue with Google", "Sign in with GitHub"), handle them specially:
  - Include a step to click the OAuth button
  - After clicking, a popup window will open automatically (you don't need to handle this explicitly)
  - The system will detect the popup and handle OAuth provider login
  - After OAuth completes, the popup closes automatically and you continue with the main task
- Common OAuth providers: Google, GitHub, Microsoft, Apple
- OAuth button selectors examples:
  - "button:contains-text('Continue with Google')" (conceptual - use actual CSS)
  - Real selectors: "button[aria-label*='Google']", "button[aria-label*='GitHub']"
  - Or by text content: Look for buttons with "Google", "GitHub", "Microsoft", "Apple" in text
- Document the OAuth button click with description like: "Click 'Continue with Google' to authenticate via OAuth popup"
- No need to document what happens inside the OAuth popup - the system handles that automatically
- After OAuth, check if user is logged in and continue with main task

CONDITIONALS:
- Binary conditional ("element-exists", "text-contains", "url-matches", "if-else"):
  - Use "ifBranch" (required) and "elseBranch" (optional).
- Switch-case ("switch-case"):
  - Use "cases": [{ "matchValue": "...", "steps": [...] }]
  - Optional "defaultBranch" for unmatched values.

Example conditional for auth check (generic):

{
  "stepNumber": 1,
  "action": "conditional",
  "description": "Check if user appears to be logged in (profile/logout visible)",
  "selector": "",
  "value": "",
  "waitFor": "",
  "conditional": {
    "type": "element-exists",
    "selector": "header [aria-label*='Account'], header [aria-label*='Profile'], a[href*='logout'], button[aria-label*='Log out']",
    "ifBranch": [
      {
        "stepNumber": 1.1,
        "action": "screenshot",
        "description": "User is logged in - capture main dashboard state",
        "selector": "",
        "value": "",
        "waitFor": ""
      }
    ],
    "elseBranch": [
      {
        "stepNumber": 1.2,
        "action": "navigate",
        "description": "Go to login page",
        "selector": "",
        "value": "https://example.com/login",
        "waitFor": "domcontentloaded"
      },
      {
        "stepNumber": 1.3,
        "action": "screenshot",
        "description": "Show login form where user will enter credentials",
        "selector": "",
        "value": "",
        "waitFor": ""
      }
    ]
  }
}

RESPONSE FORMAT:
You MUST respond with a single JSON object of this exact shape:

{
  "targetApplication": "Human-readable app name",
  "estimatedSteps": 7,
  "startingUrl": "https://some-app.com/...",
  "navigationPlan": [ NavigationStep, ... ]
}

Where each NavigationStep has:
{
  "stepNumber": number,
  "action": "navigate" | "click" | "type" | "wait" | "screenshot" | "conditional",
  "description": "string",
  "selector": "string",
  "value": "string",
  "waitFor": "string",
  "conditional": { ... } (only for "conditional" actions)
}
`.trim();

  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: question },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 2048,
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error("No response from OpenAI");
  }

  const parsed = JSON.parse(content) as {
    targetApplication?: string;
    estimatedSteps?: number;
    startingUrl?: string;
    navigationPlan?: NavigationStep[];
  };

  const analysis: TaskAnalysis = {
    targetApplication: parsed.targetApplication || "Unknown",
    estimatedSteps: parsed.estimatedSteps || parsed.navigationPlan?.length || 5,
    startingUrl:
      parsed.startingUrl && parsed.startingUrl.startsWith("http")
        ? parsed.startingUrl
        : "https://www.google.com",
    navigationPlan: parsed.navigationPlan || [],
  };

  return analysis;
}

/**
 * Stub for future refinement based on live DOM.
 */
export async function refineNavigationStep(
  step: NavigationStep,
  _currentPageHtml: string,
  _previousSteps: string[],
): Promise<NavigationStep> {
  return step;
}
