/**
 * Bestiary system: tracks defeated monsters and discovered stats.
 * Stats are only revealed as the player discovers them through combat.
 */

import { ALL_MONSTERS, getMonster, type Monster } from "../data/monsters";
import type { Element } from "../data/elements";
import {
  getBodyPart, getTargetableBodyParts, type PhysicalDiscovery,
} from "../data/anatomy";
import {
  applyPhysicalModifier, isPhysicalDamageType, physicalDamageTypeName,
  type PhysicalDamageType,
} from "../data/damageTypes";
import {
  getMonsterFamily,
  MONSTER_FAMILIES,
  type MonsterFamily,
  type MonsterFamilyId,
} from "../data/monsterFamilies";
import {
  CODEX_KNOWLEDGE_CATEGORIES,
  CODEX_KNOWLEDGE_ENTRIES,
  getCodexKnowledgeEntry,
  isCodexKnowledgeId,
  type CodexKnowledgeCategory,
  type CodexKnowledgeEntry,
  type CodexUnlockSource,
} from "../data/codexKnowledge";
import { ITEMS } from "../data/items";
import { QUESTS, type QuestId } from "../data/quests";
import type { PlayerState } from "./player";
import { isElement } from "../data/elements";
import {
  REPUTATION_MILESTONE_IDS,
  REPUTATION_TIERS,
} from "../data/reputation";
import type { DeityId, TempleId } from "../data/devotion";
import { PRESTIGE_PATHS, type PrestigeTrackId } from "../data/prestige";
import { getTrackLevel } from "./classProgression";

export interface CodexEntry {
  monsterId: string;
  name: string;
  color: number;
  isBoss: boolean;
  timesDefeated: number;
  /** AC is only revealed when the player deduces it empirically. */
  acDiscovered: boolean;
  ac: number;
  hp: number;
  xpReward: number;
  goldReward: number;
  /** Item IDs that the player has seen this monster drop. */
  itemsDropped: string[];
  /** Elements whose resistance, weakness, or immunity has been observed. */
  discoveredElements: Element[];
  /** Observed physical affinities scoped to a whole target or one canonical part. */
  discoveredPhysical: PhysicalDiscovery[];
}

export interface CodexData {
  entries: Record<string, CodexEntry>;
  unlockedEntryIds: string[];
}

export type CodexMonsterSort = "family" | "name" | "defeated" | "element";
export type CodexKnowledgeSort = "category" | "name" | "source";

export type CodexUnlockSignal =
  | { readonly type: "prestigeRank"; readonly trackId: PrestigeTrackId; readonly rank: number }
  | {
    readonly type: "location";
    readonly locationKind: "city" | "dungeon";
    readonly targetId: string;
  }
  | {
    readonly type: "questStage";
    readonly questId: QuestId;
    readonly stageId: string;
  }
  | {
    readonly type: "questCompletion";
    readonly questId: QuestId;
  }
  | {
    readonly type: "cutscene";
    readonly cutsceneId: string;
  }
  | {
    readonly type: "itemAcquired";
    readonly itemId: string;
  }
  | {
    readonly type: "npcDialogue";
    readonly npcId: string;
  }
  | {
    readonly type: "readable";
    readonly readableId: string;
  }
  | {
    readonly type: "devotionTemple";
    readonly templeId: TempleId;
  }
  | {
    readonly type: "devotionAffiliation";
    readonly deityId: DeityId;
  };

export type CodexFutureUnlockSignal =
  | {
    readonly type: "worldEvent";
    readonly eventId: string;
  }
  | {
    readonly type: "reputationMilestone";
    readonly factionId: string;
    readonly milestoneId: string;
  };

export interface CodexUnlockResult {
  readonly unlockedIds: readonly string[];
  readonly entries: readonly CodexKnowledgeEntry[];
}

export interface CodexKnowledgeQuery {
  readonly category?: CodexKnowledgeCategory;
  readonly search?: string;
  readonly sort?: CodexKnowledgeSort;
  readonly groupDiscovered?: boolean;
}

export interface CodexFamilyProgress {
  family: MonsterFamily;
  discovered: number;
  total: number;
  complete: boolean;
}

/** Create an empty bestiary. */
export function createCodex(): CodexData {
  return { entries: {}, unlockedEntryIds: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeMonsterEntry(
  monsterId: string,
  value: unknown,
  allowPhysicalDiscoveries: boolean,
): CodexEntry | undefined {
  const monster = getMonster(monsterId);
  if (!monster || !isRecord(value)) return undefined;
  const timesDefeated = typeof value["timesDefeated"] === "number"
      && Number.isInteger(value["timesDefeated"])
    ? Math.max(0, value["timesDefeated"])
    : 0;
  const itemIds = new Set(ITEMS.map((item) => item.id));
  const itemsDropped = Array.isArray(value["itemsDropped"])
    ? [...new Set(value["itemsDropped"].filter(
      (itemId): itemId is string =>
        typeof itemId === "string" && itemIds.has(itemId),
    ))]
    : [];
  const discoveredElements = Array.isArray(value["discoveredElements"])
    ? [...new Set(value["discoveredElements"].filter(isElement))]
    : [];
  return {
    monsterId,
    name: monster.name,
    color: monster.color,
    isBoss: monster.isBoss,
    timesDefeated,
    acDiscovered: value["acDiscovered"] === true,
    ac: monster.ac,
    hp: monster.hp,
    xpReward: monster.xpReward,
    goldReward: monster.goldReward,
    itemsDropped,
    discoveredElements,
    discoveredPhysical: allowPhysicalDiscoveries
      ? normalizePhysicalDiscoveries(monster, value["discoveredPhysical"]) : [],
  };
}

export function normalizeCodexData(value: unknown, allowPhysicalDiscoveries = true): CodexData {
  if (!isRecord(value)) return createCodex();
  const normalized = createCodex();
  const rawEntries = value["entries"];
  if (isRecord(rawEntries)) {
    for (const [monsterId, rawEntry] of Object.entries(rawEntries)) {
      const entry = normalizeMonsterEntry(monsterId, rawEntry, allowPhysicalDiscoveries);
      if (entry) normalized.entries[monsterId] = entry;
    }
  }
  const rawUnlockedIds = value["unlockedEntryIds"];
  if (Array.isArray(rawUnlockedIds)) {
    normalized.unlockedEntryIds = [...new Set(
      rawUnlockedIds.filter(isCodexKnowledgeId),
    )];
  }
  return normalized;
}

function sourceMatchesSignal(
  source: CodexUnlockSource,
  signal: CodexUnlockSignal | CodexFutureUnlockSignal,
): boolean {
  if (source.type !== signal.type) return false;
  switch (source.type) {
    case "location":
      return signal.type === "location"
        && source.locationKind === signal.locationKind
        && source.targetId === signal.targetId;
    case "questStage":
      return signal.type === "questStage"
        && source.questId === signal.questId
        && source.stageId === signal.stageId;
    case "questCompletion":
      return signal.type === "questCompletion"
        && source.questId === signal.questId;
    case "cutscene":
      return signal.type === "cutscene"
        && source.cutsceneId === signal.cutsceneId;
    case "itemAcquired":
      return signal.type === "itemAcquired"
        && source.itemId === signal.itemId;
    case "npcDialogue":
      return signal.type === "npcDialogue"
        && source.npcId === signal.npcId;
    case "readable":
      return signal.type === "readable"
        && source.readableId === signal.readableId;
    case "worldEvent":
      return signal.type === "worldEvent"
        && source.eventId === signal.eventId;
    case "reputationMilestone":
      return signal.type === "reputationMilestone"
        && source.factionId === signal.factionId
        && source.milestoneId === signal.milestoneId;
    case "devotionTemple":
      return signal.type === "devotionTemple" && source.templeId === signal.templeId;
    case "devotionAffiliation":
      return signal.type === "devotionAffiliation" && source.deityId === signal.deityId;
    case "prestigeRank":
      return signal.type === "prestigeRank" && source.trackId === signal.trackId
        && Number.isInteger(signal.rank) && signal.rank >= source.minimumRank && signal.rank <= 5;
  }
}

export function unlockCodexEntries(
  codex: CodexData,
  entryIds: readonly string[],
): CodexUnlockResult {
  const knownIds = new Set(codex.unlockedEntryIds);
  const unlockedIds: string[] = [];
  for (const entryId of entryIds) {
    if (!isCodexKnowledgeId(entryId) || knownIds.has(entryId)) continue;
    knownIds.add(entryId);
    codex.unlockedEntryIds.push(entryId);
    unlockedIds.push(entryId);
  }
  return {
    unlockedIds,
    entries: unlockedIds
      .map(getCodexKnowledgeEntry)
      .filter((entry): entry is CodexKnowledgeEntry => entry !== undefined),
  };
}

export function unlockCodexFromSignal(
  codex: CodexData,
  signal: CodexUnlockSignal,
): CodexUnlockResult {
  return unlockCodexEntries(
    codex,
    CODEX_KNOWLEDGE_ENTRIES
      .filter((entry) =>
        entry.sources.some((source) => sourceMatchesSignal(source, signal))
      )
      .map((entry) => entry.id),
  );
}

/**
 * Reserved dispatch boundary for #69 world events and #70 reputation.
 * Active scenes must not call this until those systems own the signal.
 */
export function unlockCodexFromFutureSignal(
  codex: CodexData,
  signal: CodexFutureUnlockSignal,
): CodexUnlockResult {
  return unlockCodexEntries(
    codex,
    CODEX_KNOWLEDGE_ENTRIES
      .filter((entry) =>
        entry.sources.some((source) => sourceMatchesSignal(source, signal))
      )
      .map((entry) => entry.id),
  );
}

function collectOwnedItemIds(player: PlayerState): Set<string> {
  const ids = new Set<string>();
  for (const item of player.inventory) ids.add(item.id);
  if (player.equippedWeapon) ids.add(player.equippedWeapon.id);
  if (player.equippedOffHand) ids.add(player.equippedOffHand.id);
  if (player.equippedArmor) ids.add(player.equippedArmor.id);
  if (player.equippedShield) ids.add(player.equippedShield.id);
  for (const companion of player.party.companions) {
    for (const item of companion.inventory) ids.add(item.id);
    if (companion.equippedWeapon) ids.add(companion.equippedWeapon.id);
    if (companion.equippedOffHand) ids.add(companion.equippedOffHand.id);
    if (companion.equippedArmor) ids.add(companion.equippedArmor.id);
    if (companion.equippedShield) ids.add(companion.equippedShield.id);
  }
  return ids;
}

export function replayCodexUnlocks(
  codex: CodexData,
  player: PlayerState,
): CodexUnlockResult {
  const unlockedIds: string[] = [];
  const apply = (signal: CodexUnlockSignal): void => {
    unlockedIds.push(...unlockCodexFromSignal(codex, signal).unlockedIds);
  };
  const applyFuture = (signal: CodexFutureUnlockSignal): void => {
    unlockedIds.push(...unlockCodexFromFutureSignal(codex, signal).unlockedIds);
  };
  for (const templeId of player.progression.devotion.visitedTempleIds) {
    apply({ type: "devotionTemple", templeId });
  }
  if (player.progression.devotion.deityId) {
    apply({ type: "devotionAffiliation", deityId: player.progression.devotion.deityId });
  }
  for (const path of PRESTIGE_PATHS) {
    const rank = getTrackLevel(player, path.id);
    if (rank > 0) apply({ type: "prestigeRank", trackId: path.id, rank });
  }

  for (const [factionId, score] of Object.entries(
    player.progression.social.factionReputation,
  )) {
    const tierIndex = [...REPUTATION_TIERS].reverse().findIndex(
      (tier) => (score ?? 0) >= tier.minimum,
    );
    const resolvedTier = tierIndex < 0
      ? REPUTATION_TIERS[0]
      : [...REPUTATION_TIERS].reverse()[tierIndex]!;
    const resolvedIndex = REPUTATION_TIERS.findIndex(
      (tier) => tier.id === resolvedTier.id,
    );
    for (const milestoneId of REPUTATION_MILESTONE_IDS) {
      const milestoneIndex = REPUTATION_TIERS.findIndex(
        (tier) => tier.id === milestoneId,
      );
      if (milestoneIndex > resolvedIndex) continue;
      applyFuture({
        type: "reputationMilestone",
        factionId,
        milestoneId,
      });
    }
  }

  for (const cityId of player.progression.discoveredCities) {
    apply({ type: "location", locationKind: "city", targetId: cityId });
  }
  if (player.position.inCity && player.position.cityId) {
    apply({
      type: "location",
      locationKind: "city",
      targetId: player.position.cityId,
    });
  }
  if (player.position.inDungeon && player.position.dungeonId) {
    apply({
      type: "location",
      locationKind: "dungeon",
      targetId: player.position.dungeonId,
    });
  }
  for (const key of Object.keys(player.progression.exploredTiles)) {
    if (!key.startsWith("d:")) continue;
    const dungeonId = key.slice(2).split(",")[0];
    if (dungeonId) {
      apply({ type: "location", locationKind: "dungeon", targetId: dungeonId });
    }
  }

  for (const itemId of collectOwnedItemIds(player)) {
    apply({ type: "itemAcquired", itemId });
  }
  for (const record of player.progression.worldEvents.log) {
    applyFuture({ type: "worldEvent", eventId: record.eventId });
  }
  for (const cutsceneId of player.progression.seenCutsceneIds) {
    apply({ type: "cutscene", cutsceneId });
  }
  for (const [questId, progress] of Object.entries(
    player.progression.quests.quests,
  ) as [QuestId, PlayerState["progression"]["quests"]["quests"][QuestId]][]) {
    if (progress.status === "locked") continue;
    const definition = QUESTS[questId];
    const reachedStage = progress.status === "completed"
      ? definition.stages.length - 1
      : Math.min(progress.stage, definition.stages.length - 1);
    for (let index = 0; index <= reachedStage; index++) {
      apply({
        type: "questStage",
        questId,
        stageId: definition.stages[index]!.id,
      });
    }
    if (progress.status === "completed") {
      apply({ type: "questCompletion", questId });
    }
  }

  return {
    unlockedIds,
    entries: unlockedIds
      .map(getCodexKnowledgeEntry)
      .filter((entry): entry is CodexKnowledgeEntry => entry !== undefined),
  };
}

export function isCodexKnowledgeUnlocked(
  codex: CodexData,
  entryId: string,
): boolean {
  return codex.unlockedEntryIds.includes(entryId);
}

function sourceSortLabel(entry: CodexKnowledgeEntry): string {
  return entry.sources[0]?.label ?? "";
}

export function getCodexKnowledgeList(
  codex: CodexData,
  query: CodexKnowledgeQuery = {},
): CodexKnowledgeEntry[] {
  const normalizedSearch = query.search?.trim().toLocaleLowerCase() ?? "";
  const categoryOrder = new Map(
    CODEX_KNOWLEDGE_CATEGORIES.map((category, index) => [category, index]),
  );
  const entries = CODEX_KNOWLEDGE_ENTRIES.filter((entry) => {
    if (query.category && entry.category !== query.category) return false;
    if (!normalizedSearch) return true;
    return [
      entry.name,
      entry.summary,
      ...entry.details,
      ...entry.tags,
    ].some((text) => text.toLocaleLowerCase().includes(normalizedSearch));
  }).slice();

  entries.sort((a, b) => {
    if (query.groupDiscovered) {
      const discoveredDifference = Number(isCodexKnowledgeUnlocked(codex, b.id))
        - Number(isCodexKnowledgeUnlocked(codex, a.id));
      if (discoveredDifference !== 0) return discoveredDifference;
    }
    switch (query.sort ?? "category") {
      case "name":
        return a.name.localeCompare(b.name);
      case "source":
        return sourceSortLabel(a).localeCompare(sourceSortLabel(b))
          || a.name.localeCompare(b.name);
      case "category": {
        const categoryDifference = (categoryOrder.get(a.category) ?? 0)
          - (categoryOrder.get(b.category) ?? 0);
        return categoryDifference
          || a.sortOrder - b.sortOrder
          || a.name.localeCompare(b.name);
      }
    }
  });
  return entries;
}

/** Record a monster defeat. Adds the entry if first time. */
export function recordDefeat(
  bestiary: CodexData,
  monster: Monster,
  acWasDiscovered: boolean,
  droppedItemIds: string[]
): CodexEntry {
  let entry = bestiary.entries[monster.id];
  if (!entry) {
    entry = {
      monsterId: monster.id,
      name: monster.name,
      color: monster.color,
      isBoss: monster.isBoss,
      timesDefeated: 0,
      acDiscovered: false,
      ac: monster.ac,
      hp: monster.hp,
      xpReward: monster.xpReward,
      goldReward: monster.goldReward,
      itemsDropped: [],
      discoveredElements: [],
      discoveredPhysical: [],
    };
    bestiary.entries[monster.id] = entry;
  }
  if (!entry.discoveredElements) entry.discoveredElements = [];
  if (!entry.discoveredPhysical) entry.discoveredPhysical = [];

  entry.timesDefeated++;
  if (acWasDiscovered) {
    entry.acDiscovered = true;
  }

  for (const itemId of droppedItemIds) {
    if (!entry.itemsDropped.includes(itemId)) {
      entry.itemsDropped.push(itemId);
    }
  }

  return entry;
}

/** Mark AC as discovered for a monster (can happen mid-combat). */
export function discoverAC(bestiary: CodexData, monsterId: string): void {
  const entry = bestiary.entries[monsterId];
  if (entry) {
    entry.acDiscovered = true;
  }
}

/** Record an elemental interaction observed during combat. */
export function discoverElement(
  bestiary: CodexData,
  monsterId: string,
  element: Element,
): void {
  const entry = bestiary.entries[monsterId];
  if (!entry) return;
  if (!entry.discoveredElements) entry.discoveredElements = [];
  if (!entry.discoveredElements.includes(element)) {
    entry.discoveredElements.push(element);
  }
}

/** Keep only canonical, non-neutral observations; a part never reveals whole-body knowledge. */
export function normalizePhysicalDiscoveries(
  monster: Monster,
  value: unknown,
): PhysicalDiscovery[] {
  if (!Array.isArray(value)) return [];
  const result: PhysicalDiscovery[] = [];
  for (const raw of value) {
    if (!isRecord(raw) || !isPhysicalDamageType(raw["damageType"])) continue;
    const rawPartId = raw["bodyPartId"];
    const part = rawPartId === undefined ? undefined : getTargetableBodyParts(monster)
      .find((candidate) => candidate.id === rawPartId);
    if (rawPartId !== undefined && !part) continue;
    const damageType = raw["damageType"];
    const bodyPartId = part?.id;
    if (!applyPhysicalModifier(1, damageType, monster.physicalProfile, part?.physicalProfile).interaction
      || result.some((entry) => entry.damageType === damageType && entry.bodyPartId === bodyPartId)) continue;
    result.push({ damageType, ...(bodyPartId ? { bodyPartId } : {}) });
  }
  return result;
}

export function discoverPhysical(
  codex: CodexData,
  monster: Monster,
  discovery: PhysicalDiscovery,
): void {
  const entry = codex.entries[monster.id];
  if (!entry) return;
  entry.discoveredPhysical = normalizePhysicalDiscoveries(
    monster, [...(entry.discoveredPhysical ?? []), discovery],
  );
}

export function getObservedPhysicalLines(
  monster: Monster,
  discoveries: readonly PhysicalDiscovery[],
): string[] {
  return discoveries.map((discovery) => {
    const part = getBodyPart(monster, discovery.bodyPartId);
    const result = applyPhysicalModifier(
      1, discovery.damageType, monster.physicalProfile, part?.physicalProfile,
    );
    const label = result.interaction === "immune" ? "Immune"
      : result.interaction === "weak" ? "Weak" : "Resists";
    return `- ${part?.label ?? "Whole target"}: ${label} to ${physicalDamageTypeName(discovery.damageType)}`;
  });
}

/** Get all bestiary entries sorted: bosses last, then alphabetical. */
export function getCodexEntries(bestiary: CodexData): CodexEntry[] {
  return Object.values(bestiary.entries).sort((a, b) => {
    if (a.isBoss !== b.isBoss) return a.isBoss ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
}

export function getCodexFamilyProgress(
  bestiary: CodexData,
  familyId: MonsterFamilyId,
): CodexFamilyProgress {
  const family = getMonsterFamily(familyId);
  const members = ALL_MONSTERS.filter((monster) => monster.family === familyId);
  const discovered = members.filter(
    (monster) => monster.id in bestiary.entries,
  ).length;
  return {
    family,
    discovered,
    total: members.length,
    complete: members.length > 0 && discovered === members.length,
  };
}

export function getCodexFamilyProgressList(
  bestiary: CodexData,
): CodexFamilyProgress[] {
  return MONSTER_FAMILIES.map((family) =>
    getCodexFamilyProgress(bestiary, family.id)
  );
}

function compareByFamily(a: Monster, b: Monster): number {
  const familyOrder = getMonsterFamily(a.family).sortOrder
    - getMonsterFamily(b.family).sortOrder;
  if (familyOrder !== 0) return familyOrder;
  if (a.isBoss !== b.isBoss) return a.isBoss ? 1 : -1;
  if (a.xpReward !== b.xpReward) return a.xpReward - b.xpReward;
  return a.name.localeCompare(b.name);
}

export function getCodexMonsterList(
  bestiary: CodexData,
  sort: CodexMonsterSort = "family",
  familyId?: MonsterFamilyId,
  search = "",
): Monster[] {
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const monsters = ALL_MONSTERS
    .filter((monster) => !familyId || monster.family === familyId)
    .filter((monster) =>
      !normalizedSearch
      || monster.name.toLocaleLowerCase().includes(normalizedSearch)
      || getMonsterFamily(monster.family).name
        .toLocaleLowerCase()
        .includes(normalizedSearch)
    )
    .slice();
  monsters.sort((a, b) => {
    switch (sort) {
      case "family":
        return compareByFamily(a, b);
      case "name":
        return a.name.localeCompare(b.name);
      case "defeated": {
        const difference = (bestiary.entries[b.id]?.timesDefeated ?? 0)
          - (bestiary.entries[a.id]?.timesDefeated ?? 0);
        return difference || compareByFamily(a, b);
      }
      case "element": {
        const difference = (a.affinity ?? "none").localeCompare(
          b.affinity ?? "none",
        );
        return difference || compareByFamily(a, b);
      }
    }
  });
  return monsters;
}

export function getCodexEntryMonster(
  entry: CodexEntry,
): Monster | undefined {
  return getMonster(entry.monsterId);
}

/** Check if a monster has been encountered. */
export function hasEncountered(bestiary: CodexData, monsterId: string): boolean {
  return monsterId in bestiary.entries;
}
