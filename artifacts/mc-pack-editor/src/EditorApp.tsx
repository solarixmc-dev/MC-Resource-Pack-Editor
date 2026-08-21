import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { Pack, FolderSources, TextureOverrides, LayoutMode } from "./types";
import { Notification, UploadDefaults } from "./types/editor";
import { analyzePackBundle, PackAnalysis, formatBytes } from "./lib/packAnalyzer";
import {
  loadPackFromFile,
  getAllTexturePathsInFolder,
  getTextureFolder,
  arrayBufferToDataURL,
  exportMergedPack,
} from "./lib/zipUtils";
import { getAtlasDefinition } from "./lib/atlasRegions";
import { getLocalPackLibrary, EditorState } from "./lib/packLibrary";
import { stripColorCodes } from "./lib/colorUtils";
import { useTheme } from "./contexts/ThemeContext";

// Components
import PreviewModal from "./components/PreviewModal";
import BatchOperationsPanel from "./components/BatchOperationsPanel";
import TourGuide from "./components/TourGuide";
import { DropZone } from "./components/common/DropZone";
import { FolderSidebar } from "./components/explorer/FolderSidebar";
import { TextureGrid } from "./components/explorer/TextureGrid";
import { SearchAllResults } from "./components/explorer/SearchAllResults";
import { TextureLightbox } from "./components/canvas/TextureLightbox";
import { TextureEditorModal } from "./components/canvas/TextureEditorModal";
import { ImageCropper } from "./components/canvas/ImageCropper";
import { PackOrderPanel } from "./components/modals/PackOrderPanel";
import { PackSettingsModal, DEFAULT_UPLOAD_DEFAULTS } from "./components/modals/PackSettingsModal";
import { SettingsModal } from "./components/modals/SettingsModal";
import { AnalyzePackModal } from "./components/modals/AnalyzePackModal";
import { FileViewerModal } from "./components/modals/FileViewerModal";

function readUploadDefaults(): UploadDefaults {
  if (typeof window === "undefined") return { formatVersion: 1, ...DEFAULT_UPLOAD_DEFAULTS };

  try {
    const saved = window.localStorage.getItem("mc-pack-editor-upload-defaults");
    if (!saved) return { formatVersion: 1, ...DEFAULT_UPLOAD_DEFAULTS };

    const parsed = JSON.parse(saved) as Partial<UploadDefaults>;
    return {
      formatVersion: typeof parsed.formatVersion === "number" ? parsed.formatVersion : 1,
      name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name : DEFAULT_UPLOAD_DEFAULTS.name,
      description: typeof parsed.description === "string" && parsed.description.trim()
        ? parsed.description
        : DEFAULT_UPLOAD_DEFAULTS.description,
      icon: typeof parsed.icon === "string" ? parsed.icon : null,
      copyFromTopPack: typeof parsed.copyFromTopPack === "boolean" ? parsed.copyFromTopPack : false,
    };
  } catch {
    return { formatVersion: 1, ...DEFAULT_UPLOAD_DEFAULTS };
  }
}

export default function EditorApp() {
  const { checkerboardStyle, setCheckerboardStyle, theme, setTheme: _setTheme } = useTheme();
  
  // Create a simple IndexedDB library for local storage
  const localLibrary = getLocalPackLibrary();

  const [packs, setPacks] = useState<Pack[]>([]);
  const [selectedFolder, setSelectedFolder] = useState("blocks");
  const [folderSources, setFolderSources] = useState<FolderSources>({});
  const [textureOverrides, setTextureOverrides] = useState<TextureOverrides>({});
  const [atlasRegionOverrides, setAtlasRegionOverrides] = useState<Record<string, Record<string, string>>>({});
  const [uploadDefaults, setUploadDefaults] = useState<UploadDefaults>(() => readUploadDefaults());
  const [packName, setPackName] = useState(uploadDefaults.name);
  const [packDescription, setPackDescription] = useState(uploadDefaults.description);
  const [packIcon, setPackIcon] = useState<string | null>(uploadDefaults.icon);
  const [showOpenFilePrompt, setShowOpenFilePrompt] = useState(false);
  const [waitingForFileSelection, setWaitingForFileSelection] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showBatchOperations, setShowBatchOperations] = useState(false);
  const [batchSelectedTextures, setBatchSelectedTextures] = useState<string[]>([]);
  const [copyFromTopPack, setCopyFromTopPack] = useState(false);

  // Batch operation handlers
  const handleBatchRecolor = async (_options: { mode: string; color: string; intensity: number }) => {
    return {
      success: batchSelectedTextures,
      failed: []
    };
  };

  const handleBatchResize = async (_options: { width: number; height: number; maintainAspectRatio: boolean }) => {
    return {
      success: batchSelectedTextures,
      failed: []
    };
  };

  const handleBatchConvert = async (_options: { format: string; quality?: number }) => {
    return {
      success: batchSelectedTextures,
      failed: []
    };
  };

  // Save editor state to IndexedDB whenever packs or metadata changes
  useEffect(() => {
    if (packs.length > 0) {
      const state: EditorState = {
        packs: packs.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description || '',
          icon: p.icon || null,
          fileCount: p.files.size
        })),
        packName,
        packDescription,
        packIcon
      };
      const library = getLocalPackLibrary();
      library.saveEditorState(state).catch(err => {
        console.error('Failed to save editor state:', err);
      });
    }
  }, [packs, packName, packDescription, packIcon]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setExportDropdownOpen(false);
      }
    };

    if (exportDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [exportDropdownOpen]);

  // Restore editor state on mount
  useEffect(() => {
    const library = getLocalPackLibrary();
    library.loadEditorState().then(savedState => {
      if (savedState && savedState.packs && savedState.packs.length > 0) {
        setPackName(savedState.packName || uploadDefaults.name);
        setPackDescription(savedState.packDescription || uploadDefaults.description);
        setPackIcon(savedState.packIcon || null);
      }
    }).catch(err => {
      console.error('Failed to load editor state:', err);
    });
  }, [uploadDefaults.name, uploadDefaults.description]);

  // Add notification
  const addNotification = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = crypto.randomUUID();
    setNotifications(prev => [...prev, { id, message, type }]);
    
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 3000);
  }, []);

  const [globalSearch, setGlobalSearch] = useState("");
  const [jumpTarget, setJumpTarget] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ path: string; displayName: string; folder: string } | null>(null);
  const [atlasZoom, setAtlasZoom] = useState<{ url: string; displayName: string } | null>(null);
  const [showTour, setShowTour] = useState(false);

  // Tour steps
  const tourSteps = [
    {
      target: "[data-tour='packs-area']",
      title: "Resource Packs",
      description: "Manage your resource packs here. Import multiple packs and use them as overlays or choose different textures from each pack.",
      position: "right" as const,
    },
    {
      target: "[data-tour='folders-area']",
      title: "Texture Folders",
      description: "Browse through different texture categories like blocks, items, entities, and more to find the textures you want to edit.",
      position: "right" as const,
    },
    {
      target: "[data-tour='editor-area']",
      title: "Texture Editor",
      description: "Edit textures with pixel-perfect precision. Use brush tools, color picker, and recoloring to customize your textures.",
      position: "left" as const,
    },
    {
      target: "[data-tour='export-area']",
      title: "Export Your Pack",
      description: "When you're done, export your resource pack as a ZIP file with custom metadata or save it to your local library.",
      position: "bottom" as const,
    },
  ];

  const handleTourComplete = () => {
    setShowTour(false);
    localStorage.setItem('mc-pack-editor-tour-completed', 'true');
  };

  const handleTourSkip = () => {
    setShowTour(false);
    localStorage.setItem('mc-pack-editor-tour-completed', 'true');
  };

  // Settings
  const [texturesPerRow, setTexturesPerRow] = useState(6);
  const [showJsonFiles, setShowJsonFiles] = useState(true);
  const [selectedFont, setSelectedFont] = useState(() => {
    if (typeof window === "undefined") return "montserrat";
    const saved = window.localStorage.getItem("mc-pack-editor-font");
    return saved || "montserrat";
  });
  const darkMode = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const layoutMode: LayoutMode = "modern";

  // Save font preference to localStorage
  useEffect(() => {
    window.localStorage.setItem("mc-pack-editor-font", selectedFont);
  }, [selectedFont]);

  // Apply font to document
  useEffect(() => {
    const fontMap: Record<string, string> = {
      "montserrat": "'Montserrat', sans-serif",
      "quicksand": "'Quicksand', sans-serif",
      "jetbrains-mono": "'JetBrains Mono', monospace",
    };
    document.body.style.fontFamily = fontMap[selectedFont] || fontMap["montserrat"];
  }, [selectedFont]);

  // Check if user has completed the tour
  useEffect(() => {
    const tourCompleted = localStorage.getItem('mc-pack-editor-tour-completed');
    const hasPacks = packs.length > 0;
    if (!tourCompleted && hasPacks) {
      setShowTour(true);
    }
  }, [packs.length]);

  // Load pack from library if stored in localStorage flag
  useEffect(() => {
    const loadPackId = localStorage.getItem('mc-pack-editor-load-pack-id');
    if (loadPackId) {
      const library = getLocalPackLibrary();
      library.loadPack(loadPackId).then(async (packData) => {
        if (packData) {
          try {
            const allPacks = await library.getAllPacks();
            const packInfo = allPacks.find(p => p.id === loadPackId);
            const originalName = packInfo?.name || 'library-pack.zip';
            
            const pack = await loadPackFromFile(new File([packData], originalName));
            setPacks([pack]);
            setPackName(packInfo?.name || pack.name);
            setPackDescription(packInfo?.description || pack.description || '');
            setPackIcon(packInfo?.icon || pack.icon || null);
            localStorage.removeItem('mc-pack-editor-load-pack-id');
          } catch (error) {
            console.error('Failed to load pack from library:', error);
            localStorage.removeItem('mc-pack-editor-load-pack-id');
          }
        }
      }).catch(error => {
        console.error('Failed to load pack from IndexedDB:', error);
        localStorage.removeItem('mc-pack-editor-load-pack-id');
      });
    }
  }, []);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  // Close settings menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) {
        setSettingsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [editingTexture, setEditingTexture] = useState<{ path: string; displayName: string; folder: string; packId: string | null } | null>(null);
  const [analysis, setAnalysis] = useState<PackAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [packVisibility, setPackVisibility] = useState<Record<string, boolean>>({});
  const [removedFiles, setRemovedFiles] = useState<Record<string, boolean>>({});
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [fileViewerPack, setFileViewerPack] = useState<Pack | null>(null);

  const handlePacksLoaded = useCallback((newPacks: Pack[]) => {
    setPacks((prev) => {
      const existing = new Set(prev.map((p) => p.name));
      const deduped = newPacks.filter((p) => !existing.has(p.name));
      return [...deduped, ...prev];
    });

    if (copyFromTopPack && newPacks.length > 0) {
      const topPack = newPacks[0];
      
      const iconBuffer = topPack.files.get("pack.png");
      if (iconBuffer) {
        const iconUrl = arrayBufferToDataURL(iconBuffer, "pack.png");
        setPackIcon(iconUrl);
      } else {
        setPackIcon(null);
      }

      const mcmetaBuffer = topPack.files.get("pack.mcmeta");
      if (mcmetaBuffer) {
        try {
          const decoder = new TextDecoder();
          const mcmetaText = decoder.decode(mcmetaBuffer);
          const mcmeta = JSON.parse(mcmetaText);
          const packData = mcmeta.pack;
          
          if (packData?.description) {
            let description = packData.description;
            if (typeof description === "object") {
              description = description.text || "";
            }
            setPackDescription(description.trim());
          } else {
            setPackDescription(uploadDefaults.description);
          }
        } catch {
          setPackDescription(uploadDefaults.description);
        }
      } else {
        setPackDescription(uploadDefaults.description);
      }

      setPackName(topPack.name);
    } else {
      setPackName(uploadDefaults.name);
      setPackDescription(uploadDefaults.description);
      setPackIcon(uploadDefaults.icon);
    }
  }, [copyFromTopPack, uploadDefaults]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    document.documentElement.style.colorScheme = darkMode ? "dark" : "light";
    window.localStorage.setItem("mc-pack-editor-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    window.localStorage.setItem("mc-pack-editor-upload-defaults", JSON.stringify(uploadDefaults));
  }, [uploadDefaults]);

  const removePack = useCallback((id: string) => {
    setPacks((prev) => prev.filter((p) => p.id !== id));
    setFolderSources((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => { if (next[k] === id) delete next[k]; });
      return next;
    });
    setTextureOverrides((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => { if (next[k] === id) delete next[k]; });
      return next;
    });
    setAtlasRegionOverrides((prev) => {
      const next: typeof prev = {};
      for (const [path, regions] of Object.entries(prev)) {
        const filtered: Record<string, string> = {};
        for (const [regionId, packId] of Object.entries(regions)) {
          if (packId !== id) filtered[regionId] = packId;
        }
        if (Object.keys(filtered).length > 0) next[path] = filtered;
      }
      return next;
    });
  }, []);

  const clearAllPacks = useCallback(() => {
    if (!confirm("Are you sure you want to clear all packs and start a new project? This cannot be undone.")) return;
    
    setPacks([]);
    setFolderSources({});
    setTextureOverrides({});
    setAtlasRegionOverrides({});
    setPackVisibility({});
    setRemovedFiles({});
    setPackName(uploadDefaults.name);
    setPackDescription(uploadDefaults.description);
    setPackIcon(uploadDefaults.icon);
    setSelectedFolder("blocks");
    setGlobalSearch("");
    setJumpTarget(null);
    setLightbox(null);
    setEditingTexture(null);
    setAnalysis(null);
    
    const library = getLocalPackLibrary();
    library.clearEditorState().catch(err => {
      console.error('Failed to clear editor state:', err);
    });
  }, [uploadDefaults]);

  const handleViewFiles = useCallback((packId: string) => {
    const pack = packs.find(p => p.id === packId);
    if (pack) {
      setFileViewerPack(pack);
    }
  }, [packs]);

  const handleAtlasRegionOverride = useCallback((atlasPath: string, regionId: string, packId: string | null) => {
    setAtlasRegionOverrides((prev) => {
      const next = { ...prev, [atlasPath]: { ...prev[atlasPath] } };

      const atlasDef = getAtlasDefinition(atlasPath);
      if (packId === null) {
        delete next[atlasPath][regionId];
        const mappedRegions = atlasDef?.regions.filter((r) => r.mapsTo === regionId) || [];
        for (const mappedRegion of mappedRegions) {
          delete next[atlasPath][mappedRegion.id];
        }
      } else {
        next[atlasPath][regionId] = packId;
        const mappedRegions = atlasDef?.regions.filter((r) => r.mapsTo === regionId) || [];
        for (const mappedRegion of mappedRegions) {
          next[atlasPath][mappedRegion.id] = packId;
        }
      }

      if (Object.keys(next[atlasPath]).length === 0) delete next[atlasPath];
      return next;
    });
  }, []);

  const handleFolderSource = useCallback((folder: string, packId: string | null) => {
    setFolderSources((prev) => {
      const next = { ...prev };
      if (packId === null) delete next[folder];
      else next[folder] = packId;
      return next;
    });
  }, []);

  const handleOverride = useCallback((path: string, packId: string | null) => {
    setTextureOverrides((prev) => {
      const next = { ...prev };
      if (packId === null) delete next[path];
      else next[path] = packId;
      return next;
    });
  }, []);

  const handleSaveTextureEdit = useCallback((path: string, packId: string | null, buffer: ArrayBuffer) => {
    setPacks((prev) => {
      const targetId = packId ?? prev.find((p) => p.files.has(path))?.id ?? null;
      if (!targetId) return prev;
      return prev.map((pack) => {
        if (pack.id !== targetId) return pack;
        const nextFiles = new Map(pack.files);
        nextFiles.set(path, buffer);
        return { ...pack, files: nextFiles };
      });
    });
  }, []);

  const handleOpenTextureEditor = useCallback((path: string, displayName: string, folder: string) => {
    const selectedPack = packs.find((pack) => {
      const overridePackId = textureOverrides[path];
      if (overridePackId) return pack.id === overridePackId;
      const folderPackId = folderSources[folder];
      if (folderPackId) return pack.id === folderPackId;
      return pack.files.has(path);
    }) ?? packs.find((pack) => pack.files.has(path)) ?? null;

    setEditingTexture({ path, displayName, folder, packId: selectedPack?.id ?? null });
  }, [packs, textureOverrides, folderSources]);

  const handleExport = useCallback(async () => {
    if (!packs.length) return;
    setExporting(true);
    try {
      const blob = await exportMergedPack(
        packs,
        folderSources,
        textureOverrides,
        atlasRegionOverrides,
        packName,
        packDescription,
        packIcon,
        removedFiles
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeFilename = packName
        .replace(/[\\/:*?"<>|\x00-\x1f]/g, "")
        .trim()
        || "resource_pack";
      a.download = `${safeFilename}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      const arrayBuffer = await blob.arrayBuffer();
      try {
        await localLibrary.savePack(packName, packDescription, packIcon, arrayBuffer);
      } catch (error) {
        console.error("Failed to save to library:", error);
      }
    } catch (e) {
      console.error("Export failed:", e);
      alert("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }, [packs, folderSources, textureOverrides, atlasRegionOverrides, packName, packDescription, packIcon, removedFiles, localLibrary]);

  const handleSaveToLibrary = useCallback(async () => {
    if (!packs.length) return;
    setExporting(true);
    try {
      const blob = await exportMergedPack(
        packs,
        folderSources,
        textureOverrides,
        atlasRegionOverrides,
        packName,
        packDescription,
        packIcon,
        removedFiles
      );
      const arrayBuffer = await blob.arrayBuffer();
      
      try {
        await localLibrary.savePack(packName, packDescription, packIcon, arrayBuffer);
        addNotification("Pack saved to library!", "success");
      } catch (error) {
        console.error("Failed to save to library:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        addNotification(`Failed to save: ${errorMessage}`, "error");
      }
    } catch (e) {
      console.error("Save failed:", e);
      addNotification(`Save failed: ${e instanceof Error ? e.message : 'Unknown error'}`, "error");
    } finally {
      setExporting(false);
    }
  }, [packs, folderSources, textureOverrides, atlasRegionOverrides, packName, packDescription, packIcon, removedFiles, addNotification, localLibrary]);

  const handleAnalyze = useCallback(async () => {
    if (!packs.length) return;
    setAnalysisOpen(true);
    setAnalyzing(true);
    try {
      const result = await analyzePackBundle(packs);
      setAnalysis(result);
    } catch (e) {
      console.error("Pack analysis failed:", e);
      const totalSizeBytes = packs.reduce((sum, pack) => sum + Array.from(pack.files.values()).reduce((size, buffer) => size + buffer.byteLength, 0), 0);
      const totalFiles = packs.reduce((sum, pack) => sum + pack.files.size, 0);
      const textureCount = packs.reduce((sum, pack) => sum + Array.from(pack.files.keys()).filter((path) => {
        const ext = path.split('.').pop()?.toLowerCase();
        return ['png', 'jpg', 'jpeg', 'gif'].includes(ext || '');
      }).length, 0);
      
      setAnalysis({
        packNames: packs.map((pack) => stripColorCodes(pack.name)),
        packCount: packs.length,
        totalFiles,
        totalSizeBytes,
        totalSizeLabel: formatBytes(totalSizeBytes),
        baseTextureResolution: "N/A",
        mixedResolutions: false,
        resolutions: [],
        modifiedTextureCount: textureCount,
        texturesByFolder: new Map(),
        missingTextures: [],
        duplicateTextures: [],
        animatedTextures: [],
        invalidAnimations: [],
        atlasAnalysis: [],
        overallSummary: `${packs.length} pack${packs.length !== 1 ? "s" : ""} loaded • ${textureCount} texture${textureCount !== 1 ? "s" : ""} found.`,
        versionRange: "Unknown (basic analysis)",
      });
    } finally {
      setAnalyzing(false);
    }
  }, [packs]);

  const handleGeneratePreview = useCallback(() => {
    if (!packs.length) return;
    setPreviewOpen(true);
  }, [packs]);

  const reorderPacks = useCallback((newOrder: Pack[]) => {
    setPacks(newOrder);
  }, []);

  const handleTextureImport = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.png')) return;
    
    const arrayBuffer = await file.arrayBuffer();
    
    const newPack: Pack = {
      id: `imported-${Date.now()}`,
      name: file.name.replace('.png', ''),
      color: '#3b82f6',
      files: new Map([[
        `assets/minecraft/textures/${file.name}`,
        arrayBuffer
      ]])
    };
    
    setPacks((prev) => [newPack, ...prev]);
  }, []);

  const handleCreateFromScratch = useCallback(async () => {
    try {
      const response = await fetch('/textures/default-pack.zip');
      if (!response.ok) throw new Error('Default pack not found');
      
      const arrayBuffer = await response.arrayBuffer();
      const pack = await loadPackFromFile(new File([arrayBuffer], 'default-minecraft-pack.zip'));
      
      setPacks((prev) => [pack, ...prev]);
      setPackName('Minecraft Default');
      setPackDescription('Default Minecraft textures');
      
      const iconBuffer = pack.files.get("pack.png");
      if (iconBuffer) {
        const iconUrl = arrayBufferToDataURL(iconBuffer, "pack.png");
        setPackIcon(iconUrl);
      }
    } catch (error) {
      console.error("Failed to load default pack:", error);
      alert("Default textures not found. Please download Minecraft default textures and place them in public/textures/default-pack.zip");
      window.open('https://www.curseforge.com/api/v1/mods/690071/files/4370838/download', '_blank');
      setTimeout(() => setShowOpenFilePrompt(true), 1000);
    }
  }, []);

  const handleConfirmOpenFile = useCallback(() => {
    setWaitingForFileSelection(true);
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 100);
  }, []);

  const handleOpenDownloadedFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setWaitingForFileSelection(false);
      return;
    }
    
    try {
      const pack = await loadPackFromFile(file);
      setPacks((prev) => [pack, ...prev]);
      setShowOpenFilePrompt(false);
      setWaitingForFileSelection(false);
    } catch (error) {
      console.error("Failed to load pack:", error);
      alert("Failed to load the downloaded file. Please try again.");
      setWaitingForFileSelection(false);
    }
  }, []);

  const handleVisibilityToggle = useCallback((id: string) => {
    setPackVisibility((prev) => ({ ...prev, [id]: prev[id] === false ? true : false }));
  }, []);

  const toggleRemovedFile = useCallback((path: string) => {
    setRemovedFiles((prev) => ({ ...prev, [path]: !prev[path] }));
  }, []);

  const visiblePacks = useMemo(
    () => packs.filter((p) => packVisibility[p.id] !== false),
    [packs, packVisibility]
  );

  const textureOverrideCount = Object.keys(textureOverrides).length;
  const atlasRegionOverrideCount = Object.values(atlasRegionOverrides).reduce(
    (sum, regionOverrides) => sum + Object.keys(regionOverrides).length,
    0,
  );
  const folderSourceCount = Object.values(folderSources).filter(Boolean).length;
  const totalOverrideCount = textureOverrideCount + atlasRegionOverrideCount + folderSourceCount;

  useEffect(() => {
    if (!jumpTarget) return;
    const target = document.getElementById(`texture-card-${jumpTarget}`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setJumpTarget(null);
  }, [jumpTarget, globalSearch, selectedFolder]);

  const jumpToOverriddenTexture = (path: string) => {
    setSelectedFolder(getTextureFolder(path));
    setGlobalSearch("");
    setJumpTarget(path);
  };

  const jumpToOverriddenFolder = (folder: string) => {
    setSelectedFolder(folder);
    setGlobalSearch("");
    setJumpTarget(null);
  };

  return (
    <div className={`flex flex-col h-screen overflow-hidden ${darkMode ? "dark bg-dark-bg text-dark-text" : "bg-slate-50 text-slate-900"}`}>
      {/* ── Top Navigation Bar ── */}
      <nav className={`flex-shrink-0 px-6 py-3 border-b ${darkMode ? "border-dark-border bg-dark-secondary" : "border-slate-200 bg-white"}`} style={{ position: 'relative', zIndex: 50 }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="relative" ref={settingsMenuRef}>
                <button
                  onClick={() => setSettingsMenuOpen(!settingsMenuOpen)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-dark-text-tertiary dark:hover:text-white dark:hover:bg-white/20"
                  title="Settings"
                >
                  <svg 
                    className="w-5 h-5" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth={2} 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </button>
                {settingsMenuOpen && (
                  <div className={`absolute top-full left-0 mt-2 w-64 rounded-lg shadow-xl border z-[9999] bg-white dark:bg-dark-secondary border-slate-200 dark:border-dark-border`}>
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-slate-700 dark:text-dark-text">Settings</span>
                        <button onClick={() => setSettingsMenuOpen(false)} className="text-lg leading-none text-slate-400 hover:text-slate-700 dark:hover:text-dark-text">✕</button>
                      </div>
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-700 dark:text-dark-text-secondary">Textures per row</span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => setTexturesPerRow(Math.max(1, texturesPerRow - 1))} className="w-7 h-7 rounded text-sm font-bold flex items-center justify-center transition-colors bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 dark:bg-dark-tertiary dark:hover:bg-dark-border dark:border-dark-border dark:text-dark-text-secondary">−</button>
                            <span className="w-6 text-center text-sm text-slate-700 dark:text-dark-text-secondary">{texturesPerRow}</span>
                            <button onClick={() => setTexturesPerRow(Math.min(12, texturesPerRow + 1))} className="w-7 h-7 rounded text-sm font-bold flex items-center justify-center transition-colors bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700 dark:bg-dark-tertiary dark:hover:bg-dark-border dark:border-dark-border dark:text-dark-text-secondary">+</button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-700 dark:text-dark-text-secondary">Show text files</span>
                          <button
                            onClick={() => setShowJsonFiles(!showJsonFiles)}
                            className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${showJsonFiles ? "bg-black dark:bg-dark-text" : "bg-slate-200 dark:bg-dark-tertiary"}`}
                          >
                            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${showJsonFiles ? "right-0.5" : "left-0.5"}`} />
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-700 dark:text-dark-text-secondary">Light checkerboard</span>
                          <button
                            onClick={() => setCheckerboardStyle(checkerboardStyle === 'dark' ? 'light' : 'dark')}
                            className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${checkerboardStyle === 'light' ? "bg-black dark:bg-dark-text" : "bg-slate-200 dark:bg-dark-tertiary"}`}
                          >
                            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${checkerboardStyle === 'light' ? "right-0.5" : "left-0.5"}`} />
                          </button>
                        </div>
                        <div className={`border-t border-slate-200 dark:border-dark-border pt-3`}>
                          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-dark-text-tertiary">Upload defaults</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-700 dark:text-dark-text-secondary">Copy from top pack</span>
                          <button
                            onClick={() => setCopyFromTopPack(!copyFromTopPack)}
                            className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${copyFromTopPack ? "bg-black dark:bg-dark-text" : "bg-slate-200 dark:bg-dark-tertiary"}`}
                          >
                            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${copyFromTopPack ? "right-0.5" : "left-0.5"}`} />
                          </button>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-slate-500 dark:text-dark-text-tertiary">Default pack name</label>
                          <input
                            type="text"
                            value={uploadDefaults.name}
                            onChange={(e) => setUploadDefaults((prev) => ({ ...prev, name: e.target.value }))}
                            className="rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black dark:ring-white/20 focus:border-blue-500 bg-white border-slate-200 text-slate-700 dark:bg-dark-tertiary dark:border-dark-border dark:text-dark-text-secondary"
                            placeholder="My Resource Pack"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-slate-500 dark:text-dark-text-tertiary">Default description</label>
                          <input
                            type="text"
                            value={uploadDefaults.description}
                            onChange={(e) => setUploadDefaults((prev) => ({ ...prev, description: e.target.value }))}
                            className="rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black dark:ring-white/20 focus:border-blue-500 bg-white border-slate-200 text-slate-700 dark:bg-dark-tertiary dark:border-dark-border dark:text-dark-text-secondary"
                            placeholder="A Minecraft resource pack"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className={`flex items-center gap-2 text-sm ${darkMode ? "text-dark-text-tertiary" : "text-slate-500"}`}>
              {packs.length > 0 && (
                <>
                  <span className={`px-3 py-1.5 rounded-full ${darkMode ? "bg-dark-tertiary text-dark-text-secondary" : "bg-slate-100 text-slate-600"}`}>{packs.length} pack{packs.length !== 1 ? "s" : ""}</span>
                  <span className={`px-3 py-1.5 rounded-full ${darkMode ? "bg-dark-tertiary text-dark-text-secondary" : "bg-slate-100 text-slate-600"}`}>{Object.keys(textureOverrides).length + Object.values(atlasRegionOverrides).reduce((sum, r) => sum + Object.keys(r).length, 0)} override{Object.keys(textureOverrides).length + Object.values(atlasRegionOverrides).reduce((sum, r) => sum + Object.keys(r).length, 0) !== 1 ? "s" : ""}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {packs.length > 0 && (
              <>
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${darkMode ? "text-dark-text-secondary hover:text-dark-text hover:bg-dark-tertiary" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"}`}
                >
                  <span className={analyzing ? "animate-pulse" : ""}>✨</span>
                  {analyzing ? "Analyzing…" : "Analyze"}
                </button>
                <button
                  onClick={handleGeneratePreview}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${darkMode ? "text-dark-text-secondary hover:text-dark-text hover:bg-dark-tertiary" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"}`}
                >
                  👁 Preview
                </button>
                <button
                  onClick={() => setShowBatchOperations(true)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${darkMode ? "text-dark-text-secondary hover:text-dark-text hover:bg-dark-tertiary" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"}`}
                >
                  ⚡ Batch
                </button>
                <div className="relative" ref={exportDropdownRef}>
                  <button
                    data-tour="export-area"
                    onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
                    disabled={exporting}
                    className="px-6 py-2 text-sm font-medium text-white dark:text-black bg-black dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-200 hover:scale-105 hover:shadow-lg transition-all duration-200 rounded-2xl disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none flex items-center gap-2"
                  >
                    {exporting ? "Exporting…" : "Export"}
                    <svg className={`w-4 h-4 transition-transform ${exportDropdownOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {exportDropdownOpen && (
                    <div className={`absolute right-0 mt-2 w-48 rounded-lg shadow-lg border z-50 ${darkMode ? "bg-dark-secondary border-dark-border" : "bg-white border-gray-200"}`}>
                      <button
                        onClick={() => {
                          handleExport();
                          setExportDropdownOpen(false);
                        }}
                        disabled={exporting}
                        className={`w-full text-left px-4 py-3 text-sm rounded-t-lg transition-colors ${darkMode ? "text-dark-text hover:bg-dark-tertiary" : "text-slate-700 hover:bg-gray-100"} disabled:opacity-50`}
                      >
                        Download ZIP
                      </button>
                      <button
                        onClick={() => {
                          handleSaveToLibrary();
                          setExportDropdownOpen(false);
                        }}
                        disabled={exporting}
                        className={`w-full text-left px-4 py-3 text-sm rounded-b-lg transition-colors ${darkMode ? "text-dark-text hover:bg-dark-tertiary" : "text-slate-700 hover:bg-gray-100"} disabled:opacity-50`}
                      >
                        Save to Library
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hidden file input for Create from Scratch */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={handleOpenDownloadedFile}
      />

      {/* Open File Prompt */}
      {showOpenFilePrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]" onClick={() => setShowOpenFilePrompt(false)}>
          <div className={`max-w-md w-full mx-4 rounded-lg p-6 shadow-xl ${darkMode ? "bg-dark-secondary" : "bg-white"}`} onClick={(e) => e.stopPropagation()}>
            <h3 className={`text-lg font-semibold mb-3 ${darkMode ? "text-dark-text" : "text-slate-900"}`}>Select Template Pack</h3>
            {!waitingForFileSelection ? (
              <>
                <p className={`text-sm mb-4 ${darkMode ? "text-dark-text-secondary" : "text-slate-600"}`}>
                  Would you like to select the template pack to load the default textures?
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowOpenFilePrompt(false)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${darkMode ? "bg-dark-tertiary hover:bg-dark-border text-dark-text-secondary" : "bg-slate-100 hover:bg-slate-200 text-slate-700"}`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmOpenFile}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${darkMode ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}`}
                  >
                    Select File
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className={`text-sm mb-4 ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
                  Please select the template pack ZIP file.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setWaitingForFileSelection(false);
                      setShowOpenFilePrompt(false);
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${darkMode ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-700"}`}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Main Content Area ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Sidebar ── */}
        <aside data-tour="packs-area" className={`flex-shrink-0 w-64 overflow-x-hidden overflow-y-auto sleek ${darkMode ? "sleek-dark" : "sleek"}`} style={{ borderRadius: 0, borderTop: 'none', borderBottom: 'none', borderLeft: 'none', zIndex: 10 }}>
          <div className={`p-4`}>
            <h2 className={`text-sm font-semibold mb-3 ${darkMode ? "text-dark-text" : "text-slate-700"}`}>Packs</h2>
            <DropZone onLoad={handlePacksLoaded} onTextureImport={handleTextureImport} darkMode={darkMode} />
            <button
              onClick={handleCreateFromScratch}
              className={`w-full mt-3 px-4 py-3 rounded-lg font-medium transition-colors text-sm flex items-center justify-center gap-2 sleek ${darkMode ? "sleek-dark bg-[#C2B280] hover:bg-[#D4C390] text-black" : "bg-[#C2B280] hover:bg-[#D4C390] text-black"}`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Create from Scratch
            </button>
          </div>
          
          {packs.length > 0 && (
            <>
              <div className={`p-4 border-b`}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className={`text-sm font-semibold`}>Pack Order</h2>
                  <button
                    onClick={clearAllPacks}
                    className={`text-xs px-2 py-1 rounded transition-colors hover:bg-white/10 text-red-400 hover:text-red-300`}
                  >
                    Clear all
                  </button>
                </div>
                <PackOrderPanel
                  packs={packs}
                  onReorder={reorderPacks}
                  onRemove={removePack}
                  packVisibility={packVisibility}
                  onVisibilityToggle={handleVisibilityToggle}
                  onViewFiles={handleViewFiles}
                  darkMode={darkMode}
                  stripColorCodes={stripColorCodes}
                />
              </div>
              
              <div className={`p-4 border-b`}>
                <h2 className={`text-sm font-semibold mb-3`}>Pack Settings</h2>
                <PackSettingsModal
                  packName={packName}
                  packDescription={packDescription}
                  packIcon={packIcon}
                  onNameChange={setPackName}
                  onDescriptionChange={setPackDescription}
                  onIconChange={(d) => { if (d === null) setPackIcon(null); else setCropSource(d); }}
                  darkMode={darkMode}
                  stripColorCodes={stripColorCodes}
                />
              </div>
            </>
          )}
          
        </aside>

        {/* ── Main Content ── */}
        <main data-tour="editor-area" className="flex-1 overflow-hidden flex flex-col">
          {/* Toolbar */}
          <div className={`flex-shrink-0 px-6 py-3 sleek ${darkMode ? "sleek-dark" : "sleek"}`} style={{ borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none' }}>
            <div className="flex items-center gap-4">
              {packs.length > 0 && (
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search textures..."
                    value={globalSearch}
                    onChange={(e) => setGlobalSearch(e.target.value)}
                    className={`w-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:ring-white/20 focus:border-blue-500 disabled:opacity-50 sleek ${darkMode ? "sleek-dark" : "sleek"}`}
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                {packs.length > 0 && (
                  <>
                    {totalOverrideCount > 0 && (
                      <details className="group relative">
                        <summary className="cursor-pointer list-none flex items-center gap-1 hover:text-foreground">
                          <span className={`text-sm ${darkMode ? "text-dark-text-secondary" : "text-slate-600"}`}>🎯 {totalOverrideCount} override{totalOverrideCount !== 1 ? "s" : ""}</span>
                          {(atlasRegionOverrideCount > 0 || folderSourceCount > 0) && (
                            <span className="text-[10px]">({textureOverrideCount} texture, {atlasRegionOverrideCount} atlas, {folderSourceCount} folder{folderSourceCount !== 1 ? "s" : ""})</span>
                          )}
                          <span className="inline-block transition-transform group-open:rotate-180">⌄</span>
                        </summary>
                        <div className={`absolute right-0 top-full z-[1000] mt-1 max-h-36 w-[400px] overflow-y-auto rounded-lg border p-3 pb-4 shadow-xl ${darkMode ? "border-dark-border bg-dark-secondary" : "border-slate-200 bg-white"}`}>
                          {Object.entries(textureOverrides).map(([path, packId]) => (
                            <div key={path} className="flex items-center gap-2">
                              <button type="button" onClick={() => jumpToOverriddenTexture(path)} className={`flex-1 rounded px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-dark-tertiary ${darkMode ? "text-dark-text-secondary" : "text-slate-700"}`}>
                                <span className="block truncate">{path.split("/").pop()}</span>
                                <span className={`block truncate text-[10px] ${darkMode ? "text-dark-text-tertiary" : "text-slate-500"}`}>Texture override · {packs.find((pack) => pack.id === packId) ? stripColorCodes(packs.find((pack) => pack.id === packId)!.name) : "selected pack"}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOverride(path, null)}
                                className={`p-2 rounded hover:bg-slate-200 dark:hover:bg-dark-tertiary ${darkMode ? "text-dark-text-tertiary hover:text-dark-text-secondary" : "text-slate-500 hover:text-slate-700"}`}
                                title="Revert to auto"
                              >
                                ↺
                              </button>
                            </div>
                          ))}
                          {Object.entries(atlasRegionOverrides).flatMap(([path, regions]) => Object.entries(regions).map(([regionId, packId]) => ({ path, regionId, packId }))).map(({ path, regionId, packId }) => (
                            <div key={`${path}-${regionId}`} className="flex items-center gap-2">
                              <button type="button" onClick={() => jumpToOverriddenTexture(path)} className={`flex-1 rounded px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-dark-tertiary ${darkMode ? "text-dark-text-secondary" : "text-slate-700"}`}>
                                <span className="block truncate">{path.split("/").pop()} · {regionId}</span>
                                <span className={`block truncate text-[10px] ${darkMode ? "text-dark-text-tertiary" : "text-slate-500"}`}>Atlas override · {packs.find((pack) => pack.id === packId) ? stripColorCodes(packs.find((pack) => pack.id === packId)!.name) : "selected pack"}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAtlasRegionOverride(path, regionId, null)}
                                className={`p-2 rounded hover:bg-slate-200 dark:hover:bg-dark-tertiary ${darkMode ? "text-dark-text-tertiary hover:text-dark-text-secondary" : "text-slate-500 hover:text-slate-700"}`}
                                title="Revert to auto"
                              >
                                ↺
                              </button>
                            </div>
                          ))}
                          {Object.entries(folderSources).map(([folder, packId]) => (
                            <div key={folder} className="flex items-center gap-2">
                              <button type="button" onClick={() => jumpToOverriddenFolder(folder)} className={`flex-1 rounded px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-dark-tertiary ${darkMode ? "text-dark-text-secondary" : "text-slate-700"}`}>
                                <span className="block truncate">{folder}</span>
                                <span className={`block truncate text-[10px] ${darkMode ? "text-dark-text-tertiary" : "text-slate-500"}`}>Folder override · {packs.find((pack) => pack.id === packId) ? stripColorCodes(packs.find((pack) => pack.id === packId)!.name) : "selected pack"}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleFolderSource(folder, null)}
                                className={`p-2 rounded hover:bg-slate-200 dark:hover:bg-dark-tertiary ${darkMode ? "text-dark-text-tertiary hover:text-dark-text-secondary" : "text-slate-500 hover:text-slate-700"}`}
                                title="Revert to auto"
                              >
                                ↺
                              </button>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                    <button
                      onClick={() => setSidebarOpen(!sidebarOpen)}
                      className={`px-3 py-2 text-sm rounded-lg transition-colors ${darkMode ? "text-dark-text-secondary hover:text-dark-text hover:bg-dark-tertiary" : "text-black hover:text-black hover:bg-slate-200"} ${sidebarOpen && packs.length > 0 ? "bg-slate-200 dark:bg-dark-tertiary" : ""}`}
                      title="Toggle folder panel"
                    >
                      ☰
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-8">
            {packs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-4">
                <div className={`text-center max-w-4xl w-full rounded-3xl px-12 py-12 ${darkMode ? "bg-dark-secondary" : "bg-white"}`}>
                  <h1 className={`text-5xl font-bold mb-6 tracking-tight ${darkMode ? "text-dark-text" : "text-slate-800"}`}>
                    MCTextureLab
                  </h1>
                  <p className={`text-lg leading-relaxed mb-12 ${darkMode ? "text-dark-text-secondary" : "text-slate-600"}`}>
                    Upload resource pack ZIP files above, or import individual PNG textures to create custom packs.
                  </p>
                  <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 text-left mb-12`}>
                    <div className={`p-6 rounded-xl ${darkMode ? "bg-dark-tertiary" : "bg-white shadow-sm"}`}>
                      <h3 className={`font-semibold mb-2 ${darkMode ? "text-dark-text" : "text-slate-800"}`}>Merge Packs</h3>
                      <p className={`text-sm ${darkMode ? "text-dark-text-secondary" : "text-slate-600"}`}>Combine multiple resource packs with smart override management</p>
                    </div>
                    <div className={`p-6 rounded-xl ${darkMode ? "bg-dark-tertiary" : "bg-white shadow-sm"}`}>
                      <h3 className={`font-semibold mb-2 ${darkMode ? "text-dark-text" : "text-slate-800"}`}>Search & Edit</h3>
                      <p className={`text-sm ${darkMode ? "text-dark-text-secondary" : "text-slate-600"}`}>Search across all textures and edit them with a built-in editor</p>
                    </div>
                    <div className={`p-6 rounded-xl ${darkMode ? "bg-dark-tertiary" : "bg-white shadow-sm"}`}>
                      <h3 className={`font-semibold mb-2 ${darkMode ? "text-dark-text" : "text-slate-800"}`}>Export Packs</h3>
                      <p className={`text-sm ${darkMode ? "text-dark-text-secondary" : "text-slate-600"}`}>Export your custom pack with all overrides preserved</p>
                    </div>
                  </div>
                  <div className={`flex items-center justify-center gap-2 text-base ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                    <span>Drag & drop a ZIP file to get started</span>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {!globalSearch && packs.length > 1 && (
                  <div className={`mb-4 text-sm ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                    Click preview to pick pack • Click name for folder default
                  </div>
                )}
                {globalSearch ? (
                  <SearchAllResults
                    query={globalSearch}
                    packs={visiblePacks}
                    folderSources={folderSources}
                    textureOverrides={textureOverrides}
                    onOverride={handleOverride}
                    onOpenLightbox={(path, displayName, folder) => setLightbox({ path, displayName, folder })}
                    onEditTexture={handleOpenTextureEditor}
                    cols={texturesPerRow}
                    removedFiles={removedFiles}
                    onToggleRemove={toggleRemovedFile}
                    layoutMode={layoutMode}
                    darkMode={darkMode}
                    stripColorCodes={stripColorCodes}
                    showJsonFiles={showJsonFiles}
                  />
                ) : (
                  <TextureGrid
                    packs={visiblePacks}
                    folder={selectedFolder}
                    folderSources={folderSources}
                    textureOverrides={textureOverrides}
                    onOverride={handleOverride}
                    onOpenLightbox={(path, displayName, folder) => setLightbox({ path, displayName, folder })}
                    onEditTexture={handleOpenTextureEditor}
                    cols={texturesPerRow}
                    removedFiles={removedFiles}
                    onToggleRemove={toggleRemovedFile}
                    layoutMode={layoutMode}
                    darkMode={darkMode}
                    stripColorCodes={stripColorCodes}
                    showJsonFiles={showJsonFiles}
                  />
                )}
              </>
            )}
          </div>
        </main>

        {/* ── Right Sidebar (Folders) ── */}
        {sidebarOpen && packs.length > 0 && (
          <aside data-tour="folders-area" className={`flex-shrink-0 w-64 overflow-x-hidden overflow-y-auto sleek ${darkMode ? "sleek-dark" : "sleek"}`} style={{ borderRadius: 0, borderTop: 'none', borderBottom: 'none', borderRight: 'none', zIndex: 10 }}>
            <div className={`flex items-center justify-between px-4 py-3`}>
              <h2 className={`text-sm font-semibold ${darkMode ? "text-dark-text" : "text-slate-700"}`}>Folders</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className={`p-1 rounded-lg transition-colors hover:bg-white/10 dark:hover:bg-dark-tertiary`}
                title="Close folder panel"
              >
                ✕
              </button>
            </div>
            <FolderSidebar
              packs={visiblePacks}
              selectedFolder={selectedFolder}
              onSelect={setSelectedFolder}
              folderSources={folderSources}
              onFolderSource={handleFolderSource}
              layoutMode={layoutMode}
              darkMode={darkMode}
              stripColorCodes={stripColorCodes}
            />
          </aside>
        )}
      </div>

      {/* ── Texture editor modal ── */}
      {editingTexture && (
        <TextureEditorModal
          texturePath={editingTexture.path}
          displayName={editingTexture.displayName}
          folder={editingTexture.folder}
          packs={packs}
          activePackId={editingTexture.packId}
          onSave={(path, packId, buffer) => {
            handleSaveTextureEdit(path, packId, buffer);
            setEditingTexture(null);
          }}
          onClose={() => setEditingTexture(null)}
          darkMode={darkMode}
          checkerboardStyle={checkerboardStyle}
        />
      )}

      {/* ── Lightbox modal ── */}
      {lightbox && (
        <TextureLightbox
          texturePath={lightbox.path}
          displayName={lightbox.displayName}
          folder={lightbox.folder}
          packs={visiblePacks}
          folderSources={folderSources}
          textureOverrides={textureOverrides}
          atlasRegionOverrides={atlasRegionOverrides}
          onOverride={handleOverride}
          onAtlasRegionOverride={handleAtlasRegionOverride}
          onAtlasZoom={(url) => setAtlasZoom({ url, displayName: lightbox.displayName })}
          onClose={() => setLightbox(null)}
          darkMode={darkMode}
          stripColorCodes={stripColorCodes}
        />
      )}

      {/* ── Tour guide ── */}
      {showTour && (
        <TourGuide
          steps={tourSteps}
          onComplete={handleTourComplete}
          onSkip={handleTourSkip}
          darkMode={darkMode}
        />
      )}

      {/* ── Atlas zoom modal ── */}
      {atlasZoom && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setAtlasZoom(null)}>
          <div className="max-w-[90vw] max-h-[90vh] rounded-[28px] bg-white dark:bg-dark-bg shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">Atlas Preview</p>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text">{atlasZoom.displayName}</h3>
              </div>
              <button onClick={() => setAtlasZoom(null)} className="rounded-full bg-gray-100 dark:bg-dark-secondary px-2.5 py-1 text-sm text-gray-600 dark:text-dark-text-tertiary hover:bg-gray-200 dark:hover:bg-dark-tertiary">✕</button>
            </div>
            <div className="p-4 flex items-center justify-center">
              <img
                src={atlasZoom.url}
                alt={atlasZoom.displayName}
                className="max-w-full max-h-[70vh] object-contain checkered"
                style={{ imageRendering: "pixelated" }}
              />
            </div>
          </div>
        </div>
      )}

      {analysisOpen && (
        <AnalyzePackModal
          analysis={analysis}
          isAnalyzing={analyzing}
          onClose={() => setAnalysisOpen(false)}
          darkMode={darkMode}
        />
      )}

      {previewOpen && (
        <PreviewModal
          packs={packs}
          onClose={() => setPreviewOpen(false)}
          darkMode={darkMode}
        />
      )}

      {showBatchOperations && (
        <BatchOperationsPanel
          textures={getAllTexturePathsInFolder(packs, selectedFolder, false)}
          selectedTextures={batchSelectedTextures}
          onSelectionChange={setBatchSelectedTextures}
          onApplyRecolor={handleBatchRecolor}
          onApplyResize={handleBatchResize}
          onApplyConvert={handleBatchConvert}
          onClose={() => setShowBatchOperations(false)}
          darkMode={darkMode}
        />
      )}

      {/* ── File Viewer modal ── */}
      {fileViewerPack && (
        <FileViewerModal
          pack={fileViewerPack}
          onClose={() => setFileViewerPack(null)}
          onDeleteFile={(filePath) => {
            if (confirm(`Delete ${filePath} from ${stripColorCodes(fileViewerPack.name)}?`)) {
              setPacks(prev => {
                const updated = prev.map(pack => {
                  if (pack.id === fileViewerPack.id) {
                    const newFiles = new Map(pack.files);
                    newFiles.delete(filePath);
                    const updatedPack = { ...pack, files: newFiles };
                    setTimeout(() => setFileViewerPack(updatedPack), 0);
                    return updatedPack;
                  }
                  return pack;
                });
                return updated;
              });
            }
          }}
          darkMode={darkMode}
          stripColorCodes={stripColorCodes}
        />
      )}

      {/* ── Settings modal ── */}
      {settingsOpen && (
        <SettingsModal
          texturesPerRow={texturesPerRow}
          onTexturesPerRowChange={setTexturesPerRow}
          defaultPackName={uploadDefaults.name}
          defaultPackDescription={uploadDefaults.description}
          defaultPackIcon={uploadDefaults.icon}
          onDefaultNameChange={(value) => setUploadDefaults((prev) => ({ ...prev, name: value }))}
          onDefaultDescriptionChange={(value) => setUploadDefaults((prev) => ({ ...prev, description: value }))}
          onDefaultIconChange={(dataUrl) => setUploadDefaults((prev) => ({ ...prev, icon: dataUrl }))}
          onDefaultIconRemove={() => setUploadDefaults((prev) => ({ ...prev, icon: null }))}
          copyFromTopPack={copyFromTopPack}
          onCopyFromTopPackChange={setCopyFromTopPack}
          onClose={() => setSettingsOpen(false)}
          checkerboardStyle={checkerboardStyle}
          onCheckerboardStyleChange={setCheckerboardStyle}
        />
      )}

      {/* ── Icon cropper ── */}
      {cropSource && (
        <ImageCropper
          src={cropSource}
          onCrop={(dataUrl) => { setPackIcon(dataUrl); setCropSource(null); }}
          onCancel={() => setCropSource(null)}
        />
      )}

      {/* ── Notifications ── */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className="relative bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden"
            style={{ width: '300px' }}
          >
            <div className="px-4 py-3">
              <p className="text-sm text-gray-800">{notification.message}</p>
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
    </div>
  );
}
