import { MINIGAME_DIFFICULTIES, getMinigameVenue } from "../data/minigames";
import { getChunk } from "../data/map";
import { getPort } from "../data/nautical";
import { createSeededRandom } from "../utils/seededRandom";
import { WeatherType, rollWeather } from "./weather";
import type { MinigameActivityId, MinigameDifficultyId, MinigameVenueId } from "../data/minigames";
import type { CardinalHeading } from "../data/nautical";
import type {
  ArcheryChallenge,
  CrownDiceResult,
  CrownNaturalDice,
  MinigameChallenge,
  MinigamePoint,
  RegattaChallenge,
} from "./minigameTypes";

export const CROWN_AND_BONES_ODDS = {
  orderedOutcomes: 36, bones: 6, crown: 6, safe: 24,
} as const;

/** Harbor forecasts reuse canonical biome weights without changing city or campaign weather. */
export function getMinigameForecast(
  venueId: MinigameVenueId,
  seed: number,
  sequence: number,
  timeStep: number,
  localWeather: WeatherType,
): WeatherType {
  const venue = getMinigameVenue(venueId);
  if (!venue.portId || localWeather !== WeatherType.Clear) return localWeather;
  const port = getPort(venue.portId);
  const chunk = getChunk(port.location.chunkX, port.location.chunkY);
  if (!chunk) throw new Error(`[minigames] Missing port biome for ${venueId}.`);
  return rollWeather(chunk.name, timeStep, createSeededRandom(seed, `forecast:${sequence}:${port.id}`));
}

/** Exact ordered natural dice; presentation must not infer or reroll components. */
export function classifyCrownDice(rolls: CrownNaturalDice): CrownDiceResult {
  if (!rolls.every((roll) => Number.isInteger(roll) && roll >= 1 && roll <= 6)) {
    throw new Error("[minigames] Crown & Bones requires two natural d6 values.");
  }
  const total = rolls[0] + rolls[1];
  return {
    sides: 6,
    naturalRolls: [rolls[0], rolls[1]],
    modifier: 0,
    total,
    outcome: total === 7 ? "bones" : rolls[0] === rolls[1] ? "crown" : "safe",
  };
}

/** Banking is a total payout, including the original stake, not a profit bonus. */
export function getCrownPayout(stake: number, safeRolls: number, busted: boolean): number {
  if (
    !Number.isSafeInteger(stake) || stake < 0 || stake > 20
    || !Number.isInteger(safeRolls) || safeRolls < 0 || safeRolls > 4
  ) {
    throw new Error("[minigames] Invalid Crown & Bones stake or roll count.");
  }
  return busted ? 0 : Math.floor(stake * safeRolls / 2);
}

export function getCrownScore(rolls: readonly CrownNaturalDice[], taken: number): number {
  if (!Number.isInteger(taken) || taken < 0 || taken > rolls.length || taken > 4) {
    throw new Error("[minigames] Invalid Crown & Bones score input.");
  }
  let score = 0;
  for (const naturalRolls of rolls.slice(0, taken)) {
    const result = classifyCrownDice(naturalRolls);
    if (result.outcome === "bones") return 0;
    score += result.outcome === "crown" ? 25 : 20;
  }
  return Math.min(100, score);
}

export function getArcheryScore(
  challenge: ArcheryChallenge,
  shots: readonly number[],
  difficulty: MinigameDifficultyId,
): number {
  if (
    shots.length > challenge.targets.length
    || !shots.every((shot) => Number.isInteger(shot) && shot >= 0 && shot <= 100)
  ) {
    throw new Error("[minigames] Invalid archery precision input.");
  }
  const penalty = MINIGAME_DIFFICULTIES[difficulty].archeryPenalty;
  const total = shots.reduce((score, shot, index) =>
    score + Math.max(0, 100 - Math.abs(shot - challenge.targets[index]!) * penalty), 0);
  return Math.floor(total / challenge.targets.length);
}

function pointKey(point: MinigamePoint): string {
  return `${point.x},${point.y}`;
}

function appendRoute(route: MinigamePoint[], destination: MinigamePoint): void {
  let previous = route[route.length - 1]!;
  while (previous.x !== destination.x || previous.y !== destination.y) {
    previous = {
      x: previous.x + Math.sign(destination.x - previous.x),
      y: previous.x === destination.x
        ? previous.y + Math.sign(destination.y - previous.y)
        : previous.y,
    };
    route.push(previous);
  }
}

function createRegattaChallenge(
  difficulty: MinigameDifficultyId,
  random: () => number,
): RegattaChallenge {
  const start = { x: 0, y: 3 };
  const finish = { x: 8, y: 3 };
  const buoyColumns = difficulty === "expert" ? [2, 3, 5, 6] : [2, 4, 6];
  const buoys = buoyColumns.map((x) => ({ x, y: 1 + Math.floor(random() * 5) }));
  const route: MinigamePoint[] = [start];
  for (const waypoint of [...buoys, finish]) appendRoute(route, waypoint);
  const protectedKeys = new Set(route.map(pointKey));
  const candidates: MinigamePoint[] = [];
  for (let y = 0; y < 7; y += 1) {
    for (let x = 0; x < 9; x += 1) {
      if (!protectedKeys.has(`${x},${y}`)) candidates.push({ x, y });
    }
  }
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [candidates[index], candidates[swap]] = [candidates[swap]!, candidates[index]!];
  }
  const headings: readonly CardinalHeading[] = ["north", "east", "south", "west"];
  return {
    kind: "regatta",
    width: 9,
    height: 7,
    start,
    finish,
    buoys,
    obstacles: candidates.slice(0, MINIGAME_DIFFICULTIES[difficulty].regattaObstacles),
    route,
    windPattern: Array.from({ length: 8 }, () =>
      headings[Math.floor(random() * headings.length)]!),
  };
}

/** Select the exact finite challenge before any presentation or buy-in is exposed. */
export function createMinigameChallenge(
  activity: MinigameActivityId,
  difficulty: MinigameDifficultyId,
  seed: number,
  runId: string,
): MinigameChallenge {
  const random = createSeededRandom(seed, `${runId}:${activity}:${difficulty}`);
  if (activity === "crownAndBones") {
    return {
      kind: activity,
      rolls: Array.from({ length: 4 }, (): CrownNaturalDice => [
        1 + Math.floor(random() * 6), 1 + Math.floor(random() * 6),
      ]),
    };
  }
  if (activity === "archery") {
    return {
      kind: activity,
      targets: Array.from({ length: 5 }, () => 20 + Math.floor(random() * 61)),
    };
  }
  return createRegattaChallenge(difficulty, random);
}
