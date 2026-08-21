import React, { useRef, useEffect } from "react";
import { CheckerboardStyle } from "../../types/editor";

export interface SettingsModalProps {
  texturesPerRow: number;
  onTexturesPerRowChange: (n: number) => void;
  defaultPackName: string;
  defaultPackDescription: string;
  defaultPackIcon: string | null;
  onDefaultNameChange: (v: string) => void;
  onDefaultDescriptionChange: (v: string) => void;
  onDefaultIconChange: (dataUrl: string) => void;
  onDefaultIconRemove: () => void;
  copyFromTopPack: boolean;
  onCopyFromTopPackChange: (v: boolean) => void;
  checkerboardStyle?: CheckerboardStyle;
  onCheckerboardStyleChange?: (style: CheckerboardStyle) => void;
  onClose: () => void;
}

export function SettingsModal({
  texturesPerRow,
  onTexturesPerRowChange,
  defaultPackName,
  defaultPackDescription,
  defaultPackIcon,
  onDefaultNameChange,
  onDefaultDescriptionChange,
  onDefaultIconChange,
  onDefaultIconRemove,
  copyFromTopPack,
  onCopyFromTopPackChange,
  checkerboardStyle: _checkerboardStyle,
  onCheckerboardStyleChange: _onCheckerboardStyleChange,
  onClose,
}: SettingsModalProps) {
  const iconInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const handleIconFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => onDefaultIconChange(reader.result as string);
    reader.readAsDataURL(f);
    e.target.value = "";
  };

  const clampCols = (n: number) => Math.max(1, Math.min(12, n));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-76 rounded-xl shadow-2xl flex flex-col overflow-hidden bg-white border-slate-200 dark:bg-dark-secondary dark:border-dark-border"
        style={{ width: 288 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-dark-border">
          <span className="font-semibold text-sm text-slate-700 dark:text-dark-text">Settings</span>
          <button onClick={onClose} className="text-lg leading-none text-slate-400 hover:text-slate-700 dark:hover:text-dark-text">✕</button>
        </div>

        {/* Display */}
        <div className="px-4 py-3 flex flex-col gap-3 border-b border-slate-200 dark:border-dark-border">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-dark-text-tertiary">Display</span>

          <div className="flex items-center gap-2">
            <span className="text-sm flex-1 text-slate-700 dark:text-dark-text-secondary">Textures per row</span>
            <button
              onClick={() => onTexturesPerRowChange(clampCols(texturesPerRow - 1))}
              className="w-7 h-7 rounded text-sm font-bold flex items-center justify-center transition-colors bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 dark:bg-dark-tertiary dark:hover:bg-dark-border dark:border-dark-border dark:text-dark-text-secondary"
            >−</button>
            <input
              type="number"
              value={texturesPerRow}
              onChange={(e) => onTexturesPerRowChange(clampCols(parseInt(e.target.value) || 6))}
              className="w-10 text-center rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:ring-white/20 focus:border-blue-500 bg-white border-slate-200 text-slate-700 dark:bg-dark-tertiary dark:border-dark-border dark:text-dark-text-secondary"
              min={1} max={12}
            />
            <button
              onClick={() => onTexturesPerRowChange(clampCols(texturesPerRow + 1))}
              className="w-7 h-7 rounded text-sm font-bold flex items-center justify-center transition-colors bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 dark:bg-dark-tertiary dark:hover:bg-dark-border dark:border-dark-border dark:text-dark-text-secondary"
            >+</button>
          </div>
        </div>

        {/* Upload defaults */}
        <div className="px-4 py-3 flex flex-col gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-dark-text-tertiary">Upload defaults</span>

          {/* Copy from top pack */}
          <div className="flex items-center gap-2">
            <span className="text-sm flex-1 text-slate-700 dark:text-dark-text-secondary">Copy from top imported pack</span>
            <button
              onClick={() => onCopyFromTopPackChange(!copyFromTopPack)}
              className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${copyFromTopPack ? "bg-black dark:bg-dark-text" : "bg-slate-200 dark:bg-dark-tertiary"}`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${copyFromTopPack ? "right-0.5" : "left-0.5"}`}
              />
            </button>
          </div>
          <div className="text-xs text-slate-500 dark:text-dark-text-tertiary">
            When enabled, copies icon, name, and description from the top imported pack. When disabled, uses manual defaults.
          </div>

          {/* Icon */}
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <button
                className="w-14 h-14 rounded border overflow-hidden checkered transition-colors cursor-pointer border-slate-200 dark:border-dark-border hover:border-white dark:hover:border-dark-text bg-slate-50 dark:bg-dark-tertiary"
                onClick={() => iconInputRef.current?.click()}
                title="Click to set pack icon"
              >
                {defaultPackIcon ? (
                  <img src={defaultPackIcon} className="w-full h-full object-cover texture-preview" />
                ) : (
                  <svg className="w-6 h-6 text-slate-400 dark:text-dark-text-tertiary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M12 13v8" /><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /><path d="m8 17 4-4 4 4" /></svg>
                )}
              </button>
              {defaultPackIcon && (
                <button
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center hover:opacity-90"
                  onClick={onDefaultIconRemove}
                  title="Remove icon"
                >✕</button>
              )}
            </div>
            <input ref={iconInputRef} type="file" accept="image/*" className="hidden" onChange={handleIconFile} />
            <div className="flex-1 text-xs text-slate-500 dark:text-dark-text-tertiary">
              {defaultPackIcon ? "Click icon to replace" : "Click icon to upload"}
              <br />These values are used as defaults for new uploads.
            </div>
          </div>

          {/* Name */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 dark:text-dark-text-tertiary">Default pack name</label>
            <input
              type="text"
              value={defaultPackName}
              onChange={(e) => onDefaultNameChange(e.target.value)}
              className="rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black dark:ring-white/20 focus:border-blue-500 bg-white border-slate-200 text-slate-700 dark:bg-dark-tertiary dark:border-dark-border dark:text-dark-text-secondary"
              placeholder="My Resource Pack"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 dark:text-dark-text-tertiary">Default description (pack.mcmeta)</label>
            <input
              type="text"
              value={defaultPackDescription}
              onChange={(e) => onDefaultDescriptionChange(e.target.value)}
              className="rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black dark:ring-white/20 focus:border-blue-500 bg-white border-slate-200 text-slate-700 dark:bg-dark-tertiary dark:border-dark-border dark:text-dark-text-secondary"
              placeholder="A Minecraft resource pack"
            />
          </div>

          {/* Save button */}
          <button
            onClick={onClose}
            className="mt-2 w-full py-2.5 rounded-lg text-sm font-semibold transition-colors bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 shadow-lg"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
