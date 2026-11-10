import { describe, expect, it, vi } from "vitest";
import { getCity, getCityChunk, getCityChunkCount } from "../src/data/cities";
import { getCityShopSkillCheckId } from "../src/data/skillChecks";
import { createPlayer, xpForLevel } from "../src/systems/player";
import { createCodex } from "../src/systems/codex";
import { claimCityInteriorProp, getCityInteriorProp } from "../src/systems/interiorExploration";
import { createHeroClassProgression, getAvailableProgressionGrants, getFeatureSources, getSpellCastingStat } from "../src/systems/classProgression";
import { normalizeSaveData, SAVE_VERSION } from "../src/systems/save";
import { getPermanentStudyLedger } from "../src/systems/interiorStudy";
import type { CityChunk } from "../src/data/mapTypes";

function fixture(cityId = "willowdale_city", kind: "home" | "library" | "shop" = "home"): {
  player: ReturnType<typeof createPlayer>; codex: ReturnType<typeof createCodex>; room: CityChunk;
} {
  const player = createPlayer("Fixture", {
    strength: 8, dexterity: 8, constitution: 12, intelligence: 12, wisdom: 10, charisma: 15,
  }, "warlock");
  const city = getCity(cityId)!;
  const index = Array.from({ length: getCityChunkCount(city) }, (_, i) => i)
    .find((i) => getCityChunk(city, i)?.interior?.kind === kind)!;
  const room = getCityChunk(city, index)!;
  Object.assign(player.position, { inCity: true, cityId, cityChunkIndex: index, x: 10, y: 12 });
  return { player, codex: createCodex(), room };
}

function approach(f: ReturnType<typeof fixture>, id: string): void {
  const prop = f.room.interior!.props.find((entry) => entry.id === id)!;
  Object.assign(f.player.position, { x: prop.x, y: prop.y + 1 });
}

describe("offered interior discoveries", () => {
  it("can address the clerk from beside the clerk or across the counter, but not remotely", () => {
    const f = fixture("willowdale_city", "shop");
    const counter = f.room.interior!.props.find((prop) => prop.kind === "counter")!;
    Object.assign(f.player.position, { x: counter.x, y: counter.y + 1 });
    expect(getCityInteriorProp(f.player, counter.id)).toBe(counter);
    Object.assign(f.player.position, { x: counter.x, y: counter.y - 2 });
    expect(getCityInteriorProp(f.player, counter.id)).toBe(counter);
    Object.assign(f.player.position, { x: counter.x - 3, y: counter.y - 2 });
    expect(getCityInteriorProp(f.player, counter.id)).toBeUndefined();
  });

  it("claims fixed coins and herbs once and keeps their ownership through normalization", () => {
    const f = fixture();
    const coins = f.room.interior!.props.find((prop) => prop.reward?.gold)!;
    approach(f, coins.id);
    const gold = f.player.gold;
    const persist = vi.fn(() => true);
    expect(claimCityInteriorProp(f.player, f.codex, coins.id, persist).changed).toBe(true);
    expect(f.player.gold).toBe(gold + 4);
    expect(claimCityInteriorProp(f.player, f.codex, coins.id, persist).changed).toBe(false);
    expect(persist).toHaveBeenCalledOnce();
    const herbs = f.room.interior!.props.find((prop) => prop.reward?.itemId)!;
    approach(f, herbs.id);
    const inventoryLength = f.player.inventory.length;
    claimCityInteriorProp(f.player, f.codex, herbs.id, persist);
    expect(f.player.inventory[inventoryLength]?.id).toBe("wildHerbs");
    const saved = normalizeSaveData({
      version: SAVE_VERSION, player: f.player, codex: f.codex, defeatedBosses: [],
      appearanceId: f.player.appearanceId, timestamp: 1000, playtimeSeconds: 0,
    })!;
    expect(saved.player.position).toEqual(f.player.position);
    expect(saved.player.progression.collectedTreasures).toEqual(f.player.progression.collectedTreasures);
    expect(saved.player.inventory[inventoryLength]?.id).toBe("wildHerbs");
  });

  it("rejects remote and pending inputs and restores exact arrays and equipment after a failed write", () => {
    const f = fixture();
    const prop = f.room.interior!.props.find((entry) => entry.reward?.itemId)!;
    const persist = vi.fn(() => false);
    expect(claimCityInteriorProp(f.player, f.codex, prop.id, persist).ok).toBe(false);
    expect(persist).not.toHaveBeenCalled();
    approach(f, prop.id);
    const before = JSON.stringify(f);
    const equipped = f.player.equippedWeapon;
    const inventory = f.player.inventory;
    const ledger = f.player.progression.collectedTreasures;
    expect(claimCityInteriorProp(f.player, f.codex, prop.id, persist).ok).toBe(false);
    expect(JSON.stringify(f)).toBe(before);
    expect(f.player.inventory).toBe(inventory);
    expect(f.player.progression.collectedTreasures).toBe(ledger);
    expect(f.player.equippedWeapon).toBe(equipped);
  });

  it("records library lore once without changing quest, combat or social authority", () => {
    const f = fixture("willowdale_city", "library");
    const book = f.room.interior!.props.find((prop) => prop.reward?.knowledgeId)!;
    approach(f, book.id);
    const authority = JSON.stringify([f.player.progression.quests, f.player.progression.social, f.player.classProgression]);
    const result = claimCityInteriorProp(f.player, f.codex, book.id, () => true);
    expect(result.unlockedIds).toEqual(["historyRoadsAndRest"]);
    expect(JSON.stringify([f.player.progression.quests, f.player.progression.social, f.player.classProgression])).toBe(authority);
    expect(claimCityInteriorProp(f.player, f.codex, book.id, () => true).changed).toBe(false);
  });

  it("requires owned caster ranks for rare study, preserves its casting stat on load and its permanent NG+ ledger", () => {
    const f = fixture("frostheim_city", "library");
    const book = f.room.interior!.props.find((prop) => prop.reward?.studyId)!;
    approach(f, book.id);
    expect(claimCityInteriorProp(f.player, f.codex, book.id, () => true).ok).toBe(false);
    f.player.classProgression = createHeroClassProgression("warlock", 4);
    f.player.level = 4;
    f.player.xp = xpForLevel(4);
    f.player.knownSpells = [...getAvailableProgressionGrants(f.player).spells];
    expect(f.player.knownSpells).not.toContain("rayOfFrost");
    expect(claimCityInteriorProp(f.player, f.codex, book.id, () => true).message).toContain("Learned Ray of Frost");
    expect(getSpellCastingStat(f.player, "rayOfFrost")).toBe("charisma");
    const saved = normalizeSaveData({
      version: SAVE_VERSION, player: f.player, codex: f.codex, defeatedBosses: [],
      appearanceId: f.player.appearanceId, timestamp: 1000, playtimeSeconds: 0,
    })!;
    expect(saved.player.knownSpells).toContain("rayOfFrost");
    expect(getSpellCastingStat(saved.player, "rayOfFrost")).toBe("charisma");
    expect(getPermanentStudyLedger(saved.player.progression.collectedTreasures)).toEqual(["study:winterPrimer"]);
    const bad = structuredClone(saved);
    bad.player.classProgression.classLevels = { warlock: 1 };
    bad.player.level = 1;
    expect(normalizeSaveData(bad)?.player.knownSpells).not.toContain("rayOfFrost");
  });

  it("keeps street negotiation IDs when shops move into a room", () => {
    const f = fixture("willowdale_city", "shop");
    const city = getCity("willowdale_city")!;
    const source = city.shops[f.room.interior!.sourceShopIndex!]!;
    expect(getCityShopSkillCheckId(city.id, f.player.position.cityChunkIndex, f.room.shops[0]!))
      .toBe(getCityShopSkillCheckId(city.id, 0, source));
  });

  it("binds a study spell to its qualifying owned class rather than a lower-ranked matching class", () => {
    const f = fixture("frostheim_city", "library");
    const book = f.room.interior!.props.find((prop) => prop.reward?.studyId)!;
    f.player.classProgression = createHeroClassProgression("sorcerer", 1);
    f.player.classProgression.classLevels = { sorcerer: 1, warlock: 4 };
    f.player.level = 5;
    f.player.xp = xpForLevel(5);
    f.player.knownSpells = [...getAvailableProgressionGrants(f.player).spells];
    approach(f, book.id);
    expect(claimCityInteriorProp(f.player, f.codex, book.id, () => true).changed).toBe(true);
    expect(getFeatureSources(f.player, "spell", "rayOfFrost").filter((source) => source.kind === "study"))
      .toEqual([expect.objectContaining({ trackId: "warlock", rank: 4, studyId: "winterPrimer" })]);
  });
});
