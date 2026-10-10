import { describe, expect, it } from "vitest";
import {
  DEITIES,
  DEITY_IDS,
  DEVOTION_DOMAINS,
  DEVOTION_SOURCE_DEFINITIONS,
  DEVOTION_TENETS,
  DEVOTION_TIERS,
  TEMPLE_RITES,
  TEMPLES,
} from "../src/data/devotion";
import {
  applyDevotionSource,
  getDevotionQualification,
  getDevotionTier,
  meetsDevotionRequirement,
} from "../src/systems/devotion";
import {
  createDevotionState,
  normalizeDevotionState,
} from "../src/systems/devotionState";
import { createPlayer, type PlayerState } from "../src/systems/player";

function hero(): PlayerState {
  return createPlayer("Devotion fixture", {
    strength: 10, dexterity: 10, constitution: 10,
    intelligence: 10, wisdom: 10, charisma: 10,
  });
}

describe("fictional devotion authority", () => {
  it("starts unaffiliated without changing the established social baseline", () => {
    const player = hero();
    expect(player.progression.devotion).toEqual(createDevotionState());
    expect(player.progression.devotion.deityId).toBeNull();
    expect(player.progression.devotion.score).toBe(0);
    expect(player.progression.social.alignment).toEqual({
      lawChaos: -50, goodEvil: 0,
    });
    expect(player.activeEffects).toEqual([]);
  });

  it.each(DEVOTION_TIERS)("classifies the exact $id boundary", (tier) => {
    expect(getDevotionTier(tier.minimum).id).toBe(tier.id);
    if (tier.minimum > 0) {
      expect(getDevotionTier(tier.minimum - 1).minimum)
        .toBeLessThan(tier.minimum);
    }
  });

  it("consumes unaffiliated sources without inventing retroactive devotion", () => {
    const player = hero();
    const first = applyDevotionSource(player, "covenantReturned");
    player.progression.devotion.deityId = "orivane";
    const second = applyDevotionSource(player, "covenantReturned");
    expect(first.changed).toBe(true);
    expect(first.delta).toBe(0);
    expect(second.changed).toBe(false);
    expect(player.progression.devotion.score).toBe(0);
    expect(player.progression.devotion.appliedSourceIds)
      .toEqual(["covenantReturned"]);
  });

  it.each(DEITY_IDS)("applies canonical sources once for %s", (deityId) => {
    const player = hero();
    player.progression.devotion.deityId = deityId;
    const first = applyDevotionSource(player, "covenantReturned");
    const snapshot = structuredClone(player.progression.devotion);
    const second = applyDevotionSource(player, "covenantReturned");
    expect(first.delta).toBeGreaterThan(0);
    expect(second.changed).toBe(false);
    expect(player.progression.devotion).toEqual(snapshot);
  });

  it("clamps positive and conflicting outcomes at both score bounds", () => {
    const player = hero();
    player.progression.devotion.deityId = "selquor";
    player.progression.devotion.score = 99;
    expect(applyDevotionSource(player, "covenantReturned").delta).toBe(1);
    expect(player.progression.devotion.score).toBe(100);
    player.progression.devotion.score = 1;
    expect(applyDevotionSource(player, "echoRecordTaken").delta).toBe(-1);
    expect(player.progression.devotion.score).toBe(0);
  });

  it("does not mutate unrelated authority or grant a blessing from a source", () => {
    const player = hero();
    player.progression.devotion.deityId = "tessune";
    const snapshot = structuredClone(player);
    applyDevotionSource(player, "covenantReturned");
    expect({ ...player, progression: {
      ...player.progression,
      devotion: snapshot.progression.devotion,
    } }).toEqual(snapshot);
  });

  it("consumes debug sources without natural points or subsequent replay", () => {
    const player = hero();
    player.progression.devotion.deityId = "orivane";
    const result = applyDevotionSource(player, "covenantReturned", { debug: true });
    expect(result.changed).toBe(true);
    expect(result.delta).toBe(0);
    expect(player.progression.devotion.debugSourceIds)
      .toEqual(["covenantReturned"]);
    expect(applyDevotionSource(player, "covenantReturned").changed).toBe(false);
    expect(player.progression.devotion.score).toBe(0);
  });

  it("rejects unknown sources before any mutation", () => {
    const player = hero();
    const before = structuredClone(player);
    expect(() => applyDevotionSource(player, "notACanonicalSource"))
      .toThrow("Unknown devotion source");
    expect(player).toEqual(before);
  });

  it("exposes pure optional qualifications, independent of social labels", () => {
    const player = hero();
    expect(meetsDevotionRequirement(player, {})).toBe(true);
    expect(meetsDevotionRequirement(player, { requireAffiliation: true }))
      .toBe(false);
    player.progression.devotion.deityId = "tessune";
    player.progression.devotion.score = 50;
    const before = structuredClone(player);
    expect(getDevotionQualification(player, {
      deityId: "tessune",
      domainId: "passage",
      minimumTier: "steadfast",
      minimumScore: 50,
    }).eligible).toBe(true);
    expect(meetsDevotionRequirement(player, { domainId: "testimony" }))
      .toBe(false);
    expect(meetsDevotionRequirement(player, { minimumScore: 51 })).toBe(false);
    expect(player).toEqual(before);
  });

  it("normalizes unknown, duplicate and cross-field data", () => {
    const state = normalizeDevotionState({
      deityId: "selquor", score: 999,
      appliedSourceIds: ["covenantReturned", "covenantReturned", "unknown", 2],
      visitedTempleIds: ["willowdaleSpan", "willowdaleSpan", "unknown"],
      debugSourceIds: ["unknown", "covenantReturned"],
      affiliationChanges: -2,
      history: [
        { sourceId: "covenantReturned", deityId: "selquor",
          delta: 8, score: 100, debug: true },
        { sourceId: "unknown", deityId: "selquor", delta: 10, score: 100 },
      ],
    }, 19);
    expect(state.score).toBe(100);
    expect(state.appliedSourceIds).toEqual(["covenantReturned"]);
    expect(state.debugSourceIds).toEqual(["covenantReturned"]);
    expect(state.visitedTempleIds).toEqual(["willowdaleSpan"]);
    expect(state.affiliationChanges).toBe(0);
    expect(state.history).toHaveLength(1);
    expect(normalizeDevotionState({ deityId: "unknown", score: 99 }, 19).score)
      .toBe(0);
    expect(normalizeDevotionState(state, 18)).toEqual(createDevotionState());
    expect(normalizeDevotionState(null, 19)).toEqual(createDevotionState());
  });

  it("rejects impossible history deltas without removing source idempotency", () => {
    const normalized = normalizeDevotionState({
      deityId: "orivane", score: 8,
      appliedSourceIds: ["covenantReturned"],
      history: [
        { sourceId: "covenantReturned", deityId: "orivane", delta: 100, score: 100 },
        { sourceId: "covenantReturned", deityId: "orivane", delta: 8, score: 8 },
      ],
    });
    expect(normalized.history).toHaveLength(1);
    expect(normalized.history[0].delta).toBe(8);
    expect(normalized.appliedSourceIds).toEqual(["covenantReturned"]);
    expect(normalized.score).toBe(8);
  });
});

describe("original pantheon contracts", () => {
  it("keeps unique stable IDs and complete original domain/tenet references", () => {
    for (const definitions of [
      DEITIES, DEVOTION_DOMAINS, DEVOTION_TENETS, TEMPLES,
      TEMPLE_RITES, DEVOTION_SOURCE_DEFINITIONS,
    ]) {
      expect(new Set(definitions.map((entry) => entry.id)).size)
        .toBe(definitions.length);
      definitions.forEach((entry) => {
        expect(entry.id).toMatch(/^[a-z][a-zA-Z0-9]*$/);
      });
    }
    for (const deity of DEITIES) {
      expect(deity.domainIds).toHaveLength(2);
      expect(deity.tenetIds).toHaveLength(2);
      deity.domainIds.forEach((id) =>
        expect(DEVOTION_DOMAINS.some((entry) => entry.id === id)).toBe(true));
      deity.tenetIds.forEach((id) =>
        expect(DEVOTION_TENETS.some((entry) => entry.id === id)).toBe(true));
    }
  });
});
