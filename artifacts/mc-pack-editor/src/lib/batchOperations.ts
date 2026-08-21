// Batch operations for multiple texture editing

export interface BatchOperation {
  type: 'recolor' | 'resize' | 'convert' | 'export';
  textures: string[];
  options: any;
}

export interface RecolorBatchOptions {
  mode: 'tint' | 'hue-shift' | 'colorize' | 'multiply' | 'overlay';
  color: string;
  intensity: number;
}

export interface ResizeBatchOptions {
  width: number;
  height: number;
  maintainAspectRatio: boolean;
}

export interface ConvertBatchOptions {
  format: 'png' | 'jpg' | 'webp';
  quality?: number;
}

export interface ExportBatchOptions {
  format: 'zip' | 'individual';
  destination: string;
}

export async function applyBatchRecolor(
  textures: string[],
  options: RecolorBatchOptions,
  applyToTexture: (path: string, options: RecolorBatchOptions) => Promise<void>
): Promise<{ success: string[]; failed: Array<{ path: string; error: string }> }> {
  const results = {
    success: [] as string[],
    failed: [] as Array<{ path: string; error: string }>
  };

  for (const texturePath of textures) {
    try {
      await applyToTexture(texturePath, options);
      results.success.push(texturePath);
    } catch (error) {
      results.failed.push({
        path: texturePath,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return results;
}

export async function applyBatchResize(
  textures: string[],
  options: ResizeBatchOptions,
  applyToTexture: (path: string, options: ResizeBatchOptions) => Promise<void>
): Promise<{ success: string[]; failed: Array<{ path: string; error: string }> }> {
  const results = {
    success: [] as string[],
    failed: [] as Array<{ path: string; error: string }>
  };

  for (const texturePath of textures) {
    try {
      await applyToTexture(texturePath, options);
      results.success.push(texturePath);
    } catch (error) {
      results.failed.push({
        path: texturePath,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return results;
}

export async function applyBatchConvert(
  textures: string[],
  options: ConvertBatchOptions,
  applyToTexture: (path: string, options: ConvertBatchOptions) => Promise<void>
): Promise<{ success: string[]; failed: Array<{ path: string; error: string }> }> {
  const results = {
    success: [] as string[],
    failed: [] as Array<{ path: string; error: string }>
  };

  for (const texturePath of textures) {
    try {
      await applyToTexture(texturePath, options);
      results.success.push(texturePath);
    } catch (error) {
      results.failed.push({
        path: texturePath,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return results;
}

export function filterTexturesByPattern(textures: string[], pattern: string): string[] {
  const regex = new RegExp(pattern, 'i');
  return textures.filter(texture => regex.test(texture));
}

export function filterTexturesBySize(textures: string[], sizeMap: Map<string, { width: number; height: number }>, minWidth?: number, maxWidth?: number, minHeight?: number, maxHeight?: number): string[] {
  return textures.filter(texture => {
    const size = sizeMap.get(texture);
    if (!size) return false;
    
    if (minWidth && size.width < minWidth) return false;
    if (maxWidth && size.width > maxWidth) return false;
    if (minHeight && size.height < minHeight) return false;
    if (maxHeight && size.height > maxHeight) return false;
    
    return true;
  });
}

export function selectAllTextures(textures: string[]): string[] {
  return [...textures];
}

export function selectNone(): string[] {
  return [];
}

export function invertSelection(selected: string[], allTextures: string[]): string[] {
  const selectedSet = new Set(selected);
  return allTextures.filter(t => !selectedSet.has(t));
}