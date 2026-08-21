import { useState, useRef, useEffect, useCallback, type DragEvent } from "react";
import { Pack } from "../../types";

export interface PackOrderPanelProps {
  packs: Pack[];
  onReorder: (newOrder: Pack[]) => void;
  onRemove: (id: string) => void;
  packVisibility: Record<string, boolean>;
  onVisibilityToggle: (id: string) => void;
  onViewFiles: (id: string) => void;
  darkMode: boolean;
  stripColorCodes: (name: string) => string;
}

export function PackOrderPanel({
  packs,
  onReorder,
  onRemove,
  packVisibility,
  onVisibilityToggle,
  onViewFiles,
  darkMode,
  stripColorCodes,
}: PackOrderPanelProps) {
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

export default PackOrderPanel;
