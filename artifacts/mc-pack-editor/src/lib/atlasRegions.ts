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
  // Absorption hearts (row 1, colored)
  { id: "heart_absorption_full", label: "Heart (Absorption Full)", x: 88, y: 0, w: 9, h: 9, description: "Absorption full heart" },
  { id: "heart_absorption_half", label: "Heart (Absorption Half)", x: 97, y: 0, w: 9, h: 9, description: "Absorption half heart" },
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
  // Horse jump bar - row 2 (y=18)
  { id: "horse_jump_empty", label: "Horse Jump (Empty)", x: 0, y: 18, w: 182, h: 5, description: "Horse jump bar background" },
  { id: "horse_jump_full", label: "Horse Jump (Full)", x: 0, y: 23, w: 182, h: 5, description: "Horse jump bar fill" },
  // XP bar
  { id: "xp_bar_empty", label: "XP Bar (Empty)", x: 0, y: 64, w: 182, h: 5, description: "Experience bar background" },
  { id: "xp_bar_full", label: "XP Bar (Full)", x: 0, y: 69, w: 182, h: 5, description: "Experience bar fill" },
  // Boss health bars (only full and empty, no overlay)
  { id: "boss_health_empty", label: "Boss Health (Empty)", x: 0, y: 76, w: 182, h: 5, description: "Boss health bar background" },
  { id: "boss_health_full", label: "Boss Health (Full)", x: 0, y: 81, w: 182, h: 5, description: "Boss health bar fill" },
];

// Inventory regions for status effects (1.8 HUD effect icons)
const INVENTORY_REGIONS: AtlasRegion[] = [
  { id: "inventory_effect_speed", label: "Inventory Effect (Speed)", x: 0, y: 0, w: 18, h: 18, description: "Speed effect icon in inventory" },
  { id: "inventory_effect_slowness", label: "Inventory Effect (Slowness)", x: 18, y: 0, w: 18, h: 18, description: "Slowness effect icon in inventory" },
  { id: "inventory_effect_haste", label: "Inventory Effect (Haste)", x: 36, y: 0, w: 18, h: 18, description: "Haste effect icon in inventory" },
  { id: "inventory_effect_mining_fatigue", label: "Inventory Effect (Mining Fatigue)", x: 54, y: 0, w: 18, h: 18, description: "Mining fatigue effect icon in inventory" },
  { id: "inventory_effect_strength", label: "Inventory Effect (Strength)", x: 72, y: 0, w: 18, h: 18, description: "Strength effect icon in inventory" },
  { id: "inventory_effect_instant_health", label: "Inventory Effect (Instant Health)", x: 90, y: 0, w: 18, h: 18, description: "Instant health effect icon in inventory" },
  { id: "inventory_effect_instant_damage", label: "Inventory Effect (Instant Damage)", x: 108, y: 0, w: 18, h: 18, description: "Instant damage effect icon in inventory" },
  { id: "inventory_effect_jump_boost", label: "Inventory Effect (Jump Boost)", x: 126, y: 0, w: 18, h: 18, description: "Jump boost effect icon in inventory" },
  { id: "inventory_effect_nausea", label: "Inventory Effect (Nausea)", x: 144, y: 0, w: 18, h: 18, description: "Nausea effect icon in inventory" },
  { id: "inventory_effect_regeneration", label: "Inventory Effect (Regeneration)", x: 162, y: 0, w: 18, h: 18, description: "Regeneration effect icon in inventory" },
  { id: "inventory_effect_resistance", label: "Inventory Effect (Resistance)", x: 0, y: 18, w: 18, h: 18, description: "Resistance effect icon in inventory" },
  { id: "inventory_effect_fire_resistance", label: "Inventory Effect (Fire Resistance)", x: 18, y: 18, w: 18, h: 18, description: "Fire resistance effect icon in inventory" },
  { id: "inventory_effect_water_breathing", label: "Inventory Effect (Water Breathing)", x: 36, y: 18, w: 18, h: 18, description: "Water breathing effect icon in inventory" },
  { id: "inventory_effect_invisibility", label: "Inventory Effect (Invisibility)", x: 54, y: 18, w: 18, h: 18, description: "Invisibility effect icon in inventory" },
  { id: "inventory_effect_blindness", label: "Inventory Effect (Blindness)", x: 72, y: 18, w: 18, h: 18, description: "Blindness effect icon in inventory" },
  { id: "inventory_effect_night_vision", label: "Inventory Effect (Night Vision)", x: 90, y: 18, w: 18, h: 18, description: "Night vision effect icon in inventory" },
  { id: "inventory_effect_hunger", label: "Inventory Effect (Hunger)", x: 108, y: 18, w: 18, h: 18, description: "Hunger effect icon in inventory" },
  { id: "inventory_effect_weakness", label: "Inventory Effect (Weakness)", x: 126, y: 18, w: 18, h: 18, description: "Weakness effect icon in inventory" },
  { id: "inventory_effect_poison", label: "Inventory Effect (Poison)", x: 144, y: 18, w: 18, h: 18, description: "Poison effect icon in inventory" },
  { id: "inventory_effect_wither", label: "Inventory Effect (Wither)", x: 162, y: 18, w: 18, h: 18, description: "Wither effect icon in inventory" },
  { id: "inventory_effect_health_boost", label: "Inventory Effect (Health Boost)", x: 0, y: 36, w: 18, h: 18, description: "Health boost effect icon in inventory" },
  { id: "inventory_effect_absorption", label: "Inventory Effect (Absorption)", x: 18, y: 36, w: 18, h: 18, description: "Absorption effect icon in inventory" },
  { id: "inventory_effect_saturation", label: "Inventory Effect (Saturation)", x: 36, y: 36, w: 18, h: 18, description: "Saturation effect icon in inventory" },
  { id: "inventory_effect_glowing", label: "Inventory Effect (Glowing)", x: 54, y: 36, w: 18, h: 18, description: "Glowing effect icon in inventory" },
  { id: "inventory_effect_levitation", label: "Inventory Effect (Levitation)", x: 72, y: 36, w: 18, h: 18, description: "Levitation effect icon in inventory" },
  { id: "inventory_effect_luck", label: "Inventory Effect (Luck)", x: 90, y: 36, w: 18, h: 18, description: "Luck effect icon in inventory" },
  { id: "inventory_effect_unluck", label: "Inventory Effect (Unluck)", x: 108, y: 36, w: 18, h: 18, description: "Unluck effect icon in inventory" },
  { id: "inventory_effect_hero_of_the_village", label: "Inventory Effect (Hero of the Village)", x: 126, y: 36, w: 18, h: 18, description: "Hero of the village effect icon in inventory" },
  { id: "inventory_effect_conduit_power", label: "Inventory Effect (Conduit Power)", x: 144, y: 36, w: 18, h: 18, description: "Conduit power effect icon in inventory" },
  { id: "inventory_effect_dolphins_grace", label: "Inventory Effect (Dolphin's Grace)", x: 162, y: 36, w: 18, h: 18, description: "Dolphin's grace effect icon in inventory" },
  { id: "inventory_effect_bad_omen", label: "Inventory Effect (Bad Omen)", x: 0, y: 54, w: 18, h: 18, description: "Bad omen effect icon in inventory" },
  { id: "inventory_effect_raid_omen", label: "Inventory Effect (Raid Omen)", x: 18, y: 54, w: 18, h: 18, description: "Raid omen effect icon in inventory" },
  { id: "inventory_effect_darkness", label: "Inventory Effect (Darkness)", x: 36, y: 54, w: 18, h: 18, description: "Darkness effect icon in inventory" },
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

// Particle atlas regions (simplified to main particles)
const PARTICLE_REGIONS: AtlasRegion[] = [
  { id: "particle_smoke", label: "Particle (Smoke)", x: 0, y: 0, w: 8, h: 8, description: "Smoke particle" },
  { id: "particle_flame", label: "Particle (Flame)", x: 8, y: 0, w: 8, h: 8, description: "Flame particle" },
  { id: "particle_lava_drip", label: "Particle (Lava Drip)", x: 16, y: 0, w: 8, h: 8, description: "Lava drip particle" },
  { id: "particle_water_drip", label: "Particle (Water Drip)", x: 24, y: 0, w: 8, h: 8, description: "Water drip particle" },
  { id: "particle_heart", label: "Particle (Heart)", x: 32, y: 0, w: 8, h: 8, description: "Heart particle" },
  { id: "particle_angry_villager", label: "Particle (Angry Villager)", x: 40, y: 0, w: 8, h: 8, description: "Angry villager particle" },
  { id: "particle_happy_villager", label: "Particle (Happy Villager)", x: 48, y: 0, w: 8, h: 8, description: "Happy villager particle" },
  { id: "particle_splash", label: "Particle (Splash)", x: 56, y: 0, w: 8, h: 8, description: "Water splash particle" },
  { id: "particle_wake", label: "Particle (Wake)", x: 64, y: 0, w: 8, h: 8, description: "Water wake particle" },
  { id: "particle_critical", label: "Particle (Critical)", x: 72, y: 0, w: 8, h: 8, description: "Critical hit particle" },
  { id: "particle_enchant", label: "Particle (Enchant)", x: 80, y: 0, w: 8, h: 8, description: "Enchantment particle" },
  { id: "particle_spell", label: "Particle (Spell)", x: 88, y: 0, w: 8, h: 8, description: "Spell particle" },
  { id: "particle_instant_spell", label: "Particle (Instant Spell)", x: 96, y: 0, w: 8, h: 8, description: "Instant spell particle" },
  { id: "particle_witch_magic", label: "Particle (Witch Magic)", x: 104, y: 0, w: 8, h: 8, description: "Witch magic particle" },
  { id: "particle_note", label: "Particle (Note)", x: 112, y: 0, w: 8, h: 8, description: "Note block particle" },
  { id: "particle_portal", label: "Particle (Portal)", x: 120, y: 0, w: 8, h: 8, description: "Portal particle" },
  { id: "particle_composter", label: "Particle (Composter)", x: 128, y: 0, w: 8, h: 8, description: "Composter particle" },
  { id: "particle_snowflake", label: "Particle (Snowflake)", x: 136, y: 0, w: 8, h: 8, description: "Snowflake particle" },
  { id: "particle_dragon_breath", label: "Particle (Dragon Breath)", x: 144, y: 0, w: 8, h: 8, description: "Dragon breath particle" },
  { id: "particle_end_rod", label: "Particle (End Rod)", x: 152, y: 0, w: 8, h: 8, description: "End rod particle" },
  { id: "particle_damage", label: "Particle (Damage)", x: 160, y: 0, w: 8, h: 8, description: "Damage particle" },
  { id: "particle_totem", label: "Particle (Totem)", x: 168, y: 0, w: 8, h: 8, description: "Totem of undying particle" },
  { id: "particle_spit", label: "Particle (Spit)", x: 176, y: 0, w: 8, h: 8, description: "Llama spit particle" },
  { id: "particle_squid_ink", label: "Particle (Squid Ink)", x: 184, y: 0, w: 8, h: 8, description: "Squid ink particle" },
  { id: "particle_bubble", label: "Particle (Bubble)", x: 192, y: 0, w: 8, h: 8, description: "Bubble particle" },
  { id: "particle_current_down", label: "Particle (Current Down)", x: 200, y: 0, w: 8, h: 8, description: "Current down particle" },
  { id: "particle_fishing", label: "Particle (Fishing)", x: 208, y: 0, w: 8, h: 8, description: "Fishing particle" },
  { id: "particle_firework", label: "Particle (Firework)", x: 216, y: 0, w: 8, h: 8, description: "Firework particle" },
  { id: "particle_firework_spark", label: "Particle (Firework Spark)", x: 224, y: 0, w: 8, h: 8, description: "Firework spark particle" },
  { id: "particle_dolphin", label: "Particle (Dolphin)", x: 232, y: 0, w: 8, h: 8, description: "Dolphin particle" },
  { id: "particle_sneeze", label: "Particle (Sneeze)", x: 240, y: 0, w: 8, h: 8, description: "Sneeze particle" },
  { id: "particle_campfire", label: "Particle (Campfire)", x: 248, y: 0, w: 8, h: 8, description: "Campfire particle" },
  { id: "particle_dripping_lava", label: "Particle (Dripping Lava)", x: 272, y: 0, w: 8, h: 8, description: "Dripping lava particle" },
  { id: "particle_falling_lava", label: "Particle (Falling Lava)", x: 280, y: 0, w: 8, h: 8, description: "Falling lava particle" },
  { id: "particle_dripping_water", label: "Particle (Dripping Water)", x: 288, y: 0, w: 8, h: 8, description: "Dripping water particle" },
  { id: "particle_falling_water", label: "Particle (Falling Water)", x: 296, y: 0, w: 8, h: 8, description: "Falling water particle" },
  { id: "particle_landing_lava", label: "Particle (Landing Lava)", x: 304, y: 0, w: 8, h: 8, description: "Landing lava particle" },
  { id: "particle_landing_water", label: "Particle (Landing Water)", x: 312, y: 0, w: 8, h: 8, description: "Landing water particle" },
  { id: "particle_reverse_squid_ink", label: "Particle (Reverse Squid Ink)", x: 320, y: 0, w: 8, h: 8, description: "Reverse squid ink particle" },
  { id: "particle_soul_fire_flame", label: "Particle (Soul Fire Flame)", x: 328, y: 0, w: 8, h: 8, description: "Soul fire flame particle" },
  { id: "particle_ash", label: "Particle (Ash)", x: 344, y: 0, w: 8, h: 8, description: "Ash particle" },
  { id: "particle_crimson_spore", label: "Particle (Crimson Spore)", x: 352, y: 0, w: 8, h: 8, description: "Crimson spore particle" },
  { id: "particle_warped_spore", label: "Particle (Warped Spore)", x: 360, y: 0, w: 8, h: 8, description: "Warped spore particle" },
  { id: "particle_spore_blossom", label: "Particle (Spore Blossom)", x: 368, y: 0, w: 8, h: 8, description: "Spore blossom particle" },
  { id: "particle_wax_off", label: "Particle (Wax Off)", x: 376, y: 0, w: 8, h: 8, description: "Wax off particle" },
  { id: "particle_wax_on", label: "Particle (Wax On)", x: 384, y: 0, w: 8, h: 8, description: "Wax on particle" },
  { id: "particle_electric_spark", label: "Particle (Electric Spark)", x: 392, y: 0, w: 8, h: 8, description: "Electric spark particle" },
  { id: "particle_scratch", label: "Particle (Scratch)", x: 400, y: 0, w: 8, h: 8, description: "Scratch particle" },
  { id: "particle_sculk_soul", label: "Particle (Sculk Soul)", x: 408, y: 0, w: 8, h: 8, description: "Sculk soul particle" },
  { id: "particle_sculk_charge", label: "Particle (Sculk Charge)", x: 416, y: 0, w: 8, h: 8, description: "Sculk charge particle" },
  { id: "particle_sculk_charge_pop", label: "Particle (Sculk Charge Pop)", x: 424, y: 0, w: 8, h: 8, description: "Sculk charge pop particle" },
  { id: "particle_shriek", label: "Particle (Shriek)", x: 432, y: 0, w: 8, h: 8, description: "Shriek particle" },
  { id: "particle_glow", label: "Particle (Glow)", x: 440, y: 0, w: 8, h: 8, description: "Glow particle" },
  { id: "particle_glow_squid", label: "Particle (Glow Squid)", x: 448, y: 0, w: 8, h: 8, description: "Glow squid particle" },
  { id: "particle_glow_ink", label: "Particle (Glow Ink)", x: 456, y: 0, w: 8, h: 8, description: "Glow ink particle" },
  { id: "particle_cherry_leaves", label: "Particle (Cherry Leaves)", x: 464, y: 0, w: 8, h: 8, description: "Cherry leaves particle" },
  { id: "particle_white_ash", label: "Particle (White Ash)", x: 472, y: 0, w: 8, h: 8, description: "White ash particle" },
  { id: "particle_small_flame", label: "Particle (Small Flame)", x: 480, y: 0, w: 8, h: 8, description: "Small flame particle" },
  { id: "particle_dripping_honey", label: "Particle (Dripping Honey)", x: 496, y: 0, w: 8, h: 8, description: "Dripping honey particle" },
  { id: "particle_falling_honey", label: "Particle (Falling Honey)", x: 504, y: 0, w: 8, h: 8, description: "Falling honey particle" },
  { id: "particle_landing_honey", label: "Particle (Landing Honey)", x: 512, y: 0, w: 8, h: 8, description: "Landing honey particle" },
  { id: "particle_falling_nectar", label: "Particle (Falling Nectar)", x: 520, y: 0, w: 8, h: 8, description: "Falling nectar particle" },
  { id: "particle_falling_spore_blossom", label: "Particle (Falling Spore Blossom)", x: 528, y: 0, w: 8, h: 8, description: "Falling spore blossom particle" },
  { id: "particle_lava", label: "Particle (Lava)", x: 536, y: 0, w: 8, h: 8, description: "Lava particle" },
  { id: "particle_mycelium", label: "Particle (Mycelium)", x: 544, y: 0, w: 8, h: 8, description: "Mycelium particle" },
  { id: "particle_nausea", label: "Particle (Nausea)", x: 552, y: 0, w: 8, h: 8, description: "Nausea particle" },
  { id: "particle_light", label: "Particle (Light)", x: 560, y: 0, w: 8, h: 8, description: "Light particle" },
  { id: "particle_dragon_egg", label: "Particle (Dragon Egg)", x: 568, y: 0, w: 8, h: 8, description: "Dragon egg particle" },
  { id: "particle_firework_trail", label: "Particle (Firework Trail)", x: 576, y: 0, w: 8, h: 8, description: "Firework trail particle" },
  { id: "particle_villager_happy", label: "Particle (Villager Happy)", x: 584, y: 0, w: 8, h: 8, description: "Villager happy particle" },
  { id: "particle_villager_angry", label: "Particle (Villager Angry)", x: 592, y: 0, w: 8, h: 8, description: "Villager angry particle" },
  { id: "particle_villager_heart", label: "Particle (Villager Heart)", x: 600, y: 0, w: 8, h: 8, description: "Villager heart particle" },
  { id: "particle_electro", label: "Particle (Electro)", x: 608, y: 0, w: 8, h: 8, description: "Electro particle" },
  { id: "particle_wind_charge", label: "Particle (Wind Charge)", x: 616, y: 0, w: 8, h: 8, description: "Wind charge particle" },
  { id: "particle_breeze", label: "Particle (Breeze)", x: 624, y: 0, w: 8, h: 8, description: "Breeze particle" },
  { id: "particle_breeze_wind", label: "Particle (Breeze Wind)", x: 632, y: 0, w: 8, h: 8, description: "Breeze wind particle" },
  { id: "particle_breeze_emitter", label: "Particle (Breeze Emitter)", x: 640, y: 0, w: 8, h: 8, description: "Breeze emitter particle" },
  { id: "particle_infested", label: "Particle (Infested)", x: 648, y: 0, w: 8, h: 8, description: "Infested particle" },
  { id: "particle_trial_spawner_detection", label: "Particle (Trial Spawner Detection)", x: 656, y: 0, w: 8, h: 8, description: "Trial spawner detection particle" },
  { id: "particle_ominous_spawning", label: "Particle (Ominous Spawning)", x: 664, y: 0, w: 8, h: 8, description: "Ominous spawning particle" },
  { id: "particle_ominous_trial_spawner", label: "Particle (Ominous Trial Spawner)", x: 672, y: 0, w: 8, h: 8, description: "Ominous trial spawner particle" },
  { id: "particle_vault_connection", label: "Particle (Vault Connection)", x: 680, y: 0, w: 8, h: 8, description: "Vault connection particle" },
  { id: "particle_item_craft", label: "Particle (Item Craft)", x: 688, y: 0, w: 8, h: 8, description: "Item craft particle" },
  { id: "particle_brush", label: "Particle (Brush)", x: 696, y: 0, w: 8, h: 8, description: "Brush particle" },
  { id: "particle_brush_outline", label: "Particle (Brush Outline)", x: 704, y: 0, w: 8, h: 8, description: "Brush outline particle" },
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
