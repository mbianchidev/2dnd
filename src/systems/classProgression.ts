import {
  ASI_LEVELS,
  ASI_POINTS,
  BASE_CLASS_IDS,
  DEFAULT_PROGRESSION_CONTEXT,
  MAX_ABILITY_SCORE,
  NORMAL_LEVEL_CAP,
  STAT_KEYS,
  getProgressionProfile,
  isBaseClassId,
  isExternalProgressionTrackId,
  type BaseClassId,
  type ExternalProgressionTrackId,
  type HeroProgressionContext,
  type ProgressionFeatureKind,
  type ProgressionRequirement,
  type ProgressionTrackId,
  type ProgressionTrackProfile,
} from "../data/classProgression";
import { ABILITIES, getAbility, type Ability } from "../data/abilities";
import { SPELLS, getSpell, type Spell } from "../data/spells";
import { TALENTS, getTalent, isTotalLevelTalent, type Talent } from "../data/talents";
import { abilityModifier } from "./dice";
import { getPlayerClass } from "./classes";
import type { Item } from "../data/items";
import type { CombatActorState, PlayerStats, ProgressingActorState } from "./player";

export interface ProgressionKnownGrants {
  spells: string[];
  abilities: string[];
  talents: string[];
}

export interface PendingHeroLevelUp {
  readonly expectedTotalLevel: number;
  readonly resourceRoll: number;
  readonly constitution: number;
  readonly intelligence: number;
}

export interface HeroClassProgression {
  readonly startingClassId: BaseClassId;
  classLevels: Partial<Record<BaseClassId, number>>;
  trackLevels: Partial<Record<ExternalProgressionTrackId, number>>;
  readyLevelUps: number;
  pendingLevel: PendingHeroLevelUp | null;
  legacyGrants: ProgressionKnownGrants;
  deferredLegacyGrants?: ProgressionKnownGrants;
}

export type HeroProgressingActorState = ProgressingActorState & {
  classProgression: HeroClassProgression;
};

export interface ProgressionGrantSource {
  kind: "track" | "totalLevel" | "legacy";
  trackId: ProgressionTrackId;
  rank: number;
  stat?: keyof PlayerStats;
}

export interface ProgressionTrackEntry {
  id: ProgressionTrackId;
  label: string;
  kind: ProgressionTrackProfile["kind"];
  level: number;
}

export interface ClassQualification {
  qualified: boolean;
  message: string;
  unmetRequirements: string[];
}

export interface HeroLevelUpPreview {
  trackId: ProgressionTrackId;
  label: string;
  fromTotalLevel: number;
  totalLevel: number;
  trackLevel: number;
  hpGain: number;
  mpGain: number;
  proficiencyBonus: number;
  asiGained: number;
  newSpells: Spell[];
  newAbilities: Ability[];
  newTalents: Talent[];
}

export type HeroLevelUpResult =
  | { ok: true; receipt: HeroLevelUpPreview; message: string }
  | { ok: false; message: string };

export type HeroLevelUpPreviewResult =
  | { ok: true; preview: HeroLevelUpPreview }
  | { ok: false; message: string };

export interface PendingLevelUpResult {
  leveledUp: boolean;
  newLevel: number;
  newSpells: Spell[];
  newAbilities: Ability[];
  newTalents: Talent[];
  asiGained: number;
}

export function createHeroClassProgression(
  startingClassId: BaseClassId,
  level = 1,
): HeroClassProgression {
  return {
    startingClassId,
    classLevels: { [startingClassId]: level },
    trackLevels: {},
    readyLevelUps: 0,
    pendingLevel: null,
    legacyGrants: { spells: [], abilities: [], talents: [] },
  };
}

/** Existing XP thresholds remain total-character-level thresholds. */
export function xpForLevel(level: number): number {
  return level * level * 100;
}

export function getTotalLevel(actor: CombatActorState): number {
  const progression = actor.classProgression;
  return progression
    ? Object.values(progression.classLevels).reduce<number>((sum, level) => sum + (level ?? 0), 0)
      + Object.values(progression.trackLevels).reduce<number>((sum, level) => sum + (level ?? 0), 0)
    : actor.level;
}

export function getClassLevel(actor: CombatActorState, id: BaseClassId): number {
  return actor.classProgression
    ? actor.classProgression.classLevels[id] ?? 0
    : getPlayerClass(actor.appearanceId).id === id ? actor.level : 0;
}

export function getTrackLevel(actor: CombatActorState, id: ProgressionTrackId): number {
  return isBaseClassId(id)
    ? getClassLevel(actor, id)
    : actor.classProgression?.trackLevels[id] ?? 0;
}

export function getActorStartingClass(actor: CombatActorState): BaseClassId {
  return actor.classProgression?.startingClassId ?? getPlayerClass(actor.appearanceId).id;
}

export function getActorPrimaryStat(actor: CombatActorState): keyof PlayerStats {
  return getPlayerClass(getActorStartingClass(actor)).primaryStat;
}

export function getProgressionTracks(
  actor: CombatActorState,
  context: HeroProgressionContext = DEFAULT_PROGRESSION_CONTEXT,
): ProgressionTrackEntry[] {
  const startingId = getActorStartingClass(actor);
  const ordered = [
    ...context.profiles.filter((profile) => profile.id === startingId),
    ...context.profiles.filter((profile) => profile.id !== startingId),
  ];
  return ordered.flatMap((profile) => {
    const level = getTrackLevel(actor, profile.id);
    return level > 0 ? [{
      id: profile.id, label: profile.label, kind: profile.kind, level,
    }] : [];
  });
}

export function getProgressionSummary(actor: CombatActorState): string {
  return getProgressionTracks(actor).map((track) => `${track.label} ${track.level}`).join(" / ");
}

export function getProgressionDisplayName(actor: CombatActorState): string {
  const tracks = getProgressionTracks(actor);
  return tracks.length === 1 ? tracks[0]!.label : getProgressionSummary(actor);
}

export function getProficiencyBonus(actor: CombatActorState): number {
  return Math.floor((getTotalLevel(actor) - 1) / 4) + 2;
}

export function getEarnedPendingLevels(actor: ProgressingActorState): number {
  const total = getTotalLevel(actor);
  let level = total;
  while (level < NORMAL_LEVEL_CAP && actor.xp >= xpForLevel(level + 1)) level++;
  return level - total;
}

/** KO XP penalties revoke uncommitted/rest-ready levels, never earned class ownership. */
export function discardPendingLevelUps(actor: ProgressingActorState): void {
  actor.pendingLevelUps = 0;
  if (actor.classProgression) {
    actor.classProgression.readyLevelUps = 0;
    actor.classProgression.pendingLevel = null;
  }
}

function knownGrants(actor: CombatActorState, kind: ProgressionFeatureKind): readonly string[] {
  return kind === "spell" ? actor.knownSpells
    : kind === "ability" ? actor.knownAbilities : actor.knownTalents;
}

function legacyGrants(actor: CombatActorState, kind: ProgressionFeatureKind): readonly string[] {
  const grants = actor.classProgression?.legacyGrants;
  return kind === "spell" ? grants?.spells ?? []
    : kind === "ability" ? grants?.abilities ?? [] : grants?.talents ?? [];
}

export function getFeatureSources(
  actor: CombatActorState,
  kind: ProgressionFeatureKind,
  id: string,
  context: HeroProgressionContext = DEFAULT_PROGRESSION_CONTEXT,
): ProgressionGrantSource[] {
  if (!knownGrants(actor, kind).includes(id)) return [];
  const sources: ProgressionGrantSource[] = [];
  for (const track of getProgressionTracks(actor, context)) {
    const profile = getProgressionProfile(track.id, context);
    for (const grant of profile?.grants ?? []) {
      if (grant.kind === kind && grant.id === id && grant.rank <= track.level) {
        sources.push({
          kind: "track", trackId: track.id, rank: grant.rank,
          stat: grant.stat ?? (grant.kind === "spell" ? profile?.primaryStat : undefined),
        });
      }
    }
  }
  const talent = kind === "talent" ? getTalent(id) : undefined;
  if (talent && isTotalLevelTalent(talent) && talent.levelRequired <= getTotalLevel(actor)) {
    sources.push({
      kind: "totalLevel", trackId: getActorStartingClass(actor), rank: talent.levelRequired,
    });
  }
  if (legacyGrants(actor, kind).includes(id) && sources.length === 0) {
    sources.push({ kind: "legacy", trackId: getActorStartingClass(actor), rank: 0 });
  }
  return sources;
}

export function getSpellCastingStat(
  actor: CombatActorState,
  spellId: string,
  context: HeroProgressionContext = DEFAULT_PROGRESSION_CONTEXT,
): keyof PlayerStats {
  const fallback = getActorPrimaryStat(actor);
  const sources = getFeatureSources(actor, "spell", spellId, context);
  let selected: keyof PlayerStats | undefined;
  for (const source of sources) {
    const stat = source.stat ?? fallback;
    if (!selected || actor.stats[stat] > actor.stats[selected]) selected = stat;
  }
  return selected ?? fallback;
}

export function canActorUseSpell(actor: CombatActorState, id: string): boolean {
  return getSpell(id) !== undefined && actor.knownSpells.includes(id);
}

export function canActorUseAbility(actor: CombatActorState, id: string): boolean {
  return getAbility(id) !== undefined && actor.knownAbilities.includes(id);
}

export function canActorEquip(
  actor: CombatActorState,
  item: Item,
  context: HeroProgressionContext = DEFAULT_PROGRESSION_CONTEXT,
): boolean {
  const type = item.type;
  if (type !== "weapon" && type !== "armor" && type !== "shield") return false;
  return getProgressionTracks(actor, context).some((track) =>
    getProgressionProfile(track.id, context)?.equipmentPermissions.includes(type)
  );
}

function describeRequirement(requirement: ProgressionRequirement): string {
  switch (requirement.type) {
    case "abilityScore": return `${requirement.stat.toUpperCase()} ${requirement.minimum}`;
    case "totalLevel": return `total level ${requirement.minimum}`;
    case "classLevel": return `${getPlayerClass(requirement.classId).label} ${requirement.minimum}`;
    case "feature": return `${requirement.kind} ${requirement.id}`;
    case "anyOf": return requirement.requirements.map(describeRequirement).join(" or ");
  }
}

function meetsRequirement(
  actor: CombatActorState,
  requirement: ProgressionRequirement,
  context: HeroProgressionContext,
): boolean {
  switch (requirement.type) {
    case "abilityScore": return actor.stats[requirement.stat] >= requirement.minimum;
    case "totalLevel": return getTotalLevel(actor) >= requirement.minimum;
    case "classLevel": return getClassLevel(actor, requirement.classId) >= requirement.minimum;
    case "feature": return knownGrants(actor, requirement.kind).includes(requirement.id)
      && getFeatureSources(actor, requirement.kind, requirement.id, context).length > 0;
    case "anyOf": return requirement.requirements.some((entry) => meetsRequirement(actor, entry, context));
  }
}

/** Entry checks apply to new tracks only, never to already earned ranks. */
export function qualifyNextClass(
  actor: CombatActorState,
  id: string,
  context: HeroProgressionContext = DEFAULT_PROGRESSION_CONTEXT,
): ClassQualification {
  const profile = getProgressionProfile(id, context);
  if (!profile) return { qualified: false, message: `Unknown progression track: ${id}`, unmetRequirements: [] };
  const error = validateActorProgression(actor);
  if (error) return { qualified: false, message: error, unmetRequirements: [] };
  if (getTotalLevel(actor) >= NORMAL_LEVEL_CAP) {
    return { qualified: false, message: "Normal progression ends at total level 20.", unmetRequirements: [] };
  }
  const rank = getTrackLevel(actor, profile.id);
  if (rank >= profile.maxRank) {
    return { qualified: false, message: `${profile.label} has reached its rank cap.`, unmetRequirements: [] };
  }
  if (rank > 0) return { qualified: true, message: `Continue ${profile.label}.`, unmetRequirements: [] };
  const startingProfile = getProgressionProfile(getActorStartingClass(actor), context);
  const unmetRequirements = [
    ...(startingProfile?.entryRequirements ?? [])
      .filter((entry) => !meetsRequirement(actor, entry, context))
      .map((entry) => `Starting ${startingProfile?.label}: ${describeRequirement(entry)}`),
    ...profile.entryRequirements.filter((entry) => !meetsRequirement(actor, entry, context))
      .map((entry) => `${profile.label}: ${describeRequirement(entry)}`),
  ];
  return {
    qualified: unmetRequirements.length === 0,
    message: unmetRequirements.length > 0
      ? `Requires ${unmetRequirements.join("; ")}.`
      : `${profile.label} entry requirements met.`,
    unmetRequirements,
  };
}

/** Pure resource query usable by future typed tracks without another level engine. */
export function getLevelResourceGrowth(
  profile: ProgressionTrackProfile,
  pending: PendingHeroLevelUp,
): { hpGain: number; mpGain: number } {
  return {
    hpGain: Math.max(profile.hpGrowth.minimum,
      Math.floor(pending.resourceRoll * profile.hpGrowth.hitDie) + 1
      + abilityModifier(pending.constitution)),
    mpGain: Math.max(profile.mpGrowth.minimum,
      profile.mpGrowth.base + abilityModifier(pending.intelligence)),
  };
}

function validatePendingReceipt(pending: PendingHeroLevelUp, total: number): boolean {
  return pending.expectedTotalLevel === total && Number.isFinite(pending.resourceRoll)
    && pending.resourceRoll >= 0 && pending.resourceRoll < 1
    && Number.isInteger(pending.constitution) && pending.constitution >= 1
    && pending.constitution <= MAX_ABILITY_SCORE
    && Number.isInteger(pending.intelligence) && pending.intelligence >= 1
    && pending.intelligence <= MAX_ABILITY_SCORE;
}

function validateActorProgression(actor: CombatActorState): string | undefined {
  const progression = actor.classProgression;
  if (progression && (!isBaseClassId(progression.startingClassId)
    || !progression.classLevels || !progression.trackLevels
    || !Number.isInteger(progression.classLevels[progression.startingClassId])
    || (progression.classLevels[progression.startingClassId] ?? 0) < 1
    || Object.entries(progression.classLevels).some(([id, rank]) =>
      !isBaseClassId(id) || typeof rank !== "number"
      || !Number.isInteger(rank) || rank < 1 || rank > NORMAL_LEVEL_CAP
    )
    || Object.entries(progression.trackLevels).some(([id, rank]) =>
      !isExternalProgressionTrackId(id) || typeof rank !== "number"
      || !Number.isInteger(rank) || rank < 1 || rank > NORMAL_LEVEL_CAP
    ))) return "Invalid class-level ownership; reload a normalized campaign.";
  const total = getTotalLevel(actor);
  if (!Number.isInteger(total) || total < 1 || total > NORMAL_LEVEL_CAP || total !== actor.level) {
    return "Invalid class-level ownership; reload a normalized campaign.";
  }
  if (STAT_KEYS.some((stat) => !Number.isInteger(actor.stats[stat])
    || actor.stats[stat] < 1 || actor.stats[stat] > MAX_ABILITY_SCORE)) {
    return "Invalid progression scores; reload a normalized campaign.";
  }
  if (!Number.isSafeInteger(actor.maxHp) || actor.maxHp < 1
    || !Number.isSafeInteger(actor.maxMp) || actor.maxMp < 0
    || !Number.isSafeInteger(actor.hp) || actor.hp < 0 || actor.hp > actor.maxHp
    || !Number.isSafeInteger(actor.mp) || actor.mp < 0 || actor.mp > actor.maxMp) {
    return "Invalid progression resources; reload a normalized campaign.";
  }
  return undefined;
}

function validatePreparedLevel(player: HeroProgressingActorState): string | undefined {
  const error = validateActorProgression(player);
  if (error) return error;
  const progression = player.classProgression;
  const total = getTotalLevel(player);
  if (total >= NORMAL_LEVEL_CAP) return "Normal progression ends at total level 20.";
  if (!Number.isFinite(player.xp) || player.xp < 0) return "Invalid XP; reload a normalized campaign.";
  if (!Number.isInteger(player.pendingLevelUps) || player.pendingLevelUps <= 0
    || player.pendingLevelUps > NORMAL_LEVEL_CAP - total
    || getEarnedPendingLevels(player) <= 0
    || player.pendingLevelUps > getEarnedPendingLevels(player)) return "No valid earned level is waiting for rest.";
  if (!Number.isInteger(progression.readyLevelUps) || progression.readyLevelUps < 0
    || progression.readyLevelUps > player.pendingLevelUps) {
    return "Invalid rested level queue; reload a normalized campaign.";
  }
  if (progression.pendingLevel && !validatePendingReceipt(progression.pendingLevel, total)) {
    return "The prepared resource receipt is invalid or stale; reload a normalized campaign.";
  }
  return undefined;
}

/** Freeze one earned level at rest. Reopening or reloading reuses this exact receipt. */
export function prepareHeroLevelUp(
  player: HeroProgressingActorState,
  random: () => number = Math.random,
): { ok: true; pending: PendingHeroLevelUp } | { ok: false; message: string } {
  return freezeHeroLevel(player, random, true);
}

/** Resume an already rested queue without granting rest credit to newly earned XP. */
export function prepareNextHeroLevelUp(
  player: HeroProgressingActorState,
  random: () => number = Math.random,
): { ok: true; pending: PendingHeroLevelUp } | { ok: false; message: string } {
  return freezeHeroLevel(player, random, false);
}

function freezeHeroLevel(
  player: HeroProgressingActorState,
  random: () => number,
  rested: boolean,
): { ok: true; pending: PendingHeroLevelUp } | { ok: false; message: string } {
  const error = validatePreparedLevel(player);
  if (error) return { ok: false, message: error };
  if (!rested && player.classProgression.readyLevelUps <= 0) {
    return { ok: false, message: "Rest before advancing newly earned levels." };
  }
  const existing = player.classProgression.pendingLevel;
  if (existing) {
    if (rested) player.classProgression.readyLevelUps = player.pendingLevelUps;
    return existing.expectedTotalLevel === player.level
      ? { ok: true, pending: existing }
      : { ok: false, message: "The prepared level is stale; reload a normalized campaign." };
  }
  const resourceRoll = random();
  if (!Number.isFinite(resourceRoll) || resourceRoll < 0 || resourceRoll >= 1) {
    return { ok: false, message: "Cannot prepare level: invalid resource roll." };
  }
  const pending: PendingHeroLevelUp = Object.freeze({
    expectedTotalLevel: player.level,
    resourceRoll,
    constitution: player.stats.constitution,
    intelligence: player.stats.intelligence,
  });
  if (rested) player.classProgression.readyLevelUps = player.pendingLevelUps;
  player.classProgression.pendingLevel = pending;
  return { ok: true, pending };
}

function getNewGrants(
  actor: CombatActorState,
  profile: ProgressionTrackProfile,
  nextRank: number,
  nextTotal: number,
  context: HeroProgressionContext,
): Pick<HeroLevelUpPreview, "newSpells" | "newAbilities" | "newTalents"> {
  const newSpells: Spell[] = [];
  const newAbilities: Ability[] = [];
  const newTalents: Talent[] = [];
  const appendGrant = (kind: ProgressionFeatureKind, id: string): void => {
    if (knownGrants(actor, kind).includes(id)) return;
    if (kind === "spell") {
      const spell = getSpell(id);
      if (spell && !newSpells.some((entry) => entry.id === spell.id)) newSpells.push(spell);
    } else if (kind === "ability") {
      const ability = getAbility(id);
      if (ability && !newAbilities.some((entry) => entry.id === ability.id)) newAbilities.push(ability);
    } else {
      const talent = getTalent(id);
      if (talent && !newTalents.some((entry) => entry.id === talent.id)) newTalents.push(talent);
    }
  };
  for (const grant of profile.grants) {
    if (grant.rank <= nextRank) appendGrant(grant.kind, grant.id);
  }
  for (const talent of TALENTS) {
    if (isTotalLevelTalent(talent) && talent.levelRequired <= nextTotal) appendGrant("talent", talent.id);
  }
  const deferred = actor.classProgression?.deferredLegacyGrants;
  if (deferred) {
    const available = getAvailableProgressionGrants(actor, context);
    for (const id of deferred.spells) if (available.spells.includes(id)) appendGrant("spell", id);
    for (const id of deferred.abilities) if (available.abilities.includes(id)) appendGrant("ability", id);
    for (const id of deferred.talents) if (available.talents.includes(id)) appendGrant("talent", id);
  }
  return {
    newSpells: SPELLS.filter((spell) => newSpells.some((entry) => entry.id === spell.id)),
    newAbilities: ABILITIES.filter((ability) => newAbilities.some((entry) => entry.id === ability.id)),
    newTalents: TALENTS.filter((talent) => newTalents.some((entry) => entry.id === talent.id)),
  };
}

function buildLevelPreview(
  actor: CombatActorState,
  profile: ProgressionTrackProfile,
  pending: PendingHeroLevelUp,
  context: HeroProgressionContext = DEFAULT_PROGRESSION_CONTEXT,
): HeroLevelUpPreview {
  const total = getTotalLevel(actor) + 1;
  const rank = getTrackLevel(actor, profile.id) + 1;
  const grants = getNewGrants(actor, profile, rank, total, context);
  const resources = getLevelResourceGrowth(profile, pending);
  return {
    trackId: profile.id,
    label: profile.label,
    fromTotalLevel: total - 1,
    totalLevel: total,
    trackLevel: rank,
    hpGain: resources.hpGain + grants.newTalents.reduce((sum, talent) => sum + (talent.maxHpBonus ?? 0), 0),
    mpGain: resources.mpGain + grants.newTalents.reduce((sum, talent) => sum + (talent.maxMpBonus ?? 0), 0),
    proficiencyBonus: Math.floor((total - 1) / 4) + 2,
    asiGained: ASI_LEVELS.includes(total) ? ASI_POINTS : 0,
    ...grants,
  };
}

export function previewHeroLevelUp(
  player: HeroProgressingActorState,
  id: string,
  context: HeroProgressionContext = DEFAULT_PROGRESSION_CONTEXT,
): HeroLevelUpPreviewResult {
  const error = validatePreparedLevel(player);
  if (error) return { ok: false, message: error };
  const qualification = qualifyNextClass(player, id, context);
  if (!qualification.qualified) return { ok: false, message: qualification.message };
  const profile = getProgressionProfile(id, context);
  const pending = player.classProgression.pendingLevel;
  if (!profile || !pending || pending.expectedTotalLevel !== player.level
    || player.classProgression.readyLevelUps <= 0) {
    return { ok: false, message: "Rest to prepare this level before selecting a class." };
  }
  const preview = buildLevelPreview(player, profile, pending, context);
  if (!Number.isSafeInteger(player.maxHp + preview.hpGain)
    || !Number.isSafeInteger(player.maxMp + preview.mpGain)) {
    return { ok: false, message: "Resource growth exceeds the supported integer range." };
  }
  return { ok: true, preview };
}

function applyLevelPreview(actor: ProgressingActorState, receipt: HeroLevelUpPreview): void {
  actor.level = receipt.totalLevel;
  actor.maxHp += receipt.hpGain;
  actor.maxMp += receipt.mpGain;
  actor.hp = actor.maxHp;
  actor.mp = actor.maxMp;
  actor.pendingStatPoints += receipt.asiGained;
  actor.knownSpells.push(...receipt.newSpells.map((spell) => spell.id));
  actor.knownAbilities.push(...receipt.newAbilities.map((ability) => ability.id));
  actor.knownTalents.push(...receipt.newTalents.map((talent) => talent.id));
  const progression = actor.classProgression;
  if (progression?.deferredLegacyGrants) {
    const remaining: ProgressionKnownGrants = {
      spells: progression.deferredLegacyGrants.spells.filter((id) => !actor.knownSpells.includes(id)),
      abilities: progression.deferredLegacyGrants.abilities.filter((id) => !actor.knownAbilities.includes(id)),
      talents: progression.deferredLegacyGrants.talents.filter((id) => !actor.knownTalents.includes(id)),
    };
    if (remaining.spells.length + remaining.abilities.length + remaining.talents.length > 0) {
      progression.deferredLegacyGrants = remaining;
    } else delete progression.deferredLegacyGrants;
  }
  actor.pendingLevelUps = Math.max(0, actor.pendingLevelUps - 1);
}

/** Atomically commit one frozen earned level; stale and repeated selections do nothing. */
export function commitHeroLevelUp(
  player: HeroProgressingActorState,
  selection: { trackId: string; expectedTotalLevel: number },
  context: HeroProgressionContext = DEFAULT_PROGRESSION_CONTEXT,
): HeroLevelUpResult {
  if (!selection || typeof selection.trackId !== "string"
    || !Number.isInteger(selection.expectedTotalLevel)) {
    return { ok: false, message: "Invalid level selection." };
  }
  const error = validatePreparedLevel(player);
  if (error) return { ok: false, message: error };
  if (selection.expectedTotalLevel !== getTotalLevel(player)) {
    return { ok: false, message: "This level selection is stale; select the current level." };
  }
  const result = previewHeroLevelUp(player, selection.trackId, context);
  if (!result.ok) return result;
  const receipt = result.preview;
  const progression = player.classProgression;
  if (isBaseClassId(receipt.trackId)) {
    progression.classLevels[receipt.trackId] = receipt.trackLevel;
  } else if (isExternalProgressionTrackId(receipt.trackId)) {
    progression.trackLevels[receipt.trackId] = receipt.trackLevel;
  } else {
    return { ok: false, message: "Invalid progression track identity." };
  }
  applyLevelPreview(player, receipt);
  progression.readyLevelUps--;
  progression.pendingLevel = null;
  return {
    ok: true, receipt,
    message: `Total level ${receipt.totalLevel}: ${receipt.label} ${receipt.trackLevel}.`
      + ` +${receipt.hpGain} HP, +${receipt.mpGain} MP.`,
  };
}

/** Compatibility rest processor: hero default stays its starting class; companions stay single-class. */
export function processActorPendingLevelUps(actor: ProgressingActorState): PendingLevelUpResult {
  const result: PendingLevelUpResult = {
    leveledUp: false, newLevel: actor.level,
    newSpells: [], newAbilities: [], newTalents: [], asiGained: 0,
  };
  const pending = actor.pendingLevelUps;
  for (let index = 0; index < pending && getTotalLevel(actor) < NORMAL_LEVEL_CAP; index++) {
    const profile = getProgressionProfile(getActorStartingClass(actor));
    if (!profile) throw new Error("[progression] Missing starting-class profile.");
    let receipt: HeroLevelUpPreview;
    if (hasHeroClassProgression(actor)) {
      const prepared = prepareHeroLevelUp(actor);
      if (!prepared.ok) throw new Error(`[progression] ${prepared.message}`);
      const committed = commitHeroLevelUp(actor, {
        trackId: profile.id, expectedTotalLevel: actor.level,
      });
      if (!committed.ok) throw new Error(`[progression] ${committed.message}`);
      receipt = committed.receipt;
    } else {
      receipt = buildLevelPreview(actor, profile, {
        expectedTotalLevel: actor.level,
        resourceRoll: Math.random(),
        constitution: actor.stats.constitution,
        intelligence: actor.stats.intelligence,
      });
      applyLevelPreview(actor, receipt);
    }
    result.leveledUp = true;
    result.newLevel = actor.level;
    result.newSpells.push(...receipt.newSpells);
    result.newAbilities.push(...receipt.newAbilities);
    result.newTalents.push(...receipt.newTalents);
    result.asiGained += receipt.asiGained;
  }
  if (getTotalLevel(actor) >= NORMAL_LEVEL_CAP) actor.pendingLevelUps = 0;
  return result;
}

function hasHeroClassProgression(actor: ProgressingActorState): actor is HeroProgressingActorState {
  return actor.classProgression !== undefined;
}

/** Preserve the game's historical per-score-point retroactive HP/MP allocation. */
export function allocateProgressionStatPoint(
  actor: ProgressingActorState,
  stat: keyof PlayerStats,
): boolean {
  if (validateActorProgression(actor)) return false;
  if (!STAT_KEYS.includes(stat) || !Number.isInteger(actor.pendingStatPoints)
    || actor.pendingStatPoints <= 0 || !Number.isInteger(actor.stats[stat])
    || actor.stats[stat] >= MAX_ABILITY_SCORE) return false;
  const bonus = getTotalLevel(actor);
  if ((stat === "constitution" && !Number.isSafeInteger(actor.maxHp + bonus))
    || (stat === "intelligence" && !Number.isSafeInteger(actor.maxMp + bonus))) return false;
  actor.stats[stat]++;
  actor.pendingStatPoints--;
  if (stat === "constitution") {
    actor.maxHp += bonus;
    actor.hp = Math.min(actor.hp + bonus, actor.maxHp);
  }
  if (stat === "intelligence") {
    actor.maxMp += bonus;
    actor.mp = Math.min(actor.mp + bonus, actor.maxMp);
  }
  return true;
}

export function getAvailableProgressionGrants(
  actor: CombatActorState,
  context: HeroProgressionContext = DEFAULT_PROGRESSION_CONTEXT,
): ProgressionKnownGrants {
  const grants: ProgressionKnownGrants = { spells: [], abilities: [], talents: [] };
  for (const track of getProgressionTracks(actor, context)) {
    const profile = getProgressionProfile(track.id, context);
    for (const grant of profile?.grants ?? []) {
      if (grant.rank > track.level) continue;
      const ids = grant.kind === "spell" ? grants.spells
        : grant.kind === "ability" ? grants.abilities : grants.talents;
      if (!ids.includes(grant.id)) ids.push(grant.id);
    }
  }
  for (const talent of TALENTS) {
    if (isTotalLevelTalent(talent) && talent.levelRequired <= getTotalLevel(actor)
      && !grants.talents.includes(talent.id)) grants.talents.push(talent.id);
  }
  return grants;
}

export { BASE_CLASS_IDS };
export { normalizeHeroClassProgression } from "./classProgressionState";
