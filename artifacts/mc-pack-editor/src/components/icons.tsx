import {
  Boxes,
  Swords,
  LayoutPanelTop,
  Rabbit,
  Sparkles,
  CloudSun,
  Type,
  Package,
  Map as MapIcon,
  Palette,
  Box,
  Volume2,
  Languages,
  Folder,
  type LucideIcon,
} from "lucide-react";
import type { FolderIconKey } from "../types";

/** Maps a Minecraft resource folder to its icon. */
const FOLDER_ICONS: Record<FolderIconKey, LucideIcon> = {
  blocks: Boxes,
  items: Swords,
  gui: LayoutPanelTop,
  entity: Rabbit,
  particle: Sparkles,
  environment: CloudSun,
  font: Type,
  misc: Package,
  map: MapIcon,
  colormap: Palette,
  models: Box,
  sounds: Volume2,
  lang: Languages,
};

export function getFolderIcon(key: string): LucideIcon {
  return FOLDER_ICONS[key as FolderIconKey] ?? Folder;
}

export function FolderIcon({
  folderKey,
  className = "h-4 w-4",
}: {
  folderKey: string;
  className?: string;
}) {
  const Icon = getFolderIcon(folderKey);
  return <Icon className={className} aria-hidden="true" />;
}
