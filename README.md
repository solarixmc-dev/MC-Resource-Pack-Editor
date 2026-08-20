<div align="center">

# 🎨 TextureLab — Minecraft Resource Pack Editor

**The ultimate in-browser Minecraft texture editor, pack manager, and 3D previewer.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg?style=flat-square&logo=react)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.0-646CFF.svg?style=flat-square&logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC.svg?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Three.js](https://img.shields.io/badge/Three.js-3D_Preview-black.svg?style=flat-square&logo=three.js)](https://threejs.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)

[Features](#-key-features) • [Texture Atlas Support](#-texture-atlas-support) • [Tech Stack](#-tech-stack) • [Getting Started](#-getting-started) • [Project Structure](#-project-structure)

---

</div>

## 📖 Overview

**TextureLab** is an all-in-one web-based Minecraft resource pack editor. It enables creators to import existing `.zip` resource packs or build them from scratch directly in the browser with no external software required.

With pixel-perfect canvas editing, multi-pack layering, full Minecraft texture atlas decomposition (GUI HUDs, potion effects, widgets), 3D item rendering via Three.js, and client-side IndexedDB persistence, TextureLab simplifies the resource pack creation workflow.

---

## ✨ Key Features

### 🗂️ Resource Pack Management & Virtual File System
- **Drag-and-Drop Ingestion**: Import any `.zip` resource pack instantly via client-side ZIP parsing (`JSZip`).
- **Create from Scratch**: Generate complete Minecraft resource pack directory hierarchies (`assets/minecraft/textures/blocks`, `items`, `gui`, etc.) with customizable `pack.mcmeta` and `pack.png`.
- **Multi-Pack Layering**: Stack multiple resource packs, reorder layers, toggle overlays, and manage folder-level and texture-level overrides with live conflict resolution.
- **Export to ZIP**: Package and export production-ready `.zip` archives with metadata, custom formats, and composed atlases.

### 🖌️ Pixel-Perfect Texture Canvas Editor
- **Precision Drawing**: Grid-aligned pixel brush, eraser, eyedropper, and paint bucket fill tools.
- **Color Palette & Swatches**: 40+ curated color swatches with custom HEX/RGB input and quick-swap palettes.
- **Advanced Recolor & Tinting**: Apply tinting, colorizing, multiply, overlay, or hue-shift adjustments with adjustable intensity.
- **Pan & Zoom Navigation**: Smooth canvas zooming up to 32x with transparent checkerboard backgrounds (subtle, contrast, dark, or clean).
- **Side-by-Side Comparison**: Live split-view comparing the working texture against the original base texture.
- **History Stack**: Full Undo/Redo (`Ctrl+Z` / `Ctrl+Y`) tracking for every stroke.

### 📦 3D Interactive Item & Block Preview
- **Interactive Three.js Canvas**: View textures mapped in real-time onto 3D items and block models with dynamic lighting, smooth rotation, and user interaction.
- **Loadout & HUD Preview Modal**: Preview weapons, tools, armor pieces, hotbar containers, health/hunger bars, and status effects in authentic in-game HUD layouts.

### 🧩 Advanced Texture Atlas System (1.8.8+ & Modern)
- **Automatic Atlas Decomposition & Recomposition**:
  - **`icons.png`**: Hearts (normal, poison, wither, hardcore, absorption), armor bar, hunger icons, air bubbles, XP bar, boss bar, and connection ping bars.
  - **`widgets.png`**: Hotbar slots, selection box, UI buttons, progress indicators.
  - **`inventory.png`**: Potion effect status icons with exact Minecraft 1.8.8 `Potion.java` matrix calculations (`statusIconIndex = x + y * 8`).
- **Per-Region Pack Overrides**: Select and replace single HUD elements (e.g. only custom hearts or custom potion icons) while preserving the rest of the base atlas.
- **Live Composite HUD**: Real-time canvas rendering of overridden regions combined onto base atlas maps.

### 📊 Pack Health & Analytics Inspector
- **Pack Analysis Summary**: Detects texture resolutions (16x16, 32x32, 64x64, 128x128, etc.), total asset counts, pack file size, and target Minecraft format version.
- **Anomaly Detection**: Flags mismatched texture dimensions, missing textures, and broken file paths.

### 🪄 Batch Operations & Bulk Transformations
- **Multi-Texture Processing**: Select multiple textures via regex or folder filters.
- **Bulk Transformations**: Batch recolor, tint, resolution scale, or format convert hundreds of textures simultaneously.

### 🔤 Minecraft Formatting & Color Code System
- **Formatting Support**: Full support for Minecraft `§0`–`§f` color codes and style modifiers (`§l` bold, `§o` italic, `§n` underline, `§m` strikethrough, `§k` obfuscated, `§r` reset).
- **Live Preview Playground**: Interactive text formatter with one-click code insertion and copy-ready formatted strings.

### 💾 Offline-First & Saved Pack Library
- **IndexedDB Persistence**: Save packs, thumbnails, metadata, and working sessions directly in browser storage.
- **Guest / Local Fallback**: Automatic local storage fallback with revision tracking for quick reloading without account requirements.
- **Authentication Support**: Integrated Firebase Authentication / Guest profiles for personalized pack management.

---

## 🏛️ Project Structure

```plaintext
MC-Resource-Pack-Editor/
├── artifacts/
│   ├── mc-pack-editor/                 # Frontend Web Application
│   │   ├── src/
│   │   │   ├── components/             # Reusable UI & editor components
│   │   │   │   ├── BatchOperationsPanel.tsx # Bulk texture processing
│   │   │   │   ├── Item3DPreview.tsx   # Three.js 3D item renderer
│   │   │   │   ├── Navigation.tsx      # Top bar navigation & routing
│   │   │   │   ├── PreviewModal.tsx    # HUD & loadout preview modal
│   │   │   │   ├── ProfileDropdown.tsx # User profile & auth controls
│   │   │   │   ├── TourGuide.tsx       # Interactive onboarding tour
│   │   │   │   └── ui/                 # Design system primitives (Radix UI)
│   │   │   ├── contexts/               # Theme (Dark/Light) & Auth contexts
│   │   │   ├── lib/
│   │   │   │   ├── atlasRegions.ts     # Atlas coordinate definitions & HUD matrices
│   │   │   │   ├── batchOperations.ts  # Multi-texture batch utilities
│   │   │   │   ├── packAnalyzer.ts     # Pack statistics & health auditing
│   │   │   │   ├── packLibrary.ts      # IndexedDB local storage engine
│   │   │   │   ├── textureEditor.ts    # Pixel canvas drawing & color math
│   │   │   │   ├── texturePreview.ts   # 2D thumbnail crop generator
│   │   │   │   └── zipUtils.ts         # ZIP unpacking, virtual FS, and export
│   │   │   ├── pages/                  # Landing, Editor, Library, Contact pages
│   │   │   ├── types.ts                # TypeScript domain models
│   │   │   └── EditorApp.tsx           # Core editor workspace component
│   │   └── vite.config.ts
│   └── api-server/                     # Optional Express API backend service
├── lib/                                # Shared packages (db, API specs, schemas)
├── package.json                        # Monorepo root configuration
└── pnpm-workspace.yaml                 # pnpm workspace definition
```

---

## 🛠️ Tech Stack

| Category | Technology |
| :--- | :--- |
| **Frontend Framework** | [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| **Build Tool & Bundler**| [Vite 5](https://vitejs.dev/) |
| **Styling & Icons** | [Tailwind CSS](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/) + [Lucide Icons](https://lucide.dev/) |
| **3D Rendering** | [Three.js](https://threejs.org/) |
| **Archive / ZIP Processing** | [JSZip](https://stuk.github.io/jszip/) |
| **Animations** | [Framer Motion](https://www.framer.com/motion/) |
| **Client Storage** | [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) + `localStorage` |
| **Routing** | [Wouter](https://github.com/molefrog/wouter) |
| **Package Manager** | [pnpm](https://pnpm.io/) Monorepo |

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18 or higher recommended)
- [pnpm](https://pnpm.io/) (version 8 or higher)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/solarixmc-dev/MC-Resource-Pack-Editor.git
   cd MC-Resource-Pack-Editor
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Start the development server:**
   ```bash
   pnpm --filter @workspace/mc-pack-editor run dev
   ```

4. Open your browser and navigate to `http://localhost:5173`.

### Available Scripts

- `pnpm --filter @workspace/mc-pack-editor run dev` — Start the frontend in development mode with HMR.
- `pnpm --filter @workspace/mc-pack-editor run build` — Build the frontend application for production.
- `pnpm --filter @workspace/mc-pack-editor run serve` — Preview the production build locally.
- `pnpm run typecheck` — Run TypeScript typecheck across workspace packages.

---

## 📜 License

This project is licensed under the [MIT License](LICENSE).
