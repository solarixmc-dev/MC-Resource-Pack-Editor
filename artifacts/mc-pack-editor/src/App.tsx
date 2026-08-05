import { useState, useCallback, useRef, useMemo, useEffect, DragEvent, type PointerEvent } from "react";
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
import { createCroppedTexturePreviewDataUrl, TEXTURE_THUMBNAIL_SIZE } from "./lib/texturePreview";
import {
  applyBrush,
  applyRecolor,
  imageDataToBuffer,
  loadImageDataFromBuffer,
  pickColorAt,
  type EditorTool,
  type RectRegion,
  type RecolorMode,
} from "./lib/textureEditor";

// ─── Small UI atoms ────────────────────────────────────────────────────────────

function Badge({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200"
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
    default: "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200",
    ghost: "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200",
    primary: "bg-blue-500 text-white hover:bg-blue-600",
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
  darkMode,
}: {
  packs: Pack[];
  onReorder: (newOrder: Pack[]) => void;
  onRemove: (id: string) => void;
  packVisibility: Record<string, boolean>;
  onVisibilityToggle: (id: string) => void;
  darkMode: boolean;
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

  const PRIORITY_LABELS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"];

  return (
    <div ref={containerRef} className="relative flex flex-col min-w-0">
      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors cursor-pointer select-none ${darkMode ? "border-slate-600 bg-slate-700 hover:bg-slate-600 text-slate-200" : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700"}`}
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
        <span className={`text-xs ml-auto ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{open ? "▲" : "▼"}</span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className={`absolute top-full left-0 z-50 mt-1 w-72 border rounded-lg shadow-lg overflow-hidden ${darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}>
          <div className={`px-3 py-2 border-b flex items-center justify-between ${darkMode ? "border-slate-700" : "border-slate-200"}`}>
            <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
              Auto priority order
            </span>
            <span className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>drag to reorder</span>
          </div>
          <p className={`px-3 pt-2 pb-1 text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
            When set to <span className="font-medium text-blue-500">auto</span>, the first pack is preferred. Textures missing from it fall through to the next pack.
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
                    ${isDragging ? "opacity-40 border-blue-500" : darkMode ? "border-transparent hover:border-slate-600 hover:bg-slate-700" : "border-transparent hover:border-slate-200 hover:bg-slate-50"}
                    ${isOver ? "border-blue-500 bg-blue-500/10" : ""}
                  `}
                >
                  {/* Drag handle */}
                  <span className={`text-base leading-none flex-shrink-0 ${darkMode ? "text-slate-500" : "text-slate-400"}`}>⋮⋮</span>

                  {/* Priority badge */}
                  <span
                    className="text-xs font-bold w-7 text-center flex-shrink-0 rounded py-0.5"
                    style={{ background: pack.color + "22", color: pack.color }}
                  >
                    {PRIORITY_LABELS[i] ?? `${i + 1}th`}
                  </span>

                  {/* Color dot (static) */}
                  <span
                    className="w-3.5 h-3.5 rounded-full flex-shrink-0 border border-white/20"
                    style={{ background: pack.color }}
                  />
                  <span className={`text-sm font-medium flex-1 truncate ${darkMode ? "text-slate-200" : "text-slate-700"}`}>
                    {pack.name}
                  </span>

                  {/* File count */}
                  <span className={`text-xs flex-shrink-0 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                    {pack.files.size.toLocaleString()} files
                  </span>

                  {/* Visibility toggle */}
                  <button
                    onClick={(e) => { e.stopPropagation(); onVisibilityToggle(pack.id); }}
                    className={`text-base flex-shrink-0 transition-all leading-none ${packVisibility[pack.id] === false ? "opacity-25 grayscale" : "opacity-70 hover:opacity-100"}`}
                    title={packVisibility[pack.id] === false ? "Hidden from comparison — click to show" : "Visible in comparison — click to hide"}
                  >
                    👁
                  </button>

                  {/* Remove */}
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemove(pack.id); }}
                    className={`text-sm transition-colors flex-shrink-0 ${darkMode ? "text-slate-400 hover:text-red-400" : "text-slate-400 hover:text-red-500"}`}
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

function DropZone({ onLoad, darkMode }: { onLoad: (packs: Pack[]) => void; darkMode: boolean }) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files).filter((f) =>
        f.name.toLowerCase().endsWith(".zip")
      );
      if (!arr.length) return;
      setLoading(true);
      try {
        const loaded = await Promise.all(arr.map(loadPackFromFile));
        onLoad(loaded);
      } catch (e) {
        console.error("Failed to load pack:", e);
      } finally {
        setLoading(false);
      }
    },
    [onLoad]
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
        ${dragging ? "border-blue-500 bg-blue-500/10" : darkMode ? "border-slate-600 hover:border-blue-400 hover:bg-slate-700" : "border-slate-300 hover:border-blue-400 hover:bg-slate-50"}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".zip"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
      <svg className={`w-10 h-10 ${darkMode ? "text-slate-400" : "text-slate-500"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 13v8" /><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /><path d="m8 17 4-4 4 4" />
      </svg>
      {loading ? (
        <p className={`text-sm animate-pulse ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Loading packs…</p>
      ) : (
        <>
          <p className={`text-sm ${darkMode ? "text-slate-300" : "text-slate-600"}`}>Drop ZIP files here</p>
          <p className={`text-xs ${darkMode ? "text-slate-500" : "text-slate-400"}`}>or click to browse</p>
        </>
      )}
    </div>
  );
}

// ─── Texture Import Zone ───────────────────────────────────────────────────

function TextureImportZone({ onImport, darkMode }: { onImport: (file: File) => void; darkMode: boolean }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith('.png')) return;
      onImport(file);
    },
    [onImport]
  );

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) handleFile(files[0]);
      }}
      onClick={() => inputRef.current?.click()}
      className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-2 cursor-pointer transition-colors
        ${dragging ? "border-green-500 bg-green-500/10" : darkMode ? "border-slate-600 hover:border-green-400 hover:bg-slate-700" : "border-slate-300 hover:border-green-400 hover:bg-slate-50"}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".png"
        className="hidden"
        onChange={(e) => e.target.files && handleFile(e.target.files[0])}
      />
      <svg className={`w-5 h-5 ${darkMode ? "text-slate-400" : "text-slate-500"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 13v8" /><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /><path d="m8 17 4-4 4 4" />
      </svg>
      <p className={`text-xs ${darkMode ? "text-slate-300" : "text-slate-600"}`}>Import PNG texture</p>
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
    return <span className="text-slate-400 italic text-xs">{fallback}</span>;
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
}: {
  packName: string;
  packDescription: string;
  packIcon: string | null;
  onNameChange: (n: string) => void;
  onDescriptionChange: (d: string) => void;
  onIconChange: (d: string | null) => void;
  darkMode: boolean;
}) {
  const iconRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLInputElement>(null);
  const [activeField, setActiveField] = useState<"name" | "desc">("desc");
  const [colorCodesOpen, setColorCodesOpen] = useState(false);

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
        className={`w-12 h-12 rounded-lg border flex-shrink-0 overflow-hidden checkered transition-colors cursor-pointer mt-5 ${darkMode ? "border-slate-600 hover:border-blue-400" : "border-slate-200 hover:border-blue-400"}`}
        onClick={() => iconRef.current?.click()}
        title="Click to change pack icon"
      >
        {packIcon ? (
          <img src={packIcon} alt="icon" className="w-full h-full object-cover texture-preview" />
        ) : (
          <svg className="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M12 13v8" /><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /><path d="m8 17 4-4 4 4" /></svg>
        )}
        <input ref={iconRef} type="file" accept="image/*" className="hidden" onChange={handleIcon} />
      </button>

      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        {/* Pack name */}
        <div className="flex flex-col gap-1">
          <label className={`text-xs font-medium ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Output Pack Name</label>
          <input
            ref={nameRef}
            type="text"
            value={packName}
            onFocus={() => setActiveField("name")}
            onChange={(e) => onNameChange(e.target.value)}
            className={`rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-full ${darkMode ? "bg-slate-700 border-slate-600 text-slate-200" : "bg-white border-slate-200 text-slate-700"}`}
            placeholder="My Resource Pack"
          />
          {packName.includes("§") && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-black rounded-lg border border-slate-700 text-sm min-h-[26px]">
              <McText text={packName} fallback="…" />
            </div>
          )}
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1">
          <label className={`text-xs font-medium ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
            Description <span className="opacity-60">(pack.mcmeta)</span>
          </label>
          <input
            ref={descRef}
            type="text"
            value={packDescription}
            onFocus={() => setActiveField("desc")}
            onChange={(e) => onDescriptionChange(e.target.value)}
            className={`rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-full ${darkMode ? "bg-slate-700 border-slate-600 text-slate-200" : "bg-white border-slate-200 text-slate-700"}`}
            placeholder="A Minecraft resource pack"
          />
          {packDescription.includes("§") && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-black rounded-lg border border-slate-700 text-sm min-h-[26px]">
              <McText text={packDescription} fallback="…" />
            </div>
          )}
        </div>

        {/* Format code button */}
        <div className="flex flex-col gap-1">
          <button
            onClick={() => setColorCodesOpen(true)}
            className="flex items-center gap-1.5 text-left"
          >
            <label className={`text-xs font-medium ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Format codes</label>
            <span className={`text-xs ${darkMode ? "text-blue-400" : "text-blue-600"}`}>
              → inserting into <span className="font-semibold">{activeField === "name" ? "Name" : "Description"}</span>
            </span>
          </button>
        </div>
      </div>

      {/* Format codes modal */}
      {colorCodesOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={() => setColorCodesOpen(false)}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div
            className={`relative z-10 w-full max-w-md rounded-xl border shadow-2xl ${darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between px-4 py-3 border-b ${darkMode ? "border-slate-700" : "border-slate-200"}`}>
              <div className="flex flex-col">
                <span className={`text-sm font-semibold ${darkMode ? "text-slate-200" : "text-slate-800"}`}>Minecraft Format Codes</span>
                <span className={`text-xs ${darkMode ? "text-blue-400" : "text-blue-600"}`}>Inserting into {activeField === "name" ? "Name" : "Description"}</span>
              </div>
              <button
                onClick={() => setColorCodesOpen(false)}
                className={`p-1.5 rounded-lg transition-colors ${darkMode ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"}`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
              </button>
            </div>
            <div className="p-4 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Colors</span>
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
                <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Formatting</span>
                <div className="flex flex-wrap gap-1.5">
                  {MC_FORMATS.map(({ code, label, title, style }) => (
                    <button
                      key={code}
                      onMouseDown={(e) => { e.preventDefault(); insertCode(code); }}
                      className={`px-3 h-8 rounded-lg text-sm transition-colors flex-shrink-0 border ${darkMode ? "bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600" : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"}`}
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
        </div>
      )}
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
}: {
  packs: Pack[];
  selectedFolder: string;
  onSelect: (f: string) => void;
  folderSources: FolderSources;
  onFolderSource: (folder: string, packId: string | null) => void;
  layoutMode: LayoutMode;
  darkMode: boolean;
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
      <div key={key} className={`group rounded-lg border transition-all ${active ? "border-blue-400 bg-blue-500/10" : `${darkMode ? "border-slate-700 hover:border-slate-600 hover:bg-slate-700" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`} ${darkMode ? "bg-slate-800" : "bg-white"}`}>
        <button
          className="w-full flex items-center px-3 py-2.5 text-sm text-left rounded-lg"
          onClick={() => onSelect(key)}
        >
          <span className={`flex-1 font-medium leading-snug ${active ? "text-blue-500" : darkMode ? "text-slate-200" : "text-slate-700"}`}>
            {label}
          </span>
        </button>
        {packs.length > 1 && (
          <div className="px-3 pb-2 flex items-center gap-1 flex-wrap">
            <button
              className={`text-xs px-2 py-0.5 rounded transition-colors ${!sourcePackId ? "bg-blue-100 text-blue-600 font-semibold" : darkMode ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"}`}
              onClick={(e) => { e.stopPropagation(); onFolderSource(key, null); }}
              title="Use highest-priority pack for each file"
            >
              auto
            </button>
            {packs.map((p) => (
              <button
                key={p.id}
                className={`text-xs px-2 py-0.5 rounded transition-colors ${sourcePackId === p.id ? "font-semibold" : darkMode ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"}`}
                style={sourcePackId === p.id ? { background: p.color + "33", color: p.color } : {}}
                onClick={(e) => { e.stopPropagation(); onFolderSource(key, p.id); }}
                title={p.name}
              >
                {p.name}
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
  const sourceUrl = useMemo(() => {
    console.log('Creating source URL for:', path, 'Buffer size:', buffer.byteLength);
    return arrayBufferToDataURL(buffer, path);
  }, [buffer, path]);
  const [previewUrl, setPreviewUrl] = useState(sourceUrl);

  useEffect(() => {
    let cancelled = false;
    
    console.log('CroppedTexturePreview for:', path, 'Buffer size:', buffer.byteLength);
    
    // Skip cropping for atlas textures that cause blank screen issues
    const isAtlasTexture = path.toLowerCase().includes('icons.png') || path.toLowerCase().includes('widgets.png');
    
    if (isAtlasTexture) {
      console.log('Skipping cropping for atlas texture:', path);
      setPreviewUrl(sourceUrl);
      return;
    }
    
    createCroppedTexturePreviewDataUrl(buffer, path, size)
      .then((url) => {
        console.log('Cropped preview created for:', path);
        if (!cancelled) setPreviewUrl(url);
      })
      .catch((error) => {
        console.error('Failed to create cropped preview for:', path, error);
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
      onLoad={() => console.log('Image loaded successfully:', path)}
      onError={(e) => console.error('Image failed to load:', path, e)}
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
  isRemoved,
  onToggleRemove,
  layoutMode,
  darkMode,
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
    <div id={`texture-card-${texturePath}`} className={`overflow-hidden flex flex-col rounded-lg border transition-all ${isRemoved ? (darkMode ? "border-red-500 bg-red-950/30 opacity-70" : "border-red-300 bg-red-50 opacity-70") : `${darkMode ? "border-slate-700 bg-slate-800 hover:border-blue-400" : "border-slate-200 bg-white hover:border-blue-300"} shadow-sm`}`}>
      {/* Texture previews row */}
      {isImg && (
        <div
          className={`flex border-b ${darkMode ? "border-slate-700" : "border-slate-100"} ${packsWithFile.length === 1 ? "" : darkMode ? "divide-x divide-slate-700" : "divide-x divide-slate-100"}`}
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
                } ${isSelected && packsWithFile.length > 1 ? "ring-2 ring-inset ring-blue-500" : ""}`}
                onClick={() => {
                  if (packsWithFile.length <= 1) return;
                  if (overridePackId === pack.id) {
                    onOverride(texturePath, null);
                  } else {
                    onOverride(texturePath, pack.id);
                  }
                }}
                title={packsWithFile.length > 1 ? `Use from: ${pack.name}` : pack.name}
              >
                <CroppedTexturePreview buffer={buf} path={texturePath} alt={displayName} />
                {packsWithFile.length > 1 && (
                  <span
                    className="absolute bottom-1 right-1 w-2 h-2 rounded-full"
                    style={{ background: pack.color }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* File label & controls — click label to open lightbox */}
      <div className={`flex items-center gap-1 px-2 py-1.5 ${darkMode ? "bg-slate-700" : "bg-slate-50"}`}>
        <button
          className={`flex-1 min-w-0 text-left transition-colors ${darkMode ? "hover:bg-slate-600" : "hover:bg-slate-100"}`}
          onClick={() => onOpenLightbox?.()}
          title="Click to view larger"
        >
          <div className="flex items-center gap-1 min-w-0">
            {isAtlas && (
              <span className={`text-[10px] font-bold flex-shrink-0 ${darkMode ? "text-blue-400" : "text-blue-600"}`} title="Atlas texture — region editor available">ATL</span>
            )}
            <span className={`text-xs truncate flex-1 ${darkMode ? "text-slate-300" : "text-slate-500"}`} title={displayName}>
              {displayName}
            </span>
            {overridePackId && (
              <span
                className={`text-xs flex-shrink-0 ${darkMode ? "text-blue-400" : "text-blue-600"}`}
                onClick={(e) => { e.stopPropagation(); onOverride(texturePath, null); }}
                title="Clear override"
              >
                ✕
              </span>
            )}
            <span className="text-[10px] text-slate-400 flex-shrink-0">⊞</span>
          </div>
        </button>
        <button
          className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${darkMode ? "bg-slate-800 text-slate-400 hover:bg-slate-600 hover:text-slate-200" : "bg-white text-slate-400 hover:bg-slate-200 hover:text-slate-600"}`}
          onClick={(e) => { e.stopPropagation(); onEditTexture?.(texturePath, displayName, folder); }}
          title="Edit texture"
          aria-label={`Edit ${displayName}`}
        >
          ✎
        </button>
        <button
          className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${darkMode ? "text-slate-400 hover:bg-slate-600 hover:text-slate-200" : "text-slate-400 hover:bg-slate-200 hover:text-slate-600"}`}
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
              className={`text-xs px-1.5 py-0.5 rounded transition-colors ${!overridePackId ? "bg-blue-100 text-blue-600 font-semibold" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"}`}
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
                title={p.name}
              >
                {p.name}
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
  cols,
  removedFiles,
  onToggleRemove,
  layoutMode,
  darkMode,
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
}) {
  const [search, setSearch] = useState("");

  const paths = useMemo(
    () => getAllTexturePathsInFolder(packs, folder),
    [packs, folder]
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
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-3">
        <input
          type="search"
          placeholder="Search in folder…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-secondary border border-border rounded px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 flex-1"
        />
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {filtered.length}/{paths.length} files
        </span>
      </div>

      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
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
}) {
  const allPaths = useMemo(() => {
    const set = new Set<string>();
    for (const pack of packs) {
      pack.files.forEach((_, p) => {
        if (p !== "pack.mcmeta" && p !== "pack.png") set.add(p);
      });
    }
    return [...set].sort();
  }, [packs]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return allPaths.filter((p) => p.toLowerCase().includes(q));
  }, [allPaths, query]);

  if (!filtered.length) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
        <span className="text-3xl">🔍</span>
        <p className="text-sm">No textures match <strong className="text-foreground">"{query}"</strong></p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        {filtered.length} result{filtered.length !== 1 ? "s" : ""} across all folders
      </p>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
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
              />
              <span className="text-[10px] text-muted-foreground text-center truncate px-1">{folder}</span>
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
}: {
  packsWithFile: Pack[];
  texturePath: string;
  effectivePackId: string | null | undefined;
  overridePackId: string | null | undefined;
  composedPreviewUrl: string | null;
  displayName: string;
  onOverride: (path: string, packId: string | null) => void;
  onAtlasZoom?: (url: string, displayName: string) => void;
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
            <div key={pack.id} className="flex w-[184px] flex-shrink-0 flex-col items-center gap-2">
              <button
                type="button"
                className={`checkered rounded-lg p-3 border-2 transition-all ${isSelected ? "border-primary" : "border-transparent hover:border-border"} ${packsWithFile.length > 1 ? "cursor-pointer" : "cursor-default"}`}
                onClick={() => {
                  if (packsWithFile.length <= 1) return;
                  onOverride(texturePath, overridePackId === pack.id ? null : pack.id);
                }}
                title={pack.name}
              >
                <CroppedTexturePreview buffer={buf} path={texturePath} alt={pack.name} size={160} />
              </button>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: pack.color }} />
                <span className="max-w-[160px] truncate text-xs text-muted-foreground">{pack.name}</span>
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
                  className="h-40 w-40 rounded-md border border-border bg-black/50 object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
              </button>
              <button
                className="text-xs px-3 py-1.5 rounded bg-primary/20 text-primary font-semibold hover:bg-primary/30 transition-colors w-full"
                onClick={() => onAtlasZoom && onAtlasZoom(composedPreviewUrl, displayName)}
                title="Zoom atlas preview"
              >
                🔍 Zoom Atlas
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
          <div className={`flex items-center gap-3 border-b px-4 py-3 ${darkMode ? "border-slate-700" : "border-slate-200"}`}>
            <span className={`text-sm font-semibold ${darkMode ? "text-slate-200" : "text-slate-700"}`}>{displayName}</span>
            <span className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{texturePath}</span>
            {atlasDef && (
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${darkMode ? "bg-blue-900/50 text-blue-300" : "bg-blue-100 text-blue-600"}`}>Atlas</span>
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
            />

          {/* Atlas region editor */}
          {atlasDef && packsWithFile.length > 0 && (
            <div className={`flex-shrink-0 rounded-lg border ${darkMode ? "border-slate-700" : "border-slate-200"}`}>
              <div className={`px-3 py-2 border-b ${darkMode ? "bg-slate-900/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                  {atlasDef.label} — Region Overrides
                </span>
                <p className={`text-xs mt-0.5 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                  Pick a different pack for each region. On export, regions are composited onto the base atlas.
                </p>
              </div>
              <div className={`px-3 py-3 border-b ${darkMode ? "bg-slate-900/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
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
                        className="h-14 w-14 rounded-md border bg-black/50 object-contain"
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
              <div className={darkMode ? "divide-y divide-slate-700" : "divide-y divide-slate-200"}>
                {atlasDef.regions.filter(region => !region.mapsTo).map((region) => {
                  const regionPackId = regionOverrides[region.id];
                  const regionOverridePack = packsWithFile.find(p => p.id === regionPackId);
                  const isPreviewedRegion = previewRegion?.id === region.id;
                  const mappedRegions = atlasDef.regions.filter(r => r.mapsTo === region.id);
                  return (
                    <div
                      key={region.id}
                      className={`flex items-center gap-3 px-3 py-2.5 border-l-4 transition-colors ${regionPackId ? "shadow-[inset_0_0_0_1px_rgba(74,222,128,0.35)]" : ""} ${isPreviewedRegion ? (darkMode ? "bg-slate-700/50" : "bg-slate-100") : ""}`}
                      style={{
                        borderLeftColor: regionOverridePack ? regionOverridePack.color : "transparent",
                        background: regionPackId
                          ? "linear-gradient(135deg, rgba(34,197,94,0.08), rgba(15,23,42,0.02))"
                          : undefined,
                      }}
                    >
                      {regionPreviewUrls[region.id] ? (
                        <img
                          src={regionPreviewUrls[region.id]}
                          alt={region.label}
                          className="h-10 w-10 rounded border bg-black/40 object-contain flex-shrink-0"
                          style={{ imageRendering: "pixelated" }}
                        />
                      ) : (
                        <div className="h-10 w-10 rounded border border-dashed bg-black/30 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${darkMode ? "text-slate-200" : "text-slate-700"}`}>{region.label}</span>
                          {regionPackId && <span className="text-[10px] uppercase tracking-[0.2em] text-green-500 font-semibold">override</span>}
                          {mappedRegions.length > 0 && <span className="text-[10px] uppercase tracking-[0.2em] text-blue-500 font-semibold">→ {mappedRegions.map(r => r.label).join(', ')}</span>}
                        </div>
                        <div className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                          {region.description} · ({region.x},{region.y}) {region.w}×{region.h}px
                        </div>
                      </div>
                      <div className="flex gap-1 flex-wrap justify-end">
                        <button
                          className={`text-xs px-2 py-0.5 rounded transition-colors ${!regionPackId ? (darkMode ? "bg-blue-900/50 text-blue-300 font-semibold" : "bg-blue-100 text-blue-600 font-semibold") : (darkMode ? "text-slate-400 hover:bg-slate-700" : "text-slate-500 hover:bg-slate-100")}`}
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
                            title={p.name}
                          >
                            {p.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Whole-file pack selector for non-atlas or as fallback */}
          {uniquePacksWithFile.length > 1 && (
            <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Whole file:</span>
              <button
                className={`text-xs px-2 py-0.5 rounded transition-colors ${!overridePackId ? "bg-primary/20 text-primary font-semibold" : "text-muted-foreground hover:bg-accent"}`}
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
                  title={p.name}
                >
                  {p.name}
                </button>
              ))}
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
  darkMode,
  onDarkModeChange,
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
  darkMode: boolean;
  onDarkModeChange: (v: boolean) => void;
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
        className={`w-76 rounded-xl shadow-2xl flex flex-col overflow-hidden ${darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}
        style={{ width: 288 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-3 border-b ${darkMode ? "border-slate-700" : "border-slate-200"}`}>
          <span className={`font-semibold text-sm ${darkMode ? "text-slate-100" : "text-slate-700"}`}>Settings</span>
          <button onClick={onClose} className={`text-lg leading-none ${darkMode ? "text-slate-400 hover:text-slate-100" : "text-slate-400 hover:text-slate-700"}`}>✕</button>
        </div>

        {/* Display */}
        <div className={`px-4 py-3 flex flex-col gap-3 border-b ${darkMode ? "border-slate-700" : "border-slate-200"}`}>
          <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Display</span>

          <div className="flex items-center gap-2">
            <span className={`text-sm flex-1 ${darkMode ? "text-slate-300" : "text-slate-700"}`}>Textures per row</span>
            <button
              onClick={() => onTexturesPerRowChange(clampCols(texturesPerRow - 1))}
              className={`w-7 h-7 rounded text-sm font-bold flex items-center justify-center transition-colors ${darkMode ? "bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-200" : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700"}`}
            >−</button>
            <input
              type="number"
              value={texturesPerRow}
              onChange={(e) => onTexturesPerRowChange(clampCols(parseInt(e.target.value) || 6))}
              className={`w-10 text-center rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${darkMode ? "bg-slate-700 border-slate-600 text-slate-200" : "bg-white border-slate-200 text-slate-700"}`}
              min={1} max={12}
            />
            <button
              onClick={() => onTexturesPerRowChange(clampCols(texturesPerRow + 1))}
              className={`w-7 h-7 rounded text-sm font-bold flex items-center justify-center transition-colors ${darkMode ? "bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-200" : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700"}`}
            >+</button>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-sm flex-1 ${darkMode ? "text-slate-300" : "text-slate-700"}`}>{darkMode ? "Dark mode" : "Light mode"}</span>
            <button
              onClick={() => onDarkModeChange(!darkMode)}
              className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${darkMode ? "bg-blue-500" : "bg-slate-200"}`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${darkMode ? "right-0.5" : "left-0.5"}`}
              />
            </button>
          </div>

        </div>

{/* Upload defaults */}
        <div className="px-4 py-3 flex flex-col gap-3">
          <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Upload defaults</span>

          {/* Copy from top pack */}
          <div className="flex items-center gap-2">
            <span className={`text-sm flex-1 ${darkMode ? "text-slate-300" : "text-slate-700"}`}>Copy from top imported pack</span>
            <button
              onClick={() => onCopyFromTopPackChange(!copyFromTopPack)}
              className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${copyFromTopPack ? "bg-blue-500" : "bg-slate-200"}`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${copyFromTopPack ? "right-0.5" : "left-0.5"}`}
              />
            </button>
          </div>
          <div className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
            When enabled, copies icon, name, and description from the top imported pack. When disabled, uses manual defaults.
          </div>

          {/* Icon */}
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <button
                className={`w-14 h-14 rounded border overflow-hidden checkered transition-colors cursor-pointer ${darkMode ? "border-slate-600 hover:border-blue-400" : "border-slate-200 hover:border-blue-400"}`}
                onClick={() => iconInputRef.current?.click()}
                title="Click to set pack icon"
              >
                {defaultPackIcon ? (
                  <img src={defaultPackIcon} className="w-full h-full object-cover texture-preview" />
                ) : (
                  <svg className="w-6 h-6 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M12 13v8" /><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /><path d="m8 17 4-4 4 4" /></svg>
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
            <div className={`flex-1 text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
              {defaultPackIcon ? "Click icon to replace" : "Click icon to upload"}
              <br />These values are used as defaults for new uploads.
            </div>
          </div>

          {/* Name */}
          <div className="flex flex-col gap-1">
            <label className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Default pack name</label>
            <input
              type="text"
              value={defaultPackName}
              onChange={(e) => onDefaultNameChange(e.target.value)}
              className={`rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${darkMode ? "bg-slate-700 border-slate-600 text-slate-200" : "bg-white border-slate-200 text-slate-700"}`}
              placeholder="My Resource Pack"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Default description (pack.mcmeta)</label>
            <input
              type="text"
              value={defaultPackDescription}
              onChange={(e) => onDefaultDescriptionChange(e.target.value)}
              className={`rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${darkMode ? "bg-slate-700 border-slate-600 text-slate-200" : "bg-white border-slate-200 text-slate-700"}`}
              placeholder="A Minecraft resource pack"
            />
          </div>

          {/* Save button */}
          <button
            onClick={onClose}
            className={`mt-2 w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${darkMode ? "bg-blue-500 hover:bg-blue-600 text-white shadow-lg" : "bg-blue-500 hover:bg-blue-600 text-white shadow-lg"}`}
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
}: {
  analysis: PackAnalysis | null;
  isAnalyzing: boolean;
  onClose: () => void;
}) {
  const cardBase = "rounded-lg border border-slate-200 bg-white p-3 shadow-sm";
  const toneClasses: Record<string, string> = {
    info: "border-sky-500/30 bg-sky-500/10 text-sky-700",
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-700",
    error: "border-rose-500/30 bg-rose-500/10 text-rose-700",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-lg border border-slate-200 bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Pack analysis</p>
            <h3 className="text-xl font-semibold text-slate-700">Resource pack health overview</h3>
          </div>
          <button onClick={onClose} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-sm text-slate-500 hover:text-slate-700">✕</button>
        </div>

        {isAnalyzing || !analysis ? (
          <div className="mt-6 flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-2xl text-emerald-600">✨</div>
              <p className="text-sm font-medium text-slate-700">Scanning the current pack locally…</p>
              <p className="mt-1 text-sm text-slate-500">Using the current uploaded ZIP data and atlas definitions.</p>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <div className={`rounded-lg border p-4 ${analysis.issues.filter(i => i.severity === "warning").length === 0 ? "border-emerald-500/30 bg-emerald-500/10" : "border-amber-500/30 bg-amber-500/10"}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-700">{analysis.packNames.join(", ") || "Loaded pack"}</p>
                  <p className="mt-1 text-sm text-slate-500">{analysis.overallSummary}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${analysis.issues.filter(i => i.severity === "warning").length === 0 ? "bg-emerald-500/20 text-emerald-700" : "bg-amber-500/20 text-amber-700"}`}>
                    {analysis.issues.filter(i => i.severity === "warning").length === 0 ? "1.8.9 compatible" : "Needs review"}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className={cardBase}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">File size</p>
                <p className="mt-2 text-xl font-semibold text-slate-700">{analysis.totalSizeLabel}</p>
                <p className="mt-1 text-sm text-slate-500">{analysis.totalFiles} files inspected</p>
              </div>
              <div className={cardBase}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Base texture resolution</p>
                <p className="mt-2 text-xl font-semibold text-slate-700">{analysis.baseTextureResolution}</p>
                <p className="mt-1 text-sm text-slate-500">{analysis.mixedResolutions ? "Mixed resolutions detected" : "Consistent texture size"}</p>
              </div>
              <div className={cardBase}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Modified textures</p>
                <p className="mt-2 text-xl font-semibold text-slate-700">{analysis.modifiedTextureCount}</p>
                <p className="mt-1 text-sm text-slate-500">Unique textures reviewed</p>
                {analysis.texturesByFolder.size > 0 && (
                  <div className="mt-3">
                    <select className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                      <option value="">All textures ({analysis.modifiedTextureCount})</option>
                      {Array.from(analysis.texturesByFolder.entries())
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([folder, textures]) => (
                          <option key={folder} value={folder}>
                            {folder} ({textures.length})
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className={cardBase}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">Highlights</p>
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{analysis.issues.length} note{analysis.issues.length === 1 ? "" : "s"}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {analysis.issues.length ? analysis.issues.map((issue) => (
                    <span key={issue.label} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${toneClasses[issue.severity]}`}>
                      {issue.label}
                    </span>
                  )) : <span className="text-sm text-muted-foreground">No major issues detected.</span>}
                </div>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className={cardBase}>
                <p className="text-sm font-semibold text-foreground">Missing textures</p>
                {analysis.missingTextures.length ? (
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {analysis.missingTextures.map((entry) => <li key={entry} className="truncate">• {entry}</li>)}
                  </ul>
                ) : <p className="mt-3 text-sm text-muted-foreground">No missing core textures detected.</p>}
              </div>
              <div className={cardBase}>
                <p className="text-sm font-semibold text-foreground">Duplicate textures</p>
                {analysis.duplicateTextures.length ? (
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {analysis.duplicateTextures.map((entry) => <li key={entry} className="truncate">• {entry}</li>)}
                  </ul>
                ) : <p className="mt-3 text-sm text-muted-foreground">No duplicate texture entries detected.</p>}
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className={cardBase}>
                <p className="text-sm font-semibold text-foreground">Animated textures</p>
                {analysis.animatedTextures.length ? (
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {analysis.animatedTextures.map((entry) => <li key={entry} className="truncate">• {entry}</li>)}
                  </ul>
                ) : <p className="mt-3 text-sm text-muted-foreground">No animated texture metadata detected.</p>}
              </div>
              <div className={cardBase}>
                <p className="text-sm font-semibold text-foreground">Invalid animations</p>
                {analysis.invalidAnimations.length ? (
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {analysis.invalidAnimations.map((entry) => <li key={entry} className="truncate">• {entry}</li>)}
                  </ul>
                ) : <p className="mt-3 text-sm text-muted-foreground">Animation metadata looks structurally fine.</p>}
              </div>
            </div>

            <div className={cardBase}>
              <p className="text-sm font-semibold text-foreground">Atlas analysis</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {analysis.atlasAnalysis.map((entry) => (
                  <div key={entry.label} className="rounded-xl border border-border/70 bg-background/70 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{entry.label}</p>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${entry.present ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/15 text-amber-700 dark:text-amber-300"}`}>
                        {entry.present ? "present" : "needs check"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">Required regions: {entry.requiredRegions.join(", ")}</p>
                    {!entry.present && entry.missingRegions.length > 0 && (
                      <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">Missing: {entry.missingRegions.join(", ")}</p>
                    )}
                  </div>
                ))}
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

function rgbChannelGradient(channel: number, rgb: [number, number, number]): string {
  const [r, g, b] = rgb;
  if (channel === 0) return `linear-gradient(to right, rgb(0, ${g}, ${b}), rgb(255, ${g}, ${b}))`;
  if (channel === 1) return `linear-gradient(to right, rgb(${r}, 0, ${b}), rgb(${r}, 255, ${b}))`;
  return `linear-gradient(to right, rgb(${r}, ${g}, 0), rgb(${r}, ${g}, 255))`;
}

function TextureEditorModal({
  texturePath,
  displayName,
  folder,
  packs,
  activePackId,
  onSave,
  onClose,
}: {
  texturePath: string;
  displayName: string;
  folder: string;
  packs: Pack[];
  activePackId: string | null;
  onSave: (path: string, packId: string | null, buffer: ArrayBuffer) => void;
  onClose: () => void;
}) {
  const isTextFile = /\.(json|mcmeta|txt|lang)$/i.test(texturePath);
  
  const [tool, setTool] = useState<EditorTool>("pencil");
  const [color, setColor] = useState("#22c55e");
  const [hexInput, setHexInput] = useState("#22c55e");
  const [brushSize, setBrushSize] = useState(1);
  const [colorInputMode, setColorInputMode] = useState<"hex" | "rgb">("hex");
  const [recolorMode, setRecolorMode] = useState<RecolorMode>("tint");
  const [recolorIntensity, setRecolorIntensity] = useState(0.6);
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [textContent, setTextContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [activeRegionId, setActiveRegionId] = useState<string>("whole");
  const [hasChanges, setHasChanges] = useState(false);
  const [editHistory, setEditHistory] = useState<{ entries: ImageData[]; index: number }>({ entries: [], index: -1 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasFrameRef = useRef<HTMLDivElement>(null);
  const [canvasScale, setCanvasScale] = useState(1);

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
    ctx.putImageData(imgData, 0, 0);
  }, [imageData]);

  useEffect(() => {
    let cancelled = false;
    const pack = packs.find((entry) => entry.id === activePackId) ?? packs.find((entry) => entry.files.has(texturePath)) ?? null;
    const buffer = pack?.files.get(texturePath);
    if (!buffer) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    
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
      console.log('Loading image:', texturePath, 'Buffer size:', buffer.byteLength);
      loadImageDataFromBuffer(buffer, texturePath)
        .then((next) => {
          console.log('Image loaded successfully:', texturePath, 'Dimensions:', next.width, 'x', next.height);
          if (!cancelled) {
            setImageData(next);
            setHasChanges(false);
            setEditHistory({ entries: [next], index: 0 });
            setActiveRegionId("whole");
          }
        })
        .catch((error) => {
          console.error('Failed to load image:', texturePath, error);
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

  // Keep the backing canvas at the texture's native resolution.  Only its CSS
  // size changes, and only in whole-pixel increments, so every displayed cell
  // still maps to exactly one source texture pixel.
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
    if (editHistory.index <= 0) return;
    const index = editHistory.index - 1;
    setImageData(editHistory.entries[index]);
    setEditHistory((previous) => ({ ...previous, index }));
    setHasChanges(index > 0);
  }, [editHistory]);

  const redoEdit = useCallback(() => {
    if (editHistory.index >= editHistory.entries.length - 1) return;
    const index = editHistory.index + 1;
    setImageData(editHistory.entries[index]);
    setEditHistory((previous) => ({ ...previous, index }));
    setHasChanges(true);
  }, [editHistory]);

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

    window.addEventListener("keydown", handleKeyboardShortcut);
    return () => window.removeEventListener("keydown", handleKeyboardShortcut);
  }, [redoEdit, undoEdit]);

  const rgbColor = useMemo(() => hexToRgbColor(color), [color]);
  const updateRgbColor = (channel: number, value: number) => {
    const next = [...rgbColor];
    next[channel] = value;
    setColor(rgbToHexColor(next[0], next[1], next[2]));
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
    applyImageChange(applyRecolor(imageData, { mode: recolorMode, color, intensity: recolorIntensity }));
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-border bg-white dark:bg-slate-950 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Texture editor</p>
            <h3 className="text-lg font-semibold text-foreground">{displayName}</h3>
            <p className="text-sm text-muted-foreground">{texturePath}</p>
          </div>
          <div className="flex items-center gap-2">
            {!isTextFile && (
              <>
                <button type="button" className="rounded-lg border-2 border-border bg-secondary px-2.5 py-1.5 text-lg leading-none text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40" onClick={undoEdit} disabled={editHistory.index <= 0} title="Undo (Ctrl/Cmd+Z)" aria-label="Undo">↶</button>
                <button type="button" className="rounded-lg border-2 border-border bg-secondary px-2.5 py-1.5 text-lg leading-none text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40" onClick={redoEdit} disabled={editHistory.index >= editHistory.entries.length - 1} title="Redo (Ctrl/Cmd+Y)" aria-label="Redo">↷</button>
              </>
            )}
            <button onClick={onClose} className="rounded-full border-2 border-border bg-secondary px-2.5 py-1 text-sm text-muted-foreground hover:text-foreground">✕</button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 rounded-[24px] border-2 border-border bg-white dark:bg-slate-900 p-3">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">{isTextFile ? "Text Editor" : "Canvas"}</p>
                <p className="text-xs text-muted-foreground">{isTextFile ? "Edit the text content directly. Changes are saved back to the selected pack on export." : "Paint directly into the texture. The edit is saved back to the selected pack on export."}</p>
              </div>
              {!isTextFile && atlasDef && (
                <select value={activeRegionId} onChange={(e) => setActiveRegionId(e.target.value)} className="rounded border-2 border-border bg-white dark:bg-slate-700 px-2 py-1 text-sm text-foreground">
                  {regionOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              )}
            </div>
            <div
              ref={canvasFrameRef}
              className="flex h-[clamp(20rem,58vh,39rem)] min-h-[20rem] items-center justify-center overflow-auto rounded-2xl border-2 border-border bg-white dark:bg-slate-900 p-3"
            >
              {isLoading ? (
                <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">Loading {isTextFile ? "text" : "texture"}…</div>
              ) : isTextFile ? (
                <textarea
                  value={textContent}
                  onChange={(e) => {
                    setTextContent(e.target.value);
                    setHasChanges(true);
                  }}
                  className="w-full h-full rounded-lg border-2 border-border bg-white dark:bg-slate-700 p-3 font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                  spellCheck={false}
                />
              ) : canEdit ? (
                <div className="checkered relative inline-block rounded-lg border-2 border-border p-1 shadow-inner">
                  <canvas
                    ref={canvasRef}
                    className="mx-auto block"
                    style={{
                      // CSS scaling leaves canvas.width/height (and therefore saved PNG pixels) untouched.
                      width: `${imageData?.width ? imageData.width * canvasScale : 0}px`,
                      height: `${imageData?.height ? imageData.height * canvasScale : 0}px`,
                      imageRendering: "pixelated",
                      cursor: tool === "eyedropper" ? "crosshair" : "cell",
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
                      className="pointer-events-none absolute border-2 border-amber-400 bg-amber-300/20 shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
                      style={{
                        left: `${4 + selectedRegion.x * canvasScale}px`,
                        top: `${4 + selectedRegion.y * canvasScale}px`,
                        width: `${selectedRegion.w * canvasScale}px`,
                        height: `${selectedRegion.h * canvasScale}px`,
                      }}
                      title="Atlas region"
                    />
                  )}
                </div>
              ) : (
                <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">This {isTextFile ? "text" : "texture"} could not be loaded for editing.</div>
              )}
            </div>
          </div>

          {!isTextFile && (
            <div className="w-full rounded-lg border-2 border-border bg-white dark:bg-slate-900 p-4">
              <p className="text-sm font-semibold text-foreground">Tools</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  { id: "pencil", label: "Brush" },
                  { id: "eraser", label: "Eraser" },
                  { id: "eyedropper", label: "Eyedropper" },
                ].map((item) => (
                  <button key={item.id} className={`rounded-lg border-2 px-3 py-2 text-sm transition-colors ${tool === item.id ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-foreground hover:bg-accent"}`} onClick={() => setTool(item.id as EditorTool)}>
                    {item.label}
                  </button>
                ))}
              </div>

            <section className="mt-4 rounded-lg border-2 border-border bg-white dark:bg-slate-900 p-3">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Color</label>
                <div className="flex overflow-hidden rounded-lg border-2 border-border text-[11px] font-semibold uppercase tracking-[0.14em]">
                  <button
                    type="button"
                    className={`px-2.5 py-1 transition-colors ${colorInputMode === "hex" ? "bg-primary/15 text-primary" : "bg-white dark:bg-slate-700 text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setColorInputMode("hex")}
                  >
                    Hex
                  </button>
                  <button
                    type="button"
                    className={`border-l-2 border-border px-2.5 py-1 transition-colors ${colorInputMode === "rgb" ? "bg-primary/15 text-primary" : "bg-white dark:bg-slate-700 text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setColorInputMode("rgb")}
                  >
                    RGB
                  </button>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-12 w-14 cursor-pointer rounded border-2 border-border bg-transparent p-1" aria-label="Color picker" />
                {colorInputMode === "hex" ? (
                  <label className="flex-1 text-xs font-medium text-muted-foreground">
                    Hex code
                    <input
                      type="text"
                      value={hexInput}
                      onChange={(e) => { const value = e.target.value; setHexInput(value); if (isValidHexColor(value)) setColor(value); }}
                      onBlur={() => setHexInput(color.toUpperCase())}
                      maxLength={7}
                      spellCheck={false}
                      className="mt-1 w-full rounded border-2 border-border bg-white dark:bg-slate-700 px-2 py-1.5 font-mono text-sm text-foreground"
                      aria-label="Hex color code"
                    />
                  </label>
                ) : (
                  <div className="flex-1 space-y-2">
                    {(["Red", "Green", "Blue"] as const).map((label, index) => (
                      <label key={label} className="grid grid-cols-[2.75rem_1fr_2.5rem] items-center gap-2 text-xs text-muted-foreground">
                        <span>{label}</span>
                        <input
                          type="range"
                          min="0"
                          max="255"
                          value={rgbColor[index]}
                          onChange={(e) => updateRgbColor(index, Number(e.target.value))}
                          aria-label={`${label} value`}
                          className="rgb-channel-slider w-full"
                          style={{ background: rgbChannelGradient(index, rgbColor) }}
                        />
                        <span className="rounded bg-white dark:bg-slate-700 px-1.5 py-1 text-right font-mono text-foreground">{rgbColor[index]}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <div className="mt-4 rounded-lg border-2 border-border bg-white dark:bg-slate-900 p-3">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Brush size</label>
              <input type="range" min="1" max="24" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="mt-2 w-full" />
              <p className="mt-1 text-xs text-muted-foreground">Current size: {brushSize}px</p>
            </div>

            <div className="mt-4 rounded-2xl border-2 border-border bg-white dark:bg-slate-900 p-3">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Recolor</label>
              <select value={recolorMode} onChange={(e) => setRecolorMode(e.target.value as RecolorMode)} className="mt-2 w-full rounded border-2 border-border bg-white dark:bg-slate-700 px-2 py-1 text-sm text-foreground">
                <option value="tint">Tint</option>
                <option value="hue-shift">Hue shift</option>
                <option value="colorize">Colorize</option>
                <option value="multiply">Multiply</option>
                <option value="overlay">Overlay</option>
              </select>
              <input type="range" min="0" max="1" step="0.01" value={recolorIntensity} onChange={(e) => setRecolorIntensity(Number(e.target.value))} className="mt-3 w-full" />
              <p className="mt-1 text-xs text-muted-foreground">Intensity: {recolorIntensity.toFixed(2)}</p>
              <button className="mt-3 rounded-xl border-2 border-border bg-secondary px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent" onClick={handleApplyRecolor}>
                Apply recolor to entire texture
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-2xl border-2 border-border bg-white dark:bg-slate-900 px-3 py-2 text-sm text-muted-foreground">
              <span>{hasChanges ? "Unsaved changes" : "No changes yet"}</span>
              <span>{selectedRegion ? `Target: ${selectedRegion.label}` : "Target: whole texture"}</span>
            </div>

            <div className="mt-4 flex gap-2">
              <button className="flex-1 rounded-xl border-2 border-border bg-secondary px-3 py-2 text-sm font-medium text-foreground hover:bg-accent" onClick={onClose}>Cancel</button>
              <button className="flex-1 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90" onClick={handleSave}>Save</button>
            </div>
          </div>
          )}

          {isTextFile && (
            <div className="w-full rounded-[24px] border-2 border-border bg-white dark:bg-slate-900 p-4">
              <p className="text-sm font-semibold text-foreground">Text File Info</p>
              <div className="mt-3 text-xs text-muted-foreground">
                <p>This is a text file that can be edited directly in the editor above.</p>
                <p className="mt-2">Changes will be saved back to the selected pack on export.</p>
              </div>

              <div className="mt-4 flex items-center justify-between rounded-2xl border-2 border-border bg-white dark:bg-slate-900 px-3 py-2 text-sm text-muted-foreground">
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

// ─── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [selectedFolder, setSelectedFolder] = useState("blocks");
  const [folderSources, setFolderSources] = useState<FolderSources>({});
  const [textureOverrides, setTextureOverrides] = useState<TextureOverrides>({});
  const [atlasRegionOverrides, setAtlasRegionOverrides] = useState<Record<string, Record<string, string>>>({});
  const [uploadDefaults, setUploadDefaults] = useState<UploadDefaults>(() => readUploadDefaults());
  const [packName, setPackName] = useState(uploadDefaults.name);
  const [packDescription, setPackDescription] = useState(uploadDefaults.description);
  const [packIcon, setPackIcon] = useState<string | null>(uploadDefaults.icon);
  const [exporting, setExporting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [globalSearch, setGlobalSearch] = useState("");
  const [jumpTarget, setJumpTarget] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ path: string; displayName: string; folder: string } | null>(null);
  const [atlasZoom, setAtlasZoom] = useState<{ url: string; displayName: string } | null>(null);
  // Settings
  const [texturesPerRow, setTexturesPerRow] = useState(6);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = window.localStorage.getItem("mc-pack-editor-theme");
    return saved ? saved === "dark" : true;
  });
  const layoutMode: LayoutMode = "modern";
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

      // Use pack name from filename
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

      // Use pack name from filename
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
  }, [uploadDefaults.name, uploadDefaults.description, uploadDefaults.icon]);

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
    } catch (e) {
      console.error("Export failed:", e);
    } finally {
      setExporting(false);
    }
  }, [packs, folderSources, textureOverrides, atlasRegionOverrides, packName, packDescription, packIcon, removedFiles]);

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
        packNames: packs.map((pack) => pack.name),
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
        issues: [{ severity: "error", label: "Analysis failed", detail: "The analyzer could not complete because of an unexpected error." }],
      });
    } finally {
      setAnalyzing(false);
    }
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
  const totalOverrideCount = textureOverrideCount + atlasRegionOverrideCount;
  const folderSourceCount = Object.values(folderSources).filter(Boolean).length;

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

  return (
    <div className={`flex flex-col h-screen overflow-hidden ${darkMode ? "bg-slate-900 text-slate-100" : "bg-slate-50 text-slate-900"}`}>
      {/* ── Top Navigation Bar ── */}
      <nav className={`flex-shrink-0 border-b px-6 py-3 ${darkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="relative" ref={settingsMenuRef}>
                <button
                  onClick={() => setSettingsMenuOpen(!settingsMenuOpen)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${darkMode ? "text-slate-300 hover:text-slate-100" : "text-slate-600 hover:text-slate-700"}`}
                  title="Settings"
                >
                  ⚙️
                </button>
                {settingsMenuOpen && (
                  <div className={`absolute top-full left-0 mt-2 w-64 rounded-lg shadow-xl border z-50 ${darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}>
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-3">
                        <span className={`text-sm font-semibold ${darkMode ? "text-slate-100" : "text-slate-700"}`}>Settings</span>
                        <button onClick={() => setSettingsMenuOpen(false)} className={`text-lg leading-none ${darkMode ? "text-slate-400 hover:text-slate-100" : "text-slate-400 hover:text-slate-700"}`}>✕</button>
                      </div>
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <span className={`text-sm ${darkMode ? "text-slate-300" : "text-slate-700"}`}>{darkMode ? "Dark mode" : "Light mode"}</span>
                          <button
                            onClick={() => setDarkMode(!darkMode)}
                            className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${darkMode ? "bg-blue-500" : "bg-slate-200"}`}
                          >
                            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${darkMode ? "right-0.5" : "left-0.5"}`} />
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className={`text-sm ${darkMode ? "text-slate-300" : "text-slate-700"}`}>Textures per row</span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => setTexturesPerRow(Math.max(1, texturesPerRow - 1))} className={`w-7 h-7 rounded text-sm font-bold flex items-center justify-center transition-colors ${darkMode ? "bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-200" : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700"}`}>−</button>
                            <span className={`w-6 text-center text-sm ${darkMode ? "text-slate-200" : "text-slate-700"}`}>{texturesPerRow}</span>
                            <button onClick={() => setTexturesPerRow(Math.min(12, texturesPerRow + 1))} className={`w-7 h-7 rounded text-sm font-bold flex items-center justify-center transition-colors ${darkMode ? "bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-200" : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700"}`}>+</button>
                          </div>
                        </div>
                        <div className={`border-t ${darkMode ? "border-slate-700" : "border-slate-200"} pt-3`}>
                          <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Upload defaults</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className={`text-sm ${darkMode ? "text-slate-300" : "text-slate-700"}`}>Copy from top pack</span>
                          <button
                            onClick={() => setUploadDefaults((prev) => ({ ...prev, copyFromTopPack: !prev.copyFromTopPack }))}
                            className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${uploadDefaults.copyFromTopPack ? "bg-blue-500" : "bg-slate-200"}`}
                          >
                            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${uploadDefaults.copyFromTopPack ? "right-0.5" : "left-0.5"}`} />
                          </button>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Default pack name</label>
                          <input
                            type="text"
                            value={uploadDefaults.name}
                            onChange={(e) => setUploadDefaults((prev) => ({ ...prev, name: e.target.value }))}
                            className={`rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${darkMode ? "bg-slate-700 border-slate-600 text-slate-200" : "bg-white border-slate-200 text-slate-700"}`}
                            placeholder="My Resource Pack"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Default description</label>
                          <input
                            type="text"
                            value={uploadDefaults.description}
                            onChange={(e) => setUploadDefaults((prev) => ({ ...prev, description: e.target.value }))}
                            className={`rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${darkMode ? "bg-slate-700 border-slate-600 text-slate-200" : "bg-white border-slate-200 text-slate-700"}`}
                            placeholder="A Minecraft resource pack"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <span className={`font-semibold ${darkMode ? "text-slate-100" : "text-slate-700"}`}>Resource Pack Editor</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${darkMode ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-500"}`}>1.8</span>
            </div>
            <div className={`flex items-center gap-2 text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
              {packs.length > 0 && (
                <>
                  <span className={`px-3 py-1.5 rounded-full ${darkMode ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600"}`}>{packs.length} pack{packs.length !== 1 ? "s" : ""}</span>
                  <span className={`px-3 py-1.5 rounded-full ${darkMode ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600"}`}>{Object.keys(textureOverrides).length + Object.values(atlasRegionOverrides).reduce((sum, r) => sum + Object.keys(r).length, 0)} override{Object.keys(textureOverrides).length + Object.values(atlasRegionOverrides).reduce((sum, r) => sum + Object.keys(r).length, 0) !== 1 ? "s" : ""}</span>
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
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${darkMode ? "text-slate-300 hover:text-slate-100 hover:bg-slate-700" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"}`}
                >
                  <span className={analyzing ? "animate-pulse" : ""}>✨</span>
                  {analyzing ? "Analyzing…" : "Analyze"}
                </button>
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50"
                >
                  {exporting ? "Exporting…" : "Export"}
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Main Content Area ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Sidebar ── */}
        <aside className={`flex-shrink-0 w-64 border-r ${darkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
          <div className={`p-4 border-b ${darkMode ? "border-slate-700" : "border-slate-100"}`}>
            <h2 className={`text-sm font-semibold mb-3 ${darkMode ? "text-slate-100" : "text-slate-700"}`}>Packs</h2>
            <DropZone onLoad={handlePacksLoaded} darkMode={darkMode} />
          </div>
          
          <div className={`p-4 border-b ${darkMode ? "border-slate-700" : "border-slate-100"}`}>
            <TextureImportZone onImport={handleTextureImport} darkMode={darkMode} />
          </div>
          
          {packs.length > 0 && (
            <>
              <div className={`p-4 border-b ${darkMode ? "border-slate-700" : "border-slate-100"}`}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className={`text-sm font-semibold ${darkMode ? "text-slate-100" : "text-slate-700"}`}>Pack Order</h2>
                  <button
                    onClick={clearAllPacks}
                    className={`text-xs px-2 py-1 rounded transition-colors ${darkMode ? "text-red-400 hover:text-red-300 hover:bg-red-950/30" : "text-red-500 hover:text-red-700 hover:bg-red-50"}`}
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
                  darkMode={darkMode}
                />
              </div>
              
              <div className={`p-4 border-b ${darkMode ? "border-slate-700" : "border-slate-100"}`}>
                <h2 className={`text-sm font-semibold mb-3 ${darkMode ? "text-slate-100" : "text-slate-700"}`}>Pack Settings</h2>
                <PackSettings
                  packName={packName}
                  packDescription={packDescription}
                  packIcon={packIcon}
                  onNameChange={setPackName}
                  onDescriptionChange={setPackDescription}
                  onIconChange={(d) => { if (d === null) setPackIcon(null); else setCropSource(d); }}
                  darkMode={darkMode}
                />
              </div>
            </>
          )}
          
        </aside>

        {/* ── Main Content ── */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {/* Toolbar */}
          <div className={`flex-shrink-0 border-b px-6 py-3 ${darkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search textures..."
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 ${darkMode ? "border-slate-600 bg-slate-700 text-slate-100 placeholder:text-slate-400" : "border-slate-200 bg-white text-slate-700 placeholder:text-slate-400"}`}
                  disabled={packs.length === 0}
                />
              </div>
              <div className="flex items-center gap-2">
                {totalOverrideCount > 0 && (
                  <details className="group relative">
                    <summary className="cursor-pointer list-none flex items-center gap-1 hover:text-foreground">
                      <span className={`text-sm ${darkMode ? "text-slate-300" : "text-slate-600"}`}>🎯 {totalOverrideCount} override{totalOverrideCount !== 1 ? "s" : ""}</span>
                      {atlasRegionOverrideCount > 0 && (
                        <span className="text-[10px]">({textureOverrideCount} texture, {atlasRegionOverrideCount} atlas)</span>
                      )}
                      <span className="inline-block transition-transform group-open:rotate-180">⌄</span>
                    </summary>
                    <div className={`absolute right-0 top-full z-[100] mt-1 max-h-36 w-[400px] overflow-y-auto rounded-lg border p-3 pb-4 shadow-xl ${darkMode ? "border-slate-600 bg-slate-800" : "border-slate-200 bg-white"}`}>
                      {Object.entries(textureOverrides).map(([path, packId]) => (
                        <button key={path} type="button" onClick={() => jumpToOverriddenTexture(path)} className={`block w-full rounded px-4 py-2 text-left hover:bg-slate-700 ${darkMode ? "text-slate-200" : "text-slate-700"}`}>
                          <span className="block truncate">{path.split("/").pop()}</span>
                          <span className={`block truncate text-[10px] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Texture override · {packs.find((pack) => pack.id === packId)?.name ?? "selected pack"}</span>
                        </button>
                      ))}
                      {Object.entries(atlasRegionOverrides).flatMap(([path, regions]) => Object.entries(regions).map(([regionId, packId]) => ({ path, regionId, packId }))).map(({ path, regionId, packId }) => (
                        <button key={`${path}-${regionId}`} type="button" onClick={() => jumpToOverriddenTexture(path)} className={`block w-full rounded px-4 py-2 text-left hover:bg-slate-700 ${darkMode ? "text-slate-200" : "text-slate-700"}`}>
                          <span className="block truncate">{path.split("/").pop()} · {regionId}</span>
                          <span className={`block truncate text-[10px] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Atlas override · {packs.find((pack) => pack.id === packId)?.name ?? "selected pack"}</span>
                        </button>
                      ))}
                    </div>
                  </details>
                )}
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className={`px-3 py-2 text-sm rounded-lg transition-colors ${darkMode ? "text-slate-300 hover:text-slate-100 hover:bg-slate-700" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"} ${sidebarOpen && packs.length > 0 ? "bg-blue-500/15 text-blue-500" : ""}`}
                  title="Toggle folder panel"
                >
                  ☰
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {packs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full">
                <div className={`text-center max-w-lg rounded-2xl border-2 px-10 py-12 ${darkMode ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-white/60"}`}>
                  <h1 className={`text-3xl font-bold mb-4 tracking-tight ${darkMode ? "text-slate-100" : "text-slate-800"}`}>
                    MCTextureLab
                  </h1>
                  <p className={`text-sm leading-relaxed ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                    Upload resource pack ZIP files above, or import individual PNG textures to create custom packs.
                  </p>
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
                  />
                )}
              </>
            )}
          </div>
        </main>

        {/* ── Right Sidebar (Folders) ── */}
        {sidebarOpen && packs.length > 0 && (
          <aside className={`flex-shrink-0 w-64 border-l overflow-y-auto ${darkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
            <div className={`sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b ${darkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
              <h2 className={`text-sm font-semibold ${darkMode ? "text-slate-100" : "text-slate-700"}`}>Folders</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className={`p-1 rounded-lg transition-colors ${darkMode ? "text-slate-400 hover:text-slate-100 hover:bg-slate-700" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"}`}
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
        />
      )}

      {/* ── Atlas zoom modal ── */}
      {atlasZoom && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setAtlasZoom(null)}>
          <div className="max-w-[90vw] max-h-[90vh] rounded-[28px] border border-border bg-background/95 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Atlas Preview</p>
                <h3 className="text-lg font-semibold text-foreground">{atlasZoom.displayName}</h3>
              </div>
              <button onClick={() => setAtlasZoom(null)} className="rounded-full border border-border bg-secondary px-2.5 py-1 text-sm text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="p-4 flex items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_60%)]">
              <img
                src={atlasZoom.url}
                alt={atlasZoom.displayName}
                className="max-w-full max-h-[70vh] object-contain rounded-lg border border-border"
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
        />
      )}

      {/* ── Settings modal ── */}
      {settingsOpen && (
        <SettingsModal
          texturesPerRow={texturesPerRow}
          onTexturesPerRowChange={setTexturesPerRow}
          darkMode={darkMode}
          onDarkModeChange={setDarkMode}
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
    </div>
  );
}
