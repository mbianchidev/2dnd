// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";
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
  it.each([19, 20, 21, 22, 23, 24])("migrates main schema v%s to Standard without changing owned domains", (version) => {
    const { player, codex, defeatedBosses } = campaign();
    const before = structuredClone(player);
    const save = createCurrentSaveData(player, defeatedBosses, codex, player.appearanceId, 0);
    const { battleTiming: _timing, ...withoutTiming } = save.player;
    const normalized = normalizeSaveData({ ...save, version, player: withoutTiming });
    expect(normalized?.version).toBe(SAVE_VERSION);
    expect(normalized?.player.battleTiming).toEqual(createBattleTimingSettings());
    expect(normalized?.player.classProgression).toEqual(before.classProgression);
    expect(normalized?.player.progression.devotion).toEqual(before.progression.devotion);
    expect(normalized?.player.progression.minigames).toEqual(before.progression.minigames);
  });

  it("preserves a schema-v19 timed preview that predates hero class ownership", () => {
    const { player, codex, defeatedBosses } = campaign();
    player.level = 5;
    player.maxHp = 99;
    player.hp = 62;
    player.maxMp = 27;
    player.mp = 13;
    player.knownSpells.push("magicMissile");
    const customArmor = { ...getItem("chainMail")!, id: "timedPreviewArmor", effect: 2.5 };
    player.inventory.push(customArmor);
    player.equippedArmor = customArmor;
    const save = createCurrentSaveData(player, defeatedBosses, codex, player.appearanceId, 0);
    const { classProgression: _progression, ...legacyPlayer } = save.player;
    const random = vi.spyOn(Math, "random");
    try {
      const migrated = normalizeSaveData({ ...save, version: 19, player: legacyPlayer });
      expect(migrated?.player).toMatchObject({
        battleTiming: player.battleTiming, level: 5,
        maxHp: 99, hp: 62, maxMp: 27, mp: 13, knownSpells: player.knownSpells,
      });
      expect(migrated?.player.inventory).toEqual(player.inventory);
      expect(migrated?.player.equippedArmor)
        .toBe(migrated?.player.inventory[migrated.player.inventory.length - 1]);
      expect(random).not.toHaveBeenCalled();
    } finally {
      random.mockRestore();
    }
  });

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
