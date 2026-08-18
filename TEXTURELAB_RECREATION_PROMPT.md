# TextureLab - Minecraft Resource Pack Editor Recreation Prompt

Create a complete Minecraft Resource Pack Editor web application called "TextureLab" with the following specifications:

## Core Features

### 1. Launch Page
- Hero section with large "TextureLab" branding (black/white dark theme logo with "MC" in a box)
- Subtitle: "The ultimate Minecraft Texture Editor"
- "Get Started" button linking to editor
- Decorative geometric shapes (circles, squares, triangles) spinning slowly in background
- Full-screen feature sections for each capability:
  - Texture Editor
  - Pack Management  
  - Local Library
  - Texture Atlas Support
  - Create from Scratch
- Each feature section has video background (or animated gradient fallback) with icon, title, and description
- Smooth scroll with scroll arrow indicator
- Intersection observer for fade-in animations as sections enter viewport

### 2. Main Editor
**File Management:**
- Drag & drop ZIP file import for resource packs
- "Create from Scratch" option with overlay toggle for any pack
- Multiple pack support with overlay capability
- Folder tree navigation (blocks, items, entities, environment, etc.)
- Texture preview thumbnails in file browser
- Pack analysis showing version range, file count, total size, texture count, resolution

**Texture Editing:**
- Canvas-based texture editor with pixel-perfect editing
- Brush tools with adjustable size
- Color picker
- Recolor/tinting functionality with color code support
- Eraser tool
- Pan and zoom on canvas
- Side-by-side comparison with original texture
- Support for PNG texture files

**Pack Management:**
- Merge multiple resource packs
- Custom pack metadata (name, description, icon)
- Pack export as ZIP file
- Texture override system
- Folder source management
- Layout modes for different viewing options

**Texture Atlas Support:**
- Atlas region detection and cropping
- Individual texture extraction from atlases
- Atlas composition from individual textures
- Visual atlas preview with region highlighting
- Support for all Minecraft atlas regions:
  - **Icons Atlas:** Hearts, armor bars, hunger, air bubbles, horse jump bar, boss bar, experience bar, hotbar slots, creative inventory tabs
  - **Mob Effects:** Potion icons, status effects
  - **Particle Textures:** Various particle effects
  - **Enchantments:** Enchantment glint textures
  - **Paintings:** All painting textures
  - **GUI Elements:** Buttons, slots, backgrounds
  - **Map Icons:** Map marker textures

### 3. Local Library
- Save exported packs locally using IndexedDB
- Pack thumbnail previews
- Pack metadata display (name, description, size, date)
- Load saved packs back into editor
- Delete saved packs
- Fallback to localStorage for non-logged-in users

### 4. Color Code Support
- Full Minecraft formatting codes (§0-§f for colors, §l for bold, §o for italic, §n for underline, §m for strikethrough, §k for obfuscated, §r for reset)
- Color code picker with visual color swatches
- Style code buttons
- Live preview of formatted text
- Strip color codes option

### 5. Texture Preview Modal
- Generate preview loadouts with key items
- Show textures in context (items, blocks)
- 3D item preview using Three.js with spin interaction
- Grid layout for multiple items
- Various item categories (tools, blocks, food, etc.)

### 6. Additional Advanced Features
**Texture History:**
- Full undo/redo stack for texture edits
- History panel showing edit timeline
- Branch history for experimental edits
- Export/import edit history

**Batch Operations:**
- Apply same edit to multiple textures
- Bulk resize operations
- Batch color adjustments
- Mass file renaming

**Animation Preview:**
- Preview animated textures (fire, water, lava, portal)
- Frame-by-frame animation editing
- Animation timeline control
- Export animation sheets

**Model Integration:**
- View textures on 3D block models
- Apply textures to custom models
- Model viewer with rotation/zoom
- Export textured models

**Pack Comparison:**
- Side-by-side pack comparison
- Visual diff for textures
- Merge conflict resolution
- Version history comparison

## Technical Architecture

### Technology Stack
- **Frontend Framework:** React 18 with TypeScript
- **Routing:** Wouter (lightweight router)
- **Styling:** Tailwind CSS with custom dark theme
- **State Management:** React hooks (useState, useEffect, useMemo, useCallback)
- **File Processing:** JSZip for ZIP file handling
- **3D Rendering:** Three.js for 3D item previews
- **Icons:** Lucide React
- **UI Components:** Radix UI primitives (dialogs, dropdowns, etc.)
- **Animations:** Framer Motion

### File Structure
```
src/
├── App.tsx                  # Main app component
├── AppRouter.tsx           # Routing configuration
├── EditorApp.tsx           # Main editor logic
├── types.ts               # TypeScript interfaces
├── index.css              # Global styles and animations
├── components/
│   ├── Navigation.tsx     # Top navigation bar
│   ├── PreviewModal.tsx   # Texture preview modal
│   ├── ProfileDropdown.tsx # User profile menu
│   └── [other UI components]
├── pages/
│   ├── LaunchPage.tsx     # Landing page
│   ├── EditorPage.tsx     # Editor page wrapper
│   └── LibraryPage.tsx    # Local library page
├── lib/
│   ├── packAnalyzer.ts    # Pack analysis logic
│   ├── zipUtils.ts        # ZIP file operations
│   ├── textureEditor.ts   # Canvas editing tools
│   ├── texturePreview.ts  # Thumbnail generation
│   ├── packLibrary.ts     # IndexedDB/localStorage management
│   ├── atlasRegions.ts    # Atlas definition handling
│   └── minecraftAtlases.ts # Minecraft-specific atlas region definitions
└── contexts/
    ├── ThemeContext.tsx   # Dark/light theme management
    └── AuthContext.tsx    # User authentication
```

### Key Interfaces
```typescript
interface Pack {
  id: string;
  name: string;
  file: ArrayBuffer;
  isOverlay: boolean;
  overlayTargetId?: string;
}

interface TextureOverrides {
  [texturePath: string]: {
    data: ArrayBuffer;
    sourcePackId: string;
  };
}

interface PackAnalysis {
  versionRange: string;
  totalFiles: number;
  totalSize: number;
  textureCount: number;
  resolution: string;
  packFormat?: number;
}

interface SavedPack {
  id: string;
  name: string;
  description: string;
  icon: string | null;
  packData: string; // base64
  createdAt: string;
  fileSize: number;
  userId: string;
}
```

## UI/UX Design

### Color Scheme
**Light Mode:**
- Primary: Black (#000000)
- Secondary: Slate grays (#64748b, #94a3b8, #cbd5e1)
- Accent: Sand color (#C2B280) - Minecraft-themed
- Background: White (#ffffff)
- Borders: Slate-200 (#e2e8f0)

**Dark Mode:**
- Primary: White (#ffffff)
- Secondary: Dark grays (#475569, #64748b, #94a3b8)
- Accent: Sand color (#C2B280)
- Background: Dark gray (#1a1a1a)
- Borders: Dark border color (#334155)

### Typography
- Headings: Montserrat (600-700 weight)
- Body: Inter (400-500 weight)
- Monospace: JetBrains Mono (for file paths, code)
- Special: VT323 (for Minecraft-style text)

### Components
- **Cards:** Rounded corners (xl), subtle borders, hover effects
- **Buttons:** Rounded-full for primary actions, rounded-lg for secondary
- **Inputs:** Rounded-lg with focus rings
- **Modals:** Centered, backdrop blur, smooth animations
- **Navigation:** Sticky top, glass effect in dark mode

### Animations
- Smooth transitions (300-500ms)
- Fade-in on scroll
- Hover scale effects
- Loading spinners
- Toast notifications for success/error states

## Key Functionality Details

### Pack Analysis
- Parse pack.mcmeta for version detection using pack_format
- Count total files and calculate total size
- Detect texture resolution (16x, 32x, 64x, etc.)
- Identify Minecraft version range based on pack_format
- Provide basic analysis even if full analysis fails

### Texture Editor
- Canvas-based editing with getImageData/putImageData
- Brush tool with size adjustment (1-20px)
- Color picker with hex input
- Recolor tool with HSV color space manipulation
- Eraser with transparency support
- Undo/redo functionality
- Zoom (50%-400%) with smooth transitions
- Pan with middle mouse or space+drag

### ZIP Operations
- Load ZIP files and extract structure
- Navigate folder hierarchy
- Read individual texture files
- Compose merged ZIP from multiple sources
- Handle pack.mcmeta metadata
- Support overlay packs (modify existing packs)

### IndexedDB Library
- Database: "TextureLabLibrary"
- Store: "packs" with indexes on userId and createdAt
- Automatic size management and cleanup
- Fallback to localStorage for smaller packs (<2MB)
- Support for guest users (userId: 'guest')

### Color Code System
- Parse Minecraft formatting codes (§0-§f, §l-o, §r)
- Convert to CSS colors and styles
- Visual color picker with all 16 Minecraft colors
- Style toggles (bold, italic, underline, strikethrough)
- Live preview in Minecraft-style font
- Strip codes for plain text output

### Minecraft Atlas Regions
Complete support for all Minecraft texture atlases:

**Icons Atlas (gui/icons.png):**
- Health hearts (full, half, empty, various colors)
- Armor bars (helmets, chestplates, leggings, boots)
- Hunger icons (full, half, empty, various saturation levels)
- Air bubbles (water breathing)
- Horse jump bar
- Boss health bars (ender dragon, wither)
- Experience bar
- Hotbar slots (selected, unselected)
- Creative inventory tabs
- Effect backgrounds
- Status effect icons

**Particle Atlas (textures/particle/particles.png):**
- All particle textures (smoke, flame, lava drip, water drip, etc.)
- Breaking particles for each block type
- Critical hit particles
- Magic particles

**Enchantments:**
- Enchantment glint overlay
- Enchantment table book textures

**Paintings Atlas (textures/painting/paintings_krz.png):**
- All 26 painting textures
- Proper aspect ratio preservation

**GUI Elements:**
- Button textures (normal, hovered, disabled)
- Inventory slot backgrounds
- Progress bars (furnace, brewing, enchanting)
- Book textures
- Map backgrounds

**Map Icons (textures/map/map_icons.png):**
- Player marker
- Frame markers
- Banner patterns
- Various map icons

## Responsive Design
- Mobile-first approach
- Collapsible sidebar on smaller screens
- Touch-friendly controls
- Responsive grid layouts
- Optimized for tablets and desktops

## Performance Considerations
- Lazy loading of heavy components
- Thumbnail generation for texture previews
- Virtual scrolling for large file lists
- Debounced search and filtering
- Efficient canvas operations
- Web Workers for heavy processing (optional)

## Browser Compatibility
- Modern browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- ES2020+ JavaScript support
- Canvas API support
- IndexedDB support
- File API support

## Security Considerations
- Client-side only (no backend required)
- Local file processing only
- No external API calls
- Safe handling of user-uploaded files
- XSS prevention in text rendering

## Additional Notes
- The application should work completely offline after initial load
- No authentication required for basic functionality
- Optional user authentication for cloud storage (implement placeholder)
- Support for drag and drop throughout the interface
- Keyboard shortcuts for common actions
- Export functionality preserves all pack metadata
- Import supports both standard and overlay packs

This is a comprehensive specification for recreating TextureLab. Focus on the core editing functionality first, then add the library and advanced features. The UI should feel polished and modern while maintaining the Minecraft aesthetic with the sand accent color and geometric decorative elements.