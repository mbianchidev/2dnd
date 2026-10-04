// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";
import { MINIGAME_HISTORY_LIMIT, getMinigameRecordId } from "../src/data/minigames";
import {
  LEGACY_MINIGAME_SEED,
  consumeMinigameRecoveryNotice,
  createMinigameState,
  normalizeMinigameState,
  validateMinigameRecovery,
} from "../src/systems/minigameState";
import { applyMinigameAction, startMinigame } from "../src/systems/minigames";
import { createCodex } from "../src/systems/codex";
import { SAVE_VERSION, createCurrentSaveData, loadGame, normalizeSaveData, saveGame } from "../src/systems/save";
import { saveGameToSlot } from "../src/systems/saveSlots";
import { WeatherType } from "../src/systems/weather";
import { playerAt, requestFor, startRequest } from "./helpers/minigames";
import type { MinigameVenueId } from "../src/data/minigames";
import type { MinigameState } from "../src/systems/minigameTypes";

function serializedState(state: MinigameState): unknown {
  return JSON.parse(JSON.stringify(state)) as unknown;
}

beforeEach(() => localStorage.clear());

describe("schema-v19 exact activity recovery", () => {
  it.each(["willowInnTable", "willowdaleRange", "sandportRegatta"] as const)(
    "keeps the exact paid pending session for %s without rerolling or charging again",
    (venueId) => {
      const player = playerAt(venueId);
      startMinigame(player, startRequest(player, venueId, { weather: WeatherType.Storm }));
      if (venueId === "willowdaleRange") {
        applyMinigameAction(player, requestFor(player, { type: "aimTo", aim: 25 }));
        applyMinigameAction(player, requestFor(player, { type: "fire" }));
      } else if (venueId === "sandportRegatta") {
        applyMinigameAction(player, requestFor(player, { type: "sail", heading: "east" }));
      }
      const snapshot = structuredClone(player.progression.minigames);
      expect(normalizeMinigameState(serializedState(snapshot), SAVE_VERSION)).toEqual(snapshot);
      const codex = createCodex();
      const wallet = player.gold;
      expect(saveGame(player, new Set(), codex, player.appearanceId).ok).toBe(true);
      const loaded = loadGame();
      expect(loaded?.version).toBe(SAVE_VERSION);
      expect(loaded?.player.gold).toBe(wallet);
      expect(loaded?.player.progression.minigames).toEqual(snapshot);
      expect(loaded?.player.position).toEqual(player.position);
    },
  );

  it("resumes a settled receipt as presentation only, without applying its reward again", () => {
    const player = playerAt("willowInnTable");
    startMinigame(player, startRequest(player, "willowInnTable"));
    const request = requestFor(player, { type: "bank" });
    applyMinigameAction(player, request);
    const snapshot = structuredClone(player.progression.minigames);
    expect(saveGame(player, new Set(), createCodex(), player.appearanceId).ok).toBe(true);
    const loaded = loadGame()!;
    expect(loaded.player.progression.minigames).toEqual(snapshot);
    expect(applyMinigameAction(loaded.player, request).idempotent).toBe(true);
    expect(loaded.player.gold).toBe(995);
    expect(loaded.player.progression.minigames.history).toHaveLength(1);
  });

  it("gives schema-v18 and missing state deterministic empty defaults without replaying historical payouts", () => {
    const player = playerAt("willowdaleRange");
    const data = createCurrentSaveData(player, new Set(), createCodex(), player.appearanceId, 45);
    data.version = 18;
    const loaded = normalizeSaveData(data)!;
    expect(loaded.player.progression.minigames).toEqual(createMinigameState(LEGACY_MINIGAME_SEED));
    expect(loaded.player.gold).toBe(1_000);
    expect(loaded.codex.unlockedEntryIds).not.toContain("historyArrowFair");
    expect(normalizeMinigameState(undefined, SAVE_VERSION))
      .toEqual(createMinigameState(LEGACY_MINIGAME_SEED));
  });

  it("isolates a manual pending snapshot from progress made after loading it", () => {
    const player = playerAt("willowdaleRange");
    const codex = createCodex();
    startMinigame(player, startRequest(player, "willowdaleRange"));
    expect(saveGameToSlot("manual-1", player, new Set(), codex, player.appearanceId).ok).toBe(true);
    const source = localStorage.getItem("2dnd_save_slot_manual-1");
    const loaded = loadGame("manual-1")!;
    applyMinigameAction(loaded.player, requestFor(loaded.player, { type: "aim", delta: 1 }));
    expect(saveGame(loaded.player, new Set(), loaded.codex, loaded.appearanceId).ok).toBe(true);
    expect(localStorage.getItem("2dnd_save_slot_manual-1")).toBe(source);
    expect(loadGame("manual-1")?.player.progression.minigames.pending?.revision).toBe(0);
    expect(loadGame()?.player.progression.minigames.pending?.revision).toBe(1);
  });
});

describe("corrupt pending data cannot refund, pay, or reroll", () => {
  it.each([
    ["wrong seed", (raw: Record<string, unknown>): void => { raw["seed"] = "bad"; }],
    ["unknown venue", (raw: Record<string, unknown>): void => {
      const pending = raw["pending"] as Record<string, unknown>;
      pending["venueId"] = "unknown";
    }],
    ["unknown ruleset", (raw: Record<string, unknown>): void => {
      const pending = raw["pending"] as Record<string, unknown>;
      pending["rulesetId"] = "fabricatedRules";
    }],
    ["fabricated paid entry", (raw: Record<string, unknown>): void => {
      const pending = raw["pending"] as Record<string, unknown>;
      pending["feePaid"] = 1_000;
    }],
    ["changed dice", (raw: Record<string, unknown>): void => {
      const pending = raw["pending"] as Record<string, unknown>;
      pending["challenge"] = { kind: "crownAndBones", rolls: [[6, 6], [6, 6], [6, 6], [6, 6]] };
    }],
    ["invalid revision", (raw: Record<string, unknown>): void => {
      const pending = raw["pending"] as Record<string, unknown>;
      pending["revision"] = -1;
    }],
    ["invalid phase", (raw: Record<string, unknown>): void => {
      const pending = raw["pending"] as Record<string, unknown>;
      pending["phase"] = "claimAgain";
    }],
    ["already settled playing phase", (raw: Record<string, unknown>): void => { raw["settledSequence"] = 1; }],
  ])("retires %s conservatively", (_description, corrupt) => {
    const player = playerAt("willowInnTable");
    startMinigame(player, startRequest(player, "willowInnTable"));
    const raw = serializedState(player.progression.minigames) as Record<string, unknown>;
    corrupt(raw);
    const repaired = normalizeMinigameState(raw, SAVE_VERSION);
    expect(repaired.pending).toBeNull();
    expect(repaired.sequence).toBe(1);
    expect(repaired.settledSequence).toBe(1);
    expect(player.gold).toBe(995);
    expect(consumeMinigameRecoveryNotice(repaired)).toContain("No entry was charged again");
    expect(consumeMinigameRecoveryNotice(repaired)).toBeUndefined();
  });

  it("repairs a missing counter from the exact pending identity without selecting another challenge", () => {
    const player = playerAt("willowdaleRange");
    startMinigame(player, startRequest(player, "willowdaleRange"));
    const raw = serializedState(player.progression.minigames) as Record<string, unknown>;
    delete raw["sequence"];
    const repaired = normalizeMinigameState(raw, SAVE_VERSION);
    expect(repaired.sequence).toBe(1);
    expect(repaired.pending?.challenge).toEqual(player.progression.minigames.pending?.challenge);
    expect(repaired.pending?.feePaid).toBe(5);
  });

  it.each([
    ["invalid aim", "willowdaleRange", (raw: Record<string, unknown>): void => {
      const game = (raw["pending"] as Record<string, unknown>)["game"] as Record<string, unknown>;
      game["aim"] = 101;
    }],
    ["invalid shot", "willowdaleRange", (raw: Record<string, unknown>): void => {
      const game = (raw["pending"] as Record<string, unknown>)["game"] as Record<string, unknown>;
      game["shots"] = [-1];
    }],
    ["invalid heading", "sandportRegatta", (raw: Record<string, unknown>): void => {
      const game = (raw["pending"] as Record<string, unknown>)["game"] as Record<string, unknown>;
      game["headings"] = ["teleport"];
    }],
    ["invalid boat snapshot", "sandportRegatta", (raw: Record<string, unknown>): void => {
      const pending = raw["pending"] as Record<string, unknown>;
      pending["boat"] = { id: "unknown", condition: 100 };
    }],
  ] as const)("retires %s without cross-domain mutation", (_description, venueId, corrupt) => {
    const player = playerAt(venueId);
    startMinigame(player, startRequest(player, venueId));
    const raw = serializedState(player.progression.minigames) as Record<string, unknown>;
    corrupt(raw);
    const nautical = structuredClone(player.progression.nautical);
    expect(normalizeMinigameState(raw, SAVE_VERSION).pending).toBeNull();
    expect(player.progression.nautical).toEqual(nautical);
    expect(player.gold).toBe(995);
  });

  it("rejects a fabricated settled payout but preserves its paid wallet and once-only watermark", () => {
    const player = playerAt("willowInnTable");
    startMinigame(player, startRequest(player, "willowInnTable"));
    applyMinigameAction(player, requestFor(player, { type: "bank" }));
    const raw = serializedState(player.progression.minigames) as Record<string, unknown>;
    const pending = raw["pending"] as Record<string, unknown>;
    const receipt = pending["receipt"] as Record<string, unknown>;
    receipt["goldPaid"] = 500;
    const repaired = normalizeMinigameState(raw, SAVE_VERSION);
    expect(repaired.pending).toBeNull();
    expect(repaired.settledSequence).toBe(1);
    expect(repaired.history).toHaveLength(1);
    expect(player.gold).toBe(995);
  });

  it("retires mismatched location and boat state without moving the party or restoring spent hull condition", () => {
    for (const venueId of ["willowdaleRange", "sandportRegatta"] as const satisfies readonly MinigameVenueId[]) {
      const player = playerAt(venueId);
      startMinigame(player, startRequest(player, venueId));
      if (venueId === "willowdaleRange") player.position.x += 4;
      else player.progression.nautical.ownedBoats[0]!.condition -= 3;
      const position = structuredClone(player.position);
      const nautical = structuredClone(player.progression.nautical);
      validateMinigameRecovery(player);
      expect(player.progression.minigames.pending).toBeNull();
      expect(player.progression.minigames.settledSequence).toBe(1);
      expect(player.position).toEqual(position);
      expect(player.progression.nautical).toEqual(nautical);
      expect(player.gold).toBe(995);
    }
  });

  it("keeps finite known claims, bounded unique history, validated bests, and consistent natural statistics", () => {
    const player = playerAt("willowInnTable");
    for (let index = 0; index < MINIGAME_HISTORY_LIMIT + 2; index += 1) {
      startMinigame(player, startRequest(player, "willowInnTable", { stake: 1 }));
      applyMinigameAction(player, requestFor(player, { type: "bank" }));
      applyMinigameAction(player, requestFor(player, { type: "acknowledge" }));
    }
    const raw = serializedState(player.progression.minigames) as Record<string, unknown>;
    raw["claimedMilestoneIds"] = ["milestone:archery:friendly", "unknown", "milestone:archery:friendly"];
    raw["bests"] = {
      [getMinigameRecordId("willowInnTable", "friendly")]: { score: 80, sessionSequence: 1 },
      unknown: { score: 100, sessionSequence: 1 },
      [getMinigameRecordId("willowInnTable", "expert")]: { score: 1_000, sessionSequence: 1 },
    };
    raw["statistics"] = {
      crownAndBones: { attempts: 42, completions: 99, medals: 100 },
      archery: { attempts: -1, completions: NaN, medals: "bad" },
    };
    const repaired = normalizeMinigameState(raw, SAVE_VERSION);
    expect(repaired.history).toHaveLength(MINIGAME_HISTORY_LIMIT);
    expect(repaired.claimedMilestoneIds).toEqual(["milestone:archery:friendly"]);
    expect(Object.keys(repaired.bests)).toEqual([getMinigameRecordId("willowInnTable", "friendly")]);
    expect(repaired.statistics.crownAndBones).toEqual({ attempts: 42, completions: 42, medals: 42 });
    expect(repaired.statistics.archery).toEqual({ attempts: 0, completions: 0, medals: 0 });
    expect(repaired.settledSequence).toBe(42);
  });
});
