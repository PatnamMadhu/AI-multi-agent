import { useEffect, useRef } from "react";
import { Screenshot } from "@shared/schema";

interface AnnotatedScreenshotProps {
  screenshot: Screenshot;
  className?: string;
  onClick?: () => void;
  "data-testid"?: string;
}

/**
 * Renders a screenshot with bounding box annotations overlaid using Canvas
 */
export function AnnotatedScreenshot({
  screenshot,
  className = "",
  onClick,
  "data-testid": testId,
}: AnnotatedScreenshotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !imgRef.current || !screenshot.annotations) {
      return;
    }

    const canvas = canvasRef.current;
    const img = imgRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    // Function to draw annotations scaled to current display size
    const drawAnnotations = () => {
      // Skip if image hasn't loaded yet
      if (!img.complete || img.naturalWidth === 0) return;

      // Get the rendered (displayed) size of the image
      const rect = img.getBoundingClientRect();
      const displayWidth = rect.width;
      const displayHeight = rect.height;

      // Skip if dimensions are zero (image not visible)
      if (displayWidth === 0 || displayHeight === 0) return;

      // Account for device pixel ratio for crisp rendering on HiDPI displays
      const dpr = window.devicePixelRatio || 1;

      // Set canvas internal resolution to match displayed size * DPR
      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;

      // Reset transform to identity matrix before scaling (prevents compounding)
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      
      // Scale context by DPR so drawing coordinates match CSS pixels
      ctx.scale(dpr, dpr);

      // Calculate scale factors from natural to displayed size
      const scaleX = displayWidth / img.naturalWidth;
      const scaleY = displayHeight / img.naturalHeight;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw each bounding box annotation (scaled to displayed size)
      screenshot.annotations?.forEach((annotation) => {
        // Scale coordinates and dimensions
        const x = annotation.x * scaleX;
        const y = annotation.y * scaleY;
        const width = annotation.width * scaleX;
        const height = annotation.height * scaleY;

        // Semi-transparent fill
        ctx.fillStyle = "rgba(59, 130, 246, 0.2)"; // blue-500 with 20% opacity
        ctx.fillRect(x, y, width, height);

        // Solid border
        ctx.strokeStyle = "rgba(59, 130, 246, 0.8)"; // blue-500 with 80% opacity
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, width, height);

        // Optional: Draw label
        if (annotation.label) {
          ctx.fillStyle = "rgba(59, 130, 246, 0.9)";
          ctx.font = "bold 14px Inter, sans-serif";
          
          // Draw label background
          const labelText = annotation.label.toUpperCase();
          const textMetrics = ctx.measureText(labelText);
          const labelPadding = 4;
          const labelX = x;
          const labelY = y - 6;
          
          ctx.fillRect(
            labelX,
            labelY - 16,
            textMetrics.width + labelPadding * 2,
            20
          );

          // Draw label text
          ctx.fillStyle = "white";
          ctx.fillText(labelText, labelX + labelPadding, labelY);
        }
      });
    };

    // Draw when image loads
    if (img.complete) {
      drawAnnotations();
    } else {
      img.addEventListener("load", drawAnnotations);
    }

    // Use ResizeObserver to track image size changes reliably
    const resizeObserver = new ResizeObserver(() => {
      drawAnnotations();
    });
    
    resizeObserver.observe(img);

    // Cleanup
    return () => {
      img.removeEventListener("load", drawAnnotations);
      resizeObserver.disconnect();
    };
  }, [screenshot]);

  return (
    <div className="relative block w-full" onClick={onClick} data-testid={testId}>
      <img
        ref={imgRef}
        src={`data:image/png;base64,${screenshot.imageBase64}`}
        alt={screenshot.description}
        className={className}
      />
      {screenshot.annotations && screenshot.annotations.length > 0 && (
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
          style={{ mixBlendMode: "normal" }}
        />
      )}
    </div>
  );
}
