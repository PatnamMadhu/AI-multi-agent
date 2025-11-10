import OpenAI from "openai";
import { TaskAnalysis, NavigationStep } from "@shared/schema";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function analyzeTask(question: string): Promise<TaskAnalysis> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: `You are an expert at analyzing web application workflows and generating step-by-step navigation plans. 
          
Given a user's question about how to perform a task in a web application, you must:
1. Identify the target application
2. Estimate the number of steps required
3. Generate a detailed navigation plan with specific actions
4. Provide the starting URL (the main page of the application)

IMPORTANT RULES:
- The startingUrl must be a valid, complete URL to the application's main page
- For "navigate" actions (to different pages), put the target URL in the "value" field
- For "click" actions, put the CSS selector in the "selector" field
- For "type" actions, put the CSS selector in "selector" and text in "value"
- For "screenshot" actions, leave selector and value empty
- Be as specific as possible with CSS selectors (use IDs, data attributes, aria-labels, class names)
- You can use "navigate" actions if the workflow requires visiting different URLs

Each navigation step should include:
- stepNumber: The order of this step (starting from 1)
- action: "navigate", "click", "type", "wait", or "screenshot"
- description: A clear description of what this step does
- selector: CSS selector for the element to interact with (required for click/type)
- value: Value for type actions OR URL for navigate actions
- waitFor: Optional - what to wait for before proceeding

Respond ONLY with valid JSON in this exact format:
{
  "targetApplication": "Linear",
  "estimatedSteps": 4,
  "startingUrl": "https://linear.app",
  "navigationPlan": [
    {
      "stepNumber": 1,
      "action": "screenshot",
      "description": "Capture the Linear homepage",
      "selector": "",
      "value": "",
      "waitFor": ""
    },
    {
      "stepNumber": 2,
      "action": "click",
      "description": "Click the New Project button",
      "selector": "button[aria-label='New project']",
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
      estimatedSteps: result.estimatedSteps || result.navigationPlan?.length || 5,
      startingUrl: result.startingUrl || "https://www.google.com",
      navigationPlan: result.navigationPlan || [],
    };

    return analysis;
  } catch (error) {
    console.error("Error analyzing task:", error);
    throw new Error(`Failed to analyze task: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

export async function refineNavigationStep(
  step: NavigationStep,
  currentPageHtml: string,
  previousSteps: string[]
): Promise<NavigationStep> {
  // This function can be used to refine navigation steps based on actual page content
  // For now, we'll return the step as-is, but this could use GPT-5 to adapt to actual page structure
  return step;
}
