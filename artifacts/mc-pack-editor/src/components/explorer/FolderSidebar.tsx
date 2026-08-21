import React, { useMemo } from "react";
import { Pack, MC_FOLDERS, FolderSources, LayoutMode } from "../../types";
import { getAllFoldersInPacks } from "../../lib/zipUtils";

export interface FolderSidebarProps {
  packs: Pack[];
  selectedFolder: string;
  onSelect: (f: string) => void;
  folderSources: FolderSources;
  onFolderSource: (folder: string, packId: string | null) => void;
  layoutMode: LayoutMode;
  darkMode: boolean;
  stripColorCodes: (name: string) => string;
}

export function FolderSidebar({
  packs,
  selectedFolder,
  onSelect,
  folderSources,
  onFolderSource,
  layoutMode: _layoutMode,
  darkMode,
  stripColorCodes,
}: FolderSidebarProps) {
  const availableFolders = useMemo(() => getAllFoldersInPacks(packs), [packs]);

  const defined = MC_FOLDERS.filter((f) => availableFolders.has(f.key));
  const extra = Array.from(availableFolders)
    .filter((k) => !MC_FOLDERS.find((f) => f.key === k))
    .sort();

  const renderFolder = (key: string, label: string) => {
    const sourcePackId = folderSources[key];
    const active = selectedFolder === key;

    return (
      <div key={key} className={`group border transition-all sleek rounded-lg ${darkMode ? "sleek-dark" : "sleek"} ${active ? "border-black dark:border-white bg-black/5 dark:bg-white/10" : darkMode ? "bg-dark-secondary" : "bg-[#f5f0e6] hover:bg-[#C2B280]/30"} mb-2`}>
        <button
          className={`w-full flex items-center px-3 py-2.5 text-sm text-left transition-colors rounded-lg ${darkMode ? "hover:bg-[#C2B280]/50" : "hover:bg-[#C2B280]/50"}`}
          onClick={() => onSelect(key)}
        >
          <span className={`flex-1 font-medium leading-snug ${active ? "text-black dark:text-white" : darkMode ? "text-dark-text-primary" : "text-slate-800"}`}>
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

export default FolderSidebar;
