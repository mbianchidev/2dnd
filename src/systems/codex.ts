/**
 * Bestiary system: tracks defeated monsters and discovered stats.
 * Stats are only revealed as the player discovers them through combat.
 */

import type { Monster } from "../data/monsters";

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
}

export interface CodexData {
  entries: Record<string, CodexEntry>;
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
    };
    bestiary.entries[monster.id] = entry;
  }

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

/** Get all bestiary entries sorted: bosses last, then alphabetical. */
export function getCodexEntries(bestiary: CodexData): CodexEntry[] {
  return Object.values(bestiary.entries).sort((a, b) => {
    if (a.isBoss !== b.isBoss) return a.isBoss ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
}

/** Check if a monster has been encountered. */
export function hasEncountered(bestiary: CodexData, monsterId: string): boolean {
  return monsterId in bestiary.entries;
}
