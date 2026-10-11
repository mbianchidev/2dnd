import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { awardXP, createPlayer, xpForLevel, type PlayerState } from "../src/systems/player";
import { createCodex } from "../src/systems/codex";
import { createCurrentSaveData, loadGame, normalizeSaveData, saveGame, SAVE_VERSION } from "../src/systems/save";
import { applyDevotionSource } from "../src/systems/devotion";
import { changeDevotionAffiliation, getActiveDevotionBlessing, performTempleRite, visitDevotionTemple } from "../src/systems/devotionTemples";
import { createDevotionState } from "../src/systems/devotionState";
import { processEndOfTurn } from "../src/systems/statusEffects";
import { prepareHeroLevelUp } from "../src/systems/classProgression";
import { createWeatherState } from "../src/systems/weather";
import { normalizeQuestLog } from "../src/systems/quests";
import { advancePrestige, prestigeFixture } from "./helpers/prestige";

function hero(): PlayerState {
  const player = createPlayer("Save fixture", {
    strength: 10, dexterity: 10, constitution: 10,
    intelligence: 10, wisdom: 10, charisma: 10,
  });
  Object.assign(player.position, {
    inCity: true, cityId: "willowdale_city", cityChunkIndex: 1, x: 10, y: 8,
  });
  return player;
}

function documentFor(player: PlayerState): ReturnType<typeof createCurrentSaveData> {
  return structuredClone(createCurrentSaveData(
    player, new Set(), createCodex(), player.appearanceId, 0, createWeatherState(),
  ));
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("devotion persistence and migration", () => {
  it("round-trips a pre-Battle blessing without refreshing its turn duration or rites", () => {
    const player = hero();
    player.progression.devotion.deityId = "orivane";
    visitDevotionTemple(player, "willowdaleSpan");
    performTempleRite(player, "willowdaleSpanThread");
    expect(saveGame(player, new Set(), createCodex(), "knight").ok).toBe(true);
    let loaded = loadGame()!.player;
    expect(loaded.progression.devotion).toEqual(player.progression.devotion);
    expect(getActiveDevotionBlessing(loaded)?.effect.remainingTurns).toBe(3);
    expect(performTempleRite(loaded, "willowdaleSpanThread").changed).toBe(false);
    processEndOfTurn(loaded.activeEffects);
    expect(saveGame(loaded, new Set(), createCodex(), "knight").ok).toBe(true);
    loaded = loadGame()!.player;
    expect(getActiveDevotionBlessing(loaded)?.effect.remainingTurns).toBe(2);
    expect(loaded.progression.devotion.score).toBe(6);
  });

  it.each([0, 3, 4, 5, 9, 12, 17, 18])("leaves schema %s unaffiliated without historical score guesses", (version) => {
    const player = hero();
    player.progression.quests.quests.twelvefoldCovenant.status = "completed";
    player.progression.quests.quests.twelvefoldCovenant.stage = 6;
    player.progression.devotion.deityId = "selquor";
    player.progression.devotion.score = 99;
    const raw = documentFor(player);
    raw["version"] = version;
    const result = normalizeSaveData(raw)!;
    expect(result.player.progression.devotion).toEqual({
      ...createDevotionState(), appliedSourceIds: ["covenantReturned"],
    });
    expect(applyDevotionSource(result.player, "covenantReturned").changed).toBe(false);
    expect(result.player.progression.devotion.score).toBe(0);
    expect(result.player.progression.quests.quests.twelvefoldCovenant.status).toBe("completed");
  });

  it("repairs a missing current-state record without replaying completed sources", () => {
    const player = hero();
    player.progression.quests.quests.ironboundDispatch.status = "completed";
    const raw = documentFor(player);
    const rawPlayer = raw.player;
    Reflect.deleteProperty(rawPlayer.progression, "devotion");
    const result = normalizeSaveData(raw)!.player;
    expect(result.progression.devotion.deityId).toBeNull();
    expect(result.progression.devotion.appliedSourceIds).toContain("dispatchKept");
    expect(result.progression.quests.quests.ironboundDispatch.status).toBe("completed");
  });

  it.each([19, 20])("migrates shipped schema %s without devotion or historical rewards", (version) => {
    const player = hero();
    player.progression.quests.quests.ironboundDispatch.status = "completed";
    player.progression.quests = normalizeQuestLog(player.progression.quests);
    const before = structuredClone(player);
    const raw = documentFor(player);
    raw.version = version;
    Reflect.deleteProperty(raw.player.progression, "devotion");
    const result = normalizeSaveData(raw);
    expect(result?.version).toBe(SAVE_VERSION);
    expect(result?.player.progression.devotion).toEqual({
      ...createDevotionState(), appliedSourceIds: ["dispatchKept"],
    });
    expect(result?.player.classProgression).toEqual(before.classProgression);
    expect(result?.player.progression.social).toEqual(before.progression.social);
    expect(result?.player.progression.quests).toEqual(before.progression.quests);
    expect(result?.player.gold).toBe(before.gold);
    expect(result?.player.xp).toBe(before.xp);
  });

  it.each([19, 20])("preserves schema %s feature-preview devotion and remaining blessing turns", (version) => {
    const player = hero();
    player.progression.devotion.deityId = "orivane";
    visitDevotionTemple(player, "willowdaleSpan");
    performTempleRite(player, "willowdaleSpanThread");
    applyDevotionSource(player, "dispatchKept");
    processEndOfTurn(player.activeEffects);
    const before = structuredClone(player);
    const raw = documentFor(player);
    raw.version = version;
    const result = normalizeSaveData(raw);
    expect(result?.version).toBe(SAVE_VERSION);
    expect(result?.player.progression.devotion).toEqual(before.progression.devotion);
    expect(result?.player.classProgression).toEqual(before.classProgression);
    expect(result?.player.activeEffects).toEqual(before.activeEffects);
    if (!result) throw new Error("Valid preview devotion save rejected");
    expect(getActiveDevotionBlessing(result.player)?.effect.remainingTurns).toBe(2);
    expect(applyDevotionSource(result.player, "dispatchKept").changed).toBe(false);
    expect(performTempleRite(result.player, "willowdaleSpanThread").changed).toBe(false);
  });

  it("preserves prestige, frozen credits and exact custom gear alongside devotion", () => {
    const player = prestigeFixture("prismScribe");
    advancePrestige(player, "prismScribe");
    awardXP(player, xpForLevel(player.level + 1) - player.xp);
    expect(prepareHeroLevelUp(player, () => 0.35).ok).toBe(true);
    if (!player.equippedWeapon) throw new Error("Missing fixture weapon");
    const original = { ...player.equippedWeapon, id: "mockEchoStaff", name: "Mock Echo Staff" };
    const equipped = { ...original, name: "Mock Mended Echo Staff", cost: original.cost + 3 };
    player.inventory.push(original, equipped);
    player.equippedWeapon = equipped;
    Object.assign(player.position, {
      inCity: true, cityId: "willowdale_city", cityChunkIndex: 1, x: 10, y: 8,
    });
    player.progression.devotion.deityId = "selquor";
    visitDevotionTemple(player, "willowdaleSpan");
    performTempleRite(player, "willowdaleSpanThread");
    processEndOfTurn(player.activeEffects);
    const before = structuredClone(player);
    const raw = documentFor(player);
    raw.version = 20;
    const random = vi.spyOn(Math, "random");
    random.mockClear();
    const result = normalizeSaveData(raw);
    if (!result) throw new Error("Valid integrated prestige/devotion save rejected");
    expect(result.version).toBe(SAVE_VERSION);
    for (const key of [
      "classProgression", "level", "xp", "hp", "maxHp", "mp", "maxMp",
      "stats", "knownSpells", "knownAbilities", "knownTalents", "inventory", "activeEffects",
    ] as const) {
      expect(result.player[key]).toEqual(before[key]);
    }
    expect(result.player.equippedWeapon).toBe(result.player.inventory[result.player.inventory.length - 1]);
    expect(result.player.progression.devotion).toEqual(before.progression.devotion);
    expect(result.player.progression.social).toEqual(before.progression.social);
    expect(random).not.toHaveBeenCalled();
    const progression = structuredClone(result.player.classProgression);
    expect(changeDevotionAffiliation(result.player, "willowdaleSpan", null, {
      expectedDeityId: "selquor", expectedScore: result.player.progression.devotion.score,
    }).changed).toBe(true);
    expect(result.player.classProgression).toEqual(progression);
    expect(result.player.activeEffects).toEqual([]);
  });

  it("consumes historical sources even when the legacy progression object is absent", () => {
    const player = hero();
    player.progression.quests.quests.ironboundDispatch.status = "completed";
    const raw = documentFor(player);
    raw.version = 20;
    Reflect.set(raw.player, "quests", raw.player.progression.quests);
    Reflect.deleteProperty(raw.player, "progression");
    const result = normalizeSaveData(raw);
    expect(result?.player.progression.devotion).toEqual({
      ...createDevotionState(), appliedSourceIds: ["dispatchKept"],
    });
    expect(result?.player.progression.quests.quests.ironboundDispatch.status).toBe("completed");
  });

  it("normalizes IDs and cross-fields without overwriting social or campaign state", () => {
    const player = hero();
    const social = structuredClone(player.progression.social);
    const raw = documentFor(player);
    const rawPlayer = raw.player;
    Reflect.set(rawPlayer.progression, "devotion", {
      deityId: "unknown", score: 500,
      appliedSourceIds: ["covenantReturned", "covenantReturned", "unknown"],
      visitedTempleIds: ["willowdaleSpan", "missing"],
      debugSourceIds: ["missing"], history: [{ sourceId: "unknown" }],
    });
    rawPlayer.activeEffects = [
      { id: "templeWard", remainingTurns: 0, source: "unknown" },
      { id: "poison", remainingTurns: 2, source: "fixture" },
    ];
    const result = normalizeSaveData(raw)!.player;
    expect(result.progression.devotion).toEqual({
      ...createDevotionState(),
      appliedSourceIds: ["covenantReturned"], visitedTempleIds: ["willowdaleSpan"],
    });
    expect(result.progression.social).toEqual(social);
    expect(result.activeEffects).toEqual([{ id: "poison", remainingTurns: 2, source: "fixture" }]);
  });

  it("repairs infinite or overlong blessing durations and rejects mismatched ownership", () => {
    const player = hero();
    player.progression.devotion.deityId = "tessune";
    performTempleRite(player, "willowdaleSpanThread");
    player.activeEffects[0].remainingTurns = 999;
    let normalized = normalizeSaveData(documentFor(player))!.player;
    expect(getActiveDevotionBlessing(normalized)?.effect.remainingTurns).toBe(3);
    player.activeEffects[0].remainingTurns = 0;
    normalized = normalizeSaveData(documentFor(player))!.player;
    expect(getActiveDevotionBlessing(normalized)).toBeNull();
    player.activeEffects[0].remainingTurns = 3;
    player.progression.devotion.deityId = "selquor";
    normalized = normalizeSaveData(documentFor(player))!.player;
    expect(normalized.activeEffects).toEqual([]);
  });

  it("does not reconstruct lost blessings or reinstate consumed ones on load", () => {
    const player = hero();
    performTempleRite(player, "willowdaleSpanThread");
    player.activeEffects = [];
    const normalized = normalizeSaveData(documentFor(player))!.player;
    expect(normalized.activeEffects).toEqual([]);
    expect(performTempleRite(normalized, "willowdaleSpanThread").changed).toBe(false);
  });

  it("round-trips a renunciation receipt without replaying old sources or blessings", () => {
    const player = hero();
    player.progression.devotion.deityId = "selquor";
    applyDevotionSource(player, "covenantReturned");
    performTempleRite(player, "willowdaleSpanThread");
    const score = player.progression.devotion.score;
    expect(changeDevotionAffiliation(player, "willowdaleSpan", null, {
      expectedDeityId: "selquor", expectedScore: score,
    }).delta).toBe(-score);
    const normalized = normalizeSaveData(documentFor(player))!.player;
    expect(normalized.progression.devotion).toEqual(player.progression.devotion);
    expect(normalized.progression.devotion.history[
      normalized.progression.devotion.history.length - 1
    ].delta).toBe(-score);
    expect(normalized.activeEffects).toEqual([]);
    expect(applyDevotionSource(normalized, "covenantReturned").changed).toBe(false);
    expect(performTempleRite(normalized, "willowdaleSpanThread").changed).toBe(false);
  });
});
