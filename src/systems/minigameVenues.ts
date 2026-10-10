import { MINIGAME_VENUES } from "../data/minigames";
import { getCity, getCityChunkMap, isWalkable } from "../data/map";
import type { MinigameVenueDefinition, MinigameVenueId } from "../data/minigames";
import type { MinigameState } from "./minigameTypes";
import type { PlayerState } from "./player";

export function isAtMinigameVenue(player: PlayerState, venue: MinigameVenueDefinition): boolean {
  const position = player.position;
  if (
    !position.inCity || position.inDungeon || player.progression.nautical.sailing
    || position.cityId !== venue.cityId || position.cityChunkIndex !== venue.cityChunkIndex
    || Math.abs(position.x - venue.x) + Math.abs(position.y - venue.y) > 1
  ) return false;
  const city = getCity(position.cityId);
  const map = city ? getCityChunkMap(city, position.cityChunkIndex) : undefined;
  const terrain = map?.[position.y]?.[position.x];
  return terrain !== undefined && isWalkable(terrain);
}

export function getNearbyMinigameVenue(
  player: PlayerState,
): (MinigameVenueDefinition & { readonly id: MinigameVenueId }) | undefined {
  return MINIGAME_VENUES.find((venue) => isAtMinigameVenue(player, venue));
}

export function discoverMinigameVenue(state: MinigameState, venueId: MinigameVenueId): boolean {
  if (state.discoveredVenueIds.includes(venueId)) return false;
  state.discoveredVenueIds.push(venueId);
  return true;
}
