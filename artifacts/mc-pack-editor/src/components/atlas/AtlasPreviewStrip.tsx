import { useState, useRef, useEffect, useCallback } from "react";
import { Pack } from "../../types";
import { CroppedTexturePreview } from "../explorer/CroppedTexturePreview";

export interface AtlasPreviewStripProps {
  packsWithFile: Pack[];
  texturePath: string;
  effectivePackId: string | null | undefined;
  overridePackId: string | null | undefined;
  composedPreviewUrl: string | null;
  displayName: string;
  onOverride: (path: string, packId: string | null) => void;
  onAtlasZoom?: (url: string, displayName: string) => void;
  stripColorCodes: (name: string) => string;
}

export function AtlasPreviewStrip({
  packsWithFile,
  texturePath,
  effectivePackId,
  overridePackId,
  composedPreviewUrl,
  displayName,
  onOverride,
  onAtlasZoom,
  stripColorCodes,
}: AtlasPreviewStripProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollButtons = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateScrollButtons();
    const el = stripRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollButtons, { passive: true });
    const observer = new ResizeObserver(updateScrollButtons);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollButtons);
      observer.disconnect();
    };
  }, [composedPreviewUrl, packsWithFile.length, updateScrollButtons]);

  const scrollStrip = (direction: "left" | "right") => {
    stripRef.current?.scrollBy({ left: direction === "left" ? -220 : 220, behavior: "smooth" });
  };

  return (
    <div className="relative flex-shrink-0">
      {canScrollLeft && (
        <button
          type="button"
          className="absolute left-0 top-[calc(50%-0.75rem)] z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/95 text-lg leading-none text-foreground shadow-md transition-colors hover:bg-accent"
          onClick={() => scrollStrip("left")}
          aria-label="Scroll previews left"
        >
          ‹
        </button>
      )}
      {canScrollRight && (
        <button
          type="button"
          className="absolute right-0 top-[calc(50%-0.75rem)] z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/95 text-lg leading-none text-foreground shadow-md transition-colors hover:bg-accent"
          onClick={() => scrollStrip("right")}
          aria-label="Scroll previews right"
        >
          ›
        </button>
      )}
      <div
        ref={stripRef}
        className={`flex items-start gap-3 overflow-x-hidden scroll-smooth ${canScrollLeft ? "pl-9" : ""} ${canScrollRight ? "pr-9" : ""}`}
      >
        {packsWithFile.map((pack) => {
          const buf = pack.files.get(texturePath)!;
          const isSelected = effectivePackId === pack.id || (!effectivePackId && pack === packsWithFile[0]);
          return (
            <div key={pack.id} className="flex w-[220px] flex-shrink-0 flex-col items-center gap-2">
              <button
                type="button"
                className={`checkered rounded-lg p-3 border-2 transition-all ${isSelected ? "border-primary" : "border-transparent hover:border-border"} ${packsWithFile.length > 1 ? "cursor-pointer" : "cursor-default"}`}
                onClick={() => {
                  if (packsWithFile.length <= 1) return;
                  onOverride(texturePath, overridePackId === pack.id ? null : pack.id);
                }}
                title={stripColorCodes(pack.name)}
              >
                <CroppedTexturePreview buffer={buf} path={texturePath} alt={stripColorCodes(pack.name)} size={196} />
              </button>
              <div className="flex items-center gap-1.5">
                <span className="max-w-[200px] truncate text-xs text-muted-foreground">{stripColorCodes(pack.name)}</span>
                {isSelected && <span className="text-xs font-bold text-primary">✓</span>}
              </div>
            </div>
          );
        })}
        {composedPreviewUrl && (
          <div className="flex w-[184px] flex-shrink-0 flex-col items-center gap-2">
            <div className="flex flex-col gap-2 rounded-xl border border-border bg-secondary/30 p-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">New atlas preview</div>
              <button
                className="cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => onAtlasZoom && onAtlasZoom(composedPreviewUrl, displayName)}
                title="Click to zoom atlas preview"
              >
                <img
                  src={composedPreviewUrl}
                  alt="Preview of the atlas after region overrides"
                  className={`h-44 w-44 checkered`}
                  style={{ imageRendering: "pixelated" }}
                />
              </button>
              <button
                className="text-xs px-3 py-1.5 rounded bg-primary/20 text-primary font-semibold hover:bg-primary/30 transition-colors w-full"
                onClick={() => onAtlasZoom && onAtlasZoom(composedPreviewUrl, displayName)}
                title="Zoom atlas preview"
              >
                Zoom Atlas
              </button>
            </div>
            <p className="max-w-[184px] text-center text-xs text-muted-foreground">Live composite preview</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default AtlasPreviewStrip;
