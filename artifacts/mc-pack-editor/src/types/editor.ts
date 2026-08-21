export interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error';
}

export interface McSegment {
  text: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underlined?: boolean;
  strikethrough?: boolean;
  obfuscated?: boolean;
}

export type McFormatKey = "bold" | "italic" | "underlined" | "strikethrough" | "obfuscated";

export type CheckerboardStyle = 'light' | 'dark';

export interface UploadDefaults {
  name: string;
  description: string;
  icon: string | null;
  copyFromTopPack?: boolean;
  formatVersion?: number;
}

export interface RectRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}
