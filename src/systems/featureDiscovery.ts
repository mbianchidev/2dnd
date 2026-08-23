import {
  ALWAYS_AVAILABLE_FEATURES,
  CODEX_CATEGORY_FEATURES,
  CRAFTING_CATEGORY_FEATURES,
  FEATURE_DEFINITION_BY_ID,
  FEATURE_IDS,
  GATHERING_DISCIPLINE_FEATURES,
  isFeatureId,
  type FeatureId,
} from "../data/featureDiscovery";
import { getCodexKnowledgeEntry } from "../data/codexKnowledge";
import {
  CRAFTING_CATEGORIES,
  getCraftingRecipe,
  getDefaultCraftingRecipeIds,
  type CraftingCategory,
} from "../data/crafting";
import {
  GATHERING_DISCIPLINES,
  type GatheringDiscipline,
} from "../data/gathering";
import type { CodexKnowledgeCategory } from "../data/codexKnowledge";
import type { InputAction } from "./input";
import type { CodexData } from "./codex";
import type { PlayerState } from "./player";
import type { ControlActionId } from "../data/tutorial";

export interface FeatureDiscoveryProgress {
  discoveredFeatureIds: FeatureId[];
  pendingFeatureRevealIds: FeatureId[];
  debugDiscoveredFeatureIds: FeatureId[];
  debugSuppressedFeatureIds: FeatureId[];
}

export interface FeatureDiscoveryResult {
  newlyDiscovered: FeatureId[];
  availableFeatureIds: FeatureId[];
}

export type EscapeMenuAction =
  | "resume"
  | "inventory"
  | "party"
  | "questJournal"
  | "chronicle"
  | "codex"
  | "achievements"
  | "gathering"
  | "crafting"
  | "tips"
  | "save"
  | "settings"
  | "quit";

export interface EscapeMenuEntry {
  action: EscapeMenuAction;
  label: string;
  color: string;
  featureId?: FeatureId;
  testId: string;
}

export type PartyDiscoveryPage = "status" | "social" | "items" | "gambits";
export type CodexDiscoveryCategory = "monsters" | CodexKnowledgeCategory;

const ESCAPE_MENU_ENTRIES: readonly EscapeMenuEntry[] = [
  { action: "resume", label: "Resume", color: "#88ff88", testId: "menu-resume" },
  {
    action: "inventory",
    label: "Inventory",
    color: "#9fe8ff",
    featureId: "inventory",
    testId: "menu-inventory",
  },
  {
    action: "party",
    label: "Party",
    color: "#9fe8ff",
    featureId: "party",
    testId: "menu-party",
  },
  {
    action: "questJournal",
    label: "Quest Journal",
    color: "#d1c4e9",
    featureId: "questJournal",
    testId: "menu-quest-journal",
  },
  {
    action: "chronicle",
    label: "Chronicle",
    color: "#ffe38a",
    featureId: "chronicle",
    testId: "menu-chronicle",
  },
  {
    action: "codex",
    label: "Codex",
    color: "#fff3a6",
    featureId: "codex",
    testId: "menu-codex",
  },
  {
    action: "achievements",
    label: "Achievements",
    color: "#aaffdd",
    featureId: "achievements",
    testId: "menu-achievements",
  },
  {
    action: "gathering",
    label: "Gathering",
    color: "#80cbc4",
    featureId: "gathering",
    testId: "menu-gathering",
  },
  {
    action: "crafting",
    label: "Crafting",
    color: "#f7c948",
    featureId: "crafting",
    testId: "menu-crafting",
  },
  {
    action: "tips",
    label: "Tips",
    color: "#83d8ff",
    featureId: "tips",
    testId: "menu-tips",
  },
  {
    action: "save",
    label: "Save Game",
    color: "#9fe8ff",
    testId: "menu-save",
  },
  {
    action: "settings",
    label: "Settings",
    color: "#aabbff",
    featureId: "settings",
    testId: "menu-settings",
  },
  {
    action: "quit",
    label: "Save & Return to Title",
    color: "#ff7777",
    testId: "menu-quit",
  },
];

const INPUT_FEATURES: Partial<Record<InputAction, FeatureId>> = {
  openJournal: "questJournal",
  openParty: "party",
  openCodex: "codex",
  openAchievements: "achievements",
  openGathering: "gathering",
  openCrafting: "crafting",
  openTips: "tips",
  openSettings: "settings",
  openMap: "map",
  openEquipment: "equipment",
  toggleMount: "mounts",
};

const CONTROL_FEATURES: Partial<Record<ControlActionId, FeatureId>> = {
  map: "map",
  equipment: "equipment",
  journal: "questJournal",
  codex: "codex",
  achievements: "achievements",
  gathering: "gathering",
  crafting: "crafting",
  party: "party",
  mount: "mounts",
};

type FeatureAvailabilityListener = (ids: ReadonlySet<FeatureId>) => void;

class FeatureAvailabilityStore {
  private ids = new Set<FeatureId>(ALWAYS_AVAILABLE_FEATURES);
  private readonly listeners = new Set<FeatureAvailabilityListener>();

  set(featureIds: readonly FeatureId[]): void {
    this.ids = new Set([...ALWAYS_AVAILABLE_FEATURES, ...featureIds]);
    for (const listener of this.listeners) listener(this.ids);
  }

  has(featureId: FeatureId): boolean {
    return this.ids.has(featureId);
  }

  subscribe(listener: FeatureAvailabilityListener): () => void {
    this.listeners.add(listener);
    listener(this.ids);
    return () => this.listeners.delete(listener);
  }
}

export const featureAvailability = new FeatureAvailabilityStore();

export function createFeatureDiscoveryProgress(): FeatureDiscoveryProgress {
  return {
    discoveredFeatureIds: [],
    pendingFeatureRevealIds: [],
    debugDiscoveredFeatureIds: [],
    debugSuppressedFeatureIds: [],
  };
}

function normalizeIds(value: unknown): FeatureId[] {
  return Array.isArray(value) ? [...new Set(value.filter(isFeatureId))] : [];
}

export function normalizeFeatureDiscoveryProgress(
  progression: Partial<FeatureDiscoveryProgress>,
): FeatureDiscoveryProgress {
  const discoveredFeatureIds = normalizeIds(progression.discoveredFeatureIds);
  const discovered = new Set(discoveredFeatureIds);
  const debugDiscoveredFeatureIds = normalizeIds(
    progression.debugDiscoveredFeatureIds,
  ).filter((id) => discovered.has(id));
  return {
    discoveredFeatureIds,
    pendingFeatureRevealIds: normalizeIds(
      progression.pendingFeatureRevealIds,
    ).filter((id) => discovered.has(id)),
    debugDiscoveredFeatureIds,
    debugSuppressedFeatureIds: normalizeIds(
      progression.debugSuppressedFeatureIds,
    ).filter((id) => !discovered.has(id)),
  };
}

function hasStartedQuest(player: PlayerState): boolean {
  return Object.values(player.progression.quests.quests).some(
    (quest) => quest.status === "active" || quest.status === "completed",
  );
}

function hasNaturalAchievement(player: PlayerState): boolean {
  return player.progression.achievements.earned.some((record) => !record.debug);
}

function hasNaturalSocialEvidence(player: PlayerState): boolean {
  return player.progression.social.history.some(
    (entry) => !entry.sourceId.startsWith("debug:"),
  );
}

function hasLearnedCraftingRecipe(player: PlayerState): boolean {
  const defaults = new Set(getDefaultCraftingRecipeIds());
  return player.progression.crafting.knownRecipeIds.some(
    (recipeId) => !defaults.has(recipeId),
  ) || player.progression.crafting.recentHistory.some((entry) => !entry.debug);
}

export function deriveAvailableFeatureIds(
  player: PlayerState,
  codex: CodexData,
): FeatureId[] {
  const ids = new Set<FeatureId>(ALWAYS_AVAILABLE_FEATURES);
  if (hasStartedQuest(player)) ids.add("questJournal");
  if (
    player.progression.seenCutsceneIds.length > 0
    || player.progression.pendingCutsceneIds.length > 0
    || player.progression.worldEvents.log.length > 0
  ) {
    ids.add("chronicle");
  }
  if (player.party.companions.length > 0) {
    ids.add("party");
    ids.add("partyGambits");
  }
  if (Object.keys(codex.entries).length > 0) ids.add("codexMonsters");
  for (const entryId of codex.unlockedEntryIds) {
    const entry = getCodexKnowledgeEntry(entryId);
    if (entry) ids.add(CODEX_CATEGORY_FEATURES[entry.category]);
  }
  if (
    [...ids].some((id) =>
      id === "codexMonsters"
      || id === "codexLocation"
      || id === "codexItem"
      || id === "codexCharacter"
      || id === "codexFaction"
      || id === "codexHistory"
    )
  ) {
    ids.add("codex");
  }
  if (hasNaturalAchievement(player)) ids.add("achievements");
  if (hasLearnedCraftingRecipe(player)) {
    ids.add("crafting");
    for (const recipeId of player.progression.crafting.knownRecipeIds) {
      const recipe = getCraftingRecipe(recipeId);
      if (recipe) ids.add(CRAFTING_CATEGORY_FEATURES[recipe.category]);
    }
  }
  for (const discipline of GATHERING_DISCIPLINES) {
    const stats = player.progression.gathering.stats[discipline];
    const pending = player.progression.gathering.pending?.discipline === discipline;
    const recorded = player.progression.gathering.history.some(
      (entry) => entry.discipline === discipline,
    );
    if (stats.attempts > 0 || pending || recorded) {
      ids.add(GATHERING_DISCIPLINE_FEATURES[discipline]);
      ids.add("gathering");
    }
  }
  if (
    player.progression.worldEvents.pending
    || player.progression.worldEvents.log.length > 0
  ) {
    ids.add("worldEvents");
    ids.add("chronicle");
  }
  if (hasNaturalSocialEvidence(player)) ids.add("socialProfile");
  if (
    player.mountId.length > 0
    || player.inventory.some((item) => item.type === "mount" && item.mountId)
  ) {
    ids.add("mounts");
  }
  const nautical = player.progression.nautical;
  if (nautical.discoveredPortIds.length > 0) ids.add("nauticalHarbors");
  if (nautical.discoveredRouteIds.length > 0) ids.add("nauticalRoutes");
  if (nautical.ownedBoats.length > 0) ids.add("nauticalBoat");
  return FEATURE_IDS.filter((id) => ids.has(id));
}

export function reconcileFeatureDiscovery(
  player: PlayerState,
  codex: CodexData,
  options: { silent?: boolean } = {},
): FeatureDiscoveryResult {
  const progression = player.progression;
  const discovered = new Set(progression.discoveredFeatureIds);
  const suppressed = new Set(progression.debugSuppressedFeatureIds);
  const newlyDiscovered: FeatureId[] = [];
  for (const featureId of deriveAvailableFeatureIds(player, codex)) {
    if (
      ALWAYS_AVAILABLE_FEATURES.has(featureId)
      || discovered.has(featureId)
      || suppressed.has(featureId)
    ) {
      continue;
    }
    discovered.add(featureId);
    newlyDiscovered.push(featureId);
  }
  progression.discoveredFeatureIds = FEATURE_IDS.filter((id) => discovered.has(id));
  if (!options.silent) {
    const pending = new Set(progression.pendingFeatureRevealIds);
    for (const featureId of newlyDiscovered) pending.add(featureId);
    progression.pendingFeatureRevealIds = FEATURE_IDS.filter((id) =>
      pending.has(id)
    );
  }
  return {
    newlyDiscovered,
    availableFeatureIds: getAvailableFeatureIds(player),
  };
}

export function getAvailableFeatureIds(player: PlayerState): FeatureId[] {
  return FEATURE_IDS.filter((id) => isFeatureAvailable(player, id));
}

export function isFeatureAvailable(
  player: PlayerState,
  featureId: FeatureId,
): boolean {
  if (ALWAYS_AVAILABLE_FEATURES.has(featureId)) return true;
  const discovered = new Set(player.progression.discoveredFeatureIds);
  if (!discovered.has(featureId)) return false;
  if (featureId === "codex") {
    return Object.values(CODEX_CATEGORY_FEATURES).some((id) =>
      discovered.has(id)
    );
  }
  if (featureId === "crafting") {
    return Object.values(CRAFTING_CATEGORY_FEATURES).some((id) =>
      discovered.has(id)
    );
  }
  if (featureId === "gathering") {
    return Object.values(GATHERING_DISCIPLINE_FEATURES).some((id) =>
      discovered.has(id)
    );
  }
  return true;
}

export function revealFeature(
  player: PlayerState,
  featureId: FeatureId,
  options: { debug?: boolean; notify?: boolean } = {},
): boolean {
  if (ALWAYS_AVAILABLE_FEATURES.has(featureId)) return false;
  const progression = player.progression;
  progression.debugSuppressedFeatureIds =
    progression.debugSuppressedFeatureIds.filter((id) => id !== featureId);
  if (progression.discoveredFeatureIds.includes(featureId)) return false;
  progression.discoveredFeatureIds.push(featureId);
  if (options.debug) progression.debugDiscoveredFeatureIds.push(featureId);
  if (options.notify !== false) progression.pendingFeatureRevealIds.push(featureId);
  return true;
}

export function hideDebugFeature(
  player: PlayerState,
  featureId: FeatureId,
): boolean {
  if (!player.progression.debugDiscoveredFeatureIds.includes(featureId)) {
    return false;
  }
  player.progression.discoveredFeatureIds =
    player.progression.discoveredFeatureIds.filter((id) => id !== featureId);
  player.progression.debugDiscoveredFeatureIds =
    player.progression.debugDiscoveredFeatureIds.filter((id) => id !== featureId);
  player.progression.pendingFeatureRevealIds =
    player.progression.pendingFeatureRevealIds.filter((id) => id !== featureId);
  return true;
}

export function suppressCurrentlyAvailableFeatures(
  player: PlayerState,
  codex: CodexData,
): void {
  const discovered = new Set(player.progression.discoveredFeatureIds);
  const suppressed = new Set(player.progression.debugSuppressedFeatureIds);
  for (const featureId of deriveAvailableFeatureIds(player, codex)) {
    if (
      !ALWAYS_AVAILABLE_FEATURES.has(featureId)
      && !discovered.has(featureId)
    ) {
      suppressed.add(featureId);
    }
  }
  player.progression.debugSuppressedFeatureIds = FEATURE_IDS.filter((id) =>
    suppressed.has(id)
  );
}

export function resetDebugFeatureDiscovery(player: PlayerState): void {
  const debugIds = new Set(player.progression.debugDiscoveredFeatureIds);
  player.progression.discoveredFeatureIds =
    player.progression.discoveredFeatureIds.filter((id) => !debugIds.has(id));
  player.progression.pendingFeatureRevealIds =
    player.progression.pendingFeatureRevealIds.filter((id) => !debugIds.has(id));
  player.progression.debugDiscoveredFeatureIds = [];
  player.progression.debugSuppressedFeatureIds = [];
}

export function acknowledgeFeatureReveal(
  player: PlayerState,
  featureId: FeatureId,
): void {
  player.progression.pendingFeatureRevealIds =
    player.progression.pendingFeatureRevealIds.filter((id) => id !== featureId);
}

export function getEscapeMenuEntries(player: PlayerState): EscapeMenuEntry[] {
  return ESCAPE_MENU_ENTRIES.filter((entry) =>
    !entry.featureId || isFeatureAvailable(player, entry.featureId)
  );
}

export function getPartyDiscoveryPages(
  player: PlayerState,
): PartyDiscoveryPage[] {
  const pages: PartyDiscoveryPage[] = [];
  if (isFeatureAvailable(player, "party")) pages.push("status");
  if (isFeatureAvailable(player, "socialProfile")) pages.push("social");
  pages.push("items");
  if (isFeatureAvailable(player, "partyGambits")) pages.push("gambits");
  return pages;
}

export function getCodexDiscoveryCategories(
  player: PlayerState,
): CodexDiscoveryCategory[] {
  return (Object.keys(CODEX_CATEGORY_FEATURES) as CodexDiscoveryCategory[])
    .filter((category) =>
      isFeatureAvailable(player, CODEX_CATEGORY_FEATURES[category])
    );
}

export function getCraftingDiscoveryCategories(
  player: PlayerState,
): CraftingCategory[] {
  return CRAFTING_CATEGORIES.filter((category) =>
    isFeatureAvailable(player, CRAFTING_CATEGORY_FEATURES[category])
  );
}

export function getGatheringDiscoveryDisciplines(
  player: PlayerState,
): GatheringDiscipline[] {
  return GATHERING_DISCIPLINES.filter((discipline) =>
    isFeatureAvailable(player, GATHERING_DISCIPLINE_FEATURES[discipline])
  );
}

export function clampFeatureSelection(index: number, entryCount: number): number {
  if (entryCount <= 0) return 0;
  return Math.min(Math.max(index, 0), entryCount - 1);
}

export function getInputActionFeature(
  action: InputAction,
): FeatureId | undefined {
  return INPUT_FEATURES[action];
}

export function isControlGuidanceAvailable(
  player: PlayerState,
  controlId: ControlActionId,
): boolean {
  const featureId = CONTROL_FEATURES[controlId];
  return !featureId || isFeatureAvailable(player, featureId);
}

export function getFeatureRevealMessage(featureId: FeatureId): string {
  const definition = FEATURE_DEFINITION_BY_ID.get(featureId);
  return definition
    ? `New feature: ${definition.label}. ${definition.description}`
    : `New feature: ${featureId}.`;
}

export function executeFeatureDiscoveryDebugCommand(
  player: PlayerState,
  args: string,
): { changed: boolean; lines: string[] } {
  const [action = "list", rawFeatureId] = args.trim().split(/\s+/, 2);
  if (action === "list") {
    const discovered = new Set(player.progression.discoveredFeatureIds);
    const debug = new Set(player.progression.debugDiscoveredFeatureIds);
    const suppressed = new Set(player.progression.debugSuppressedFeatureIds);
    return {
      changed: false,
      lines: FEATURE_IDS.map((featureId) => {
        const state = ALWAYS_AVAILABLE_FEATURES.has(featureId)
          ? "always"
          : debug.has(featureId)
            ? "debug"
            : discovered.has(featureId)
              ? "discovered"
              : suppressed.has(featureId) ? "debug-suppressed" : "hidden";
        return `${featureId}: ${state}`;
      }),
    };
  }
  if (action === "reset") {
    const changed = player.progression.debugDiscoveredFeatureIds.length > 0
      || player.progression.debugSuppressedFeatureIds.length > 0;
    resetDebugFeatureDiscovery(player);
    return {
      changed,
      lines: [changed ? "Reset debug feature discovery." : "No debug feature discovery to reset."],
    };
  }
  if (!isFeatureId(rawFeatureId)) {
    return {
      changed: false,
      lines: [
        `Unknown feature: ${rawFeatureId ?? "(missing)"}.`,
        "Usage: /feature <list|reveal|hide|reset|explain> [featureId]",
      ],
    };
  }
  if (action === "explain") {
    const definition = FEATURE_DEFINITION_BY_ID.get(rawFeatureId)!;
    return {
      changed: false,
      lines: [
        `${definition.id}: ${definition.label}`,
        definition.description,
        definition.prerequisite ?? "Always available.",
        `Owners: ${definition.owners.join(", ")}`,
        `Test ID: ${definition.testId}`,
      ],
    };
  }
  if (action === "reveal") {
    const changed = revealFeature(player, rawFeatureId, {
      debug: true,
      notify: false,
    });
    return {
      changed,
      lines: [changed ? `Debug-revealed ${rawFeatureId}.` : `${rawFeatureId} is already available.`],
    };
  }
  if (action === "hide") {
    const changed = hideDebugFeature(player, rawFeatureId);
    return {
      changed,
      lines: [
        changed
          ? `Removed debug reveal for ${rawFeatureId}.`
          : `${rawFeatureId} is not debug-revealed and cannot be hidden.`,
      ],
    };
  }
  return {
    changed: false,
    lines: ["Usage: /feature <list|reveal|hide|reset|explain> [featureId]"],
  };
}
