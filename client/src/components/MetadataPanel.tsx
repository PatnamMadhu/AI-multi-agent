import { Card } from "@/components/ui/card";
import { WorkflowResponse } from "@shared/schema";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Clock, Target, Hash, TrendingUp } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface MetadataPanelProps {
  workflow: WorkflowResponse;
}

export function MetadataPanel({ workflow }: MetadataPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover-elevate active-elevate-2" data-testid="button-metadata-toggle">
          <h3 className="text-lg font-semibold">Technical Details</h3>
          <ChevronDown
            className={cn(
              "h-5 w-5 transition-transform",
              isOpen && "transform rotate-180",
            )}
          />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 pt-2 space-y-4 border-t">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1" data-testid="metadata-task-id">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Hash className="h-4 w-4" />
                  <span>Task ID</span>
                </div>
                <p className="font-mono text-sm">{workflow.taskId}</p>
              </div>

              <div className="space-y-1" data-testid="metadata-target-app">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Target className="h-4 w-4" />
                  <span>Target Application</span>
                </div>
                <p className="text-sm font-medium">{workflow.analysis.targetApplication}</p>
              </div>

              <div className="space-y-1" data-testid="metadata-duration">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Processing Duration</span>
                </div>
                <p className="text-sm font-medium">
                  {(workflow.processingDuration / 1000).toFixed(2)}s
                </p>
              </div>

              <div className="space-y-1" data-testid="metadata-steps">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="h-4 w-4" />
                  <span>Steps Captured</span>
                </div>
                <p className="text-sm font-medium">{workflow.screenshots.length}</p>
              </div>
            </div>

            <div className="space-y-1" data-testid="metadata-completed">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Completed At</span>
              </div>
              <p className="text-sm">
                {new Date(workflow.completedAt).toLocaleString()}
              </p>
            </div>

            <div className="space-y-1" data-testid="metadata-question">
              <div className="text-sm text-muted-foreground">Original Question</div>
              <p className="text-sm bg-muted p-3 rounded-md">{workflow.question}</p>
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
