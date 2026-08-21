import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "wouter";
import { SavedPack, getLocalPackLibrary } from "../lib/packLibrary";
import { loadPackFromFile } from "../lib/zipUtils";

// Notification type

// Notification type
interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error';
}

// Minecraft color code parser
const parseMinecraftFormatting = (text: string, addOutline = false): React.ReactNode => {
  if (!text) return null;

  const colorMap: Record<string, string> = {
    '0': '#000000',
    '1': '#0000AA',
    '2': '#00AA00',
    '3': '#00AAAA',
    '4': '#AA0000',
    '5': '#AA00AA',
    '6': '#FFAA00',
    '7': '#AAAAAA',
    '8': '#555555',
    '9': '#5555FF',
    'a': '#55FF55',
    'b': '#55FFFF',
    'c': '#FF5555',
    'd': '#FF55FF',
    'e': '#FFFF55',
    'f': '#FFFFFF',
  };

  const formatMap: Record<string, string> = {
    'l': 'bold',
    'm': 'line-through',
    'n': 'underline',
    'o': 'italic',
  };

  // Split by § or & characters
  const parts = text.split(/[§&]/);
  const segments: Array<{ text: string; color?: string; format?: string }> = [];
  let currentColor = colorMap['f']; // Default white
  let currentFormat: string[] = [];

  parts.forEach((part, index) => {
    if (index === 0 && part) {
      // First part before any color code
      segments.push({ text: part, color: currentColor });
      return;
    }

    if (part.length === 0) return;

    const code = part[0].toLowerCase();
    const text = part.slice(1);

    if (colorMap[code]) {
      currentColor = colorMap[code];
      currentFormat = []; // Reset formats on color change
    } else if (code === 'r') {
      currentColor = colorMap['f'];
      currentFormat = [];
    } else if (formatMap[code]) {
      if (!currentFormat.includes(formatMap[code])) {
        currentFormat.push(formatMap[code]);
      }
    }

    if (text) {
      segments.push({ 
        text, 
        color: currentColor,
        format: currentFormat.join(' ')
      });
    }
  });

  return segments.map((segment, index) => (
    <span 
      key={`${index}-${segment.text}`}
      style={{ 
        color: segment.color,
        fontWeight: segment.format?.includes('bold') ? 'bold' : 'normal',
        textDecoration: segment.format?.includes('underline') ? 'underline' : 
                      segment.format?.includes('line-through') ? 'line-through' : 'none',
        fontStyle: segment.format?.includes('italic') ? 'italic' : 'normal',
        textShadow: addOutline && segment.color === '#FFFFFF' ? '1px 1px 2px rgba(0,0,0,0.8), -1px -1px 2px rgba(0,0,0,0.8), 1px -1px 2px rgba(0,0,0,0.8), -1px 1px 2px rgba(0,0,0,0.8)' : 'none'
      }}
    >
      {segment.text}
    </span>
  ));
};

export default function LibraryPage() {
  const localLibrary = useMemo(() => getLocalPackLibrary(), []);
  const [packs, setPacks] = useState<SavedPack[]>([]);
  const [loading, setLoading] = useState(false);
  const [storageUsage, setStorageUsage] = useState({ used: 0, total: 500 * 1024 * 1024, percentage: 0 });
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Add notification
  const addNotification = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = crypto.randomUUID();
    setNotifications(prev => [...prev, { id, message, type }]);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 3000);
  }, []);

  // Function to load packs (shared between useEffect and refresh button)
  const loadPacks = useCallback(async () => {
    console.log('=== Loading packs ===');
    
    try {
      // Clean up old editor state entries
      const library = getLocalPackLibrary();
      await (library as any).cleanupOldEditorStateEntries();
      
      // Load from IndexedDB library
      const allPacks = await library.getAllPacks();
      console.log('Loaded packs:', allPacks);
      setPacks(allPacks || []);
    } catch (error) {
      console.error('Failed to load packs:', error);
      setPacks([]);
      addNotification('Failed to load packs from library', 'error');
    }
  }, [addNotification]);

  // Reload packs when component mounts
  useEffect(() => {
    loadPacks();
  }, [loadPacks]);

  const handleLoadPack = async (packId: string) => {
    setLoading(true);
    try {
      console.log('Loading pack with ID:', packId);
      
      // Set flag in localStorage to indicate which pack to load
      localStorage.setItem('mc-pack-editor-load-pack-id', packId);
      console.log('Pack load flag set in localStorage');
      addNotification("Pack loaded successfully!", "success");
      // Navigate to editor
      window.location.href = `/editor`;
    } catch (error) {
      console.error("Failed to load pack:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addNotification(`Failed to load pack: ${errorMessage}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPack = async (packId: string) => {
    try {
      // Load from IndexedDB library
      const packData = await localLibrary.loadPack(packId);
      
      if (packData) {
        const blob = new Blob([packData], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'resource-pack.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addNotification("Pack downloaded successfully!", "success");
      }
    } catch (error) {
      console.error("Failed to download pack:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addNotification(`Failed to download pack: ${errorMessage}`, "error");
    }
  };

  const handleDeletePack = async (packId: string) => {
    if (confirm("Are you sure you want to delete this pack from your library?")) {
      try {
        // Delete from IndexedDB library
        await localLibrary.deletePack(packId);
        await loadPacks();
        addNotification("Pack deleted successfully!", "success");
      } catch (error) {
        console.error('Failed to delete pack:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        addNotification(`Failed to delete pack: ${errorMessage}`, "error");
      }
    }
  };

  const handleClearAll = async () => {
    if (confirm("Are you sure you want to clear all saved packs?")) {
      try {
        // Clear IndexedDB library
        await localLibrary.clearAll();
        setPacks([]);
        addNotification("All packs cleared successfully!", "success");
      } catch (error) {
        console.error('Failed to clear packs:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        addNotification(`Failed to clear packs: ${errorMessage}`, "error");
      }
    }
  };

  // Update storage usage when packs change
  useEffect(() => {
    const totalSize = packs.reduce((sum, pack) => sum + pack.fileSize, 0);
    const totalLimit = 500 * 1024 * 1024; // 500MB estimated
    setStorageUsage({
      used: totalSize,
      total: totalLimit,
      percentage: (totalSize / totalLimit) * 100
    });
  }, [packs]);

  return (
    <>
      <div className="min-h-screen bg-white dark:bg-dark-bg flex flex-col">
        <div className="max-w-7xl mx-auto w-full px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-black dark:text-dark-text">Pack Library</h1>
              <p className="text-gray-600 dark:text-dark-text-secondary mt-1">
                Your saved resource packs
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={async () => {
                  console.log('Refresh clicked, reloading packs');
                  await loadPacks();
                }}
                className="text-sm text-gray-600 dark:text-dark-text-secondary hover:text-gray-900 dark:hover:text-dark-text"
              >
                Refresh
              </button>
              <button
                onClick={handleClearAll}
                className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
              >
                Clear All
              </button>
            </div>
          </div>

          {/* Storage Usage */}
          <div className="mb-8 bg-gray-50 dark:bg-dark-secondary rounded-lg p-4 border border-gray-200 dark:border-dark-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-dark-text-secondary">Storage Usage</span>
              <span className="text-sm text-gray-600 dark:text-dark-text-tertiary">
                {(storageUsage.used / 1024 / 1024).toFixed(2)} MB / {(storageUsage.total / 1024 / 1024).toFixed(0)} MB
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-dark-tertiary rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(storageUsage.percentage, 100)}%` }}
              />
            </div>
          </div>

          {/* Packs Grid */}
          {packs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-96 border-2 border-dashed border-gray-300 dark:border-dark-border rounded-lg">
              <svg className="w-16 h-16 mb-4 text-gray-400 dark:text-dark-text-tertiary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-700 dark:text-dark-text-secondary mb-2">No saved packs</h3>
              <p className="text-gray-500 dark:text-dark-text-tertiary mb-4">
                Export a pack from the editor to save it here
              </p>
              <Link
                href="/editor"
                className="inline-block bg-black dark:bg-dark-text text-white dark:text-dark-bg px-6 py-2 rounded-lg font-medium hover:bg-gray-800 dark:hover:bg-dark-tertiary transition-colors"
              >
                Go to Editor
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {packs.map((pack) => (
                <div
                  key={pack.id}
                  className="bg-gray-50 dark:bg-dark-secondary rounded-lg p-6 border-2 border-gray-200 dark:border-dark-border hover:border-[#C2B280] transition-colors"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-black dark:text-dark-text truncate">
                        {parseMinecraftFormatting(pack.name)}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-dark-text-tertiary">
                        {new Date(pack.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDownloadPack(pack.id)}
                        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-dark-tertiary text-gray-400 dark:text-dark-text-tertiary hover:text-blue-500 dark:hover:text-blue-400"
                        title="Download pack"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeletePack(pack.id)}
                        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-dark-tertiary text-gray-400 dark:text-dark-text-tertiary hover:text-red-500 dark:hover:text-red-400"
                        title="Delete pack"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {pack.description && (
                    <div className="text-sm text-gray-600 dark:text-dark-text-secondary mb-4">
                      <div className="line-clamp-2">
                        {parseMinecraftFormatting(pack.description, true)}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500 dark:text-dark-text-tertiary">
                      {(pack.fileSize / 1024 / 1024).toFixed(2)} MB
                    </span>
                    <button
                      onClick={() => handleLoadPack(pack.id)}
                      disabled={loading}
                      className="bg-black dark:bg-dark-text text-white dark:text-dark-bg px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-dark-tertiary transition-colors disabled:opacity-50"
                    >
                      {loading ? "Loading..." : "Load Pack"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Notifications */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className="relative bg-white dark:bg-dark-secondary rounded-lg shadow-lg border border-gray-200 dark:border-dark-border overflow-hidden"
            style={{ width: '300px' }}
          >
            <div className="px-4 py-3">
              <p className="text-sm text-gray-800 dark:text-dark-text">{notification.message}</p>
            </div>
            <div
              className="h-1"
              style={{
                backgroundColor: notification.type === 'error' ? '#ef4444' : '#22c55e',
                animation: 'progress 3s linear forwards'
              }}
            />
          </div>
        ))}
      </div>
    </>
  );
}