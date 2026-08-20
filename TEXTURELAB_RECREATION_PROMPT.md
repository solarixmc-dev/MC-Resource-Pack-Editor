# TextureLab - Minecraft Resource Pack Editor Recreation Prompt

Create a complete Minecraft Resource Pack Editor web application called "TextureLab" with the following specifications:

## Core Features

### 1. Launch Page
- Hero section with large "TextureLab" branding (black/white dark theme logo with "MC" in a box)
- Subtitle: "The ultimate Minecraft Texture Editor"
- "Get Started" button with cursor-following radial gradient effect
  - Light mode: Gradient from #666666 to #000000 following cursor
  - Dark mode: Gradient from #ffffff to #cccccc following cursor
  - Resets to center when mouse leaves button
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
- Texture preview thumbnails in file browser with checkerboard transparency
- Pack analysis showing version range, file count, total size, texture count, resolution
- Atlas region override system for icons.png, widgets.png, inventory.png

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

### 4. Contact Page
- Contact form in horizontal navigation menu
- User input fields for name, email, message
- Username selection for identification
- Form submission to solarixmc@gmail.com
- Form validation and error handling
- Success notification after submission

### 5. Color Code Support
- Full Minecraft formatting codes (§0-§f for colors, §l for bold, §o for italic, §n for underline, §m for strikethrough, §k for obfuscated, §r for reset)
- Color code picker with visual color swatches
- Style code buttons
- Live preview of formatted text
- Strip color codes option

### 6. Texture Preview Modal
- Generate preview loadouts with key items
- Show textures in context (items, blocks)
- 3D item preview using Three.js with spin interaction
- Grid layout for multiple items
- Various item categories (tools, blocks, food, etc.)
- Checkerboard background for transparency visualization

### 6. Atlas Region Override System
**Advanced texture atlas management:**
- Per-region pack selection for atlas textures
- Live composite preview showing merged atlas result
- HUD preview for individual regions with checkerboard background
- Visual region highlighting and coordinate display
- Support for mapped regions (e.g., hardcore hearts mapping to normal hearts)
- Automatic composition of overridden regions onto base atlas
- Zoom modal for detailed atlas inspection with checkerboard background

**Atlas Region Logic (Minecraft 1.8.8 Compatible):**

**Inventory.png Potion Effects (Minecraft 1.8.8 Potion.java mapping):**
- Uses `setIconIndex(x, y)` where `statusIconIndex = x + y * 8`
- Coordinate system: 8 columns per row, rows at y=198, y=216, y=234
- Effect coordinates are NOT sequential - must match exact Potion.java setIconIndex values
- Instant Health, Instant Damage, and Saturation have NO status icons (statusIconIndex = -1)
- Absorption uses the SAME icon as Health Boost at (36,234)
- Correct mapping:
  - Row 1 (y=198): Speed(0), Slowness(18), Haste(36), Mining Fatigue(54), Strength(72), Weakness(90), Poison(108), Regeneration(126)
  - Row 2 (y=216): Invisibility(0), Hunger(18), Jump Boost(36), Nausea(54), Night Vision(72), Blindness(90), Resistance(108), Fire Resistance(126)
  - Row 3 (y=234): Water Breathing(0), Wither(18), Health Boost(36)
- All regions are 18x18 pixels
- Renderer calculates: x = (statusIconIndex % 8) * 18, y = 198 + floor(statusIconIndex / 8) * 18

**Icons.png Atlas Regions:**
- Hearts: Empty, Full, Half, Damage variants, Poison, Wither, Absorption
- Armor: Empty, Half, Full, Damage variants
- Hunger: Empty, Full, Half, Damage variants, Saturation variants
- Air bubbles: Burst, Bubble, Filled
- Horse jump bar: Empty (y=84), Full (y=89)
- XP bar: Empty (y=64), Full (y=69)
- Boss health: Empty (y=76), Full (y=81)
- Network/signal bars: 5 bars, 4 bars, 3 bars, 2 bars, 1 bar, no connection
- Hardcore hearts with mapping to regular hearts

**Widgets.png Atlas Regions:**
- Hotbar container, Active selector
- Button states: Disabled, Normal, Hover
- Slot backgrounds: Regular and Large
- Progress bars: Background and Fill
- Enchantment books: Left and Right pages
- Map background

**Atlas Override Implementation:**
- Detect atlas textures using `getAtlasDefinition(path)`
- Extract individual regions using `cropAtlasRegion()`
- Compose merged atlas using `composeAtlas()` with region patches
- Handle mapped regions (regions that reference other regions)
- Generate live preview URLs for both individual regions and composed atlas
- Support for multiple packs with per-region override selection
- Visual feedback showing which regions have overrides applied

### 7. Contact Page
- Contact form accessible from navigation menu
- User input fields for:
  - Username (required)
  - Email address (optional)
  - Message content (required)
- Form validation and error handling
- Email integration to send messages to solarixmc@gmail.com
- Success/error feedback notifications
- Responsive form design matching app theme
- Dark mode support for form elements

### 8. Additional Advanced Features
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
│   ├── LibraryPage.tsx    # Local library page
│   ├── ContactPage.tsx    # Contact form page
│   └── AuthPage.tsx       # Authentication page
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

interface AtlasRegion {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  description?: string;
  mapsTo?: string; // For regions that should map to another region
}

interface AtlasDefinition {
  pathSuffix: string;
  label: string;
  regions: AtlasRegion[];
}

interface ContactFormData {
  username: string;
  email?: string;
  message: string;
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
- Cursor-following gradient effect on primary buttons (radial gradient follows mouse position)
- Slowly rotating geometric shapes (circles, squares, triangles) on launch page
- Dark mode-specific checkerboard patterns for transparency visualization

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
Complete support for all Minecraft texture atlases with coordinate-precise region definitions:

**Icons Atlas (gui/icons.png) - Precise Coordinates:**
- Health hearts (full, half, empty, various colors):
  - Row 1 (y=0): Empty(16,0), Empty Flash(25,0), Full(52,0), Half(61,0), Damage Full(70,0), Damage Half(79,0)
  - Poison hearts: Full(88,0), Half(97,0)
  - Wither hearts: Full(106,0), Half(115,0)
  - Absorption hearts: Full(124,0), Half(133,0)
- Armor bars (y=9): Empty(16,9), Half(25,9), Full(34,9), Damage Half(43,9), Damage Full(52,9)
- Air bubbles (y=18): Burst(16,18), Bubble(25,18), Filled(34,18)
- Hunger icons (y=27): Empty(16,27), Half(61,27), Full(52,27), Damage Half(70,27), Damage Full(79,27)
  - Saturation variants: Full(34,27), Half(43,27)
- Hardcore hearts (y=45) with mapping to regular hearts
- Horse jump bar: Empty(0,84), Full(0,89) - both 182x5px
- XP bar: Empty(0,64), Full(0,69) - both 182x5px
- Boss health: Empty(0,76), Full(0,81) - both 182x5px
- Network/signal bars (y=176-216): 5 bars(0,176), 4 bars(0,184), 3 bars(0,192), 2 bars(0,200), 1 bar(0,208), no connection(0,216) - all 18x8px

**Inventory Atlas (gui/container/inventory.png) - Minecraft 1.8.8 Potion Effect Coordinates:**
- Uses `setIconIndex(x, y)` where `statusIconIndex = x + y * 8`
- NOT sequential coordinates - must match exact Potion.java values
- Instant Health, Instant Damage, Saturation have NO icons (statusIconIndex = -1)
- Absorption shares icon with Health Boost at (36,234)
- Exact coordinate mapping:
  - Row 1 (y=198): Speed(0,198), Slowness(18,198), Haste(36,198), Mining Fatigue(54,198), Strength(72,198), Weakness(90,198), Poison(108,198), Regeneration(126,198)
  - Row 2 (y=216): Invisibility(0,216), Hunger(18,216), Jump Boost(36,216), Nausea(54,216), Night Vision(72,216), Blindness(90,216), Resistance(108,216), Fire Resistance(126,216)
  - Row 3 (y=234): Water Breathing(0,234), Wither(18,234), Health Boost(36,234)
- All regions are 18x18 pixels
- Renderer calculates: x = (statusIconIndex % 8) * 18, y = 198 + floor(statusIconIndex / 8) * 18

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

**Widgets Atlas (gui/widgets.png) - Precise Coordinates:**
- Hotbar container: (0,0) 182x22px
- Active selector: (0,22) 24x24px
- Button states (y=46): Disabled(0,46), Normal(0,66), Hover(0,86) - all 200x20px
- Slot backgrounds: Regular(0,106) 18x18px, Large(0,124) 26x26px
- Progress bars: Background(0,150), Fill(0,155) - both 182x5px
- Enchantment books: Left(0,160), Right(28,160) - both 28x30px
- Map background: (0,190) 128x128px

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

## Contact Page Email Integration
- Email service integration for sending contact form submissions
- Destination email: solarixmc@gmail.com
- Email content includes:
  - Username (from form)
  - Email address (if provided)
  - Message content
  - Timestamp
  - User agent/browser info (optional)
- Email format: Plain text or HTML formatted message
- Error handling for email service failures
- Rate limiting to prevent spam (optional)
- Success notification to user after email sent
- Fallback handling if email service is unavailable

## Additional Notes
- The application should work completely offline after initial load
- No authentication required for basic functionality
- Optional user authentication for cloud storage (implement placeholder)
- Support for drag and drop throughout the interface
- Keyboard shortcuts for common actions
- Export functionality preserves all pack metadata
- Import supports both standard and overlay packs
- Atlas region override system requires precise coordinate matching with Minecraft source code
- Transparency visualization using checkerboard patterns (light/dark variants)
- Cursor-following gradient effects on interactive elements for enhanced UX
- Atlas zoom modal with full-size texture inspection
- Live composite preview showing merged atlas results in real-time

This is a comprehensive specification for recreating TextureLab. Focus on the core editing functionality first, then add the library and advanced features. The UI should feel polished and modern while maintaining the Minecraft aesthetic with the sand accent color and geometric decorative elements.