import { McSegment } from "../types/editor";
import { RecolorMode } from "./textureEditor";

export const MC_COLOR_MAP: Record<string, string> = {
  "0": "#000000", "1": "#0000AA", "2": "#00AA00", "3": "#00AAAA",
  "4": "#AA0000", "5": "#AA00AA", "6": "#FFAA00", "7": "#AAAAAA",
  "8": "#555555", "9": "#5555FF", "a": "#55FF55", "b": "#55FFFF",
  "c": "#FF5555", "d": "#FF55FF", "e": "#FFFF55", "f": "#FFFFFF",
};

export const MC_COLORS = [
  // Black/White
  { code: "§0", color: "#000000", label: "Black" },
  { code: "§f", color: "#FFFFFF", label: "White" },
  // Dark colors
  { code: "§8", color: "#555555", label: "Dark Gray" },
  { code: "§1", color: "#0000AA", label: "Dark Blue" },
  { code: "§2", color: "#00AA00", label: "Dark Green" },
  { code: "§4", color: "#AA0000", label: "Dark Red" },
  { code: "§5", color: "#AA00AA", label: "Dark Purple" },
  { code: "§3", color: "#00AAAA", label: "Dark Aqua" },
  // Light colors
  { code: "§7", color: "#AAAAAA", label: "Gray" },
  { code: "§9", color: "#5555FF", label: "Blue" },
  { code: "§a", color: "#55FF55", label: "Green" },
  { code: "§c", color: "#FF5555", label: "Red" },
  { code: "§d", color: "#FF55FF", label: "Light Purple" },
  { code: "§b", color: "#55FFFF", label: "Aqua" },
  // Gold/Yellow
  { code: "§6", color: "#FFAA00", label: "Gold" },
  { code: "§e", color: "#FFFF55", label: "Yellow" },
];

export const MC_FORMATS = [
  { code: "§l", label: "B",   title: "Bold (§l)",        style: { fontWeight: "bold" as const } },
  { code: "§o", label: "I",   title: "Italic (§o)",      style: { fontStyle: "italic" as const } },
  { code: "§n", label: "U",   title: "Underline (§n)",   style: { textDecoration: "underline" } },
  { code: "§m", label: "S",   title: "Strikethrough (§m)", style: { textDecoration: "line-through" } },
  { code: "§k", label: "Obf", title: "Obfuscated (§k)", style: {} },
  { code: "§r", label: "R",   title: "Reset (§r)",       style: {} },
];

export function stripColorCodes(name: string): string {
  return name.replace(/§[0-9a-fk-or]/gi, '').replace(/&[0-9a-fk-or]/gi, '');
}

export function parseMcText(raw: string): McSegment[] {
  const segments: McSegment[] = [];
  let color: string | undefined;
  let bold = false, italic = false, underline = false, strikethrough = false;

  // Split on § codes; keep delimiters
  const parts = raw.split(/(§[0-9a-fklmnorA-FKLMNOR])/);
  for (const part of parts) {
    if (part.startsWith("§") && part.length === 2) {
      const ch = part[1].toLowerCase();
      if (MC_COLOR_MAP[ch]) {
        color = MC_COLOR_MAP[ch];
        bold = italic = underline = strikethrough = false;
      } else if (ch === "l") { bold = true; }
      else if (ch === "o") { italic = true; }
      else if (ch === "n") { underline = true; }
      else if (ch === "m") { strikethrough = true; }
      else if (ch === "r") {
        color = undefined;
        bold = italic = underline = strikethrough = false;
      }
      // §k (obfuscated) intentionally ignored
    } else if (part) {
      segments.push({ text: part, color, bold, italic, underlined: underline, strikethrough });
    }
  }
  return segments;
}

export function isValidHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

export function hexToRgbColor(value: string): [number, number, number] {
  const normalized = isValidHexColor(value) ? value.slice(1) : "000000";
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
}

export function rgbToHexColor(red: number, green: number, blue: number): string {
  const channel = (value: number) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0");
  return `#${channel(red)}${channel(green)}${channel(blue)}`;
}

export function applyRecolorToPixel(
  r: number,
  g: number,
  b: number,
  options: { mode: RecolorMode; color: string; intensity: number }
): { r: number; g: number; b: number } {
  const [targetR, targetG, targetB] = hexToRgbColor(options.color);
  const intensity = options.intensity;
  
  switch (options.mode) {
    case "tint": {
      return {
        r: Math.round(r + (targetR - r) * intensity),
        g: Math.round(g + (targetG - g) * intensity),
        b: Math.round(b + (targetB - b) * intensity),
      };
    }
    case "colorize": {
      const avg = (r + g + b) / 3;
      return {
        r: Math.round(avg + (targetR - avg) * intensity),
        g: Math.round(avg + (targetG - avg) * intensity),
        b: Math.round(avg + (targetB - avg) * intensity),
      };
    }
    case "multiply": {
      return {
        r: Math.round(r * (targetR / 255) * (1 + intensity)),
        g: Math.round(g * (targetG / 255) * (1 + intensity)),
        b: Math.round(b * (targetB / 255) * (1 + intensity)),
      };
    }
    case "overlay": {
      const overlay = (base: number, over: number) => {
        return base < 128 
          ? Math.round(2 * base * over / 255)
          : Math.round(255 - 2 * (255 - base) * (255 - over) / 255);
      };
      const blendedR = overlay(r, targetR);
      const blendedG = overlay(g, targetG);
      const blendedB = overlay(b, targetB);
      return {
        r: Math.round(r + (blendedR - r) * intensity),
        g: Math.round(g + (blendedG - g) * intensity),
        b: Math.round(b + (blendedB - b) * intensity),
      };
    }
    case "hue-shift": {
      // Convert to HSL, shift hue, convert back
      const toHsl = (red: number, green: number, blue: number) => {
        const rNorm = red / 255, gNorm = green / 255, bNorm = blue / 255;
        const max = Math.max(rNorm, gNorm, bNorm), min = Math.min(rNorm, gNorm, bNorm);
        let h = 0, s = 0, l = (max + min) / 2;
        
        if (max !== min) {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          switch (max) {
            case rNorm: h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) / 6; break;
            case gNorm: h = ((bNorm - rNorm) / d + 2) / 6; break;
            case bNorm: h = ((rNorm - gNorm) / d + 4) / 6; break;
          }
        }
        return { h: h * 360, s, l };
      };
      
      const toRgb = (h: number, s: number, l: number) => {
        let rOut, gOut, bOut;
        if (s === 0) {
          rOut = gOut = bOut = l;
        } else {
          const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
          };
          const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
          const p = 2 * l - q;
          rOut = hue2rgb(p, q, h / 360 + 1/3);
          gOut = hue2rgb(p, q, h / 360);
          bOut = hue2rgb(p, q, h / 360 - 1/3);
        }
        return { r: Math.round(rOut * 255), g: Math.round(gOut * 255), b: Math.round(bOut * 255) };
      };
      
      const currentHsl = toHsl(r, g, b);
      const targetHsl = toHsl(targetR, targetG, targetB);
      const hueShift = (targetHsl.h - currentHsl.h) * intensity;
      const newHsl = { h: (currentHsl.h + hueShift + 360) % 360, s: currentHsl.s, l: currentHsl.l };
      const newRgb = toRgb(newHsl.h, newHsl.s, newHsl.l);
      
      return newRgb;
    }
    default:
      return { r, g, b };
  }
}
