import { Pack } from "../types";
import { getTextureFolder, isImagePath, arrayBufferToDataURL } from "./zipUtils";
import { getAtlasDefinition } from "./atlasRegions";

export interface AtlasAnalysisEntry {
  label: string;
  present: boolean;
  requiredRegions: string[];
  missingRegions: string[];
  filePath?: string;
}

export interface PackAnalysis {
  packNames: string[];
  packCount: number;
  totalFiles: number;
  totalSizeBytes: number;
  totalSizeLabel: string;
  baseTextureResolution: string;
  mixedResolutions: boolean;
  resolutions: string[];
  modifiedTextureCount: number;
  texturesByFolder: Map<string, string[]>;
  missingTextures: string[];
  duplicateTextures: string[];
  animatedTextures: string[];
  invalidAnimations: string[];
  atlasAnalysis: AtlasAnalysisEntry[];
  overallSummary: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

function getExtension(path: string): string {
  return path.split(".").pop()?.toLowerCase() ?? "";
}

async function getImageDimensions(buffer: ArrayBuffer, path: string): Promise<{ width: number; height: number } | null> {
  if (typeof window === "undefined") return null;
  const dataUrl = arrayBufferToDataURL(buffer, path);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function hashBuffer(buffer: ArrayBuffer): string {
  let hash = 0x811c9dc5;
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\//, "").toLowerCase();
}

async function collectTextureResolutions(packs: Pack[]) {
  const entries = packs.flatMap((pack) =>
    Array.from(pack.files.entries()).map(([path, buffer]) => ({ packName: pack.name, path, buffer }))
  );

  const textureEntries = entries.filter(({ path }) => isImagePath(path));
  const resolutions = await Promise.all(
    textureEntries.map(async ({ path, buffer }) => {
      const dims = await getImageDimensions(buffer, path);
      return dims ? { path, ...dims } : null;
    })
  );

  return resolutions.filter(Boolean) as Array<{ path: string; width: number; height: number }>;
}

function findCommonResolution(resolutions: Array<{ width: number; height: number }>): string {
  if (!resolutions.length) return "N/A";
  const counts = new Map<string, number>();
  for (const { width, height } of resolutions) {
    const key = `${width}×${height}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? "N/A";
}

function getMissingTextures(texturePaths: string[]): string[] {
  const corePaths = [
    "assets/minecraft/textures/blocks/stone.png",
    "assets/minecraft/textures/items/stone_sword.png",
    "assets/minecraft/textures/gui/icons.png",
    "assets/minecraft/textures/gui/widgets.png",
    "assets/minecraft/textures/entity/steve.png",
    "assets/minecraft/textures/particle/particles.png",
  ];

  const normalized = new Set(texturePaths.map(normalizePath));
  return corePaths.filter((p) => !normalized.has(normalizePath(p)));
}

function detectDuplicateTextures(packs: Pack[]): string[] {
  const byFingerprint = new Map<string, { path: string; packNames: string[] }>();

  for (const pack of packs) {
    for (const [path, buffer] of pack.files) {
      const fingerprint = `${path.toLowerCase()}::${hashBuffer(buffer)}`;
      const current = byFingerprint.get(fingerprint) ?? { path, packNames: [] };
      current.packNames.push(pack.name);
      byFingerprint.set(fingerprint, current);
    }
  }

  return Array.from(byFingerprint.values())
    .filter((entry) => entry.packNames.length > 1)
    .map((entry) => `${entry.path} (${entry.packNames.length} packs)`);
}

function analyzeAnimations(packs: Pack[]): { animatedTextures: string[]; invalidAnimations: string[] } {
  const animatedTextures: string[] = [];
  const invalidAnimations: string[] = [];

  for (const pack of packs) {
    for (const [path, buffer] of pack.files) {
      if (!path.toLowerCase().endsWith(".mcmeta")) continue;

      const text = new TextDecoder("utf-8").decode(buffer);
      try {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === "object" && parsed.animation && typeof parsed.animation === "object") {
          animatedTextures.push(path);
        } else {
          invalidAnimations.push(path);
        }
      } catch {
        invalidAnimations.push(path);
      }
    }
  }

  return { animatedTextures, invalidAnimations };
}

function analyzeAtlas(packs: Pack[]): AtlasAnalysisEntry[] {
  const atlasChecks = [
    {
      label: "HUD Icons Atlas",
      filePaths: ["gui/icons.png", "textures/gui/icons.png"],
      requiredRegions: ["crosshair", "heart_full", "heart_empty", "armor_full", "hunger_full", "xp_bar_full", "heart_hardcore_full"],
    },
    {
      label: "Widget Atlas",
      filePaths: ["gui/widgets.png", "textures/gui/widgets.png"],
      requiredRegions: ["hotbar_container", "active_selector", "button_normal"],
    },
  ];

  return atlasChecks.map((check) => {
    const match = packs.some((pack) =>
      Array.from(pack.files.keys()).some((path) => {
        const normalized = normalizePath(path);
        return check.filePaths.some((candidate) => normalizePath(candidate) === normalized || normalized.endsWith(`/${normalizePath(candidate)}`));
      })
    );

    return {
      label: check.label,
      present: match,
      requiredRegions: check.requiredRegions,
      missingRegions: match ? [] : check.requiredRegions,
      filePath: match ? check.filePaths[0] : undefined,
    };
  });
}

export async function analyzePackBundle(packs: Pack[]): Promise<PackAnalysis> {
  const validPacks = packs.filter((pack) => pack.files.size > 0);
  if (!validPacks.length) {
    return {
      packNames: [],
      packCount: 0,
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
      overallSummary: "No resource pack data is currently loaded.",
    };
  }

  const texturePaths = validPacks.flatMap((pack) =>
    Array.from(pack.files.keys()).filter((path) => isImagePath(path))
  );

  // Group textures by folder for display
  const texturesByFolder = new Map<string, string[]>();
  texturePaths.forEach((path) => {
    const folder = getTextureFolder(path);
    if (!texturesByFolder.has(folder)) {
      texturesByFolder.set(folder, []);
    }
    texturesByFolder.get(folder)!.push(path);
  });

  const textureFolders = new Set(texturePaths.map((path) => getTextureFolder(path)));
  const resolutions = await collectTextureResolutions(validPacks);
  const baseTextureResolution = findCommonResolution(resolutions.map((entry) => ({ width: entry.width, height: entry.height })));
  const mixedResolutions = new Set(resolutions.map((entry) => `${entry.width}×${entry.height}`)).size > 1;

  const totalFiles = validPacks.reduce((sum, pack) => sum + pack.files.size, 0);
  const totalSizeBytes = validPacks.reduce((sum, pack) => sum + Array.from(pack.files.values()).reduce((size, buffer) => size + buffer.byteLength, 0), 0);
  const { animatedTextures, invalidAnimations } = analyzeAnimations(validPacks);
  const atlasAnalysis = analyzeAtlas(validPacks);
  const missingTextures = getMissingTextures(texturePaths);
  const duplicateTextures = detectDuplicateTextures(validPacks);

  const summaryParts = [
    `${validPacks.length} pack${validPacks.length !== 1 ? "s" : ""} loaded`,
    `${texturePaths.length} texture${texturePaths.length !== 1 ? "s" : ""} found`,
    `base resolution ${baseTextureResolution}`,
  ];

  const overallSummary = `${summaryParts.join(" • ")}.`;

  return {
    packNames: validPacks.map((pack) => pack.name),
    packCount: validPacks.length,
    totalFiles,
    totalSizeBytes,
    totalSizeLabel: formatBytes(totalSizeBytes),
    baseTextureResolution,
    mixedResolutions,
    resolutions: Array.from(new Set(resolutions.map((entry) => `${entry.width}×${entry.height}`))).sort(),
    modifiedTextureCount: texturePaths.length,
    texturesByFolder,
    missingTextures,
    duplicateTextures,
    animatedTextures,
    invalidAnimations,
    atlasAnalysis,
    overallSummary,
    issues,
  };
}
