import { useState, useMemo } from "react";
import { Pack, FolderSources, TextureOverrides, LayoutMode } from "../../types";
import { getAllTexturePathsInFolder } from "../../lib/zipUtils";
import { TextureCard } from "./TextureCard";

export interface TextureGridProps {
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
  layoutMode?: LayoutMode;
  darkMode: boolean;
  stripColorCodes: (name: string) => string;
  showJsonFiles: boolean;
}

export function TextureGrid({
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
  stripColorCodes,
  showJsonFiles,
}: TextureGridProps) {
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
        {filtered.map((pathWithPackId) => {
          // Parse the path which now includes pack ID: "path/to/texture.png::packId"
          const [texturePath, packId] = pathWithPackId.split("::");
          const parts = texturePath.split("/");
          const displayName = parts[parts.length - 1];
          const specificPack = packs.find(p => p.id === packId);
          
          if (!specificPack) return null;
          
          return (
            <TextureCard
              key={pathWithPackId}
              texturePath={texturePath}
              displayName={displayName}
              packs={[specificPack]}
              folderSources={folderSources}
              textureOverrides={textureOverrides}
              folder={folder}
              onOverride={onOverride}
              onOpenLightbox={() => onOpenLightbox(texturePath, displayName, folder)}
              onEditTexture={() => onEditTexture(texturePath, displayName, folder)}
              isRemoved={!!removedFiles[texturePath]}
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

export default TextureGrid;
