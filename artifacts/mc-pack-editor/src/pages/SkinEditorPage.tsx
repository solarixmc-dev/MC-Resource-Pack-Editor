import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { loadImageDataFromBuffer, imageDataToBuffer, applyBrush, pickColorAt, type EditorTool, applyRecolor } from "../lib/textureEditor";
import { hexToRgbColor, rgbToHexColor, isValidHexColor, applyRecolorToPixel } from "../lib/colorUtils";
import { Render } from "skin3d";

function arrayBufferToDataURL(buffer: ArrayBuffer): string {
  console.log("Converting buffer to data URL, buffer size:", buffer.byteLength);
  const bytes = new Uint8Array(buffer);
  console.log("First 10 bytes:", Array.from(bytes.slice(0, 10)));
  
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  
  const base64 = btoa(binary);
  console.log("Base64 length:", base64.length);
  const result = `data:image/png;base64,${base64}`;
  console.log("Final data URL length:", result.length);
  return result;
}

export default function SkinEditorPage() {
  const { theme } = useTheme();
  const darkMode = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const [skinData, setSkinData] = useState<ImageData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [tool, setTool] = useState<EditorTool>("pencil");
  const [color, setColor] = useState("#000000");
  const [hexInput, setHexInput] = useState("#000000");
  const [brushSize, setBrushSize] = useState(1);
  const [selectedPixels, setSelectedPixels] = useState<Set<string>>(new Set());
  const [recolorMode, setRecolorMode] = useState<"tint" | "hue-shift" | "colorize" | "multiply" | "overlay">("tint");
  const [recolorIntensity, setRecolorIntensity] = useState(0.6);
  const [activeLayer, setActiveLayer] = useState<"base" | "top" | "all">("all");
  const [hasChanges, setHasChanges] = useState(false);
  const [editHistory, setEditHistory] = useState<{ entries: ImageData[]; index: number }>({ entries: [], index: -1 });
  const editHistoryRef = useRef(editHistory);
  const isDrawingRef = useRef(false);
  const beforeDrawStateRef = useRef<ImageData | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasFrameRef = useRef<HTMLDivElement>(null);
  const [canvasScale, setCanvasScale] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewer3dRef = useRef<Render | null>(null);
  const canvas3dRef = useRef<HTMLCanvasElement>(null);
  const [viewMode, setViewMode] = useState<"3d" | "uv">("3d");
  const [skinUploaded, setSkinUploaded] = useState(false);

  useEffect(() => {
    editHistoryRef.current = editHistory;
  }, [editHistory]);

  useEffect(() => { setHexInput(color.toUpperCase()); }, [color]);

  const drawImage = useCallback(() => {
    const canvas = canvasRef.current;
    const imgData = skinData;
    if (!canvas || !imgData) return;
    try {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = imgData.width;
      canvas.height = imgData.height;
      ctx.putImageData(imgData, 0, 0);
      console.log("UV skin drawn successfully");
    } catch (error) {
      console.error("Error drawing image:", error);
    }
  }, [skinData]);

  useEffect(() => { drawImage(); }, [drawImage, viewMode]);

  // Initialize 3D viewer when skin is loaded and in 3D mode
  useEffect(() => {
    // Only process when in 3D mode
    if (viewMode !== "3d") {
      // Dispose viewer when switching away from 3D mode
      if (viewer3dRef.current) {
        try {
          viewer3dRef.current.dispose();
        } catch (e) {
          console.error("Error disposing viewer:", e);
        }
        viewer3dRef.current = null;
      }
      return;
    }

    if (!skinData || !canvas3dRef.current) return;

    // Clean up previous viewer
    if (viewer3dRef.current) {
      try {
        viewer3dRef.current.dispose();
      } catch (e) {
        console.error("Error disposing viewer:", e);
      }
      viewer3dRef.current = null;
    }

    // Create data URL from current skinData
    const buffer = imageDataToBuffer(skinData);
    const url = arrayBufferToDataURL(buffer);
    console.log("Skin data URL created from current skinData, length:", url.length);

    // Initialize viewer - wait for canvas to be fully ready
    const timer = setTimeout(() => {
      try {
        if (!canvas3dRef.current) {
          console.error("Canvas element not available");
          return;
        }

        console.log("Initializing viewer with canvas:", canvas3dRef.current);
        
        // First create the viewer without skin
        const viewer = new Render({
          canvas: canvas3dRef.current,
          width: 600,
          height: 700,
        });
        
        // Then load the skin separately
        viewer.loadSkin(url).then(() => {
          console.log("Skin loaded successfully in 3D viewer");
          viewer3dRef.current = viewer;
        }).catch((err) => {
          console.error("Error loading skin in 3D viewer:", err);
        });
        
      } catch (error) {
        console.error("Error initializing 3D viewer:", error);
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      if (viewer3dRef.current) {
        try {
          viewer3dRef.current.dispose();
        } catch (e) {
          console.error("Error disposing viewer:", e);
        }
        viewer3dRef.current = null;
      }
    };
  }, [skinData, viewMode]);

  const applyImageChange = useCallback((next: ImageData) => {
    setSkinData(next);
    setHasChanges(true);
    setEditHistory((previous) => {
      const entries = [...previous.entries.slice(0, previous.index + 1), next];
      if (entries.length > 50) {
        entries.shift();
      }
      return { entries, index: entries.length - 1 };
    });

    // Update 3D viewer with new skin
    if (viewer3dRef.current) {
      try {
        const buffer = imageDataToBuffer(next);
        const url = arrayBufferToDataURL(buffer);
        viewer3dRef.current.loadSkin(url);
      } catch (error) {
        console.error("Error updating 3D viewer:", error);
      }
    }
  }, []);

  const undoEdit = useCallback(() => {
    const current = editHistoryRef.current;
    if (current.index <= 0) return;
    const index = current.index - 1;
    setSkinData(current.entries[index]);
    setEditHistory((previous) => ({ ...previous, index }));
    setHasChanges(index > 0);
    console.log("Undo to index:", index, "Total entries:", current.entries.length);
  }, []);

  const redoEdit = useCallback(() => {
    const current = editHistoryRef.current;
    if (current.index >= current.entries.length - 1) return;
    const index = current.index + 1;
    setSkinData(current.entries[index]);
    setEditHistory((previous) => ({ ...previous, index }));
    console.log("Redo to index:", index, "Total entries:", current.entries.length);
  }, []);

  const canUndo = editHistory.index > 0;
  const canRedo = editHistory.index < editHistory.entries.length - 1;

  const rgbColor = useMemo(() => hexToRgbColor(color), [color]);
  const updateRgbColor = (channel: number, value: number) => {
    const next = [...rgbColor];
    next[channel] = value;
    setColor(rgbToHexColor(next[0], next[1], next[2]));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".png")) {
      alert("Please upload a PNG file");
      return;
    }

    console.log("Loading skin file:", file.name, file.size);
    setIsLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      console.log("Buffer loaded, size:", buffer.byteLength);
      
      if (buffer.byteLength < 100) {
        throw new Error("File is too small to be a valid image");
      }
      
      const imageData = await loadImageDataFromBuffer(buffer, file.name);
      console.log("ImageData loaded:", imageData.width, "x", imageData.height);
      
      if (!imageData || imageData.width === 0 || imageData.height === 0) {
        throw new Error("Failed to load image data");
      }
      
      setSkinData(imageData);
      setSkinUploaded(true);
      setEditHistory({ entries: [imageData], index: 0 });
      setHasChanges(false);
    } catch (error) {
      console.error("Error loading skin:", error);
      alert("Error loading skin file: " + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!skinData) return;
    const buffer = imageDataToBuffer(skinData);
    const url = arrayBufferToDataURL(buffer);
    const a = document.createElement("a");
    a.href = url;
    a.download = "skin.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const getLayerRegion = () => {
    if (!skinData) return undefined;
    if (activeLayer === "all") return undefined;
    const height = skinData.height;
    if (activeLayer === "base") {
      return { x: 0, y: 0, width: skinData.width, height: Math.floor(height / 2) };
    }
    if (activeLayer === "top") {
      return { x: 0, y: Math.floor(height / 2), width: skinData.width, height: Math.ceil(height / 2) };
    }
    return undefined;
  };

  const handleCanvasPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!skinData) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = skinData.width / rect.width;
    const scaleY = skinData.height / rect.height;
    const px = Math.floor((e.clientX - rect.left) * scaleX);
    const py = Math.floor((e.clientY - rect.top) * scaleY);

    if (px < 0 || py < 0 || px >= skinData.width || py >= skinData.height) return;

    const layerRegion = getLayerRegion();
    if (layerRegion) {
      if (px < layerRegion.x || px >= layerRegion.x + layerRegion.width ||
          py < layerRegion.y || py >= layerRegion.y + layerRegion.height) {
        return;
      }
    }

    if (tool === "eyedropper") {
      const colorValue = pickColorAt(skinData, px, py);
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
            if (next.has(pixelKey)) {
              next.delete(pixelKey);
            } else {
              next.add(pixelKey);
            }
          } else {
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
      if (skinData) {
        beforeDrawStateRef.current = new ImageData(new Uint8ClampedArray(skinData.data), skinData.width, skinData.height);
        isDrawingRef.current = true;
      }
    }

    if (e.type === "pointermove" && e.buttons === 1) {
      let next = skinData;
      if (tool === "pencil" || tool === "eraser") {
        next = applyBrush(skinData, px, py, color, brushSize, tool === "eraser" ? "eraser" : "pencil", layerRegion);
      }
      if (next !== skinData) {
        setSkinData(next);
      }
    }

    if (e.type === "pointerup") {
      e.currentTarget.releasePointerCapture(e.pointerId);
      if (isDrawingRef.current && beforeDrawStateRef.current && skinData) {
        const afterState = new ImageData(new Uint8ClampedArray(skinData.data), skinData.width, skinData.height);
        setEditHistory((previous) => {
          const entries = [...previous.entries.slice(0, previous.index + 1), beforeDrawStateRef.current!, afterState];
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
    if (!skinData) return;

    if (selectedPixels.size > 0) {
      const pixelArray = new Uint8ClampedArray(skinData.data);
      const width = skinData.width;

      for (const key of selectedPixels) {
        const [x, y] = key.split(',').map(Number);
        const idx = (y * width + x) * 4;
        const r = pixelArray[idx];
        const g = pixelArray[idx + 1];
        const b = pixelArray[idx + 2];

        const recolored = applyRecolorToPixel(r, g, b, { mode: recolorMode, color, intensity: recolorIntensity });
        pixelArray[idx] = recolored.r;
        pixelArray[idx + 1] = recolored.g;
        pixelArray[idx + 2] = recolored.b;
      }

      applyImageChange(new ImageData(pixelArray, skinData.width, skinData.height));
      setSelectedPixels(new Set());
    } else {
      applyImageChange(applyRecolor(skinData, { mode: recolorMode, color, intensity: recolorIntensity }));
    }
  };

  const clearPixelSelection = () => {
    setSelectedPixels(new Set());
  };

  useEffect(() => {
    const handleKeyboardShortcut = (event: KeyboardEvent) => {
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

  const tools = [
    { id: "pencil" as const, label: "Brush", icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><path d="M2 2l7.586 7.586" /><circle cx="11" cy="11" r="2" /></svg> },
    { id: "eraser" as const, label: "Eraser", icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 20H7L3 16C2 15 2 13 3 12L13 2L22 11L20 20Z" /><path d="M17 17L7 7" /><path d="M3 16L2 17" /><path d="M20 20L21 21" /></svg> },
    { id: "eyedropper" as const, label: "Eyedropper", icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 12l-7-7-3 3 7 7 3-3z" /><path d="M22 19l-2 2-3-3 2-2 3 3z" /><path d="M2 22l7-7" /><path d="M9 5l3 3" /><circle cx="16" cy="8" r="2" /></svg> },
    { id: "pixel-select" as const, label: "Select", icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 9h6v6H9z" /></svg> },
  ];

  return (
    <div className={`min-h-screen ${darkMode ? "bg-dark-bg" : "bg-gray-50"}`}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className={`text-3xl font-bold ${darkMode ? "text-dark-text" : "text-gray-900"}`}>Minecraft Skin Editor</h1>
          <p className={`mt-2 ${darkMode ? "text-dark-text-secondary" : "text-gray-600"}`}>Upload and edit your Minecraft skin (PNG)</p>
        </div>

        {!skinUploaded ? (
          <div className={`border-2 border-dashed rounded-lg p-12 text-center ${darkMode ? "border-dark-border" : "border-gray-300"}`}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".png"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className={`px-6 py-3 rounded-lg font-medium ${darkMode ? "bg-dark-text text-dark-bg hover:bg-gray-700" : "bg-black text-white hover:bg-gray-800"} disabled:opacity-50`}
            >
              {isLoading ? "Loading..." : "Upload Skin (.png)"}
            </button>
            <p className={`mt-4 ${darkMode ? "text-dark-text-secondary" : "text-gray-600"}`}>
              Supports PNG skin files
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Main Preview Area (3/4 of screen) */}
            <div className="lg:col-span-3">
              <div className={`rounded-lg border ${darkMode ? "border-dark-border bg-dark-secondary" : "border-gray-200 bg-white"} p-4`}>
                {/* Top Bar with View Toggle and Download */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setViewMode(viewMode === "3d" ? "uv" : "3d")}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        darkMode
                          ? "bg-dark-tertiary text-dark-text hover:bg-dark-border"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {viewMode === "3d" ? "UV Skin" : "3D Model"}
                    </button>
                  </div>
                  <button
                    onClick={handleDownload}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium ${darkMode ? "bg-dark-tertiary text-dark-text hover:bg-dark-border" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                  >
                    Download
                  </button>
                </div>

                {/* Content Area */}
                <div className="flex items-center justify-center overflow-auto" style={{ minHeight: "600px" }}>
                  {viewMode === "3d" ? (
                    <div className="flex items-center justify-center w-full h-full relative">
                      {/* 3D Grid Background */}
                      <div 
                        className="absolute inset-0 opacity-20"
                        style={{
                          backgroundImage: `
                            linear-gradient(${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} 1px, transparent 1px),
                            linear-gradient(90deg, ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} 1px, transparent 1px)
                          `,
                          backgroundSize: '20px 20px',
                        }}
                      />
                      <canvas
                        ref={canvas3dRef}
                        width={600}
                        height={700}
                        style={{ width: "100%", height: "auto", maxWidth: "100%", position: "relative", zIndex: 1 }}
                      />
                    </div>
                  ) : (
                    <div ref={canvasFrameRef} className="flex items-center justify-center w-full h-full bg-gray-100 dark:bg-dark-tertiary relative">
                      {/* Grid overlay for UV skin */}
                      <div 
                        className="absolute inset-0 pointer-events-none opacity-30"
                        style={{
                          backgroundImage: `
                            linear-gradient(${darkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'} 1px, transparent 1px),
                            linear-gradient(90deg, ${darkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'} 1px, transparent 1px)
                          `,
                          backgroundSize: '8px 8px',
                        }}
                      />
                      {skinData ? (
                        <canvas
                          ref={canvasRef}
                          onPointerDown={handleCanvasPointer}
                          onPointerMove={handleCanvasPointer}
                          onPointerUp={handleCanvasPointer}
                          onPointerLeave={handleCanvasPointer}
                          style={{
                            width: `${skinData.width * 8}px`,
                            height: `${skinData.height * 8}px`,
                            imageRendering: "pixelated",
                            cursor: tool === "eyedropper" ? "crosshair" : tool === "pixel-select" ? "crosshair" : "cell",
                            position: "relative",
                            zIndex: 1,
                          }}
                        />
                      ) : (
                        <div className={darkMode ? "text-dark-text-secondary" : "text-gray-600"}>
                          No skin loaded
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tools Panel (1/4 of screen) */}
            <div className="lg:col-span-1 space-y-4">
              {/* Upload */}
              <div className={`rounded-lg border ${darkMode ? "border-dark-border bg-dark-secondary" : "border-gray-200 bg-white"} p-4`}>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full px-3 py-2 rounded-lg text-sm font-medium ${darkMode ? "bg-dark-tertiary text-dark-text hover:bg-dark-border" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                >
                  Upload New Skin
                </button>
              </div>

              {/* Undo/Redo */}
              <div className={`rounded-lg border ${darkMode ? "border-dark-border bg-dark-secondary" : "border-gray-200 bg-white"} p-4`}>
                <div className="flex gap-2">
                  <button
                    onClick={undoEdit}
                    disabled={!canUndo}
                    className={`flex-1 px-2.5 py-2 rounded-lg text-lg ${darkMode ? "bg-dark-tertiary text-dark-text hover:bg-dark-border" : "bg-gray-100 text-gray-700 hover:bg-gray-200"} disabled:opacity-40`}
                    title="Undo (Ctrl+Z)"
                  >
                    ↶
                  </button>
                  <button
                    onClick={redoEdit}
                    disabled={!canRedo}
                    className={`flex-1 px-2.5 py-2 rounded-lg text-lg ${darkMode ? "bg-dark-tertiary text-dark-text hover:bg-dark-border" : "bg-gray-100 text-gray-700 hover:bg-gray-200"} disabled:opacity-40`}
                    title="Redo (Ctrl+Y)"
                  >
                    ↷
                  </button>
                </div>
              </div>
              {/* Layer Selection */}
              <div className={`rounded-lg border ${darkMode ? "border-dark-border bg-dark-secondary" : "border-gray-200 bg-white"} p-4`}>
                <h3 className={`text-sm font-semibold mb-3 ${darkMode ? "text-dark-text" : "text-gray-900"}`}>Layer</h3>
                <div className="space-y-2">
                  {(["all", "base", "top"] as const).map((layer) => (
                    <button
                      key={layer}
                      onClick={() => setActiveLayer(layer)}
                      className={`w-full px-3 py-2 rounded-lg text-sm capitalize transition-colors ${
                        activeLayer === layer
                          ? darkMode
                            ? "bg-dark-border text-dark-text"
                            : "bg-gray-200 text-gray-900"
                          : darkMode
                            ? "bg-dark-tertiary text-dark-text-secondary hover:bg-dark-border"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {layer === "all" ? "All Layers" : layer === "base" ? "Base Layer" : "Top Layer"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tools */}
              <div className={`rounded-lg border ${darkMode ? "border-dark-border bg-dark-secondary" : "border-gray-200 bg-white"} p-4`}>
                <h3 className={`text-sm font-semibold mb-3 ${darkMode ? "text-dark-text" : "text-gray-900"}`}>Tools</h3>
                <div className="grid grid-cols-2 gap-2">
                  {tools.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setTool(item.id)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                        tool === item.id
                          ? darkMode
                            ? "bg-dark-border text-dark-text"
                            : "bg-gray-200 text-gray-900"
                          : darkMode
                            ? "bg-dark-tertiary text-dark-text-secondary hover:bg-dark-border"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {item.icon}
                      <span className="text-xs">{item.label}</span>
                    </button>
                  ))}
                </div>

                {tool === "pixel-select" && selectedPixels.size > 0 && (
                  <button
                    onClick={clearPixelSelection}
                    className={`w-full mt-3 px-3 py-2 rounded-lg text-sm ${darkMode ? "bg-dark-tertiary text-dark-text-secondary hover:bg-dark-border" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                  >
                    Clear selection ({selectedPixels.size} pixels)
                  </button>
                )}
              </div>

              {/* Color Picker */}
              {(tool === "pencil" || tool === "pixel-select") && (
                <div className={`rounded-lg border ${darkMode ? "border-dark-border bg-dark-secondary" : "border-gray-200 bg-white"} p-4`}>
                  <h3 className={`text-sm font-semibold mb-3 ${darkMode ? "text-dark-text" : "text-gray-900"}`}>Color</h3>
                  <div className="flex items-center gap-3 mb-3">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="h-10 w-10 cursor-pointer rounded border border-gray-200 dark:border-dark-border bg-transparent p-1"
                    />
                    <input
                      type="text"
                      value={hexInput}
                      onChange={(e) => {
                        const value = e.target.value;
                        setHexInput(value);
                        if (isValidHexColor(value)) setColor(value);
                      }}
                      onBlur={() => setHexInput(color.toUpperCase())}
                      maxLength={7}
                      spellCheck={false}
                      className={`flex-1 rounded border px-2 py-1 text-sm ${darkMode ? "border-dark-border bg-dark-tertiary text-dark-text" : "border-gray-300 bg-white text-gray-900"}`}
                    />
                  </div>

                  {/* RGB Sliders */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs w-4">R</span>
                      <input
                        type="range"
                        min="0"
                        max="255"
                        value={rgbColor[0]}
                        onChange={(e) => updateRgbColor(0, parseInt(e.target.value))}
                        className="flex-1 h-2 rounded-lg appearance-none cursor-pointer bg-red-200"
                      />
                      <span className="text-xs w-8 text-right">{rgbColor[0]}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs w-4">G</span>
                      <input
                        type="range"
                        min="0"
                        max="255"
                        value={rgbColor[1]}
                        onChange={(e) => updateRgbColor(1, parseInt(e.target.value))}
                        className="flex-1 h-2 rounded-lg appearance-none cursor-pointer bg-green-200"
                      />
                      <span className="text-xs w-8 text-right">{rgbColor[1]}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs w-4">B</span>
                      <input
                        type="range"
                        min="0"
                        max="255"
                        value={rgbColor[2]}
                        onChange={(e) => updateRgbColor(2, parseInt(e.target.value))}
                        className="flex-1 h-2 rounded-lg appearance-none cursor-pointer bg-blue-200"
                      />
                      <span className="text-xs w-8 text-right">{rgbColor[2]}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Brush Size */}
              {(tool === "pencil" || tool === "eraser") && (
                <div className={`rounded-lg border ${darkMode ? "border-dark-border bg-dark-secondary" : "border-gray-200 bg-white"} p-4`}>
                  <h3 className={`text-sm font-semibold mb-3 ${darkMode ? "text-dark-text" : "text-gray-900"}`}>Brush Size</h3>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={brushSize}
                    onChange={(e) => setBrushSize(parseInt(e.target.value))}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 dark:bg-dark-tertiary"
                  />
                  <div className={`text-center text-sm mt-2 ${darkMode ? "text-dark-text-secondary" : "text-gray-600"}`}>{brushSize}px</div>
                </div>
              )}

              {/* Recolor Tool */}
              <div className={`rounded-lg border ${darkMode ? "border-dark-border bg-dark-secondary" : "border-gray-200 bg-white"} p-4`}>
                <h3 className={`text-sm font-semibold mb-3 ${darkMode ? "text-dark-text" : "text-gray-900"}`}>Recolor</h3>
                <div className="space-y-3">
                  <select
                    value={recolorMode}
                    onChange={(e) => setRecolorMode(e.target.value as any)}
                    className={`w-full rounded border px-2 py-1.5 text-sm ${darkMode ? "border-dark-border bg-dark-tertiary text-dark-text" : "border-gray-300 bg-white text-gray-900"}`}
                  >
                    <option value="tint">Tint</option>
                    <option value="hue-shift">Hue Shift</option>
                    <option value="colorize">Colorize</option>
                    <option value="multiply">Multiply</option>
                    <option value="overlay">Overlay</option>
                  </select>
                  <div>
                    <label className={`text-xs mb-1 block ${darkMode ? "text-dark-text-secondary" : "text-gray-600"}`}>Intensity</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={recolorIntensity}
                      onChange={(e) => setRecolorIntensity(parseFloat(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 dark:bg-dark-tertiary"
                    />
                  </div>
                  <button
                    onClick={handleApplyRecolor}
                    className={`w-full px-3 py-2 rounded-lg text-sm font-medium ${darkMode ? "bg-dark-border text-dark-text hover:bg-dark-tertiary" : "bg-gray-200 text-gray-900 hover:bg-gray-300"}`}
                  >
                    Apply Recolor
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
