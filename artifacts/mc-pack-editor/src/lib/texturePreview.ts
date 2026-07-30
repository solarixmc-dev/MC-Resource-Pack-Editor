import { arrayBufferToDataURL } from "./zipUtils";

export const TEXTURE_THUMBNAIL_SIZE = 72;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load texture preview"));
    image.src = src;
  });
}

/** Bounds of every pixel with any opacity (includes partially transparent pixels). */
function getVisiblePixelBounds(imageData: ImageData): { left: number; top: number; right: number; bottom: number } | null {
  const { data, width, height } = imageData;
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }

  if (right < left || bottom < top) return null;
  return { left, top, right, bottom };
}

/**
 * Trim fully transparent outer padding, keep every visible pixel, and scale the
 * cropped artwork to fill the thumbnail area for easier inspection.
 */
export async function createCroppedTexturePreviewDataUrl(
  buffer: ArrayBuffer,
  path: string,
  thumbnailSize = TEXTURE_THUMBNAIL_SIZE,
): Promise<string> {
  const sourceUrl = arrayBufferToDataURL(buffer, path);

  try {
    const image = await loadImage(sourceUrl);
    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = image.naturalWidth;
    sourceCanvas.height = image.naturalHeight;
    const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
    if (!sourceContext) return sourceUrl;

    sourceContext.drawImage(image, 0, 0);
    const bounds = getVisiblePixelBounds(sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height));
    if (!bounds) return sourceUrl;

    const cropWidth = bounds.right - bounds.left + 1;
    const cropHeight = bounds.bottom - bounds.top + 1;

    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = thumbnailSize;
    outputCanvas.height = thumbnailSize;
    const outputContext = outputCanvas.getContext("2d");
    if (!outputContext) return sourceUrl;

    const scale = Math.min(thumbnailSize / cropWidth, thumbnailSize / cropHeight);
    const drawWidth = cropWidth * scale;
    const drawHeight = cropHeight * scale;
    const offsetX = (thumbnailSize - drawWidth) / 2;
    const offsetY = (thumbnailSize - drawHeight) / 2;

    outputContext.imageSmoothingEnabled = false;
    outputContext.drawImage(
      sourceCanvas,
      bounds.left,
      bounds.top,
      cropWidth,
      cropHeight,
      offsetX,
      offsetY,
      drawWidth,
      drawHeight,
    );

    return outputCanvas.toDataURL();
  } catch {
    return sourceUrl;
  }
}
