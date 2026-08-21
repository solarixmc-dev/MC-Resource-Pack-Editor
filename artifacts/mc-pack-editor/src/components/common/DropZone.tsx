import { useState, useRef, useCallback } from "react";
import { Pack } from "../../types";
import { loadPackFromFile } from "../../lib/zipUtils";

export interface DropZoneProps {
  onLoad: (packs: Pack[]) => void;
  onTextureImport: (file: File) => void;
  darkMode: boolean;
}

export function DropZone({ onLoad, onTextureImport, darkMode }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files);
      const zipFiles = arr.filter((f) => f.name.toLowerCase().endsWith(".zip"));
      const pngFiles = arr.filter((f) => f.name.toLowerCase().endsWith(".png"));

      setLoading(true);
      try {
        if (zipFiles.length > 0) {
          const loaded = await Promise.all(zipFiles.map(loadPackFromFile));
          onLoad(loaded);
        }
        if (pngFiles.length > 0) {
          pngFiles.forEach(onTextureImport);
        }
      } catch (e) {
        console.error("Failed to load pack:", e);
      } finally {
        setLoading(false);
      }
    },
    [onLoad, onTextureImport]
  );

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-lg p-8 cursor-pointer transition-colors
        ${dragging ? "border-black dark:border-white bg-black/5 dark:bg-white/5" : darkMode ? "border-dark-border hover:border-dark-text hover:bg-dark-tertiary" : "border-slate-300 hover:border-black hover:bg-slate-50"}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".zip,.png"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
      <svg className={`w-10 h-10 ${darkMode ? "text-dark-text-tertiary" : "text-slate-500"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 13v8" /><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" /><path d="m8 17 4-4 4 4" />
      </svg>
      {loading ? (
        <p className={`text-sm animate-pulse ${darkMode ? "text-dark-text-tertiary" : "text-slate-500"}`}>Loading…</p>
      ) : (
        <>
          <p className={`text-sm ${darkMode ? "text-dark-text-secondary" : "text-slate-600"}`}>Drop ZIP or PNG files here</p>
          <p className={`text-xs ${darkMode ? "text-dark-text-tertiary" : "text-slate-400"}`}>or click to browse</p>
        </>
      )}
    </div>
  );
}

export default DropZone;
