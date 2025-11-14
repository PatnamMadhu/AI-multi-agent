import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sparkles, Shield } from "lucide-react";
import { AuthPreference } from "@shared/schema";
import { CookieImport } from "./CookieImport";

interface CookieData {
  name: string;
  value: string;
  domain?: string;
  path?: string;
}

interface TaskInputProps {
  onSubmit: (question: string, authPreference: AuthPreference, cookies?: CookieData[]) => void;
  isLoading: boolean;
}

const exampleQuestions = [
  "How do I create a project in Linear?",
  "How do I filter a database in Notion?",
  "How do I create a new issue in GitHub?",
  "How do I schedule a tweet in Twitter?",
];

export function TaskInput({ onSubmit, isLoading }: TaskInputProps) {
  const [question, setQuestion] = useState("");
  const [authPreference, setAuthPreference] = useState<AuthPreference>("auto-detect");
  const [cookies, setCookies] = useState<CookieData[]>([]);
  const charCount = question.length;
  const maxChars = 500;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (question.trim() && !isLoading) {
      onSubmit(question.trim(), authPreference, cookies.length > 0 ? cookies : undefined);
    }
  };

  const handleExampleClick = (example: string) => {
    if (!isLoading) {
      setQuestion(example);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="task-question" className="text-lg font-semibold">
          What workflow would you like to capture?
        </Label>
        <p className="text-sm text-muted-foreground">
          Describe the task you want to automate. Our AI will navigate the application and capture each step.
        </p>
      </div>

      <div className="space-y-2">
        <Textarea
          id="task-question"
          data-testid="input-task-question"
          placeholder="e.g., How do I create a project in Linear?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={isLoading}
          className="min-h-32 resize-none text-base"
          maxLength={maxChars}
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Be specific about the application and the task
          </p>
          <p className="text-xs text-muted-foreground">
            {charCount}/{maxChars}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <Label className="text-base font-semibold">Authentication</Label>
        </div>
        <p className="text-sm text-muted-foreground">
          How should the system handle login requirements?
        </p>
        <RadioGroup
          value={authPreference}
          onValueChange={(value) => setAuthPreference(value as AuthPreference)}
          disabled={isLoading}
          className="space-y-3"
        >
          <div className="flex items-start gap-3">
            <RadioGroupItem value="auto-detect" id="auth-auto" data-testid="radio-auth-auto" className="mt-0.5" />
            <div className="flex-1">
              <Label htmlFor="auth-auto" className="font-medium cursor-pointer">
                Auto-detect (Recommended)
              </Label>
              <p className="text-sm text-muted-foreground">
                Automatically checks login state and documents both scenarios
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <RadioGroupItem value="already-logged-in" id="auth-logged-in" data-testid="radio-auth-logged-in" className="mt-0.5" />
            <div className="flex-1">
              <Label htmlFor="auth-logged-in" className="font-medium cursor-pointer">
                I'm already logged in
              </Label>
              <p className="text-sm text-muted-foreground">
                Use your existing browser session cookies to access logged-in content
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <RadioGroupItem value="need-sign-in" id="auth-sign-in" data-testid="radio-auth-sign-in" className="mt-0.5" />
            <div className="flex-1">
              <Label htmlFor="auth-sign-in" className="font-medium cursor-pointer">
                I need to sign in
              </Label>
              <p className="text-sm text-muted-foreground">
                Focus on documenting the sign-in process
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <RadioGroupItem value="need-sign-up" id="auth-sign-up" data-testid="radio-auth-sign-up" className="mt-0.5" />
            <div className="flex-1">
              <Label htmlFor="auth-sign-up" className="font-medium cursor-pointer">
                I need to sign up
              </Label>
              <p className="text-sm text-muted-foreground">
                Focus on documenting the sign-up process
              </p>
            </div>
          </div>
        </RadioGroup>

        {authPreference === "already-logged-in" && (
          <CookieImport onCookiesChange={setCookies} disabled={isLoading} />
        )}
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Example Questions
        </p>
        <div className="flex flex-wrap gap-2">
          {exampleQuestions.map((example, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="cursor-pointer hover-elevate active-elevate-2 px-4 py-2 text-sm"
              onClick={() => handleExampleClick(example)}
              data-testid={`badge-example-${index}`}
            >
              {example}
            </Badge>
          ))}
        </div>
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={!question.trim() || isLoading}
        className="w-full sm:w-auto px-8"
        data-testid="button-capture-workflow"
      >
        <Sparkles className="mr-2 h-4 w-4" />
        {isLoading ? "Capturing Workflow..." : "Capture Workflow"}
      </Button>
    </form>
  );
}
