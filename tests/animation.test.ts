import { describe, expect, it, vi } from "vitest";
import {
  mapPresentationTargets,
  OncePresentation,
  resolveActorTextureFrame,
  resolveAnimationTiming,
  selectActorAnimationState,
} from "../src/systems/animation";
import type {
  ActorAnimationState,
  AnimationStateFacts,
  ActorTextureFamily,
  PresentationActorRef,
} from "../src/systems/animation";

const IDLE_FACTS: AnimationStateFacts = {
  alive: true,
  knockedOut: false,
  defending: false,
  moving: false,
};

describe("animation contracts", () => {
  it.each<[Partial<AnimationStateFacts>, ActorAnimationState]>([
    [{}, "idle"],
    [{ moving: true }, "walk"],
    [{ action: "walk" }, "walk"],
    [{ action: "attack" }, "attack"],
    [{ action: "spell" }, "cast"],
    [{ action: "ability" }, "ability"],
    [{ action: "item" }, "item"],
    [{ defending: true }, "defend"],
    [{ action: "defend" }, "defend"],
    [{ outcome: "damage", action: "attack" }, "damage"],
    [{ outcome: "victory" }, "victory"],
    [{ outcome: "faint" }, "faint"],
    [{ action: "flee" }, "flee"],
    [{ outcome: "flee" }, "flee"],
    [{ alive: false, outcome: "victory" }, "faint"],
    [{ knockedOut: true, action: "attack" }, "faint"],
  ])("selects state from %o as %s", (overrides, expected) => {
    expect(selectActorAnimationState({ ...IDLE_FACTS, ...overrides }))
      .toBe(expected);
  });

  it("resolves deterministic timing and makes reduced motion immediate", () => {
    expect(resolveAnimationTiming("attack", false)).toEqual({
      delayMs: 0,
      durationMs: 260,
      holdMs: 80,
      totalMs: 340,
      immediate: false,
      reducedMotion: false,
    });

    expect(resolveAnimationTiming("attack", true)).toEqual({
      delayMs: 0,
      durationMs: 0,
      holdMs: 0,
      totalMs: 0,
      immediate: true,
      reducedMotion: true,
    });
  });

  it("maps actors and targets by stable ID in requested order", () => {
    const actors: readonly PresentationActorRef[] = [
      { id: "hero", role: "hero", textureFamilyId: "hero.knight" },
      { id: "slime-a", role: "monster", textureFamilyId: "slime" },
      { id: "slime-b", role: "monster", textureFamilyId: "slime" },
    ];

    expect(
      mapPresentationTargets(
        actors,
        ["slime-b", "missing", "hero", "slime-b", "slime-a"],
      ).map((actor) => actor.id),
    ).toEqual(["slime-b", "hero", "slime-a"]);
    expect(mapPresentationTargets(actors, ["missing"])).toEqual([]);
  });

  it("completes or cancels once and cleans up once", () => {
    const onComplete = vi.fn();
    const onCancel = vi.fn();
    const cleanup = vi.fn();
    const completed = new OncePresentation({
      onComplete,
      onCancel,
      cleanup,
    });

    expect(completed.complete()).toBe(true);
    expect(completed.complete()).toBe(false);
    expect(completed.cancel()).toBe(false);
    expect(completed.cleanup()).toBe(false);
    expect(completed.status).toBe("completed");
    expect(completed.cleanedUp).toBe(true);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    expect(cleanup).toHaveBeenCalledTimes(1);

    const cancelled = new OncePresentation({
      onComplete,
      onCancel,
      cleanup,
    });
    expect(cancelled.cancel()).toBe(true);
    expect(cancelled.cancel()).toBe(false);
    expect(cancelled.complete()).toBe(false);
    expect(cancelled.status).toBe("cancelled");
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(cleanup).toHaveBeenCalledTimes(2);
  });

  it("resolves explicit frames and reports deterministic texture fallbacks", () => {
    const family: ActorTextureFamily = {
      id: "monster.slime",
      role: "monster",
      frames: {
        idle: [
          { textureKey: "slime_idle_0" },
          { textureKey: "slime_idle_1" },
        ],
        damage: [{ textureKey: "slime_damage_0" }],
      },
      fallbackTextureKey: "monster",
    };
    const existing = new Set([
      "slime_idle_1",
      "monster",
    ]);
    const textureExists = (textureKey: string): boolean =>
      existing.has(textureKey);

    expect(resolveActorTextureFrame(family, "idle", 1, textureExists)).toEqual({
      familyId: "monster.slime",
      state: "idle",
      requestedFrameIndex: 1,
      resolvedFrameIndex: 1,
      textureKey: "slime_idle_1",
      source: "requested-frame",
      usedFallback: false,
    });
    expect(resolveActorTextureFrame(family, "idle", 0, textureExists)).toEqual({
      familyId: "monster.slime",
      state: "idle",
      requestedFrameIndex: 0,
      resolvedFrameIndex: 1,
      textureKey: "slime_idle_1",
      source: "state-frame-fallback",
      usedFallback: true,
    });
    expect(resolveActorTextureFrame(family, "damage", 0, textureExists))
      .toEqual({
        familyId: "monster.slime",
        state: "damage",
        requestedFrameIndex: 0,
        resolvedFrameIndex: null,
        textureKey: "monster",
        source: "family-fallback",
        usedFallback: true,
      });
    expect(resolveActorTextureFrame(
      family,
      "victory",
      0,
      () => false,
    )).toEqual({
      familyId: "monster.slime",
      state: "victory",
      requestedFrameIndex: 0,
      resolvedFrameIndex: null,
      textureKey: null,
      source: "missing",
      usedFallback: true,
    });
  });
});
