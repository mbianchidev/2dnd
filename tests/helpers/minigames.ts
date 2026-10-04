import { getMinigameVenue } from "../../src/data/minigames";
import { getCity } from "../../src/data/map";
import { createPlayer } from "../../src/systems/player";
import { acquireBoat } from "../../src/systems/nauticalOwnership";
import { createMinigameState } from "../../src/systems/minigameState";
import { WeatherType } from "../../src/systems/weather";
import type { MinigameVenueId } from "../../src/data/minigames";
import type { MinigameAction, MinigameActionRequest, MinigameStartRequest } from "../../src/systems/minigameTypes";
import type { PlayerState } from "../../src/systems/player";

export function playerAt(venueId: MinigameVenueId, seed = 167): PlayerState {
  const player = createPlayer("Challenge Fixture", {
    strength: 10, dexterity: 10, constitution: 10,
    intelligence: 10, wisdom: 10, charisma: 10,
  });
  player.gold = 1_000;
  player.progression.minigames = createMinigameState(seed);
  const venue = getMinigameVenue(venueId);
  const city = getCity(venue.cityId)!;
  player.position = {
    ...player.position, inCity: true, cityId: venue.cityId,
    cityChunkIndex: venue.cityChunkIndex, x: venue.x, y: venue.y,
    chunkX: city.chunkX, chunkY: city.chunkY,
  };
  if (venue.activityId === "regatta") acquireBoat(player.progression.nautical, "merchantSloop");
  return player;
}

export function startRequest(
  player: PlayerState,
  venueId: MinigameVenueId,
  options: Partial<MinigameStartRequest> = {},
): MinigameStartRequest {
  return {
    sequence: player.progression.minigames.sequence + 1,
    venueId, difficultyId: "friendly", timeStep: 45,
    weather: WeatherType.Clear, ...options,
  };
}

export function requestFor(player: PlayerState, action: MinigameAction): MinigameActionRequest {
  const pending = player.progression.minigames.pending;
  if (!pending) throw new Error("Missing fixture session");
  return { sessionId: pending.sessionId, expectedRevision: pending.revision, action };
}
