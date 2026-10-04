import { describe, expect, it } from "vitest";
import {
  MINIGAME_ACTIVITY_IDS,
  MINIGAME_DIFFICULTIES,
  MINIGAME_GOLD_SCORE,
  MINIGAME_HISTORY_LIMIT,
  getMinigameMilestoneId,
  getMinigameRecordId,
} from "../src/data/minigames";
import { createCodex } from "../src/systems/codex";
import { getMinigameSessionId } from "../src/systems/minigameState";
import {
  applyMinigameAction,
  getMinigameDifficultyReason,
  getMinigameScore,
  startMinigame,
} from "../src/systems/minigames";
import { classifyCrownDice, createMinigameChallenge } from "../src/systems/minigameRules";
import { getRegattaProgress } from "../src/systems/minigameRegatta";
import { commitMinigameMutation } from "../src/systems/minigameTransactions";
import { WeatherType } from "../src/systems/weather";
import { PLAYER_CLASSES } from "../src/systems/classes";
import { acquireBoat, installBoatUpgrade } from "../src/systems/nauticalOwnership";
import { playerAt, requestFor, startRequest } from "./helpers/minigames";
import type { CardinalHeading } from "../src/data/nautical";
import type { CodexData } from "../src/systems/codex";
import type {
  ArcherySession,
  MinigameAction,
  MinigameActionRequest,
  MinigameMutationResult,
} from "../src/systems/minigameTypes";
import type { PlayerState } from "../src/systems/player";

function act(
  player: PlayerState,
  action: MinigameAction,
  codex?: CodexData,
): MinigameMutationResult {
  const result = applyMinigameAction(player, requestFor(player, action), codex);
  expect(result.ok, result.message).toBe(true);
  return result;
}

function archery(player: PlayerState): ArcherySession {
  const session = player.progression.minigames.pending;
  if (session?.activityId !== "archery") throw new Error("Missing archery fixture");
  return session;
}

function aimAtNextTarget(player: PlayerState): void {
  const target = archery(player).challenge.targets[archery(player).game.shots.length]!;
  while (archery(player).game.aim !== target) {
    act(player, { type: "aim", delta: archery(player).game.aim < target ? 1 : -1 });
  }
}

function finishArchery(player: PlayerState, codex?: CodexData): MinigameMutationResult {
  let result: MinigameMutationResult = { ok: true, changed: false, idempotent: false, message: "Fixture" };
  for (let index = 0; index < 5; index += 1) {
    aimAtNextTarget(player);
    result = act(player, { type: "fire" }, codex);
  }
  return result;
}

function crownSeed(bones: boolean): number {
  for (let seed = 1; seed < 200; seed += 1) {
    const challenge = createMinigameChallenge("crownAndBones", "friendly", seed, getMinigameSessionId(seed, 1));
    if (challenge.kind !== "crownAndBones") throw new Error("Missing dice fixture");
    const hasBones = challenge.rolls.some((roll) => classifyCrownDice(roll).outcome === "bones");
    if (hasBones === bones) return seed;
  }
  throw new Error("No deterministic dice fixture");
}

function finishRegatta(player: PlayerState, codex?: CodexData): MinigameMutationResult {
  const session = player.progression.minigames.pending;
  if (session?.activityId !== "regatta") throw new Error("Missing regatta fixture");
  let result: MinigameMutationResult = { ok: true, changed: false, idempotent: false, message: "Fixture" };
  for (let index = 1; index < session.challenge.route.length; index += 1) {
    const previous = session.challenge.route[index - 1]!;
    const point = session.challenge.route[index]!;
    const heading: CardinalHeading = point.x > previous.x ? "east"
      : point.x < previous.x ? "west" : point.y > previous.y ? "south" : "north";
    result = act(player, { type: "sail", heading }, codex);
  }
  return result;
}

describe("atomic entries and once-only revisions", () => {
  it("reserves one capped buy-in and exact challenge before any roll", () => {
    const player = playerAt("willowInnTable", crownSeed(false));
    const request = startRequest(player, "willowInnTable");
    expect(startMinigame(player, request).changed).toBe(true);
    const snapshot = structuredClone(player.progression.minigames.pending);
    expect(player.gold).toBe(995);
    expect(startMinigame(player, request).idempotent).toBe(true);
    expect(player.gold).toBe(995);
    expect(player.progression.minigames.pending).toEqual(snapshot);
    expect(player.progression.minigames.statistics.crownAndBones.attempts).toBe(1);
  });

  it("rejects unsafe stakes, insufficient funds, locked difficulty, and off-venue play without mutations", () => {
    const player = playerAt("willowInnTable");
    const before = structuredClone(player);
    for (const stake of [0, -1, 6, 2.5, NaN, Infinity]) {
      expect(startMinigame(player, startRequest(player, "willowInnTable", { stake })).ok).toBe(false);
    }
    expect(startMinigame(player, startRequest(player, "willowInnTable", { difficultyId: "expert" })).ok).toBe(false);
    expect(player).toEqual(before);
    player.gold = 4;
    expect(startMinigame(player, startRequest(player, "willowInnTable")).ok).toBe(false);
    player.gold = 1_000;
    player.position.inCity = false;
    expect(startMinigame(player, startRequest(player, "willowInnTable")).ok).toBe(false);
    expect(player.progression.minigames.sequence).toBe(0);
  });

  it("consumes a repeated roll once and exposes only its exact authoritative components", () => {
    const player = playerAt("willowInnTable", crownSeed(false));
    startMinigame(player, startRequest(player, "willowInnTable"));
    const request = requestFor(player, { type: "roll" });
    const result = applyMinigameAction(player, request);
    const pending = player.progression.minigames.pending;
    if (pending?.activityId !== "crownAndBones") throw new Error("Missing dice fixture");
    expect(result.roll?.naturalRolls).toEqual(pending.challenge.rolls[0]);
    expect(result.roll?.total).toBe(result.roll!.naturalRolls[0] + result.roll!.naturalRolls[1]);
    expect(result.roll?.rollId).toBe(`${pending.sessionId}:roll:1`);
    expect(applyMinigameAction(player, request).idempotent).toBe(true);
    expect(player.progression.minigames.pending?.revision).toBe(1);
    expect(getMinigameScore(player.progression.minigames.pending!)).toBeGreaterThanOrEqual(20);
  });

  it("settles a four-roll bank once and rejects delayed entry, bank, and acknowledgement replays", () => {
    const player = playerAt("willowInnTable", crownSeed(false));
    const entry = startRequest(player, "willowInnTable");
    startMinigame(player, entry);
    let result: MinigameMutationResult | undefined;
    for (let index = 0; index < 4; index += 1) result = act(player, { type: "roll" });
    expect(result?.receipt?.goldPaid).toBe(10);
    expect(player.gold).toBe(1_005);
    const bank = requestFor(player, { type: "bank" });
    expect(applyMinigameAction(player, bank).idempotent).toBe(true);
    const acknowledgement = requestFor(player, { type: "acknowledge" });
    expect(applyMinigameAction(player, acknowledgement).changed).toBe(true);
    expect(applyMinigameAction(player, bank).idempotent).toBe(true);
    expect(applyMinigameAction(player, acknowledgement).idempotent).toBe(true);
    expect(startMinigame(player, entry).idempotent).toBe(true);
    expect(player.gold).toBe(1_005);
    expect(player.progression.minigames.settledSequence).toBe(1);
    expect(player.progression.minigames.history).toHaveLength(1);
  });

  it("cannot bank after Bones and forfeits an abandoned entry without shifting alignment", () => {
    const player = playerAt("willowInnTable", crownSeed(true));
    const alignment = structuredClone(player.progression.social.alignment);
    startMinigame(player, startRequest(player, "willowInnTable"));
    while (player.progression.minigames.pending?.phase === "playing") act(player, { type: "roll" });
    expect(player.progression.minigames.pending?.receipt?.outcome).toBe("bones");
    act(player, { type: "bank" });
    expect(player.gold).toBe(995);
    act(player, { type: "acknowledge" });
    startMinigame(player, startRequest(player, "willowInnTable"));
    const abandonment = requestFor(player, { type: "abandon" });
    expect(applyMinigameAction(player, abandonment).receipt?.goldPaid).toBe(0);
    expect(applyMinigameAction(player, abandonment).idempotent).toBe(true);
    expect(player.gold).toBe(990);
    expect(player.progression.social.alignment).toEqual(alignment);
  });

  it("never uses bounded history as its payment ledger", () => {
    const player = playerAt("willowInnTable");
    let oldest: MinigameActionRequest | undefined;
    for (let index = 0; index < MINIGAME_HISTORY_LIMIT + 5; index += 1) {
      startMinigame(player, startRequest(player, "willowInnTable", { stake: 1 }));
      const request = requestFor(player, { type: "bank" });
      oldest ??= request;
      applyMinigameAction(player, request);
      act(player, { type: "acknowledge" });
    }
    expect(player.progression.minigames.history).toHaveLength(MINIGAME_HISTORY_LIMIT);
    const gold = player.gold;
    expect(applyMinigameAction(player, oldest!).idempotent).toBe(true);
    expect(player.gold).toBe(gold);
  });
});

describe("archery precision, finite laurels, and natural evidence", () => {
  it.each(PLAYER_CLASSES.map((playerClass) => playerClass.id))(
    "uses the identical accepted-position score and economy for class %s",
    (classId) => {
      const player = playerAt("willowdaleRange", 167, classId);
      const resources = { hp: player.hp, mp: player.mp, xp: player.xp };
      startMinigame(player, startRequest(player, "willowdaleRange"));
      const challenge = archery(player).challenge;
      for (const target of challenge.targets) {
        act(player, { type: "fire", aim: target - 1 });
      }
      expect(player.progression.minigames.pending?.receipt?.score).toBe(96);
      expect(player.progression.minigames.pending?.receipt?.goldPaid).toBe(13);
      expect(player.gold).toBe(1_008);
      expect({ hp: player.hp, mp: player.mp, xp: player.xp }).toEqual(resources);
    },
  );

  it("records a perfect paid score, first-only bonus, Codex and bounded reputation without touching quests", () => {
    const player = playerAt("willowdaleRange");
    const codex = createCodex();
    const quests = structuredClone(player.progression.quests);
    const alignment = structuredClone(player.progression.social.alignment);
    startMinigame(player, startRequest(player, "willowdaleRange"));
    const result = finishArchery(player, codex);
    expect(result.receipt?.score).toBe(100);
    expect(result.receipt?.goldPaid).toBe(13);
    expect(player.gold).toBe(1_008);
    expect(player.progression.minigames.claimedMilestoneIds)
      .toContain(getMinigameMilestoneId("archery", "friendly"));
    expect(player.progression.minigames.bests[getMinigameRecordId("willowdaleRange", "friendly")]?.score).toBe(100);
    expect(player.progression.minigames.statistics.archery.medals).toBe(1);
    expect(codex.unlockedEntryIds).toContain("historyArrowFair");
    expect(player.progression.social.townReputation["willowdale_city"]).toBe(2);
    expect(player.progression.social.alignment).toEqual(alignment);
    expect(player.progression.quests).toEqual(quests);
    expect(getMinigameDifficultyReason(player.progression.minigames, "archery", "seasoned")).toBeUndefined();
  });

  it("cannot farm guaranteed currency or reputation by repeating a perfect run at another venue", () => {
    const player = playerAt("willowdaleRange");
    const codex = createCodex();
    startMinigame(player, startRequest(player, "willowdaleRange"));
    finishArchery(player, codex);
    act(player, { type: "acknowledge" });
    const gold = player.gold;
    const social = structuredClone(player.progression.social);
    const destination = playerAt("thornvaleFestival").position;
    player.position = destination;
    for (let index = 0; index < 3; index += 1) {
      startMinigame(player, startRequest(player, "thornvaleFestival"));
      expect(finishArchery(player, codex).receipt?.bonusGold).toBe(0);
      act(player, { type: "acknowledge" });
    }
    expect(player.gold).toBe(gold);
    expect(player.progression.social).toEqual(social);
    expect(player.progression.minigames.claimedMilestoneIds).toHaveLength(1);
  });

  it("supports free precision practice without currency, natural counters, reputation, or lore", () => {
    const player = playerAt("willowdaleRange");
    const codex = createCodex();
    const social = structuredClone(player.progression.social);
    startMinigame(player, startRequest(player, "willowdaleRange", { practice: true }));
    expect(finishArchery(player, codex).receipt?.goldPaid).toBe(0);
    expect(player.gold).toBe(1_000);
    expect(player.progression.minigames.statistics.archery).toEqual({ attempts: 0, completions: 0, medals: 0 });
    expect(player.progression.minigames.bests).toEqual({});
    expect(player.progression.minigames.practiceBests[getMinigameRecordId("willowdaleRange", "friendly")]?.score).toBe(100);
    expect(player.progression.social).toEqual(social);
    expect(codex.unlockedEntryIds).toEqual([]);
  });

  it("contains debug evidence separately and never leaks debug medals or payouts", () => {
    const player = playerAt("willowdaleRange");
    const codex = createCodex();
    startMinigame(player, startRequest(player, "willowdaleRange", { debug: true }));
    finishArchery(player, codex);
    expect(player.gold).toBe(1_000);
    expect(player.progression.minigames.bests).toEqual({});
    expect(player.progression.minigames.practiceBests).toEqual({});
    expect(player.progression.minigames.claimedMilestoneIds).toEqual([]);
    expect(player.progression.minigames.statistics.archery.medals).toBe(0);
    expect(player.progression.minigames.history[0]?.debug).toBe(true);
    expect(player.progression.social.appliedSourceIds).toEqual([]);
    expect(codex.unlockedEntryIds).toEqual([]);
  });
});

describe("regatta movement, boat wear, weather, and safe return", () => {
  it("rejects an active-boat switch before any additional input, wear, or settlement", () => {
    const player = playerAt("sandportRegatta");
    startMinigame(player, startRequest(player, "sandportRegatta"));
    acquireBoat(player.progression.nautical, "reedSkiff");
    player.progression.nautical.activeBoatId = "reedSkiff";
    const before = structuredClone(player);
    const result = applyMinigameAction(player, requestFor(player, { type: "sail", heading: "east" }));
    expect(result.ok).toBe(false);
    expect(result.message).toContain("changed outside");
    expect(player).toEqual(before);
  });

  it("applies canonical reinforced-hull multipliers to forecast and collision wear", () => {
    let seed = 1;
    while (true) {
      const challenge = createMinigameChallenge("regatta", "friendly", seed, getMinigameSessionId(seed, 1));
      if (challenge.kind === "regatta" && !challenge.obstacles.some((point) => point.x === 0 && point.y === 2)) break;
      seed += 1;
    }
    const losses = [false, true].map((upgraded) => {
      const player = playerAt("sandportRegatta", seed);
      if (upgraded) expect(installBoatUpgrade(player.progression.nautical, "reinforcedHull")).toBe(true);
      startMinigame(player, startRequest(player, "sandportRegatta", { weather: WeatherType.Storm }));
      for (const heading of ["east", "west", "north", "west"] as const) {
        act(player, { type: "sail", heading });
      }
      return 90 - player.progression.nautical.ownedBoats[0]!.condition;
    });
    expect(losses).toEqual([4, 3]);
  });

  it("settles a move-limit timeout once without stranding the boat or moving the campaign", () => {
    const player = playerAt("sandportRegatta");
    const position = structuredClone(player.position);
    startMinigame(player, startRequest(player, "sandportRegatta"));
    for (let index = 0; index < MINIGAME_DIFFICULTIES.friendly.regattaMoveLimit; index += 1) {
      act(player, { type: "sail", heading: "west" });
    }
    const receipt = player.progression.minigames.pending?.receipt;
    expect(receipt?.outcome).toBe("timeout");
    expect(receipt?.goldPaid).toBe(0);
    expect(receipt?.score).toBe(0);
    expect(player.gold).toBe(995);
    expect(player.position).toEqual(position);
    expect(player.progression.nautical.ownedBoats[0]!.condition).toBe(86);
    expect(player.progression.minigames.statistics.regatta.medals).toBe(0);
  });

  it("reuses a serviceable active boat and finishes a route without changing campaign travel state", () => {
    const player = playerAt("sandportRegatta");
    const codex = createCodex();
    const position = structuredClone(player.position);
    const nautical = structuredClone(player.progression.nautical);
    startMinigame(player, startRequest(player, "sandportRegatta"));
    const result = finishRegatta(player, codex);
    expect(result.receipt?.score).toBe(100);
    expect(result.receipt?.goldPaid).toBe(15);
    expect(player.gold).toBe(1_010);
    expect(player.position).toEqual(position);
    expect(player.progression.nautical).toEqual(nautical);
    expect(codex.unlockedEntryIds).toContain("historyHarborRegatta");
  });

  it("caps collision and forecast wear, records it before abandonment, and cannot undo it through repeated input", () => {
    const player = playerAt("sandportRegatta");
    const boat = player.progression.nautical.ownedBoats[0]!;
    boat.condition = 20;
    startMinigame(player, startRequest(player, "sandportRegatta", { weather: WeatherType.Storm }));
    const first = requestFor(player, { type: "sail", heading: "west" });
    applyMinigameAction(player, first);
    applyMinigameAction(player, first);
    expect(boat.condition).toBe(18);
    for (let index = 0; index < 15; index += 1) act(player, { type: "sail", heading: "west" });
    expect(boat.condition).toBe(16);
    const result = act(player, { type: "abandon" });
    expect(result.receipt?.conditionLost).toBe(MINIGAME_DIFFICULTIES.friendly.regattaWearCap);
    expect(result.receipt?.goldPaid).toBe(0);
    expect(boat.condition).toBe(16);
    expect(player.gold).toBe(995);
    expect(player.progression.nautical.sailing).toBe(false);
  });

  it("uses the exact saved weather and a reachable route for all six forecasts", () => {
    for (const weather of Object.values(WeatherType)) {
      const player = playerAt("tidehavenRegatta");
      startMinigame(player, startRequest(player, "tidehavenRegatta", { weather }));
      const result = finishRegatta(player);
      expect(result.receipt?.outcome).toBe("completed");
      expect(result.receipt?.score).toBeGreaterThanOrEqual(MINIGAME_GOLD_SCORE);
      expect(player.progression.nautical.ownedBoats[0]!.condition).toBeGreaterThanOrEqual(1);
      const session = player.progression.minigames.pending;
      if (session?.activityId !== "regatta") throw new Error("Missing regatta fixture");
      expect(getRegattaProgress(session).valid).toBe(true);
      expect(session.weather).toBe(weather);
    }
  });

  it("rejects absent or damaged boats and leaves practice boats unchanged", () => {
    const player = playerAt("sandportRegatta");
    const boat = player.progression.nautical.ownedBoats[0]!;
    boat.condition = 19;
    expect(startMinigame(player, startRequest(player, "sandportRegatta")).ok).toBe(false);
    boat.condition = 20;
    startMinigame(player, startRequest(player, "sandportRegatta", { practice: true, weather: WeatherType.Storm }));
    for (let index = 0; index < 8; index += 1) act(player, { type: "sail", heading: "west" });
    act(player, { type: "abandon" });
    expect(boat.condition).toBe(20);
    expect(player.gold).toBe(1_000);
    act(player, { type: "acknowledge" });
    player.progression.nautical.activeBoatId = null;
    expect(startMinigame(player, startRequest(player, "sandportRegatta")).ok).toBe(false);
  });
});

describe("durable transaction failures", () => {
  it("rolls back buy-in and session allocation on a rejected write", () => {
    const player = playerAt("willowInnTable");
    const codex = createCodex();
    const before = structuredClone(player);
    const result = commitMinigameMutation(
      player, codex,
      () => startMinigame(player, startRequest(player, "willowInnTable")),
      () => ({ ok: false, code: "unavailable", message: "Fixture storage is unavailable." }),
    );
    expect(result.ok).toBe(false);
    expect(result.message).toContain("not changed");
    expect(player).toEqual(before);
  });

  it("rolls back settlement gold, claims, social, Codex, and records before retrying exactly once", () => {
    const player = playerAt("willowdaleRange");
    const codex = createCodex();
    startMinigame(player, startRequest(player, "willowdaleRange"));
    for (let index = 0; index < 4; index += 1) {
      aimAtNextTarget(player);
      act(player, { type: "fire" }, codex);
    }
    aimAtNextTarget(player);
    const request = requestFor(player, { type: "fire" });
    const before = structuredClone(player);
    const failed = commitMinigameMutation(
      player, codex, () => applyMinigameAction(player, request, codex),
      () => ({ ok: false, code: "unavailable", message: "Fixture write failed." }),
    );
    expect(failed.receipt).toBeUndefined();
    expect(player).toEqual(before);
    expect(codex.unlockedEntryIds).toEqual([]);
    const saved = commitMinigameMutation(
      player, codex, () => applyMinigameAction(player, request, codex),
      () => ({ ok: true, message: "Fixture write committed." }),
    );
    expect(saved.receipt?.goldPaid).toBe(13);
    expect(applyMinigameAction(player, request, codex).idempotent).toBe(true);
    expect(player.gold).toBe(1_008);
    expect(player.progression.minigames.statistics.archery.medals).toBe(1);
  });

  it("restores state and surfaces unexpected persistence errors rather than masking success", () => {
    const player = playerAt("willowInnTable");
    const codex = createCodex();
    const before = structuredClone(player);
    expect(() => commitMinigameMutation(
      player, codex,
      () => startMinigame(player, startRequest(player, "willowInnTable")),
      () => { throw new Error("Fixture persistence exception"); },
    )).toThrow("Fixture persistence exception");
    expect(player).toEqual(before);
    expect(MINIGAME_ACTIVITY_IDS).toHaveLength(3);
  });
});
