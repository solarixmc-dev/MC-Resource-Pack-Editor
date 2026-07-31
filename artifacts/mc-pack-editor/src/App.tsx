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
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold"
      style={{ background: color + "22", color, border: `1px solid ${color}55` }}
    >
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
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
    "inline-flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer select-none";
  const variants = {
    default: "bg-secondary text-secondary-foreground hover:bg-accent border border-border",
    ghost: "text-muted-foreground hover:text-foreground hover:bg-accent",
    danger: "bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/30",
    primary: "bg-primary text-primary-foreground hover:opacity-90",
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
}: {
  packs: Pack[];
  onReorder: (newOrder: Pack[]) => void;
  onRemove: (id: string) => void;
  packVisibility: Record<string, boolean>;
  onVisibilityToggle: (id: string) => void;
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
        className="flex items-center gap-2 px-3 py-1.5 rounded border border-border bg-secondary hover:bg-accent text-sm font-medium transition-colors cursor-pointer select-none"
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
        <span className="text-muted-foreground text-xs ml-auto">{open ? "▲" : "▼"}</span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-72 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Auto priority order
            </span>
            <span className="text-xs text-muted-foreground">drag to reorder</span>
          </div>
          <p className="px-3 pt-2 pb-1 text-xs text-muted-foreground">
            When set to <span className="text-primary font-medium">auto</span>, the first pack is preferred. Textures missing from it fall through to the next pack.
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
                    ${isDragging ? "opacity-40 border-primary" : "border-transparent hover:border-border hover:bg-accent/50"}
                    ${isOver ? "border-primary bg-primary/10" : ""}
                  `}
                >
                  {/* Drag handle */}
                  <span className="text-muted-foreground text-base leading-none flex-shrink-0">⋮⋮</span>

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
                  <span className="text-sm text-foreground font-medium flex-1 truncate">
                    {pack.name}
                  </span>

                  {/* File count */}
                  <span className="text-xs text-muted-foreground flex-shrink-0">
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
                    className="text-muted-foreground hover:text-destructive text-sm transition-colors flex-shrink-0"
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

function DropZone({ onLoad }: { onLoad: (packs: Pack[]) => void }) {
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
        ${dragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 hover:bg-accent/30"}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".zip"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
      <div className="text-4xl">📦</div>
      {loading ? (
        <p className="text-sm text-muted-foreground animate-pulse">Loading packs…</p>
      ) : (
        <>
          <p className="text-sm font-medium text-foreground">Drop resource pack ZIPs here</p>
          <p className="text-xs text-muted-foreground">or click to browse — multiple packs supported</p>
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
    return <span className="text-muted-foreground italic text-xs">{fallback}</span>;
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
  { code: "§0", color: "#000000", label: "Black" },
  { code: "§1", color: "#0000AA", label: "Dark Blue" },
  { code: "§2", color: "#00AA00", label: "Dark Green" },
  { code: "§3", color: "#00AAAA", label: "Dark Aqua" },
  { code: "§4", color: "#AA0000", label: "Dark Red" },
  { code: "§5", color: "#AA00AA", label: "Dark Purple" },
  { code: "§6", color: "#FFAA00", label: "Gold" },
  { code: "§7", color: "#AAAAAA", label: "Gray" },
  { code: "§8", color: "#555555", label: "Dark Gray" },
  { code: "§9", color: "#5555FF", label: "Blue" },
  { code: "§a", color: "#55FF55", label: "Green" },
  { code: "§b", color: "#55FFFF", label: "Aqua" },
  { code: "§c", color: "#FF5555", label: "Red" },
  { code: "§d", color: "#FF55FF", label: "Light Purple" },
  { code: "§e", color: "#FFFF55", label: "Yellow" },
  { code: "§f", color: "#FFFFFF", label: "White" },
];

const MC_FORMATS = [
  { code: "§k", label: "Obf", title: "Obfuscated (§k)", style: {} },
  { code: "§l", label: "B",   title: "Bold (§l)",        style: { fontWeight: "bold" as const } },
  { code: "§m", label: "S",   title: "Strikethrough (§m)", style: { textDecoration: "line-through" } },
  { code: "§n", label: "U",   title: "Underline (§n)",   style: { textDecoration: "underline" } },
  { code: "§o", label: "I",   title: "Italic (§o)",      style: { fontStyle: "italic" as const } },
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
}: {
  packName: string;
  packDescription: string;
  packIcon: string | null;
  onNameChange: (n: string) => void;
  onDescriptionChange: (d: string) => void;
  onIconChange: (d: string | null) => void;
}) {
  const iconRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLInputElement>(null);
  const [activeField, setActiveField] = useState<"name" | "desc">("desc");

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
        className="w-12 h-12 rounded border border-border flex-shrink-0 overflow-hidden checkered hover:border-primary transition-colors cursor-pointer mt-5"
        onClick={() => iconRef.current?.click()}
        title="Click to change pack icon"
      >
        {packIcon ? (
          <img src={packIcon} alt="icon" className="w-full h-full object-cover texture-preview" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xl">📦</div>
        )}
        <input ref={iconRef} type="file" accept="image/*" className="hidden" onChange={handleIcon} />
      </button>

      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        {/* Pack name */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-medium">Output Pack Name</label>
          <input
            ref={nameRef}
            type="text"
            value={packName}
            onFocus={() => setActiveField("name")}
            onChange={(e) => onNameChange(e.target.value)}
            className="bg-secondary border border-border rounded px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 w-full font-mono"
            placeholder="My Resource Pack"
          />
          {packName.includes("§") && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-black rounded border border-border/50 text-sm min-h-[26px]">
              <McText text={packName} fallback="…" />
            </div>
          )}
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-medium">
            Description <span className="opacity-60">(pack.mcmeta)</span>
          </label>
          <input
            ref={descRef}
            type="text"
            value={packDescription}
            onFocus={() => setActiveField("desc")}
            onChange={(e) => onDescriptionChange(e.target.value)}
            className="bg-secondary border border-border rounded px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 w-full font-mono"
            placeholder="A Minecraft resource pack"
          />
          {packDescription.includes("§") && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-black rounded border border-border/50 text-sm min-h-[26px]">
              <McText text={packDescription} fallback="…" />
            </div>
          )}
        </div>

        {/* Format code toolbar */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Format codes</label>
            <span className="text-xs text-primary">
              → inserting into <span className="font-semibold">{activeField === "name" ? "Name" : "Description"}</span>
            </span>
          </div>
          <div className="flex flex-wrap gap-1 p-1.5 bg-secondary/50 rounded border border-border overflow-y-auto" style={{ maxHeight: 72 }}>
            {/* Color codes */}
            {MC_COLORS.map(({ code, color, label }) => (
              <button
                key={code}
                onMouseDown={(e) => { e.preventDefault(); insertCode(code); }}
                className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold hover:scale-110 transition-transform flex-shrink-0 border border-white/10"
                style={{
                  background: color === "#000000" || color === "#555555" ? color : color,
                  color: ["#000000","#555555","#0000AA","#00AA00","#00AAAA","#AA0000","#AA00AA"].includes(color) ? "#fff" : "#000",
                }}
                title={`${label} (${code})`}
              >
                A
              </button>
            ))}
            {/* Separator */}
            <div className="w-px h-6 bg-border flex-shrink-0 mx-0.5" />
            {/* Format codes */}
            {MC_FORMATS.map(({ code, label, title, style }) => (
              <button
                key={code}
                onMouseDown={(e) => { e.preventDefault(); insertCode(code); }}
                className="px-2 h-6 rounded text-xs bg-muted hover:bg-accent text-foreground transition-colors flex-shrink-0 border border-border"
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
}: {
  packs: Pack[];
  selectedFolder: string;
  onSelect: (f: string) => void;
  folderSources: FolderSources;
  onFolderSource: (folder: string, packId: string | null) => void;
  layoutMode: LayoutMode;
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
    const modern = layoutMode === "modern";

    return (
      <div key={key} className={`group rounded-2xl border transition-all ${active ? (modern ? "border-primary/40 bg-primary/12" : "bg-primary/15") : (modern ? "border-transparent hover:border-border/70 hover:bg-card/70" : "hover:bg-accent/50")}`}>
        <button
          className={`w-full flex items-center px-3 py-2.5 text-sm text-left ${modern ? "rounded-2xl" : ""}`}
          onClick={() => onSelect(key)}
        >
          <span className={`flex-1 font-medium leading-snug ${active ? "text-primary" : "text-foreground"}`}>
            {label}
          </span>
        </button>
        {packs.length > 1 && (
          <div className="px-3 pb-2 flex items-center gap-1 flex-wrap">
            <button
              className={`text-xs px-2 py-0.5 rounded transition-colors ${!sourcePackId ? "bg-primary/20 text-primary font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
              onClick={(e) => { e.stopPropagation(); onFolderSource(key, null); }}
              title="Use highest-priority pack for each file"
            >
              auto
            </button>
            {packs.map((p) => (
              <button
                key={p.id}
                className={`text-xs px-2 py-0.5 rounded transition-colors ${sourcePackId === p.id ? "font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
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
    <nav className={`flex flex-col gap-1.5 py-2 ${layoutMode === "modern" ? "px-2" : "px-0"}`}>
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
  isRemoved,
  onToggleRemove,
  layoutMode,
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
}) {
  const overridePackId = textureOverrides[texturePath];
  const folderPackId = folderSources[folder];
  const effectivePackId = overridePackId ?? folderPackId;

  const packsWithFile = packs.filter((p) => p.files.has(texturePath));
  if (!packsWithFile.length) return null;

  const isImg = isImagePath(texturePath);
  const isAtlas = !!getAtlasDefinition(texturePath);

  const modern = layoutMode === "modern";

  return (
    <div id={`texture-card-${texturePath}`} className={`overflow-hidden flex flex-col rounded-[22px] border transition-all ${isRemoved ? "border-destructive/40 bg-destructive/10 opacity-70" : modern ? "border-border/70 bg-card/95 shadow-[0_16px_34px_-24px_rgba(15,23,42,0.22)] backdrop-blur-md hover:border-primary/40" : "border-border bg-card hover:border-primary/40"}`}>
      {/* Texture previews row */}
      {isImg && (
        <div
          className={`flex ${modern ? "border-b border-border/70 bg-muted/40" : "border-b border-border"} ${packsWithFile.length === 1 ? "" : "divide-x divide-border"}`}
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
                } ${isSelected && packsWithFile.length > 1 ? "ring-2 ring-inset ring-primary" : ""}`}
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
      <div className={`flex items-center gap-1 px-2 py-1.5 ${modern ? "bg-background/40" : "bg-background/30"}`}>
        <button
          className={`flex-1 min-w-0 text-left transition-colors ${modern ? "hover:bg-accent/50" : "hover:bg-accent/40"}`}
          onClick={() => onOpenLightbox?.()}
          title="Click to view larger"
        >
          <div className="flex items-center gap-1 min-w-0">
            {isAtlas && (
              <span className="text-[10px] text-primary font-bold flex-shrink-0" title="Atlas texture — region editor available">ATL</span>
            )}
            <span className="text-xs text-muted-foreground truncate flex-1" title={displayName}>
              {displayName}
            </span>
            {overridePackId && (
              <span
                className="text-xs text-primary flex-shrink-0"
                onClick={(e) => { e.stopPropagation(); onOverride(texturePath, null); }}
                title="Clear override"
              >
                ✕
              </span>
            )}
            <span className="text-[10px] text-muted-foreground/50 flex-shrink-0">⊞</span>
          </div>
        </button>
        <button
          className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          onClick={(e) => { e.stopPropagation(); onEditTexture?.(texturePath, displayName, folder); }}
          title="Edit texture"
          aria-label={`Edit ${displayName}`}
        >
          ✎
        </button>
      </div>

      <div className={`flex items-center justify-between gap-2 px-2 pb-2 ${modern ? "pt-1" : ""}`}>
        <button
          className={`flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${isRemoved ? "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"}`}
          onClick={(e) => { e.stopPropagation(); onToggleRemove(texturePath); }}
          title={isRemoved ? "Re-include this file in export" : "Remove this file from export"}
          aria-label={isRemoved ? "Re-include this file in export" : "Remove this file from export"}
        >
          <span className="text-[10px] leading-none">{isRemoved ? "✕" : "✓"}</span>
        </button>
        {packsWithFile.length > 1 && (
          <div className="flex gap-1 flex-wrap">
          <button
            className={`text-xs px-1.5 py-0.5 rounded transition-colors ${!overridePackId ? "bg-primary/20 text-primary font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
            onClick={() => onOverride(texturePath, null)}
          >
            auto
          </button>
            {packsWithFile.map((p) => (
              <button
                key={p.id}
                className={`text-xs px-1.5 py-0.5 rounded transition-colors truncate max-w-[60px] ${overridePackId === p.id ? "font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
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
  onOverride,
}: {
  packsWithFile: Pack[];
  texturePath: string;
  effectivePackId: string | null | undefined;
  overridePackId: string | null | undefined;
  composedPreviewUrl: string | null;
  onOverride: (path: string, packId: string | null) => void;
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
              <img
                src={composedPreviewUrl}
                alt="Preview of the atlas after region overrides"
                className="h-40 w-40 rounded-md border border-border bg-black/50 object-contain"
                style={{ imageRendering: "pixelated" }}
              />
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
  onClose,
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
  onClose: () => void;
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
          const hardcoreRegion = getHardcoreHeartMirrorRegion(region);
          if (hardcoreRegion) patches.push({ region: hardcoreRegion, sourceRegion: region, buffer: sourceBuffer });
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
          className="my-4 w-full max-w-3xl flex-shrink-0 rounded-xl border border-border bg-card shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <span className="text-sm font-semibold">{displayName}</span>
            <span className="text-xs text-muted-foreground">{texturePath}</span>
            {atlasDef && (
              <span className="rounded bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">Atlas</span>
            )}
            <button
              className="ml-auto text-lg leading-none text-muted-foreground hover:text-foreground"
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
              onOverride={onOverride}
            />

          {/* Atlas region editor */}
          {atlasDef && packsWithFile.length > 0 && (
            <div className="flex-shrink-0 rounded-lg border border-border">
              <div className="px-3 py-2 bg-secondary/50 border-b border-border">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {atlasDef.label} — Region Overrides
                </span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pick a different pack for each region. On export, regions are composited onto the base atlas.
                </p>
              </div>
              <div className="px-3 py-3 border-b border-border bg-background/60">
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-[220px]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">HUD preview</div>
                    <p className="text-xs text-muted-foreground mt-1">This shows the selected GUI slice as it will appear in the atlas when the override is applied.</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-black/30 p-2">
                    {previewRegion && regionPreviewUrls[previewRegion.id] ? (
                      <img
                        src={regionPreviewUrls[previewRegion.id]}
                        alt={previewRegion.label}
                        className="h-14 w-14 rounded-md border border-border bg-black/50 object-contain"
                        style={{ imageRendering: "pixelated" }}
                      />
                    ) : (
                      <div className="h-14 w-14 rounded-md border border-dashed border-border bg-black/30" />
                    )}
                    <div className="text-xs text-muted-foreground">
                      <div className="font-semibold text-foreground">{previewRegion?.label ?? "Region"}</div>
                      <div>Live slice preview</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-border">
                {atlasDef.regions.map((region) => {
                  const regionPackId = regionOverrides[region.id];
                  const regionOverridePack = packsWithFile.find(p => p.id === regionPackId);
                  const isPreviewedRegion = previewRegion?.id === region.id;
                  return (
                    <div
                      key={region.id}
                      className={`flex items-center gap-3 px-3 py-2.5 border-l-4 transition-colors ${regionPackId ? "shadow-[inset_0_0_0_1px_rgba(74,222,128,0.35)]" : ""} ${isPreviewedRegion ? "bg-accent/40" : ""}`}
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
                          className="h-10 w-10 rounded border border-border bg-black/40 object-contain flex-shrink-0"
                          style={{ imageRendering: "pixelated" }}
                        />
                      ) : (
                        <div className="h-10 w-10 rounded border border-dashed border-border bg-black/30 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{region.label}</span>
                          {regionPackId && <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-400 font-semibold">override</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {region.description} · ({region.x},{region.y}) {region.w}×{region.h}px
                        </div>
                      </div>
                      <div className="flex gap-1 flex-wrap justify-end">
                        <button
                          className={`text-xs px-2 py-0.5 rounded transition-colors ${!regionPackId ? "bg-primary/20 text-primary font-semibold" : "text-muted-foreground hover:bg-accent"}`}
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
                            className={`text-xs px-2 py-0.5 rounded transition-colors max-w-[80px] truncate ${regionPackId === p.id ? "font-semibold" : "text-muted-foreground hover:bg-accent"}`}
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
          {packsWithFile.length > 1 && (
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
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        className="absolute top-14 left-4 w-76 bg-card/95 backdrop-blur-md border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: 288 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="font-semibold text-sm">Settings</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">✕</button>
        </div>

        {/* Display */}
        <div className="px-4 py-3 flex flex-col gap-3 border-b border-border">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Display</span>

          <div className="flex items-center gap-2">
            <span className="text-sm flex-1">Textures per row</span>
            <button
              onClick={() => onTexturesPerRowChange(clampCols(texturesPerRow - 1))}
              className="w-7 h-7 rounded bg-secondary hover:bg-accent border border-border text-sm font-bold flex items-center justify-center transition-colors"
            >−</button>
            <input
              type="number"
              value={texturesPerRow}
              onChange={(e) => onTexturesPerRowChange(clampCols(parseInt(e.target.value) || 6))}
              className="w-10 text-center bg-secondary border border-border rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              min={1} max={12}
            />
            <button
              onClick={() => onTexturesPerRowChange(clampCols(texturesPerRow + 1))}
              className="w-7 h-7 rounded bg-secondary hover:bg-accent border border-border text-sm font-bold flex items-center justify-center transition-colors"
            >+</button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm flex-1">{darkMode ? "Dark mode" : "Light mode"}</span>
            <button
              onClick={() => onDarkModeChange(!darkMode)}
              className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${darkMode ? "bg-primary" : "bg-secondary border border-border"}`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${darkMode ? "right-0.5" : "left-0.5"}`}
              />
            </button>
          </div>

        </div>

{/* Upload defaults */}
        <div className="px-4 py-3 flex flex-col gap-3">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Upload defaults</span>

          {/* Copy from top pack */}
          <div className="flex items-center gap-2">
            <span className="text-sm flex-1">Copy from top imported pack</span>
            <button
              onClick={() => onCopyFromTopPackChange(!copyFromTopPack)}
              className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${copyFromTopPack ? "bg-primary" : "bg-secondary border border-border"}`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${copyFromTopPack ? "right-0.5" : "left-0.5"}`}
              />
            </button>
          </div>
          <div className="text-xs text-muted-foreground">
            When enabled, copies icon, name, and description from the top imported pack. When disabled, uses manual defaults.
          </div>

          {/* Icon */}
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <button
                className="w-14 h-14 rounded border border-border overflow-hidden checkered hover:border-primary transition-colors cursor-pointer"
                onClick={() => iconInputRef.current?.click()}
                title="Click to set pack icon"
              >
                {defaultPackIcon ? (
                  <img src={defaultPackIcon} className="w-full h-full object-cover texture-preview" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>
                )}
              </button>
              {defaultPackIcon && (
                <button
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center hover:opacity-90"
                  onClick={onDefaultIconRemove}
                  title="Remove icon"
                >✕</button>
              )}
            </div>
            <input ref={iconInputRef} type="file" accept="image/*" className="hidden" onChange={handleIconFile} />
            <div className="flex-1 text-xs text-muted-foreground">
              {defaultPackIcon ? "Click icon to replace" : "Click icon to upload"}
              <br />These values are used as defaults for new uploads.
            </div>
          </div>

          {/* Name */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Default pack name</label>
            <input
              type="text"
              value={defaultPackName}
              onChange={(e) => onDefaultNameChange(e.target.value)}
              className="bg-secondary border border-border rounded px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono"
              placeholder="My Resource Pack"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Default description (pack.mcmeta)</label>
            <input
              type="text"
              value={defaultPackDescription}
              onChange={(e) => onDefaultDescriptionChange(e.target.value)}
              className="bg-secondary border border-border rounded px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono"
              placeholder="A Minecraft resource pack"
            />
          </div>
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
  const cardBase = "rounded-2xl border border-border/70 bg-card/90 p-3 shadow-sm";
  const toneClasses: Record<string, string> = {
    info: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    error: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-[28px] border border-border bg-background/95 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Pack analysis</p>
            <h3 className="text-xl font-semibold text-foreground">Resource pack health overview</h3>
          </div>
          <button onClick={onClose} className="rounded-full border border-border bg-secondary px-2.5 py-1 text-sm text-muted-foreground hover:text-foreground">✕</button>
        </div>

        {isAnalyzing || !analysis ? (
          <div className="mt-6 flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-border bg-card/60">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-2xl text-emerald-600">✨</div>
              <p className="text-sm font-medium text-foreground">Scanning the current pack locally…</p>
              <p className="mt-1 text-sm text-muted-foreground">Using the current uploaded ZIP data and atlas definitions.</p>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <div className={`rounded-[24px] border p-4 ${analysis.compatibility.minecraft189 ? "border-emerald-500/30 bg-emerald-500/10" : "border-amber-500/30 bg-amber-500/10"}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{analysis.packNames.join(", ") || "Loaded pack"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{analysis.overallSummary}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${analysis.compatibility.minecraft189 ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/20 text-amber-700 dark:text-amber-300"}`}>
                    {analysis.compatibility.minecraft189 ? "1.8.9 compatible" : "Needs review"}
                  </span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${analysis.compatibility.eaglercraftCompatible ? "bg-sky-500/20 text-sky-700 dark:text-sky-300" : "bg-rose-500/20 text-rose-700 dark:text-rose-300"}`}>
                    {analysis.compatibility.eaglercraftCompatible ? "Eaglercraft friendly" : "Eaglercraft warnings"}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className={cardBase}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">File size</p>
                <p className="mt-2 text-xl font-semibold text-foreground">{analysis.totalSizeLabel}</p>
                <p className="mt-1 text-sm text-muted-foreground">{analysis.totalFiles} files inspected</p>
              </div>
              <div className={cardBase}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Base texture resolution</p>
                <p className="mt-2 text-xl font-semibold text-foreground">{analysis.baseTextureResolution}</p>
                <p className="mt-1 text-sm text-muted-foreground">{analysis.mixedResolutions ? "Mixed resolutions detected" : "Consistent texture size"}</p>
              </div>
              <div className={cardBase}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Modified textures</p>
                <p className="mt-2 text-xl font-semibold text-foreground">{analysis.modifiedTextureCount}</p>
                <p className="mt-1 text-sm text-muted-foreground">Unique textures reviewed</p>
                {analysis.texturesByFolder.size > 0 && (
                  <div className="mt-3">
                    <select className="w-full bg-secondary border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
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
              <div className={cardBase}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Performance</p>
                <p className="mt-2 text-xl font-semibold text-foreground">{analysis.performanceEstimate.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{analysis.performanceEstimate.detail}</p>
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
              <div className={cardBase}>
                <p className="text-sm font-semibold text-foreground">Compatibility warnings</p>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {analysis.compatibility.warnings.length ? analysis.compatibility.warnings.map((warning) => (
                    <li key={warning} className="flex items-start gap-2"><span className="mt-1 h-2 w-2 rounded-full bg-amber-500" />{warning}</li>
                  )) : <li>No compatibility warnings detected.</li>}
                </ul>
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
  const [recolorScope, setRecolorScope] = useState<"selection" | "whole">("selection");
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
    if (recolorScope === "selection" && !rectRegion) return;
    applyImageChange(applyRecolor(imageData, { mode: recolorMode, color, intensity: recolorIntensity }, recolorScope === "selection" ? rectRegion : undefined));
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
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-border bg-background/95 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Texture editor</p>
            <h3 className="text-lg font-semibold text-foreground">{displayName}</h3>
            <p className="text-sm text-muted-foreground">{texturePath}</p>
          </div>
          <div className="flex items-center gap-2">
            {!isTextFile && (
              <>
                <button type="button" className="rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-lg leading-none text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40" onClick={undoEdit} disabled={editHistory.index <= 0} title="Undo (Ctrl/Cmd+Z)" aria-label="Undo">↶</button>
                <button type="button" className="rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-lg leading-none text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40" onClick={redoEdit} disabled={editHistory.index >= editHistory.entries.length - 1} title="Redo (Ctrl/Cmd+Y)" aria-label="Redo">↷</button>
              </>
            )}
            <button onClick={onClose} className="rounded-full border border-border bg-secondary px-2.5 py-1 text-sm text-muted-foreground hover:text-foreground">✕</button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 rounded-[24px] border border-border bg-card/70 p-3">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">{isTextFile ? "Text Editor" : "Canvas"}</p>
                <p className="text-xs text-muted-foreground">{isTextFile ? "Edit the text content directly. Changes are saved back to the selected pack on export." : "Paint directly into the texture. The edit is saved back to the selected pack on export."}</p>
              </div>
              {!isTextFile && atlasDef && (
                <select value={activeRegionId} onChange={(e) => setActiveRegionId(e.target.value)} className="rounded border border-border bg-background px-2 py-1 text-sm text-foreground">
                  {regionOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              )}
            </div>
            <div
              ref={canvasFrameRef}
              className="flex h-[clamp(20rem,58vh,39rem)] min-h-[20rem] items-center justify-center overflow-auto rounded-2xl border border-border bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_60%)] p-3"
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
                  className="w-full h-full rounded-lg border border-border bg-background p-3 font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                  spellCheck={false}
                />
              ) : canEdit ? (
                <div className="checkered relative inline-block rounded-lg border border-border p-1 shadow-inner">
                  <canvas
                    ref={canvasRef}
                    className="mx-auto block"
                    style={{
                      // CSS scaling leaves canvas.width/height (and therefore saved PNG pixels) untouched.
                      width: `${imageData.width * canvasScale}px`,
                      height: `${imageData.height * canvasScale}px`,
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
                  {selectedRegion && recolorScope === "selection" && (
                    <div
                      className="pointer-events-none absolute border-2 border-amber-400 bg-amber-300/20 shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
                      style={{
                        left: `${4 + selectedRegion.x * canvasScale}px`,
                        top: `${4 + selectedRegion.y * canvasScale}px`,
                        width: `${selectedRegion.w * canvasScale}px`,
                        height: `${selectedRegion.h * canvasScale}px`,
                      }}
                      title="Recolor target"
                    />
                  )}
                </div>
              ) : (
                <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">This {isTextFile ? "text" : "texture"} could not be loaded for editing.</div>
              )}
            </div>
          </div>

          {!isTextFile && (
            <div className="w-full rounded-[24px] border border-border bg-card/70 p-4">
              <p className="text-sm font-semibold text-foreground">Tools</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  { id: "pencil", label: "Brush" },
                  { id: "eraser", label: "Eraser" },
                  { id: "eyedropper", label: "Eyedropper" },
                ].map((item) => (
                  <button key={item.id} className={`rounded-xl border px-3 py-2 text-sm transition-colors ${tool === item.id ? "border-primary bg-primary/15 text-primary" : "border-border bg-background/70 text-foreground hover:bg-accent"}`} onClick={() => setTool(item.id as EditorTool)}>
                    {item.label}
                  </button>
                ))}
              </div>

            <section className="mt-4 rounded-2xl border border-border bg-background/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Color</label>
                <div className="flex overflow-hidden rounded-lg border border-border text-[11px] font-semibold uppercase tracking-[0.14em]">
                  <button
                    type="button"
                    className={`px-2.5 py-1 transition-colors ${colorInputMode === "hex" ? "bg-primary/15 text-primary" : "bg-background text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setColorInputMode("hex")}
                  >
                    Hex
                  </button>
                  <button
                    type="button"
                    className={`border-l border-border px-2.5 py-1 transition-colors ${colorInputMode === "rgb" ? "bg-primary/15 text-primary" : "bg-background text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setColorInputMode("rgb")}
                  >
                    RGB
                  </button>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-12 w-14 cursor-pointer rounded border border-border bg-transparent p-1" aria-label="Color picker" />
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
                      className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 font-mono text-sm text-foreground"
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
                        <span className="rounded bg-background px-1.5 py-1 text-right font-mono text-foreground">{rgbColor[index]}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <div className="mt-4">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Brush size</label>
              <input type="range" min="1" max="24" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="mt-2 w-full" />
              <p className="mt-1 text-xs text-muted-foreground">Current size: {brushSize}px</p>
            </div>

            <div className="mt-4 rounded-2xl border border-border bg-background/70 p-3">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Recolor</label>
              <div className="mt-2 grid grid-cols-2 overflow-hidden rounded-lg border border-border text-xs font-medium">
                <button type="button" onClick={() => setRecolorScope("selection")} disabled={!selectedRegion} className={`px-2 py-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${recolorScope === "selection" ? "bg-primary/15 text-primary" : "bg-background text-muted-foreground hover:text-foreground"}`}>Highlighted selection</button>
                <button type="button" onClick={() => setRecolorScope("whole")} className={`border-l border-border px-2 py-1.5 transition-colors ${recolorScope === "whole" ? "bg-primary/15 text-primary" : "bg-background text-muted-foreground hover:text-foreground"}`}>Entire texture</button>
              </div>
              {recolorScope === "selection" && !selectedRegion && <p className="mt-2 text-xs text-amber-500">Choose an atlas region above, or select Entire texture.</p>}
              <select value={recolorMode} onChange={(e) => setRecolorMode(e.target.value as RecolorMode)} className="mt-2 w-full rounded border border-border bg-background px-2 py-1 text-sm text-foreground">
                <option value="tint">Tint</option>
                <option value="hue-shift">Hue shift</option>
                <option value="colorize">Colorize</option>
                <option value="multiply">Multiply</option>
                <option value="overlay">Overlay</option>
              </select>
              <input type="range" min="0" max="1" step="0.01" value={recolorIntensity} onChange={(e) => setRecolorIntensity(Number(e.target.value))} className="mt-3 w-full" />
              <p className="mt-1 text-xs text-muted-foreground">Intensity: {recolorIntensity.toFixed(2)}</p>
              <button disabled={recolorScope === "selection" && !selectedRegion} className="mt-3 rounded-xl border border-border bg-secondary px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40" onClick={handleApplyRecolor}>
                Apply recolor to {recolorScope === "selection" && selectedRegion ? selectedRegion.label : "entire texture"}
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-2xl border border-border bg-background/70 px-3 py-2 text-sm text-muted-foreground">
              <span>{hasChanges ? "Unsaved changes" : "No changes yet"}</span>
              <span>{selectedRegion ? `Target: ${selectedRegion.label}` : "Target: whole texture"}</span>
            </div>

            <div className="mt-4 flex gap-2">
              <button className="flex-1 rounded-xl border border-border bg-secondary px-3 py-2 text-sm font-medium text-foreground hover:bg-accent" onClick={onClose}>Cancel</button>
              <button className="flex-1 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90" onClick={handleSave}>Save</button>
            </div>
          </div>
          )}

          {isTextFile && (
            <div className="w-full rounded-[24px] border border-border bg-card/70 p-4">
              <p className="text-sm font-semibold text-foreground">Text File Info</p>
              <div className="mt-3 text-xs text-muted-foreground">
                <p>This is a text file that can be edited directly in the editor above.</p>
                <p className="mt-2">Changes will be saved back to the selected pack on export.</p>
              </div>

              <div className="mt-4 flex items-center justify-between rounded-2xl border border-border bg-background/70 px-3 py-2 text-sm text-muted-foreground">
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
  // Settings
  const [texturesPerRow, setTexturesPerRow] = useState(6);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = window.localStorage.getItem("mc-pack-editor-theme");
    return saved ? saved === "dark" : true;
  });
  const layoutMode: LayoutMode = "modern";
  const [settingsOpen, setSettingsOpen] = useState(false);
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
            // Remove formatting codes
            description = description.replace(/§[0-9a-fk-or]/g, "");
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
            // Remove formatting codes
            description = description.replace(/§[0-9a-fk-or]/g, "");
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
      
      // Check if this region maps to another region (e.g., hardcore hearts)
      const atlasDef = getAtlasDefinition(atlasPath);
      const region = atlasDef?.regions.find((r) => r.id === regionId);
      
      if (packId === null) {
        delete next[atlasPath][regionId];
        // Also remove override for mapped region
        if (region?.mapsTo) {
          delete next[atlasPath][region.mapsTo];
        }
      } else {
        next[atlasPath][regionId] = packId;
        // Also set override for mapped region
        if (region?.mapsTo) {
          next[atlasPath][region.mapsTo] = packId;
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
        performanceEstimate: { label: "Unknown", detail: "Analysis could not be completed.", score: 0 },
        compatibility: { minecraft189: false, eaglercraftCompatible: false, warnings: ["Analysis failed unexpectedly."] },
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
    <div className={`flex flex-col h-screen overflow-hidden${darkMode ? " dark" : ""} ${layoutMode === "modern" ? (darkMode ? "bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.16),_transparent_28%)] text-foreground" : "bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.12),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.12),_transparent_24%)] text-foreground") : "bg-background text-foreground"}`}>
      {/* ── Header ── */}
      <header className={`flex-shrink-0 border-b px-4 py-3 ${layoutMode === "modern" ? (darkMode ? "border-white/10 bg-gradient-to-br from-slate-950/90 via-slate-900/85 to-emerald-950/70 text-slate-100 shadow-[0_18px_40px_-24px_rgba(2,6,23,0.85)]" : "border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-emerald-50/70 text-slate-900 shadow-[0_16px_36px_-24px_rgba(15,23,42,0.18)]") : "border-border bg-card"}`}>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Settings gear */}
            <button
              onClick={() => setSettingsOpen((v) => !v)}
              className={`w-9 h-9 rounded-full flex items-center justify-center text-base transition-colors border ${settingsOpen ? (layoutMode === "modern" ? (darkMode ? "bg-white/15 text-white border-white/20" : "bg-primary/20 text-primary border-primary/40") : "bg-primary/20 text-primary border-primary/40") : (layoutMode === "modern" ? (darkMode ? "text-slate-300 hover:text-white hover:bg-white/10 border-transparent" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-transparent") : "text-muted-foreground hover:text-foreground hover:bg-accent border-transparent")}`}
              title="Settings"
            >
              ⚙
            </button>
            <h1 className={`text-base font-bold ${layoutMode === "modern" ? (darkMode ? "text-white" : "text-slate-900") : "text-foreground"}`}>MC Resource Pack Editor</h1>
            <span className={`text-xs px-1.5 py-0.5 rounded ${layoutMode === "modern" ? (darkMode ? "bg-white/10 text-slate-300" : "bg-white/70 text-slate-600") : "text-muted-foreground bg-secondary"}`}>1.8</span>
          </div>

          <div className="flex-1 min-w-0 flex items-center gap-3">
            {packs.length === 0 ? (
              <p className={`text-xs ${layoutMode === "modern" ? (darkMode ? "text-slate-300" : "text-slate-600") : "text-muted-foreground"}`}>Upload resource pack ZIPs to get started</p>
            ) : (
              <>
                <PackOrderPanel
                  packs={packs}
                  onReorder={reorderPacks}
                  onRemove={removePack}
                  packVisibility={packVisibility}
                  onVisibilityToggle={handleVisibilityToggle}
                />
                <div className="flex items-center gap-2 flex-wrap">
                  {packs.map((p) => (
                    <Badge key={p.id} color={p.color} label={p.name} />
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {packs.length > 0 && (
              <>
                <Btn
                  variant="danger"
                  onClick={clearAllPacks}
                  className="rounded-full border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20"
                  title="Clear all packs and start a new project"
                >
                  🗑️
                </Btn>
                <Btn
                  variant="default"
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="font-semibold rounded-full border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 hover:shadow-[0_0_16px_rgba(16,185,129,0.2)] dark:text-emerald-300"
                  title="Analyze the currently loaded packs"
                >
                  <span className={`text-sm ${analyzing ? "animate-pulse" : ""}`}>✨</span>
                  {analyzing ? "Analyzing…" : "Analyze Pack"}
                </Btn>
                <Btn
                  variant="primary"
                  onClick={handleExport}
                  disabled={exporting}
                  className="font-semibold rounded-full hover:shadow-[0_0_18px_rgba(59,130,246,0.22)]"
                >
                  {exporting ? "Exporting…" : "↓ Export ZIP"}
                </Btn>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Sub-header: pack settings + upload ── */}
      <div className={`flex-shrink-0 border-b px-4 py-2 ${layoutMode === "modern" ? (darkMode ? "border-white/10 bg-slate-900/50 backdrop-blur-sm" : "border-slate-200/70 bg-white/70 backdrop-blur-sm") : "border-border bg-card/50"}`}>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[280px]">
            <PackSettings
              packName={packName}
              packDescription={packDescription}
              packIcon={packIcon}
              onNameChange={setPackName}
              onDescriptionChange={setPackDescription}
              onIconChange={(d) => { if (d === null) setPackIcon(null); else setCropSource(d); }}
            />
          </div>
          <div className="flex-shrink-0 w-64">
            <DropZone onLoad={handlePacksLoaded} />
          </div>
          {(totalOverrideCount > 0 || folderSourceCount > 0) && (
            <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
              {folderSourceCount > 0 && <span>📁 {folderSourceCount} folder source{folderSourceCount !== 1 ? "s" : ""} set</span>}
              {totalOverrideCount > 0 && (
                <span>
                  🎯 {totalOverrideCount} override{totalOverrideCount !== 1 ? "s" : ""} total
                  {atlasRegionOverrideCount > 0 && (
                    <> ({textureOverrideCount} texture, {atlasRegionOverrideCount} atlas region{atlasRegionOverrideCount !== 1 ? "s" : ""})</>
                  )}
                </span>
              )}
            </div>
          )}
          {totalOverrideCount > 0 && (
            <details className="group relative flex-shrink-0 text-xs">
              <summary className="cursor-pointer list-none rounded-lg border border-border bg-background/70 px-2 py-1 text-muted-foreground hover:text-foreground">
                <span className="mr-1 inline-block transition-transform group-open:rotate-180">⌄</span> Changed textures
              </summary>
              <div className="absolute right-0 z-30 mt-1 max-h-56 w-72 overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-xl">
                {Object.entries(textureOverrides).map(([path, packId]) => (
                  <button key={path} type="button" onClick={() => jumpToOverriddenTexture(path)} className="block w-full rounded px-2 py-1.5 text-left hover:bg-accent">
                    <span className="block truncate text-foreground">{path.split("/").pop()}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">Texture override · {packs.find((pack) => pack.id === packId)?.name ?? "selected pack"}</span>
                  </button>
                ))}
                {Object.entries(atlasRegionOverrides).flatMap(([path, regions]) => Object.entries(regions).map(([regionId, packId]) => ({ path, regionId, packId }))).map(({ path, regionId, packId }) => (
                  <button key={`${path}-${regionId}`} type="button" onClick={() => jumpToOverriddenTexture(path)} className="block w-full rounded px-2 py-1.5 text-left hover:bg-accent">
                    <span className="block truncate text-foreground">{path.split("/").pop()} · {regionId}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">Atlas override · {packs.find((pack) => pack.id === packId)?.name ?? "selected pack"}</span>
                  </button>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      {packs.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className={`text-center max-w-xl px-8 py-10 rounded-[28px] border ${layoutMode === "modern" ? (darkMode ? "border-white/10 bg-gradient-to-br from-slate-900/85 via-slate-900/70 to-emerald-950/70 shadow-[0_25px_60px_-30px_rgba(2,6,23,0.95)]" : "border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-emerald-50/70 shadow-[0_24px_52px_-28px_rgba(15,23,42,0.2)]") : "border-border bg-card"}`}>
            <h2 className="text-xl font-bold mb-2">Minecraft 1.8 Resource Pack Editor</h2>
            <p className={`text-sm ${layoutMode === "modern" ? (darkMode ? "text-slate-300" : "text-slate-600") : "text-muted-foreground"}`}>
              Upload one or more resource pack ZIP files above to compare textures, set default sources per folder, override individual textures, and export a merged pack.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <aside
            className={`flex-shrink-0 border-r overflow-y-auto transition-all duration-200 ${layoutMode === "modern" ? (darkMode ? "border-white/10 bg-slate-900/70 backdrop-blur-xl" : "border-slate-200/70 bg-white/70 backdrop-blur-xl") : "border-border bg-sidebar"} ${sidebarOpen ? "w-60" : "w-0 overflow-hidden border-r-0"}`}
          >
            <div className={`px-3 py-3 border-b ${layoutMode === "modern" ? (darkMode ? "border-white/10" : "border-slate-200/70") : "border-sidebar-border"}`}>
              <span className={`text-xs font-semibold uppercase tracking-wider ${layoutMode === "modern" ? (darkMode ? "text-slate-300" : "text-slate-600") : "text-muted-foreground"}`}>Folders</span>
            </div>
            <FolderSidebar
              packs={packs}
              selectedFolder={selectedFolder}
              onSelect={setSelectedFolder}
              folderSources={folderSources}
              onFolderSource={handleFolderSource}
              layoutMode={layoutMode}
            />
          </aside>

          {/* Toggle sidebar */}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="flex-shrink-0 w-5 flex items-center justify-center bg-sidebar border-r border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            <span className="text-xs">{sidebarOpen ? "‹" : "›"}</span>
          </button>

          {/* Main content */}
          <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {/* Folder header + global search */}
            <div className={`flex-shrink-0 px-4 py-3 border-b flex items-center gap-3 ${layoutMode === "modern" ? (darkMode ? "border-white/10 bg-slate-900/40 backdrop-blur-sm" : "border-slate-200/70 bg-white/70 backdrop-blur-sm") : "border-border bg-card"}`}>
              {globalSearch ? (
                <span className="font-semibold">Search results</span>
              ) : (
                <span className="font-semibold">
                  {MC_FOLDERS.find((f) => f.key === selectedFolder)?.label ?? selectedFolder}
                </span>
              )}
              <div className="ml-auto flex items-center gap-2">
                <input
                  type="search"
                  placeholder="Search all textures…"
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  className={`border rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 w-48 ${layoutMode === "modern" ? (darkMode ? "border-white/10 bg-slate-950/50 text-slate-100 placeholder:text-slate-400" : "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400") : "bg-secondary border-border text-foreground"}`}
                />
                {!globalSearch && packs.length > 1 && (
                  <span className="text-xs text-muted-foreground hidden xl:block">
                    Click preview to pick pack • Click name for folder default
                  </span>
                )}
              </div>
            </div>

            {/* Texture grid or search results */}
            <div className="flex-1 overflow-y-auto p-4">
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
                />
              )}
            </div>
          </main>
        </div>
      )}

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
          onClose={() => setLightbox(null)}
        />
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
