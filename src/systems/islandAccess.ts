import { ISLANDS, getIslandForCity } from "../data/nautical";
import { isNewGamePlusState } from "./newGamePlusState";
import type { IslandDefinition } from "../data/nautical";

/** Discovery and lore never authorize entry to a cycle-gated island. */
export function isIslandAvailable(island: IslandDefinition, authority: unknown): boolean {
  const minimum = island.minimumNewGamePlusCycle;
  return minimum === undefined || (
    Number.isSafeInteger(minimum) && minimum >= 1
    && isNewGamePlusState(authority) && authority.cycle >= minimum
  );
}

export function isIslandCityAvailable(cityId: string, authority: unknown): boolean {
  const island = getIslandForCity(cityId);
  return !island || isIslandAvailable(island, authority);
}

export function getSecretIslands(authority: unknown): readonly IslandDefinition[] {
  return ISLANDS.filter((island: IslandDefinition) =>
    island.minimumNewGamePlusCycle !== undefined && isIslandAvailable(island, authority),
  );
}

export function getSecretIslandAt(
  authority: unknown,
  chunkX: number,
  chunkY: number,
  x: number,
  y: number,
): IslandDefinition | undefined {
  return getSecretIslands(authority).find((island) =>
    island.location.chunkX === chunkX && island.location.chunkY === chunkY
    && island.location.tileX === x && island.location.tileY === y,
  );
}
