import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { SavedPack } from "../lib/packLibrary";
import { loadPackFromFile } from "../lib/zipUtils";
import Navigation from "../components/Navigation";

// Minecraft color code parser
const parseMinecraftFormatting = (text: string): React.ReactNode => {
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
      key={index} 
      style={{ 
        color: segment.color,
        fontWeight: segment.format?.includes('bold') ? 'bold' : 'normal',
        textDecoration: segment.format?.includes('underline') ? 'underline' : 
                      segment.format?.includes('line-through') ? 'line-through' : 'none',
        fontStyle: segment.format?.includes('italic') ? 'italic' : 'normal'
      }}
    >
      {segment.text}
    </span>
  ));
};

export default function LibraryPage() {
  const [packs, setPacks] = useState<SavedPack[]>([]);
  const [loading, setLoading] = useState(false);
  const [storageUsage, setStorageUsage] = useState({ used: 0, total: 500 * 1024 * 1024, percentage: 0 });

  // Function to load packs (shared between useEffect and refresh button)
  const loadPacks = useCallback(async () => {
    console.log('=== Loading packs ===');
    
    // Check localStorage for debugging
    console.log('All localStorage keys:', Object.keys(localStorage));
    
    try {
      // Always load from guest library (no login required)
      const STORAGE_KEY = 'mc-pack-editor-library-guest';
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        console.log('Library data:', stored);
        if (stored) {
          const parsed = JSON.parse(stored);
          console.log('Parsed packs:', parsed);
          setPacks(parsed || []);
        } else {
          console.log('No library found');
          setPacks([]);
        }
      } catch (error) {
        console.error('Failed to load library:', error);
        setPacks([]);
      }
    } catch (error) {
      console.error('Failed to load packs:', error);
      setPacks([]);
    }
  }, []);

  // Reload packs when user changes or on mount
  useEffect(() => {
    loadPacks();
  }, [loadPacks]);

  const handleLoadPack = async (packId: string) => {
    setLoading(true);
    try {
      let packData;
      if (user) {
        const userLibrary = getUserPackLibrary(user.id);
        packData = await userLibrary.loadPack(packId);
      } else {
        // Load from guest library
        const STORAGE_KEY = 'mc-pack-editor-library-guest';
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const savedPacks = JSON.parse(stored);
          const pack = savedPacks.find((p: any) => p.id === packId);
          if (pack) {
            const binary = atob(pack.packData);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              bytes[i] = binary.charCodeAt(i);
            }
            packData = bytes.buffer;
          }
        }
      }
      
      if (packData) {
        const pack = await loadPackFromFile(new File([packData], 'library-pack.zip'));
        // Store pack data in localStorage for editor to load
        const filesArray = Array.from(pack.files.entries()).map(([path, buffer]) => {
          const binary = btoa(String.fromCharCode(...new Uint8Array(buffer)));
          return [path, binary];
        });
        localStorage.setItem('mc-pack-editor-temp-pack', JSON.stringify({
          name: pack.name,
          description: pack.description,
          files: filesArray,
          icon: pack.icon
        }));
        // Navigate to editor
        window.location.href = `/editor`;
      }
    } catch (error) {
      console.error("Failed to load pack:", error);
      alert("Failed to load pack from library. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPack = async (packId: string) => {
    try {
      // Always load from guest library (no login required)
      const STORAGE_KEY = 'mc-pack-editor-library-guest';
      const stored = localStorage.getItem(STORAGE_KEY);
      let packData;
      
      if (stored) {
        const savedPacks = JSON.parse(stored);
        const pack = savedPacks.find((p: any) => p.id === packId);
        if (pack) {
          const binary = atob(pack.packData);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          packData = bytes.buffer;
        }
      }
      
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
      }
    } catch (error) {
      console.error("Failed to download pack:", error);
      alert("Failed to download pack. Please try again.");
    }
  };

  const handleDeletePack = async (packId: string) => {
    if (confirm("Are you sure you want to delete this pack from your library?")) {
      try {
        // Always delete from guest library (no login required)
        const STORAGE_KEY = 'mc-pack-editor-library-guest';
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const savedPacks = JSON.parse(stored);
          const updatedPacks = savedPacks.filter((p: any) => p.id !== packId);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPacks));
          setPacks(updatedPacks);
        }
      } catch (error) {
        console.error('Failed to delete pack:', error);
        alert('Failed to delete pack. Please try again.');
      }
    }
  };

  const handleClearAll = async () => {
    if (confirm("Are you sure you want to clear all saved packs?")) {
      try {
        // Always clear guest library (no login required)
        const STORAGE_KEY = 'mc-pack-editor-library-guest';
        localStorage.removeItem(STORAGE_KEY);
        setPacks([]);
      } catch (error) {
        console.error('Failed to clear packs:', error);
        alert('Failed to clear packs. Please try again.');
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
      <Navigation />
      <div className="min-h-screen bg-white dark:bg-dark-bg">
        <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-black dark:text-dark-text mb-2">Pack Library</h1>
          <p className="text-gray-600 dark:text-dark-text-secondary">
            Manage your saved resource packs
          </p>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 dark:text-dark-text-secondary">
              {packs.length} pack{packs.length !== 1 ? "s" : ""} saved
            </span>
            <span className="text-sm text-gray-600 dark:text-dark-text-secondary">
              Storage: {storageUsage.percentage.toFixed(1)}% used
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                console.log('Refresh clicked, reloading packs');
                await loadPacks();
              }}
              className="text-sm text-gray-600 dark:text-dark-text-secondary hover:text-gray-900 dark:hover:text-dark-text"
            >
              Refresh
            </button>
            {packs.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

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
                      {parseMinecraftFormatting(pack.description)}
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
    </>
  );
}
