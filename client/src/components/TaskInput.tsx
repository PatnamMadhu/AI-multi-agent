import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

interface TaskInputProps {
  onSubmit: (question: string) => void;
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
  const charCount = question.length;
  const maxChars = 500;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (question.trim() && !isLoading) {
      onSubmit(question.trim());
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
