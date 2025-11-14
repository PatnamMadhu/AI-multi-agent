import OpenAI from "openai";
import { TaskAnalysis, NavigationStep, AuthPreference } from "@shared/schema";

// Using gpt-4.1-mini for compatibility with chat completions API
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function analyzeTask(question: string, authPreference?: AuthPreference): Promise<TaskAnalysis> {
  try {
    // Build authentication-specific instructions based on user's preference
    let authInstructions = "";
    
    if (authPreference === "already-logged-in") {
      authInstructions = `
          AUTHENTICATION MODE: User is already logged in
          - Skip all authentication checks
          - Do NOT check for login state
          - Proceed directly with the main task
          - Assume user has valid session and permissions`;
    } else if (authPreference === "need-sign-in") {
      authInstructions = `
          AUTHENTICATION MODE: User needs to sign in
          - Focus on documenting the sign-in process in detail
          - Show where to enter email and password
          - Document the complete login flow
          - Use placeholder text like "[User will enter email]" for credentials
          - After documenting sign-in, proceed with the main task`;
    } else if (authPreference === "need-sign-up") {
      authInstructions = `
          AUTHENTICATION MODE: User needs to sign up
          - Focus on documenting the sign-up/registration process in detail
          - Show where to enter registration information
          - Document the complete registration flow
          - Use placeholder text like "[User will enter email]" for form fields
          - After documenting sign-up, proceed with the main task`;
    } else {
      // Default: auto-detect
      authInstructions = `
          AUTHENTICATION MODE: Auto-detect (check both scenarios)
          - ALWAYS check for authentication state first before attempting the main task
          - Use element-exists to detect if user is logged in (check for logout button, profile icon, or other logged-in indicators)
          - If login is required, include conditional branching that:
            1. Checks if user is already logged in
            2. If not logged in: Take screenshots showing the login form and document the login process
            3. If logged in: Continue with the main task
          - IMPORTANT: Document the workflow for BOTH logged-in and logged-out states
          - For login forms: Use placeholder text like "[User will enter email]" or "[User will enter password]" in descriptions`;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert at analyzing web application workflows and generating step-by-step navigation plans with conditional branching logic.

          Given a user's question about how to perform a task in a web application, you must:
          1. Identify the target application
          2. Estimate the number of steps required
          3. Generate a detailed navigation plan with specific actions
          4. Provide the starting URL (the main page of the application)
          5. Use conditional branching when the workflow may vary based on page state

          IMPORTANT RULES:
          - The startingUrl must be a valid, complete URL to the application's main page
          - For "navigate" actions (to different pages), put the target URL in the "value" field
          - For "click" actions, put the CSS selector in the "selector" field
          - For "type" actions, put the CSS selector in "selector" and text in "value"
          - For "screenshot" actions, leave selector and value empty
          - Be as specific as possible with CSS selectors (prefer data-testid)
          - You can use "navigate" actions if the workflow requires visiting different URLs

          CORRECT LINEAR SELECTORS (2025 UI):
          - Login email input: input[name='email']
          - Continue login button: button[data-testid='continue-button']
          - Logged-in state check: button[data-testid='new-project-button']
          - New Project modal name input: input[data-testid='project-name']
          - Create Project submit button: button[data-testid='project-form-submit']

          Each navigation step must include:
          - stepNumber
          - action ("navigate", "click", "type", "wait", "screenshot", or "conditional")
          - description
          - selector
          - value
          - waitFor
          - conditional (optional)

          ${authInstructions}

          CONDITIONAL BRANCHING:
          Use conditional steps when the workflow may differ based on page state. There are two types:

          1. BINARY CONDITIONALS (element-exists, text-contains, url-matches, if-else):
             Use when there are two possible paths. The "ifBranch" is REQUIRED, "elseBranch" is optional.
             
             Example - Authentication check:
             {
               "stepNumber": 1,
               "action": "conditional",
               "description": "Check if user is already logged in",
               "conditional": {
                 "type": "element-exists",
                 "condition": "Check for logged-in state",
                 "selector": "button[aria-label='Profile'], a[href='/logout'], img[alt='Profile']",
                 "ifBranch": [
                   {"stepNumber": 1.1, "action": "screenshot", "description": "User is logged in - capture dashboard", "selector": "", "value": "", "waitFor": ""},
                   {"stepNumber": 1.2, "action": "click", "description": "Proceed with main task", "selector": "button[data-testid='new-item']", "value": "", "waitFor": ""}
                 ],
                 "elseBranch": [
                   {"stepNumber": 1.3, "action": "screenshot", "description": "Login form displayed - user needs to log in", "selector": "", "value": "", "waitFor": ""},
                   {"stepNumber": 1.4, "action": "click", "description": "Click login button (user will need to enter credentials)", "selector": "button[data-testid='login-button']", "value": "", "waitFor": ""},
                   {"stepNumber": 1.5, "action": "screenshot", "description": "Show where user enters email and password", "selector": "", "value": "", "waitFor": ""}
                 ]
               }
             }

          2. SWITCH-CASE CONDITIONALS:
             Use when there are 3+ possible paths based on different values. The "cases" array is REQUIRED, "defaultBranch" is optional.
             
             Example - Multiple states:
             {
               "stepNumber": 2,
               "action": "conditional",
               "description": "Route based on account type",
               "conditional": {
                 "type": "switch-case",
                 "condition": "Determine account type from page",
                 "selector": "[data-account-type]",
                 "cases": [
                   {
                     "matchValue": "premium",
                     "steps": [
                       {"stepNumber": 2.1, "action": "click", "description": "Access premium features", "selector": "#premium-panel", "value": "", "waitFor": ""}
                     ]
                   },
                   {
                     "matchValue": "basic",
                     "steps": [
                       {"stepNumber": 2.2, "action": "click", "description": "Access basic features", "selector": "#basic-panel", "value": "", "waitFor": ""}
                     ]
                   }
                 ],
                 "defaultBranch": [
                   {"stepNumber": 2.3, "action": "screenshot", "description": "Unknown account type", "selector": "", "value": "", "waitFor": ""}
                 ]
               }
             }

          Respond ONLY with valid JSON in this exact structure:
          {
            "targetApplication": "Linear",
            "estimatedSteps": 4,
            "startingUrl": "https://linear.app/login",
            "navigationPlan": [
              {
                "stepNumber": 1,
                "action": "screenshot",
                "description": "Capture the Linear login page",
                "selector": "",
                "value": "",
                "waitFor": ""
              },
              {
                "stepNumber": 2,
                "action": "click",
                "description": "Click the New Project button",
                "selector": "button[data-testid='new-project-button']",
                "value": "",
                "waitFor": ""
              },
              {
                "stepNumber": 3,
                "action": "screenshot",
                "description": "Capture the project creation modal",
                "selector": "",
                "value": "",
                "waitFor": ""
              }
            ]
          }`,
        },
        {
          role: "user",
          content: question,
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 4096,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const result = JSON.parse(content);

    // Validate and transform the result
    const analysis: TaskAnalysis = {
      targetApplication: result.targetApplication || "Unknown",
      estimatedSteps:
        result.estimatedSteps || result.navigationPlan?.length || 5,
      startingUrl: result.startingUrl || "https://www.google.com",
      navigationPlan: result.navigationPlan || [],
    };

    return analysis;
  } catch (error) {
    console.error("Error analyzing task:", error);
    throw new Error(
      `Failed to analyze task: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

export async function refineNavigationStep(
  step: NavigationStep,
  currentPageHtml: string,
  previousSteps: string[],
): Promise<NavigationStep> {
  // This function can be used to refine navigation steps based on actual page content
  // For now, we'll return the step as-is, but this could use GPT-5 to adapt to actual page structure
  return step;
}
