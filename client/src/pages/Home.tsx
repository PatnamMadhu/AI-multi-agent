import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { TaskInput } from "@/components/TaskInput";
import { ProgressIndicator } from "@/components/ProgressIndicator";
import { ScreenshotGallery } from "@/components/ScreenshotGallery";
import { ImageModal } from "@/components/ImageModal";
import { MetadataPanel } from "@/components/MetadataPanel";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { Screenshot, WorkflowResponse, Credentials } from "@shared/schema";
import { Bot, Zap, Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [workflow, setWorkflow] = useState<WorkflowResponse | null>(null);
  const [selectedScreenshot, setSelectedScreenshot] =
    useState<Screenshot | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { toast } = useToast();

  // Progress state that updates during workflow capture
  type ProgressStep = {
    label: string;
    status: "pending" | "in-progress" | "completed";
  };
  const [progress, setProgress] = useState<{
    currentStep: number;
    totalSteps: number;
    statusMessage: string;
    steps: ProgressStep[];
  }>({
    currentStep: 0,
    totalSteps: 5,
    statusMessage: "Preparing to capture workflow...",
    steps: [
      { label: "Analyzing task with AI", status: "pending" },
      { label: "Planning navigation steps", status: "pending" },
      { label: "Launching browser automation", status: "pending" },
      { label: "Capturing UI screenshots", status: "pending" },
      { label: "Processing results", status: "pending" },
    ],
  });

  const captureWorkflowMutation = useMutation({
    mutationFn: async ({ 
      question, 
      authPreference,
      cookies,
      credentials,
    }: { 
      question: string; 
      authPreference: string;
      cookies?: Array<{ name: string; value: string; domain?: string; path?: string }>;
      credentials?: Credentials;
    }) => {
      // Update progress to show we're starting
      setProgress((prev) => ({
        ...prev,
        currentStep: 1,
        statusMessage: "Analyzing task with AI...",
        steps: prev.steps.map((step, idx) => ({
          ...step,
          status: idx === 0 ? ("in-progress" as const) : ("pending" as const),
        })),
      }));

      const result = await apiRequest<WorkflowResponse>(
        "POST",
        "/api/capture-workflow",
        {
          question,
          authPreference,
          cookies,
          credentials,
        },
      );

      return result;
    },
    onSuccess: (data) => {
      // Always set workflow so we can display results or errors
      setWorkflow(data);

      // Update progress to show completion
      setProgress((prev) => ({
        ...prev,
        currentStep: 5,
        statusMessage:
          data.status === "success"
            ? "Workflow capture complete!"
            : "Workflow capture encountered errors",
        steps: prev.steps.map((step) => ({
          ...step,
          status: "completed" as const,
        })),
      }));

      // Show appropriate toast based on status
      if (data.status === "success") {
        const isCacheHit = data.cacheHit === true;
        toast({
          title: isCacheHit ? "Success! (Cached Result)" : "Success!",
          description: isCacheHit
            ? `Retrieved ${data.screenshots.length} cached steps instantly`
            : `Captured ${data.screenshots.length} steps${data.processingDuration ? ` in ${(data.processingDuration / 1000).toFixed(1)}s` : ''}`,
        });
      } else if (data.status === "partial") {
        toast({
          title: "Partially completed",
          description: "Some steps were captured, but errors occurred.",
          variant: "destructive",
        });
      } else if (data.status === "failed") {
        toast({
          title: "Capture Failed",
          description: data.error || "The workflow capture failed",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to capture workflow",
        variant: "destructive",
      });

      // Reset progress on error
      setProgress((prev) => ({
        ...prev,
        currentStep: 0,
        statusMessage: "Error occurred",
        steps: prev.steps.map((step) => ({
          ...step,
          status: "pending" as const,
        })),
      }));
    },
  });

  const handleTaskSubmit = async (
    question: string, 
    authPreference: string,
    cookies?: Array<{ name: string; value: string; domain?: string; path?: string }>,
    credentials?: Credentials
  ) => {
    setWorkflow(null);
    captureWorkflowMutation.mutate({ question, authPreference, cookies, credentials });
  };

  const handleImageClick = (screenshot: Screenshot) => {
    setSelectedScreenshot(screenshot);
    setIsModalOpen(true);
  };

  const handleNewCapture = () => {
    setWorkflow(null);
    captureWorkflowMutation.reset();
    setProgress({
      currentStep: 0,
      totalSteps: 5,
      statusMessage: "Preparing to capture workflow...",
      steps: [
        { label: "Analyzing task with AI", status: "pending" as const },
        { label: "Planning navigation steps", status: "pending" as const },
        { label: "Launching browser automation", status: "pending" as const },
        { label: "Capturing UI screenshots", status: "pending" as const },
        { label: "Processing results", status: "pending" as const },
      ],
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 z-50 bg-background/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 rounded-lg p-2">
                <Bot className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">AI Workflow Capture</h1>
                <p className="text-sm text-muted-foreground">
                  Automated UI Screenshot Tool
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="gap-2">
              <Zap className="h-3 w-3" />
              <span className="text-xs font-medium">Powered by AI</span>
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Input Section */}
        {!workflow && !captureWorkflowMutation.isError && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold">Capture Any Workflow</h2>
              <p className="text-muted-foreground">
                Describe the task you want to capture, and our AI will
                automatically navigate the application and screenshot each step
                of the workflow.
              </p>
            </div>
            <TaskInput
              onSubmit={handleTaskSubmit}
              isLoading={captureWorkflowMutation.isPending}
            />
          </div>
        )}

        {/* Loading State */}
        {captureWorkflowMutation.isPending && (
          <ProgressIndicator
            currentStep={progress.currentStep}
            totalSteps={progress.totalSteps}
            statusMessage={progress.statusMessage}
            steps={progress.steps}
          />
        )}

        {/* Error State */}
        {(captureWorkflowMutation.isError ||
          (workflow && workflow.status === "failed")) && (
          <ErrorDisplay
            error={
              captureWorkflowMutation.error?.message ||
              workflow?.error ||
              "An unknown error occurred"
            }
            onRetry={handleNewCapture}
          />
        )}

        {/* Results */}
        {workflow &&
          !captureWorkflowMutation.isPending &&
          (workflow.status === "success" || workflow.status === "partial") &&
          workflow.screenshots && (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-semibold">
                      Workflow Captured Successfully
                    </h2>
                    {workflow.cacheHit && (
                      <Badge
                        variant="secondary"
                        className="gap-1.5"
                        data-testid="badge-cache-hit"
                      >
                        <Database className="h-3 w-3" />
                        <span className="text-xs font-medium">Cached</span>
                      </Badge>
                    )}
                  </div>
                  <p
                    className="text-muted-foreground mt-1"
                    data-testid="text-processing-info"
                  >
                    {workflow.cacheHit
                      ? `${workflow.screenshots.length} cached steps retrieved instantly`
                      : `${workflow.screenshots.length} steps captured${workflow.processingDuration ? ` in ${(workflow.processingDuration / 1000).toFixed(1)}s` : ''}`}
                  </p>
                </div>
                <Button
                  onClick={handleNewCapture}
                  variant="outline"
                  data-testid="button-new-capture"
                >
                  New Capture
                </Button>
              </div>

              <ScreenshotGallery
                screenshots={workflow.screenshots}
                onImageClick={handleImageClick}
              />

              <MetadataPanel workflow={workflow} />
            </div>
          )}
      </main>

      {/* Image Modal */}
      <ImageModal
        screenshot={selectedScreenshot}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
