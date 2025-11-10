import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorDisplayProps {
  error: string;
  onRetry?: () => void;
}

export function ErrorDisplay({ error, onRetry }: ErrorDisplayProps) {
  return (
    <Card className="border-l-4 border-l-destructive p-6" data-testid="card-error">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className="rounded-full bg-destructive/10 p-2">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-destructive">
              Workflow Capture Failed
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              We encountered an error while trying to capture the workflow.
            </p>
          </div>

          <div className="bg-destructive/5 border border-destructive/20 rounded-md p-4">
            <p className="text-sm font-mono" data-testid="text-error-message">
              {error}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Troubleshooting suggestions:</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Ensure the application URL is accessible</li>
              <li>Check if authentication is required</li>
              <li>Verify the task description is clear and specific</li>
              <li>Try a simpler workflow to test the system</li>
            </ul>
          </div>

          {onRetry && (
            <Button onClick={onRetry} variant="outline" data-testid="button-retry">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
