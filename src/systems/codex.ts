/**
 * Bestiary system: tracks defeated monsters and discovered stats.
 * Stats are only revealed as the player discovers them through combat.
 */

import { ALL_MONSTERS, getMonster, type Monster } from "../data/monsters";
import type { Element } from "../data/elements";
import {
  getMonsterFamily,
  MONSTER_FAMILIES,
  type MonsterFamily,
  type MonsterFamilyId,
} from "../data/monsterFamilies";

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
}

export interface CodexData {
  entries: Record<string, CodexEntry>;
}

export type CodexMonsterSort = "family" | "name" | "defeated" | "element";

export interface CodexFamilyProgress {
  family: MonsterFamily;
  discovered: number;
  total: number;
  complete: boolean;
}

/** Create an empty bestiary. */
export function createCodex(): CodexData {
  return { entries: {} };
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
    };
    bestiary.entries[monster.id] = entry;
  }
  if (!entry.discoveredElements) entry.discoveredElements = [];

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
): Monster[] {
  const monsters = ALL_MONSTERS
    .filter((monster) => !familyId || monster.family === familyId)
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
