import { useState } from "react";
import { useTheme } from "../contexts/ThemeContext";
import JSZip from "jszip";
import { McText } from "../components/common/McText";
import { getTextureFolder } from "../lib/zipUtils";
import { MC_FOLDERS } from "../types";

// Authoritative Resource Pack Format Lookup Table
const RESOURCE_PACK_FORMATS: Record<number, { versions: string; minVersion: string; maxVersion: string }> = {
  1: { versions: "1.6.1 - 1.8.9", minVersion: "1.6.1", maxVersion: "1.8.9" },
  2: { versions: "1.9 - 1.10.2", minVersion: "1.9", maxVersion: "1.10.2" },
  3: { versions: "1.11 - 1.12.2", minVersion: "1.11", maxVersion: "1.12.2" },
  4: { versions: "1.13 - 1.14.4", minVersion: "1.13", maxVersion: "1.14.4" },
  5: { versions: "1.15 - 1.16.1", minVersion: "1.15", maxVersion: "1.16.1" },
  6: { versions: "1.16.2 - 1.16.5", minVersion: "1.16.2", maxVersion: "1.16.5" },
  7: { versions: "1.17 - 1.17.1", minVersion: "1.17", maxVersion: "1.17.1" },
  8: { versions: "1.18 - 1.18.2", minVersion: "1.18", maxVersion: "1.18.2" },
  9: { versions: "1.19 - 1.19.2", minVersion: "1.19", maxVersion: "1.19.2" },
  12: { versions: "1.19.3", minVersion: "1.19.3", maxVersion: "1.19.3" },
  13: { versions: "1.19.4", minVersion: "1.19.4", maxVersion: "1.19.4" },
  15: { versions: "1.20 - 1.20.1", minVersion: "1.20", maxVersion: "1.20.1" },
  18: { versions: "1.20.2", minVersion: "1.20.2", maxVersion: "1.20.2" },
  22: { versions: "1.20.3 - 1.20.4", minVersion: "1.20.3", maxVersion: "1.20.4" },
  32: { versions: "1.20.5 - 1.20.6", minVersion: "1.20.5", maxVersion: "1.20.6" },
  34: { versions: "1.21 - 1.21.1", minVersion: "1.21", maxVersion: "1.21.1" },
  42: { versions: "1.21.2 - 1.21.3", minVersion: "1.21.2", maxVersion: "1.21.3" },
  46: { versions: "1.21.4", minVersion: "1.21.4", maxVersion: "1.21.4" },
  55: { versions: "1.21.5", minVersion: "1.21.5", maxVersion: "1.21.5" },
  63: { versions: "1.21.6", minVersion: "1.21.6", maxVersion: "1.21.6" },
  64: { versions: "1.21.7 - 1.21.8", minVersion: "1.21.7", maxVersion: "1.21.8" },
  69: { versions: "1.21.9 - 1.21.10", minVersion: "1.21.9", maxVersion: "1.21.10" },
  75: { versions: "1.21.11", minVersion: "1.21.11", maxVersion: "1.21.11" },
  84: { versions: "26.1 - 26.1.2", minVersion: "26.1", maxVersion: "26.1.2" },
  88: { versions: "26.2", minVersion: "26.2", maxVersion: "26.2" },
};

interface PackAnalysis {
  name: string;
  rawName?: string;
  description?: string;
  packIcon?: string;
  totalFiles: number;
  totalSize: number;
  versionInfo: {
    type: 'legacy' | 'supported' | 'modern' | 'unknown';
    formats: number[];
    versionRange: string;
    metadataSystem: string;
  };
  textureCounts: Record<string, number>;
  fileExtensions: Record<string, { count: number; purpose: string }>;
  mainExtensions: Record<string, { count: number; purpose: string }>;
  otherExtensions: Record<string, { count: number; purpose: string }>;
  textureResolutions: Record<string, number>;
  duplicateTextures: Array<{ path1: string; path2: string }>;
  folderTree: TreeNode[];
  textureFiles: Array<{ path: string; size: number; folder: string }>;
}

interface TreeNode {
  name: string;
  path: string;
  type: 'folder' | 'file';
  children?: TreeNode[];
  expanded?: boolean;
  level: number;
}

export default function AnalyzerPage() {
  const { theme } = useTheme();
  const [inputPack, setInputPack] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<PackAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [showMoreExtensions, setShowMoreExtensions] = useState(false);
  const [showTextureViewer, setShowTextureViewer] = useState(false);
  const [textureSort, setTextureSort] = useState<'size' | 'name' | 'folder'>('name');
  const [textureSortReverse, setTextureSortReverse] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setInputPack(file);
      setAnalysisResult(null);
      setError(null);
    }
  };

  const normalizeFormatNumber = (value: any): number | null => {
    if (typeof value === 'number') return value;
    if (Array.isArray(value) && value.length > 0) {
      return typeof value[0] === 'number' ? value[0] : parseFloat(value[0]);
    }
    if (typeof value === 'string') return parseFloat(value);
    return null;
  };

  const analyzePackMcmeta = (mcmeta: any) => {
    const versionInfo: PackAnalysis['versionInfo'] = {
      type: 'unknown',
      formats: [],
      versionRange: 'Minecraft version could not be determined from pack.mcmeta.',
      metadataSystem: 'Unknown',
    };

    const pack = mcmeta?.pack;
    if (!pack) return versionInfo;

    // Priority 1: Check for modern min_format/max_format (1.21.9+)
    const minFormat = normalizeFormatNumber(pack.min_format);
    const maxFormat = normalizeFormatNumber(pack.max_format);

    if (minFormat !== null || maxFormat !== null) {
      versionInfo.type = 'modern';
      versionInfo.metadataSystem = 'min_format / max_format';

      const formats: number[] = [];
      if (minFormat !== null) formats.push(minFormat);
      if (maxFormat !== null) formats.push(maxFormat);
      versionInfo.formats = formats;

      const minVersion = minFormat !== null ? RESOURCE_PACK_FORMATS[minFormat]?.versions : null;
      const maxVersion = maxFormat !== null ? RESOURCE_PACK_FORMATS[maxFormat]?.versions : null;

      if (minVersion && maxVersion) {
        versionInfo.versionRange = `${minVersion} -> ${maxVersion}`;
      } else if (minVersion) {
        versionInfo.versionRange = `${minVersion}+`;
      } else if (maxVersion) {
        versionInfo.versionRange = `Up to ${maxVersion}`;
      } else {
        versionInfo.versionRange = `Unknown format range: ${minFormat || '?'} -> ${maxFormat || '?'}`;
      }

      return versionInfo;
    }

    // Priority 2: Check for supported_formats (1.20.2 - 1.21.8)
    if (pack.supported_formats && Array.isArray(pack.supported_formats)) {
      versionInfo.type = 'supported';
      versionInfo.metadataSystem = 'supported_formats';

      const formats = pack.supported_formats.map(normalizeFormatNumber).filter((f): f is number => f !== null);
      versionInfo.formats = formats;

      if (formats.length >= 2) {
        const minVer = RESOURCE_PACK_FORMATS[formats[0]]?.versions;
        const maxVer = RESOURCE_PACK_FORMATS[formats[formats.length - 1]]?.versions;
        versionInfo.versionRange = minVer && maxVer ? `${minVer} -> ${maxVer}` : 'Unknown range';
      } else if (formats.length === 1) {
        versionInfo.versionRange = RESOURCE_PACK_FORMATS[formats[0]]?.versions || 'Unknown';
      }

      return versionInfo;
    }

    // Priority 3: Check for legacy pack_format
    const packFormat = normalizeFormatNumber(pack.pack_format);
    if (packFormat !== null) {
      versionInfo.type = 'legacy';
      versionInfo.metadataSystem = 'Legacy pack_format';
      versionInfo.formats = [packFormat];

      const versionData = RESOURCE_PACK_FORMATS[packFormat];
      if (versionData) {
        versionInfo.versionRange = versionData.versions;
      } else {
        versionInfo.versionRange = `Unknown or development pack format: ${packFormat}`;
      }

      return versionInfo;
    }

    return versionInfo;
  };

  const buildFolderTree = (files: string[]): TreeNode[] => {
    const root: TreeNode = { name: 'root', path: '', type: 'folder', children: [], level: 0 };

    // Build tree for all files
    files.forEach(filePath => {
      const parts = filePath.split('/');
      let current = root;

      parts.forEach((part, index) => {
        const isFile = index === parts.length - 1;
        const path = current.path ? `${current.path}/${part}` : part;

        let existing = current.children?.find(child => child.name === part);
        if (!existing) {
          existing = {
            name: part,
            path,
            type: isFile ? 'file' : 'folder',
            children: isFile ? undefined : [],
            level: current.level + 1,
          };
          current.children?.push(existing);
        }

        if (!isFile && existing.children) {
          current = existing;
        }
      });
    });

    return root.children || [];
  };

  const getFilePurpose = (ext: string): string => {
    const purposes: Record<string, string> = {
      '.png': 'Texture image',
      '.json': 'Model/animation/data file',
      '.mcmeta': 'Metadata file',
      '.ogg': 'Audio sound file',
      '.oga': 'Audio sound file',
      '.wav': 'Audio sound file',
      '.lang': 'Language file',
      '.txt': 'Text/credits file',
      '.properties': 'Configuration file',
      '.xml': 'UI layout file',
      '.fsh': 'Shader file',
      '.vsh': 'Shader file',
      '.jsonc': 'JSON with comments',
    };
    return purposes[ext] || 'Unknown file type';
  };

  const getTextureCategoryLabel = (category: string): string => {
    const folder = MC_FOLDERS.find(f => f.key === category);
    return folder ? folder.label : category;
  };

  const detectDuplicates = async (zip: JSZip): Promise<Array<{ path1: string; path2: string }>> => {
    const pngFiles: Array<{ path: string; buffer: ArrayBuffer }> = [];
    const duplicates: Array<{ path1: string; path2: string }> = [];

    for (const [path, file] of Object.entries(zip.files)) {
      if (!file.dir && path.endsWith('.png')) {
        const buffer = await file.async('arraybuffer');
        pngFiles.push({ path, buffer });
      }
    }

    // Compare each file with every other file
    for (let i = 0; i < pngFiles.length; i++) {
      for (let j = i + 1; j < pngFiles.length; j++) {
        const a = pngFiles[i];
        const b = pngFiles[j];

        if (a.buffer.byteLength === b.buffer.byteLength) {
          const arrA = new Uint8Array(a.buffer);
          const arrB = new Uint8Array(b.buffer);
          let match = true;

          for (let k = 0; k < arrA.length; k++) {
            if (arrA[k] !== arrB[k]) {
              match = false;
              break;
            }
          }

          if (match) {
            duplicates.push({ path1: a.path, path2: b.path });
          }
        }
      }
    }

    return duplicates;
  };

  const analyzeTextureResolution = async (zip: JSZip): Promise<Record<string, number>> => {
    const resolutions: Record<string, number> = {};
    const validResolutions = ['16x16', '32x32', '64x64', '128x128', '256x256'];

    for (const [path, file] of Object.entries(zip.files)) {
      if (!file.dir && path.endsWith('.png')) {
        try {
          const arrayBuffer = await file.async('arraybuffer');
          const blob = new Blob([arrayBuffer]);
          const bitmap = await createImageBitmap(blob);

          const width = bitmap.width;
          const height = bitmap.height;
          const resolution = `${width}x${height}`;

          // Only count square resolutions within the valid range
          if (width === height && validResolutions.includes(resolution)) {
            resolutions[resolution] = (resolutions[resolution] || 0) + 1;
          }

          bitmap.close();
        } catch (e) {
          // Skip invalid images
        }
      }
    }

    return resolutions;
  };

  const handleAnalyze = async () => {
    if (!inputPack) return;

    setIsAnalyzing(true);
    setAnalysisResult(null);
    setError(null);

    try {
      const buffer = await inputPack.arrayBuffer();
      const zip = await JSZip.loadAsync(buffer);

      let totalSize = 0;
      const textureCounts: Record<string, number> = {};
      const fileExtensions: Record<string, { count: number; purpose: string }> = {};
      const files = Object.keys(zip.files);

      // Parse pack.mcmeta
      let description: string | undefined;
      let packIcon: string | undefined;
      let versionInfo: PackAnalysis['versionInfo'] = {
        type: 'unknown',
        formats: [],
        versionRange: 'Minecraft version could not be determined from pack.mcmeta.',
        metadataSystem: 'Unknown',
      };

      const mcmetaFile = zip.file("pack.mcmeta");
      if (mcmetaFile) {
        const mcmetaContent = await mcmetaFile.async("string");
        try {
          const mcmeta = JSON.parse(mcmetaContent);
          description = mcmeta.pack?.description;
          if (typeof description === 'object') {
            description = description.text || '';
          }
          versionInfo = analyzePackMcmeta(mcmeta);
        } catch (e) {
          console.error('Failed to parse pack.mcmeta:', e);
        }
      }

      // Get pack icon
      const iconFile = zip.file("pack.png");
      if (iconFile) {
        const iconBuffer = await iconFile.async('arraybuffer');
        const iconBlob = new Blob([iconBuffer]);
        packIcon = URL.createObjectURL(iconBlob);
      }

      // Analyze all files
      const textureFiles: Array<{ path: string; size: number; folder: string }> = [];
      const mainExtensions: Record<string, { count: number; purpose: string }> = {};
      const otherExtensions: Record<string, { count: number; purpose: string }> = {};
      const mainExts = ['.mcmeta', '.png', '.txt', '.properties'];

      for (const path of files) {
        const file = zip.files[path];
        if (!file.dir) {
          totalSize += file._data?.uncompressedSize || 0;

          // Count by extension
          const ext = path.includes('.') ? '.' + path.split('.').pop()?.toLowerCase() : '';
          if (ext) {
            const purpose = getFilePurpose(ext);
            const count = 1;

            if (mainExts.includes(ext)) {
              if (!mainExtensions[ext]) {
                mainExtensions[ext] = { count: 0, purpose };
              }
              mainExtensions[ext].count++;
            } else {
              if (!otherExtensions[ext]) {
                otherExtensions[ext] = { count: 0, purpose };
              }
              otherExtensions[ext].count++;
            }
          }

          // Count textures by category
          if (path.endsWith('.png')) {
            const category = getTextureFolder(path);
            textureCounts[category] = (textureCounts[category] || 0) + 1;

            // Collect texture file info
            const folder = path.includes('/') ? path.split('/').slice(0, -1).join('/') : 'root';
            textureFiles.push({
              path,
              size: file._data?.uncompressedSize || 0,
              folder,
            });
          }
        }
      }

      // Detect duplicates
      const duplicates = await detectDuplicates(zip);

      // Analyze texture resolutions
      const resolutions = await analyzeTextureResolution(zip);

      // Build folder tree
      const folderTree = buildFolderTree(files);

      setAnalysisResult({
        name: inputPack.name.replace('.zip', ''),
        rawName: inputPack.name,
        description,
        packIcon,
        totalFiles: files.length,
        totalSize,
        versionInfo,
        textureCounts,
        fileExtensions: mainExtensions,
        mainExtensions,
        otherExtensions,
        textureResolutions: resolutions,
        duplicateTextures: duplicates,
        folderTree,
        textureFiles,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  const toggleNode = (path: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const renderTreeNode = (node: TreeNode) => {
    const isExpanded = expandedNodes.has(node.path);
    const paddingLeft = node.level * 16;

    return (
      <div key={node.path}>
        <div
          className="flex items-center gap-2 py-1 hover:bg-gray-100 dark:hover:bg-dark-tertiary cursor-pointer"
          style={{ paddingLeft: `${paddingLeft + 8}px` }}
          onClick={() => node.type === 'folder' && toggleNode(node.path)}
        >
          <span className="text-gray-500 dark:text-gray-400">
            {node.type === 'folder' ? (isExpanded ? '📂' : '📁') : '📄'}
          </span>
          <span className="text-sm text-gray-700 dark:text-gray-300 font-mono">
            {node.name}
          </span>
        </div>
        {node.type === 'folder' && isExpanded && node.children && node.children.map(child => renderTreeNode(child))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white dark:bg-dark-bg">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-black dark:text-dark-text mb-4">
            Pack Analyzer
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Advanced resource pack analysis with detailed insights
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-dark-secondary rounded-xl p-8 border border-gray-200 dark:border-dark-border">
          {/* File Upload */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-black dark:text-dark-text mb-2">
              Select Resource Pack
            </label>
            <div className="border-2 border-dashed border-gray-300 dark:border-dark-border rounded-lg p-8 text-center hover:border-[#C2B280] transition-colors">
              <input
                type="file"
                accept=".zip,.mcpack"
                onChange={handleFileSelect}
                className="hidden"
                id="pack-upload"
              />
              <label
                htmlFor="pack-upload"
                className="cursor-pointer block"
              >
                {inputPack ? (
                  <div>
                    <svg className="w-12 h-12 mx-auto text-[#C2B280] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-black dark:text-dark-text font-medium">{inputPack.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{(inputPack.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <div>
                    <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-gray-600 dark:text-gray-400">Click to upload or drag and drop</p>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">.zip or .mcpack files</p>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Analyze Button */}
          <button
            onClick={handleAnalyze}
            disabled={!inputPack || isAnalyzing}
            className="w-full px-6 py-3 bg-[#C2B280] hover:bg-[#C2B280]/90 text-black font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-8"
          >
            {isAnalyzing ? "Analyzing..." : "Analyze Pack"}
          </button>

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-800 dark:text-red-300 font-medium">{error}</p>
            </div>
          )}

          {/* Analysis Results */}
          {analysisResult && (
            <div className="space-y-6">
              {/* Pack Header with Icon and Info */}
              <div className="bg-white dark:bg-dark-tertiary rounded-lg p-6 border border-gray-200 dark:border-dark-border">
                <div className="flex items-start gap-6">
                  {analysisResult.packIcon && (
                    <div className="w-24 h-24 flex-shrink-0">
                      <img src={analysisResult.packIcon} alt="Pack Icon" className="w-full h-full object-cover rounded-lg" />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="mb-2">
                      <h3 className="text-2xl font-bold text-black dark:text-dark-text">
                        <McText text={analysisResult.name} fallback={analysisResult.rawName} />
                      </h3>
                    </div>
                    {analysisResult.description && (
                      <div className="mb-4">
                        <McText text={analysisResult.description} fallback="…" />
                      </div>
                    )}
                    <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <span>{analysisResult.totalFiles} files</span>
                      <span>{formatSize(analysisResult.totalSize)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Version Compatibility */}
              <div className="bg-white dark:bg-dark-tertiary rounded-lg p-6 border border-gray-200 dark:border-dark-border">
                <h3 className="text-lg font-semibold text-black dark:text-dark-text mb-4">Minecraft Version Compatibility</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Metadata System</span>
                    <span className="px-3 py-1 bg-[#C2B280]/20 text-black dark:text-dark-text rounded-full text-sm font-medium">
                      {analysisResult.versionInfo.metadataSystem}
                    </span>
                  </div>
                  {analysisResult.versionInfo.formats.length > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">
                        {analysisResult.versionInfo.type === 'modern' ? 'Format Range' : 'Resource Pack Format'}
                      </span>
                      <span className="text-black dark:text-dark-text font-mono font-medium">
                        {analysisResult.versionInfo.formats.join(' -> ')}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Detected Version</span>
                    <span className="text-black dark:text-dark-text font-medium">
                      {analysisResult.versionInfo.versionRange}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Status</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      analysisResult.versionInfo.type === 'unknown' ? 'bg-gray-200 text-gray-700' :
                      analysisResult.versionInfo.type === 'modern' ? 'bg-blue-100 text-blue-700' :
                      analysisResult.versionInfo.type === 'supported' ? 'bg-purple-100 text-purple-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {analysisResult.versionInfo.type === 'unknown' ? 'Unknown' :
                       analysisResult.versionInfo.type === 'modern' ? 'Range' :
                       analysisResult.versionInfo.type === 'supported' ? 'Range' : 'Exact'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Overview Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-dark-tertiary rounded-lg p-4 border border-gray-200 dark:border-dark-border">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Files</p>
                  <p className="text-2xl font-bold text-black dark:text-dark-text">{analysisResult.totalFiles}</p>
                </div>
                <div className="bg-white dark:bg-dark-tertiary rounded-lg p-4 border border-gray-200 dark:border-dark-border">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Size</p>
                  <p className="text-2xl font-bold text-black dark:text-dark-text">{formatSize(analysisResult.totalSize)}</p>
                </div>
                <div className="bg-white dark:bg-dark-tertiary rounded-lg p-4 border border-gray-200 dark:border-dark-border">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">File Types</p>
                  <p className="text-2xl font-bold text-black dark:text-dark-text">{Object.keys(analysisResult.fileExtensions).length}</p>
                </div>
                <div className="bg-white dark:bg-dark-tertiary rounded-lg p-4 border border-gray-200 dark:border-dark-border">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Duplicates</p>
                  <p className="text-2xl font-bold text-black dark:text-dark-text">{analysisResult.duplicateTextures.length}</p>
                </div>
              </div>

              {/* Texture Categories */}
              <div className="bg-white dark:bg-dark-tertiary rounded-lg p-6 border border-gray-200 dark:border-dark-border">
                <h3 className="text-lg font-semibold text-black dark:text-dark-text mb-4">Textures by Category</h3>
                <div className="space-y-3">
                  {Object.entries(analysisResult.textureCounts).map(([category, count]) => {
                    const maxCount = Math.max(...Object.values(analysisResult.textureCounts));
                    const percentage = (count / maxCount) * 100;
                    const label = getTextureCategoryLabel(category);
                    return (
                      <div key={category}>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
                          <span className="text-sm text-black dark:text-dark-text font-medium">{count}</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-dark-border rounded-full h-2">
                          <div
                            className="bg-[#C2B280] h-2 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Texture Resolution Analysis */}
              <div className="bg-white dark:bg-dark-tertiary rounded-lg p-6 border border-gray-200 dark:border-dark-border">
                <h3 className="text-lg font-semibold text-black dark:text-dark-text mb-4">Texture Resolution Analysis</h3>
                <div className="space-y-3">
                  {Object.entries(analysisResult.textureResolutions).map(([resolution, count]) => {
                    const totalTextures = Object.values(analysisResult.textureResolutions).reduce((a, b) => a + b, 0);
                    const percentage = (count / totalTextures) * 100;
                    return (
                      <div key={resolution}>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm text-gray-600 dark:text-gray-400">{resolution}</span>
                          <span className="text-sm text-black dark:text-dark-text font-medium">{count} ({percentage.toFixed(1)}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-dark-border rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* File Extensions */}
              <div className="bg-white dark:bg-dark-tertiary rounded-lg p-6 border border-gray-200 dark:border-dark-border">
                <h3 className="text-lg font-semibold text-black dark:text-dark-text mb-4">File Extensions</h3>
                <div className="space-y-3">
                  {Object.entries(analysisResult.mainExtensions).map(([ext, data]) => {
                    const maxCount = Math.max(...Object.values(analysisResult.mainExtensions).map(e => e.count));
                    const percentage = (data.count / maxCount) * 100;
                    return (
                      <div key={ext}>
                        <div className="flex justify-between mb-1">
                          <div>
                            <span className="text-sm text-gray-600 dark:text-gray-400">{ext}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-500 ml-2">({data.purpose})</span>
                          </div>
                          <span className="text-sm text-black dark:text-dark-text font-medium">{data.count}</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-dark-border rounded-full h-2">
                          <div
                            className="bg-[#C2B280] h-2 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {Object.keys(analysisResult.otherExtensions).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-dark-border">
                    {!showMoreExtensions ? (
                      <button
                        onClick={() => setShowMoreExtensions(true)}
                        className="flex items-center gap-2 text-sm text-[#C2B280] hover:text-[#C2B280]/80 transition-colors"
                      >
                        <span>See more extensions ({Object.keys(analysisResult.otherExtensions).length})</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    ) : (
                      <>
                        <div className="space-y-3 mt-4">
                          {Object.entries(analysisResult.otherExtensions).map(([ext, data]) => {
                            const maxCount = Math.max(...Object.values(analysisResult.otherExtensions).map(e => e.count));
                            const percentage = (data.count / maxCount) * 100;
                            return (
                              <div key={ext}>
                                <div className="flex justify-between mb-1">
                                  <div>
                                    <span className="text-sm text-gray-600 dark:text-gray-400">{ext}</span>
                                    <span className="text-xs text-gray-500 dark:text-gray-500 ml-2">({data.purpose})</span>
                                  </div>
                                  <span className="text-sm text-black dark:text-dark-text font-medium">{data.count}</span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-dark-border rounded-full h-2">
                                  <div
                                    className="bg-[#C2B280] h-2 rounded-full transition-all"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <button
                          onClick={() => setShowMoreExtensions(false)}
                          className="flex items-center gap-2 text-sm text-[#C2B280] hover:text-[#C2B280]/80 transition-colors mt-4"
                        >
                          <span>Show less</span>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Duplicate Textures */}
              {analysisResult.duplicateTextures.length > 0 && (
                <div className="bg-white dark:bg-dark-tertiary rounded-lg p-6 border border-gray-200 dark:border-dark-border">
                  <h3 className="text-lg font-semibold text-black dark:text-dark-text mb-4">
                    Duplicate Textures ({analysisResult.duplicateTextures.length})
                  </h3>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {analysisResult.duplicateTextures.map((dup, index) => (
                      <div key={index} className="text-sm">
                        <div className="text-gray-600 dark:text-gray-400 font-mono">{dup.path1}</div>
                        <div className="text-gray-600 dark:text-gray-400 font-mono">= {dup.path2}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Folder Tree */}
              <div className="bg-white dark:bg-dark-tertiary rounded-lg p-6 border border-gray-200 dark:border-dark-border">
                <h3 className="text-lg font-semibold text-black dark:text-dark-text mb-4">Folder Structure</h3>
                <div className="max-h-96 overflow-y-auto">
                  {analysisResult.folderTree.map(node => renderTreeNode(node))}
                </div>
              </div>

              {/* View All Textures Button */}
              <div className="bg-white dark:bg-dark-tertiary rounded-lg p-6 border border-gray-200 dark:border-dark-border">
                <button
                  onClick={() => setShowTextureViewer(true)}
                  className="w-full px-6 py-3 bg-[#C2B280] hover:bg-[#C2B280]/90 text-black font-semibold rounded-lg transition-colors"
                >
                  View All Textures ({analysisResult.textureFiles.length})
                </button>
              </div>
            </div>
          )}

          {/* Texture Viewer Modal */}
          {showTextureViewer && analysisResult && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className={`relative w-full max-w-4xl max-h-[80vh] rounded-2xl overflow-hidden shadow-2xl ${theme === 'dark' ? "bg-dark-secondary border-dark-border" : "bg-white border-gray-200"} border`}>
                {/* Header */}
                <div className={`flex items-center justify-between p-4 border-b ${theme === 'dark' ? "border-dark-border" : "border-gray-200"}`}>
                  <h2 className={`text-xl font-semibold ${theme === 'dark' ? "text-dark-text" : "text-gray-900"}`}>
                    All Textures ({analysisResult.textureFiles.length})
                  </h2>
                  <button
                    onClick={() => setShowTextureViewer(false)}
                    className={`text-lg leading-none ${theme === 'dark' ? "text-dark-text-secondary hover:text-dark-text" : "text-slate-400 hover:text-slate-700"}`}
                  >
                    ✕
                  </button>
                </div>

                {/* Controls */}
                <div className={`p-4 border-b ${theme === 'dark' ? "border-dark-border" : "border-gray-200"}`}>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600 dark:text-gray-400">Sort by:</label>
                      <select
                        value={textureSort}
                        onChange={(e) => setTextureSort(e.target.value as 'size' | 'name' | 'folder')}
                        className={`px-3 py-1.5 rounded-lg text-sm focus:outline-none focus:border-[#C2B280] ${theme === 'dark' ? "bg-dark-tertiary border-dark-border text-dark-text" : "bg-white border-gray-200 text-gray-900"}`}
                      >
                        <option value="name">Name (A-Z)</option>
                        <option value="size">Size</option>
                        <option value="folder">Folder</option>
                      </select>
                    </div>
                    <button
                      onClick={() => setTextureSortReverse(!textureSortReverse)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${textureSortReverse ? 'bg-[#C2B280] text-black' : theme === 'dark' ? 'bg-dark-tertiary text-dark-text' : 'bg-gray-100 text-gray-900'}`}
                    >
                      {textureSortReverse ? '↓ Reverse' : '↑ Normal'}
                    </button>
                  </div>
                </div>

                {/* Texture List */}
                <div className="overflow-y-auto max-h-[60vh] p-4">
                  <div className="space-y-2">
                    {(() => {
                      let sortedTextures = [...analysisResult.textureFiles];
                      
                      if (textureSort === 'size') {
                        sortedTextures.sort((a, b) => a.size - b.size);
                      } else if (textureSort === 'name') {
                        sortedTextures.sort((a, b) => a.path.localeCompare(b.path));
                      } else if (textureSort === 'folder') {
                        sortedTextures.sort((a, b) => a.folder.localeCompare(b.folder));
                      }

                      if (textureSortReverse) {
                        sortedTextures.reverse();
                      }

                      return sortedTextures.map((texture, index) => (
                        <div
                          key={index}
                          className={`flex items-center justify-between p-3 rounded-lg ${theme === 'dark' ? 'bg-dark-tertiary hover:bg-dark-border' : 'bg-gray-50 hover:bg-gray-100'}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-mono text-gray-900 dark:text-gray-300 truncate">
                              {texture.path}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-500">
                              {texture.folder}
                            </div>
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 ml-4">
                            {formatSize(texture.size)}
                          </div>
                        </div>
                      ));
                    })()}
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
