import { Terrain, getCity, getCityChunkMap, getTerrainAt } from "../data/map";
import { ISLANDS, PORTS, getBoat, getIsland, getIslandForCity, getSeaZoneAt, isIslandId } from "../data/nautical";
import { isIslandAvailable } from "./islandAccess";
import { applyPortGeography, findBoat } from "./nauticalState";
import type { CityData } from "../data/map";
import type { IslandDefinition, IslandId, PortDefinition } from "../data/nautical";
import type { PlayerState } from "./player";

export type IslandTravelResult =
  | { ok: true; island: IslandDefinition; city: CityData }
  | { ok: false; reason: string };

function boatRejection(player: PlayerState, island: IslandDefinition): string | undefined {
  const state = player.progression.nautical;
  if (state.pendingMerchantRoute || state.pendingEncounter || state.pendingHazard
    || player.progression.worldEvents.pending || player.progression.gathering.pending
    || player.progression.minigames.pending) {
    return "Finish the pending activity before island travel.";
  }
  const boat = findBoat(state);
  const dock = island.dock;
  const sea = dock && getSeaZoneAt(dock.chunkX, dock.chunkY, dock.tileX, dock.tileY);
  if (!boat || boat.condition <= 0 || !sea
    || (sea.depth === "deep" && !getBoat(boat.id).deepWaterCapable)) {
    return island.minimumNewGamePlusCycle === undefined
      ? "No serviceable boat. Use the world map for a merchant route."
      : "Select or repair a serviceable boat before sailing.";
  }
  if (!dock || getTerrainAt(dock.chunkX, dock.chunkY, dock.tileX, dock.tileY) !== Terrain.Water) {
    return "The island dock is not navigable.";
  }
  return undefined;
}

export function getSailingIsland(player: PlayerState): (IslandDefinition & { id: IslandId }) | undefined {
  const position = player.position;
  if (!player.progression.nautical.sailing || position.inCity || position.inDungeon) return undefined;
  return ISLANDS.find((island: IslandDefinition) => {
    const dock = island.dock;
    return !!island.cityId && !!dock && isIslandAvailable(island, player.newGamePlus)
      && dock.chunkX === position.chunkX && dock.chunkY === position.chunkY
      && dock.tileX === position.x && dock.tileY === position.y;
  });
}

/** Validate the live dock, cycle and boat before changing any campaign domain. */
export function enterIsland(player: PlayerState, islandId: IslandId): IslandTravelResult {
  if (!isIslandId(islandId)) return { ok: false, reason: "Unknown island." };
  const island = getIsland(islandId);
  if (!isIslandAvailable(island, player.newGamePlus)) {
    return { ok: false, reason: "This island can only be reached in New Game+." };
  }
  const city = island.cityId && getCity(island.cityId);
  if (!city || getSailingIsland(player)?.id !== island.id) {
    return { ok: false, reason: "Sail to the island dock before entering." };
  }
  const rejection = boatRejection(player, island);
  if (rejection) return { ok: false, reason: rejection };

  const state = player.progression.nautical;
  state.sailing = false;
  player.mountId = "";
  Object.assign(player.position, {
    inCity: true, cityId: city.id, cityChunkIndex: 0,
    inDungeon: false, dungeonId: "", dungeonLevel: 0,
    chunkX: city.chunkX, chunkY: city.chunkY, x: city.spawnX, y: city.spawnY,
  });
  if (!state.discoveredIslandIds.includes(islandId)) state.discoveredIslandIds.push(islandId);
  if (!state.discoveredContinentIds.includes(island.continentId)) {
    state.discoveredContinentIds.push(island.continentId);
  }
  if (!player.progression.discoveredCities.includes(city.id)) {
    player.progression.discoveredCities.push(city.id);
  }
  const port = PORTS.find((candidate: PortDefinition) => candidate.islandId === islandId);
  if (port) {
    applyPortGeography(state, port.id, !state.discoveredPortIds.includes(port.id));
    player.lastTownX = port.location.tileX;
    player.lastTownY = port.location.tileY;
    player.lastTownChunkX = port.location.chunkX;
    player.lastTownChunkY = port.location.chunkY;
  }
  return { ok: true, island, city };
}

/** Re-embark only from the interior's actual exit; never create or repair a boat. */
export function leaveIsland(player: PlayerState): IslandTravelResult {
  const island = getIslandForCity(player.position.cityId);
  const city = island?.cityId && getCity(island.cityId);
  if (!island || !city || !island.dock || !player.position.inCity
    || !isIslandAvailable(island, player.newGamePlus)
    || getCityChunkMap(city, player.position.cityChunkIndex)[player.position.y]?.[player.position.x] !== Terrain.CityExit) {
    return { ok: false, reason: "Use the accessible island dock to sail." };
  }
  const rejection = boatRejection(player, island);
  if (rejection) return { ok: false, reason: rejection };
  const dock = island.dock;
  Object.assign(player.position, {
    inCity: false, cityId: "", cityChunkIndex: 0,
    inDungeon: false, dungeonId: "", dungeonLevel: 0,
    chunkX: dock.chunkX, chunkY: dock.chunkY, x: dock.tileX, y: dock.tileY,
  });
  player.progression.nautical.sailing = true;
  return { ok: true, island, city };
}
