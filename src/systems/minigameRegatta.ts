import {
  MINIGAME_DIFFICULTIES,
  getMinigameVenue,
} from "../data/minigames";
import { Terrain } from "../data/map";
import { getPort } from "../data/nautical";
import { getBoatConditionLossMultiplier } from "./nauticalOwnership";
import { createNauticalState } from "./nauticalState";
import { resolveSailingMove } from "./nauticalNavigation";
import { WeatherType } from "./weather";
import type { CardinalHeading } from "../data/nautical";
import type { MinigamePoint, RegattaSession } from "./minigameTypes";
import type { PlayerPosition } from "./player";

interface RegattaWeatherProfile {
  readonly wind: boolean;
  readonly wearEvery: number;
  readonly wear: number;
  readonly fogEffortEvery: number;
}

export const REGATTA_WEATHER: Readonly<Record<WeatherType, RegattaWeatherProfile>> = {
  [WeatherType.Clear]: { wind: false, wearEvery: 0, wear: 0, fogEffortEvery: 0 },
  [WeatherType.Rain]: { wind: true, wearEvery: 8, wear: 1, fogEffortEvery: 0 },
  [WeatherType.Snow]: { wind: true, wearEvery: 6, wear: 1, fogEffortEvery: 0 },
  [WeatherType.Sandstorm]: { wind: true, wearEvery: 6, wear: 2, fogEffortEvery: 0 },
  [WeatherType.Storm]: { wind: true, wearEvery: 4, wear: 2, fogEffortEvery: 0 },
  [WeatherType.Fog]: { wind: false, wearEvery: 10, wear: 1, fogEffortEvery: 3 },
};

export interface RegattaProgress {
  readonly position: MinigamePoint;
  readonly buoyIndex: number;
  readonly moves: number;
  readonly effort: number;
  readonly parEffort: number;
  readonly collisions: number;
  readonly conditionLost: number;
  readonly complete: boolean;
  readonly timeout: boolean;
  readonly valid: boolean;
  readonly score: number;
}

const OPPOSITE: Readonly<Record<CardinalHeading, CardinalHeading>> = {
  north: "south", east: "west", south: "north", west: "east",
};

export function getRegattaWind(
  session: RegattaSession,
  moveIndex = session.game.headings.length,
): CardinalHeading | undefined {
  return REGATTA_WEATHER[session.weather].wind
    ? session.challenge.windPattern[moveIndex % session.challenge.windPattern.length]
    : undefined;
}

function effortForMove(
  session: RegattaSession,
  heading: CardinalHeading,
  index: number,
): number {
  const profile = REGATTA_WEATHER[session.weather];
  const wind = getRegattaWind(session, index);
  const againstWind = wind !== undefined && heading === OPPOSITE[wind];
  const fog = profile.fogEffortEvery > 0 && (index + 1) % profile.fogEffortEvery === 0;
  const wornHull = session.boat.condition < 50 && (index + 1) % 4 === 0;
  return 1 + Number(againstWind) + Number(fog) + Number(wornHull);
}

function headingBetween(from: MinigamePoint, to: MinigamePoint): CardinalHeading {
  if (to.x > from.x) return "east";
  if (to.x < from.x) return "west";
  return to.y > from.y ? "south" : "north";
}

function samePoint(left: MinigamePoint, right: MinigamePoint): boolean {
  return left.x === right.x && left.y === right.y;
}

/** Replay only recorded cardinal inputs through the canonical nautical eligibility model. */
export function getRegattaProgress(session: RegattaSession): RegattaProgress {
  const venue = getMinigameVenue(session.venueId);
  if (!venue.portId) throw new Error("[minigames] A regatta venue requires a port.");
  const port = getPort(venue.portId);
  const course = session.challenge;
  const state = createNauticalState();
  state.sailing = true;
  state.activeBoatId = session.boat.id;
  state.ownedBoats = [session.boat];
  let position: PlayerPosition = {
    ...course.start, chunkX: port.location.chunkX, chunkY: port.location.chunkY,
    inCity: false, cityId: "", cityChunkIndex: 0,
    inDungeon: false, dungeonId: "", dungeonLevel: 0,
  };
  const terrainAt = (chunkX: number, chunkY: number, x: number, y: number): Terrain | undefined =>
    chunkX === port.location.chunkX && chunkY === port.location.chunkY
      && x >= 0 && x < course.width && y >= 0 && y < course.height
      ? Terrain.Water : undefined;
  const blocked = (target: PlayerPosition): boolean =>
    course.obstacles.some((obstacle) => samePoint(target, obstacle));
  const limit = MINIGAME_DIFFICULTIES[session.difficultyId].regattaMoveLimit;
  const profile = REGATTA_WEATHER[session.weather];
  const multiplier = getBoatConditionLossMultiplier(session.boat);
  let buoyIndex = 0;
  let effort = 0;
  let collisions = 0;
  let conditionLost = 0;
  let complete = false;
  let valid = true;

  session.game.headings.forEach((heading, index) => {
    if (complete || index >= limit) {
      valid = false;
      return;
    }
    effort += effortForMove(session, heading, index);
    const move = resolveSailingMove(state, position, heading, terrainAt, blocked);
    if (move.ok && move.target) position = move.target;
    else collisions += 1;
    const weatherWear = profile.wearEvery > 0 && (index + 1) % profile.wearEvery === 0
      ? profile.wear : 0;
    const rawWear = (move.ok ? 0 : 2) + weatherWear;
    if (!session.practice && !session.debug) {
      conditionLost = Math.min(
        MINIGAME_DIFFICULTIES[session.difficultyId].regattaWearCap,
        Math.max(0, session.boat.condition - 1),
        conditionLost + Math.ceil(rawWear * multiplier),
      );
    }
    const nextBuoy = course.buoys[buoyIndex];
    if (nextBuoy && samePoint(position, nextBuoy)) buoyIndex += 1;
    complete = buoyIndex === course.buoys.length && samePoint(position, course.finish);
  });

  const parEffort = course.route.slice(1).reduce((total, point, index) =>
    total + effortForMove(session, headingBetween(course.route[index]!, point), index), 0);
  const timeout = !complete && session.game.headings.length >= limit;
  const score = complete
    ? Math.max(0, 100 - Math.max(0, effort - parEffort) * 2 - collisions * 8)
    : 0;
  return {
    position: { x: position.x, y: position.y },
    buoyIndex, moves: session.game.headings.length, effort, parEffort,
    collisions, conditionLost, complete, timeout, valid, score,
  };
}
