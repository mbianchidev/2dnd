import { describe, expect, it } from "vitest";
import {
  DEITY_IDS,
  DEVOTION_BLESSINGS,
  TEMPLE_RITES,
  TEMPLES,
  getTemple,
  type DeityId,
  type TempleId,
} from "../src/data/devotion";
import { Terrain, getCity, getCityChunk, isWalkable } from "../src/data/map";
import {
  getActiveDevotionBlessing,
  getAdjacentDevotionTemple,
  getTempleGreeting,
  changeDevotionAffiliation,
  getDevotionAffiliationConsequences,
  getTempleRiteAvailability,
  performTempleRite,
  resolveTempleConversation,
  visitDevotionTemple,
} from "../src/systems/devotionTemples";
import { createPlayer, getArmorClass, type PlayerState } from "../src/systems/player";
import { restPartyAtInn } from "../src/systems/party";
import {
  clearAllEffects,
  getEffectACModifier,
  processEndOfTurn,
  processStartOfTurn,
} from "../src/systems/statusEffects";
import { applySocialMutation } from "../src/systems/reputation";
import { applyDevotionSource } from "../src/systems/devotion";

function hero(deityId: DeityId | null = null): PlayerState {
  const player = createPlayer("Temple fixture", {
    strength: 10, dexterity: 10, constitution: 10,
    intelligence: 10, wisdom: 10, charisma: 10,
  });
  player.progression.devotion.deityId = deityId;
  approach(player, "willowdaleSpan");
  return player;
}

function approach(player: PlayerState, templeId: TempleId): void {
  const temple = getTemple(templeId);
  player.position.inCity = true;
  player.position.cityId = temple.cityId;
  player.position.cityChunkIndex = temple.cityChunkIndex;
  player.position.x = temple.x + 1;
  player.position.y = temple.y;
}

describe("temples and existing blessing lifecycle", () => {
  it.each(DEITY_IDS)("makes an explicit initial %s choice without changing social or replaying sources", (deityId) => {
    const player = hero();
    applyDevotionSource(player, "covenantReturned");
    visitDevotionTemple(player, "willowdaleSpan");
    performTempleRite(player, "willowdaleSpanThread");
    player.activeEffects.push({ id: "poison", remainingTurns: 2, source: "Mock trap" });
    const before = structuredClone(player);
    const snapshot = { expectedDeityId: null, expectedScore: 0 };
    expect(getDevotionAffiliationConsequences(player, deityId)).toContain("0 devotion");
    expect(changeDevotionAffiliation(player, "willowdaleSpan", deityId, snapshot).changed).toBe(true);
    expect(player.progression.devotion.deityId).toBe(deityId);
    expect(player.progression.devotion.score).toBe(0);
    expect(player.progression.devotion.affiliationChanges).toBe(1);
    const history = player.progression.devotion.history;
    expect(history[history.length - 1]?.sourceId).toBe(`affiliation:1:${deityId}`);
    expect(player.progression.devotion.appliedSourceIds).toEqual(before.progression.devotion.appliedSourceIds);
    expect(player.progression.devotion.visitedTempleIds).toEqual(before.progression.devotion.visitedTempleIds);
    expect(player.progression.social).toEqual(before.progression.social);
    expect(player.progression.quests).toEqual(before.progression.quests);
    expect(player.activeEffects).toEqual([{ id: "poison", remainingTurns: 2, source: "Mock trap" }]);
    const after = structuredClone(player);
    expect(changeDevotionAffiliation(player, "willowdaleSpan", deityId, snapshot).changed).toBe(false);
    expect(player).toEqual(after);
  });

  it("rejects a stale confirmation or remote affiliation attempt without side effects", () => {
    const player = hero();
    const before = structuredClone(player);
    expect(changeDevotionAffiliation(player, "willowdaleSpan", "tessune", {
      expectedDeityId: "selquor", expectedScore: 0,
    }).changed).toBe(false);
    expect(changeDevotionAffiliation(player, "sandportShoal", "tessune", {
      expectedDeityId: null, expectedScore: 0,
    }).changed).toBe(false);
    expect(player).toEqual(before);
  });

  it.each(TEMPLES)("has a safe live approach to $id without changing terrain authority", (temple) => {
    const city = getCity(temple.cityId)!;
    const map = getCityChunk(city, temple.cityChunkIndex)!.mapData;
    expect([Terrain.Temple, Terrain.Statue]).toContain(map[temple.y][temple.x]);
    expect(isWalkable(map[temple.y][temple.x + 1])).toBe(true);
    const player = hero();
    approach(player, temple.id);
    expect(getAdjacentDevotionTemple(player.position)?.id).toBe(temple.id);
    expect(visitDevotionTemple(player, temple.id).changed).toBe(true);
    expect(visitDevotionTemple(player, temple.id).changed).toBe(false);
    expect(player.progression.devotion.score).toBe(0);
  });

  it("requires the actual city, district and adjacent tile before spending anything", () => {
    const player = hero();
    const before = structuredClone(player);
    player.position.cityChunkIndex = 0;
    const displaced = structuredClone(player);
    expect(performTempleRite(player, "willowdaleSpanThread").changed).toBe(false);
    expect(player).toEqual(displaced);
    player.position = before.position;
    player.position.inDungeon = true;
    expect(getAdjacentDevotionTemple(player.position)).toBeUndefined();
  });

  it.each([null, ...DEITY_IDS])("offers exactly the same small blessing for %s", (deityId) => {
    const player = hero(deityId);
    const beforeAC = getArmorClass(player);
    const result = performTempleRite(player, "willowdaleSpanThread");
    expect(result.changed).toBe(true);
    expect(getArmorClass(player)).toBe(beforeAC + 1);
    expect(getActiveDevotionBlessing(player)?.effect.remainingTurns).toBe(3);
    expect(getActiveDevotionBlessing(player)?.definition.deityId).toBe(deityId);
    expect(player.shortRestsRemaining).toBe(2);
    expect(player.progression.devotion.score).toBe(deityId ? 6 : 0);
  });

  it("never stacks, refreshes, or reapplies a consumed blessing rite", () => {
    const player = hero("orivane");
    performTempleRite(player, "willowdaleSpanThread");
    processEndOfTurn(player.activeEffects);
    expect(performTempleRite(player, "willowdaleSpanThread").changed).toBe(false);
    expect(getActiveDevotionBlessing(player)?.effect.remainingTurns).toBe(2);
    approach(player, "ironholdSpan");
    const secondRite = TEMPLE_RITES.find((entry) => entry.id === "ironholdSpanThread")!;
    expect(getTempleRiteAvailability(player, secondRite).reason).toContain("cannot stack");
    expect(performTempleRite(player, secondRite.id).changed).toBe(false);
    expect(player.progression.devotion.appliedSourceIds).not.toContain(secondRite.id);
    clearAllEffects(player.activeEffects);
    expect(performTempleRite(player, secondRite.id).changed).toBe(true);
    expect(getEffectACModifier(player.activeEffects)).toBe(1);
  });

  it("expires only at the hero's three turn ends, never at a separate clock", () => {
    const player = hero();
    performTempleRite(player, "willowdaleSpanThread");
    const otherActorEffects: PlayerState["activeEffects"] = [];
    processEndOfTurn(otherActorEffects);
    expect(getActiveDevotionBlessing(player)?.effect.remainingTurns).toBe(3);
    for (let turn = 3; turn > 0; turn--) {
      expect(getActiveDevotionBlessing(player)?.effect.remainingTurns).toBe(turn);
      expect(processStartOfTurn(player.activeEffects, player.stats).skipTurn).toBe(false);
      processEndOfTurn(player.activeEffects);
    }
    expect(getActiveDevotionBlessing(player)).toBeNull();
    expect(getEffectACModifier(player.activeEffects)).toBe(0);
    expect(performTempleRite(player, "willowdaleSpanThread").changed).toBe(false);
  });

  it("clears through normal Battle cleanup and inn rest without reclaiming a rite", () => {
    const player = hero();
    performTempleRite(player, "willowdaleSpanThread");
    clearAllEffects(player.activeEffects);
    expect(getActiveDevotionBlessing(player)).toBeNull();
    approach(player, "ironholdSpan");
    performTempleRite(player, "ironholdSpanThread");
    restPartyAtInn(player);
    expect(getActiveDevotionBlessing(player)).toBeNull();
    expect(player.progression.devotion.appliedSourceIds)
      .toEqual(["willowdaleSpanThread", "ironholdSpanThread"]);
  });

  it("uses and validates the existing short-rest economy exactly once", () => {
    const player = hero();
    const full = structuredClone(player);
    expect(performTempleRite(player, "willowdaleSpanRespite").changed).toBe(false);
    expect(player).toEqual(full);
    player.hp = 1; player.mp = 0;
    const result = performTempleRite(player, "willowdaleSpanRespite");
    expect(result.changed).toBe(true);
    expect(player.hp).toBe(1 + Math.floor(player.maxHp / 2));
    expect(player.mp).toBe(Math.floor(player.maxMp / 2));
    expect(player.shortRestsRemaining).toBe(1);
    const rested = structuredClone(player);
    expect(performTempleRite(player, "willowdaleSpanRespite").changed).toBe(false);
    expect(player).toEqual(rested);
    approach(player, "ironholdSpan");
    player.shortRestsRemaining = 0;
    expect(performTempleRite(player, "ironholdSpanRespite").changed).toBe(false);
  });

  it("keeps all blessings mechanically identical and non-damaging", () => {
    expect(new Set(DEVOTION_BLESSINGS.map((entry) => entry.statusId)))
      .toEqual(new Set(["templeWard"]));
    expect(new Set(DEVOTION_BLESSINGS.map((entry) => entry.turns)))
      .toEqual(new Set([3]));
  });

  it("applies a meaningful keeper choice once in each distinct domain", () => {
    const player = hero("selquor");
    const initialQuests = structuredClone(player.progression.quests);
    const result = resolveTempleConversation(player, "willowdaleSpan", "willowdaleSpanShare");
    expect(result.delta).toBe(4);
    expect(player.progression.social.alignment.goodEvil).toBe(2);
    expect(player.progression.social.townReputation.willowdale_city).toBe(2);
    const snapshot = structuredClone(player);
    expect(resolveTempleConversation(player, "willowdaleSpan", "willowdaleSpanShare").changed)
      .toBe(false);
    expect(player).toEqual(snapshot);
    expect(player.progression.quests).toEqual(initialQuests);
    expect(player.activeEffects).toEqual([]);
  });

  it("allows a refusal and every social context without affiliation locks", () => {
    const player = hero("tessune");
    const snapshot = structuredClone(player);
    expect(resolveTempleConversation(player, "willowdaleSpan", "willowdaleSpanDecline").changed)
      .toBe(false);
    expect(player).toEqual(snapshot);
    applySocialMutation(player, {
      sourceId: "fixture:hostile", cause: "Mock social context",
      alignment: { goodEvil: -100, lawChaos: 150 },
      reputation: [{ kind: "town", targetId: "willowdale_city", delta: -100 }],
    });
    expect(getTempleGreeting(player, getTemple("willowdaleSpan"))).toContain("context");
    expect(performTempleRite(player, "willowdaleSpanThread").changed).toBe(true);
  });

  it("does not grant blessings during debug mutation or spend failed rites", () => {
    const player = hero("orivane");
    player.progression.achievements.debugMutationActive = true;
    const snapshot = structuredClone(player);
    expect(performTempleRite(player, "willowdaleSpanThread").changed).toBe(false);
    expect(player).toEqual(snapshot);
  });
});
