// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";
import {
  SAVE_VERSION,
  createCurrentSaveData,
  loadGame,
  normalizeSaveData,
  saveGame,
} from "../src/systems/save";
import { saveGameToSlot } from "../src/systems/saveSlots";
import { createPlayer } from "../src/systems/player";
import { createCodex } from "../src/systems/codex";
import { BattleDecisionClock } from "../src/systems/battleTiming";
import { createBattleTimingSettings } from "../src/systems/battleTimingSettings";
import { getItem } from "../src/data/items";
import { recruitCompanion } from "../src/systems/party";
import { Terrain } from "../src/data/mapTypes";
import { TimePeriod } from "../src/systems/daynight";
import { WeatherType } from "../src/systems/weather";

function campaign() {
  const player = createPlayer("TimingSaveHero", {
    strength: 10, dexterity: 10, constitution: 10,
    intelligence: 10, wisdom: 10, charisma: 10,
  });
  player.battleTiming = { mode: "timed", durationSeconds: 45, timeoutAction: "defend" };
  return { player, codex: createCodex(), defeatedBosses: new Set<string>() };
}

beforeEach(() => localStorage.clear());

describe("campaign timing persistence and checkpoint recovery", () => {
  it("round-trips configuration in autosave and independent manual slots", () => {
    const { player, codex, defeatedBosses } = campaign();
    expect(saveGame(player, defeatedBosses, codex, player.appearanceId).ok).toBe(true);
    expect(saveGameToSlot("manual-1", player, defeatedBosses, codex, player.appearanceId).ok)
      .toBe(true);
    const manualRaw = localStorage.getItem("2dnd_save_slot_manual-1");
    player.battleTiming = createBattleTimingSettings();
    expect(saveGame(player, defeatedBosses, codex, player.appearanceId).ok).toBe(true);
    expect(loadGame()!.player.battleTiming.mode).toBe("standard");
    expect(loadGame("manual-1")!.player.battleTiming).toEqual({
      mode: "timed", durationSeconds: 45, timeoutAction: "defend",
    });
    expect(localStorage.getItem("2dnd_save_slot_manual-1")).toBe(manualRaw);
  });

  it.each([0, 3, 9, 17, 18])("migrates schema v%s without opting existing saves in", (version) => {
    const { player, codex, defeatedBosses } = campaign();
    const save = createCurrentSaveData(player, defeatedBosses, codex, player.appearanceId, 0);
    save.version = version;
    const normalized = normalizeSaveData(save);
    expect(normalized?.version).toBe(SAVE_VERSION);
    expect(normalized?.player.battleTiming).toEqual(createBattleTimingSettings());
  });

  it.each([undefined, null, [], "timed", {
    mode: "unsafe", durationSeconds: Infinity, timeoutAction: "flee",
  }])("repairs malformed current configuration %j", (battleTiming) => {
    const { player, codex, defeatedBosses } = campaign();
    const save = createCurrentSaveData(player, defeatedBosses, codex, player.appearanceId, 0);
    const raw = { ...save, player: { ...save.player, battleTiming } };
    expect(normalizeSaveData(raw)?.player.battleTiming).toEqual(createBattleTimingSettings());
  });

  it("reloads the pre-battle checkpoint, not a partial turn, deadline, or consumed resource", () => {
    const { player, codex, defeatedBosses } = campaign();
    player.inventory.push({ ...getItem("potion")! });
    player.progression.tutorial.completed = true;
    recruitCompanion(player, "guardian");
    expect(saveGame(player, defeatedBosses, codex, player.appearanceId).ok).toBe(true);
    const checkpoint = localStorage.getItem("2dnd_save")!;
    const initial = { mp: player.mp, hp: player.hp, gold: player.gold, xp: player.xp };
    const clock = new BattleDecisionClock(player.battleTiming);
    clock.beginTurn("turn:1", "party:hero");
    clock.advance(0);
    clock.advance(44_999);
    player.mp = 0;
    player.hp = 1;
    player.inventory.pop();
    clock.destroy();
    const reloaded = loadGame()!;
    expect(reloaded.player).toMatchObject(initial);
    expect(reloaded.player.inventory.some((item) => item.id === "potion")).toBe(true);
    expect(reloaded.player.party.companions).toHaveLength(1);
    expect(localStorage.getItem("2dnd_save")).toBe(checkpoint);
    expect(checkpoint).not.toMatch(/remainingMs|deadline|turn:1|decisionId/);
    const restarted = new BattleDecisionClock(reloaded.player.battleTiming);
    restarted.beginTurn("recovered:1", "party:hero");
    restarted.advance(60_000);
    expect(restarted.snapshot.decision?.remainingMs).toBe(45_000);
    expect(restarted.claimTimeout("turn:1")).toBe(false);
  });

  it("preserves the exact pending special encounter without replaying an outcome on load", () => {
    const { player, codex, defeatedBosses } = campaign();
    player.progression.worldEvents.pending = {
      instanceId: "goblinRoadAmbush:1",
      eventId: "goblinRoadAmbush",
      phase: "battle",
      selectedChoiceId: "fightAmbush",
      location: {
        chunkX: 4, chunkY: 2, x: 3, y: 3,
        areaName: "Heartlands", terrain: Terrain.Grass,
      },
      timeStep: 100, period: TimePeriod.Day, weather: WeatherType.Clear,
    };
    const pending = structuredClone(player.progression.worldEvents.pending);
    expect(saveGame(player, defeatedBosses, codex, player.appearanceId).ok).toBe(true);
    const reloaded = loadGame()!;
    const again = loadGame()!;
    expect(reloaded.player.progression.worldEvents.pending).toEqual(pending);
    expect(again.player.progression.worldEvents.pending).toEqual(pending);
    expect(again.player.gold).toBe(player.gold);
    expect(again.player.xp).toBe(player.xp);
    expect(again.player.progression.worldEvents.resolvedOutcomeIds).toEqual([]);
  });
});
