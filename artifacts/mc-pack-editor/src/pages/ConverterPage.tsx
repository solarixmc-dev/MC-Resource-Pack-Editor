import { useState } from "react";
import { useTheme } from "../contexts/ThemeContext";
import JSZip from "jszip";

// Pack format mappings for different Minecraft versions
const PACK_FORMATS: Record<string, number> = {
  "1.8.8": 1,
  "1.8.9": 1,
  "1.9": 2,
  "1.10": 2,
  "1.10.2": 2,
  "1.11": 3,
  "1.11.2": 3,
  "1.12": 3,
  "1.12.2": 3,
  "1.13": 4,
  "1.13.2": 4,
  "1.14": 4,
  "1.14.4": 4,
  "1.15": 5,
  "1.15.2": 5,
  "1.16": 5,
  "1.16.1": 5,
  "1.16.2": 6,
  "1.16.3": 6,
  "1.16.4": 6,
  "1.16.5": 6,
  "1.17": 7,
  "1.17.1": 7,
  "1.18": 8,
  "1.18.1": 8,
  "1.18.2": 8,
  "1.19": 9,
  "1.19.1": 9,
  "1.19.2": 9,
  "1.19.3": 12,
  "1.19.4": 13,
  "1.20": 15,
  "1.20.1": 15,
  "1.20.2": 18,
  "1.20.3": 18,
  "1.20.4": 22,
  "1.20.5": 32,
  "1.20.6": 34,
  "1.21": 34,
  "1.21.1": 34,
  "1.21.2": 42,
  "1.21.3": 42,
  "1.21.4": 46,
  "26.1": 84,
  "26.1.2": 88,
};

// Versions that require format array (min_format, max_format)
const FORMAT_ARRAY_VERSIONS = ["26.1", "26.1.2"];

// Get min and max format for format array versions
const getFormatRange = (format: number): { min: number; max: number } => {
  // For 26.1 (format 84), range is 65-88
  if (format === 84) return { min: 65, max: 88 };
  // For 26.1.2 (format 88), range is 65-88
  if (format === 88) return { min: 65, max: 88 };
  return { min: format, max: format };
};

export default function ConverterPage() {
  const { theme } = useTheme();
  const [inputPack, setInputPack] = useState<File | null>(null);
  const [targetVersion, setTargetVersion] = useState("1.20.4");
  const [isConverting, setIsConverting] = useState(false);
  const [conversionResult, setConversionResult] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setInputPack(file);
    }
  };

  const handleConvert = async () => {
    if (!inputPack) return;

    setIsConverting(true);
    setConversionResult(null);

    try {
      // Load the zip file
      const buffer = await inputPack.arrayBuffer();
      const zip = await JSZip.loadAsync(buffer);

      // Find and update pack.mcmeta
      const mcmetaFile = zip.file("pack.mcmeta");
      if (!mcmetaFile) {
        throw new Error("pack.mcmeta not found in the resource pack");
      }

      const mcmetaContent = await mcmetaFile.async("string");
      const mcmeta = JSON.parse(mcmetaContent);

      // Update pack format
      const targetFormat = PACK_FORMATS[targetVersion];
      if (!targetFormat) {
        throw new Error(`Unknown pack format for version ${targetVersion}`);
      }

      // Remove supported_formats if converting to format 82+ (1.21.4+)
      if (targetFormat >= 82 && mcmeta.pack?.supported_formats) {
        delete mcmeta.pack.supported_formats;
      }

      // Handle format array for modern versions (26.1+)
      if (FORMAT_ARRAY_VERSIONS.includes(targetVersion)) {
        const range = getFormatRange(targetFormat);
        mcmeta.pack = {
          ...mcmeta.pack,
          pack_format: targetFormat,
          min_format: range.min,
          max_format: range.max,
        };
      } else {
        // For older versions, strip min_format and max_format if present
        if (mcmeta.pack?.min_format !== undefined) {
          delete mcmeta.pack.min_format;
        }
        if (mcmeta.pack?.max_format !== undefined) {
          delete mcmeta.pack.max_format;
        }
        mcmeta.pack = {
          ...mcmeta.pack,
          pack_format: targetFormat,
        };
      }

      // Write back the updated mcmeta
      zip.file("pack.mcmeta", JSON.stringify(mcmeta, null, 2));

      // Generate the converted file
      const outputBuffer = await zip.generateAsync({ type: "arraybuffer" });
      const blob = new Blob([outputBuffer], { type: "application/zip" });
      const url = URL.createObjectURL(blob);

      // Create download link
      const link = document.createElement("a");
      link.href = url;
      link.download = inputPack.name.replace(".zip", `_${targetVersion}.zip`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const formatInfo = FORMAT_ARRAY_VERSIONS.includes(targetVersion)
        ? ` (pack_format: ${targetFormat}, range: ${getFormatRange(targetFormat).min}-${getFormatRange(targetFormat).max})`
        : ` (pack_format: ${targetFormat})`;

      setConversionResult(`Successfully converted ${inputPack.name} to Minecraft ${targetVersion}${formatInfo}`);
    } catch (error) {
      setConversionResult(`Error: ${error instanceof Error ? error.message : "Conversion failed"}`);
    } finally {
      setIsConverting(false);
    }
  };

  const minecraftVersions = [
    "1.8.8", "1.8.9", "1.9", "1.10", "1.10.2", "1.11", "1.11.2", "1.12", "1.12.2",
    "1.13", "1.13.2", "1.14", "1.14.4", "1.15", "1.15.2", "1.16", "1.16.1", "1.16.2",
    "1.16.3", "1.16.4", "1.16.5", "1.17", "1.17.1", "1.18", "1.18.1", "1.18.2",
    "1.19", "1.19.1", "1.19.2", "1.19.3", "1.19.4", "1.20", "1.20.1", "1.20.2",
    "1.20.3", "1.20.4", "1.20.5", "1.20.6", "1.21", "1.21.1", "1.21.2", "1.21.3",
    "1.21.4", "26.1", "26.1.2"
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-dark-bg">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-black dark:text-dark-text mb-4">
            Pack Version Converter
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Convert your resource packs between different Minecraft versions
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

          {/* Target Version Selection */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-black dark:text-dark-text mb-2">
              Target Minecraft Version
            </label>
            <select
              value={targetVersion}
              onChange={(e) => setTargetVersion(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-dark-border rounded-lg focus:outline-none focus:border-[#C2B280] bg-white dark:bg-dark-tertiary text-black dark:text-dark-text"
            >
              {minecraftVersions.map((version) => (
                <option key={version} value={version}>
                  Minecraft {version}
                </option>
              ))}
            </select>
          </div>

          {/* Convert Button */}
          <button
            onClick={handleConvert}
            disabled={!inputPack || isConverting}
            className="w-full px-6 py-3 bg-[#C2B280] hover:bg-[#C2B280]/90 text-black font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConverting ? "Converting..." : "Convert Pack"}
          </button>

          {/* Result */}
          {conversionResult && (
            <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-green-800 dark:text-green-300 font-medium">{conversionResult}</p>
            </div>
          )}

          {/* Info Box */}
          <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">How it works</h3>
            <p className="text-sm text-blue-800 dark:text-blue-400 mb-3">
              The converter automatically updates the pack.mcmeta file with the correct pack_format number for the target version.
            </p>
            <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-2 text-sm">Current Features:</h4>
            <ul className="text-sm text-blue-800 dark:text-blue-400 list-disc list-inside space-y-1">
              <li>Updates pack_format to match target Minecraft version</li>
              <li>Handles modern format array (min_format/max_format) for 26.1+</li>
              <li>Removes deprecated supported_formats for newer versions</li>
              <li>Strips format array when downgrading to older versions</li>
            </ul>
            <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-2 mt-3 text-sm">Not Yet Implemented:</h4>
            <ul className="text-sm text-blue-800 dark:text-blue-400 list-disc list-inside space-y-1">
              <li>Folder restructuring (blocks→block, items→item for 1.13+)</li>
              <li>Equipment folder relocation for 1.21.4+</li>
              <li>Sprite sheet splitting (icons.png, particles.png)</li>
              <li>1.21.4 model engine rewrite (overrides removal)</li>
              <li>Lowercase enforcement for 1.11+</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}