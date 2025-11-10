import { useState } from "react";
import { TaskInput } from "@/components/TaskInput";
import { ProgressIndicator } from "@/components/ProgressIndicator";
import { ScreenshotGallery } from "@/components/ScreenshotGallery";
import { ImageModal } from "@/components/ImageModal";
import { MetadataPanel } from "@/components/MetadataPanel";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { Screenshot, WorkflowResponse } from "@shared/schema";
import { Bot, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowResponse | null>(null);
  const [selectedScreenshot, setSelectedScreenshot] = useState<Screenshot | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Mock progress state for demonstration
  const [progress] = useState({
    currentStep: 3,
    totalSteps: 5,
    statusMessage: "Analyzing task and planning navigation steps...",
    steps: [
      { label: "Analyzing task with AI", status: "completed" as const },
      { label: "Planning navigation steps", status: "completed" as const },
      { label: "Launching browser automation", status: "in-progress" as const },
      { label: "Capturing UI screenshots", status: "pending" as const },
      { label: "Processing results", status: "pending" as const },
    ],
  });

  const handleTaskSubmit = async (question: string) => {
    setIsLoading(true);
    setError(null);
    setWorkflow(null);

    // TODO: This will be replaced with actual API call in integration phase
    console.log("Task submitted:", question);
    
    // Simulated delay for demonstration
    setTimeout(() => {
      setIsLoading(false);
    }, 2000);
  };

  const handleImageClick = (screenshot: Screenshot) => {
    setSelectedScreenshot(screenshot);
    setIsModalOpen(true);
  };

  const handleRetry = () => {
    setError(null);
    setWorkflow(null);
  };

  const handleNewCapture = () => {
    setWorkflow(null);
    setError(null);
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
        {!workflow && !error && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold">Capture Any Workflow</h2>
              <p className="text-muted-foreground">
                Describe the task you want to capture, and our AI will automatically navigate the application and screenshot each step of the workflow.
              </p>
            </div>
            <TaskInput onSubmit={handleTaskSubmit} isLoading={isLoading} />
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <ProgressIndicator
            currentStep={progress.currentStep}
            totalSteps={progress.totalSteps}
            statusMessage={progress.statusMessage}
            steps={progress.steps}
          />
        )}

        {/* Error State */}
        {error && <ErrorDisplay error={error} onRetry={handleRetry} />}

        {/* Results */}
        {workflow && !isLoading && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Workflow Captured Successfully</h2>
                <p className="text-muted-foreground mt-1">
                  {workflow.screenshots.length} steps captured in {(workflow.processingDuration / 1000).toFixed(1)}s
                </p>
              </div>
              <Button onClick={handleNewCapture} variant="outline" data-testid="button-new-capture">
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
