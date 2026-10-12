// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearDicePresentation, installDicePresentation, presentDiceResult, resetDicePresentation,
} from "../src/managers/dicePresentation";
import { createD20Presentation, TRANSIENT_DICE_HOLD_MS } from "../src/systems/dicePresentation";
import { gamePreferences } from "../src/systems/accessibility";
import { audioEngine } from "../src/systems/audio";

vi.mock("../src/systems/audio", () => ({
  audioEngine: { playDiceCue: vi.fn(() => vi.fn()) },
}));

function sceneHarness(key: string) {
  const timers: Array<{ duration: number; complete: () => void; remove: ReturnType<typeof vi.fn> }> = [];
  const listeners: Array<{ event: string; listener: () => void; context?: object }> = [];
  const scene: Parameters<typeof installDicePresentation>[0] = {
    scene: { key },
    time: {
      delayedCall: (duration, complete) => {
        const timer = { duration, complete, remove: vi.fn() };
        timers.push(timer);
        return timer;
      },
    },
    input: { keyboard: { on: vi.fn(), off: vi.fn() } },
    events: {
      once: (event, listener, context) => { listeners.push({ event, listener, context }); },
      off: (event, listener) => {
        const index = listeners.findIndex((entry) => entry.event === event && entry.listener === listener);
        if (index >= 0) listeners.splice(index, 1);
      },
    },
  };
  return {
    scene, timers,
    shutdown: () => {
      for (const entry of [...listeners]) {
        if (entry.event === "shutdown") entry.listener.call(entry.context);
      }
    },
  };
}

function roll() {
  return createD20Presentation({
    naturalRolls: [17], selectedIndex: 0, selection: "normal",
    naturalRoll: 17, modifier: 3, total: 20,
  }, { category: "skill", label: "Fixture check", outcome: "success" });
}

describe("scene-scoped dice ownership", () => {
  const scenes: Array<Parameters<typeof installDicePresentation>[0]> = [];

  beforeEach(() => {
    localStorage.clear();
    gamePreferences.reload();
    document.body.innerHTML = '<div id="game-inner"><div id="game-container"><canvas></canvas></div></div>';
    vi.spyOn(document.querySelector("canvas")!, "getBoundingClientRect")
      .mockReturnValue(new DOMRect(0, 0, 640, 528));
  });

  afterEach(() => {
    for (const scene of scenes.splice(0)) clearDicePresentation(scene);
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("never restores battle rolls, animations or log entries in another scene", () => {
    const battle = sceneHarness("BattleScene");
    const overworld = sceneHarness("OverworldScene");
    scenes.push(battle.scene, overworld.scene);
    const log = vi.fn();
    const manager = installDicePresentation(battle.scene, log);
    manager.present(roll());
    expect(log).toHaveBeenCalledOnce();
    expect(document.querySelectorAll(".resolved-die")).toHaveLength(1);
    battle.shutdown();
    expect(document.getElementById("dice-presentation")).toBeNull();
    presentDiceResult(battle.scene, roll());
    expect(document.getElementById("dice-presentation")).toBeNull();
    expect(battle.timers.every((timer) => timer.remove.mock.calls.length === 1)).toBe(true);
    installDicePresentation(overworld.scene);
    expect(document.getElementById("dice-presentation")?.hidden).toBe(true);
    expect(document.querySelectorAll(".resolved-die")).toHaveLength(0);
    expect(document.getElementById("dice-result")?.textContent).toBe("");
    expect(document.getElementById("dice-log")).toBeNull();
  });

  it("allows an explicitly restarted scene to begin cleanly without stale evidence", () => {
    const battle = sceneHarness("BattleScene");
    scenes.push(battle.scene);
    installDicePresentation(battle.scene).present(roll());
    battle.shutdown();
    const log = vi.fn();
    const replacement = installDicePresentation(battle.scene, log);
    expect(document.getElementById("dice-presentation")?.hidden).toBe(true);
    expect(document.querySelectorAll(".resolved-die")).toHaveLength(0);
    replacement.present(roll());
    expect(log).toHaveBeenCalledOnce();
    expect(document.querySelectorAll(".resolved-die")).toHaveLength(1);
  });

  it("expires non-battle results and their synthesized cues without leaving an idle view", () => {
    const overworld = sceneHarness("OverworldScene");
    scenes.push(overworld.scene);
    const manager = installDicePresentation(overworld.scene);
    manager.present(roll());
    const duration = overworld.timers[0]!.duration;
    expect(overworld.timers[1]?.duration).toBe(duration + TRANSIENT_DICE_HOLD_MS);
    const cancelCue = vi.mocked(audioEngine.playDiceCue).mock.results.slice(-1)[0]?.value;
    overworld.timers[0]!.complete();
    expect(cancelCue).toHaveBeenCalledOnce();
    overworld.timers[1]!.complete();
    expect(document.getElementById("dice-presentation")?.dataset.phase).toBe("fading");
    overworld.timers[2]!.complete();
    expect(document.getElementById("dice-presentation")?.hidden).toBe(true);
    expect(document.getElementById("dice-result")?.textContent).toBe("");
    expect(document.querySelectorAll(".resolved-die")).toHaveLength(0);
  });

  it("clears event results immediately on reset and ignores removed expiry callbacks", () => {
    const overworld = sceneHarness("OverworldScene");
    scenes.push(overworld.scene);
    installDicePresentation(overworld.scene).present(roll());
    resetDicePresentation(overworld.scene);
    expect(overworld.timers.every((timer) => timer.remove.mock.calls.length === 1)).toBe(true);
    for (const timer of overworld.timers) timer.complete();
    expect(document.getElementById("dice-presentation")?.hidden).toBe(true);
    expect(document.querySelectorAll(".resolved-die")).toHaveLength(0);
    overworld.shutdown();
    expect(document.getElementById("dice-announcement")).toBeNull();
  });
});
