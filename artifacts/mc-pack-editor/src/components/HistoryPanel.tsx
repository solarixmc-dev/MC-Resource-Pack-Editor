import { useState, useEffect } from "react";

interface HistoryEntry {
  id: string;
  timestamp: Date;
  action: string;
  details: string;
  texturePath?: string;
}

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HistoryPanel({ isOpen, onClose }: HistoryPanelProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Load history from localStorage
  useEffect(() => {
    if (isOpen) {
      const savedHistory = localStorage.getItem('texturelab-history');
      if (savedHistory) {
        try {
          const parsed = JSON.parse(savedHistory);
          setHistory(parsed.map((entry: any) => ({
            ...entry,
            timestamp: new Date(entry.timestamp)
          })));
        } catch (error) {
          console.error('Failed to parse history:', error);
        }
      }
    }
  }, [isOpen]);

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('texturelab-history');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-dark-secondary rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-dark-border">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-black dark:text-dark-text">History Timeline</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {history.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 dark:bg-dark-tertiary rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-500 dark:text-gray-400">No history yet. Start editing textures to see your changes here!</p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-dark-border"></div>

              {/* Timeline entries */}
              <div className="space-y-6">
                {history.map((entry, index) => (
                  <div key={entry.id} className="relative pl-12">
                    {/* Timeline dot */}
                    <div className="absolute left-2.5 w-3 h-3 bg-[#C2B280] rounded-full border-2 border-white dark:border-dark-secondary"></div>

                    {/* Entry content */}
                    <div className="bg-gray-50 dark:bg-dark-tertiary rounded-lg p-4 border border-gray-200 dark:border-dark-border">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-black dark:text-dark-text">{entry.action}</h3>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {entry.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{entry.details}</p>
                      {entry.texturePath && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 font-mono bg-gray-100 dark:bg-dark-border px-2 py-1 rounded inline-block">
                          {entry.texturePath}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-dark-border">
          <button
            onClick={clearHistory}
            className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
          >
            Clear History
          </button>
        </div>
      </div>
    </div>
  );
}