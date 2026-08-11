import { useState } from "react";
import { Link } from "wouter";
import { getUserPackLibrary } from "../lib/packLibrary";
import { loadPackFromFile } from "../lib/zipUtils";
import { useAuth } from "../contexts/AuthContext";

export default function LibraryPage() {
  const { user } = useAuth();
  const [packs, setPacks] = useState(() => {
    if (user) {
      const userLibrary = getUserPackLibrary(user.id);
      return userLibrary.getAllPacks();
    }
    return [];
  });
  const [loading, setLoading] = useState(false);

  if (!user) {
    return (
      <div className="min-h-screen bg-white dark:bg-dark-bg flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-black dark:text-dark-text mb-4">Pack Library</h1>
          <p className="text-gray-600 dark:text-dark-text-secondary mb-6">Please log in to access your pack library</p>
          <Link
            href="/auth"
            className="inline-block bg-black dark:bg-dark-text text-white dark:text-dark-bg px-6 py-2 rounded-lg font-medium hover:bg-gray-800 dark:hover:bg-dark-tertiary transition-colors"
          >
            Login
          </Link>
        </div>
      </div>
    );
  }

  const handleLoadPack = async (packId: string) => {
    setLoading(true);
    try {
      const userLibrary = getUserPackLibrary(user.id);
      const packData = await userLibrary.loadPack(packId);
      const pack = await loadPackFromFile(new File([packData], 'library-pack.zip'));
      // Navigate to editor with the pack loaded
      window.location.href = `/editor?pack=${encodeURIComponent(pack.name)}`;
    } catch (error) {
      console.error("Failed to load pack:", error);
      alert("Failed to load pack from library. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePack = (packId: string) => {
    if (confirm("Are you sure you want to delete this pack from your library?")) {
      const userLibrary = getUserPackLibrary(user.id);
      userLibrary.deletePack(packId);
      setPacks(userLibrary.getAllPacks());
    }
  };

  const handleClearAll = () => {
    if (confirm("Are you sure you want to clear all saved packs?")) {
      const userLibrary = getUserPackLibrary(user.id);
      userLibrary.clearAll();
      setPacks([]);
    }
  };

  const storageUsage = getUserPackLibrary(user.id).getStorageUsage();

  return (
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
          {packs.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
            >
              Clear All
            </button>
          )}
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
                    <h3 className="font-semibold text-black dark:text-dark-text truncate">{pack.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-dark-text-tertiary">
                      {new Date(pack.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeletePack(pack.id)}
                    className="ml-2 p-1 rounded hover:bg-gray-200 dark:hover:bg-dark-tertiary text-gray-400 dark:text-dark-text-tertiary hover:text-red-500 dark:hover:text-red-400"
                    title="Delete pack"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>

                {pack.description && (
                  <p className="text-sm text-gray-600 dark:text-dark-text-secondary mb-4 line-clamp-2">
                    {pack.description}
                  </p>
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
  );
}
