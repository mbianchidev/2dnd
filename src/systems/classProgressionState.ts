import {
  ASI_LEVELS,
  ASI_POINTS,
  BASE_CLASS_IDS,
  DEFAULT_PROGRESSION_CONTEXT,
  MAX_ABILITY_SCORE,
  NORMAL_LEVEL_CAP,
  STARTING_RESOURCE_RULES,
  getProgressionProfile,
  isBaseClassId,
  isExternalProgressionTrackId,
  type HeroProgressionContext,
} from "../data/classProgression";
import { getAbility } from "../data/abilities";
import type { Item } from "../data/items";
import { getSpell } from "../data/spells";
import { getTalent } from "../data/talents";
import { debugLog } from "../config";
import { getPlayerClass } from "./classes";
import { abilityModifier } from "./dice";
import {
  heroItemsMatch,
  isSerializedHeroItem,
  normalizeSerializedHeroItem,
} from "./heroItemState";
import {
  createHeroClassProgression,
  getAvailableProgressionGrants,
  getEarnedPendingLevels,
  getProgressionTracks,
  getTotalLevel,
  type HeroClassProgression,
  type PendingHeroLevelUp,
  type ProgressionKnownGrants,
} from "./classProgression";
import type { CombatActorState, PlayerState, PlayerStats } from "./player";

export const CLASS_PROGRESSION_SAVE_VERSION = 19;

export type NormalizedHeroProgressionFields = Pick<PlayerState,
  | "name" | "appearanceId" | "level" | "classProgression" | "xp"
  | "stats" | "hp" | "maxHp" | "mp" | "maxMp"
  | "pendingStatPoints" | "pendingLevelUps"
  | "knownSpells" | "knownAbilities" | "knownTalents" | "inventory"
  | "equippedWeapon" | "equippedOffHand" | "equippedArmor" | "equippedShield"
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function integer(value: unknown, fallback: number, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): number {
  return typeof value === "number" && Number.isSafeInteger(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

function knownIds(value: unknown, isKnown: (id: string) => boolean): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((entry): entry is string => typeof entry === "string" && isKnown(entry)))]
    : [];
}

function normalizeGrants(value: unknown): ProgressionKnownGrants {
  const record = isRecord(value) ? value : {};
  return {
    spells: knownIds(record["spells"], (id) => getSpell(id) !== undefined),
    abilities: knownIds(record["abilities"], (id) => getAbility(id) !== undefined),
    talents: knownIds(record["talents"], (id) => getTalent(id) !== undefined),
  };
}

function normalizePendingLevel(value: unknown, total: number): PendingHeroLevelUp | null {
  if (!isRecord(value)) return null;
  const { expectedTotalLevel, resourceRoll, constitution, intelligence } = value;
  if (expectedTotalLevel !== total || total >= NORMAL_LEVEL_CAP
    || typeof resourceRoll !== "number" || !Number.isFinite(resourceRoll)
    || resourceRoll < 0 || resourceRoll >= 1
    || typeof constitution !== "number" || !Number.isInteger(constitution)
    || constitution < 1 || constitution > MAX_ABILITY_SCORE
    || typeof intelligence !== "number" || !Number.isInteger(intelligence)
    || intelligence < 1 || intelligence > MAX_ABILITY_SCORE) return null;
  return Object.freeze({ expectedTotalLevel: total, resourceRoll, constitution, intelligence });
}

/** Recover ownership from unknown data; earned ranks never recheck mutable entry scores. */
export function normalizeHeroClassProgression(
  value: unknown,
  fallback: { appearanceId: unknown; level: unknown },
  context: HeroProgressionContext = DEFAULT_PROGRESSION_CONTEXT,
): HeroClassProgression {
  const fallbackClass = getPlayerClass(typeof fallback.appearanceId === "string" ? fallback.appearanceId : "knight").id;
  const fallbackLevel = integer(fallback.level, 1, 1, NORMAL_LEVEL_CAP);
  const record = isRecord(value) ? value : {};
  const startingClassId = isBaseClassId(record["startingClassId"])
    ? record["startingClassId"] : fallbackClass;
  const rawLevels = isRecord(record["classLevels"]) ? record["classLevels"] : {};
  const rawTracks = isRecord(record["trackLevels"]) ? record["trackLevels"] : {};
  const hasUsableOwnership = BASE_CLASS_IDS.some((id) =>
    typeof rawLevels[id] === "number" && Number.isSafeInteger(rawLevels[id]) && rawLevels[id] > 0
  ) || context.profiles.some((profile) => {
    const rank = rawTracks[profile.id];
    return profile.kind === "prestige" && typeof rank === "number"
      && Number.isSafeInteger(rank) && rank > 0;
  });
  if (!hasUsableOwnership) return createHeroClassProgression(startingClassId, fallbackLevel);
  const progression = createHeroClassProgression(startingClassId);
  let remaining = NORMAL_LEVEL_CAP;
  const orderedIds = [startingClassId, ...BASE_CLASS_IDS.filter((id) => id !== startingClassId)];
  for (const id of orderedIds) {
    const minimum = id === startingClassId ? 1 : 0;
    const rank = integer(rawLevels[id], minimum, minimum, remaining);
    if (rank > 0) progression.classLevels[id] = rank;
    remaining -= rank;
  }
  for (const profile of context.profiles) {
    if (profile.kind !== "prestige" || !isExternalProgressionTrackId(profile.id)) continue;
    const rank = integer(rawTracks[profile.id], 0, 0, Math.min(profile.maxRank, remaining));
    if (rank > 0) progression.trackLevels[profile.id] = rank;
    remaining -= rank;
  }
  progression.legacyGrants = normalizeGrants(record["legacyGrants"]);
  const deferred = normalizeGrants(record["deferredLegacyGrants"]);
  if (deferred.spells.length + deferred.abilities.length + deferred.talents.length > 0) {
    progression.deferredLegacyGrants = deferred;
  }
  const total = NORMAL_LEVEL_CAP - remaining;
  progression.pendingLevel = normalizePendingLevel(record["pendingLevel"], total);
  progression.readyLevelUps = integer(record["readyLevelUps"],
    progression.pendingLevel ? 1 : 0, 0, NORMAL_LEVEL_CAP - total);
  return progression;
}

function normalizeStats(value: Record<string, unknown>): PlayerStats {
  return {
    strength: integer(value["strength"], 10, 1, MAX_ABILITY_SCORE),
    dexterity: integer(value["dexterity"], 10, 1, MAX_ABILITY_SCORE),
    constitution: integer(value["constitution"], 10, 1, MAX_ABILITY_SCORE),
    intelligence: integer(value["intelligence"], 10, 1, MAX_ABILITY_SCORE),
    wisdom: integer(value["wisdom"], 10, 1, MAX_ABILITY_SCORE),
    charisma: integer(value["charisma"], 10, 1, MAX_ABILITY_SCORE),
  };
}

function normalizeInventory(value: readonly unknown[]): Item[] {
  return value.flatMap((entry) => {
    const item = normalizeSerializedHeroItem(entry);
    return item ? [item] : [];
  });
}

function relinkEquipment(
  inventory: Item[],
  value: unknown,
  type: "weapon" | "armor" | "shield",
  preserveLegacy: boolean,
): Item | null {
  const id = typeof value === "string" ? value
    : isRecord(value) && typeof value["id"] === "string" ? value["id"] : undefined;
  if (!id) return null;
  const savedEffect = isRecord(value) ? value["effect"] : undefined;
  const savedCost = isRecord(value) ? value["cost"] : undefined;
  const candidates = inventory.filter((item) => item.id === id && item.type === type);
  if (isSerializedHeroItem(value)) {
    const exact = candidates.find((item) => heroItemsMatch(item, value));
    if (exact) return exact;
    if (!preserveLegacy || value.type !== type) {
      debugLog(`[save] Removed unlinked ${type} equipment ${id}.`);
      return null;
    }
    const recovered = { ...value };
    inventory.push(recovered);
    return recovered;
  }
  const match = candidates.find((item) =>
    (typeof savedEffect !== "number" || item.effect === savedEffect)
    && (typeof savedCost !== "number" || item.cost === savedCost)
  ) ?? candidates[0];
  if (match) return match;
  if (!preserveLegacy) return null;
  const recovered = normalizeSerializedHeroItem(typeof value === "string" ? { id } : value);
  if (recovered?.type !== type) return null;
  inventory.push(recovered);
  return recovered;
}

function resourceFallback(
  actor: CombatActorState,
  context: HeroProgressionContext,
): { maxHp: number; maxMp: number } {
  const constitution = abilityModifier(actor.stats.constitution);
  const intelligence = abilityModifier(actor.stats.intelligence);
  let maxHp = Math.max(STARTING_RESOURCE_RULES.hp.minimum,
    STARTING_RESOURCE_RULES.hp.base + constitution * STARTING_RESOURCE_RULES.hp.multiplier);
  let maxMp = Math.max(STARTING_RESOURCE_RULES.mp.minimum,
    STARTING_RESOURCE_RULES.mp.base + intelligence * STARTING_RESOURCE_RULES.mp.multiplier);
  for (const track of getProgressionTracks(actor, context)) {
    const profile = getProgressionProfile(track.id, context);
    if (!profile) continue;
    const growthLevels = track.level - (track.id === actor.classProgression?.startingClassId ? 1 : 0);
    maxHp += growthLevels * Math.max(profile.hpGrowth.minimum,
      Math.floor(profile.hpGrowth.hitDie / 2) + 1 + constitution);
    maxMp += growthLevels * Math.max(profile.mpGrowth.minimum, profile.mpGrowth.base + intelligence);
  }
  for (const id of getAvailableProgressionGrants(actor, context).talents) {
    const talent = getTalent(id);
    maxHp += talent?.maxHpBonus ?? 0;
    maxMp += talent?.maxMpBonus ?? 0;
  }
  return { maxHp, maxMp };
}

function mergeKnownIds(saved: readonly string[], earned: readonly string[], inherited: readonly string[]): string[] {
  const permitted = new Set([...earned, ...inherited]);
  return [...new Set([...saved.filter((id) => permitted.has(id)), ...earned, ...inherited])];
}

/** Normalize hero core/progression together while preserving valid rolled resources and equipment. */
export function normalizeHeroProgressionState(
  value: unknown,
  sourceVersion: number,
  context: HeroProgressionContext = DEFAULT_PROGRESSION_CONTEXT,
): NormalizedHeroProgressionFields | null {
  if (!isRecord(value) || typeof value["name"] !== "string" || !value["name"].trim()
    || !isRecord(value["stats"]) || !Array.isArray(value["inventory"])) return null;
  const legacy = sourceVersion < CLASS_PROGRESSION_SAVE_VERSION;
  const appearanceId = typeof value["appearanceId"] === "string" ? value["appearanceId"] : "knight";
  const classProgression = normalizeHeroClassProgression(
    legacy ? undefined : value["classProgression"],
    { appearanceId, level: value["level"] }, context,
  );
  const stats = normalizeStats(value["stats"]);
  const inventory = normalizeInventory(value["inventory"]);
  const fields: NormalizedHeroProgressionFields = {
    name: value["name"],
    appearanceId,
    level: 1,
    classProgression,
    xp: integer(value["xp"], 0),
    stats,
    hp: 1, maxHp: 1, mp: 0, maxMp: 0,
    pendingStatPoints: 0,
    pendingLevelUps: 0,
    knownSpells: knownIds(value["knownSpells"], (id) => getSpell(id) !== undefined),
    knownAbilities: knownIds(value["knownAbilities"], (id) => getAbility(id) !== undefined),
    knownTalents: knownIds(value["knownTalents"], (id) => getTalent(id) !== undefined),
    inventory,
    equippedWeapon: relinkEquipment(inventory, value["equippedWeapon"], "weapon", legacy),
    equippedOffHand: relinkEquipment(inventory, value["equippedOffHand"], "weapon", legacy),
    equippedArmor: relinkEquipment(inventory, value["equippedArmor"], "armor", legacy),
    equippedShield: relinkEquipment(inventory, value["equippedShield"], "shield", legacy),
  };
  const actor = { ...fields, activeEffects: [] };
  fields.level = getTotalLevel(actor);
  actor.level = fields.level;
  const earned = getAvailableProgressionGrants(actor, context);
  if (legacy) {
    classProgression.legacyGrants = {
      spells: fields.knownSpells.filter((id) => !earned.spells.includes(id)),
      abilities: fields.knownAbilities.filter((id) => !earned.abilities.includes(id)),
      talents: fields.knownTalents.filter((id) => !earned.talents.includes(id)),
    };
    const deferred: ProgressionKnownGrants = {
      spells: earned.spells.filter((id) => !fields.knownSpells.includes(id)),
      abilities: earned.abilities.filter((id) => !fields.knownAbilities.includes(id)),
      talents: earned.talents.filter((id) => !fields.knownTalents.includes(id)),
    };
    if (deferred.spells.length + deferred.abilities.length + deferred.talents.length > 0) {
      classProgression.deferredLegacyGrants = deferred;
    }
  }
  const deferred = classProgression.deferredLegacyGrants;
  if (deferred) {
    deferred.spells = deferred.spells.filter((id) => earned.spells.includes(id) && !fields.knownSpells.includes(id));
    deferred.abilities = deferred.abilities.filter((id) => earned.abilities.includes(id) && !fields.knownAbilities.includes(id));
    deferred.talents = deferred.talents.filter((id) => earned.talents.includes(id) && !fields.knownTalents.includes(id));
    if (deferred.spells.length + deferred.abilities.length + deferred.talents.length === 0) {
      delete classProgression.deferredLegacyGrants;
    }
  }
  fields.knownSpells = mergeKnownIds(fields.knownSpells,
    earned.spells.filter((id) => !deferred?.spells.includes(id)), classProgression.legacyGrants.spells);
  fields.knownAbilities = mergeKnownIds(fields.knownAbilities,
    earned.abilities.filter((id) => !deferred?.abilities.includes(id)), classProgression.legacyGrants.abilities);
  fields.knownTalents = mergeKnownIds(fields.knownTalents,
    earned.talents.filter((id) => !deferred?.talents.includes(id)), classProgression.legacyGrants.talents);
  const fallback = resourceFallback(actor, context);
  fields.maxHp = integer(value["maxHp"], fallback.maxHp, 1);
  fields.maxMp = integer(value["maxMp"], fallback.maxMp);
  fields.hp = integer(value["hp"], fields.maxHp, 0, fields.maxHp);
  fields.mp = integer(value["mp"], fields.maxMp, 0, fields.maxMp);
  fields.pendingLevelUps = integer(value["pendingLevelUps"], getEarnedPendingLevels(actor),
    0, getEarnedPendingLevels(actor));
  fields.pendingStatPoints = integer(value["pendingStatPoints"], 0, 0,
    ASI_LEVELS.filter((level) => level <= fields.level).length * ASI_POINTS);
  classProgression.readyLevelUps = Math.min(classProgression.readyLevelUps, fields.pendingLevelUps);
  if (classProgression.readyLevelUps === 0) classProgression.pendingLevel = null;
  if (fields.equippedWeapon?.twoHanded) {
    fields.equippedShield = null;
    fields.equippedOffHand = null;
  }
  if (fields.equippedShield || !fields.equippedWeapon?.light
    || !fields.equippedOffHand?.light || fields.equippedOffHand?.twoHanded
    || fields.equippedWeapon?.id === fields.equippedOffHand?.id) {
    fields.equippedOffHand = null;
  }
  if (!legacy && (value["level"] !== fields.level
    || (isRecord(value["classProgression"]) && value["classProgression"]["pendingLevel"]
      && !classProgression.pendingLevel))) {
    debugLog("[progression] Repaired class-level totals or an invalid pending-level receipt.");
  }
  return fields;
}
