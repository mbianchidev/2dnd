export type TutorialStepId =
  | "welcome"
  | "interface"
  | "exploration"
  | "combat"
  | "growth";

export type TipCategory =
  | "controls"
  | "combat"
  | "exploration"
  | "party"
  | "advanced";

export type ControlActionId =
  | "move"
  | "interact"
  | "menu"
  | "tips"
  | "map"
  | "equipment"
  | "journal"
  | "codex"
  | "achievements"
  | "party"
  | "mount"
  | "battleNavigate"
  | "battleConfirm"
  | "battleCancel";

export interface ControlGuidance {
  id: ControlActionId;
  label: string;
  keyboard: string;
  pointer: string;
  gamepad: string;
  touch: string;
}

export interface TutorialStep {
  id: TutorialStepId;
  title: string;
  summary: string;
  details: readonly string[];
  controls: readonly ControlActionId[];
}

export type TipUnlock =
  | { type: "always" }
  | { type: "level"; minimum: number }
  | { type: "companion" }
  | { type: "mount" }
  | { type: "dungeon" }
  | { type: "skillCheck" }
  | { type: "trap" };

export interface TipDefinition {
  id: string;
  category: TipCategory;
  title: string;
  body: string;
  controls?: readonly ControlActionId[];
  unlock: TipUnlock;
}

export const TIP_CATEGORY_LABELS: Record<TipCategory, string> = {
  controls: "Controls",
  combat: "Combat",
  exploration: "Explore",
  party: "Party",
  advanced: "Advanced",
};

export const TIP_CATEGORIES: readonly TipCategory[] = [
  "controls",
  "combat",
  "exploration",
  "party",
  "advanced",
];

export const CONTROL_GUIDANCE: Record<ControlActionId, ControlGuidance> = {
  move: {
    id: "move",
    label: "Move",
    keyboard: "W A S D",
    pointer: "Keyboard movement",
    gamepad: "Left stick / D-pad",
    touch: "Directional pad",
  },
  interact: {
    id: "interact",
    label: "Interact / confirm",
    keyboard: "Space",
    pointer: "Select the highlighted action",
    gamepad: "A / X",
    touch: "A or tap the prompt",
  },
  menu: {
    id: "menu",
    label: "Open / close menu",
    keyboard: "Esc",
    pointer: "Use menu buttons",
    gamepad: "Menu / Y",
    touch: "MENU",
  },
  tips: {
    id: "tips",
    label: "Open Tips",
    keyboard: "F1",
    pointer: "Esc menu > Tips",
    gamepad: "View",
    touch: "TIPS",
  },
  map: {
    id: "map",
    label: "World / city map",
    keyboard: "M",
    pointer: "Map controls",
    gamepad: "Menu, then Map",
    touch: "MENU, then Map",
  },
  equipment: {
    id: "equipment",
    label: "Hero gear",
    keyboard: "E",
    pointer: "Equipment controls",
    gamepad: "Menu, then Equipment",
    touch: "MENU, then Equipment",
  },
  journal: {
    id: "journal",
    label: "Quest journal",
    keyboard: "Q",
    pointer: "Esc menu > Quest Journal",
    gamepad: "Menu, then Journal",
    touch: "MENU, then Journal",
  },
  codex: {
    id: "codex",
    label: "Codex",
    keyboard: "C",
    pointer: "Codex controls",
    gamepad: "Menu, then Codex",
    touch: "MENU, then Codex",
  },
  achievements: {
    id: "achievements",
    label: "Achievements and titles",
    keyboard: "Y",
    pointer: "Esc menu > Achievements",
    gamepad: "Menu, then Achievements",
    touch: "MENU, then Achievements",
  },
  party: {
    id: "party",
    label: "Party management",
    keyboard: "P",
    pointer: "Party controls",
    gamepad: "PARTY / menu",
    touch: "PARTY",
  },
  mount: {
    id: "mount",
    label: "Mount / dismount",
    keyboard: "T",
    pointer: "Mount controls",
    gamepad: "Menu, then Mount",
    touch: "MENU, then Mount",
  },
  battleNavigate: {
    id: "battleNavigate",
    label: "Choose action / target",
    keyboard: "WASD / arrows",
    pointer: "Select an action or target",
    gamepad: "D-pad / left stick",
    touch: "Directional pad or tap",
  },
  battleConfirm: {
    id: "battleConfirm",
    label: "Confirm target",
    keyboard: "Enter / Space",
    pointer: "Select the target",
    gamepad: "A",
    touch: "A or tap",
  },
  battleCancel: {
    id: "battleCancel",
    label: "Cancel targeting",
    keyboard: "Esc",
    pointer: "Choose another action",
    gamepad: "B",
    touch: "B",
  },
};

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome to 2D&D",
    summary: "Explore the world, meet its people, and grow into a full adventuring party.",
    details: [
      "Move one tile at a time. Action prompts appear only when something nearby can be used.",
      "Open Tips whenever you need a reminder; new advanced advice appears as your journey grows.",
    ],
    controls: ["move", "interact", "menu", "tips"],
  },
  {
    id: "interface",
    title: "Read the Adventure",
    summary: "The upper-left HUD tracks HP, MP, experience, gold, and level.",
    details: [
      "HP keeps you standing. MP powers spells. Experience advances your level after a rest.",
      "Temporary messages and context prompts explain rewards, hazards, entrances, and nearby actions.",
    ],
    controls: ["equipment", "journal", "codex"],
  },
  {
    id: "exploration",
    title: "Explore with Purpose",
    summary: "Use the map and journal to plan routes through cities, wilderness, and dungeons.",
    details: [
      "Fog clears as you travel. Cities unlock fast travel after discovery.",
      "Talk to marked NPCs, inspect suspicious places, and use Space when an action prompt appears.",
    ],
    controls: ["map", "journal", "interact"],
  },
  {
    id: "combat",
    title: "Combat Basics",
    summary: "Initiative decides turn order. Choose an action, then confirm a valid target.",
    details: [
      "Attacks roll a d20 against Armor Class. A natural 20 is a critical hit; a natural 1 misses.",
      "Defend reduces incoming danger. Spells use MP, items are limited, and formation can protect back-row enemies.",
    ],
    controls: ["battleNavigate", "battleConfirm", "battleCancel"],
  },
  {
    id: "growth",
    title: "Build Your Strategy",
    summary: "Quests unlock companions, routes, equipment, mounts, and harder challenges.",
    details: [
      "The Codex records monsters and elemental discoveries. Party management controls gear and gambits.",
      "Reopen this tutorial or browse progression-aware Tips from the Esc menu at any time.",
    ],
    controls: ["party", "mount", "tips"],
  },
];

export const TIPS: readonly TipDefinition[] = [
  {
    id: "controls.context",
    category: "controls",
    title: "Context actions",
    body: "Use Space when a prompt appears to talk, enter, open, inspect, or disarm. Prompts are contextual, so Space never needs a long command list.",
    controls: ["interact"],
    unlock: { type: "always" },
  },
  {
    id: "controls.shortcuts",
    category: "controls",
    title: "Useful shortcuts",
    body: "The map, equipment, journal, Codex, achievements, party, mount, menu, and Tips each have a direct keyboard shortcut.",
    controls: ["map", "equipment", "journal", "codex", "achievements", "party", "mount", "menu", "tips"],
    unlock: { type: "always" },
  },
  {
    id: "progression.achievements",
    category: "controls",
    title: "Achievements and titles",
    body: "Achievements reward durable gameplay milestones with points and presentation-only titles. Hidden entries reveal themselves when completed.",
    controls: ["achievements"],
    unlock: { type: "always" },
  },
  {
    id: "combat.turns",
    category: "combat",
    title: "Turn order and defense",
    body: "Initiative interleaves heroes and monsters. Defend lasts until that actor's next turn and helps against every attack in between.",
    controls: ["battleNavigate", "battleConfirm"],
    unlock: { type: "always" },
  },
  {
    id: "combat.resources",
    category: "combat",
    title: "Protect your resources",
    body: "Spells spend MP and consumables leave inventory only after a valid action is confirmed. Bonus actions can be followed by one main action.",
    unlock: { type: "always" },
  },
  {
    id: "combat.elements",
    category: "combat",
    title: "Elemental scouting",
    body: "Weaknesses double damage, resistances halve it, and immunities prevent it. Observed interactions are recorded in the Codex.",
    unlock: { type: "level", minimum: 2 },
  },
  {
    id: "exploration.fog",
    category: "exploration",
    title: "Fog and discovery",
    body: "Travel reveals the map. Discovering a city enables it as a future fast-travel destination.",
    controls: ["move", "map"],
    unlock: { type: "always" },
  },
  {
    id: "exploration.checks",
    category: "exploration",
    title: "Ability checks",
    body: "Dexterity handles hazards and locks, Wisdom finds secrets, Intelligence reads unusual mechanisms, and Charisma shapes negotiations.",
    unlock: { type: "skillCheck" },
  },
  {
    id: "exploration.dungeons",
    category: "exploration",
    title: "Dungeon preparation",
    body: "Dungeons have persistent fog, multiple floors, unique encounters, and safe transition tiles. Rest and stock supplies before descending.",
    unlock: { type: "dungeon" },
  },
  {
    id: "party.recruitment",
    category: "party",
    title: "Recruiting allies",
    body: "Companions join through quests. Up to three active allies follow the hero and enter battle with their own resources and equipment.",
    unlock: { type: "companion" },
  },
  {
    id: "party.gambits",
    category: "party",
    title: "Manual turns and gambits",
    body: "Set each companion to manual control or ranked gambits. The first valid rule acts; invalid rules safely fall through.",
    controls: ["party"],
    unlock: { type: "companion" },
  },
  {
    id: "advanced.formation",
    category: "advanced",
    title: "Break enemy formations",
    body: "Melee attacks must clear living front-row enemies before protected back-row targets. Ranged attacks and spells bypass that protection.",
    unlock: { type: "level", minimum: 3 },
  },
  {
    id: "advanced.mounts",
    category: "advanced",
    title: "Mount advantages",
    body: "Mounts change travel speed, encounter rates, and terrain access. Dismount when a route or interaction requires it.",
    controls: ["mount"],
    unlock: { type: "mount" },
  },
  {
    id: "advanced.traps",
    category: "advanced",
    title: "Detected traps",
    body: "A detected trap blocks movement until disarmed. Trap Kits, talents, and Adventurer guidance improve your odds; failed outcomes persist.",
    controls: ["interact"],
    unlock: { type: "trap" },
  },
];
