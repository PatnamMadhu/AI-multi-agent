import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Screenshot } from "@shared/schema";
import { Download, ExternalLink, Copy, Check } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface ScreenshotGalleryProps {
  screenshots: Screenshot[];
  onImageClick: (screenshot: Screenshot) => void;
}

export function ScreenshotGallery({
  screenshots,
  onImageClick,
}: ScreenshotGalleryProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopyDescription = async (description: string, index: number) => {
    await navigator.clipboard.writeText(description);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleDownload = (screenshot: Screenshot) => {
    const link = document.createElement("a");
    link.href = `data:image/png;base64,${screenshot.imageBase64}`;
    link.download = `step-${screenshot.stepNumber}-${Date.now()}.png`;
    link.click();
  };

  if (screenshots.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Captured Workflow</h2>
        <Badge variant="secondary" data-testid="badge-screenshot-count">
          {screenshots.length} {screenshots.length === 1 ? "Step" : "Steps"}
        </Badge>
      </div>

      <div className="space-y-6">
        {screenshots.map((screenshot, index) => (
          <Card
            key={index}
            className="overflow-hidden hover-elevate transition-all duration-300"
            data-testid={`card-screenshot-${index}`}
          >
            <div className="p-4 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Badge className="text-sm font-semibold">
                    Step {screenshot.stepNumber}
                  </Badge>
                  <h3 className="font-medium text-base">
                    {screenshot.description}
                  </h3>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleCopyDescription(screenshot.description, index)}
                    data-testid={`button-copy-${index}`}
                  >
                    {copiedIndex === index ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDownload(screenshot)}
                    data-testid={`button-download-${index}`}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div
                className={cn(
                  "relative rounded-md overflow-hidden border border-border",
                  "cursor-pointer group",
                )}
                onClick={() => onImageClick(screenshot)}
                data-testid={`image-screenshot-${index}`}
              >
                <img
                  src={`data:image/png;base64,${screenshot.imageBase64}`}
                  alt={screenshot.description}
                  className="w-full h-auto max-h-96 object-contain bg-muted"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-background/90 backdrop-blur-sm rounded-full p-3">
                      <ExternalLink className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span data-testid={`text-timestamp-${index}`}>
                  {new Date(screenshot.timestamp).toLocaleTimeString()}
                </span>
                {screenshot.url && (
                  <a
                    href={screenshot.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                    data-testid={`link-url-${index}`}
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span className="font-mono text-xs truncate max-w-xs">
                      {screenshot.url}
                    </span>
                  </a>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
