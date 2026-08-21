import React, { useState, useRef, useEffect } from "react";
import { Btn } from "../common/Btn";

const CROP_DISPLAY = 300;

export interface ImageCropperProps {
  src: string;
  onCrop: (dataUrl: string) => void;
  onCancel: () => void;
}

export function ImageCropper({
  src,
  onCrop,
  onCancel,
}: ImageCropperProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState({ x: 25, y: 25, size: 250 });
  const [dragging, setDragging] = useState<"move" | "resize" | null>(null);
  const [origin, setOrigin] = useState({ mx: 0, my: 0, cx: 0, cy: 0, cs: 0 });

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onCancel]);

  const clampCrop = (c: { x: number; y: number; size: number }) => {
    const size = Math.max(20, Math.min(CROP_DISPLAY, c.size));
    const x = Math.max(0, Math.min(CROP_DISPLAY - size, c.x));
    const y = Math.max(0, Math.min(CROP_DISPLAY - size, c.y));
    return { x, y, size };
  };

  const startMove = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging("move");
    setOrigin({ mx: e.clientX, my: e.clientY, cx: crop.x, cy: crop.y, cs: crop.size });
  };

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging("resize");
    setOrigin({ mx: e.clientX, my: e.clientY, cx: crop.x, cy: crop.y, cs: crop.size });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    const dx = e.clientX - origin.mx;
    const dy = e.clientY - origin.my;
    if (dragging === "move") {
      setCrop(clampCrop({ x: origin.cx + dx, y: origin.cy + dy, size: origin.cs }));
    } else {
      const delta = Math.max(dx, dy);
      setCrop(clampCrop({ x: origin.cx, y: origin.cy, size: origin.cs + delta }));
    }
  };

  const handleApply = () => {
    const img = imgRef.current;
    if (!img) return;
    const scaleX = img.naturalWidth / CROP_DISPLAY;
    const scaleY = img.naturalHeight / CROP_DISPLAY;
    const canvas = document.createElement("canvas");
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, crop.x * scaleX, crop.y * scaleY, crop.size * scaleX, crop.size * scaleY, 0, 0, 128, 128);
    onCrop(canvas.toDataURL("image/png"));
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onMouseMove={onMouseMove}
      onMouseUp={() => setDragging(null)}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border flex-shrink-0">
          <span className="font-semibold text-sm">Crop Icon</span>
          <span className="text-xs text-muted-foreground">Drag box to move · corner handle to resize</span>
          <button onClick={onCancel} className="ml-auto text-muted-foreground hover:text-foreground text-lg leading-none">✕</button>
        </div>

        <div className="p-4">
          <div
            className="relative overflow-hidden rounded border border-border select-none"
            style={{ width: CROP_DISPLAY, height: CROP_DISPLAY, cursor: dragging === "move" ? "grabbing" : "default" }}
          >
            <img
              ref={imgRef}
              src={src}
              draggable={false}
              style={{ width: CROP_DISPLAY, height: CROP_DISPLAY, objectFit: "fill", display: "block", userSelect: "none" }}
            />
            {/* Crop box */}
            <div
              className="absolute border-2 border-white cursor-grab active:cursor-grabbing"
              style={{
                left: crop.x, top: crop.y, width: crop.size, height: crop.size,
                boxShadow: "0 0 0 2000px rgba(0,0,0,0.55)",
              }}
              onMouseDown={startMove}
            >
              {/* Corner markers */}
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-white pointer-events-none" />
              <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-white pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-white pointer-events-none" />
              {/* Resize handle (bottom-right) */}
              <div
                className="absolute bottom-0 right-0 w-5 h-5 bg-white cursor-se-resize flex items-center justify-center"
                style={{ borderRadius: "3px 0 0 0" }}
                onMouseDown={startResize}
              >
                <span className="text-[8px] text-black font-bold leading-none select-none">↘</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">Output will be cropped to a square (128 × 128 px)</p>
        </div>

        <div className="px-4 pb-4 flex items-center justify-end gap-2">
          <Btn variant="default" onClick={onCancel}>Cancel</Btn>
          <Btn variant="primary" onClick={handleApply}>Apply Crop</Btn>
        </div>
      </div>
    </div>
  );
}

export default ImageCropper;
