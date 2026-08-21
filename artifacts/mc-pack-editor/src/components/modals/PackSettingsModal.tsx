import React, { useState, useRef, useEffect } from "react";
import { MC_COLORS, MC_FORMATS } from "../../lib/colorUtils";
import { McText } from "../common/McText";

export const DEFAULT_UPLOAD_DEFAULTS = {
  name: "My Resource Pack",
  description: "A Minecraft 1.8 Resource Pack",
  icon: null as string | null,
  copyFromTopPack: true,
};

export interface PackSettingsModalProps {
  packName: string;
  packDescription: string;
  packIcon: string | null;
  onNameChange: (n: string) => void;
  onDescriptionChange: (d: string) => void;
  onIconChange: (d: string | null) => void;
  darkMode: boolean;
  stripColorCodes?: (name: string) => string;
}

export function PackSettingsModal({
  packName,
  packDescription,
  packIcon,
  onNameChange,
  onDescriptionChange,
  onIconChange,
  darkMode,
  stripColorCodes: _stripColorCodes,
}: PackSettingsModalProps) {
  const iconRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [activeField, setActiveField] = useState<"name" | "desc">("desc");
  const [colorCodesOpen, setColorCodesOpen] = useState(false);

  useEffect(() => {
    if (colorCodesOpen && dropdownRef.current) {
      dropdownRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [colorCodesOpen]);

  const handleIcon = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => onIconChange(reader.result as string);
    reader.readAsDataURL(f);
  };

  const insertCode = (code: string) => {
    const ref = activeField === "name" ? nameRef : descRef;
    const onChange = activeField === "name" ? onNameChange : onDescriptionChange;
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const newValue = el.value.slice(0, start) + code + el.value.slice(end);
    onChange(newValue);
    requestAnimationFrame(() => {
      el.setSelectionRange(start + code.length, start + code.length);
      el.focus();
    });
  };

  return (
    <div className="flex items-start gap-3">
      {/* Pack icon */}
      <button
        className={`w-12 h-12 rounded-lg border flex-shrink-0 overflow-hidden checkered transition-colors cursor-pointer mt-5 ${darkMode ? "border-dark-border hover:border-dark-text" : "border-slate-200 hover:border-black"}`}
        onClick={() => iconRef.current?.click()}
        title="Click to change pack icon"
      >
        {packIcon ? (
          <img src={packIcon} alt="icon" className="w-full h-full object-cover texture-preview" />
        ) : (
          <svg className="w-5 h-5 text-slate-400 dark:text-dark-text-tertiary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M12 13v8" /><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /><path d="m8 17 4-4 4 4" /></svg>
        )}
        <input ref={iconRef} type="file" accept="image/*" className="hidden" onChange={handleIcon} />
      </button>

      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        {/* Pack name */}
        <div className="flex flex-col gap-1">
          <label className={`text-xs font-medium ${darkMode ? "text-dark-text-tertiary" : "text-slate-500"}`}>Output Pack Name</label>
          <input
            ref={nameRef}
            type="text"
            value={packName}
            onFocus={() => setActiveField("name")}
            onChange={(e) => onNameChange(e.target.value)}
            className="rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 focus:border-black dark:focus:border-white w-full bg-white border-slate-200 text-slate-700 dark:bg-dark-tertiary dark:border-dark-border dark:text-dark-text-secondary"
            placeholder="My Resource Pack"
          />
          {packName.includes("§") && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-black rounded-lg border border-dark-border text-sm min-h-[26px]">
              <McText text={packName} fallback="…" />
            </div>
          )}
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1">
          <label className={`text-xs font-medium ${darkMode ? "text-dark-text-tertiary" : "text-slate-500"}`}>
            Description <span className="opacity-60">(pack.mcmeta)</span>
          </label>
          <input
            ref={descRef}
            type="text"
            value={packDescription}
            onFocus={() => setActiveField("desc")}
            onChange={(e) => onDescriptionChange(e.target.value)}
            className="rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 focus:border-black dark:focus:border-white w-full bg-white border-slate-200 text-slate-700 dark:bg-dark-tertiary dark:border-dark-border dark:text-dark-text-secondary"
            placeholder="A Minecraft resource pack"
          />
          {packDescription.includes("§") && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-black rounded-lg border border-dark-border text-sm min-h-[26px]">
              <McText text={packDescription} fallback="…" />
            </div>
          )}
        </div>

        {/* Format code button */}
        <div className="flex flex-col gap-1 relative">
          <button
            onClick={() => setColorCodesOpen(!colorCodesOpen)}
            className="flex items-center gap-1.5 text-left transition-colors hover:opacity-70"
          >
            <label className={`text-xs font-medium ${darkMode ? "text-dark-text-tertiary" : "text-slate-500"}`}>Open Codes</label>
            <span className={`text-xs ${darkMode ? "text-dark-text" : "text-black"}`}>
              {colorCodesOpen ? "↓" : "→"} inserting into <span className="font-semibold">{activeField === "name" ? "Name" : "Description"}</span>
            </span>
          </button>

          {/* Format codes dropdown */}
          {colorCodesOpen && (
            <div
              ref={dropdownRef}
              className={`absolute top-full left-0 z-[100] w-full max-w-md rounded-xl border shadow-2xl mt-2 ${darkMode ? "bg-dark-secondary border-dark-border" : "bg-white border-slate-200"}`}
            >
              <div className="p-4 flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? "text-dark-text-tertiary" : "text-slate-500"}`}>Colors</span>
                  <div className="flex flex-wrap gap-1.5">
                    {MC_COLORS.map(({ code, color, label }) => (
                      <button
                        key={code}
                        onMouseDown={(e) => { e.preventDefault(); insertCode(code); }}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold hover:scale-110 transition-transform flex-shrink-0 border border-white/10"
                        style={{
                          background: color,
                          color: ["#000000","#555555","#0000AA","#00AA00","#00AAAA","#AA0000","#AA00AA"].includes(color) ? "#fff" : "#000",
                        }}
                        title={`${label} (${code})`}
                      >
                        A
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? "text-dark-text-tertiary" : "text-slate-500"}`}>Formatting</span>
                  <div className="flex flex-wrap gap-1.5">
                    {MC_FORMATS.map(({ code, label, title, style }) => (
                      <button
                        key={code}
                        onMouseDown={(e) => { e.preventDefault(); insertCode(code); }}
                        className={`px-3 h-8 rounded-lg text-sm transition-colors flex-shrink-0 border ${darkMode ? "border-dark-border hover:bg-dark-tertiary" : "border-slate-200 hover:bg-slate-100"}`}
                        style={style}
                        title={title}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PackSettingsModal;
