import { useState } from "react";
import {
  applyBatchRecolor,
  applyBatchResize,
  applyBatchConvert,
  filterTexturesByPattern,
  filterTexturesBySize,
  selectAllTextures,
  selectNone,
  invertSelection,
  type RecolorBatchOptions,
  type ResizeBatchOptions,
  type ConvertBatchOptions,
} from "../lib/batchOperations";

interface BatchOperationsPanelProps {
  textures: string[];
  selectedTextures: string[];
  onSelectionChange: (selected: string[]) => void;
  onApplyRecolor: (options: RecolorBatchOptions) => Promise<{ success: string[]; failed: Array<{ path: string; error: string }> }>;
  onApplyResize: (options: ResizeBatchOptions) => Promise<{ success: string[]; failed: Array<{ path: string; error: string }> }>;
  onApplyConvert: (options: ConvertBatchOptions) => Promise<{ success: string[]; failed: Array<{ path: string; error: string }> }>;
  onClose: () => void;
  darkMode: boolean;
}

export default function BatchOperationsPanel({
  textures,
  selectedTextures,
  onSelectionChange,
  onApplyRecolor,
  onApplyResize,
  onApplyConvert,
  onClose,
  darkMode,
}: BatchOperationsPanelProps) {
  const [operationType, setOperationType] = useState<'recolor' | 'resize' | 'convert'>('recolor');
  const [filterPattern, setFilterPattern] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<{ success: string[]; failed: Array<{ path: string; error: string }> } | null>(null);

  // Recolor options
  const [recolorMode, setRecolorMode] = useState<RecolorBatchOptions['mode']>('tint');
  const [recolorColor, setRecolorColor] = useState('#ff0000');
  const [recolorIntensity, setRecolorIntensity] = useState(0.6);

  // Resize options
  const [resizeWidth, setResizeWidth] = useState(16);
  const [resizeHeight, setResizeHeight] = useState(16);
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true);

  // Convert options
  const [convertFormat, setConvertFormat] = useState<ConvertBatchOptions['format']>('png');
  const [convertQuality, setConvertQuality] = useState(0.9);

  const filteredTextures = filterPattern ? filterTexturesByPattern(textures, filterPattern) : textures;

  const handleSelectAll = () => {
    onSelectionChange(selectAllTextures(filteredTextures));
  };

  const handleSelectNone = () => {
    onSelectionChange(selectNone());
  };

  const handleInvertSelection = () => {
    onSelectionChange(invertSelection(selectedTextures, filteredTextures));
  };

  const handleApply = async () => {
    if (selectedTextures.length === 0) return;
    
    setIsProcessing(true);
    setResults(null);

    try {
      let result;
      if (operationType === 'recolor') {
        result = await onApplyRecolor({
          mode: recolorMode,
          color: recolorColor,
          intensity: recolorIntensity,
        });
      } else if (operationType === 'resize') {
        result = await onApplyResize({
          width: resizeWidth,
          height: resizeHeight,
          maintainAspectRatio,
        });
      } else if (operationType === 'convert') {
        result = await onApplyConvert({
          format: convertFormat,
          quality: convertQuality,
        });
      }
      setResults(result);
    } catch (error) {
      console.error('Batch operation failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={`fixed right-0 top-0 h-full w-96 ${darkMode ? 'bg-dark-primary' : 'bg-white'} border-l border-slate-200 dark:border-dark-border shadow-xl z-50 flex flex-col`}>
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-dark-border">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-dark-text-primary">Batch Operations</h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-secondary text-slate-500 dark:text-dark-text-secondary transition-colors"
          aria-label="Close batch operations"
        >
          ✕
        </button>
      </div>

      {/* Filter */}
      <div className="p-4 border-b border-slate-200 dark:border-dark-border">
        <label className="block text-sm font-medium text-slate-700 dark:text-dark-text-secondary mb-2">
          Filter textures
        </label>
        <input
          type="text"
          value={filterPattern}
          onChange={(e) => setFilterPattern(e.target.value)}
          placeholder="e.g., stone, dirt, oak"
          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-secondary text-slate-800 dark:text-dark-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="text-xs text-slate-500 dark:text-dark-text-tertiary mt-1">
          {filteredTextures.length} textures shown
        </div>
      </div>

      {/* Selection controls */}
      <div className="p-4 border-b border-slate-200 dark:border-dark-border flex gap-2">
        <button
          onClick={handleSelectAll}
          className="flex-1 px-3 py-2 rounded-lg bg-slate-100 dark:bg-dark-secondary text-slate-700 dark:text-dark-text-secondary text-sm font-medium hover:bg-slate-200 dark:hover:bg-dark-tertiary transition-colors"
        >
          Select All
        </button>
        <button
          onClick={handleSelectNone}
          className="flex-1 px-3 py-2 rounded-lg bg-slate-100 dark:bg-dark-secondary text-slate-700 dark:text-dark-text-secondary text-sm font-medium hover:bg-slate-200 dark:hover:bg-dark-tertiary transition-colors"
        >
          Select None
        </button>
        <button
          onClick={handleInvertSelection}
          className="flex-1 px-3 py-2 rounded-lg bg-slate-100 dark:bg-dark-secondary text-slate-700 dark:text-dark-text-secondary text-sm font-medium hover:bg-slate-200 dark:hover:bg-dark-tertiary transition-colors"
        >
          Invert
        </button>
      </div>

      {/* Operation type */}
      <div className="p-4 border-b border-slate-200 dark:border-dark-border">
        <label className="block text-sm font-medium text-slate-700 dark:text-dark-text-secondary mb-2">
          Operation type
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => setOperationType('recolor')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              operationType === 'recolor'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-dark-secondary text-slate-700 dark:text-dark-text-secondary hover:bg-slate-200 dark:hover:bg-dark-tertiary'
            }`}
          >
            Recolor
          </button>
          <button
            onClick={() => setOperationType('resize')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              operationType === 'resize'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-dark-secondary text-slate-700 dark:text-dark-text-secondary hover:bg-slate-200 dark:hover:bg-dark-tertiary'
            }`}
          >
            Resize
          </button>
          <button
            onClick={() => setOperationType('convert')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              operationType === 'convert'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-dark-secondary text-slate-700 dark:text-dark-text-secondary hover:bg-slate-200 dark:hover:bg-dark-tertiary'
            }`}
          >
            Convert
          </button>
        </div>
      </div>

      {/* Operation options */}
      <div className="flex-1 overflow-y-auto p-4">
        {operationType === 'recolor' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-dark-text-secondary mb-2">
                Recolor mode
              </label>
              <select
                value={recolorMode}
                onChange={(e) => setRecolorMode(e.target.value as RecolorBatchOptions['mode'])}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-secondary text-slate-800 dark:text-dark-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="tint">Tint</option>
                <option value="hue-shift">Hue Shift</option>
                <option value="colorize">Colorize</option>
                <option value="multiply">Multiply</option>
                <option value="overlay">Overlay</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-dark-text-secondary mb-2">
                Color
              </label>
              <input
                type="color"
                value={recolorColor}
                onChange={(e) => setRecolorColor(e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-200 dark:border-dark-border cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-dark-text-secondary mb-2">
                Intensity: {recolorIntensity.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={recolorIntensity}
                onChange={(e) => setRecolorIntensity(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        )}

        {operationType === 'resize' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-dark-text-secondary mb-2">
                Width (px)
              </label>
              <input
                type="number"
                min="1"
                value={resizeWidth}
                onChange={(e) => setResizeWidth(parseInt(e.target.value) || 16)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-secondary text-slate-800 dark:text-dark-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-dark-text-secondary mb-2">
                Height (px)
              </label>
              <input
                type="number"
                min="1"
                value={resizeHeight}
                onChange={(e) => setResizeHeight(parseInt(e.target.value) || 16)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-secondary text-slate-800 dark:text-dark-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={maintainAspectRatio}
                onChange={(e) => setMaintainAspectRatio(e.target.checked)}
                className="rounded border-slate-300 dark:border-dark-border"
              />
              <span className="text-sm text-slate-700 dark:text-dark-text-secondary">Maintain aspect ratio</span>
            </label>
          </div>
        )}

        {operationType === 'convert' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-dark-text-secondary mb-2">
                Format
              </label>
              <select
                value={convertFormat}
                onChange={(e) => setConvertFormat(e.target.value as ConvertBatchOptions['format'])}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-secondary text-slate-800 dark:text-dark-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="png">PNG</option>
                <option value="jpg">JPG</option>
                <option value="webp">WebP</option>
              </select>
            </div>
            {(convertFormat === 'jpg' || convertFormat === 'webp') && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-dark-text-secondary mb-2">
                  Quality: {convertQuality.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.1"
                  value={convertQuality}
                  onChange={(e) => setConvertQuality(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      {results && (
        <div className="p-4 border-t border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-secondary">
          <div className="text-sm font-medium text-slate-700 dark:text-dark-text-secondary mb-2">
            Results
          </div>
          <div className="text-sm text-green-600 dark:text-green-400">
            ✓ {results.success.length} succeeded
          </div>
          {results.failed.length > 0 && (
            <div className="text-sm text-red-600 dark:text-red-400 mt-1">
              ✗ {results.failed.length} failed
            </div>
          )}
        </div>
      )}

      {/* Apply button */}
      <div className="p-4 border-t border-slate-200 dark:border-dark-border">
        <button
          onClick={handleApply}
          disabled={selectedTextures.length === 0 || isProcessing}
          className="w-full px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
        >
          {isProcessing ? 'Processing...' : `Apply to ${selectedTextures.length} textures`}
        </button>
      </div>
    </div>
  );
}