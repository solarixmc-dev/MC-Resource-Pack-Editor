export interface AtlasRegion {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  description?: string;
  mapsTo?: string; // For regions that should map to another region (e.g., hardcore hearts)
}

export interface AtlasDefinition {
  pathSuffix: string;
  label: string;
  regions: AtlasRegion[];
}

// Regions are listed from largest to smallest so composition applies them
// in an order where smaller/more-specific regions win (applied last).
const ICONS_REGIONS: AtlasRegion[] = [
  { id: "crosshair", label: "Crosshair", x: 0, y: 0, w: 16, h: 16, description: "Center-screen crosshair" },
  // Hearts row 1 (y=0)
  { id: "heart_empty", label: "Heart (Empty)", x: 16, y: 0, w: 9, h: 9, description: "Empty heart icon" },
  { id: "heart_empty_flash", label: "Heart (Empty Flash)", x: 25, y: 0, w: 9, h: 9, description: "Flashing empty heart outline" },
  { id: "heart_full", label: "Heart (Full)", x: 52, y: 0, w: 9, h: 9, description: "Full heart icon" },
  { id: "heart_half", label: "Heart (Half)", x: 61, y: 0, w: 9, h: 9, description: "Half heart icon" },
  { id: "heart_full_damage", label: "Heart (Damage Full)", x: 70, y: 0, w: 9, h: 9, description: "Recently lost full heart overlay" },
  { id: "heart_half_damage", label: "Heart (Damage Half)", x: 79, y: 0, w: 9, h: 9, description: "Recently lost half heart overlay" },
  // Poison hearts
  { id: "heart_poison_full", label: "Heart (Poison Full)", x: 88, y: 0, w: 9, h: 9, description: "Poison full heart" },
  { id: "heart_poison_half", label: "Heart (Poison Half)", x: 97, y: 0, w: 9, h: 9, description: "Poison half heart" },
  // Wither hearts
  { id: "heart_wither_full", label: "Heart (Wither Full)", x: 106, y: 0, w: 9, h: 9, description: "Wither full heart" },
  { id: "heart_wither_half", label: "Heart (Wither Half)", x: 115, y: 0, w: 9, h: 9, description: "Wither half heart" },
  // Absorption hearts
  { id: "heart_absorption_full", label: "Heart (Absorption Full)", x: 124, y: 0, w: 9, h: 9, description: "Absorption full heart" },
  { id: "heart_absorption_half", label: "Heart (Absorption Half)", x: 133, y: 0, w: 9, h: 9, description: "Absorption half heart" },
  // Armor row (y=9)
  { id: "armor_empty", label: "Armor (Empty)", x: 16, y: 9, w: 9, h: 9, description: "Empty armor icon" },
  { id: "armor_half", label: "Armor (Half)", x: 25, y: 9, w: 9, h: 9, description: "Half armor icon" },
  { id: "armor_full", label: "Armor (Full)", x: 34, y: 9, w: 9, h: 9, description: "Full armor icon" },
  { id: "armor_half_damage", label: "Armor (Half Damage)", x: 43, y: 9, w: 9, h: 9, description: "Recently lost half armor" },
  { id: "armor_full_damage", label: "Armor (Full Damage)", x: 52, y: 9, w: 9, h: 9, description: "Recently lost full armor" },
  // Air bubbles (water breathing) - row 2 (y=18)
  { id: "air_burstand", label: "Air (Burst)", x: 16, y: 18, w: 7, h: 7, description: "Air bubble burst" },
  { id: "air_bubble", label: "Air (Bubble)", x: 25, y: 18, w: 7, h: 7, description: "Single air bubble" },
  { id: "air_filled", label: "Air (Filled)", x: 34, y: 18, w: 7, h: 7, description: "Filled air bubble" },
  // Hunger row (y=27)
  { id: "hunger_empty", label: "Hunger (Empty)", x: 16, y: 27, w: 9, h: 9, description: "Empty hunger icon" },
  { id: "hunger_half", label: "Hunger (Half)", x: 61, y: 27, w: 9, h: 9, description: "Half hunger icon" },
  { id: "hunger_full", label: "Hunger (Full)", x: 52, y: 27, w: 9, h: 9, description: "Full hunger icon" },
  { id: "hunger_half_damage", label: "Hunger (Half Damage)", x: 70, y: 27, w: 9, h: 9, description: "Recently lost half hunger" },
  { id: "hunger_full_damage", label: "Hunger (Full Damage)", x: 79, y: 27, w: 9, h: 9, description: "Recently lost full hunger" },
  // Saturation variants (row 27, different positions)
  { id: "hunger_full_saturation", label: "Hunger (Full Saturation)", x: 34, y: 27, w: 9, h: 9, description: "Full hunger with saturation" },
  { id: "hunger_half_saturation", label: "Hunger (Half Saturation)", x: 43, y: 27, w: 9, h: 9, description: "Half hunger with saturation" },
  // Hardcore hearts (separate row, will be mapped to regular hearts for overrides)
  { id: "heart_hardcore_empty", label: "Heart (Hardcore Empty)", x: 16, y: 45, w: 9, h: 9, description: "Hardcore mode empty heart", mapsTo: "heart_empty" },
  { id: "heart_hardcore_half", label: "Heart (Hardcore Half)", x: 61, y: 45, w: 9, h: 9, description: "Hardcore mode half heart", mapsTo: "heart_half" },
  { id: "heart_hardcore_full", label: "Heart (Hardcore Full)", x: 52, y: 45, w: 9, h: 9, description: "Hardcore mode full heart", mapsTo: "heart_full" },
  // Horse jump bar - correct coordinates (y=84, y=89)
  { id: "horse_jump_empty", label: "Horse Jump (Empty)", x: 0, y: 84, w: 182, h: 5, description: "Horse jump bar background" },
  { id: "horse_jump_full", label: "Horse Jump (Full)", x: 0, y: 89, w: 182, h: 5, description: "Horse jump bar fill" },
  // XP bar
  { id: "xp_bar_empty", label: "XP Bar (Empty)", x: 0, y: 64, w: 182, h: 5, description: "Experience bar background" },
  { id: "xp_bar_full", label: "XP Bar (Full)", x: 0, y: 69, w: 182, h: 5, description: "Experience bar fill" },
  // Boss health bars (only full and empty, no overlay)
  { id: "boss_health_empty", label: "Boss Health (Empty)", x: 0, y: 76, w: 182, h: 5, description: "Boss health bar background" },
  { id: "boss_health_full", label: "Boss Health (Full)", x: 0, y: 81, w: 182, h: 5, description: "Boss health bar fill" },
  // Network/signal bars (ping status indicators)
  { id: "signal_5_bars", label: "Signal (5 Bars)", x: 0, y: 176, w: 18, h: 8, description: "Full signal strength - 5 bars" },
  { id: "signal_4_bars", label: "Signal (4 Bars)", x: 0, y: 184, w: 18, h: 8, description: "Signal strength - 4 bars" },
  { id: "signal_3_bars", label: "Signal (3 Bars)", x: 0, y: 192, w: 18, h: 8, description: "Signal strength - 3 bars" },
  { id: "signal_2_bars", label: "Signal (2 Bars)", x: 0, y: 200, w: 18, h: 8, description: "Signal strength - 2 bars" },
  { id: "signal_1_bar", label: "Signal (1 Bar)", x: 0, y: 208, w: 18, h: 8, description: "High lag - 1 bar" },
  { id: "signal_no_connection", label: "Signal (No Connection)", x: 0, y: 216, w: 18, h: 8, description: "No connection - X icon" },
];

// Inventory regions for status effects (1.8 HUD effect icons)
// Mapping based on Minecraft 1.8.8 Potion.java setIconIndex(x, y) where statusIconIndex = x + y * 8
const INVENTORY_REGIONS: AtlasRegion[] = [
  // Row 1 (y=198) - 8 items
  { id: "inventory_effect_speed", label: "Inventory Effect (Speed)", x: 0, y: 198, w: 18, h: 18, description: "Speed effect icon in inventory" },
  { id: "inventory_effect_slowness", label: "Inventory Effect (Slowness)", x: 18, y: 198, w: 18, h: 18, description: "Slowness effect icon in inventory" },
  { id: "inventory_effect_haste", label: "Inventory Effect (Haste)", x: 36, y: 198, w: 18, h: 18, description: "Haste effect icon in inventory" },
  { id: "inventory_effect_mining_fatigue", label: "Inventory Effect (Mining Fatigue)", x: 54, y: 198, w: 18, h: 18, description: "Mining fatigue effect icon in inventory" },
  { id: "inventory_effect_strength", label: "Inventory Effect (Strength)", x: 72, y: 198, w: 18, h: 18, description: "Strength effect icon in inventory" },
  { id: "inventory_effect_weakness", label: "Inventory Effect (Weakness)", x: 90, y: 198, w: 18, h: 18, description: "Weakness effect icon in inventory" },
  { id: "inventory_effect_poison", label: "Inventory Effect (Poison)", x: 108, y: 198, w: 18, h: 18, description: "Poison effect icon in inventory" },
  { id: "inventory_effect_regeneration", label: "Inventory Effect (Regeneration)", x: 126, y: 198, w: 18, h: 18, description: "Regeneration effect icon in inventory" },
  // Row 2 (y=216) - 8 items
  { id: "inventory_effect_invisibility", label: "Inventory Effect (Invisibility)", x: 0, y: 216, w: 18, h: 18, description: "Invisibility effect icon in inventory" },
  { id: "inventory_effect_hunger", label: "Inventory Effect (Hunger)", x: 18, y: 216, w: 18, h: 18, description: "Hunger effect icon in inventory" },
  { id: "inventory_effect_jump_boost", label: "Inventory Effect (Jump Boost)", x: 36, y: 216, w: 18, h: 18, description: "Jump boost effect icon in inventory" },
  { id: "inventory_effect_nausea", label: "Inventory Effect (Nausea)", x: 54, y: 216, w: 18, h: 18, description: "Nausea effect icon in inventory" },
  { id: "inventory_effect_night_vision", label: "Inventory Effect (Night Vision)", x: 72, y: 216, w: 18, h: 18, description: "Night vision effect icon in inventory" },
  { id: "inventory_effect_blindness", label: "Inventory Effect (Blindness)", x: 90, y: 216, w: 18, h: 18, description: "Blindness effect icon in inventory" },
  { id: "inventory_effect_resistance", label: "Inventory Effect (Resistance)", x: 108, y: 216, w: 18, h: 18, description: "Resistance effect icon in inventory" },
  { id: "inventory_effect_fire_resistance", label: "Inventory Effect (Fire Resistance)", x: 126, y: 216, w: 18, h: 18, description: "Fire resistance effect icon in inventory" },
  // Row 3 (y=234) - 3 items
  { id: "inventory_effect_water_breathing", label: "Inventory Effect (Water Breathing)", x: 0, y: 234, w: 18, h: 18, description: "Water breathing effect icon in inventory" },
  { id: "inventory_effect_wither", label: "Inventory Effect (Wither)", x: 18, y: 234, w: 18, h: 18, description: "Wither effect icon in inventory" },
  { id: "inventory_effect_absorption", label: "Inventory Effect (Absorption)", x: 36, y: 234, w: 18, h: 18, description: "Absorption effect icon in inventory" },
];

const WIDGETS_REGIONS: AtlasRegion[] = [
  { id: "hotbar_container", label: "Hotbar Container", x: 0, y: 0, w: 182, h: 22, description: "Hotbar bar" },
  { id: "active_selector", label: "Active Selector", x: 0, y: 22, w: 24, h: 24, description: "Selected slot highlight" },
  { id: "button_disabled", label: "Button (Disabled)", x: 0, y: 46, w: 200, h: 20, description: "Disabled button row" },
  { id: "button_normal", label: "Button (Normal)", x: 0, y: 66, w: 200, h: 20, description: "Normal button row" },
  { id: "button_hover", label: "Button (Hover)", x: 0, y: 86, w: 200, h: 20, description: "Hover button row" },
  { id: "slot_background", label: "Slot Background", x: 0, y: 106, w: 18, h: 18, description: "Inventory slot background" },
  { id: "slot_background_large", label: "Slot Background (Large)", x: 0, y: 124, w: 26, h: 26, description: "Large inventory slot background" },
  { id: "progress_bar_background", label: "Progress Bar Background", x: 0, y: 150, w: 182, h: 5, description: "Progress bar background" },
  { id: "progress_bar_fill", label: "Progress Bar Fill", x: 0, y: 155, w: 182, h: 5, description: "Progress bar fill" },
  { id: "book_left", label: "Book (Left)", x: 0, y: 160, w: 28, h: 30, description: "Enchantment book left page" },
  { id: "book_right", label: "Book (Right)", x: 28, y: 160, w: 28, h: 30, description: "Enchantment book right page" },
  { id: "map_background", label: "Map Background", x: 0, y: 190, w: 128, h: 128, description: "Map background texture" },
];

// Particle atlas regions for Minecraft 1.8 particles.png (256x256, 16x16 grid)
// Coordinates calculated from particle texture index: x = index % 16 * 16, y = index / 16 * 16
const PARTICLE_REGIONS: AtlasRegion[] = [
  // Index 0 (x=0, y=0): Smoke, Aura, Suspend, Reddust, SnowShovel, Explode
  { id: "particle_smoke", label: "Particle (Smoke)", x: 0, y: 0, w: 16, h: 16, description: "Smoke particle" },
  { id: "particle_aura", label: "Particle (Aura)", x: 0, y: 0, w: 16, h: 16, description: "Aura particle" },
  { id: "particle_susp", label: "Particle (Suspend)", x: 0, y: 0, w: 16, h: 16, description: "Suspend particle" },
  { id: "particle_reddust", label: "Particle (Reddust)", x: 0, y: 0, w: 16, h: 16, description: "Reddust particle" },
  { id: "particle_explode", label: "Particle (Explode)", x: 0, y: 0, w: 16, h: 16, description: "Explosion particle" },
  // Index 1-7 (x=16-112, y=0): Portal, Cloud
  { id: "particle_portal", label: "Particle (Portal)", x: 16, y: 0, w: 16, h: 16, description: "Portal particle" },
  { id: "particle_cloud", label: "Particle (Cloud)", x: 32, y: 0, w: 16, h: 16, description: "Cloud particle" },
  { id: "particle_cloud2", label: "Particle (Cloud)", x: 48, y: 0, w: 16, h: 16, description: "Cloud particle" },
  { id: "particle_cloud3", label: "Particle (Cloud)", x: 64, y: 0, w: 16, h: 16, description: "Cloud particle" },
  { id: "particle_cloud4", label: "Particle (Cloud)", x: 80, y: 0, w: 16, h: 16, description: "Cloud particle" },
  { id: "particle_cloud5", label: "Particle (Cloud)", x: 96, y: 0, w: 16, h: 16, description: "Cloud particle" },
  { id: "particle_cloud6", label: "Particle (Cloud)", x: 112, y: 0, w: 16, h: 16, description: "Cloud particle" },
  // Index 19-22 (x=304-352, y=16): Rain, FishWake
  { id: "particle_rain", label: "Particle (Rain)", x: 304, y: 16, w: 16, h: 16, description: "Rain particle" },
  { id: "particle_rain2", label: "Particle (Rain)", x: 320, y: 16, w: 16, h: 16, description: "Rain particle" },
  { id: "particle_rain3", label: "Particle (Rain)", x: 336, y: 16, w: 16, h: 16, description: "Rain particle" },
  { id: "particle_wake", label: "Particle (Wake)", x: 352, y: 16, w: 16, h: 16, description: "Fish wake particle" },
  // Index 32 (x=0, y=32): Bubble
  { id: "particle_bubble", label: "Particle (Bubble)", x: 0, y: 32, w: 16, h: 16, description: "Bubble particle" },
  // Index 48 (x=0, y=48): Flame
  { id: "particle_flame", label: "Particle (Flame)", x: 0, y: 48, w: 16, h: 16, description: "Flame particle" },
  // Index 49 (x=16, y=48): Lava Drip
  { id: "particle_lava_drip", label: "Particle (Lava Drip)", x: 16, y: 48, w: 16, h: 16, description: "Lava drip particle" },
  // Index 64 (x=0, y=64): Note
  { id: "particle_note", label: "Particle (Note)", x: 0, y: 64, w: 16, h: 16, description: "Note block particle" },
  // Index 65 (x=16, y=64): Crit
  { id: "particle_crit", label: "Particle (Crit)", x: 16, y: 64, w: 16, h: 16, description: "Critical hit particle" },
  // Index 80 (x=0, y=80): Heart
  { id: "particle_heart", label: "Particle (Heart)", x: 0, y: 80, w: 16, h: 16, description: "Heart particle" },
  // Index 81 (x=16, y=80): Angry Villager
  { id: "particle_angry_villager", label: "Particle (Angry Villager)", x: 16, y: 80, w: 16, h: 16, description: "Angry villager particle" },
  // Index 82 (x=32, y=80): Happy Villager
  { id: "particle_happy_villager", label: "Particle (Happy Villager)", x: 32, y: 80, w: 16, h: 16, description: "Happy villager particle" },
  // Index 112, 113 (x=0, 112): Drop
  { id: "particle_drop", label: "Particle (Drop)", x: 0, y: 112, w: 16, h: 16, description: "Drop particle" },
  { id: "particle_drop2", label: "Particle (Drop)", x: 16, y: 112, w: 16, h: 16, description: "Drop particle" },
  // Index 128-135 (x=0-112, y=128): Spell (8 items)
  { id: "particle_spell", label: "Particle (Spell)", x: 0, y: 128, w: 16, h: 16, description: "Spell particle" },
  { id: "particle_spell2", label: "Particle (Spell)", x: 16, y: 128, w: 16, h: 16, description: "Spell particle" },
  { id: "particle_spell3", label: "Particle (Spell)", x: 32, y: 128, w: 16, h: 16, description: "Spell particle" },
  { id: "particle_spell4", label: "Particle (Spell)", x: 48, y: 128, w: 16, h: 16, description: "Spell particle" },
  { id: "particle_spell5", label: "Particle (Spell)", x: 64, y: 128, w: 16, h: 16, description: "Spell particle" },
  { id: "particle_spell6", label: "Particle (Spell)", x: 80, y: 128, w: 16, h: 16, description: "Spell particle" },
  { id: "particle_spell7", label: "Particle (Spell)", x: 96, y: 128, w: 16, h: 16, description: "Spell particle" },
  { id: "particle_spell8", label: "Particle (Spell)", x: 112, y: 128, w: 16, h: 16, description: "Spell particle" },
  // Index 144 (x=0, y=144): Instant Spell (Witch)
  { id: "particle_instant_spell", label: "Particle (Instant Spell)", x: 0, y: 144, w: 16, h: 16, description: "Instant spell particle" },
  // Index 160-167 (x=0-112, y=160): Fireworks (8 items)
  { id: "particle_firework", label: "Particle (Firework)", x: 0, y: 160, w: 16, h: 16, description: "Firework particle" },
  { id: "particle_firework2", label: "Particle (Firework)", x: 16, y: 160, w: 16, h: 16, description: "Firework particle" },
  { id: "particle_firework3", label: "Particle (Firework)", x: 32, y: 160, w: 16, h: 16, description: "Firework particle" },
  { id: "particle_firework4", label: "Particle (Firework)", x: 48, y: 160, w: 16, h: 16, description: "Firework particle" },
  { id: "particle_firework5", label: "Particle (Firework)", x: 64, y: 160, w: 16, h: 16, description: "Firework particle" },
  { id: "particle_firework6", label: "Particle (Firework)", x: 80, y: 160, w: 16, h: 16, description: "Firework particle" },
  { id: "particle_firework7", label: "Particle (Firework)", x: 96, y: 160, w: 16, h: 16, description: "Firework particle" },
  { id: "particle_firework8", label: "Particle (Firework)", x: 112, y: 160, w: 16, h: 16, description: "Firework particle" },
  // Index 225-250 (x=0-400, y=225): Enchanting Table (26 items)
  { id: "particle_enchant", label: "Particle (Enchant)", x: 0, y: 225, w: 16, h: 16, description: "Enchantment particle" },
  { id: "particle_enchant2", label: "Particle (Enchant)", x: 16, y: 225, w: 16, h: 16, description: "Enchantment particle" },
  { id: "particle_enchant3", label: "Particle (Enchant)", x: 32, y: 225, w: 16, h: 16, description: "Enchantment particle" },
  { id: "particle_enchant4", label: "Particle (Enchant)", x: 48, y: 225, w: 16, h: 16, description: "Enchantment particle" },
  { id: "particle_enchant5", label: "Particle (Enchant)", x: 64, y: 225, w: 16, h: 16, description: "Enchantment particle" },
  { id: "particle_enchant6", label: "Particle (Enchant)", x: 80, y: 225, w: 16, h: 16, description: "Enchantment particle" },
  { id: "particle_enchant7", label: "Particle (Enchant)", x: 96, y: 225, w: 16, h: 16, description: "Enchantment particle" },
  { id: "particle_enchant8", label: "Particle (Enchant)", x: 112, y: 225, w: 16, h: 16, description: "Enchantment particle" },
  { id: "particle_enchant9", label: "Particle (Enchant)", x: 128, y: 225, w: 16, h: 16, description: "Enchantment particle" },
  { id: "particle_enchant10", label: "Particle (Enchant)", x: 144, y: 225, w: 16, h: 16, description: "Enchantment particle" },
  { id: "particle_enchant11", label: "Particle (Enchant)", x: 160, y: 225, w: 16, h: 16, description: "Enchantment particle" },
  { id: "particle_enchant12", label: "Particle (Enchant)", x: 176, y: 225, w: 16, h: 16, description: "Enchantment particle" },
  { id: "particle_enchant13", label: "Particle (Enchant)", x: 192, y: 225, w: 16, h: 16, description: "Enchantment particle" },
  { id: "particle_enchant14", label: "Particle (Enchant)", x: 208, y: 225, w: 16, h: 16, description: "Enchantment particle" },
  { id: "particle_enchant15", label: "Particle (Enchant)", x: 224, y: 225, w: 16, h: 16, description: "Enchantment particle" },
  { id: "particle_enchant16", label: "Particle (Enchant)", x: 240, y: 225, w: 16, h: 16, description: "Enchantment particle" },
  { id: "particle_enchant17", label: "Particle (Enchant)", x: 256, y: 225, w: 16, h: 16, description: "Enchantment particle" },
  { id: "particle_enchant18", label: "Particle (Enchant)", x: 272, y: 225, w: 16, h: 16, description: "Enchantment particle" },
  { id: "particle_enchant19", label: "Particle (Enchant)", x: 288, y: 225, w: 16, h: 16, description: "Enchantment particle" },
  { id: "particle_enchant20", label: "Particle (Enchant)", x: 304, y: 225, w: 16, h: 16, description: "Enchantment particle" },
  { id: "particle_enchant21", label: "Particle (Enchant)", x: 320, y: 225, w: 16, h: 16, description: "Enchantment particle" },
  { id: "particle_enchant22", label: "Particle (Enchant)", x: 336, y: 225, w: 16, h: 16, description: "Enchantment particle" },
  { id: "particle_enchant23", label: "Particle (Enchant)", x: 352, y: 225, w: 16, h: 16, description: "Enchantment particle" },
  { id: "particle_enchant24", label: "Particle (Enchant)", x: 368, y: 225, w: 16, h: 16, description: "Enchantment particle" },
  { id: "particle_enchant25", label: "Particle (Enchant)", x: 384, y: 225, w: 16, h: 16, description: "Enchantment particle" },
  { id: "particle_enchant26", label: "Particle (Enchant)", x: 400, y: 225, w: 16, h: 16, description: "Enchantment particle" },
];

// Painting atlas regions (26 paintings)
const PAINTING_REGIONS: AtlasRegion[] = [
  { id: "painting_kebab", label: "Painting (Kebab)", x: 0, y: 0, w: 16, h: 16, description: "Kebab painting" },
  { id: "painting_aztec", label: "Painting (Aztec)", x: 16, y: 0, w: 16, h: 16, description: "Aztec painting" },
  { id: "painting_alban", label: "Painting (Alban)", x: 32, y: 0, w: 16, h: 16, description: "Alban painting" },
  { id: "painting_aztec2", label: "Painting (Aztec 2)", x: 48, y: 0, w: 16, h: 16, description: "Aztec 2 painting" },
  { id: "painting_bomb", label: "Painting (Bomb)", x: 64, y: 0, w: 16, h: 16, description: "Bomb painting" },
  { id: "painting_plant", label: "Painting (Plant)", x: 80, y: 0, w: 16, h: 16, description: "Plant painting" },
  { id: "painting_wasteland", label: "Painting (Wasteland)", x: 96, y: 0, w: 16, h: 16, description: "Wasteland painting" },
  { id: "painting_wanderer", label: "Painting (Wanderer)", x: 112, y: 0, w: 16, h: 16, description: "Wanderer painting" },
  { id: "painting_graham", label: "Painting (Graham)", x: 128, y: 0, w: 16, h: 16, description: "Graham painting" },
  { id: "painting_courbet", label: "Painting (Courbet)", x: 0, y: 16, w: 32, h: 16, description: "Courbet painting" },
  { id: "painting_pool", label: "Painting (Pool)", x: 32, y: 16, w: 32, h: 16, description: "Pool painting" },
  { id: "painting_sea", label: "Painting (Sea)", x: 64, y: 16, w: 32, h: 16, description: "Sea painting" },
  { id: "painting_creebet", label: "Painting (Creebet)", x: 96, y: 16, w: 32, h: 16, description: "Creebet painting" },
  { id: "painting_sunset", label: "Painting (Sunset)", x: 128, y: 16, w: 32, h: 16, description: "Sunset painting" },
  { id: "painting_match", label: "Painting (Match)", x: 0, y: 32, w: 32, h: 32, description: "Match painting" },
  { id: "painting_bust", label: "Painting (Bust)", x: 32, y: 32, w: 32, h: 32, description: "Bust painting" },
  { id: "painting_stage", label: "Painting (Stage)", x: 64, y: 32, w: 32, h: 32, description: "Stage painting" },
  { id: "painting_void", label: "Painting (Void)", x: 96, y: 32, w: 32, h: 32, description: "Void painting" },
  { id: "painting_skull_and_roses", label: "Painting (Skull and Roses)", x: 128, y: 32, w: 32, h: 32, description: "Skull and Roses painting" },
  { id: "painting_wither", label: "Painting (Wither)", x: 0, y: 64, w: 64, h: 32, description: "Wither painting" },
  { id: "painting_fighters", label: "Painting (Fighters)", x: 64, y: 64, w: 64, h: 32, description: "Fighters painting" },
  { id: "painting_pointer", label: "Painting (Pointer)", x: 0, y: 96, w: 64, h: 64, description: "Pointer painting" },
  { id: "painting_pigscene", label: "Painting (Pigscene)", x: 64, y: 96, w: 64, h: 64, description: "Pigscene painting" },
  { id: "painting_burning_skull", label: "Painting (Burning Skull)", x: 0, y: 160, w: 64, h: 64, description: "Burning Skull painting" },
  { id: "painting_skull_on_fire", label: "Painting (Skull on Fire)", x: 64, y: 160, w: 64, h: 64, description: "Skull on Fire painting" },
  { id: "painting_donkey_kong", label: "Painting (Donkey Kong)", x: 0, y: 224, w: 64, h: 64, description: "Donkey Kong painting" },
];

// Map icons atlas regions
const MAP_ICONS_REGIONS: AtlasRegion[] = [
  { id: "map_player", label: "Map Icon (Player)", x: 0, y: 0, w: 8, h: 8, description: "Player marker on map" },
  { id: "map_frame", label: "Map Icon (Frame)", x: 8, y: 0, w: 8, h: 8, description: "Item frame marker on map" },
  { id: "map_banner_white", label: "Map Icon (Banner White)", x: 16, y: 0, w: 8, h: 8, description: "White banner marker" },
  { id: "map_banner_orange", label: "Map Icon (Banner Orange)", x: 24, y: 0, w: 8, h: 8, description: "Orange banner marker" },
  { id: "map_banner_magenta", label: "Map Icon (Banner Magenta)", x: 32, y: 0, w: 8, h: 8, description: "Magenta banner marker" },
  { id: "map_banner_light_blue", label: "Map Icon (Banner Light Blue)", x: 40, y: 0, w: 8, h: 8, description: "Light blue banner marker" },
  { id: "map_banner_yellow", label: "Map Icon (Banner Yellow)", x: 48, y: 0, w: 8, h: 8, description: "Yellow banner marker" },
  { id: "map_banner_lime", label: "Map Icon (Banner Lime)", x: 56, y: 0, w: 8, h: 8, description: "Lime banner marker" },
  { id: "map_banner_pink", label: "Map Icon (Banner Pink)", x: 64, y: 0, w: 8, h: 8, description: "Pink banner marker" },
  { id: "map_banner_gray", label: "Map Icon (Banner Gray)", x: 72, y: 0, w: 8, h: 8, description: "Gray banner marker" },
  { id: "map_banner_light_gray", label: "Map Icon (Banner Light Gray)", x: 80, y: 0, w: 8, h: 8, description: "Light gray banner marker" },
  { id: "map_banner_cyan", label: "Map Icon (Banner Cyan)", x: 88, y: 0, w: 8, h: 8, description: "Cyan banner marker" },
  { id: "map_banner_purple", label: "Map Icon (Banner Purple)", x: 96, y: 0, w: 8, h: 8, description: "Purple banner marker" },
  { id: "map_banner_blue", label: "Map Icon (Banner Blue)", x: 104, y: 0, w: 8, h: 8, description: "Blue banner marker" },
  { id: "map_banner_brown", label: "Map Icon (Banner Brown)", x: 112, y: 0, w: 8, h: 8, description: "Brown banner marker" },
  { id: "map_banner_green", label: "Map Icon (Banner Green)", x: 120, y: 0, w: 8, h: 8, description: "Green banner marker" },
  { id: "map_banner_red", label: "Map Icon (Banner Red)", x: 128, y: 0, w: 8, h: 8, description: "Red banner marker" },
  { id: "map_banner_black", label: "Map Icon (Banner Black)", x: 136, y: 0, w: 8, h: 8, description: "Black banner marker" },
  { id: "map_target_point", label: "Map Icon (Target Point)", x: 144, y: 0, w: 8, h: 8, description: "Target point marker" },
  { id: "map_target_x", label: "Map Icon (Target X)", x: 152, y: 0, w: 8, h: 8, description: "Target X marker" },
  { id: "map_target_box", label: "Map Icon (Target Box)", x: 160, y: 0, w: 8, h: 8, description: "Target box marker" },
];

export const ATLAS_DEFINITIONS: AtlasDefinition[] = [
  { pathSuffix: "gui/icons.png", label: "HUD Icons Atlas", regions: ICONS_REGIONS },
  { pathSuffix: "textures/gui/icons.png", label: "HUD Icons Atlas", regions: ICONS_REGIONS },
  { pathSuffix: "gui/container/inventory.png", label: "Inventory Atlas", regions: INVENTORY_REGIONS },
  { pathSuffix: "textures/gui/container/inventory.png", label: "Inventory Atlas", regions: INVENTORY_REGIONS },
  { pathSuffix: "gui/widgets.png", label: "Widget Atlas", regions: WIDGETS_REGIONS },
  { pathSuffix: "textures/gui/widgets.png", label: "Widget Atlas", regions: WIDGETS_REGIONS },
  { pathSuffix: "textures/particle/particles.png", label: "Particle Atlas", regions: PARTICLE_REGIONS },
  { pathSuffix: "particle/particles.png", label: "Particle Atlas", regions: PARTICLE_REGIONS },
  { pathSuffix: "textures/painting/paintings_krz.png", label: "Paintings Atlas", regions: PAINTING_REGIONS },
  { pathSuffix: "painting/paintings_krz.png", label: "Paintings Atlas", regions: PAINTING_REGIONS },
  { pathSuffix: "textures/map/map_icons.png", label: "Map Icons Atlas", regions: MAP_ICONS_REGIONS },
  { pathSuffix: "map/map_icons.png", label: "Map Icons Atlas", regions: MAP_ICONS_REGIONS },
];

export function getAtlasDefinition(path: string): AtlasDefinition | undefined {
  const normalized = path.replace(/\\/g, "/").toLowerCase();
  return ATLAS_DEFINITIONS.find((def) => {
    const suffix = def.pathSuffix.replace(/\\/g, "/").toLowerCase();
    return normalized === suffix || normalized.endsWith(`/${suffix}`) || normalized.endsWith(suffix);
  });
}
