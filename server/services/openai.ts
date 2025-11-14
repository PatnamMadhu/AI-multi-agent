import OpenAI from "openai";
import { TaskAnalysis, NavigationStep } from "@shared/schema";

// Using gpt-4.1-mini for compatibility with chat completions API
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function analyzeTask(question: string): Promise<TaskAnalysis> {
  try {
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

          CONDITIONAL EXAMPLES:
          (Binary and switch-case examples unchanged — keep them as you have.)

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
