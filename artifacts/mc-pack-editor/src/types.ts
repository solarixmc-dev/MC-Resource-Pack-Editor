export type LayoutMode = "normal" | "modern";

export interface Pack {
  id: string;
  name: string;
  files: Map<string, ArrayBuffer>;
  color: string;
}

export interface TextureEntry {
  path: string;
  displayName: string;
  folder: string;
}

export type FolderSources = Record<string, string>;
export type TextureOverrides = Record<string, string>;

export const PACK_COLORS = [
  "#4ade80", "#60a5fa", "#f87171", "#fbbf24",
  "#a78bfa", "#34d399", "#f472b6", "#38bdf8",
];

/** Semantic icon key — resolved to an SVG icon in components/icons.tsx. */
export type FolderIconKey =
  | "blocks"
  | "items"
  | "gui"
  | "entity"
  | "particle"
  | "environment"
  | "font"
  | "misc"
  | "map"
  | "colormap"
  | "models"
  | "sounds"
  | "lang";

export const MC_FOLDERS: { key: string; label: string; icon: FolderIconKey }[] = [
  { key: "blocks",      label: "Blocks",      icon: "blocks" },
  { key: "items",       label: "Items",       icon: "items" },
  { key: "gui",         label: "GUI",         icon: "gui" },
  { key: "entity",      label: "Entity",      icon: "entity" },
  { key: "particle",    label: "Particles",   icon: "particle" },
  { key: "environment", label: "Environment", icon: "environment" },
  { key: "font",        label: "Font",        icon: "font" },
  { key: "misc",        label: "Misc",        icon: "misc" },
  { key: "map",         label: "Map",         icon: "map" },
  { key: "colormap",    label: "Colormap",    icon: "colormap" },
  { key: "models",      label: "Models",      icon: "models" },
  { key: "sounds",      label: "Sounds",      icon: "sounds" },
  { key: "lang",        label: "Language",    icon: "lang" },
];
