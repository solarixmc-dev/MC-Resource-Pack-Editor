import { useState, useCallback, useRef, useMemo, useEffect, type DragEvent, type PointerEvent } from "react";
import { Pack, MC_FOLDERS, TextureOverrides, FolderSources, LayoutMode } from "./types";
import { analyzePackBundle, PackAnalysis } from "./lib/packAnalyzer";
import {
  loadPackFromFile,
  getTexturesForFolder,
  getAllFoldersInPacks,
  getAllTexturePathsInFolder,
  getTextureFolder,
  arrayBufferToDataURL,
  isImagePath,
  exportMergedPack,
  composeAtlas,
  cropAtlasRegion,
} from "./lib/zipUtils";
import { getAtlasDefinition, AtlasDefinition } from "./lib/atlasRegions";
import { SavedPack, getLocalPackLibrary, EditorState } from "./lib/packLibrary";
import { createCroppedTexturePreviewDataUrl, TEXTURE_THUMBNAIL_SIZE } from "./lib/texturePreview";
import { useTheme } from "./contexts/ThemeContext";
import PreviewModal from "./components/PreviewModal";

// Notification type
interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error';
}

// Fallback library for non-logged-in users (using localStorage)
const fallbackLibrary = {
  savePack: async (name: string, description: string, icon: string | null, packData: ArrayBuffer): Promise<SavedPack> => {
    console.log('Saving to fallback library (not logged in)');
    const STORAGE_KEY = 'mc-pack-editor-library-guest';
    
    // Load existing packs
    let savedPacks: SavedPack[] = [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        savedPacks = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load fallback library:', error);
    }
    
    // Check if pack would exceed localStorage size
    const packSize = packData.byteLength;
    const MAX_PACK_SIZE = 2 * 1024 * 1024; // 2MB limit for localStorage
    if (packSize > MAX_PACK_SIZE) {
      throw new Error('Pack is too large for guest storage. Please log in to save larger packs, or download the pack instead.');
    }
    
    // Convert ArrayBuffer to base64 for storage
    const bytes = new Uint8Array(packData);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Data = btoa(binary);
    
    const savedPack: SavedPack = {
      id: crypto.randomUUID(),
      name,
      description,
      icon,
      packData: base64Data,
      createdAt: new Date().toISOString(),
      fileSize: packData.byteLength,
      userId: 'guest'
    };
    
    savedPacks.unshift(savedPack);
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedPacks));
    } catch (error) {
      console.error('Failed to save to fallback library:', error);
      throw new Error('Storage quota exceeded. Please delete some packs from your library first, or log in to save larger packs.');
    }
    
    return savedPack;
  }
};
import {
  applyBrush,
  applyRecolor,
  imageDataToBuffer,
  loadImageDataFromBuffer,
  pickColorAt,
  type EditorTool,
  type RecolorMode,
} from "./lib/textureEditor";

// ─── Small UI atoms ────────────────────────────────────────────────────────────

function Badge({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-dark-tertiary text-slate-600 dark:text-dark-text-secondary border border-slate-200 dark:border-dark-border"
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

function Btn({
  children,
  onClick,
  variant = "default",
  className = "",
  disabled = false,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "ghost" | "danger" | "primary";
  className?: string;
  disabled?: boolean;
  title?: string;
}) {
  const base =
    "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer select-none";
  const variants = {
    default: "bg-slate-100 dark:bg-dark-tertiary text-slate-700 dark:text-dark-text-secondary hover:bg-slate-200 dark:hover:bg-dark-border border border-slate-200 dark:border-dark-border",
    ghost: "text-slate-600 dark:text-dark-text-secondary hover:text-slate-900 dark:hover:text-dark-text hover:bg-slate-100 dark:hover:bg-dark-tertiary",
    danger: "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50 border border-red-200 dark:border-red-900",
    primary: "bg-black dark:bg-dark-text text-white dark:text-dark-bg hover:bg-gray-800 dark:hover:bg-dark-tertiary",
  };
  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}

// ─── Color Picker ──────────────────────────────────────────────────────────────

const SWATCHES = [
  "#4ade80","#22c55e","#16a34a","#166534",
  "#60a5fa","#3b82f6","#2563eb","#1d4ed8",
  "#f87171","#ef4444","#dc2626","#b91c1c",
  "#fbbf24","#f59e0b","#d97706","#b45309",
  "#a78bfa","#8b5cf6","#7c3aed","#6d28d9",
  "#34d399","#10b981","#059669","#047857",
  "#f472b6","#ec4899","#db2777","#be185d",
  "#fb923c","#f97316","#ea580c","#c2410c",
  "#38bdf8","#0ea5e9","#0284c7","#0369a1",
  "#e879f9","#d946ef","#c026d3","#a21caf",
  "#94a3b8","#64748b","#ffffff","#000000",
];

function ColorPicker({
  value,
  onChange,
  onClose,
}: {
  value: string;
  onChange: (c: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hexInput, setHexInput] = useState(value);

  // Keep local hex in sync when value changes from swatch/native picker
  useEffect(() => { setHexInput(value); }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const handleHexChange = (v: string) => {
    setHexInput(v);
    if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v);
  };

  return (
    <div
      ref={ref}
      className="absolute z-[60] mt-1 p-2 bg-card border border-border rounded-lg shadow-xl"
      style={{ width: 164 }}
    >
      <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(8, 1fr)" }}>
        {SWATCHES.map((c) => (
          <button
            key={c}
            onClick={() => { onChange(c); onClose(); }}
            className="w-4 h-4 rounded-sm transition-transform hover:scale-125 focus:outline-none"
            style={{
              background: c,
              outline: c === value ? "2px solid white" : "none",
              outlineOffset: 1,
            }}
            title={c}
          />
        ))}
      </div>
      {/* Native color input + hex text */}
      <div className="mt-2 flex items-center gap-1.5">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-7 h-7 rounded cursor-pointer border border-border bg-transparent p-0"
          title="Pick any color"
        />
        <input
          type="text"
          value={hexInput}
          onChange={(e) => handleHexChange(e.target.value)}
          className="flex-1 bg-secondary border border-border rounded px-2 py-1 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary/50"
          maxLength={7}
          placeholder="#ffffff"
          spellCheck={false}
        />
      </div>
    </div>
  );
}

// ─── Pack Order Panel ──────────────────────────────────────────────────────────

function PackOrderPanel({
  packs,
  onReorder,
  onRemove,
  packVisibility,
  onVisibilityToggle,
  onViewFiles,
  darkMode,
  stripColorCodes,
}: {
  packs: Pack[];
  onReorder: (newOrder: Pack[]) => void;
  onRemove: (id: string) => void;
  packVisibility: Record<string, boolean>;
  onVisibilityToggle: (id: string) => void;
  onViewFiles: (id: string) => void;
  darkMode: boolean;
  stripColorCodes: (name: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  const handleDocClick = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, [handleDocClick]);

  const handleDragStart = (e: DragEvent<HTMLDivElement>, index: number) => {
    e.dataTransfer.effectAllowed = "move";
    setDragIndex(index);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverIndex(index);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, dropIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }
    const next = [...packs];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(dropIndex, 0, moved);
    onReorder(next);
    setDragIndex(null);
    setOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  return (
    <div ref={containerRef} className={`relative flex flex-col min-w-0 ${darkMode ? "dark" : ""}`}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors cursor-pointer select-none sleek ${darkMode ? "sleek-dark" : "sleek"}`}
      >
        <span className="text-base">⇅</span>
        <span>Pack Priority</span>
        <div className="flex items-center gap-1 mx-1">
          {packs.map((p) => (
            <span
              key={p.id}
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: p.color }}
            />
          ))}
        </div>
        <span className={`text-xs ml-auto`}>{open ? "▲" : "▼"}</span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className={`absolute top-full left-0 z-50 mt-1 w-60 border rounded-lg shadow-lg overflow-hidden ${darkMode ? "bg-dark-secondary border-dark-border" : "bg-white border-slate-200"}`}>
          <div className={`px-3 py-2 border-b flex items-center justify-between ${darkMode ? "border-dark-border" : "border-slate-200"}`}>
            <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? "text-dark-text-tertiary" : "text-slate-500"}`}>
              Auto priority order
            </span>
            <span className={`text-xs ${darkMode ? "text-dark-text-tertiary" : "text-slate-500"}`}>drag to reorder</span>
          </div>
          <p className={`px-3 pt-2 pb-1 text-xs ${darkMode ? "text-dark-text-tertiary" : "text-slate-500"}`}>
            When set to <span className="font-medium text-black dark:text-dark-text">auto</span>, the first pack is preferred. Textures missing from it fall through to the next pack.
          </p>
          <div className="p-2 flex flex-col gap-1">
            {packs.map((pack, i) => {
              const isDragging = dragIndex === i;
              const isOver = overIndex === i && dragIndex !== null && dragIndex !== i;
              return (
                <div
                  key={pack.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, i)}
                  onDragOver={(e) => handleDragOver(e, i)}
                  onDrop={(e) => handleDrop(e, i)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-2 px-2 py-2 rounded border transition-all cursor-grab active:cursor-grabbing select-none
                    ${isDragging ? "opacity-40 border-black dark:border-white" : darkMode ? "border-transparent hover:border-dark-border hover:bg-dark-tertiary" : "border-transparent hover:border-slate-200 hover:bg-slate-50"}
                    ${isOver ? "border-black dark:border-white bg-black/5 dark:bg-white/5" : ""}
                  `}
                >
                  {/* Drag handle */}
                  <span className={`text-base leading-none flex-shrink-0 ${darkMode ? "text-dark-text-tertiary" : "text-slate-400"}`}>⋮⋮</span>

                  {/* Color dot (static) */}
                  <span
                    className="w-3.5 h-3.5 rounded-full flex-shrink-0 border border-white/20"
                    style={{ background: pack.color }}
                  />
                  <span className={`text-sm font-medium flex-1 truncate ${darkMode ? "text-dark-text-secondary" : "text-slate-700"}`}>
                    {stripColorCodes(pack.name)}
                  </span>

                  {/* Visibility toggle */}
                  <button
                    onClick={(e) => { e.stopPropagation(); onVisibilityToggle(pack.id); }}
                    className={`text-base flex-shrink-0 transition-all leading-none ${packVisibility[pack.id] === false ? "opacity-25 grayscale" : "opacity-70 hover:opacity-100"}`}
                    title={packVisibility[pack.id] === false ? "Hidden from comparison — click to show" : "Visible in comparison — click to hide"}
                  >
                    👁
                  </button>

                  {/* View Files */}
                  <button
                    onClick={(e) => { e.stopPropagation(); onViewFiles(pack.id); }}
                    className={`text-sm transition-colors flex-shrink-0 ${darkMode ? "text-dark-text-tertiary hover:text-dark-text" : "text-slate-400 hover:text-black"}`}
                    title="View and manage files"
                  >
                    📁
                  </button>

                  {/* Remove */}
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemove(pack.id); }}
                    className={`text-sm transition-colors flex-shrink-0 ${darkMode ? "text-dark-text-tertiary hover:text-red-400" : "text-slate-400 hover:text-red-500"}`}
                    title="Remove pack"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Drop Zone ─────────────────────────────────────────────────────────────────

function DropZone({ onLoad, onTextureImport, darkMode }: { onLoad: (packs: Pack[]) => void; onTextureImport: (file: File) => void; darkMode: boolean }) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files);
      const zipFiles = arr.filter((f) => f.name.toLowerCase().endsWith(".zip"));
      const pngFiles = arr.filter((f) => f.name.toLowerCase().endsWith(".png"));

      setLoading(true);
      try {
        if (zipFiles.length > 0) {
          const loaded = await Promise.all(zipFiles.map(loadPackFromFile));
          onLoad(loaded);
        }
        if (pngFiles.length > 0) {
          pngFiles.forEach(onTextureImport);
        }
      } catch (e) {
        console.error("Failed to load pack:", e);
      } finally {
        setLoading(false);
      }
    },
    [onLoad, onTextureImport]
  );

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-lg p-8 cursor-pointer transition-colors
        ${dragging ? "border-black dark:border-white bg-black/5 dark:bg-white/5" : darkMode ? "border-dark-border hover:border-dark-text hover:bg-dark-tertiary" : "border-slate-300 hover:border-black hover:bg-slate-50"}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".zip,.png"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
      <svg className={`w-10 h-10 ${darkMode ? "text-dark-text-tertiary" : "text-slate-500"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 13v8" /><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /><path d="m8 17 4-4 4 4" />
      </svg>
      {loading ? (
        <p className={`text-sm animate-pulse ${darkMode ? "text-dark-text-tertiary" : "text-slate-500"}`}>Loading…</p>
      ) : (
        <>
          <p className={`text-sm ${darkMode ? "text-dark-text-secondary" : "text-slate-600"}`}>Drop ZIP or PNG files here</p>
          <p className={`text-xs ${darkMode ? "text-dark-text-tertiary" : "text-slate-400"}`}>or click to browse</p>
        </>
      )}
    </div>
  );
}

// ─── Minecraft text renderer ───────────────────────────────────────────────────

const MC_COLOR_MAP: Record<string, string> = {
  "0": "#000000", "1": "#0000AA", "2": "#00AA00", "3": "#00AAAA",
  "4": "#AA0000", "5": "#AA00AA", "6": "#FFAA00", "7": "#AAAAAA",
  "8": "#555555", "9": "#5555FF", "a": "#55FF55", "b": "#55FFFF",
  "c": "#FF5555", "d": "#FF55FF", "e": "#FFFF55", "f": "#FFFFFF",
};

interface McSegment {
  text: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
}

function parseMcText(raw: string): McSegment[] {
  const segments: McSegment[] = [];
  let color: string | undefined;
  let bold = false, italic = false, underline = false, strikethrough = false;

  // Split on § codes; keep delimiters
  const parts = raw.split(/(§[0-9a-fklmnorA-FKLMNOR])/);
  for (const part of parts) {
    if (part.startsWith("§") && part.length === 2) {
      const ch = part[1].toLowerCase();
      if (MC_COLOR_MAP[ch]) {
        color = MC_COLOR_MAP[ch];
        bold = italic = underline = strikethrough = false;
      } else if (ch === "l") { bold = true; }
      else if (ch === "o") { italic = true; }
      else if (ch === "n") { underline = true; }
      else if (ch === "m") { strikethrough = true; }
      else if (ch === "r") {
        color = undefined;
        bold = italic = underline = strikethrough = false;
      }
      // §k (obfuscated) intentionally ignored
    } else if (part) {
      segments.push({ text: part, color, bold, italic, underline, strikethrough });
    }
  }
  return segments;
}

function McText({ text, fallback = "—" }: { text: string; fallback?: string }) {
  const segments = parseMcText(text);
  if (!segments.length) {
    return <span className="text-slate-400 dark:text-dark-text-tertiary italic text-xs">{fallback}</span>;
  }
  return (
    <>
      {segments.map((seg, i) => {
        const dec = [seg.underline && "underline", seg.strikethrough && "line-through"]
          .filter(Boolean).join(" ");
        return (
          <span
            key={i}
            style={{
              color: seg.color ?? "#FFFFFF",
              fontWeight: seg.bold ? "bold" : undefined,
              fontStyle: seg.italic ? "italic" : undefined,
              textDecoration: dec || undefined,
              textShadow: seg.color ? `1px 1px 2px rgba(0,0,0,0.8)` : undefined,
            }}
          >
            {seg.text}
          </span>
        );
      })}
    </>
  );
}

// ─── Minecraft format codes ────────────────────────────────────────────────────

const MC_COLORS = [
  // Black/White
  { code: "§0", color: "#000000", label: "Black" },
  { code: "§f", color: "#FFFFFF", label: "White" },
  // Dark colors
  { code: "§8", color: "#555555", label: "Dark Gray" },
  { code: "§1", color: "#0000AA", label: "Dark Blue" },
  { code: "§2", color: "#00AA00", label: "Dark Green" },
  { code: "§4", color: "#AA0000", label: "Dark Red" },
  { code: "§5", color: "#AA00AA", label: "Dark Purple" },
  { code: "§3", color: "#00AAAA", label: "Dark Aqua" },
  // Light colors
  { code: "§7", color: "#AAAAAA", label: "Gray" },
  { code: "§9", color: "#5555FF", label: "Blue" },
  { code: "§a", color: "#55FF55", label: "Green" },
  { code: "§c", color: "#FF5555", label: "Red" },
  { code: "§d", color: "#FF55FF", label: "Light Purple" },
  { code: "§b", color: "#55FFFF", label: "Aqua" },
  // Gold/Yellow
  { code: "§6", color: "#FFAA00", label: "Gold" },
  { code: "§e", color: "#FFFF55", label: "Yellow" },
];

const MC_FORMATS = [
  { code: "§l", label: "B",   title: "Bold (§l)",        style: { fontWeight: "bold" as const } },
  { code: "§o", label: "I",   title: "Italic (§o)",      style: { fontStyle: "italic" as const } },
  { code: "§n", label: "U",   title: "Underline (§n)",   style: { textDecoration: "underline" } },
  { code: "§m", label: "S",   title: "Strikethrough (§m)", style: { textDecoration: "line-through" } },
  { code: "§k", label: "Obf", title: "Obfuscated (§k)", style: {} },
  { code: "§r", label: "R",   title: "Reset (§r)",       style: {} },
];

type UploadDefaults = {
  name: string;
  description: string;
  icon: string | null;
  copyFromTopPack: boolean;
};

const DEFAULT_UPLOAD_DEFAULTS: UploadDefaults = {
  name: "My Resource Pack",
  description: "A Minecraft 1.8 Resource Pack",
  icon: null,
  copyFromTopPack: false,
};

function readUploadDefaults(): UploadDefaults {
  if (typeof window === "undefined") return DEFAULT_UPLOAD_DEFAULTS;

  try {
    const saved = window.localStorage.getItem("mc-pack-editor-upload-defaults");
    if (!saved) return DEFAULT_UPLOAD_DEFAULTS;

    const parsed = JSON.parse(saved) as Partial<UploadDefaults>;
    return {
      name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name : DEFAULT_UPLOAD_DEFAULTS.name,
      description: typeof parsed.description === "string" && parsed.description.trim()
        ? parsed.description
        : DEFAULT_UPLOAD_DEFAULTS.description,
      icon: typeof parsed.icon === "string" ? parsed.icon : null,
      copyFromTopPack: typeof parsed.copyFromTopPack === "boolean" ? parsed.copyFromTopPack : DEFAULT_UPLOAD_DEFAULTS.copyFromTopPack,
    };
  } catch {
    return DEFAULT_UPLOAD_DEFAULTS;
  }
}

// ─── Pack Settings ─────────────────────────────────────────────────────────────

function PackSettings({
  packName,
  packDescription,
  packIcon,
  onNameChange,
  onDescriptionChange,
  onIconChange,
  darkMode,
  stripColorCodes,
}: {
  packName: string;
  packDescription: string;
  packIcon: string | null;
  onNameChange: (n: string) => void;
  onDescriptionChange: (d: string) => void;
  onIconChange: (d: string | null) => void;
  darkMode: boolean;
  stripColorCodes: (name: string) => string;
}) {
  const iconRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [activeField, setActiveField] = useState<"name" | "desc">("desc");
  const [colorCodesOpen, setColorCodesOpen] = useState(false);

  useEffect(() => {
    if (colorCodesOpen && dropdownRef.current) {
      dropdownRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [colorCodesOpen]);

  const handleIcon = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => onIconChange(reader.result as string);
    reader.readAsDataURL(f);
  };

  const insertCode = (code: string) => {
    const ref = activeField === "name" ? nameRef : descRef;
    const onChange = activeField === "name" ? onNameChange : onDescriptionChange;
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const newValue = el.value.slice(0, start) + code + el.value.slice(end);
    onChange(newValue);
    requestAnimationFrame(() => {
      el.setSelectionRange(start + code.length, start + code.length);
      el.focus();
    });
  };

  return (
    <div className="flex items-start gap-3">
      {/* Pack icon */}
      <button
        className={`w-12 h-12 rounded-lg border flex-shrink-0 overflow-hidden checkered transition-colors cursor-pointer mt-5 ${darkMode ? "border-dark-border hover:border-dark-text" : "border-slate-200 hover:border-black"}`}
        onClick={() => iconRef.current?.click()}
        title="Click to change pack icon"
      >
        {packIcon ? (
          <img src={packIcon} alt="icon" className="w-full h-full object-cover texture-preview" />
        ) : (
          <svg className="w-5 h-5 text-slate-400 dark:text-dark-text-tertiary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M12 13v8" /><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /><path d="m8 17 4-4 4 4" /></svg>
        )}
        <input ref={iconRef} type="file" accept="image/*" className="hidden" onChange={handleIcon} />
      </button>

      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        {/* Pack name */}
        <div className="flex flex-col gap-1">
          <label className={`text-xs font-medium ${darkMode ? "text-dark-text-tertiary" : "text-slate-500"}`}>Output Pack Name</label>
          <input
            ref={nameRef}
            type="text"
            value={packName}
            onFocus={() => setActiveField("name")}
            onChange={(e) => onNameChange(e.target.value)}
            className="rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 focus:border-black dark:focus:border-white w-full bg-white border-slate-200 text-slate-700 dark:bg-dark-tertiary dark:border-dark-border dark:text-dark-text-secondary"
            placeholder="My Resource Pack"
          />
          {packName.includes("§") && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-black rounded-lg border border-dark-border text-sm min-h-[26px]">
              <McText text={packName} fallback="…" />
            </div>
          )}
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1">
          <label className={`text-xs font-medium ${darkMode ? "text-dark-text-tertiary" : "text-slate-500"}`}>
            Description <span className="opacity-60">(pack.mcmeta)</span>
          </label>
          <input
            ref={descRef}
            type="text"
            value={packDescription}
            onFocus={() => setActiveField("desc")}
            onChange={(e) => onDescriptionChange(e.target.value)}
            className="rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 focus:border-black dark:focus:border-white w-full bg-white border-slate-200 text-slate-700 dark:bg-dark-tertiary dark:border-dark-border dark:text-dark-text-secondary"
            placeholder="A Minecraft resource pack"
          />
          {packDescription.includes("§") && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-black rounded-lg border border-dark-border text-sm min-h-[26px]">
              <McText text={packDescription} fallback="…" />
            </div>
          )}
        </div>

        {/* Format code button */}
        <div className="flex flex-col gap-1 relative">
          <button
            onClick={() => setColorCodesOpen(!colorCodesOpen)}
            className="flex items-center gap-1.5 text-left transition-colors hover:opacity-70"
          >
            <label className={`text-xs font-medium ${darkMode ? "text-dark-text-tertiary" : "text-slate-500"}`}>Open Codes</label>
            <span className={`text-xs ${darkMode ? "text-dark-text" : "text-black"}`}>
              {colorCodesOpen ? "↓" : "→"} inserting into <span className="font-semibold">{activeField === "name" ? "Name" : "Description"}</span>
            </span>
          </button>

          {/* Format codes dropdown */}
          {colorCodesOpen && (
            <div
              ref={dropdownRef}
              className={`absolute top-full left-0 z-[100] w-full max-w-md rounded-xl border shadow-2xl mt-2 ${darkMode ? "bg-dark-secondary border-dark-border" : "bg-white border-slate-200"}`}
            >
              <div className="p-4 flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? "text-dark-text-tertiary" : "text-slate-500"}`}>Colors</span>
                  <div className="flex flex-wrap gap-1.5">
                    {MC_COLORS.map(({ code, color, label }) => (
                      <button
                        key={code}
                        onMouseDown={(e) => { e.preventDefault(); insertCode(code); }}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold hover:scale-110 transition-transform flex-shrink-0 border border-white/10"
                        style={{
                          background: color,
                          color: ["#000000","#555555","#0000AA","#00AA00","#00AAAA","#AA0000","#AA00AA"].includes(color) ? "#fff" : "#000",
                        }}
                        title={`${label} (${code})`}
                      >
                        A
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? "text-dark-text-tertiary" : "text-slate-500"}`}>Formatting</span>
                  <div className="flex flex-wrap gap-1.5">
                    {MC_FORMATS.map(({ code, label, title, style }) => (
                      <button
                        key={code}
                        onMouseDown={(e) => { e.preventDefault(); insertCode(code); }}
                        className={`px-3 h-8 rounded-lg text-sm transition-colors flex-shrink-0 border ${darkMode ? "border-dark-border hover:bg-dark-tertiary" : "border-slate-200 hover:bg-slate-100"}`}
                        style={style}
                        title={title}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Folder Sidebar ────────────────────────────────────────────────────────────

function FolderSidebar({
  packs,
  selectedFolder,
  onSelect,
  folderSources,
  onFolderSource,
  layoutMode,
  darkMode,
  stripColorCodes,
}: {
  packs: Pack[];
  selectedFolder: string;
  onSelect: (f: string) => void;
  folderSources: FolderSources;
  onFolderSource: (folder: string, packId: string | null) => void;
  layoutMode: LayoutMode;
  darkMode: boolean;
  stripColorCodes: (name: string) => string;
}) {
  const availableFolders = useMemo(() => getAllFoldersInPacks(packs), [packs]);

  const defined = MC_FOLDERS.filter((f) => availableFolders.has(f.key));
  const extra = Array.from(availableFolders)
    .filter((k) => !MC_FOLDERS.find((f) => f.key === k))
    .sort();

  const renderFolder = (key: string, label: string) => {
    const sourcePackId = folderSources[key];
    const sourcePack = packs.find((p) => p.id === sourcePackId);
    const active = selectedFolder === key;

    return (
      <div key={key} className={`group border transition-all sleek rounded-lg ${darkMode ? "sleek-dark" : "sleek"} ${active ? "border-black dark:border-black bg-black/5 dark:bg-black/5" : darkMode ? "bg-dark-secondary" : "bg-[#f5f0e6] hover:bg-[#C2B280]/30"} mb-2`}>
        <button
          className={`w-full flex items-center px-3 py-2.5 text-sm text-left transition-colors rounded-lg ${darkMode ? "hover:bg-[#C2B280]/50" : "hover:bg-[#C2B280]/50"}`}
          onClick={() => onSelect(key)}
        >
          <span className={`flex-1 font-medium leading-snug ${active ? "text-black dark:text-black" : ""}`}>
            {label}
          </span>
        </button>
        {packs.length > 1 && (
          <div className="px-3 pb-2 flex items-center gap-1 flex-wrap">
            <button
              className={`text-xs px-2 py-0.5 rounded transition-colors ${!sourcePackId ? "bg-slate-200 dark:bg-dark-tertiary text-slate-700 dark:text-dark-text-secondary font-semibold" : "hover:bg-[#C2B280]/50"}`}
              onClick={(e) => { e.stopPropagation(); onFolderSource(key, null); }}
              title="Use highest-priority pack for each file"
            >
              auto
            </button>
            {packs.map((p) => (
              <button
                key={p.id}
                className={`text-xs px-2 py-0.5 rounded transition-colors ${sourcePackId === p.id ? "font-semibold" : "hover:bg-[#C2B280]/50"}`}
                style={sourcePackId === p.id ? { background: p.color + "40", color: p.color } : {}}
                onClick={(e) => { e.stopPropagation(); onFolderSource(key, p.id); }}
                title={stripColorCodes(p.name)}
              >
                {stripColorCodes(p.name)}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <nav className="flex flex-col gap-1.5 py-2 px-2">
      {defined.map((f) => renderFolder(f.key, f.label))}
      {extra.map((k) => renderFolder(k, k))}
    </nav>
  );
}

// ─── Texture Card ──────────────────────────────────────────────────────────────

function CroppedTexturePreview({ buffer, path, alt, size = TEXTURE_THUMBNAIL_SIZE }: { buffer: ArrayBuffer; path: string; alt: string; size?: number }) {
  const sourceUrl = useMemo(() => arrayBufferToDataURL(buffer, path), [buffer, path]);
  const [previewUrl, setPreviewUrl] = useState(sourceUrl);

  useEffect(() => {
    let cancelled = false;
    
    // Skip cropping for atlas textures that cause blank screen issues
    const isAtlasTexture = path.toLowerCase().includes('icons.png') || path.toLowerCase().includes('widgets.png');
    
    if (isAtlasTexture) {
      setPreviewUrl(sourceUrl);
      return;
    }
    
    createCroppedTexturePreviewDataUrl(buffer, path, size)
      .then((url) => {
        if (!cancelled) setPreviewUrl(url);
      })
      .catch(() => {
        if (!cancelled) setPreviewUrl(sourceUrl);
      });
    return () => { cancelled = true; };
  }, [buffer, path, sourceUrl, size]);

  return (
    <img
      src={previewUrl}
      alt={alt}
      className="texture-preview"
      style={{ width: size, height: size, imageRendering: "pixelated" }}
    />
  );
}

function TextureCard({
  texturePath,
  displayName,
  packs,
  folderSources,
  textureOverrides,
  folder,
  onOverride,
  onOpenLightbox,
  onEditTexture,
  onUpscaleTexture,
  isRemoved,
  onToggleRemove,
  layoutMode,
  darkMode,
  stripColorCodes,
}: {
  texturePath: string;
  displayName: string;
  packs: Pack[];
  folderSources: FolderSources;
  textureOverrides: TextureOverrides;
  folder: string;
  onOverride: (path: string, packId: string | null) => void;
  onOpenLightbox?: () => void;
  onEditTexture?: (path: string, displayName: string, folder: string) => void;
  isRemoved: boolean;
  onToggleRemove: (path: string) => void;
  layoutMode: LayoutMode;
  darkMode: boolean;
  stripColorCodes: (name: string) => string;
}) {
  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const pack = packs.find((p) => p.id === effectivePackId) ?? packsWithFile[0];
    const buf = pack?.files.get(texturePath);
    if (!buf) return;
    const url = arrayBufferToDataURL(buf, texturePath);
    const a = document.createElement("a");
    a.href = url;
    a.download = displayName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const overridePackId = textureOverrides[texturePath] ?? null;
  const folderPackId = folderSources[folder] ?? null;
  const effectivePackId = overridePackId ?? folderPackId;
  const packsWithFile = packs.filter((p) => p.files.has(texturePath));
  if (!packsWithFile.length) return null;

  const isImg = isImagePath(texturePath);
  const isAtlas = !!getAtlasDefinition(texturePath);

  return (
    <div id={`texture-card-${texturePath}`} className={`overflow-hidden flex flex-col rounded-lg border transition-all min-w-0 ${isRemoved ? (darkMode ? "border-red-500 bg-red-950/30 opacity-70" : "border-red-300 bg-red-50 opacity-70") : `${darkMode ? "border-dark-border bg-dark-secondary hover:border-dark-text" : "border-slate-200 bg-white hover:border-black"} shadow-sm`}`}>
      {/* Texture previews row */}
      {isImg && (
        <div
          className={`flex border-b ${darkMode ? "border-dark-border" : "border-slate-100"} ${packsWithFile.length === 1 ? "" : darkMode ? "divide-x divide-dark-border" : "divide-x divide-slate-100"}`}
        >
          {packsWithFile.map((pack) => {
            const buf = pack.files.get(texturePath)!;
            const isSelected =
              effectivePackId === pack.id ||
              (!effectivePackId && pack === packsWithFile[0]);
            return (
              <button
                key={pack.id}
                className={`flex-1 flex items-center justify-center p-2 checkered min-h-[80px] relative transition-all ${
                  packsWithFile.length > 1 ? "cursor-pointer hover:brightness-110" : "cursor-default"
                }`}
                style={isSelected && packsWithFile.length > 1 ? { 
                  borderBottom: '4px solid', 
                  borderBottomColor: pack.color,
                  boxShadow: `0 4px 12px ${pack.color}66`
                } : {}}
                onClick={() => {
                  if (packsWithFile.length <= 1) return;
                  if (overridePackId === pack.id) {
                    onOverride(texturePath, null);
                  } else {
                    onOverride(texturePath, pack.id);
                  }
                }}
                title={packsWithFile.length > 1 ? `Use from: ${stripColorCodes(pack.name)}` : stripColorCodes(pack.name)}
              >
                <CroppedTexturePreview buffer={buf} path={texturePath} alt={displayName} />
              </button>
            );
          })}
        </div>
      )}

      {/* File label & controls — click label to open lightbox */}
      <div className={`flex items-center gap-1 px-2 py-1.5 ${darkMode ? "bg-dark-tertiary" : "bg-slate-50"}`}>
        <button
          className={`flex-1 min-w-0 text-left transition-colors ${darkMode ? "hover:bg-dark-border" : "hover:bg-slate-100"}`}
          onClick={() => onOpenLightbox?.()}
          title="Click to view larger"
        >
          <div className="flex items-center gap-1 min-w-0">
            {isAtlas && (
              <span className={`text-[10px] font-bold flex-shrink-0 ${darkMode ? "text-dark-text-tertiary" : "text-slate-600"}`} title="Atlas texture — region editor available">ATL</span>
            )}
            <span className={`text-xs truncate flex-1 ${darkMode ? "text-dark-text-secondary" : "text-slate-500"}`} title={displayName}>
              {displayName}
            </span>
            {overridePackId && (
              <span
                className={`text-xs flex-shrink-0 ${darkMode ? "text-black dark:text-dark-text400" : "text-black dark:text-dark-text600"}`}
                onClick={(e) => { e.stopPropagation(); onOverride(texturePath, null); }}
                title="Clear override"
              >
                ✕
              </span>
            )}
          </div>
        </button>
        <button
          className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${darkMode ? "bg-dark-secondary text-dark-text-tertiary hover:bg-dark-border hover:text-dark-text-secondary" : "bg-white text-slate-400 hover:bg-slate-200 hover:text-slate-600"}`}
          onClick={(e) => { e.stopPropagation(); onEditTexture?.(texturePath, displayName, folder); }}
          title="Edit texture"
          aria-label={`Edit ${displayName}`}
        >
          ✎
        </button>
        <button
          className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${darkMode ? "text-dark-text-tertiary hover:bg-dark-border hover:text-dark-text-secondary" : "text-slate-400 hover:bg-slate-200 hover:text-slate-600"}`}
          onClick={handleDownload}
          title="Download texture"
          aria-label={`Download ${displayName}`}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 px-2 pb-2 pt-1">
        <button
          className={`flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${isRemoved ? (darkMode ? "border-red-500 bg-red-950/30 text-red-400 hover:bg-red-950/50" : "border-red-300 bg-red-50 text-red-500 hover:bg-red-100") : (darkMode ? "border-green-500 bg-green-950/30 text-green-400 hover:bg-green-950/50" : "border-green-300 bg-green-50 text-green-600 hover:bg-green-100")}`}
          onClick={(e) => { e.stopPropagation(); onToggleRemove(texturePath); }}
          title={isRemoved ? "Re-include this file in export" : "Remove this file from export"}
          aria-label={isRemoved ? "Re-include this file in export" : "Remove this file from export"}
        >
          <span className="text-[10px] leading-none">{isRemoved ? "✕" : "✓"}</span>
        </button>
        {packsWithFile.length > 1 && (
          <div className="flex gap-1 flex-wrap">
            <button
              className={`text-xs px-1.5 py-0.5 rounded transition-colors ${!overridePackId ? "bg-slate-200 dark:bg-dark-tertiary text-slate-700 dark:text-dark-text-secondary font-semibold" : "text-slate-500 dark:text-dark-text-tertiary hover:text-slate-700 dark:hover:text-dark-text-secondary hover:bg-slate-100 dark:hover:bg-dark-tertiary"}`}
              onClick={() => onOverride(texturePath, null)}
            >
            auto
          </button>
            {packsWithFile.map((p) => (
              <button
                key={p.id}
                className={`text-xs px-1.5 py-0.5 rounded transition-colors truncate max-w-[60px] ${overridePackId === p.id ? "font-semibold" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"}`}
                style={overridePackId === p.id ? { background: p.color + "33", color: p.color } : {}}
                onClick={() => onOverride(texturePath, overridePackId === p.id ? null : p.id)}
                title={stripColorCodes(p.name)}
              >
                {stripColorCodes(p.name)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Texture Grid ──────────────────────────────────────────────────────────────

function TextureGrid({
  packs,
  folder,
  folderSources,
  textureOverrides,
  onOverride,
  onOpenLightbox,
  onEditTexture,
  onUpscaleTexture,
  cols,
  removedFiles,
  onToggleRemove,
  layoutMode,
  darkMode,
  stripColorCodes,
  showJsonFiles,
}: {
  packs: Pack[];
  folder: string;
  folderSources: FolderSources;
  textureOverrides: TextureOverrides;
  onOverride: (path: string, packId: string | null) => void;
  onOpenLightbox: (path: string, displayName: string, folder: string) => void;
  onEditTexture: (path: string, displayName: string, folder: string) => void;
  cols: number;
  removedFiles: Record<string, boolean>;
  onToggleRemove: (path: string) => void;
  layoutMode: LayoutMode;
  darkMode: boolean;
  stripColorCodes: (name: string) => string;
  showJsonFiles: boolean;
}) {
  const [search, setSearch] = useState("");

  const paths = useMemo(
    () => getAllTexturePathsInFolder(packs, folder, showJsonFiles),
    [packs, folder, showJsonFiles]
  );

  const filtered = useMemo(() => {
    if (!search) return paths;
    const q = search.toLowerCase();
    return paths.filter((p) => p.toLowerCase().includes(q));
  }, [paths, search]);

  if (!paths.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <p className="text-sm">No files in this folder across uploaded packs</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full min-w-0">
      <div className="flex items-center gap-3">
        <input
          type="search"
          placeholder="Search in folder…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 flex-1 ${darkMode ? "sleek-input" : "sleek-input-light"}`}
        />
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {filtered.length}/{paths.length} files
        </span>
      </div>

      <div className="grid gap-2 min-w-0" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {filtered.map((path) => {
          const parts = path.split("/");
          const displayName = parts[parts.length - 1];
          return (
            <TextureCard
              key={path}
              texturePath={path}
              displayName={displayName}
              packs={packs}
              folderSources={folderSources}
              textureOverrides={textureOverrides}
              folder={folder}
              onOverride={onOverride}
              onOpenLightbox={() => onOpenLightbox(path, displayName, folder)}
              onEditTexture={() => onEditTexture(path, displayName, folder)}
              isRemoved={!!removedFiles[path]}
              onToggleRemove={onToggleRemove}
              layoutMode={layoutMode}
              darkMode={darkMode}
              stripColorCodes={stripColorCodes}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Search All Results ─────────────────────────────────────────────────────────

function SearchAllResults({
  query,
  packs,
  folderSources,
  textureOverrides,
  onOverride,
  onOpenLightbox,
  onEditTexture,
  cols,
  removedFiles,
  onToggleRemove,
  layoutMode,
  darkMode,
  stripColorCodes,
  showJsonFiles,
}: {
  query: string;
  packs: Pack[];
  folderSources: FolderSources;
  textureOverrides: TextureOverrides;
  onOverride: (path: string, packId: string | null) => void;
  onOpenLightbox: (path: string, displayName: string, folder: string) => void;
  onEditTexture: (path: string, displayName: string, folder: string) => void;
  cols: number;
  removedFiles: Record<string, boolean>;
  onToggleRemove: (path: string) => void;
  layoutMode: LayoutMode;
  darkMode: boolean;
  stripColorCodes: (name: string) => string;
  showJsonFiles: boolean;
}) {
  const allPaths = useMemo(() => {
    const set = new Set<string>();
    for (const pack of packs) {
      pack.files.forEach((_, p) => {
        if (p !== "pack.mcmeta" && p !== "pack.png") {
          // Skip JSON/text files unless showJsonFiles is true
          const isJson = /\.(json|mcmeta|txt|properties|yml|yaml|toml|cfg|conf|ini)$/i.test(p);
          if (!showJsonFiles && isJson) return;
          set.add(p);
        }
      });
    }
    return [...set].sort();
  }, [packs, showJsonFiles]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return allPaths.filter((p) => p.toLowerCase().includes(q));
  }, [allPaths, query]);

  if (!filtered.length) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
        <p className="text-sm">No textures match <strong className="text-foreground">"{query}"</strong></p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <p className="text-xs text-muted-foreground">
        {filtered.length} result{filtered.length !== 1 ? "s" : ""} across all folders
      </p>
      <div className="grid gap-2 min-w-0" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {filtered.map((path) => {
          const parts = path.split("/");
          const displayName = parts[parts.length - 1];
          const folder = getTextureFolder(path);
          return (
            <div key={path} className="flex flex-col gap-0.5">
              <TextureCard
                texturePath={path}
                displayName={displayName}
                packs={packs}
                folderSources={folderSources}
                textureOverrides={textureOverrides}
                folder={folder}
                onOverride={onOverride}
                onOpenLightbox={() => onOpenLightbox(path, displayName, folder)}
                onEditTexture={() => onEditTexture(path, displayName, folder)}
                isRemoved={!!removedFiles[path]}
                onToggleRemove={onToggleRemove}
                layoutMode={layoutMode}
                darkMode={darkMode}
                stripColorCodes={stripColorCodes}
              />
              <span className={`text-[10px] text-center truncate px-1 ${darkMode ? "text-dark-text-secondary" : "text-muted-foreground"}`}>{folder}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Texture Lightbox ──────────────────────────────────────────────────────────

function AtlasPreviewStrip({
  packsWithFile,
  texturePath,
  effectivePackId,
  overridePackId,
  composedPreviewUrl,
  displayName,
  onOverride,
  onAtlasZoom,
  stripColorCodes,
}: {
  packsWithFile: Pack[];
  texturePath: string;
  effectivePackId: string | null | undefined;
  overridePackId: string | null | undefined;
  composedPreviewUrl: string | null;
  displayName: string;
  onOverride: (path: string, packId: string | null) => void;
  onAtlasZoom?: (url: string, displayName: string) => void;
  stripColorCodes: (name: string) => string;
}) {
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
            <div className="flex flex-col gap-2 rounded-xl border border-border bg-secondary/30 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">New atlas preview</div>
              <button
                className="cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => onAtlasZoom && onAtlasZoom(composedPreviewUrl, displayName)}
                title="Click to zoom atlas preview"
              >
                <img
                  src={composedPreviewUrl}
                  alt="Preview of the atlas after region overrides"
                  className={`h-40 w-40 rounded-md border border-border object-contain checkered`}
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

function TextureLightbox({
  texturePath,
  displayName,
  folder,
  packs,
  folderSources,
  textureOverrides,
  atlasRegionOverrides,
  onOverride,
  onAtlasRegionOverride,
  onAtlasZoom,
  onClose,
  darkMode,
  stripColorCodes,
}: {
  texturePath: string;
  displayName: string;
  folder: string;
  packs: Pack[];
  folderSources: FolderSources;
  textureOverrides: TextureOverrides;
  atlasRegionOverrides: Record<string, Record<string, string>>;
  onOverride: (path: string, packId: string | null) => void;
  onAtlasRegionOverride: (atlasPath: string, regionId: string, packId: string | null) => void;
  onAtlasZoom?: (url: string, displayName: string) => void;
  onClose: () => void;
  darkMode: boolean;
  stripColorCodes: (name: string) => string;
}) {
  const packsWithFile = packs.filter((p) => p.files.has(texturePath));
  const overridePackId = textureOverrides[texturePath];
  const folderPackId = folderSources[folder];
  const effectivePackId = overridePackId ?? folderPackId;
  const atlasDef = getAtlasDefinition(texturePath);
  const regionOverrides = atlasRegionOverrides[texturePath] ?? {};
  const [regionPreviewUrls, setRegionPreviewUrls] = useState<Record<string, string>>({});
  const [composedPreviewUrl, setComposedPreviewUrl] = useState<string | null>(null);
  const [previewRegionId, setPreviewRegionId] = useState<string | null>(null);

  const regionOverrideKey = useMemo(
    () => Object.entries(regionOverrides)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([regionId, packId]) => `${regionId}:${packId}`)
      .join("|"),
    [regionOverrides]
  );
  const packFileKey = useMemo(
    () => packsWithFile.map((p) => p.id).join("|"),
    [packsWithFile]
  );

  useEffect(() => {
    if (!atlasDef || packsWithFile.length === 0) {
      setRegionPreviewUrls({});
      setComposedPreviewUrl(null);
      return;
    }

    let cancelled = false;

    (async () => {
      const previews: Record<string, string> = {};
      const patches: { region: AtlasDefinition["regions"][number]; buffer: ArrayBuffer; sourceRegion?: AtlasDefinition["regions"][number] }[] = [];

      for (const region of atlasDef.regions) {
        const regionPackId = regionOverrides[region.id] ?? effectivePackId;
        const sourcePack = packsWithFile.find((p) => p.id === regionPackId) ?? packsWithFile[0];
        const sourceBuffer = sourcePack?.files.get(texturePath);

        if (!sourceBuffer) continue;

        const cropped = await cropAtlasRegion(sourceBuffer, region, texturePath);
        previews[region.id] = arrayBufferToDataURL(cropped, texturePath);

        if (regionOverrides[region.id]) {
          patches.push({ region, buffer: sourceBuffer });
          // When a region is overridden, also override any regions that map to it (e.g., hardcore hearts map to normal hearts)
          const mappedRegions = atlasDef.regions.filter((r) => r.mapsTo === region.id);
          for (const mappedRegion of mappedRegions) {
            patches.push({ region: mappedRegion, sourceRegion: region, buffer: sourceBuffer });
          }
        }
      }

      if (!cancelled) {
        setRegionPreviewUrls(previews);

        const basePack = packsWithFile.find((p) => p.id === (effectivePackId ?? packsWithFile[0]?.id)) ?? packsWithFile[0];
        if (patches.length > 0) {
          const base = basePack?.files.get(texturePath);
          if (base) {
            const composed = await composeAtlas(base, patches);
            setComposedPreviewUrl(arrayBufferToDataURL(composed, texturePath));
          } else {
            setComposedPreviewUrl(null);
          }
        } else {
          setComposedPreviewUrl(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [atlasDef, effectivePackId, packFileKey, regionOverrideKey, texturePath]);

  const previewRegion = useMemo(() => {
    if (!atlasDef) return undefined;
    return atlasDef.regions.find((region) => region.id === previewRegionId)
      ?? atlasDef.regions.find((region) => region.id === "crosshair")
      ?? atlasDef.regions.find((region) => region.id === "hotbar_container")
      ?? atlasDef.regions[0];
  }, [atlasDef, previewRegionId]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex min-h-full justify-center p-4 sm:p-6" onClick={onClose}>
        <div
          className={`my-4 w-full max-w-3xl flex-shrink-0 rounded-lg border shadow-2xl ${darkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3">
            <span className={`text-sm font-semibold ${darkMode ? "text-slate-200" : "text-slate-700"}`}>{displayName}</span>
            <span className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{texturePath}</span>
            {atlasDef && (
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${darkMode ? "bg-slate-700 text-slate-200" : "bg-slate-200 text-slate-700"}`}>Atlas</span>
            )}
            <button
              className={`ml-auto text-lg leading-none ${darkMode ? "text-slate-400 hover:text-slate-200" : "text-slate-400 hover:text-slate-600"}`}
              onClick={onClose}
            >
              ✕
            </button>
          </div>

          <div className="flex flex-col gap-4 p-4">
            <AtlasPreviewStrip
              packsWithFile={packsWithFile}
              texturePath={texturePath}
              effectivePackId={effectivePackId}
              overridePackId={overridePackId}
              composedPreviewUrl={atlasDef ? composedPreviewUrl : null}
              displayName={displayName}
              onOverride={onOverride}
              onAtlasZoom={onAtlasZoom ? (url) => onAtlasZoom(url, displayName) : undefined}
              stripColorCodes={stripColorCodes}
            />

          {/* Atlas region editor */}
          {atlasDef && packsWithFile.length > 0 && (
            <div className={`flex-shrink-0 rounded-lg border ${darkMode ? "border-slate-700" : "border-slate-200"}`}>
              <div className={`px-3 py-2 ${darkMode ? "bg-slate-900/50" : "bg-slate-50"}`}>
                <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                  {atlasDef.label} — Region Overrides
                </span>
                <p className={`text-xs mt-0.5 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                  Pick a different pack for each region. On export, regions are composited onto the base atlas.
                </p>
              </div>
              <div className={`px-3 py-3 ${darkMode ? "bg-slate-900/50" : "bg-slate-50"}`}>
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-[220px]">
                    <div className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>HUD preview</div>
                    <p className={`text-xs mt-1 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>This shows the selected GUI slice as it will appear in the atlas when the override is applied.</p>
                  </div>
                  <div className={`flex items-center gap-2 rounded-lg border p-2 ${darkMode ? "border-slate-600 bg-black/30" : "border-slate-300 bg-black/30"}`}>
                    {previewRegion && regionPreviewUrls[previewRegion.id] ? (
                      <img
                        src={regionPreviewUrls[previewRegion.id]}
                        alt={previewRegion.label}
                        className={`h-14 w-14 rounded-md border object-contain checkered`}
                        style={{ imageRendering: "pixelated" }}
                      />
                    ) : (
                      <div className="h-14 w-14 rounded-md border border-dashed bg-black/30" />
                    )}
                    <div className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                      <div className={`font-semibold ${darkMode ? "text-slate-200" : "text-slate-700"}`}>{previewRegion?.label ?? "Region"}</div>
                      <div>Live slice preview</div>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                {atlasDef.regions.filter(region => !region.mapsTo).map((region) => {
                  const regionPackId = regionOverrides[region.id];
                  const regionOverridePack = packsWithFile.find(p => p.id === regionPackId);
                  const isPreviewedRegion = previewRegion?.id === region.id;
                  const mappedRegions = atlasDef.regions.filter(r => r.mapsTo === region.id);
                  return (
                    <div
                      key={region.id}
                      className={`flex items-center gap-3 px-3 py-2.5 ${isPreviewedRegion ? (darkMode ? "bg-slate-700/50" : "bg-slate-100") : ""}`}
                    >
                      {regionPreviewUrls[region.id] ? (
                        <img
                          src={regionPreviewUrls[region.id]}
                          alt={region.label}
                          className="h-10 w-10 rounded border bg-black/40 object-contain flex-shrink-0 checkered"
                          style={{ imageRendering: "pixelated" }}
                        />
                      ) : (
                        <div className="h-10 w-10 rounded border border-dashed bg-black/30 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${darkMode ? "text-slate-200" : "text-slate-700"}`}>{region.label}</span>
                          {regionPackId && <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:text-dark-text-tertiary font-semibold">override</span>}
                          {mappedRegions.length > 0 && <span className="text-[10px] uppercase tracking-[0.2em] text-black dark:text-dark-text500 font-semibold">→ {mappedRegions.map(r => r.label).join(', ')}</span>}
                        </div>
                        <div className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                          {region.description} · ({region.x},{region.y}) {region.w}×{region.h}px
                        </div>
                      </div>
                      <div className="flex gap-1 flex-wrap justify-end">
                        <button
                          className={`text-xs px-2 py-0.5 rounded transition-colors ${!regionPackId ? "bg-slate-200 dark:bg-dark-tertiary text-slate-700 dark:text-dark-text-secondary font-semibold" : (darkMode ? "text-dark-text-tertiary hover:bg-dark-tertiary" : "text-slate-500 hover:bg-slate-100")}`}
                          onClick={() => {
                            setPreviewRegionId(region.id);
                            onAtlasRegionOverride(texturePath, region.id, null);
                          }}
                        >
                          auto
                        </button>
                        {packsWithFile.map((p) => (
                          <button
                            key={p.id}
                            className={`text-xs px-2 py-0.5 rounded transition-colors max-w-[80px] truncate ${regionPackId === p.id ? "font-semibold" : (darkMode ? "text-slate-400 hover:bg-slate-700" : "text-slate-500 hover:bg-slate-100")}`}
                            style={regionPackId === p.id ? { background: p.color + "33", color: p.color } : {}}
                            onClick={() => {
                              setPreviewRegionId(region.id);
                              onAtlasRegionOverride(texturePath, region.id, regionPackId === p.id ? null : p.id);
                            }}
                            title={stripColorCodes(p.name)}
                          >
                            {stripColorCodes(p.name)}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className={`px-3 py-3 ${darkMode ? "bg-slate-900/50" : "bg-slate-50"}`}>

          {/* Whole-file pack selector for non-atlas or as fallback */}
          {packsWithFile.length > 1 && (
            <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Whole file:</span>
              <button
                className={`text-xs px-2 py-0.5 rounded transition-colors ${!overridePackId ? "bg-slate-200 dark:bg-dark-tertiary text-slate-700 dark:text-dark-text-secondary font-semibold" : "text-muted-foreground dark:text-dark-text-tertiary hover:bg-accent dark:hover:bg-dark-tertiary"}`}
                onClick={() => onOverride(texturePath, null)}
              >
                auto
              </button>
              {packsWithFile.map((p) => (
                <button
                  key={p.id}
                  className={`text-xs px-2 py-0.5 rounded transition-colors max-w-[80px] truncate ${overridePackId === p.id ? "font-semibold" : "text-muted-foreground hover:bg-accent"}`}
                  style={overridePackId === p.id ? { background: p.color + "33", color: p.color } : {}}
                  onClick={() => onOverride(texturePath, overridePackId === p.id ? null : p.id)}
                  title={stripColorCodes(p.name)}
                >
                  {stripColorCodes(p.name)}
                </button>
              ))}
            </div>
          )}
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Image Cropper ─────────────────────────────────────────────────────────────

const CROP_DISPLAY = 300;

function ImageCropper({
  src,
  onCrop,
  onCancel,
}: {
  src: string;
  onCrop: (dataUrl: string) => void;
  onCancel: () => void;
}) {
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

// ─── Settings Modal ─────────────────────────────────────────────────────────────

function SettingsModal({
  texturesPerRow,
  onTexturesPerRowChange,
  defaultPackName,
  defaultPackDescription,
  defaultPackIcon,
  onDefaultNameChange,
  onDefaultDescriptionChange,
  onDefaultIconChange,
  onDefaultIconRemove,
  copyFromTopPack,
  onCopyFromTopPackChange,
  onClose,
}: {
  texturesPerRow: number;
  onTexturesPerRowChange: (n: number) => void;
  defaultPackName: string;
  defaultPackDescription: string;
  defaultPackIcon: string | null;
  onDefaultNameChange: (v: string) => void;
  onDefaultDescriptionChange: (v: string) => void;
  onDefaultIconChange: (dataUrl: string) => void;
  onDefaultIconRemove: () => void;
  copyFromTopPack: boolean;
  onCopyFromTopPackChange: (v: boolean) => void;
  onClose: () => void;
}) {
  const iconInputRef = useRef<HTMLInputElement>(null);
  const { theme } = useTheme();
  const darkMode = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const handleIconFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => onDefaultIconChange(reader.result as string);
    reader.readAsDataURL(f);
    e.target.value = "";
  };

  const clampCols = (n: number) => Math.max(1, Math.min(12, n));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-76 rounded-xl shadow-2xl flex flex-col overflow-hidden bg-white border-slate-200 dark:bg-dark-secondary dark:border-dark-border"
        style={{ width: 288 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-dark-border">
          <span className="font-semibold text-sm text-slate-700 dark:text-dark-text">Settings</span>
          <button onClick={onClose} className="text-lg leading-none text-slate-400 hover:text-slate-700 dark:hover:text-dark-text">✕</button>
        </div>

        {/* Display */}
        <div className="px-4 py-3 flex flex-col gap-3 border-b border-slate-200 dark:border-dark-border">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-dark-text-tertiary">Display</span>

          <div className="flex items-center gap-2">
            <span className="text-sm flex-1 text-slate-700 dark:text-dark-text-secondary">Textures per row</span>
            <button
              onClick={() => onTexturesPerRowChange(clampCols(texturesPerRow - 1))}
              className="w-7 h-7 rounded text-sm font-bold flex items-center justify-center transition-colors bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 dark:bg-dark-tertiary dark:hover:bg-dark-border dark:border-dark-border dark:text-dark-text-secondary"
            >−</button>
            <input
              type="number"
              value={texturesPerRow}
              onChange={(e) => onTexturesPerRowChange(clampCols(parseInt(e.target.value) || 6))}
              className="w-10 text-center rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:ring-white/20 focus:border-blue-500 bg-white border-slate-200 text-slate-700 dark:bg-dark-tertiary dark:border-dark-border dark:text-dark-text-secondary"
              min={1} max={12}
            />
            <button
              onClick={() => onTexturesPerRowChange(clampCols(texturesPerRow + 1))}
              className="w-7 h-7 rounded text-sm font-bold flex items-center justify-center transition-colors bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 dark:bg-dark-tertiary dark:hover:bg-dark-border dark:border-dark-border dark:text-dark-text-secondary"
            >+</button>
          </div>

        </div>

{/* Upload defaults */}
        <div className="px-4 py-3 flex flex-col gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-dark-text-tertiary">Upload defaults</span>

          {/* Copy from top pack */}
          <div className="flex items-center gap-2">
            <span className="text-sm flex-1 text-slate-700 dark:text-dark-text-secondary">Copy from top imported pack</span>
            <button
              onClick={() => onCopyFromTopPackChange(!copyFromTopPack)}
              className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${copyFromTopPack ? "bg-black dark:bg-dark-text" : "bg-slate-200 dark:bg-dark-tertiary"}`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${copyFromTopPack ? "right-0.5" : "left-0.5"}`}
              />
            </button>
          </div>
          <div className="text-xs text-slate-500 dark:text-dark-text-tertiary">
            When enabled, copies icon, name, and description from the top imported pack. When disabled, uses manual defaults.
          </div>

          {/* Icon */}
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <button
                className="w-14 h-14 rounded border overflow-hidden checkered transition-colors cursor-pointer border-slate-200 dark:border-dark-border hover:border-white dark:hover:border-dark-text bg-slate-50 dark:bg-dark-tertiary"
                onClick={() => iconInputRef.current?.click()}
                title="Click to set pack icon"
              >
                {defaultPackIcon ? (
                  <img src={defaultPackIcon} className="w-full h-full object-cover texture-preview" />
                ) : (
                  <svg className="w-6 h-6 text-slate-400 dark:text-dark-text-tertiary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M12 13v8" /><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /><path d="m8 17 4-4 4 4" /></svg>
                )}
              </button>
              {defaultPackIcon && (
                <button
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center hover:opacity-90"
                  onClick={onDefaultIconRemove}
                  title="Remove icon"
                >✕</button>
              )}
            </div>
            <input ref={iconInputRef} type="file" accept="image/*" className="hidden" onChange={handleIconFile} />
            <div className="flex-1 text-xs text-slate-500 dark:text-dark-text-tertiary">
              {defaultPackIcon ? "Click icon to replace" : "Click icon to upload"}
              <br />These values are used as defaults for new uploads.
            </div>
          </div>

          {/* Name */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 dark:text-dark-text-tertiary">Default pack name</label>
            <input
              type="text"
              value={defaultPackName}
              onChange={(e) => onDefaultNameChange(e.target.value)}
              className="rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black dark:ring-white/20 focus:border-blue-500 bg-white border-slate-200 text-slate-700 dark:bg-dark-tertiary dark:border-dark-border dark:text-dark-text-secondary"
              placeholder="My Resource Pack"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 dark:text-dark-text-tertiary">Default description (pack.mcmeta)</label>
            <input
              type="text"
              value={defaultPackDescription}
              onChange={(e) => onDefaultDescriptionChange(e.target.value)}
              className="rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black dark:ring-white/20 focus:border-blue-500 bg-white border-slate-200 text-slate-700 dark:bg-dark-tertiary dark:border-dark-border dark:text-dark-text-secondary"
              placeholder="A Minecraft resource pack"
            />
          </div>

          {/* Save button */}
          <button
            onClick={onClose}
            className="mt-2 w-full py-2.5 rounded-lg text-sm font-semibold transition-colors bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 shadow-lg"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Analyze Pack Modal ─────────────────────────────────────────────────────

function AnalyzePackModal({
  analysis,
  isAnalyzing,
  onClose,
  darkMode,
}: {
  analysis: PackAnalysis | null;
  isAnalyzing: boolean;
  onClose: () => void;
  darkMode: boolean;
}) {
  const cardBase = `rounded-lg border p-3 shadow-sm ${darkMode ? "border-dark-border bg-dark-secondary" : "border-slate-200 bg-white"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className={`max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border p-5 shadow-2xl ${darkMode ? "border-dark-border bg-dark-secondary" : "border-slate-200 bg-white"}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-[0.24em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Pack analysis</p>
            <h3 className={`text-xl font-semibold ${darkMode ? "text-slate-100" : "text-slate-700"}`}>Resource pack overview</h3>
          </div>
          <button onClick={onClose} className={`rounded-full border px-2.5 py-1 text-sm ${darkMode ? "border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200" : "border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-700"}`}>✕</button>
        </div>

        {isAnalyzing || !analysis ? (
          <div className={`mt-6 flex min-h-[220px] items-center justify-center rounded-lg border border-dashed ${darkMode ? "border-slate-700 bg-slate-800" : "border-slate-300 bg-slate-50"}`}>
            <div className="text-center">
              <div className={`mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full text-2xl ${darkMode ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-500/10 text-emerald-600"}`}>✨</div>
              <p className={`text-sm font-medium ${darkMode ? "text-slate-200" : "text-slate-700"}`}>Scanning the current pack locally…</p>
              <p className={`mt-1 text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Using the current uploaded ZIP data and atlas definitions.</p>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <div className={`rounded-lg border p-4 border-emerald-500/30 bg-emerald-500/10 ${darkMode ? "" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className={`text-sm font-semibold ${darkMode ? "text-slate-200" : "text-slate-700"}`}>{analysis.packNames.join(", ") || "Loaded pack"}</p>
                  <p className={`mt-1 text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{analysis.overallSummary}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300`}>
                    1.8.9 compatible
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className={cardBase}>
                <p className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>File size</p>
                <p className={`mt-2 text-xl font-semibold ${darkMode ? "text-slate-100" : "text-slate-700"}`}>{analysis.totalSizeLabel}</p>
                <p className={`mt-1 text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{analysis.totalFiles} files inspected</p>
              </div>
              <div className={cardBase}>
                <p className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Base texture resolution</p>
                <p className={`mt-2 text-xl font-semibold ${darkMode ? "text-slate-100" : "text-slate-700"}`}>{analysis.baseTextureResolution}</p>
                <p className={`mt-1 text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{analysis.mixedResolutions ? "Mixed resolutions detected" : "Consistent texture size"}</p>
              </div>
              <div className={cardBase}>
                <p className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Total textures</p>
                <p className={`mt-2 text-xl font-semibold ${darkMode ? "text-slate-100" : "text-slate-700"}`}>{analysis.modifiedTextureCount}</p>
                <p className={`mt-1 text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Unique textures in pack</p>
              </div>
              <div className={cardBase}>
                <p className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Missing textures</p>
                <p className={`mt-2 text-xl font-semibold ${darkMode ? "text-slate-100" : "text-slate-700"}`}>{analysis.missingTextures.length}</p>
                <p className={`mt-1 text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Core textures not found</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Texture Editor Modal ───────────────────────────────────────────────────

function isValidHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function hexToRgbColor(value: string): [number, number, number] {
  const normalized = isValidHexColor(value) ? value.slice(1) : "000000";
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
}

function rgbToHexColor(red: number, green: number, blue: number): string {
  const channel = (value: number) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0");
  return `#${channel(red)}${channel(green)}${channel(blue)}`;
}



function applyRecolorToPixel(r: number, g: number, b: number, options: { mode: RecolorMode; color: string; intensity: number }): { r: number; g: number; b: number } {
  const [targetR, targetG, targetB] = hexToRgbColor(options.color);
  const intensity = options.intensity;
  
  switch (options.mode) {
    case "tint": {
      return {
        r: Math.round(r + (targetR - r) * intensity),
        g: Math.round(g + (targetG - g) * intensity),
        b: Math.round(b + (targetB - b) * intensity),
      };
    }
    case "colorize": {
      const avg = (r + g + b) / 3;
      return {
        r: Math.round(avg + (targetR - avg) * intensity),
        g: Math.round(avg + (targetG - avg) * intensity),
        b: Math.round(avg + (targetB - avg) * intensity),
      };
    }
    case "multiply": {
      return {
        r: Math.round(r * (targetR / 255) * (1 + intensity)),
        g: Math.round(g * (targetG / 255) * (1 + intensity)),
        b: Math.round(b * (targetB / 255) * (1 + intensity)),
      };
    }
    case "overlay": {
      const overlay = (base: number, over: number) => {
        return base < 128 
          ? Math.round(2 * base * over / 255)
          : Math.round(255 - 2 * (255 - base) * (255 - over) / 255);
      };
      const blendedR = overlay(r, targetR);
      const blendedG = overlay(g, targetG);
      const blendedB = overlay(b, targetB);
      return {
        r: Math.round(r + (blendedR - r) * intensity),
        g: Math.round(g + (blendedG - g) * intensity),
        b: Math.round(b + (blendedB - b) * intensity),
      };
    }
    case "hue-shift": {
      // Convert to HSL, shift hue, convert back
      const toHsl = (red: number, green: number, blue: number) => {
        const r = red / 255, g = green / 255, b = blue / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0, l = (max + min) / 2;
        
        if (max !== min) {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
          }
        }
        return { h: h * 360, s, l };
      };
      
      const toRgb = (h: number, s: number, l: number) => {
        let r, g, b;
        if (s === 0) {
          r = g = b = l;
        } else {
          const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
          };
          const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
          const p = 2 * l - q;
          r = hue2rgb(p, q, h / 360 + 1/3);
          g = hue2rgb(p, q, h / 360);
          b = hue2rgb(p, q, h / 360 - 1/3);
        }
        return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
      };
      
      const currentHsl = toHsl(r, g, b);
      const targetHsl = toHsl(targetR, targetG, targetB);
      const hueShift = (targetHsl.h - currentHsl.h) * intensity;
      const newHsl = { h: (currentHsl.h + hueShift + 360) % 360, s: currentHsl.s, l: currentHsl.l };
      const newRgb = toRgb(newHsl.h, newHsl.s, newHsl.l);
      
      return newRgb;
    }
    default:
      return { r, g, b };
  }
}

function TextureEditorModal({
  texturePath,
  displayName,
  folder,
  packs,
  activePackId,
  onSave,
  onClose,
  darkMode,
  checkerboardStyle,
}: {
  texturePath: string;
  displayName: string;
  folder: string;
  packs: Pack[];
  activePackId: string | null;
  onSave: (path: string, packId: string | null, buffer: ArrayBuffer) => void;
  onClose: () => void;
  darkMode: boolean;
  checkerboardStyle: 'light' | 'dark';
}) {
  const isTextFile = /\.(json|mcmeta|txt|lang|properties|yml|yaml|toml|cfg|conf|ini)$/i.test(texturePath);
  
  const [tool, setTool] = useState<EditorTool>("pencil");
  const [color, setColor] = useState("#000000");
  const [hexInput, setHexInput] = useState("#000000");
  const [brushSize, setBrushSize] = useState(1);
  const [selectedPixels, setSelectedPixels] = useState<Set<string>>(new Set());
  const [recolorMode, setRecolorMode] = useState<RecolorMode>("tint");
  const [recolorIntensity, setRecolorIntensity] = useState(0.6);
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
      return { entries, index: entries.length - 1 };
    });
  }, []);

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
  
  const getRgbGradient = (channel: number, rgb: [number, number, number]) => {
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
    }

    if (e.type === "pointerdown" || (e.type === "pointermove" && e.buttons === 1)) {
      let next = imageData;
      if (tool === "pencil" || tool === "eraser") {
        next = applyBrush(imageData, px, py, color, brushSize, tool === "eraser" ? "eraser" : "pencil", rectRegion);
      }
      if (next !== imageData) {
        applyImageChange(next);
      }
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
                  <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-10 cursor-pointer rounded border border-slate-200 dark:border-dark-border bg-transparent p-1" aria-label="Color picker" />
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

// ─── File Viewer Modal ───────────────────────────────────────────────────────────

function FileViewerModal({
  pack,
  onClose,
  onDeleteFile,
  darkMode,
  stripColorCodes,
}: {
  pack: Pack;
  onClose: () => void;
  onDeleteFile: (path: string) => void;
  darkMode: boolean;
  stripColorCodes: (name: string) => string;
}) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  // Build file tree structure
  const fileTree = useMemo(() => {
    const tree: Record<string, { type: 'file' | 'folder'; children?: Record<string, any>; size?: number }> = {};
    
    pack.files.forEach((buffer, path) => {
      const parts = path.split('/');
      let current = tree;
      
      parts.forEach((part, index) => {
        const isFile = index === parts.length - 1;
        const key = part;
        
        if (!current[key]) {
          current[key] = isFile 
            ? { type: 'file', size: buffer.byteLength }
            : { type: 'folder', children: {} };
        }
        
        if (!isFile && current[key].children) {
          current = current[key].children;
        }
      });
    });
    
    return tree;
  }, [pack]);

  // Filter files based on search
  const filteredTree = useMemo(() => {
    if (!searchQuery) return fileTree;
    
    const query = searchQuery.toLowerCase();
    const filterNode = (node: any, path: string = ''): any => {
      if (node.type === 'file') {
        return path.toLowerCase().includes(query) ? node : null;
      }
      
      if (node.type === 'folder' && node.children) {
        const filteredChildren: any = {};
        let hasMatchingChild = false;
        
        Object.entries(node.children).forEach(([key, child]) => {
          const childPath = path ? `${path}/${key}` : key;
          const filtered = filterNode(child, childPath);
          if (filtered) {
            filteredChildren[key] = filtered;
            hasMatchingChild = true;
          }
        });
        
        if (hasMatchingChild) {
          return { ...node, children: filteredChildren };
        }
      }
      
      return null;
    };
    
    return filterNode(fileTree);
  }, [fileTree, searchQuery]);

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderNode = (node: any, name: string, path: string = '', level: number = 0) => {
    const fullPath = path ? `${path}/${name}` : name;
    const isExpanded = expandedFolders.has(fullPath);
    
    // Count files in folder
    const countFilesInNode = (n: any): number => {
      if (n.type === 'file') return 1;
      if (n.type === 'folder' && n.children) {
        return Object.values(n.children).reduce((sum: number, child: any) => sum + countFilesInNode(child), 0);
      }
      return 0;
    };
    
    const fileCount = node.type === 'folder' ? countFilesInNode(node) : 0;
    
    if (node.type === 'file') {
      return (
        <div 
          key={fullPath}
          className={`flex items-center gap-2 px-2 py-1.5 hover:bg-accent cursor-pointer group
            ${darkMode ? "text-slate-300 hover:text-slate-100" : "text-slate-600 hover:text-slate-900"}`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
        >
          <span className="text-slate-400">📄</span>
          <span className="flex-1 truncate text-sm">{name}</span>
          <span className="text-xs text-muted-foreground">{formatSize(node.size || 0)}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteFile(fullPath);
            }}
            className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600 transition-opacity"
            title="Delete file"
          >
            🗑️
          </button>
        </div>
      );
    }
    
    if (node.type === 'folder' && node.children) {
      const childKeys = Object.keys(node.children);
      return (
        <div key={fullPath}>
          <div
            className={`flex items-center gap-2 px-2 py-1.5 hover:bg-accent cursor-pointer
              ${darkMode ? "text-slate-300 hover:text-slate-100" : "text-slate-600 hover:text-slate-900"}`}
            style={{ paddingLeft: `${level * 16 + 8}px` }}
            onClick={() => toggleFolder(fullPath)}
          >
            <span>{isExpanded ? '📂' : '📁'}</span>
            <span className="flex-1 truncate text-sm font-medium">{name}</span>
            <span className="text-xs text-muted-foreground">{fileCount} files</span>
          </div>
          {isExpanded && (
            <div>
              {childKeys.map(key => renderNode(node.children[key], key, fullPath, level + 1))}
            </div>
          )}
        </div>
      );
    }
    
    return null;
  };

  const totalSize = Array.from(pack.files.values()).reduce((sum, buffer) => sum + buffer.byteLength, 0);
  const fileCount = pack.files.size;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className={`flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-border bg-white dark:bg-dark-secondary shadow-2xl`} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">File Viewer</p>
            <h3 className="text-lg font-semibold text-foreground">{stripColorCodes(pack.name)}</h3>
            <p className="text-sm text-muted-foreground">{fileCount.toLocaleString()} files • {formatSize(totalSize)}</p>
          </div>
          <button onClick={onClose} className={`rounded-full border-2 border-border bg-secondary px-2.5 py-1 text-sm text-muted-foreground hover:text-foreground`}>✕</button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-border">
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${darkMode ? "sleek-input" : "sleek-input-light"}`}
          />
        </div>

        {/* File Tree */}
        <div className="flex-1 overflow-y-auto p-2">
          {Object.keys(filteredTree).length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              {searchQuery ? "No files match your search" : "This pack is empty"}
            </div>
          ) : (
            <div className="text-sm">
              {Object.entries(filteredTree).map(([name, node]) => renderNode(node, name))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border flex justify-between items-center">
          <p className="text-xs text-muted-foreground">Click folders to expand, click 🗑️ to delete files</p>
          <button onClick={onClose} className="rounded-lg border-2 border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Editor App ──────────────────────────────────────────────────────────────

export default function EditorApp() {
  const { checkerboardStyle, setCheckerboardStyle } = useTheme();
  
  // Create a simple IndexedDB library for local storage
  const localLibrary = getLocalPackLibrary();
  
  // Helper function to strip Minecraft color codes
  const stripColorCodes = (name: string): string => {
    return name.replace(/§[0-9a-fk-or]/gi, '').replace(/&[0-9a-fk-or]/gi, '');
  };

  const [packs, setPacks] = useState<Pack[]>([]);
  const [selectedFolder, setSelectedFolder] = useState("blocks");
  const [folderSources, setFolderSources] = useState<FolderSources>({});
  const [textureOverrides, setTextureOverrides] = useState<TextureOverrides>({});
  const [atlasRegionOverrides, setAtlasRegionOverrides] = useState<Record<string, Record<string, string>>>({});
  const [uploadDefaults, setUploadDefaults] = useState<UploadDefaults>(() => readUploadDefaults());
  const [packName, setPackName] = useState(uploadDefaults.name);
  const [packDescription, setPackDescription] = useState(uploadDefaults.description);
  const [packIcon, setPackIcon] = useState<string | null>(uploadDefaults.icon);
  const [showOpenFilePrompt, setShowOpenFilePrompt] = useState(false);
  const [waitingForFileSelection, setWaitingForFileSelection] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Save editor state to IndexedDB whenever packs or metadata changes
  useEffect(() => {
    if (packs.length > 0) {
      const state: EditorState = {
        packs: packs.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          icon: p.icon,
          fileCount: p.files.size
        })),
        packName,
        packDescription,
        packIcon
      };
      const library = getLocalPackLibrary();
      library.saveEditorState(state).catch(err => {
        console.error('Failed to save editor state:', err);
      });
    }
  }, [packs, packName, packDescription, packIcon]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setExportDropdownOpen(false);
      }
    };

    if (exportDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [exportDropdownOpen]);

  // Restore editor state on mount
  useEffect(() => {
    const library = getLocalPackLibrary();
    library.loadEditorState().then(savedState => {
      if (savedState && savedState.packs && savedState.packs.length > 0) {
        // Only restore metadata, not the actual pack data (too large even for IndexedDB)
        setPackName(savedState.packName || uploadDefaults.name);
        setPackDescription(savedState.packDescription || uploadDefaults.description);
        setPackIcon(savedState.packIcon || null);
        // Note: We can't restore the actual pack data from IndexedDB due to size limits
        // The user will need to reload their pack, but at least the metadata is preserved
      }
    }).catch(err => {
      console.error('Failed to load editor state:', err);
    });
  }, []);

  // Add notification
  const addNotification = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = crypto.randomUUID();
    setNotifications(prev => [...prev, { id, message, type }]);
    
    // Auto-remove after 3 seconds (matches CSS animation)
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 3000);
  }, []);
  const [globalSearch, setGlobalSearch] = useState("");
  const [jumpTarget, setJumpTarget] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ path: string; displayName: string; folder: string } | null>(null);
  const [atlasZoom, setAtlasZoom] = useState<{ url: string; displayName: string } | null>(null);
  // Settings
  const [texturesPerRow, setTexturesPerRow] = useState(6);
  const [showJsonFiles, setShowJsonFiles] = useState(true);
  const [selectedFont, setSelectedFont] = useState(() => {
    if (typeof window === "undefined") return "montserrat";
    const saved = window.localStorage.getItem("mc-pack-editor-font");
    return saved || "montserrat";
  });
  const { theme, setTheme } = useTheme();
  const darkMode = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const layoutMode: LayoutMode = "modern";

  // Save font preference to localStorage
  useEffect(() => {
    window.localStorage.setItem("mc-pack-editor-font", selectedFont);
  }, [selectedFont]);

  // Apply font to document
  useEffect(() => {
    const fontMap: Record<string, string> = {
      "montserrat": "'Montserrat', sans-serif",
      "quicksand": "'Quicksand', sans-serif",
      "jetbrains-mono": "'JetBrains Mono', monospace",
    };
    document.body.style.fontFamily = fontMap[selectedFont] || fontMap["montserrat"];
  }, [selectedFont]);

  // Load pack from library if stored in localStorage flag
  useEffect(() => {
    const loadPackId = localStorage.getItem('mc-pack-editor-load-pack-id');
    if (loadPackId) {
      const library = getLocalPackLibrary();
      library.loadPack(loadPackId).then(async (packData) => {
        if (packData) {
          try {
            // First get the pack metadata to get the original name
            const allPacks = await library.getAllPacks();
            const packInfo = allPacks.find(p => p.id === loadPackId);
            const originalName = packInfo?.name || 'library-pack.zip';
            
            const pack = await loadPackFromFile(new File([packData], originalName));
            setPacks([pack]);
            // Use the original pack name from library, not from loaded pack
            setPackName(packInfo?.name || pack.name);
            setPackDescription(packInfo?.description || pack.description || '');
            setPackIcon(packInfo?.icon || pack.icon || null);
            localStorage.removeItem('mc-pack-editor-load-pack-id');
          } catch (error) {
            console.error('Failed to load pack from library:', error);
            localStorage.removeItem('mc-pack-editor-load-pack-id');
          }
        }
      }).catch(error => {
        console.error('Failed to load pack from IndexedDB:', error);
        localStorage.removeItem('mc-pack-editor-load-pack-id');
      });
    }
  }, []);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  // Close settings menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) {
        setSettingsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [editingTexture, setEditingTexture] = useState<{ path: string; displayName: string; folder: string; packId: string | null } | null>(null);
  const [analysis, setAnalysis] = useState<PackAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  // Pack visibility: missing key = visible
  const [packVisibility, setPackVisibility] = useState<Record<string, boolean>>({});
  const [removedFiles, setRemovedFiles] = useState<Record<string, boolean>>({});
  // Icon cropping
  const [cropSource, setCropSource] = useState<string | null>(null);
  // File viewer
  const [fileViewerPack, setFileViewerPack] = useState<Pack | null>(null);

  const handlePacksLoaded = useCallback((newPacks: Pack[]) => {
    setPacks((prev) => {
      const existing = new Set(prev.map((p) => p.name));
      const deduped = newPacks.filter((p) => !existing.has(p.name));
      // Newest uploads go to the front (highest priority), like in-game behavior
      return [...deduped, ...prev];
    });

    if (uploadDefaults.copyFromTopPack && newPacks.length > 0) {
      const topPack = newPacks[0];
      
      // Try to get pack icon
      const iconBuffer = topPack.files.get("pack.png");
      if (iconBuffer) {
        const iconUrl = arrayBufferToDataURL(iconBuffer, "pack.png");
        setPackIcon(iconUrl);
      } else {
        setPackIcon(null);
      }

      // Try to get pack.mcmeta for name and description
      const mcmetaBuffer = topPack.files.get("pack.mcmeta");
      if (mcmetaBuffer) {
        try {
          const decoder = new TextDecoder();
          const mcmetaText = decoder.decode(mcmetaBuffer);
          const mcmeta = JSON.parse(mcmetaText);
          const packData = mcmeta.pack;
          
          if (packData?.description) {
            // Handle Minecraft formatting codes in description
            let description = packData.description;
            if (typeof description === "object") {
              description = description.text || "";
            }
            // Preserve formatting codes in description
            setPackDescription(description.trim());
          } else {
            setPackDescription(uploadDefaults.description);
          }
        } catch {
          setPackDescription(uploadDefaults.description);
        }
      } else {
        setPackDescription(uploadDefaults.description);
      }

      // Use pack name from filename (preserve color codes for pack settings)
      setPackName(topPack.name);
    } else {
      setPackName(uploadDefaults.name);
      setPackDescription(uploadDefaults.description);
      setPackIcon(uploadDefaults.icon);
    }
  }, [uploadDefaults]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    document.documentElement.style.colorScheme = darkMode ? "dark" : "light";
    window.localStorage.setItem("mc-pack-editor-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    window.localStorage.setItem("mc-pack-editor-upload-defaults", JSON.stringify(uploadDefaults));
  }, [uploadDefaults]);

  useEffect(() => {
    setPackName(uploadDefaults.name);
    setPackDescription(uploadDefaults.description);
    setPackIcon(uploadDefaults.icon);
  }, [uploadDefaults]);

  // Update pack info when pack order changes if copyFromTopPack is enabled
  useEffect(() => {
    if (uploadDefaults.copyFromTopPack && packs.length > 0) {
      const topPack = packs[0];
      
      // Try to get pack icon
      const iconBuffer = topPack.files.get("pack.png");
      if (iconBuffer) {
        const iconUrl = arrayBufferToDataURL(iconBuffer, "pack.png");
        setPackIcon(iconUrl);
      } else {
        setPackIcon(null);
      }

      // Try to get pack.mcmeta for name and description
      const mcmetaBuffer = topPack.files.get("pack.mcmeta");
      if (mcmetaBuffer) {
        try {
          const decoder = new TextDecoder();
          const mcmetaText = decoder.decode(mcmetaBuffer);
          const mcmeta = JSON.parse(mcmetaText);
          const packData = mcmeta.pack;
          
          if (packData?.description) {
            // Handle Minecraft formatting codes in description
            let description = packData.description;
            if (typeof description === "object") {
              description = description.text || "";
            }
            // Preserve formatting codes in description
            setPackDescription(description.trim());
          } else {
            setPackDescription(uploadDefaults.description);
          }
        } catch {
          setPackDescription(uploadDefaults.description);
        }
      } else {
        setPackDescription(uploadDefaults.description);
      }

      // Use pack name from filename (preserve color codes for pack settings)
      setPackName(topPack.name);
    }
  }, [packs, uploadDefaults.copyFromTopPack, uploadDefaults.name, uploadDefaults.description]);

  const removePack = useCallback((id: string) => {
    setPacks((prev) => prev.filter((p) => p.id !== id));
    setFolderSources((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => { if (next[k] === id) delete next[k]; });
      return next;
    });
    setTextureOverrides((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => { if (next[k] === id) delete next[k]; });
      return next;
    });
    setAtlasRegionOverrides((prev) => {
      const next: typeof prev = {};
      for (const [path, regions] of Object.entries(prev)) {
        const filtered: Record<string, string> = {};
        for (const [regionId, packId] of Object.entries(regions)) {
          if (packId !== id) filtered[regionId] = packId;
        }
        if (Object.keys(filtered).length > 0) next[path] = filtered;
      }
      return next;
    });
  }, []);

  const clearAllPacks = useCallback(() => {
    if (!confirm("Are you sure you want to clear all packs and start a new project? This cannot be undone.")) return;
    
    setPacks([]);
    setFolderSources({});
    setTextureOverrides({});
    setAtlasRegionOverrides({});
    setPackVisibility({});
    setRemovedFiles({});
    setPackName(uploadDefaults.name);
    setPackDescription(uploadDefaults.description);
    setPackIcon(uploadDefaults.icon);
    setSelectedFolder("blocks");
    setGlobalSearch("");
    setJumpTarget(null);
    setLightbox(null);
    setEditingTexture(null);
    setAnalysis(null);
    
    // Clear editor state from IndexedDB
    const library = getLocalPackLibrary();
    library.clearEditorState().catch(err => {
      console.error('Failed to clear editor state:', err);
    });
  }, [uploadDefaults.name, uploadDefaults.description, uploadDefaults.icon]);

  const handleViewFiles = useCallback((packId: string) => {
    const pack = packs.find(p => p.id === packId);
    if (pack) {
      setFileViewerPack(pack);
    }
  }, [packs]);

  const handleAtlasRegionOverride = useCallback((atlasPath: string, regionId: string, packId: string | null) => {
    setAtlasRegionOverrides((prev) => {
      const next = { ...prev, [atlasPath]: { ...prev[atlasPath] } };

      const atlasDef = getAtlasDefinition(atlasPath);
      const region = atlasDef?.regions.find((r) => r.id === regionId);

      if (packId === null) {
        delete next[atlasPath][regionId];
        // Also remove override for regions that map to this region (e.g., hardcore hearts map to normal hearts)
        const mappedRegions = atlasDef?.regions.filter((r) => r.mapsTo === regionId) || [];
        for (const mappedRegion of mappedRegions) {
          delete next[atlasPath][mappedRegion.id];
        }
      } else {
        next[atlasPath][regionId] = packId;
        // Also set override for regions that map to this region (e.g., hardcore hearts map to normal hearts)
        const mappedRegions = atlasDef?.regions.filter((r) => r.mapsTo === regionId) || [];
        for (const mappedRegion of mappedRegions) {
          next[atlasPath][mappedRegion.id] = packId;
        }
      }

      if (Object.keys(next[atlasPath]).length === 0) delete next[atlasPath];
      return next;
    });
  }, []);

  const handleFolderSource = useCallback((folder: string, packId: string | null) => {
    setFolderSources((prev) => {
      const next = { ...prev };
      if (packId === null) delete next[folder];
      else next[folder] = packId;
      return next;
    });
  }, []);

  const handleOverride = useCallback((path: string, packId: string | null) => {
    setTextureOverrides((prev) => {
      const next = { ...prev };
      if (packId === null) delete next[path];
      else next[path] = packId;
      return next;
    });
  }, []);

  const handleSaveTextureEdit = useCallback((path: string, packId: string | null, buffer: ArrayBuffer) => {
    setPacks((prev) => {
      const targetId = packId ?? prev.find((p) => p.files.has(path))?.id ?? null;
      if (!targetId) return prev;
      return prev.map((pack) => {
        if (pack.id !== targetId) return pack;
        const nextFiles = new Map(pack.files);
        nextFiles.set(path, buffer);
        return { ...pack, files: nextFiles };
      });
    });
  }, []);

  const handleOpenTextureEditor = useCallback((path: string, displayName: string, folder: string) => {
    const selectedPack = packs.find((pack) => {
      const overridePackId = textureOverrides[path];
      if (overridePackId) return pack.id === overridePackId;
      const folderPackId = folderSources[folder];
      if (folderPackId) return pack.id === folderPackId;
      return pack.files.has(path);
    }) ?? packs.find((pack) => pack.files.has(path)) ?? null;

    setEditingTexture({ path, displayName, folder, packId: selectedPack?.id ?? null });
  }, [packs, textureOverrides, folderSources]);

  const handleExport = useCallback(async () => {
    if (!packs.length) return;
    setExporting(true);
    try {
      const blob = await exportMergedPack(
        packs,
        folderSources,
        textureOverrides,
        atlasRegionOverrides,
        packName,
        packDescription,
        packIcon,
        removedFiles
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // § is valid Unicode and Minecraft renders it as color — only strip truly illegal filename chars
      const safeFilename = packName
        .replace(/[\\/:*?"<>|\x00-\x1f]/g, "")  // illegal on Windows/macOS/Linux
        .trim()
        || "resource_pack";
      a.download = `${safeFilename}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      // Also save to library
      const arrayBuffer = await blob.arrayBuffer();
      try {
        // Use IndexedDB library for large storage capacity
        await localLibrary.savePack(packName, packDescription, packIcon, arrayBuffer);
      } catch (error) {
        console.error("Failed to save to library:", error);
        // Don't block export if library save fails
      }
    } catch (e) {
      console.error("Export failed:", e);
      alert("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }, [packs, folderSources, textureOverrides, atlasRegionOverrides, packName, packDescription, packIcon, removedFiles]);

  const handleSaveToLibrary = useCallback(async () => {
    if (!packs.length) return;
    setExporting(true);
    try {
      const blob = await exportMergedPack(
        packs,
        folderSources,
        textureOverrides,
        atlasRegionOverrides,
        packName,
        packDescription,
        packIcon,
        removedFiles
      );
      const arrayBuffer = await blob.arrayBuffer();
      
      console.log('Saving to library');
      
      try {
        // Use IndexedDB library for large storage capacity
        await localLibrary.savePack(packName, packDescription, packIcon, arrayBuffer);
        console.log('Saved to library successfully');
        addNotification("Pack saved to library!", "success");
      } catch (error) {
        console.error("Failed to save to library:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        addNotification(`Failed to save: ${errorMessage}`, "error");
      }
    } catch (e) {
      console.error("Save failed:", e);
      addNotification(`Save failed: ${e instanceof Error ? e.message : 'Unknown error'}`, "error");
    } finally {
      setExporting(false);
    }
  }, [packs, folderSources, textureOverrides, atlasRegionOverrides, packName, packDescription, packIcon, removedFiles, addNotification]);

  const handleAnalyze = useCallback(async () => {
    if (!packs.length) return;
    setAnalysisOpen(true);
    setAnalyzing(true);
    try {
      const result = await analyzePackBundle(packs);
      setAnalysis(result);
    } catch (e) {
      console.error("Pack analysis failed:", e);
      setAnalysis({
        packNames: packs.map((pack) => stripColorCodes(pack.name)),
        packCount: packs.length,
        totalFiles: 0,
        totalSizeBytes: 0,
        totalSizeLabel: "0 B",
        baseTextureResolution: "N/A",
        mixedResolutions: false,
        resolutions: [],
        modifiedTextureCount: 0,
        texturesByFolder: new Map(),
        missingTextures: [],
        duplicateTextures: [],
        animatedTextures: [],
        invalidAnimations: [],
        atlasAnalysis: [],
        overallSummary: "The pack could not be analyzed successfully.",
      });
    } finally {
      setAnalyzing(false);
    }
  }, [packs]);

  const handleGeneratePreview = useCallback(() => {
    if (!packs.length) return;
    setPreviewOpen(true);
  }, [packs]);

  const reorderPacks = useCallback((newOrder: Pack[]) => {
    setPacks(newOrder);
  }, []);

  const handleColorChange = useCallback((id: string, color: string) => {
    setPacks((prev) => prev.map((p) => (p.id === id ? { ...p, color } : p)));
  }, []);

  const handleTextureImport = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.png')) return;
    
    const arrayBuffer = await file.arrayBuffer();
    const dataUrl = arrayBufferToDataURL(arrayBuffer, file.name);
    
    // Create a simple pack with just this texture
    const newPack: Pack = {
      id: `imported-${Date.now()}`,
      name: file.name.replace('.png', ''),
      color: '#3b82f6',
      files: new Map([[
        `assets/minecraft/textures/${file.name}`,
        arrayBuffer
      ]])
    };
    
    setPacks((prev) => [newPack, ...prev]);
  }, []);

  const handleCreateFromScratch = useCallback(async () => {
    console.log('=== Create from Scratch triggered ===');
    try {
      // Load default textures from public folder
      console.log('Attempting to load default pack from /textures/default-pack.zip');
      const response = await fetch('/textures/default-pack.zip');
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        throw new Error('Default pack not found');
      }
      
      const arrayBuffer = await response.arrayBuffer();
      console.log('Default pack loaded, size:', arrayBuffer.byteLength);
      
      const pack = await loadPackFromFile(new File([arrayBuffer], 'default-minecraft-pack.zip'));
      console.log('Pack loaded successfully:', pack.name);
      
      setPacks((prev) => [pack, ...prev]);
      
      // Set default pack metadata
      setPackName('Minecraft Default');
      setPackDescription('Default Minecraft textures');
      
      // Try to get pack icon
      const iconBuffer = pack.files.get("pack.png");
      if (iconBuffer) {
        const iconUrl = arrayBufferToDataURL(iconBuffer, "pack.png");
        setPackIcon(iconUrl);
      }
      
      console.log('=== Create from Scratch completed successfully ===');
    } catch (error) {
      console.error("Failed to load default pack:", error);
      alert("Default textures not found. Please download Minecraft default textures and place them in public/textures/default-pack.zip");
      // Fallback to old behavior
      window.open('https://www.curseforge.com/api/v1/mods/690071/files/4370838/download', '_blank');
      setTimeout(() => setShowOpenFilePrompt(true), 1000);
    }
  }, []);

  const handleConfirmOpenFile = useCallback(() => {
    setWaitingForFileSelection(true);
    // Trigger the file input click
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 100);
  }, []);

  const handleOpenDownloadedFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setWaitingForFileSelection(false);
      return;
    }
    
    try {
      const pack = await loadPackFromFile(file);
      setPacks((prev) => [pack, ...prev]);
      setShowOpenFilePrompt(false);
      setWaitingForFileSelection(false);
    } catch (error) {
      console.error("Failed to load pack:", error);
      alert("Failed to load the downloaded file. Please try again.");
      setWaitingForFileSelection(false);
    }
  }, []);

  const handleVisibilityToggle = useCallback((id: string) => {
    setPackVisibility((prev) => ({ ...prev, [id]: prev[id] === false ? true : false }));
  }, []);

  const toggleRemovedFile = useCallback((path: string) => {
    setRemovedFiles((prev) => ({ ...prev, [path]: !prev[path] }));
  }, []);

  const visiblePacks = useMemo(
    () => packs.filter((p) => packVisibility[p.id] !== false),
    [packs, packVisibility]
  );

  const textureOverrideCount = Object.keys(textureOverrides).length;
  const atlasRegionOverrideCount = Object.values(atlasRegionOverrides).reduce(
    (sum, regionOverrides) => sum + Object.keys(regionOverrides).length,
    0,
  );
  const folderSourceCount = Object.values(folderSources).filter(Boolean).length;
  const totalOverrideCount = textureOverrideCount + atlasRegionOverrideCount + folderSourceCount;

  useEffect(() => {
    if (!jumpTarget) return;
    const target = document.getElementById(`texture-card-${jumpTarget}`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setJumpTarget(null);
  }, [jumpTarget, globalSearch, selectedFolder]);

  const jumpToOverriddenTexture = (path: string) => {
    setSelectedFolder(getTextureFolder(path));
    setGlobalSearch("");
    setJumpTarget(path);
  };

  const jumpToOverriddenFolder = (folder: string) => {
    setSelectedFolder(folder);
    setGlobalSearch("");
    setJumpTarget(null);
  };

  return (
    <div className={`flex flex-col h-screen overflow-hidden ${darkMode ? "dark bg-dark-bg text-dark-text" : "bg-slate-50 text-slate-900"}`}>
      {/* ── Top Navigation Bar ── */}
      <nav className={`flex-shrink-0 px-6 py-3 border-b ${darkMode ? "border-dark-border bg-dark-secondary" : "border-slate-200 bg-white"}`} style={{ position: 'relative', zIndex: 50 }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="relative" ref={settingsMenuRef}>
                <button
                  onClick={() => setSettingsMenuOpen(!settingsMenuOpen)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors text-slate-500 hover:text-slate-700 dark:text-dark-text-tertiary dark:hover:text-dark-text"
                  title="Settings"
                >
                  <svg 
                    className="w-5 h-5" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth={2} 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </button>
                {settingsMenuOpen && (
                  <div className={`absolute top-full left-0 mt-2 w-64 rounded-lg shadow-xl border z-[9999] bg-white dark:bg-dark-secondary border-slate-200 dark:border-dark-border`}>
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-slate-700 dark:text-dark-text">Settings</span>
                        <button onClick={() => setSettingsMenuOpen(false)} className="text-lg leading-none text-slate-400 hover:text-slate-700 dark:hover:text-dark-text">✕</button>
                      </div>
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-700 dark:text-dark-text-secondary">Textures per row</span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => setTexturesPerRow(Math.max(1, texturesPerRow - 1))} className="w-7 h-7 rounded text-sm font-bold flex items-center justify-center transition-colors bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 dark:bg-dark-tertiary dark:hover:bg-dark-border dark:border-dark-border dark:text-dark-text-secondary">−</button>
                            <span className="w-6 text-center text-sm text-slate-700 dark:text-dark-text-secondary">{texturesPerRow}</span>
                            <button onClick={() => setTexturesPerRow(Math.min(12, texturesPerRow + 1))} className="w-7 h-7 rounded text-sm font-bold flex items-center justify-center transition-colors bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 dark:bg-dark-tertiary dark:hover:bg-dark-border dark:border-dark-border dark:text-dark-text-secondary">+</button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-700 dark:text-dark-text-secondary">Show text files</span>
                          <button
                            onClick={() => setShowJsonFiles(!showJsonFiles)}
                            className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${showJsonFiles ? "bg-black dark:bg-dark-text" : "bg-slate-200 dark:bg-dark-tertiary"}`}
                          >
                            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${showJsonFiles ? "right-0.5" : "left-0.5"}`} />
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-700 dark:text-dark-text-secondary">Light checkerboard</span>
                          <button
                            onClick={() => setCheckerboardStyle(checkerboardStyle === 'dark' ? 'light' : 'dark')}
                            className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${checkerboardStyle === 'light' ? "bg-black dark:bg-dark-text" : "bg-slate-200 dark:bg-dark-tertiary"}`}
                          >
                            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${checkerboardStyle === 'light' ? "right-0.5" : "left-0.5"}`} />
                          </button>
                        </div>
                        <div className={`border-t border-slate-200 dark:border-dark-border pt-3`}>
                          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-dark-text-tertiary">Upload defaults</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-700 dark:text-dark-text-secondary">Copy from top pack</span>
                          <button
                            onClick={() => setUploadDefaults((prev) => ({ ...prev, copyFromTopPack: !prev.copyFromTopPack }))}
                            className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${uploadDefaults.copyFromTopPack ? "bg-black dark:bg-dark-text" : "bg-slate-200 dark:bg-dark-tertiary"}`}
                          >
                            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${uploadDefaults.copyFromTopPack ? "right-0.5" : "left-0.5"}`} />
                          </button>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-slate-500 dark:text-dark-text-tertiary">Default pack name</label>
                          <input
                            type="text"
                            value={uploadDefaults.name}
                            onChange={(e) => setUploadDefaults((prev) => ({ ...prev, name: e.target.value }))}
                            className="rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black dark:ring-white/20 focus:border-blue-500 bg-white border-slate-200 text-slate-700 dark:bg-dark-tertiary dark:border-dark-border dark:text-dark-text-secondary"
                            placeholder="My Resource Pack"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-slate-500 dark:text-dark-text-tertiary">Default description</label>
                          <input
                            type="text"
                            value={uploadDefaults.description}
                            onChange={(e) => setUploadDefaults((prev) => ({ ...prev, description: e.target.value }))}
                            className="rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black dark:ring-white/20 focus:border-blue-500 bg-white border-slate-200 text-slate-700 dark:bg-dark-tertiary dark:border-dark-border dark:text-dark-text-secondary"
                            placeholder="A Minecraft resource pack"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className={`flex items-center gap-2 text-sm ${darkMode ? "text-dark-text-tertiary" : "text-slate-500"}`}>
              {packs.length > 0 && (
                <>
                  <span className={`px-3 py-1.5 rounded-full ${darkMode ? "bg-dark-tertiary text-dark-text-secondary" : "bg-slate-100 text-slate-600"}`}>{packs.length} pack{packs.length !== 1 ? "s" : ""}</span>
                  <span className={`px-3 py-1.5 rounded-full ${darkMode ? "bg-dark-tertiary text-dark-text-secondary" : "bg-slate-100 text-slate-600"}`}>{Object.keys(textureOverrides).length + Object.values(atlasRegionOverrides).reduce((sum, r) => sum + Object.keys(r).length, 0)} override{Object.keys(textureOverrides).length + Object.values(atlasRegionOverrides).reduce((sum, r) => sum + Object.keys(r).length, 0) !== 1 ? "s" : ""}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {packs.length > 0 && (
              <>
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${darkMode ? "text-dark-text-secondary hover:text-dark-text hover:bg-dark-tertiary" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"}`}
                >
                  <span className={analyzing ? "animate-pulse" : ""}>✨</span>
                  {analyzing ? "Analyzing…" : "Analyze"}
                </button>
                <button
                  onClick={handleGeneratePreview}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${darkMode ? "text-dark-text-secondary hover:text-dark-text hover:bg-dark-tertiary" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"}`}
                >
                  👁 Preview
                </button>
                <div className="relative" ref={exportDropdownRef}>
                  <button
                    onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
                    disabled={exporting}
                    className="px-6 py-2 text-sm font-medium text-white dark:text-black bg-black dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-200 hover:scale-105 hover:shadow-lg transition-all duration-200 rounded-2xl disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none flex items-center gap-2"
                  >
                    {exporting ? "Exporting…" : "Export"}
                    <svg className={`w-4 h-4 transition-transform ${exportDropdownOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {exportDropdownOpen && (
                    <div className={`absolute right-0 mt-2 w-48 rounded-lg shadow-lg border z-50 ${darkMode ? "bg-dark-secondary border-dark-border" : "bg-white border-gray-200"}`}>
                      <button
                        onClick={() => {
                          handleExport();
                          setExportDropdownOpen(false);
                        }}
                        disabled={exporting}
                        className={`w-full text-left px-4 py-3 text-sm rounded-t-lg transition-colors ${darkMode ? "text-dark-text hover:bg-dark-tertiary" : "text-slate-700 hover:bg-gray-100"} disabled:opacity-50`}
                      >
                        Download ZIP
                      </button>
                      <button
                        onClick={() => {
                          handleSaveToLibrary();
                          setExportDropdownOpen(false);
                        }}
                        disabled={exporting}
                        className={`w-full text-left px-4 py-3 text-sm rounded-b-lg transition-colors ${darkMode ? "text-dark-text hover:bg-dark-tertiary" : "text-slate-700 hover:bg-gray-100"} disabled:opacity-50`}
                      >
                        Save to Library
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hidden file input for Create from Scratch */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={handleOpenDownloadedFile}
      />

      {/* Open File Prompt */}
      {showOpenFilePrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]" onClick={() => setShowOpenFilePrompt(false)}>
          <div className={`max-w-md w-full mx-4 rounded-lg p-6 shadow-xl ${darkMode ? "bg-dark-secondary" : "bg-white"}`} onClick={(e) => e.stopPropagation()}>
            <h3 className={`text-lg font-semibold mb-3 ${darkMode ? "text-dark-text" : "text-slate-900"}`}>Select Template Pack</h3>
            {!waitingForFileSelection ? (
              <>
                <p className={`text-sm mb-4 ${darkMode ? "text-dark-text-secondary" : "text-slate-600"}`}>
                  Would you like to select the template pack to load the default textures?
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowOpenFilePrompt(false)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${darkMode ? "bg-dark-tertiary hover:bg-dark-border text-dark-text-secondary" : "bg-slate-100 hover:bg-slate-200 text-slate-700"}`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmOpenFile}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${darkMode ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}`}
                  >
                    Select File
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className={`text-sm mb-4 ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
                  Please select the template pack ZIP file.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setWaitingForFileSelection(false);
                      setShowOpenFilePrompt(false);
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${darkMode ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-700"}`}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Main Content Area ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Sidebar ── */}
        <aside className={`flex-shrink-0 w-64 overflow-x-hidden overflow-y-auto sleek ${darkMode ? "sleek-dark" : "sleek"}`} style={{ borderRadius: 0, borderTop: 'none', borderBottom: 'none', borderLeft: 'none', zIndex: 10 }}>
          <div className={`p-4`}>
            <h2 className={`text-sm font-semibold mb-3 ${darkMode ? "text-dark-text" : "text-slate-700"}`}>Packs</h2>
            <DropZone onLoad={handlePacksLoaded} onTextureImport={handleTextureImport} darkMode={darkMode} />
            <button
              onClick={handleCreateFromScratch}
              className={`w-full mt-3 px-4 py-3 rounded-lg font-medium transition-colors text-sm flex items-center justify-center gap-2 sleek ${darkMode ? "sleek-dark bg-[#C2B280] hover:bg-[#D4C390] text-black" : "bg-[#C2B280] hover:bg-[#D4C390] text-black"}`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Create from Scratch
            </button>
          </div>
          
          {packs.length > 0 && (
            <>
              <div className={`p-4 border-b`}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className={`text-sm font-semibold`}>Pack Order</h2>
                  <button
                    onClick={clearAllPacks}
                    className={`text-xs px-2 py-1 rounded transition-colors hover:bg-white/10 text-red-400 hover:text-red-300`}
                  >
                    Clear all
                  </button>
                </div>
                <PackOrderPanel
                  packs={packs}
                  onReorder={reorderPacks}
                  onRemove={removePack}
                  packVisibility={packVisibility}
                  onVisibilityToggle={handleVisibilityToggle}
                  onViewFiles={handleViewFiles}
                  darkMode={darkMode}
                  stripColorCodes={stripColorCodes}
                />
              </div>
              
              <div className={`p-4 border-b`}>
                <h2 className={`text-sm font-semibold mb-3`}>Pack Settings</h2>
                <PackSettings
                  packName={packName}
                  packDescription={packDescription}
                  packIcon={packIcon}
                  onNameChange={setPackName}
                  onDescriptionChange={setPackDescription}
                  onIconChange={(d) => { if (d === null) setPackIcon(null); else setCropSource(d); }}
                  darkMode={darkMode}
                  stripColorCodes={stripColorCodes}
                />
              </div>
            </>
          )}
          
        </aside>

        {/* ── Main Content ── */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {/* Toolbar */}
          <div className={`flex-shrink-0 px-6 py-3 sleek ${darkMode ? "sleek-dark" : "sleek"}`} style={{ borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none' }}>
            <div className="flex items-center gap-4">
              {packs.length > 0 && (
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search textures..."
                    value={globalSearch}
                    onChange={(e) => setGlobalSearch(e.target.value)}
                    className={`w-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:ring-white/20 focus:border-blue-500 disabled:opacity-50 sleek ${darkMode ? "sleek-dark" : "sleek"}`}
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                {packs.length > 0 && (
                  <>
                    {totalOverrideCount > 0 && (
                      <details className="group relative">
                        <summary className="cursor-pointer list-none flex items-center gap-1 hover:text-foreground">
                          <span className={`text-sm ${darkMode ? "text-dark-text-secondary" : "text-slate-600"}`}>🎯 {totalOverrideCount} override{totalOverrideCount !== 1 ? "s" : ""}</span>
                          {(atlasRegionOverrideCount > 0 || folderSourceCount > 0) && (
                            <span className="text-[10px]">({textureOverrideCount} texture, {atlasRegionOverrideCount} atlas, {folderSourceCount} folder{folderSourceCount !== 1 ? "s" : ""})</span>
                          )}
                          <span className="inline-block transition-transform group-open:rotate-180">⌄</span>
                        </summary>
                        <div className={`absolute right-0 top-full z-[1000] mt-1 max-h-36 w-[400px] overflow-y-auto rounded-lg border p-3 pb-4 shadow-xl ${darkMode ? "border-dark-border bg-dark-secondary" : "border-slate-200 bg-white"}`}>
                          {Object.entries(textureOverrides).map(([path, packId]) => (
                            <div key={path} className="flex items-center gap-2">
                              <button type="button" onClick={() => jumpToOverriddenTexture(path)} className={`flex-1 rounded px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-dark-tertiary ${darkMode ? "text-dark-text-secondary" : "text-slate-700"}`}>
                                <span className="block truncate">{path.split("/").pop()}</span>
                                <span className={`block truncate text-[10px] ${darkMode ? "text-dark-text-tertiary" : "text-slate-500"}`}>Texture override · {packs.find((pack) => pack.id === packId) ? stripColorCodes(packs.find((pack) => pack.id === packId)!.name) : "selected pack"}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOverride(path, null)}
                                className={`p-2 rounded hover:bg-slate-200 dark:hover:bg-dark-tertiary ${darkMode ? "text-dark-text-tertiary hover:text-dark-text-secondary" : "text-slate-500 hover:text-slate-700"}`}
                                title="Revert to auto"
                              >
                                ↺
                              </button>
                            </div>
                          ))}
                          {Object.entries(atlasRegionOverrides).flatMap(([path, regions]) => Object.entries(regions).map(([regionId, packId]) => ({ path, regionId, packId }))).map(({ path, regionId, packId }) => (
                            <div key={`${path}-${regionId}`} className="flex items-center gap-2">
                              <button type="button" onClick={() => jumpToOverriddenTexture(path)} className={`flex-1 rounded px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-dark-tertiary ${darkMode ? "text-dark-text-secondary" : "text-slate-700"}`}>
                                <span className="block truncate">{path.split("/").pop()} · {regionId}</span>
                                <span className={`block truncate text-[10px] ${darkMode ? "text-dark-text-tertiary" : "text-slate-500"}`}>Atlas override · {packs.find((pack) => pack.id === packId) ? stripColorCodes(packs.find((pack) => pack.id === packId)!.name) : "selected pack"}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAtlasRegionOverride(path, regionId, null)}
                                className={`p-2 rounded hover:bg-slate-200 dark:hover:bg-dark-tertiary ${darkMode ? "text-dark-text-tertiary hover:text-dark-text-secondary" : "text-slate-500 hover:text-slate-700"}`}
                                title="Revert to auto"
                              >
                                ↺
                              </button>
                            </div>
                          ))}
                          {Object.entries(folderSources).map(([folder, packId]) => (
                            <div key={folder} className="flex items-center gap-2">
                              <button type="button" onClick={() => jumpToOverriddenFolder(folder)} className={`flex-1 rounded px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-dark-tertiary ${darkMode ? "text-dark-text-secondary" : "text-slate-700"}`}>
                                <span className="block truncate">{folder}</span>
                                <span className={`block truncate text-[10px] ${darkMode ? "text-dark-text-tertiary" : "text-slate-500"}`}>Folder override · {packs.find((pack) => pack.id === packId) ? stripColorCodes(packs.find((pack) => pack.id === packId)!.name) : "selected pack"}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleFolderSource(folder, null)}
                                className={`p-2 rounded hover:bg-slate-200 dark:hover:bg-dark-tertiary ${darkMode ? "text-dark-text-tertiary hover:text-dark-text-secondary" : "text-slate-500 hover:text-slate-700"}`}
                                title="Revert to auto"
                              >
                                ↺
                              </button>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                    <button
                      onClick={() => setSidebarOpen(!sidebarOpen)}
                      className={`px-3 py-2 text-sm rounded-lg transition-colors ${darkMode ? "text-dark-text-secondary hover:text-dark-text hover:bg-dark-tertiary" : "text-black hover:text-black hover:bg-slate-200"} ${sidebarOpen && packs.length > 0 ? "bg-slate-200 dark:bg-dark-tertiary" : ""}`}
                      title="Toggle folder panel"
                    >
                      ☰
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-8">
            {packs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-4">
                <div className={`text-center max-w-4xl w-full rounded-3xl px-12 py-12 ${darkMode ? "bg-dark-secondary" : "bg-white"}`}>
                  <h1 className={`text-5xl font-bold mb-6 tracking-tight ${darkMode ? "text-dark-text" : "text-slate-800"}`}>
                    MCTextureLab
                  </h1>
                  <p className={`text-lg leading-relaxed mb-12 ${darkMode ? "text-dark-text-secondary" : "text-slate-600"}`}>
                    Upload resource pack ZIP files above, or import individual PNG textures to create custom packs.
                  </p>
                  <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 text-left mb-12`}>
                    <div className={`p-6 rounded-xl ${darkMode ? "bg-dark-tertiary" : "bg-white shadow-sm"}`}>
                      <h3 className={`font-semibold mb-2 ${darkMode ? "text-dark-text" : "text-slate-800"}`}>Merge Packs</h3>
                      <p className={`text-sm ${darkMode ? "text-dark-text-secondary" : "text-slate-600"}`}>Combine multiple resource packs with smart override management</p>
                    </div>
                    <div className={`p-6 rounded-xl ${darkMode ? "bg-dark-tertiary" : "bg-white shadow-sm"}`}>
                      <h3 className={`font-semibold mb-2 ${darkMode ? "text-dark-text" : "text-slate-800"}`}>Search & Edit</h3>
                      <p className={`text-sm ${darkMode ? "text-dark-text-secondary" : "text-slate-600"}`}>Search across all textures and edit them with a built-in editor</p>
                    </div>
                    <div className={`p-6 rounded-xl ${darkMode ? "bg-dark-tertiary" : "bg-white shadow-sm"}`}>
                      <h3 className={`font-semibold mb-2 ${darkMode ? "text-dark-text" : "text-slate-800"}`}>Export Packs</h3>
                      <p className={`text-sm ${darkMode ? "text-dark-text-secondary" : "text-slate-600"}`}>Export your custom pack with all overrides preserved</p>
                    </div>
                  </div>
                  <div className={`flex items-center justify-center gap-2 text-base ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                    <span>Drag & drop a ZIP file to get started</span>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {!globalSearch && packs.length > 1 && (
                  <div className={`mb-4 text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                    Click preview to pick pack • Click name for folder default
                  </div>
                )}
                {globalSearch ? (
                  <SearchAllResults
                    query={globalSearch}
                    packs={visiblePacks}
                    folderSources={folderSources}
                    textureOverrides={textureOverrides}
                    onOverride={handleOverride}
                    onOpenLightbox={(path, displayName, folder) => setLightbox({ path, displayName, folder })}
                    onEditTexture={handleOpenTextureEditor}
                    cols={texturesPerRow}
                    removedFiles={removedFiles}
                    onToggleRemove={toggleRemovedFile}
                    layoutMode={layoutMode}
                    darkMode={darkMode}
                    stripColorCodes={stripColorCodes}
                    showJsonFiles={showJsonFiles}
                  />
                ) : (
                  <TextureGrid
                    packs={visiblePacks}
                    folder={selectedFolder}
                    folderSources={folderSources}
                    textureOverrides={textureOverrides}
                    onOverride={handleOverride}
                    onOpenLightbox={(path, displayName, folder) => setLightbox({ path, displayName, folder })}
                    onEditTexture={handleOpenTextureEditor}
                    cols={texturesPerRow}
                    removedFiles={removedFiles}
                    onToggleRemove={toggleRemovedFile}
                    layoutMode={layoutMode}
                    darkMode={darkMode}
                    stripColorCodes={stripColorCodes}
                    showJsonFiles={showJsonFiles}
                  />
                )}
              </>
            )}
          </div>
        </main>

        {/* ── Right Sidebar (Folders) ── */}
        {sidebarOpen && packs.length > 0 && (
          <aside className={`flex-shrink-0 w-64 overflow-x-hidden overflow-y-auto sleek ${darkMode ? "sleek-dark" : "sleek"}`} style={{ borderRadius: 0, borderTop: 'none', borderBottom: 'none', borderRight: 'none', zIndex: 10 }}>
            <div className={`flex items-center justify-between px-4 py-3`}>
              <h2 className={`text-sm font-semibold ${darkMode ? "text-dark-text" : "text-slate-700"}`}>Folders</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className={`p-1 rounded-lg transition-colors hover:bg-white/10 dark:hover:bg-dark-tertiary`}
                title="Close folder panel"
              >
                ✕
              </button>
            </div>
            <FolderSidebar
              packs={visiblePacks}
              selectedFolder={selectedFolder}
              onSelect={setSelectedFolder}
              folderSources={folderSources}
              onFolderSource={handleFolderSource}
              layoutMode={layoutMode}
              darkMode={darkMode}
              stripColorCodes={stripColorCodes}
            />
          </aside>
        )}
      </div>

      {/* ── Texture editor modal ── */}
      {editingTexture && (
        <TextureEditorModal
          texturePath={editingTexture.path}
          displayName={editingTexture.displayName}
          folder={editingTexture.folder}
          packs={packs}
          activePackId={editingTexture.packId}
          onSave={(path, packId, buffer) => {
            handleSaveTextureEdit(path, packId, buffer);
            setEditingTexture(null);
          }}
          onClose={() => setEditingTexture(null)}
          darkMode={darkMode}
          checkerboardStyle={checkerboardStyle}
        />
      )}

      {/* ── Lightbox modal ── */}
      {lightbox && (
        <TextureLightbox
          texturePath={lightbox.path}
          displayName={lightbox.displayName}
          folder={lightbox.folder}
          packs={visiblePacks}
          folderSources={folderSources}
          textureOverrides={textureOverrides}
          atlasRegionOverrides={atlasRegionOverrides}
          onOverride={handleOverride}
          onAtlasRegionOverride={handleAtlasRegionOverride}
          onAtlasZoom={(url) => setAtlasZoom({ url, displayName: lightbox.displayName })}
          onClose={() => setLightbox(null)}
          darkMode={darkMode}
          stripColorCodes={stripColorCodes}
        />
      )}

      {/* ── Atlas zoom modal ── */}
      {atlasZoom && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setAtlasZoom(null)}>
          <div className="max-w-[90vw] max-h-[90vh] rounded-[28px] bg-white dark:bg-dark-bg shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">Atlas Preview</p>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text">{atlasZoom.displayName}</h3>
              </div>
              <button onClick={() => setAtlasZoom(null)} className="rounded-full bg-gray-100 dark:bg-dark-secondary px-2.5 py-1 text-sm text-gray-600 dark:text-dark-text-tertiary hover:bg-gray-200 dark:hover:bg-dark-tertiary">✕</button>
            </div>
            <div className="p-4 flex items-center justify-center">
              <img
                src={atlasZoom.url}
                alt={atlasZoom.displayName}
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
                style={{ imageRendering: "pixelated" }}
              />
            </div>
          </div>
        </div>
      )}

      {analysisOpen && (
        <AnalyzePackModal
          analysis={analysis}
          isAnalyzing={analyzing}
          onClose={() => setAnalysisOpen(false)}
          darkMode={darkMode}
        />
      )}

      {previewOpen && (
        <PreviewModal
          packs={packs}
          onClose={() => setPreviewOpen(false)}
          darkMode={darkMode}
        />
      )}

      {/* ── File Viewer modal ── */}
      {fileViewerPack && (
        <FileViewerModal
          pack={fileViewerPack}
          onClose={() => setFileViewerPack(null)}
          onDeleteFile={(filePath) => {
            if (confirm(`Delete ${filePath} from ${stripColorCodes(fileViewerPack.name)}?`)) {
              setPacks(prev => {
                const updated = prev.map(pack => {
                  if (pack.id === fileViewerPack.id) {
                    const newFiles = new Map(pack.files);
                    newFiles.delete(filePath);
                    const updatedPack = { ...pack, files: newFiles };
                    // Update the file viewer pack immediately to reflect deletion
                    setTimeout(() => setFileViewerPack(updatedPack), 0);
                    return updatedPack;
                  }
                  return pack;
                });
                return updated;
              });
            }
          }}
          darkMode={darkMode}
          stripColorCodes={stripColorCodes}
        />
      )}

      {/* ── Settings modal ── */}
      {settingsOpen && (
        <SettingsModal
          texturesPerRow={texturesPerRow}
          onTexturesPerRowChange={setTexturesPerRow}
          defaultPackName={uploadDefaults.name}
          defaultPackDescription={uploadDefaults.description}
          defaultPackIcon={uploadDefaults.icon}
          onDefaultNameChange={(value) => setUploadDefaults((prev) => ({ ...prev, name: value }))}
          onDefaultDescriptionChange={(value) => setUploadDefaults((prev) => ({ ...prev, description: value }))}
          onDefaultIconChange={(dataUrl) => setUploadDefaults((prev) => ({ ...prev, icon: dataUrl }))}
          onDefaultIconRemove={() => setUploadDefaults((prev) => ({ ...prev, icon: null }))}
          copyFromTopPack={uploadDefaults.copyFromTopPack}
          onCopyFromTopPackChange={(value) => setUploadDefaults((prev) => ({ ...prev, copyFromTopPack: value }))}
          onClose={() => setSettingsOpen(false)}
          checkerboardStyle={checkerboardStyle}
          onCheckerboardStyleChange={setCheckerboardStyle}
        />
      )}

      {/* ── Icon cropper ── */}
      {cropSource && (
        <ImageCropper
          src={cropSource}
          onCrop={(dataUrl) => { setPackIcon(dataUrl); setCropSource(null); }}
          onCancel={() => setCropSource(null)}
        />
      )}

      {/* ── Notifications ── */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className="relative bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden"
            style={{ width: '300px' }}
          >
            <div className="px-4 py-3">
              <p className="text-sm text-gray-800">{notification.message}</p>
            </div>
            <div
              className="h-1"
              style={{
                backgroundColor: notification.type === 'error' ? '#ef4444' : '#22c55e',
                animation: 'progress 3s linear forwards'
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
