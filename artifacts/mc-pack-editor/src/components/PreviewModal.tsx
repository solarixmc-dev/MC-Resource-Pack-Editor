import { Pack } from "../types";
import { arrayBufferToDataURL } from "../lib/zipUtils";
import { useState } from "react";
import Item3DPreview from "./Item3DPreview";

interface PreviewModalProps {
  packs: Pack[];
  onClose: () => void;
  darkMode: boolean;
}

const PREVIEW_ITEMS = [
  { name: "Wooden Sword", filenames: ["wood_sword.png", "sword_wood.png"] },
  { name: "Shears", filenames: ["shears.png"] },
  { name: "Wooden Pickaxe", filenames: ["wood_pickaxe.png", "pickaxe_wood.png"] },
  { name: "Wooden Axe", filenames: ["wood_axe.png", "axe_wood.png"] },
  { name: "Golden Apple", filenames: ["apple_golden.png", "golden_apple.png"] },
  { name: "Blue Wool", filenames: ["wool_colored_blue.png", "blue_wool.png"] },
  { name: "Oak Planks", filenames: ["planks_oak.png"] },
  { name: "End Stone", filenames: ["end_stone.png"] },
  { name: "TNT", filenames: ["tnt_side.png", "tnt.png"] },
  { name: "Red Wool", filenames: ["wool_colored_red.png", "red_wool.png"] },
  { name: "Fireball", filenames: ["fireball.png", "fire_charge.png"] },
  { name: "Emerald", filenames: ["emerald.png"] },
  { name: "Diamond", filenames: ["diamond.png"] },
  { name: "Iron Ingot", filenames: ["iron_ingot.png"] },
  { name: "Gold Ingot", filenames: ["gold_ingot.png"] },
  { name: "Potion Bottle", filenames: ["potion_bottle_drinkable.png", "potion_bottle_splash.png"] },
  { name: "Bed", filenames: ["bed.png", "bed_foot.png", "bed_head.png"] },
];

// Search for a file by filename across all packs
function getItemTexture(packs: Pack[], filenames: string[]): string | null {
  for (const pack of packs) {
    for (const [path, buffer] of pack.files.entries()) {
      const parts = path.split('/');
      const actualFilename = parts[parts.length - 1];
      if (filenames.includes(actualFilename)) {
        console.log(`Found texture: ${actualFilename} at ${path}`);
        return arrayBufferToDataURL(buffer, path);
      }
    }
  }
  console.log(`Missing texture: ${filenames.join(', ')}`);
  return null;
}

export default function PreviewModal({ packs, onClose, darkMode }: PreviewModalProps) {
  const [selectedItem, setSelectedItem] = useState<{ name: string; filenames: string[] } | null>(null);

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
          className={`relative w-full h-[400px] overflow-hidden ${darkMode ? "bg-dark-secondary" : "bg-white"}`}
        >
          {/* Grid of items */}
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <div className="grid grid-cols-5 gap-4">
              {PREVIEW_ITEMS.map((item) => {
                const textureUrl = getItemTexture(packs, item.filenames);
                return (
                  <div
                    key={item.filenames[0]}
                    className="flex flex-col items-center gap-2 cursor-pointer hover:scale-105 transition-transform"
                    onClick={() => setSelectedItem(item)}
                  >
                    <div
                      className={`w-16 h-16 rounded-lg flex items-center justify-center border-2 ${darkMode ? "bg-dark-secondary border-dark-border" : "bg-white border-gray-300"}`}
                      style={{ imageRendering: 'pixelated' }}
                    >
                      {textureUrl ? (
                        <img
                          src={textureUrl}
                          alt={item.name}
                          className="w-12 h-12 object-contain"
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
            Preview displays textures from your resource pack. Click on any item to view 3D model.
          </p>
        </div>
      </div>

      {/* 3D Item Preview */}
      {selectedItem && (
        <Item3DPreview
          item={selectedItem}
          packs={packs}
          onClose={() => setSelectedItem(null)}
          darkMode={darkMode}
        />
      )}
    </div>
  );
}
