import { useState, useCallback, useRef, useMemo, useEffect, type PointerEvent } from "react";
import { Pack } from "../../types";
import { loadPackFromFile } from "../../lib/zipUtils";
import { getAtlasDefinition } from "../../lib/atlasRegions";
import {
  applyBrush,
  applyRecolor,
  imageDataToBuffer,
  loadImageDataFromBuffer,
  pickColorAt,
  type EditorTool,
  type RecolorMode,
  type RectRegion,
} from "../../lib/textureEditor";
import {
  isValidHexColor,
  hexToRgbColor,
  rgbToHexColor,
  applyRecolorToPixel,
} from "../../lib/colorUtils";

export interface TextureEditorModalProps {
  texturePath: string;
  displayName: string;
  folder: string;
  packs: Pack[];
  activePackId: string | null;
  onSave: (path: string, packId: string | null, buffer: ArrayBuffer) => void;
  onClose: () => void;
  darkMode: boolean;
  checkerboardStyle: 'light' | 'dark';
}

export function TextureEditorModal({
  texturePath,
  displayName,
  folder: _folder,
  packs,
  activePackId,
  onSave,
  onClose,
  darkMode,
  checkerboardStyle,
}: TextureEditorModalProps) {
  const isTextFile = /\.(json|mcmeta|txt|lang|properties|yml|yaml|toml|cfg|conf|ini)$/i.test(texturePath);
  
  const [tool, setTool] = useState<EditorTool>("pencil");
  const [color, setColor] = useState("#000000");
  const [hexInput, setHexInput] = useState("#000000");
  const [brushSize, setBrushSize] = useState(1);
  const [selectedPixels, setSelectedPixels] = useState<Set<string>>(new Set());
  const [recolorMode, setRecolorMode] = useState<RecolorMode>("tint");
  const [recolorIntensity, setRecolorIntensity] = useState(0.6);
  const [previousColor, setPreviousColor] = useState("#000000");
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [textContent, setTextContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [activeRegionId, setActiveRegionId] = useState<string>("whole");
  const [hasChanges, setHasChanges] = useState(false);
  const [editHistory, setEditHistory] = useState<{ entries: ImageData[]; index: number }>({ entries: [], index: -1 });
  const editHistoryRef = useRef(editHistory);
  useEffect(() => {
    editHistoryRef.current = editHistory;
  }, [editHistory]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasFrameRef = useRef<HTMLDivElement>(null);
  const isDrawingRef = useRef(false);
  const beforeDrawStateRef = useRef<ImageData | null>(null);
  const [canvasScale, setCanvasScale] = useState(1);
  const [overlayOpacity, setOverlayOpacity] = useState(0);
  const [defaultImageData, setDefaultImageData] = useState<ImageData | null>(null);

  const atlasDef = useMemo(() => getAtlasDefinition(texturePath), [texturePath]);
  const regionOptions = useMemo(() => {
    if (!atlasDef) return [];
    return [{ id: "whole", label: "Whole texture" }, ...atlasDef.regions.map((region) => ({ id: region.id, label: region.label }))];
  }, [atlasDef]);

  const drawImage = useCallback(() => {
    const canvas = canvasRef.current;
    const imgData = imageData;
    if (!canvas || !imgData) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = imgData.width;
    canvas.height = imgData.height;
    
    // Draw the current texture
    ctx.putImageData(imgData, 0, 0);
    
    // Draw default texture overlay if opacity > 0
    if (overlayOpacity > 0 && defaultImageData) {
      // Create a temporary canvas for blending
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = imgData.width;
      tempCanvas.height = imgData.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;
      
      // Put default image on temp canvas
      tempCtx.putImageData(defaultImageData, 0, 0);
      
      // Draw temp canvas onto main canvas with opacity
      ctx.globalAlpha = overlayOpacity;
      ctx.drawImage(tempCanvas, 0, 0);
      ctx.globalAlpha = 1.0;
    }
  }, [imageData, overlayOpacity, defaultImageData]);

  useEffect(() => {
    let cancelled = false;
    const pack = packs.find((entry) => entry.id === activePackId) ?? packs.find((entry) => entry.files.has(texturePath)) ?? null;
    const buffer = pack?.files.get(texturePath);
    if (!buffer) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    
    // Load default texture for comparison (non-blocking)
    if (!isTextFile) {
      fetch('/textures/default-pack.zip')
        .then(response => {
          if (!response.ok) throw new Error('Default pack not found');
          return response.arrayBuffer();
        })
        .then(async (arrayBuffer) => {
          if (cancelled) return;
          try {
            const defaultPack = await loadPackFromFile(new File([arrayBuffer], 'default-minecraft-pack.zip'));
            const defaultBuffer = defaultPack.files.get(texturePath);
            if (defaultBuffer) {
              const defaultImgData = await loadImageDataFromBuffer(defaultBuffer, texturePath);
              if (!cancelled) {
                setDefaultImageData(defaultImgData);
              }
            }
          } catch (error) {
            console.log('Default texture not available for comparison:', error);
          }
        })
        .catch(() => {
          console.log('Default pack not available for comparison');
        });
    }
    
    if (isTextFile) {
      // Handle text files
      const decoder = new TextDecoder();
      const text = decoder.decode(buffer);
      if (!cancelled) {
        setTextContent(text);
        setHasChanges(false);
      }
      setIsLoading(false);
    } else {
      // Handle image files
      loadImageDataFromBuffer(buffer, texturePath)
        .then((next) => {
          if (!cancelled) {
            setImageData(next);
            setHasChanges(false);
            setEditHistory({ entries: [next], index: 0 });
            setActiveRegionId("whole");
          }
        })
        .catch(() => {
          if (!cancelled) setIsLoading(false);
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    }
    return () => { cancelled = true; };
  }, [activePackId, packs, texturePath, isTextFile]);

  useEffect(() => { drawImage(); }, [drawImage]);
  useEffect(() => { setHexInput(color.toUpperCase()); }, [color]);

  // Scale texture to fit frame while keeping 1:1 pixel grid
  useEffect(() => {
    const frame = canvasFrameRef.current;
    if (!frame || !imageData) return;

    const updateScale = () => {
      // The frame has 12px padding on each side; exclude it from the fit size.
      const availableWidth = Math.max(1, frame.clientWidth - 24);
      const availableHeight = Math.max(1, frame.clientHeight - 24);
      const fitScale = Math.floor(Math.min(
        availableWidth / imageData.width,
        availableHeight / imageData.height,
      ));
      setCanvasScale(Math.max(1, fitScale));
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [imageData?.width, imageData?.height]);

  const selectedRegion = useMemo(() => {
    if (!atlasDef || activeRegionId === "whole") return undefined;
    return atlasDef.regions.find((region) => region.id === activeRegionId);
  }, [activeRegionId, atlasDef]);

  const rectRegion = useMemo<RectRegion | undefined>(() => {
    if (!selectedRegion) return undefined;
    return { x: selectedRegion.x, y: selectedRegion.y, width: selectedRegion.w, height: selectedRegion.h };
  }, [selectedRegion]);

  const applyImageChange = useCallback((next: ImageData) => {
    setImageData(next);
    setHasChanges(true);
    setEditHistory((previous) => {
      const entries = [...previous.entries.slice(0, previous.index + 1), next];
      // Limit history to 50 entries to prevent memory issues
      if (entries.length > 50) {
        entries.shift();
      }
      return { entries, index: entries.length - 1 };
    });
  }, []);

  const handleColorChange = useCallback((newColor: string) => {
    setColor(newColor);
    setPreviousColor(color);
  }, [color]);

  const undoEdit = useCallback(() => {
    const current = editHistoryRef.current;
    if (current.index <= 0) return;
    const index = current.index - 1;
    setImageData(current.entries[index]);
    setEditHistory((previous) => ({ ...previous, index }));
    setHasChanges(index > 0);
  }, []);

  const redoEdit = useCallback(() => {
    const current = editHistoryRef.current;
    if (current.index >= current.entries.length - 1) return;
    const index = current.index + 1;
    setImageData(current.entries[index]);
    setEditHistory((previous) => ({ ...previous, index }));
    setHasChanges(true);
  }, []);

  useEffect(() => {
    const handleKeyboardShortcut = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;

      const key = event.key.toLowerCase();
      if (key === "z") {
        event.preventDefault();
        if (event.shiftKey) redoEdit();
        else undoEdit();
      } else if (key === "y") {
        event.preventDefault();
        redoEdit();
      }
    };

    window.addEventListener("keydown", handleKeyboardShortcut, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyboardShortcut, { capture: true });
  }, [undoEdit, redoEdit]);

  const canUndo = editHistory.index > 0;
  const canRedo = editHistory.index < editHistory.entries.length - 1;

  const rgbColor = useMemo(() => hexToRgbColor(color), [color]);
  const updateRgbColor = (channel: number, value: number) => {
    const next = [...rgbColor];
    next[channel] = value;
    const newColor = rgbToHexColor(next[0], next[1], next[2]);
    setColor(newColor);
    setHexInput(newColor.toUpperCase());
  };
  
  const getRgbGradient = (channel: number, _rgb: [number, number, number]) => {
    if (channel === 0) return `linear-gradient(to right, rgb(100, 0, 0), rgb(255, 0, 0))`;
    if (channel === 1) return `linear-gradient(to right, rgb(0, 100, 0), rgb(0, 255, 0))`;
    return `linear-gradient(to right, rgb(0, 0, 100), rgb(0, 0, 255))`;
  };

  const handleCanvasPointer = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!imageData) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = imageData.width / rect.width;
    const scaleY = imageData.height / rect.height;
    const px = Math.floor((e.clientX - rect.left) * scaleX);
    const py = Math.floor((e.clientY - rect.top) * scaleY);
    if (px < 0 || py < 0 || px >= imageData.width || py >= imageData.height) return;

    if (tool === "eyedropper") {
      const colorValue = pickColorAt(imageData, px, py);
      setColor(colorValue);
      setTool("pencil");
      return;
    }

    if (tool === "pixel-select") {
      if (e.type === "pointerdown") {
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      
      if (e.type === "pointerdown" || (e.type === "pointermove" && e.buttons === 1)) {
        const pixelKey = `${px},${py}`;
        setSelectedPixels(prev => {
          const next = new Set(prev);
          if (e.ctrlKey || e.metaKey) {
            // Toggle individual pixel
            if (next.has(pixelKey)) {
              next.delete(pixelKey);
            } else {
              next.add(pixelKey);
            }
          } else {
            // Add pixel to selection
            next.add(pixelKey);
          }
          return next;
        });
      }

      if (e.type === "pointerup") {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      return;
    }

    if (e.type === "pointerdown") {
      e.currentTarget.setPointerCapture(e.pointerId);
      // Save state before starting to draw (store in ref, not history)
      if (imageData) {
        beforeDrawStateRef.current = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
        isDrawingRef.current = true;
      }
    }

    if (e.type === "pointermove" && e.buttons === 1) {
      let next = imageData;
      if (tool === "pencil" || tool === "eraser") {
        next = applyBrush(imageData, px, py, color, brushSize, tool === "eraser" ? "eraser" : "pencil", rectRegion);
      }
      if (next !== imageData) {
        setImageData(next); // Update visual without adding to history
      }
    }

    if (e.type === "pointerup") {
      e.currentTarget.releasePointerCapture(e.pointerId);
      // Save both before and after states on pointer up (single stroke = one history entry)
      if (isDrawingRef.current && beforeDrawStateRef.current && imageData) {
        const afterState = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
        setEditHistory((previous) => {
          const entries = [...previous.entries.slice(0, previous.index + 1), beforeDrawStateRef.current!, afterState];
          // Limit history to 50 entries to prevent memory issues
          if (entries.length > 50) {
            entries.shift();
          }
          return { entries, index: entries.length - 1 };
        });
        setHasChanges(true);
      }
      isDrawingRef.current = false;
      beforeDrawStateRef.current = null;
    }
  };

  const handleApplyRecolor = () => {
    if (!imageData) return;
    
    if (selectedPixels.size > 0) {
      // Apply recolor only to selected pixels
      const pixelArray = new Uint8ClampedArray(imageData.data);
      const width = imageData.width;
      
      for (const key of selectedPixels) {
        const [x, y] = key.split(',').map(Number);
        const idx = (y * width + x) * 4;
        const r = pixelArray[idx];
        const g = pixelArray[idx + 1];
        const b = pixelArray[idx + 2];
        
        // Apply recolor to individual pixel
        const recolored = applyRecolorToPixel(r, g, b, { mode: recolorMode, color, intensity: recolorIntensity });
        pixelArray[idx] = recolored.r;
        pixelArray[idx + 1] = recolored.g;
        pixelArray[idx + 2] = recolored.b;
      }
      
      applyImageChange(new ImageData(pixelArray, imageData.width, imageData.height));
      clearPixelSelection();
    } else {
      // Apply recolor to entire texture
      applyImageChange(applyRecolor(imageData, { mode: recolorMode, color, intensity: recolorIntensity }));
    }
  };
  
  const clearPixelSelection = () => {
    setSelectedPixels(new Set());
  };

  const handleSave = async () => {
    if (isTextFile) {
      const encoder = new TextEncoder();
      const buffer = encoder.encode(textContent).buffer;
      onSave(texturePath, activePackId, buffer);
    } else {
      if (!imageData) return;
      const buffer = await imageDataToBuffer(imageData);
      onSave(texturePath, activePackId, buffer);
    }
  };

  const canEdit = !isLoading && (isTextFile ? textContent !== "" : imageData);

  return (
    <div className={`fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm ${darkMode ? "dark" : ""}`} onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-dark-border dark:bg-dark-bg shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-dark-border px-4 py-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-dark-text">{displayName}</h3>
          </div>
          <div className="flex items-center gap-2">
            {!isTextFile && (
              <>
                <button type="button" className="rounded-lg border border-slate-200 dark:border-dark-border bg-slate-100 dark:bg-dark-secondary px-2.5 py-1.5 text-lg leading-none text-slate-700 dark:text-dark-text-secondary transition-colors hover:bg-slate-200 dark:hover:bg-dark-tertiary disabled:cursor-not-allowed disabled:opacity-40" onClick={undoEdit} disabled={!canUndo} title="Undo (Ctrl/Cmd+Z)" aria-label="Undo">↶</button>
                <button type="button" className="rounded-lg border border-slate-200 dark:border-dark-border bg-slate-100 dark:bg-dark-secondary px-2.5 py-1.5 text-lg leading-none text-slate-700 dark:text-dark-text-secondary transition-colors hover:bg-slate-200 dark:hover:bg-dark-tertiary disabled:cursor-not-allowed disabled:opacity-40" onClick={redoEdit} disabled={!canRedo} title="Redo (Ctrl/Cmd+Y)" aria-label="Redo">↷</button>
              </>
            )}
            <button onClick={onClose} className="rounded-full border border-slate-200 dark:border-dark-border bg-slate-100 dark:bg-dark-secondary px-2.5 py-1 text-sm text-slate-700 dark:text-dark-text-secondary hover:bg-slate-200 dark:hover:bg-dark-tertiary">✕</button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 rounded-lg border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-secondary p-3">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {!isTextFile && atlasDef && (
                  <select value={activeRegionId} onChange={(e) => setActiveRegionId(e.target.value)} className="rounded border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-tertiary px-2 py-1 text-sm text-slate-700 dark:text-dark-text-secondary">
                    {regionOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </select>
                )}
                {!isTextFile && imageData && (
                  <span className="text-xs text-slate-500 dark:text-dark-text-tertiary">
                    {imageData.width}x{imageData.height}
                  </span>
                )}
              </div>
              {!isTextFile && defaultImageData && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-600 dark:text-dark-text-secondary">Default overlay:</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={overlayOpacity * 100}
                    onChange={(e) => setOverlayOpacity(Number(e.target.value) / 100)}
                    className="w-24 h-1 bg-slate-200 dark:bg-dark-border rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-xs text-slate-600 dark:text-dark-text-secondary w-8">{Math.round(overlayOpacity * 100)}%</span>
                </div>
              )}
            </div>
            <div
              ref={canvasFrameRef}
              className="flex h-[clamp(20rem,58vh,39rem)] min-h-[20rem] items-center justify-center overflow-auto rounded-lg border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-secondary p-3"
              style={{
                overflow: 'auto',
                maxWidth: '100%',
                maxHeight: '100%'
              }}
            >
              {isLoading ? (
                <div className="flex h-80 items-center justify-center text-sm text-slate-500 dark:text-dark-text-tertiary">Loading {isTextFile ? "text" : "texture"}…</div>
              ) : isTextFile ? (
                <textarea
                  value={textContent}
                  onChange={(e) => {
                    setTextContent(e.target.value);
                    setHasChanges(true);
                  }}
                  className="w-full h-full rounded-lg border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-tertiary p-3 font-mono text-sm text-slate-900 dark:text-dark-text-secondary focus:outline-none focus:ring-1 focus:ring-slate-300 dark:focus:ring-dark-border resize-none"
                  spellCheck={false}
                />
              ) : canEdit ? (
                <div 
                  className={`${checkerboardStyle === 'dark' ? "checkered-dark" : "checkered-light"} relative inline-block rounded-lg border border-slate-200 dark:border-dark-border`}
                  style={{
                    backgroundSize: `${canvasScale * 2}px ${canvasScale * 2}px`,
                    backgroundPosition: `0 0, 0 ${canvasScale}px, ${canvasScale}px -${canvasScale}px, -${canvasScale}px 0px`
                  }}
                >
                  <canvas
                    ref={canvasRef}
                    className="mx-auto block"
                    style={{
                      width: `${imageData?.width ? imageData.width * canvasScale : 0}px`,
                      height: `${imageData?.height ? imageData.height * canvasScale : 0}px`,
                      imageRendering: "pixelated",
                      cursor: tool === "eyedropper" ? "crosshair" : tool === "pixel-select" ? "crosshair" : "cell",
                    }}
                    onPointerDown={handleCanvasPointer}
                    onPointerMove={(e) => {
                      if (!imageData || e.buttons !== 1) return;
                      handleCanvasPointer(e);
                    }}
                    onPointerUp={(e) => e.currentTarget.releasePointerCapture(e.pointerId)}
                  />
                  {selectedRegion && (
                    <div
                      className="pointer-events-none absolute border-2 border-amber-400 bg-amber-300/20"
                      style={{
                        left: `${4 + selectedRegion.x * canvasScale}px`,
                        top: `${4 + selectedRegion.y * canvasScale}px`,
                        width: `${selectedRegion.w * canvasScale}px`,
                        height: `${selectedRegion.h * canvasScale}px`,
                      }}
                      title="Atlas region"
                    />
                  )}
                  {selectedPixels.size > 0 && (
                    <div className="pointer-events-none absolute inset-0">
                      {Array.from(selectedPixels).map(key => {
                        const [x, y] = key.split(',').map(Number);
                        return (
                          <div
                            key={key}
                            className="absolute bg-blue-500/50"
                            style={{
                              left: `${4 + x * canvasScale}px`,
                              top: `${4 + y * canvasScale}px`,
                              width: `${canvasScale}px`,
                              height: `${canvasScale}px`,
                            }}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex h-80 items-center justify-center text-sm text-slate-500 dark:text-dark-text-tertiary">This {isTextFile ? "text" : "texture"} could not be loaded for editing.</div>
              )}
            </div>
          </div>

          {!isTextFile && (
            <div className="w-full rounded-lg border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-secondary p-4 space-y-4">
              <div className="flex gap-2">
                {[
                  { id: "pencil", label: "Brush", icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><path d="M2 2l7.586 7.586" /><circle cx="11" cy="11" r="2" /></svg> },
                  { id: "eraser", label: "Eraser", icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 20H7L3 16C2 15 2 13 3 12L13 2L22 11L20 20Z" /><path d="M17 17L7 7" /><path d="M3 16L2 17" /><path d="M20 20L21 21" /></svg> },
                  { id: "eyedropper", label: "Eyedropper", icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 12l-7-7-3 3 7 7 3-3z" /><path d="M22 19l-2 2-3-3 2-2 3 3z" /><path d="M2 22l7-7" /><path d="M9 5l3 3" /><circle cx="16" cy="8" r="2" /></svg> },
                  { id: "pixel-select", label: "Select", icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 9h6v6H9z" /></svg> },
                ].map((item) => (
                  <button
                    key={item.id}
                    className={`flex-1 flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-sm transition-all ${tool === item.id ? "border-slate-400 bg-slate-200 text-slate-900 dark:border-dark-border dark:bg-dark-tertiary dark:text-dark-text" : "border-slate-200 dark:border-dark-border bg-white dark:bg-dark-secondary text-slate-700 dark:text-dark-text-secondary hover:bg-slate-100 dark:hover:bg-dark-tertiary"}`}
                    onClick={() => setTool(item.id as EditorTool)}
                  >
                    <span className="text-lg flex items-center justify-center">{item.icon}</span>
                    <span className="text-xs font-medium">{item.label}</span>
                  </button>
                ))}
              </div>

              {tool === "pixel-select" && selectedPixels.size > 0 && (
                <button
                  onClick={clearPixelSelection}
                  className="w-full rounded-lg border border-slate-200 dark:border-dark-border bg-slate-100 dark:bg-dark-tertiary px-3 py-2 text-sm text-slate-700 dark:text-dark-text-secondary hover:bg-slate-200 dark:hover:bg-dark-border"
                >
                  Clear selection ({selectedPixels.size} pixels)
                </button>
              )}

              <div className="rounded-lg border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-tertiary p-3">
                <div className="flex items-center gap-3 mb-3">
                  <input type="color" value={color} onChange={(e) => handleColorChange(e.target.value)} className="h-10 w-10 cursor-pointer rounded border border-slate-200 dark:border-dark-border bg-transparent p-1" aria-label="Color picker" />
                  <input
                    type="text"
                    value={hexInput}
                    onChange={(e) => { const value = e.target.value; setHexInput(value); if (isValidHexColor(value)) setColor(value); }}
                    onBlur={() => setHexInput(color.toUpperCase())}
                    maxLength={7}
                    spellCheck={false}
                    className="flex-1 rounded border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-secondary px-2 py-1.5 font-mono text-sm text-slate-900 dark:text-dark-text-secondary"
                    aria-label="Hex color code"
                  />
                </div>
                <div className="space-y-2">
                  {(["Red", "Green", "Blue"] as const).map((label, index) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className="text-xs text-slate-600 dark:text-dark-text-tertiary w-3">{label[0]}</span>
                      <input
                        type="range"
                        min="0"
                        max="255"
                        value={rgbColor[index]}
                        onChange={(e) => updateRgbColor(index, Number(e.target.value))}
                        aria-label={`${label} value`}
                        className="flex-1 h-1 appearance-none cursor-pointer"
                        style={{ background: getRgbGradient(index, rgbColor) }}
                      />
                      <span className="text-xs text-slate-600 dark:text-dark-text-tertiary w-6 text-right font-mono">{rgbColor[index]}</span>
                    </div>
                  ))}
                </div>
              </div>

              {tool !== "pixel-select" && (
                <div className="rounded-lg border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-tertiary p-3">
                  <label className="text-xs font-medium text-slate-700 dark:text-dark-text-secondary">Brush size: {brushSize}px</label>
                  <input type="range" min="1" max="24" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="mt-2 w-full" />
                </div>
              )}

              <div className="rounded-lg border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-tertiary p-3">
                <label className="text-xs font-medium text-slate-700 dark:text-dark-text-secondary">Recolor mode</label>
                <select value={recolorMode} onChange={(e) => setRecolorMode(e.target.value as RecolorMode)} className="mt-2 w-full rounded border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-secondary px-2 py-1 text-sm text-slate-900 dark:text-dark-text-secondary">
                  <option value="tint">Tint</option>
                  <option value="hue-shift">Hue shift</option>
                  <option value="colorize">Colorize</option>
                  <option value="multiply">Multiply</option>
                  <option value="overlay">Overlay</option>
                </select>
                <label className="mt-3 text-xs font-medium text-slate-700 dark:text-dark-text-secondary">Intensity: {recolorIntensity.toFixed(2)}</label>
                <input type="range" min="0" max="1" step="0.01" value={recolorIntensity} onChange={(e) => setRecolorIntensity(Number(e.target.value))} className="mt-2 w-full" />
                <button className="mt-3 w-full rounded-lg border border-slate-200 dark:border-dark-border bg-slate-100 dark:bg-dark-tertiary px-3 py-2 text-sm font-medium text-slate-700 dark:text-dark-text-secondary hover:bg-slate-200 dark:hover:bg-dark-border" onClick={handleApplyRecolor}>
                  {selectedPixels.size > 0 ? `Apply to ${selectedPixels.size} pixels` : "Apply to entire texture"}
                </button>
              </div>

              <div className="flex gap-2">
                <button className="flex-1 rounded-lg border border-slate-200 dark:border-dark-border bg-slate-100 dark:bg-dark-tertiary px-3 py-2 text-sm font-medium text-slate-700 dark:text-dark-text-secondary hover:bg-slate-200 dark:hover:bg-dark-border" onClick={onClose}>Cancel</button>
                <button className="flex-1 rounded-lg bg-slate-900 dark:bg-dark-text px-3 py-2 text-sm font-semibold text-white dark:text-dark-bg hover:bg-slate-800 dark:hover:bg-dark-tertiary" onClick={handleSave}>Save</button>
              </div>
            </div>
          )}

          {isTextFile && (
            <div className="w-full rounded-[24px] border-2 border-border bg-white dark:bg-dark-bg p-4">
              <p className="text-sm font-semibold text-foreground">Text File Info</p>
              <div className="mt-3 text-xs text-muted-foreground">
                <p>This is a text file that can be edited directly in the editor above.</p>
                <p className="mt-2">Changes will be saved back to the selected pack on export.</p>
              </div>

              <div className="mt-4 flex items-center justify-between rounded-2xl border-2 border-border bg-white dark:bg-dark-bg px-3 py-2 text-sm text-muted-foreground">
                <span>{hasChanges ? "Unsaved changes" : "No changes yet"}</span>
              </div>

              <div className="mt-4 flex gap-2">
                <button className="flex-1 rounded-xl border border-border bg-secondary px-3 py-2 text-sm font-medium text-foreground hover:bg-accent" onClick={onClose}>Cancel</button>
                <button className="flex-1 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90" onClick={handleSave}>Save</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TextureEditorModal;
