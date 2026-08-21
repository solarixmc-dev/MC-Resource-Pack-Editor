import { useState, useMemo, useEffect } from "react";
import { Pack, FolderSources, TextureOverrides } from "../../types";
import { arrayBufferToDataURL, cropAtlasRegion, composeAtlas } from "../../lib/zipUtils";
import { getAtlasDefinition, AtlasDefinition } from "../../lib/atlasRegions";
import { AtlasPreviewStrip } from "../atlas/AtlasPreviewStrip";

export interface TextureLightboxProps {
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
}

export function TextureLightbox({
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
}: TextureLightboxProps) {
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
                          className="h-10 w-10 rounded object-contain flex-shrink-0 checkered"
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

export default TextureLightbox;
