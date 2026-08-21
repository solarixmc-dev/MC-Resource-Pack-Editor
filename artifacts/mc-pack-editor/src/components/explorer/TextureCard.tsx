import React from "react";
import { Pack, FolderSources, TextureOverrides, LayoutMode } from "../../types";
import { arrayBufferToDataURL, isImagePath } from "../../lib/zipUtils";
import { getAtlasDefinition } from "../../lib/atlasRegions";
import { CroppedTexturePreview } from "./CroppedTexturePreview";

export interface TextureCardProps {
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
  layoutMode?: LayoutMode;
  darkMode: boolean;
  stripColorCodes: (name: string) => string;
}

export function TextureCard({
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
  layoutMode: _layoutMode,
  darkMode,
  stripColorCodes,
}: TextureCardProps) {
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

export default TextureCard;
