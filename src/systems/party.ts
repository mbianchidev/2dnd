import {
  COMPANION_IDS,
  getCompanionDefinition,
  isCompanionId,
  type CompanionControlMode,
  type CompanionId,
  type CompanionLoadout,
} from "../data/companions";
import { getAbility } from "../data/abilities";
import { getItem, type Item } from "../data/items";
import { getSpell } from "../data/spells";
import { TALENTS } from "../data/talents";
import { abilityModifier } from "./dice";
import {
  createBattleActionSource,
  type BattleActionSource,
} from "./battleActions";
import { getClassAbilities, getClassSpells, getPlayerClass } from "./classes";
import {
  createPartyCombatant,
  type PartyCombatant,
} from "./groupCombat";
import {
  getArmorClass,
  xpForLevel,
  type CombatActorState,
  type PlayerState,
  type ProgressingActorState,
  type PlayerStats,
} from "./player";
import { normalizeActiveEffects, type ActiveStatusEffect } from "./statusEffects";
import { normalizeGambitRules, type GambitRule } from "./gambits";
import { replayQuestCompletionActions } from "./quests";

export const MAX_ACTIVE_COMPANIONS = 3;

export interface CompanionState extends CombatActorState {
  id: CompanionId;
  xp: number;
  pendingStatPoints: number;
  pendingLevelUps: number;
  customAppearance: {
    skinColor: number;
    hairStyle: number;
    hairColor: number;
  };
  controlMode: CompanionControlMode;
  gambits: GambitRule[];
  dialogueCursor: number;
}

export interface PartyState {
  companions: CompanionState[];
  activeCompanionIds: CompanionId[];
}

export type PartyMemberId = "hero" | CompanionId;

export interface RecruitCompanionResult {
  recruited: boolean;
  companion?: CompanionState;
  message: string;
}

export interface PartyMutationResult {
  changed: boolean;
  message: string;
}

export interface TransferPartyItemResult {
  transferred: boolean;
  message: string;
}

export function createPartyState(): PartyState {
  return {
    companions: [],
    activeCompanionIds: [],
  };
}

export function xpFloorForLevel(level: number): number {
  return level <= 1 ? 0 : xpForLevel(level);
}

function applyClassBoosts(
  baseStats: PlayerStats,
  classId: string,
): PlayerStats {
  const stats = { ...baseStats };
  const playerClass = getPlayerClass(classId);
  for (const [key, value] of Object.entries(playerClass.statBoosts)) {
    stats[key as keyof PlayerStats] += value ?? 0;
  }
  return stats;
}

function selectLoadout(
  loadouts: CompanionLoadout[],
  level: number,
): CompanionLoadout {
  return loadouts.reduce((selected, candidate) =>
    candidate.minLevel <= level && candidate.minLevel >= selected.minLevel
      ? candidate
      : selected
  );
}

function getInventoryCopy(itemIds: string[]): Item[] {
  return itemIds.flatMap((itemId) => {
    const item = getItem(itemId);
    return item ? [{ ...item }] : [];
  });
}

function getEquippedItem(
  inventory: Item[],
  itemId: string | undefined,
): Item | null {
  return itemId
    ? inventory.find((item) => item.id === itemId) ?? null
    : null;
}

function getKnownTalents(classId: string, level: number): string[] {
  return TALENTS.filter((talent) =>
    talent.levelRequired <= level
    && (!talent.classRestriction || talent.classRestriction.includes(classId))
  ).map((talent) => talent.id);
}

export function createCompanionState(
  companionId: CompanionId,
  level: number,
): CompanionState {
  const definition = getCompanionDefinition(companionId);
  if (!definition) {
    throw new Error(`[party] Unknown companion definition: ${companionId}`);
  }
  const safeLevel = Math.min(Math.max(Math.trunc(level), 1), 20);
  const playerClass = getPlayerClass(definition.classId);
  const stats = applyClassBoosts(definition.baseStats, definition.classId);
  const conModifier = abilityModifier(stats.constitution);
  const intModifier = abilityModifier(stats.intelligence);
  let maxHp = Math.max(10, 25 + conModifier * 3);
  let maxMp = Math.max(4, 8 + intModifier * 2);
  const averageHitDie = Math.floor(playerClass.hitDie / 2) + 1;
  for (let currentLevel = 2; currentLevel <= safeLevel; currentLevel++) {
    maxHp += Math.max(1, averageHitDie + conModifier);
    maxMp += Math.max(1, 2 + intModifier);
  }

  const knownTalents = getKnownTalents(definition.classId, safeLevel);
  for (const talent of TALENTS) {
    if (!knownTalents.includes(talent.id)) continue;
    maxHp += talent.maxHpBonus ?? 0;
    maxMp += talent.maxMpBonus ?? 0;
  }

  const knownSpells = getClassSpells(definition.classId).filter((spellId) => {
    const spell = getSpell(spellId);
    return spell !== undefined && spell.levelRequired <= safeLevel;
  });
  const knownAbilities = getClassAbilities(definition.classId).filter(
    (abilityId) => {
      const ability = getAbility(abilityId);
      return ability !== undefined && ability.levelRequired <= safeLevel;
    },
  );
  const loadout = selectLoadout(definition.loadouts, safeLevel);
  const inventory = getInventoryCopy(loadout.itemIds);

  return {
    id: companionId,
    name: definition.name,
    level: safeLevel,
    xp: xpFloorForLevel(safeLevel),
    hp: maxHp,
    maxHp,
    mp: maxMp,
    maxMp,
    stats,
    pendingStatPoints: 0,
    pendingLevelUps: 0,
    inventory,
    knownSpells,
    knownAbilities,
    knownTalents,
    equippedWeapon: getEquippedItem(inventory, loadout.equippedWeaponId),
    equippedOffHand: null,
    equippedArmor: getEquippedItem(inventory, loadout.equippedArmorId),
    equippedShield: getEquippedItem(inventory, loadout.equippedShieldId),
    appearanceId: definition.classId,
    customAppearance: { ...definition.customAppearance },
    activeEffects: [],
    controlMode: "manual",
    gambits: [],
    dialogueCursor: 0,
  };
}

export function recruitCompanion(
  player: PlayerState,
  targetId: string,
): RecruitCompanionResult {
  if (!isCompanionId(targetId)) {
    return {
      recruited: false,
      message: `Unknown companion: ${targetId}`,
    };
  }
  const existing = player.party.companions.find(
    (companion) => companion.id === targetId,
  );
  if (existing) {
    return {
      recruited: false,
      companion: existing,
      message: `${existing.name} is already recruited.`,
    };
  }

  const companion = createCompanionState(targetId, player.level);
  player.party.companions.push(companion);
  if (player.party.activeCompanionIds.length < MAX_ACTIVE_COMPANIONS) {
    player.party.activeCompanionIds.push(targetId);
  }
  return {
    recruited: true,
    companion,
    message: `${companion.name} joined the party!`,
  };
}

export function setCompanionActive(
  party: PartyState,
  targetId: string,
  active: boolean,
): PartyMutationResult {
  if (!isCompanionId(targetId)) {
    return { changed: false, message: `Unknown companion: ${targetId}` };
  }
  const companion = party.companions.find((entry) => entry.id === targetId);
  if (!companion) {
    return { changed: false, message: `${targetId} is not recruited.` };
  }
  const currentIndex = party.activeCompanionIds.indexOf(targetId);
  if (!active) {
    if (currentIndex < 0) {
      return { changed: false, message: `${companion.name} is already inactive.` };
    }
    party.activeCompanionIds.splice(currentIndex, 1);
    return { changed: true, message: `${companion.name} left the active party.` };
  }
  if (currentIndex >= 0) {
    return { changed: false, message: `${companion.name} is already active.` };
  }
  if (party.activeCompanionIds.length >= MAX_ACTIVE_COMPANIONS) {
    return { changed: false, message: "The active party is full." };
  }
  party.activeCompanionIds.push(targetId);
  return { changed: true, message: `${companion.name} joined the active party.` };
}

function getPartyMember(
  player: PlayerState,
  memberId: PartyMemberId,
): CombatActorState | undefined {
  return memberId === "hero"
    ? player
    : player.party.companions.find((companion) => companion.id === memberId);
}

function isEquippedByActor(actor: CombatActorState, item: Item): boolean {
  return [
    actor.equippedWeapon,
    actor.equippedOffHand,
    actor.equippedArmor,
    actor.equippedShield,
  ].some((equipped) => equipped === item);
}

export function transferPartyItem(
  player: PlayerState,
  fromId: PartyMemberId,
  toId: PartyMemberId,
  itemIndex: number,
): TransferPartyItemResult {
  if (fromId === toId) {
    return { transferred: false, message: "Choose a different party member." };
  }
  const source = getPartyMember(player, fromId);
  const target = getPartyMember(player, toId);
  if (!source || !target) {
    return { transferred: false, message: "Party member is unavailable." };
  }
  const item = source.inventory[itemIndex];
  if (!item) {
    return { transferred: false, message: "Item is unavailable." };
  }
  if (item.type === "key" || item.type === "mount") {
    return {
      transferred: false,
      message: `${item.name} must remain with the hero.`,
    };
  }
  if (isEquippedByActor(source, item)) {
    return {
      transferred: false,
      message: `${item.name} is currently equipped.`,
    };
  }
  source.inventory.splice(itemIndex, 1);
  target.inventory.push(item);
  return {
    transferred: true,
    message: `${item.name} transferred.`,
  };
}

function getActiveCompanionStates(party: PartyState): CompanionState[] {
  return party.activeCompanionIds.flatMap((companionId) => {
    const companion = party.companions.find(
      (entry) => entry.id === companionId && entry.hp > 0,
    );
    return companion ? [companion] : [];
  });
}

export function createActivePartyCombatants(
  party: PartyState,
): PartyCombatant[] {
  return getActiveCompanionStates(party).map((companion) =>
    createPartyCombatant(
      {
        id: companion.id,
        name: companion.name,
        get hp(): number {
          return companion.hp;
        },
        set hp(value: number) {
          companion.hp = value;
        },
        get maxHp(): number {
          return companion.maxHp;
        },
        stats: companion.stats,
        get activeEffects(): ActiveStatusEffect[] {
          return companion.activeEffects;
        },
        set activeEffects(value: ActiveStatusEffect[]) {
          companion.activeEffects = value;
        },
        getArmorClass: (defendBonus: number): number =>
          getArmorClass(companion, defendBonus),
      },
      "companion",
    )
  );
}

export function createPartyActionSources(
  party: PartyState,
  combatants: PartyCombatant[],
): BattleActionSource[] {
  return combatants.flatMap((combatant) => {
    const companion = party.companions.find(
      (entry) => entry.id === combatant.sourceId,
    );
    return companion
      ? [createBattleActionSource(combatant, companion)]
      : [];
  });
}

export function applyKnockoutXpPenalty(
  actor: ProgressingActorState,
): void {
  actor.xp = xpFloorForLevel(actor.level);
  actor.pendingLevelUps = 0;
}

export function isPartyMemberId(value: unknown): value is PartyMemberId {
  return value === "hero" || isCompanionId(value);
}

export function getCompanion(
  party: PartyState,
  companionId: CompanionId,
): CompanionState | undefined {
  return party.companions.find((companion) => companion.id === companionId);
}

export function getRecruitedCompanionIds(party: PartyState): CompanionId[] {
  return COMPANION_IDS.filter((companionId) =>
    party.companions.some((companion) => companion.id === companionId)
  );
}

export function synchronizeCompanionRecruitment(
  player: PlayerState,
): RecruitCompanionResult[] {
  const recruited: RecruitCompanionResult[] = [];
  replayQuestCompletionActions(
    player.progression.quests,
    (action) => {
      const result = recruitCompanion(player, action.targetId);
      if (result.recruited) recruited.push(result);
    },
    "recruitCompanion",
  );
  return recruited;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readInteger(
  value: unknown,
  fallback: number,
  minimum = Number.MIN_SAFE_INTEGER,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  return typeof value === "number" && Number.isInteger(value)
    ? Math.min(Math.max(value, minimum), maximum)
    : fallback;
}

function normalizeStats(
  value: unknown,
  fallback: PlayerStats,
): PlayerStats {
  if (!isRecord(value)) return { ...fallback };
  const readStat = (key: keyof PlayerStats): number =>
    readInteger(value[key], fallback[key], 1, 30);
  return {
    strength: readStat("strength"),
    dexterity: readStat("dexterity"),
    constitution: readStat("constitution"),
    intelligence: readStat("intelligence"),
    wisdom: readStat("wisdom"),
    charisma: readStat("charisma"),
  };
}

function normalizeKnownIds(
  value: unknown,
  isKnown: (id: string) => boolean,
  fallback: string[],
): string[] {
  if (!Array.isArray(value)) return [...fallback];
  return [
    ...new Set(
      value.filter(
        (entry): entry is string =>
          typeof entry === "string" && isKnown(entry),
      ),
    ),
  ];
}

function normalizeInventory(
  value: unknown,
  fallback: Item[],
): Item[] {
  if (!Array.isArray(value)) return fallback.map((item) => ({ ...item }));
  return value.flatMap((candidate) => {
    if (!isRecord(candidate) || typeof candidate["id"] !== "string") return [];
    const item = getItem(candidate["id"]);
    return item ? [{ ...item }] : [];
  });
}

function readEquippedItemId(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  return isRecord(value) && typeof value["id"] === "string"
    ? value["id"]
    : undefined;
}

function relinkEquipment(
  inventory: Item[],
  value: unknown,
  type: "weapon" | "armor" | "shield",
): Item | null {
  const itemId = readEquippedItemId(value);
  return itemId
    ? inventory.find((item) => item.id === itemId && item.type === type) ?? null
    : null;
}

function normalizeCustomAppearance(
  value: unknown,
  fallback: CompanionState["customAppearance"],
): CompanionState["customAppearance"] {
  if (!isRecord(value)) return { ...fallback };
  return {
    skinColor: readInteger(value["skinColor"], fallback.skinColor, 0, 0xffffff),
    hairStyle: readInteger(value["hairStyle"], fallback.hairStyle, 0, 3),
    hairColor: readInteger(value["hairColor"], fallback.hairColor, 0, 0xffffff),
  };
}

function normalizeCompanionState(
  value: unknown,
): CompanionState | undefined {
  if (!isRecord(value) || !isCompanionId(value["id"])) return undefined;
  const level = readInteger(value["level"], 1, 1, 20);
  const fallback = createCompanionState(value["id"], level);
  const maxHp = readInteger(value["maxHp"], fallback.maxHp, 1);
  const maxMp = readInteger(value["maxMp"], fallback.maxMp, 1);
  const inventory = normalizeInventory(value["inventory"], fallback.inventory);
  const talentIds = new Set(TALENTS.map((talent) => talent.id));
  const companion: CompanionState = {
    ...fallback,
    xp: Math.max(
      xpFloorForLevel(level),
      readInteger(value["xp"], fallback.xp, 0),
    ),
    hp: readInteger(value["hp"], fallback.hp, 0, maxHp),
    maxHp,
    mp: readInteger(value["mp"], fallback.mp, 0, maxMp),
    maxMp,
    stats: normalizeStats(value["stats"], fallback.stats),
    pendingStatPoints: readInteger(
      value["pendingStatPoints"],
      fallback.pendingStatPoints,
      0,
    ),
    pendingLevelUps: readInteger(
      value["pendingLevelUps"],
      fallback.pendingLevelUps,
      0,
    ),
    inventory,
    knownSpells: normalizeKnownIds(
      value["knownSpells"],
      (id) => getSpell(id) !== undefined,
      fallback.knownSpells,
    ),
    knownAbilities: normalizeKnownIds(
      value["knownAbilities"],
      (id) => getAbility(id) !== undefined,
      fallback.knownAbilities,
    ),
    knownTalents: normalizeKnownIds(
      value["knownTalents"],
      (id) => talentIds.has(id),
      fallback.knownTalents,
    ),
    equippedWeapon: relinkEquipment(
      inventory,
      value["equippedWeapon"],
      "weapon",
    ),
    equippedOffHand: relinkEquipment(
      inventory,
      value["equippedOffHand"],
      "weapon",
    ),
    equippedArmor: relinkEquipment(
      inventory,
      value["equippedArmor"],
      "armor",
    ),
    equippedShield: relinkEquipment(
      inventory,
      value["equippedShield"],
      "shield",
    ),
    customAppearance: normalizeCustomAppearance(
      value["customAppearance"],
      fallback.customAppearance,
    ),
    activeEffects: normalizeActiveEffects(value["activeEffects"]),
    controlMode: value["controlMode"] === "gambit" ? "gambit" : "manual",
    gambits: normalizeGambitRules(value["gambits"]),
    dialogueCursor: readInteger(
      value["dialogueCursor"],
      fallback.dialogueCursor,
      0,
    ),
  };
  return companion;
}

export function normalizePartyState(value: unknown): PartyState {
  if (!isRecord(value)) return createPartyState();
  const companions: CompanionState[] = [];
  const seen = new Set<CompanionId>();
  if (Array.isArray(value["companions"])) {
    for (const candidate of value["companions"]) {
      const companion = normalizeCompanionState(candidate);
      if (!companion || seen.has(companion.id)) continue;
      seen.add(companion.id);
      companions.push(companion);
    }
  }

  const activeCompanionIds: CompanionId[] = [];
  if (Array.isArray(value["activeCompanionIds"])) {
    for (const candidate of value["activeCompanionIds"]) {
      if (
        !isCompanionId(candidate)
        || activeCompanionIds.includes(candidate)
        || !companions.some((companion) => companion.id === candidate)
        || activeCompanionIds.length >= MAX_ACTIVE_COMPANIONS
      ) {
        continue;
      }
      activeCompanionIds.push(candidate);
    }
  } else {
    activeCompanionIds.push(
      ...companions
        .slice(0, MAX_ACTIVE_COMPANIONS)
        .map((companion) => companion.id),
    );
  }

  return { companions, activeCompanionIds };
}
