import { useState, useRef, useEffect } from "react";

export const SWATCHES = [
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

export interface ColorPickerProps {
  value: string;
  onChange: (c: string) => void;
  onClose: () => void;
}

export function ColorPicker({
  value,
  onChange,
  onClose,
}: ColorPickerProps) {
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

export default ColorPicker;
