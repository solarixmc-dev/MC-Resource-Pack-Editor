import { useMemo } from "react";
import { Pack, FolderSources, TextureOverrides, LayoutMode } from "../../types";
import { getTextureFolder } from "../../lib/zipUtils";
import { TextureCard } from "./TextureCard";

export interface SearchAllResultsProps {
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
  layoutMode?: LayoutMode;
  darkMode: boolean;
  stripColorCodes: (name: string) => string;
  showJsonFiles: boolean;
}

export function SearchAllResults({
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
}: SearchAllResultsProps) {
  const allPaths = useMemo(() => {
    const set = new Set<string>();
    for (const pack of packs) {
      pack.files.forEach((_, p) => {
        if (p !== "pack.mcmeta" && p !== "pack.png") {
          // Skip JSON/text files unless showJsonFiles is true
          const isJson = /\.(json|mcmeta|txt|properties|yml|yaml|toml|cfg|conf|ini)$/i.test(p);
          if (!showJsonFiles && isJson) return;
          // Include path with pack ID to distinguish same paths from different packs
          set.add(`${p}::${pack.id}`);
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
        {filtered.map((pathWithPackId) => {
          // Parse the path which now includes pack ID: "path/to/texture.png::packId"
          const [texturePath, packId] = pathWithPackId.split("::");
          const parts = texturePath.split("/");
          const displayName = parts[parts.length - 1];
          const folder = getTextureFolder(texturePath);
          const specificPack = packs.find(p => p.id === packId);
          
          if (!specificPack) return null;
          
          return (
            <div key={pathWithPackId} className="flex flex-col gap-0.5">
              <TextureCard
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
              <span className={`text-[10px] text-center truncate px-1 ${darkMode ? "text-dark-text-secondary" : "text-muted-foreground"}`}>{folder}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default SearchAllResults;
