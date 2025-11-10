import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Screenshot } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

interface ImageModalProps {
  screenshot: Screenshot | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ImageModal({ screenshot, isOpen, onClose }: ImageModalProps) {
  if (!screenshot) return null;

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = `data:image/png;base64,${screenshot.imageBase64}`;
    link.download = `step-${screenshot.stepNumber}-${Date.now()}.png`;
    link.click();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto" data-testid="modal-image">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <DialogTitle className="text-xl">
              Step {screenshot.stepNumber}: {screenshot.description}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="ghost"
                onClick={handleDownload}
                data-testid="button-modal-download"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="mt-4">
          <img
            src={`data:image/png;base64,${screenshot.imageBase64}`}
            alt={screenshot.description}
            className="w-full h-auto rounded-md border border-border"
            data-testid="image-modal-full"
          />
        </div>
        {screenshot.url && (
          <div className="mt-2 text-sm text-muted-foreground">
            <span className="font-medium">URL:</span>{" "}
            <a
              href={screenshot.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono hover:text-foreground transition-colors"
            >
              {screenshot.url}
            </a>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
