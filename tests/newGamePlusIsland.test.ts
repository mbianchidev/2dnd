import { describe, expect, it } from "vitest";
import { CITIES, Terrain, getCity, getTerrainAt, isWalkable } from "../src/data/map";
import { ISLANDS, MERCHANT_ROUTES, PORTS, getIsland } from "../src/data/nautical";
import { getAdjacentCodexReadable } from "../src/data/codexKnowledge";
import { isIslandAvailable, isIslandCityAvailable, getSecretIslandAt } from "../src/systems/islandAccess";
import { enterIsland, getSailingIsland, leaveIsland } from "../src/systems/islands";
import { acquireBoat } from "../src/systems/nauticalOwnership";
import { buildNewGamePlus } from "../src/systems/newGamePlus";
import { normalizeSaveData } from "../src/systems/save";
import { tryGridMove } from "../src/systems/movement";
import { createCodex, getCodexKnowledgeList, unlockCodexFromSignal } from "../src/systems/codex";
import { completeCampaignThroughOwners, createCompletedCampaign } from "./helpers/campaign";
import type { PlayerState } from "../src/systems/player";
import type { SaveData } from "../src/systems/save";
import type { PortDefinition } from "../src/data/nautical";

function createIslandCampaign(ng = true): SaveData {
  const source = createCompletedCampaign();
  const built = buildNewGamePlus(source, "island-fixture", 1000, "1234abcd");
  if (!built.ok) throw new Error(built.message);
  const save = ng ? built.data : source;
  const boat = acquireBoat(save.player.progression.nautical, "reedSkiff").boat;
  boat.condition = 47;
  save.player.progression.nautical.sailing = true;
  Object.assign(save.player.position, {
    inCity: false, cityId: "", cityChunkIndex: 0,
    inDungeon: false, dungeonId: "", dungeonLevel: 0,
    chunkX: 4, chunkY: 2, x: 12, y: 1,
  });
  return save;
}

function fingerprint(player: PlayerState): string {
  return JSON.stringify(player);
}

describe("NG+ secret Starfall Atoll", () => {
  it("does not spoil the island through locked Codex search or source hints", () => {
    const codex = createCodex();
    expect(getCodexKnowledgeList(codex, { search: "starfall" })).toEqual([]);
    unlockCodexFromSignal(codex, { type: "location", locationKind: "city", targetId: "starfall_atoll" });
    expect(getCodexKnowledgeList(codex, { search: "starfall" }).map((entry) => entry.id))
      .toEqual(["locationStarfallAtoll"]);
  });

  it("keeps the old sea tile and campaign cities unchanged, with a reachable optional interior", () => {
    const island = getIsland("starfallAtoll");
    expect(island.minimumNewGamePlusCycle).toBe(1);
    expect(getTerrainAt(4, 2, 12, 1)).toBe(Terrain.Water);
    const city = getCity(island.cityId!);
    expect(city).toBeDefined();
    expect(CITIES).toContain(city);
    expect(city!.chunks).toBeUndefined();
    expect(city!.connections).toEqual([]);
    expect(isWalkable(city!.mapData[city!.spawnY]![city!.spawnX]!)).toBe(true);
    expect(city!.mapData[14]![10]).toBe(Terrain.CityExit);
    expect(getAdjacentCodexReadable(city!.id, 0, 10, 5)?.id).toBe("starfallRememberedChart");
    expect(PORTS.some((port: PortDefinition) => port.islandId === "starfallAtoll")).toBe(false);
    expect(MERCHANT_ROUTES.every((route) =>
      route.portIds.every((id) => PORTS.some((port) => port.id === id)),
    )).toBe(true);
  });

  it("hides the island and rejects normal/post-game entry without changing any ownership", () => {
    const save = createIslandCampaign(false);
    const player = save.player;
    player.progression.discoveredCities.push("starfall_atoll");
    player.progression.nautical.discoveredIslandIds.push("starfallAtoll");
    const before = fingerprint(player);
    expect(isIslandAvailable(getIsland("starfallAtoll"), player.newGamePlus)).toBe(false);
    expect(isIslandCityAvailable("starfall_atoll", player.newGamePlus)).toBe(false);
    expect(getSecretIslandAt(player.newGamePlus, 4, 2, 12, 1)).toBeUndefined();
    expect(getSailingIsland(player)).toBeUndefined();
    expect(enterIsland(player, "starfallAtoll")).toMatchObject({ ok: false, reason: expect.stringContaining("New Game+") });
    expect(fingerprint(player)).toBe(before);
    expect(isIslandAvailable(getIsland("tideglassIsle"), null)).toBe(true);
  });

  it.each([undefined, null, { cycle: 1 }, { cycle: 99, policyVersion: 999 }])(
    "never uses malformed or missing cycle metadata to expose the secret: %j",
    (authority) => {
      expect(isIslandAvailable(getIsland("starfallAtoll"), authority)).toBe(false);
      expect(getSecretIslandAt(authority, 4, 2, 12, 1)).toBeUndefined();
    },
  );

  it.each([1, 2, 99])("allows a serviceable boat in validated cycle %i without a new quest gate", (cycle) => {
    const save = createIslandCampaign();
    save.player.newGamePlus = { ...save.player.newGamePlus!, cycle, parentCycle: cycle - 1 };
    const player = save.player;
    expect(getSailingIsland(player)?.id).toBe("starfallAtoll");
    const before = structuredClone(player);
    expect(enterIsland(player, "starfallAtoll").ok).toBe(true);
    expect(player.position).toMatchObject({ inCity: true, cityId: "starfall_atoll", inDungeon: false });
    expect(player.progression.nautical.sailing).toBe(false);
    expect(player.progression.nautical.discoveredIslandIds).toEqual(["starfallAtoll"]);
    expect(player.progression.discoveredCities).toEqual(["starfall_atoll"]);
    expect(player.progression.nautical.ownedBoats).toEqual(before.progression.nautical.ownedBoats);
    expect(player.inventory).toEqual(before.inventory);
    expect(player.gold).toBe(before.gold);
    expect(player.progression.quests).toEqual(before.progression.quests);
    expect(player.classProgression).toEqual(before.classProgression);
    expect(player.lastTownX).toBe(before.lastTownX);
    expect(player.lastTownY).toBe(before.lastTownY);
    const entered = fingerprint(player);
    expect(enterIsland(player, "starfallAtoll").ok).toBe(false);
    expect(fingerprint(player)).toBe(entered);

    Object.assign(player.position, { x: 10, y: 14 });
    expect(leaveIsland(player).ok).toBe(true);
    expect(player.position).toMatchObject({ inCity: false, cityId: "", chunkX: 4, chunkY: 2, x: 12, y: 1 });
    expect(player.progression.nautical.sailing).toBe(true);
    expect(enterIsland(player, "starfallAtoll").ok).toBe(true);
    expect(player.progression.nautical.discoveredIslandIds).toEqual(["starfallAtoll"]);
    expect(player.progression.discoveredCities).toEqual(["starfall_atoll"]);
  });

  it("requires actual sailing, the exact dock, and no pending nautical outcome", () => {
    const save = createIslandCampaign();
    const player = save.player;
    player.progression.nautical.sailing = false;
    expect(enterIsland(player, "starfallAtoll").ok).toBe(false);
    player.progression.nautical.sailing = true;
    player.position.x = 11;
    expect(enterIsland(player, "starfallAtoll").ok).toBe(false);
    player.position.x = 12;
    player.progression.nautical.ownedBoats[0]!.condition = 0;
    expect(enterIsland(player, "starfallAtoll").ok).toBe(false);
    player.progression.nautical.ownedBoats[0]!.condition = 47;
    player.progression.nautical.pendingEncounter = {
      instanceId: "island-sea-pending", stepId: "island-step",
      monsterId: "reefSlime", boatId: "reedSkiff", zoneId: "covenantStrait", depth: "shallow",
      chunkX: 4, chunkY: 2, tileX: 12, tileY: 1,
    };
    const before = fingerprint(player);
    expect(enterIsland(player, "starfallAtoll").ok).toBe(false);
    expect(fingerprint(player)).toBe(before);
  });

  it("preserves eligible island saves and recovers forged ordinary/legacy locations and discovery", () => {
    const save = createIslandCampaign();
    expect(enterIsland(save.player, "starfallAtoll").ok).toBe(true);
    save.player.progression.exploredTiles["c:starfall_atoll,10,5"] = true;
    const roundTrip = normalizeSaveData(structuredClone(save));
    expect(roundTrip?.player.position).toEqual(save.player.position);
    expect(roundTrip?.player.progression.nautical.discoveredIslandIds).toContain("starfallAtoll");
    expect(roundTrip?.player.progression.discoveredCities).toContain("starfall_atoll");

    for (const version of [26, 27]) {
      const forged = createIslandCampaign(false);
      forged.version = version;
      Object.assign(forged.player.position, save.player.position);
      forged.player.progression.discoveredCities = ["starfall_atoll", "willowdale_city"];
      forged.player.progression.nautical.discoveredIslandIds = ["starfallAtoll", "tideglassIsle"];
      forged.player.progression.exploredTiles["c:starfall_atoll,10,5"] = true;
      const loaded = normalizeSaveData(forged);
      expect(loaded?.player.position).toMatchObject({ inCity: false, cityId: "", chunkX: 4, chunkY: 2, x: 3, y: 3 });
      expect(loaded?.player.progression.discoveredCities).toEqual(["willowdale_city"]);
      expect(loaded?.player.progression.nautical.discoveredIslandIds).toEqual(["tideglassIsle"]);
      expect(loaded?.player.progression.exploredTiles["c:starfall_atoll,10,5"]).toBeUndefined();
    }
  });

  it("keeps ordinary boats on the original water while island interior movement fails closed", () => {
    const save = createIslandCampaign(false);
    save.player.position.y = 0;
    expect(tryGridMove(save.player, 0, 1)).toMatchObject({ moved: true, newTerrain: Terrain.Water });
    Object.assign(save.player.position, { inCity: true, cityId: "starfall_atoll", x: 10, y: 5 });
    const before = fingerprint(save.player);
    expect(tryGridMove(save.player, 0, 1).moved).toBe(false);
    expect(fingerprint(save.player)).toBe(before);
  });

  it("recovers an unusable imported island boat without repairing it or granting resources", () => {
    const save = createIslandCampaign();
    expect(enterIsland(save.player, "starfallAtoll").ok).toBe(true);
    save.player.progression.nautical.ownedBoats[0]!.condition = 0;
    const before = structuredClone(save.player);
    const loaded = normalizeSaveData(save);
    expect(loaded?.player.position).toMatchObject({ inCity: false, cityId: "", x: 3, y: 3 });
    expect(loaded?.player.progression.nautical.ownedBoats).toEqual(before.progression.nautical.ownedBoats);
    expect(loaded?.player.gold).toBe(before.gold);
    expect(loaded?.player.hp).toBe(before.hp);
    expect(loaded?.player.inventory).toEqual(before.inventory);
  });

  it("resets island/world discovery in the next cycle without writing the completed source or boat", () => {
    const source = createIslandCampaign();
    expect(enterIsland(source.player, "starfallAtoll").ok).toBe(true);
    source.player.progression.exploredTiles["c:starfall_atoll,10,5"] = true;
    const bosses = new Set<string>();
    completeCampaignThroughOwners(source.player, bosses);
    source.defeatedBosses = [...bosses];
    const before = JSON.stringify(source);
    const next = buildNewGamePlus(source, "island-next-cycle", 2000, "1234abcd");
    expect(next.ok).toBe(true);
    if (!next.ok) throw new Error(next.message);
    expect(JSON.stringify(source)).toBe(before);
    expect(next.data.player.newGamePlus?.cycle).toBe(2);
    expect(next.data.player.progression.nautical.discoveredIslandIds).toEqual([]);
    expect(next.data.player.progression.discoveredCities).toEqual([]);
    expect(next.data.player.progression.exploredTiles).toEqual({});
    expect(next.data.player.progression.nautical.ownedBoats).toEqual(source.player.progression.nautical.ownedBoats);
    expect(next.data.player.position).toMatchObject({ inCity: false, cityId: "", x: 3, y: 3 });
    expect(ISLANDS).toHaveLength(4);
  });
});
