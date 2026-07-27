export type EditorTool = "pencil" | "eraser" | "eyedropper" | "fill";
export type RecolorMode = "tint" | "hue-shift" | "colorize" | "multiply" | "overlay";

export interface RectRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RecolorOptions {
  mode: RecolorMode;
  color: string;
  intensity: number;
}

function hexToRgba(hex: string): [number, number, number, number] {
  const value = hex.replace("#", "");
  if (/^[0-9a-fA-F]{6}$/.test(value)) {
    const int = parseInt(value, 16);
    return [((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255, 1];
  }
  return [1, 0, 0, 1];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function rgbaToHex(r: number, g: number, b: number): string {
  const toHex = (value: number) => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const delta = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    switch (max) {
      case rr: h = (gg - bb) / delta + (gg < bb ? 6 : 0); break;
      case gg: h = (bb - rr) / delta + 2; break;
      case bb: h = (rr - gg) / delta + 4; break;
    }
    h /= 6;
  }

  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  if (s === 0) {
    const v = l * 255;
    return [v, v, v];
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3) * 255, hue2rgb(p, q, h) * 255, hue2rgb(p, q, h - 1 / 3) * 255];
}

function blendColor(base: [number, number, number, number], target: [number, number, number, number], intensity: number, mode: RecolorMode): [number, number, number, number] {
  const [br, bg, bb, ba] = base;
  const [tr, tg, tb] = target;
  const mix = clamp(intensity, 0, 1);

  let r = br;
  let g = bg;
  let b = bb;

  switch (mode) {
    case "tint": {
      r = br + (tr - br) * mix;
      g = bg + (tg - bg) * mix;
      b = bb + (tb - bb) * mix;
      break;
    }
    case "hue-shift": {
      const [h, s, l] = rgbToHsl(br * 255, bg * 255, bb * 255);
      const shifted = (h + mix) % 1;
      const [nr, ng, nb] = hslToRgb(shifted, s, l);
      r = nr / 255;
      g = ng / 255;
      b = nb / 255;
      break;
    }
    case "colorize": {
      const [h, s] = rgbToHsl(br * 255, bg * 255, bb * 255);
      const [nh, ns, nl] = rgbToHsl(tr * 255, tg * 255, tb * 255);
      const [nr, ng, nb] = hslToRgb(nh, s * (1 - mix) + ns * mix, lumaToLightness(br, bg, bb, mix));
      r = nr / 255;
      g = ng / 255;
      b = nb / 255;
      break;
    }
    case "multiply": {
      r = br * (tr * mix + (1 - mix));
      g = bg * (tg * mix + (1 - mix));
      b = bb * (tb * mix + (1 - mix));
      break;
    }
    case "overlay": {
      const overlay = (src: number, dst: number) => (dst < 0.5 ? 2 * src * dst : 1 - 2 * (1 - src) * (1 - dst));
      r = br + (overlay(br, tr) - br) * mix;
      g = bg + (overlay(bg, tg) - bg) * mix;
      b = bb + (overlay(bb, tb) - bb) * mix;
      break;
    }
  }

  return [clamp(r, 0, 1), clamp(g, 0, 1), clamp(b, 0, 1), ba];
}

function lumaToLightness(r: number, g: number, b: number, mix: number): number {
  const [_, __, l] = rgbToHsl(r * 255, g * 255, b * 255);
  return l * (1 - mix) + 0.5 * mix;
}

function cloneImageData(imageData: ImageData): ImageData {
  return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
}

export async function loadImageDataFromBuffer(buffer: ArrayBuffer, path: string): Promise<ImageData> {
  const dataUrl = `data:${getMimeType(path)};base64,${btoa(String.fromCharCode(...new Uint8Array(buffer)))}`;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${path}`));
    image.src = dataUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas context unavailable");
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export async function imageDataToBuffer(imageData: ImageData): Promise<ArrayBuffer> {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable");
  ctx.putImageData(imageData, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Failed to encode image")), "image/png");
  });
  return blob.arrayBuffer();
}

function getMimeType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png": return "image/png";
    case "jpg": case "jpeg": return "image/jpeg";
    case "gif": return "image/gif";
    default: return "image/png";
  }
}

function getPixelIndex(imageData: ImageData, x: number, y: number): number {
  return (y * imageData.width + x) * 4;
}

function getPixel(imageData: ImageData, x: number, y: number): [number, number, number, number] {
  const idx = getPixelIndex(imageData, x, y);
  return [imageData.data[idx], imageData.data[idx + 1], imageData.data[idx + 2], imageData.data[idx + 3]];
}

function setPixel(imageData: ImageData, x: number, y: number, color: [number, number, number, number]) {
  const idx = getPixelIndex(imageData, x, y);
  imageData.data[idx] = color[0];
  imageData.data[idx + 1] = color[1];
  imageData.data[idx + 2] = color[2];
  imageData.data[idx + 3] = color[3];
}

function getBounds(imageData: ImageData, rect?: RectRegion): RectRegion {
  if (!rect) return { x: 0, y: 0, width: imageData.width, height: imageData.height };
  return {
    x: clamp(Math.round(rect.x), 0, imageData.width - 1),
    y: clamp(Math.round(rect.y), 0, imageData.height - 1),
    width: clamp(Math.round(rect.width), 1, imageData.width - rect.x),
    height: clamp(Math.round(rect.height), 1, imageData.height - rect.y),
  };
}

export function applyBrush(imageData: ImageData, x: number, y: number, color: string, brushSize: number, mode: "pencil" | "eraser", rect?: RectRegion): ImageData {
  const next = cloneImageData(imageData);
  const bounds = getBounds(next, rect);
  const [r, g, b, a] = mode === "eraser" ? [0, 0, 0, 0] : hexToRgba(color);
  const target = [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255), Math.round((a ?? 1) * 255)];
  // A one-pixel brush must only touch its target pixel. The former minimum
  // radius of 1 also painted the four directly adjacent pixels as a cross.
  const radius = brushSize === 1 ? 0 : Math.max(1, brushSize);

  for (let py = Math.max(bounds.y, y - radius); py <= Math.min(bounds.y + bounds.height - 1, y + radius); py++) {
    for (let px = Math.max(bounds.x, x - radius); px <= Math.min(bounds.x + bounds.width - 1, x + radius); px++) {
      const dx = px - x;
      const dy = py - y;
      if (dx * dx + dy * dy > radius * radius) continue;
      setPixel(next, px, py, target as [number, number, number, number]);
    }
  }

  return next;
}

export function applyFill(imageData: ImageData, x: number, y: number, color: string, rect?: RectRegion): ImageData {
  const next = cloneImageData(imageData);
  const bounds = getBounds(next, rect);
  const targetColor = hexToRgba(color);
  const start = getPixel(next, x, y);
  const stack: Array<[number, number]> = [[x, y]];
  const fill = [Math.round(targetColor[0] * 255), Math.round(targetColor[1] * 255), Math.round(targetColor[2] * 255), Math.round(targetColor[3] * 255)];

  while (stack.length) {
    const [cx, cy] = stack.pop()!;
    if (cx < bounds.x || cx >= bounds.x + bounds.width || cy < bounds.y || cy >= bounds.y + bounds.height) continue;
    const current = getPixel(next, cx, cy);
    if (current[3] === 0 && start[3] === 0) {
      setPixel(next, cx, cy, fill as [number, number, number, number]);
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
      continue;
    }
    if (Math.abs(current[0] - start[0]) < 2 && Math.abs(current[1] - start[1]) < 2 && Math.abs(current[2] - start[2]) < 2 && Math.abs(current[3] - start[3]) < 2) {
      setPixel(next, cx, cy, fill as [number, number, number, number]);
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
  }

  return next;
}

export function applyRecolor(imageData: ImageData, options: RecolorOptions, rect?: RectRegion): ImageData {
  const next = cloneImageData(imageData);
  const bounds = getBounds(next, rect);
  const target = hexToRgba(options.color);

  for (let y = bounds.y; y < bounds.y + bounds.height; y++) {
    for (let x = bounds.x; x < bounds.x + bounds.width; x++) {
      const [r, g, b, a] = getPixel(next, x, y);
      if (a === 0) continue;
      const source = [r / 255, g / 255, b / 255, a / 255];
      const blended = blendColor(source as [number, number, number, number], target as [number, number, number, number], options.intensity, options.mode);
      setPixel(next, x, y, [Math.round(blended[0] * 255), Math.round(blended[1] * 255), Math.round(blended[2] * 255), Math.round(a)] as [number, number, number, number]);
    }
  }

  return next;
}

export function pickColorAt(imageData: ImageData, x: number, y: number): string {
  const [r, g, b] = getPixel(imageData, x, y);
  return rgbaToHex(r, g, b);
}
