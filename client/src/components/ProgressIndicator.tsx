import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProgressStep {
  label: string;
  status: "pending" | "in-progress" | "completed";
}

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
  statusMessage: string;
  steps: ProgressStep[];
}

export function ProgressIndicator({
  currentStep,
  totalSteps,
  statusMessage,
  steps,
}: ProgressIndicatorProps) {
  const progress = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;

  return (
    <Card className="p-6 space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Processing Workflow</h3>
          <span className="text-sm text-muted-foreground" data-testid="text-progress-count">
            Step {currentStep} of {totalSteps}
          </span>
        </div>
        <Progress value={progress} className="h-2" data-testid="progress-bar" />
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <p className="text-sm font-medium" data-testid="text-status-message">
            {statusMessage}
          </p>
        </div>
      </div>

      {steps.length > 0 && (
        <div className="space-y-3 pt-2">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Progress Steps
          </p>
          <div className="space-y-2">
            {steps.map((step, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-md transition-colors",
                  step.status === "in-progress" && "bg-accent",
                )}
                data-testid={`step-${index}`}
              >
                {step.status === "completed" ? (
                  <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                ) : step.status === "in-progress" ? (
                  <Loader2 className="h-4 w-4 text-primary animate-spin flex-shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
                <span
                  className={cn(
                    "text-sm",
                    step.status === "completed"
                      ? "text-foreground"
                      : step.status === "in-progress"
                        ? "text-foreground font-medium"
                        : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
