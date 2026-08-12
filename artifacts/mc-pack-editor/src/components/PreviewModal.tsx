import { Pack } from "../types";
import { arrayBufferToDataURL } from "../lib/zipUtils";

interface PreviewModalProps {
  packs: Pack[];
  onClose: () => void;
  darkMode: boolean;
}

const PREVIEW_ITEMS = [
  { name: "Wooden Sword", filename: "wooden_sword.png" },
  { name: "Red Wool", filename: "red_wool.png" },
  { name: "Green Wool", filename: "green_wool.png" },
  { name: "Glass", filename: "glass.png" },
  { name: "Fireball", filename: "fire_charge.png" },
  { name: "Emerald", filename: "emerald.png" },
  { name: "Diamond", filename: "diamond.png" },
  { name: "Iron Ingot", filename: "iron_ingot.png" },
  { name: "Gold Ingot", filename: "gold_ingot.png" },
  { name: "TNT", filename: "tnt.png" },
  { name: "Golden Apple", filename: "golden_apple.png" },
];

// Search for a file by filename across all packs
function getItemTexture(packs: Pack[], filename: string): string | null {
  for (const pack of packs) {
    for (const [path, buffer] of pack.files.entries()) {
      const parts = path.split('/');
      const actualFilename = parts[parts.length - 1];
      if (actualFilename === filename) {
        console.log(`Found texture: ${filename} at ${path}`);
        return arrayBufferToDataURL(buffer, path);
      }
    }
  }
  console.log(`Missing texture: ${filename}`);
  return null;
}

function getSkyTexture(packs: Pack[]): string | null {
  const skyFilenames = ["cloud1.png", "cloud2.png", "clouds.png", "sky.png"];

  for (const pack of packs) {
    for (const [path, buffer] of pack.files.entries()) {
      const parts = path.split('/');
      const filename = parts[parts.length - 1].toLowerCase();
      if (skyFilenames.includes(filename)) {
        console.log(`Found sky texture: ${filename} at ${path}`);
        return arrayBufferToDataURL(buffer, path);
      }
    }
  }
  console.log('No sky texture found, using default');
  return null;
}

export default function PreviewModal({ packs, onClose, darkMode }: PreviewModalProps) {
  const skyTexture = getSkyTexture(packs);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`relative w-full max-w-4xl max-h-[80vh] rounded-2xl overflow-hidden shadow-2xl ${darkMode ? "bg-dark-secondary border-dark-border" : "bg-white border-gray-200"} border`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${darkMode ? "border-dark-border" : "border-gray-200"}`}>
          <h2 className={`text-xl font-semibold ${darkMode ? "text-dark-text" : "text-gray-900"}`}>Preview Loadout</h2>
          <button
            onClick={onClose}
            className={`text-lg leading-none ${darkMode ? "text-dark-text-secondary hover:text-dark-text" : "text-slate-400 hover:text-slate-700"}`}
          >
            ✕
          </button>
        </div>

        {/* Preview Area */}
        <div
          className="relative w-full h-[500px] overflow-hidden"
          style={{
            backgroundImage: skyTexture ? `url(${skyTexture})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundColor: skyTexture ? undefined : '#87CEEB',
          }}
        >
          {/* Grid of items */}
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <div className="grid grid-cols-4 gap-6">
              {PREVIEW_ITEMS.map((item) => {
                const textureUrl = getItemTexture(packs, item.filename);
                return (
                  <div
                    key={item.filename}
                    className="flex flex-col items-center gap-2"
                  >
                    <div
                      className="w-20 h-20 rounded-lg checkered flex items-center justify-center border-2 border-black/20"
                      style={{ imageRendering: 'pixelated' }}
                    >
                      {textureUrl ? (
                        <img
                          src={textureUrl}
                          alt={item.name}
                          className="w-16 h-16 object-contain"
                          style={{ imageRendering: 'pixelated' }}
                        />
                      ) : (
                        <span className="text-xs text-center text-gray-500">Missing</span>
                      )}
                    </div>
                    <span className={`text-xs font-medium ${darkMode ? "text-dark-text" : "text-gray-900"}`}>
                      {item.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`p-4 border-t ${darkMode ? "border-dark-border" : "border-gray-200"}`}>
          <p className={`text-sm ${darkMode ? "text-dark-text-secondary" : "text-gray-600"}`}>
            Preview displays textures from your resource pack. Background uses the pack's sky texture if available.
          </p>
        </div>
      </div>
    </div>
  );
}
