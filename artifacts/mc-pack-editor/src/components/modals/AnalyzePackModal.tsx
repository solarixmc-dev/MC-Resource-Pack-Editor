import { PackAnalysis } from "../../lib/packAnalyzer";

export interface AnalyzePackModalProps {
  analysis: PackAnalysis | null;
  isAnalyzing: boolean;
  onClose: () => void;
  darkMode: boolean;
}

export function AnalyzePackModal({
  analysis,
  isAnalyzing,
  onClose,
  darkMode,
}: AnalyzePackModalProps) {
  const cardBase = `rounded-lg border p-3 shadow-sm ${darkMode ? "border-dark-border bg-dark-secondary" : "border-slate-200 bg-white"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className={`max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border p-5 shadow-2xl ${darkMode ? "border-dark-border bg-dark-secondary" : "border-slate-200 bg-white"}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-[0.24em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Pack analysis</p>
            <h3 className={`text-xl font-semibold ${darkMode ? "text-slate-100" : "text-slate-700"}`}>Resource pack overview</h3>
          </div>
          <button onClick={onClose} className={`rounded-full border px-2.5 py-1 text-sm ${darkMode ? "border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200" : "border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-700"}`}>✕</button>
        </div>

        {isAnalyzing || !analysis ? (
          <div className={`mt-6 flex min-h-[220px] items-center justify-center rounded-lg border border-dashed ${darkMode ? "border-slate-700 bg-slate-800" : "border-slate-300 bg-slate-50"}`}>
            <div className="text-center">
              <div className={`mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full text-2xl ${darkMode ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-500/10 text-emerald-600"}`}>✨</div>
              <p className={`text-sm font-medium ${darkMode ? "text-slate-200" : "text-slate-700"}`}>Scanning the current pack locally…</p>
              <p className={`mt-1 text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Using the current uploaded ZIP data and atlas definitions.</p>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <div className={`rounded-lg border p-4 border-emerald-500/30 bg-emerald-500/10 ${darkMode ? "" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className={`text-sm font-semibold ${darkMode ? "text-slate-200" : "text-slate-700"}`}>{analysis.packNames.join(", ") || "Loaded pack"}</p>
                  <p className={`mt-1 text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{analysis.overallSummary}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300`}>
                    1.8.9 compatible
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <div className={cardBase}>
                <p className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>File size</p>
                <p className={`mt-2 text-xl font-semibold ${darkMode ? "text-slate-100" : "text-slate-700"}`}>{analysis.totalSizeLabel}</p>
                <p className={`mt-1 text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{analysis.totalFiles} files inspected</p>
              </div>
              <div className={cardBase}>
                <p className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Base texture resolution</p>
                <p className={`mt-2 text-xl font-semibold ${darkMode ? "text-slate-100" : "text-slate-700"}`}>{analysis.baseTextureResolution}</p>
                <p className={`mt-1 text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{analysis.mixedResolutions ? "Mixed resolutions detected" : "Consistent texture size"}</p>
              </div>
              <div className={cardBase}>
                <p className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Total textures</p>
                <p className={`mt-2 text-xl font-semibold ${darkMode ? "text-slate-100" : "text-slate-700"}`}>{analysis.modifiedTextureCount}</p>
                <p className={`mt-1 text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Unique textures in pack</p>
              </div>
              <div className={cardBase}>
                <p className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Version range</p>
                <p className={`mt-2 text-xl font-semibold ${darkMode ? "text-slate-100" : "text-slate-700"}`}>{analysis.versionRange}</p>
                <p className={`mt-1 text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Detected compatibility</p>
              </div>
              <div className={cardBase}>
                <p className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Missing textures</p>
                <p className={`mt-2 text-xl font-semibold ${darkMode ? "text-slate-100" : "text-slate-700"}`}>{analysis.missingTextures.length}</p>
                <p className={`mt-1 text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Core textures not found</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AnalyzePackModal;
