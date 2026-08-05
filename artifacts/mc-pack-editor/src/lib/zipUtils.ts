import JSZip from "jszip";
import { Pack, TextureEntry, PACK_COLORS, MC_FOLDERS } from "../types";
import { AtlasRegion, getAtlasDefinition } from "./atlasRegions";

let packColorIndex = 0;

export async function loadPackFromFile(file: File): Promise<Pack> {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  const files = new Map<string, ArrayBuffer>();

  await Promise.all(
    Object.entries(zip.files).map(async ([path, entry]) => {
      if (!entry.dir) {
        const buf = await entry.async("arraybuffer");
        files.set(path, buf);
      }
    })
  );

  const color = PACK_COLORS[packColorIndex % PACK_COLORS.length];
  packColorIndex++;

  const name = file.name.replace(/\.zip$/i, "");
  return { id: crypto.randomUUID(), name, files, color };
}

export function getTextureFolder(path: string): string {
  // Normalize: strip leading slash
  const p = path.replace(/^\//, "");

  // Skip system files
  if (p.match(/^\./) || p.includes('.ds_store') || p.includes('Thumbs.db')) return "other";

  // assets/minecraft/models/block/... -> models
  const modelMatch = p.match(/assets\/\w+\/models\/([^/]+)\//);
  if (modelMatch) return "models";

  // assets/minecraft/sounds/... -> sounds
  if (p.match(/assets\/\w+\/sounds\//)) return "sounds";

  // assets/minecraft/lang/... -> lang
  if (p.match(/assets\/\w+\/lang\//)) return "lang";

  // assets/minecraft/blockstates/... -> blockstates
  if (p.match(/assets\/\w+\/blockstates\//)) return "blockstates";

  const knownTextureFolders = new Set(MC_FOLDERS.map((folder) => folder.key));
  const folderMap: Record<string, string> = {
    sky: "sky",
    skies: "sky",
    sky_box: "sky",
    sky0: "sky",
    sky1: "sky",
    sky2: "sky",
    sky3: "sky",
    sky4: "sky",
    sky5: "sky",
    clouds: "sky",
    cloud: "sky",
    end_sky: "sky",
    end_sky0: "sky",
    moon: "sky",
    moon_phases: "sky",
    sun: "sky",
    sunrise: "sky",
    sunset: "sky",
    day: "sky",
    night: "sky",
    particle: "particle",
    particles: "particle",
    entity: "entity",
    item: "items",
    items: "items",
    block: "blocks",
    blocks: "blocks",
    gui: "gui",
    font: "font",
    map: "map",
    colormap: "colormap",
    mob_effect: "gui",
    painting: "entity",
    banner: "entity",
    world: "environment",
    world0: "environment",
    world1: "environment",
    world2: "environment",
    world3: "environment",
    world4: "environment",
    world5: "environment",
    world_nether: "environment",
    world_end: "environment",
    dimension: "environment",
    terrain: "blocks",
    armor: "items",
    misc: "misc",
  };

  // Check for texture paths under assets/<namespace>/textures/...
  const textureDirMatch = p.match(/assets\/\w+\/textures\/(.*)$/);
  if (textureDirMatch) {
    const subPath = textureDirMatch[1];
    const parts = subPath.split('/').filter(Boolean);
    if (parts.length > 0) {
      const firstDir = parts[0];
      if (folderMap[firstDir]) return folderMap[firstDir];
      if (knownTextureFolders.has(firstDir)) return firstDir;
      return firstDir;
    }
  }

  // Handle files directly in textures directory (like world0.png)
  const directTextureMatch = p.match(/assets\/\w+\/textures\/([^/]+)\.(png|jpg|jpeg|gif|tga)$/i);
  if (directTextureMatch) {
    const filename = directTextureMatch[1].toLowerCase();
    if (folderMap[filename]) return folderMap[filename];
    // Check for sky-related filenames with more patterns
    if (filename.includes('sky') || filename.includes('sun') || filename.includes('moon') || filename.includes('cloud') || filename.includes('day') || filename.includes('night')) return "sky";
    return "environment";
  }

  return "other";
}

export function getTexturesForFolder(pack: Pack, folder: string): TextureEntry[] {
  const entries: TextureEntry[] = [];

  pack.files.forEach((_, path) => {
    const f = getTextureFolder(path);
    if (f !== folder) return;

    // Only include image files and text/json for non-texture folders
    const isImage = /\.(png|jpg|jpeg|gif|tga)$/i.test(path);
    const isJson = /\.(json|mcmeta|txt)$/i.test(path);
    const isSounds = folder === "sounds" && /\.ogg$/i.test(path);
    const isLang = folder === "lang";

    if (!isImage && !isJson && !isSounds && !isLang) return;

    // Get display name
    const parts = path.split("/");
    const displayName = parts[parts.length - 1];

    entries.push({ path, displayName, folder });
  });

  return entries.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function getAllFoldersInPacks(packs: Pack[]): Set<string> {
  const folders = new Set<string>();
  for (const pack of packs) {
    pack.files.forEach((_, path) => {
      const f = getTextureFolder(path);
      if (f !== "other") folders.add(f);
    });
  }
  return folders;
}

export function getAllTexturePathsInFolder(packs: Pack[], folder: string): string[] {
  const paths = new Set<string>();
  for (const pack of packs) {
    getTexturesForFolder(pack, folder).forEach((e) => {
      paths.add(e.path);
    });
  }
  return Array.from(paths).sort();
}

export function arrayBufferToDataURL(buffer: ArrayBuffer, path: string): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 = btoa(binary);

  const ext = path.split(".").pop()?.toLowerCase() ?? "png";
  const mimeMap: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    tga: "image/x-tga",
  };
  const mime = mimeMap[ext] ?? "image/png";
  return `data:${mime};base64,${b64}`;
}

export function isImagePath(path: string): boolean {
  return /\.(png|jpg|jpeg|gif)$/i.test(path);
}

const LINKED_ATLAS_REGIONS: Record<string, string[]> = {
  heart_full: ["heart_empty", "heart_empty_flash", "heart_full_damage", "heart_half_damage"],
  heart_half: ["heart_empty", "heart_empty_flash", "heart_full_damage", "heart_half_damage"],
  heart_full_damage: ["heart_empty", "heart_empty_flash"],
  heart_half_damage: ["heart_empty", "heart_empty_flash"],
  armor_full: ["armor_empty"],
  armor_half: ["armor_empty"],
  hunger_full: ["hunger_empty"],
  hunger_half: ["hunger_empty"],
};

export function getLinkedAtlasRegionOverrides(
  regionOverrides: Record<string, string>
): Record<string, string> {
  const linked = { ...regionOverrides };

  for (const [regionId, packId] of Object.entries(regionOverrides)) {
    for (const linkedRegionId of LINKED_ATLAS_REGIONS[regionId] ?? []) {
      linked[linkedRegionId] ??= packId;
    }
  }

  return linked;
}

async function loadImage(buffer: ArrayBuffer, path: string): Promise<HTMLImageElement> {
  const dataUrl = arrayBufferToDataURL(buffer, path);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load atlas image: ${path}`));
    img.src = dataUrl;
  });
}

function normalizeRegionForCanvas(region: AtlasRegion, width: number, height: number): AtlasRegion {
  if (width <= 0 || height <= 0) return region;

  const scaleX = width / 256;
  const scaleY = height / 256;

  return {
    ...region,
    x: Math.round(region.x * scaleX),
    y: Math.round(region.y * scaleY),
    w: Math.max(1, Math.round(region.w * scaleX)),
    h: Math.max(1, Math.round(region.h * scaleY)),
  };
}

function createAlphaAwareCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", {
    alpha: true,
    premultipliedAlpha: false,
    willReadFrequently: true,
  }) as CanvasRenderingContext2D | null;

  if (!ctx) throw new Error("Canvas 2D context is unavailable");

  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

export async function cropAtlasRegion(
  buffer: ArrayBuffer,
  region: AtlasRegion,
  path: string = "atlas.png"
): Promise<ArrayBuffer> {
  const img = await loadImage(buffer, path);
  const sourceRegion = normalizeRegionForCanvas(region, img.naturalWidth, img.naturalHeight);

  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = img.naturalWidth;
  tempCanvas.height = img.naturalHeight;
  const tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true });
  if (!tempCtx) throw new Error("Canvas 2D context is unavailable");
  tempCtx.drawImage(img, 0, 0);

  const sourceData = tempCtx.getImageData(sourceRegion.x, sourceRegion.y, sourceRegion.w, sourceRegion.h);
  const { canvas, ctx } = createAlphaAwareCanvas(sourceRegion.w, sourceRegion.h);
  ctx.putImageData(sourceData, 0, 0);

  return new Promise<ArrayBuffer>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to encode cropped atlas region"));
        return;
      }
      blob.arrayBuffer().then(resolve).catch(reject);
    }, "image/png");
  });
}

export async function pasteAtlasRegion(
  targetBuffer: ArrayBuffer,
  patchBuffer: ArrayBuffer,
  region: AtlasRegion,
  path: string = "atlas.png"
): Promise<ArrayBuffer> {
  const targetImg = await loadImage(targetBuffer, path);
  const patchImg = await loadImage(patchBuffer, path);

  const destRegion = normalizeRegionForCanvas(region, targetImg.naturalWidth, targetImg.naturalHeight);

  const tempTarget = document.createElement("canvas");
  tempTarget.width = targetImg.naturalWidth;
  tempTarget.height = targetImg.naturalHeight;
  const targetCtx = tempTarget.getContext("2d", { willReadFrequently: true, alpha: true });
  if (!targetCtx) throw new Error("Canvas 2D context is unavailable");
  targetCtx.drawImage(targetImg, 0, 0);

  const tempPatch = document.createElement("canvas");
  tempPatch.width = patchImg.naturalWidth;
  tempPatch.height = patchImg.naturalHeight;
  const patchCtx = tempPatch.getContext("2d", { willReadFrequently: true, alpha: true });
  if (!patchCtx) throw new Error("Canvas 2D context is unavailable");
  patchCtx.drawImage(patchImg, 0, 0);

  const targetData = targetCtx.getImageData(0, 0, tempTarget.width, tempTarget.height);
  const patchData = patchCtx.getImageData(0, 0, tempPatch.width, tempPatch.height);

  const patchW = patchImg.naturalWidth;
  const patchH = patchImg.naturalHeight;

  for (let y = 0; y < patchH; y++) {
    for (let x = 0; x < patchW; x++) {
      const srcIndex = (y * patchW + x) * 4;
      const dstIndex = ((destRegion.y + y) * tempTarget.width + (destRegion.x + x)) * 4;

      targetData.data[dstIndex + 0] = patchData.data[srcIndex + 0];
      targetData.data[dstIndex + 1] = patchData.data[srcIndex + 1];
      targetData.data[dstIndex + 2] = patchData.data[srcIndex + 2];
      targetData.data[dstIndex + 3] = patchData.data[srcIndex + 3];
    }
  }

  const { canvas, ctx } = createAlphaAwareCanvas(tempTarget.width, tempTarget.height);
  ctx.putImageData(targetData, 0, 0);

  return new Promise<ArrayBuffer>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to encode stitched atlas region"));
        return;
      }
      blob.arrayBuffer().then(resolve).catch(reject);
    }, "image/png");
  });
}

export async function replaceAtlasRegion(
  targetBuffer: ArrayBuffer,
  sourceBuffer: ArrayBuffer,
  region: AtlasRegion,
  path: string = "atlas.png"
): Promise<ArrayBuffer> {
  const cropped = await cropAtlasRegion(sourceBuffer, region, path);
  return pasteAtlasRegion(targetBuffer, cropped, region, path);
}

/** Compose an atlas PNG by replacing region pixels from other packs on top of a base atlas. */
export async function composeAtlas(
  baseBuffer: ArrayBuffer,
  patches: { region: AtlasRegion; buffer: ArrayBuffer; sourceRegion?: AtlasRegion }[]
): Promise<ArrayBuffer> {
  const baseImg = await loadImage(baseBuffer, "atlas.png");
  const patchImages = await Promise.all(
    patches.map(async (patch) => ({
      ...patch,
      img: await loadImage(patch.buffer, "atlas.png"),
    }))
  );

  const outputWidth = Math.max(baseImg.naturalWidth, ...patchImages.map((patch) => patch.img.naturalWidth));
  const outputHeight = Math.max(baseImg.naturalHeight, ...patchImages.map((patch) => patch.img.naturalHeight));
  const { canvas, ctx } = createAlphaAwareCanvas(outputWidth, outputHeight);
  ctx.drawImage(baseImg, 0, 0, outputWidth, outputHeight);

  for (const { region, sourceRegion: originalSourceRegion, img: patchImg } of patchImages) {
    const sourceRegion = normalizeRegionForCanvas(originalSourceRegion ?? region, patchImg.naturalWidth, patchImg.naturalHeight);
    const destRegion = normalizeRegionForCanvas(region, canvas.width, canvas.height);
    ctx.clearRect(destRegion.x, destRegion.y, destRegion.w, destRegion.h);
    ctx.drawImage(
      patchImg,
      sourceRegion.x,
      sourceRegion.y,
      sourceRegion.w,
      sourceRegion.h,
      destRegion.x,
      destRegion.y,
      destRegion.w,
      destRegion.h
    );
  }

  return new Promise<ArrayBuffer>((resolve) => {
    canvas.toBlob((blob) => blob!.arrayBuffer().then(resolve), "image/png");
  });
}

export async function exportMergedPack(
  packs: Pack[],
  folderSources: Record<string, string>,
  textureOverrides: Record<string, string>,
  atlasRegionOverrides: Record<string, Record<string, string>>,
  packName: string,
  packDescription: string,
  packIcon: string | null,
  removedFiles: Record<string, boolean> = {}
): Promise<Blob> {
  const zip = new JSZip();

  // Collect all unique paths across all packs
  const allPaths = new Set<string>();
  for (const pack of packs) {
    pack.files.forEach((_, path) => allPaths.add(path));
  }

  // Write pack.mcmeta — preserve § codes in both name and description
  const mcmeta = JSON.stringify(
    { pack: { pack_format: 1, description: packDescription, name: packName } },
    null,
    2
  );
  zip.file("pack.mcmeta", mcmeta);

  // Write pack icon
  if (packIcon) {
    const b64 = packIcon.split(",")[1];
    if (b64) {
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      zip.file("pack.png", bytes);
    }
  }

  // For each file path, determine which pack to use
  for (const path of allPaths) {
    if (path === "pack.mcmeta" || path === "pack.png") continue;
    if (removedFiles[path]) continue;

    const folder = getTextureFolder(path);

    // Check texture-level override first, then folder source, then first pack that has it
    let sourcePack: Pack | undefined;

    const overridePackId = textureOverrides[path];
    if (overridePackId) {
      sourcePack = packs.find((p) => p.id === overridePackId && p.files.has(path));
    }

    if (!sourcePack) {
      const folderPackId = folderSources[folder];
      if (folderPackId) {
        sourcePack = packs.find((p) => p.id === folderPackId && p.files.has(path));
      }
    }

    if (!sourcePack) {
      // Use first pack that has this file
      sourcePack = packs.find((p) => p.files.has(path));
    }

    if (sourcePack) {
      const buf = sourcePack.files.get(path)!;

      // If this is a known atlas with region-level overrides, compose the selected regions
      const atlasDef = getAtlasDefinition(path);
      const regionOverrides = atlasRegionOverrides[path];
      if (atlasDef && regionOverrides && Object.keys(regionOverrides).length > 0) {
        const patches: { region: AtlasRegion; buffer: ArrayBuffer; sourceRegion?: AtlasRegion }[] = [];
        const orderedRegions = [...atlasDef.regions].sort((a, b) => {
          const areaA = a.w * a.h;
          const areaB = b.w * b.h;
          return areaB - areaA;
        });

        for (const region of orderedRegions) {
          const overridePackId = regionOverrides[region.id];
          if (!overridePackId) continue;

          const overridePack = packs.find((p) => p.id === overridePackId && p.files.has(path));
          if (!overridePack) continue;

          const buffer = overridePack.files.get(path)!;
          patches.push({ region, buffer });

          // When a region is overridden, also override any regions that map to it (e.g., hardcore hearts map to normal hearts)
          const atlasDef = getAtlasDefinition(path);
          const mappedRegions = atlasDef?.regions.filter((r) => r.mapsTo === region.id) || [];
          for (const mappedRegion of mappedRegions) {
            patches.push({ region: mappedRegion, sourceRegion: region, buffer });
          }
        }

        if (patches.length > 0) {
          const composed = await composeAtlas(buf, patches);
          zip.file(path, composed);
          continue;
        }
      }

      zip.file(path, buf);
    }
  }

  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}
