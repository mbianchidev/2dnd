import { describe, expect, it } from "vitest";
import {
  CONTROL_GUIDANCE,
  TIPS,
  TUTORIAL_STEPS,
} from "../src/data/tutorial";
import {
  completeTutorial,
  createTutorialProgress,
  createTutorialTipContext,
  getUnlockedTips,
  normalizeTutorialProgress,
} from "../src/systems/tutorial";
import { createPlayer } from "../src/systems/player";
import { getItem } from "../src/data/items";
import { FEATURE_IDS } from "../src/data/featureDiscovery";

function createTestPlayer() {
  return createPlayer("TutorialHero", {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  });
}

describe("tutorial and tips", () => {
  it("covers controls, interface, exploration, combat, and growth", () => {
    expect(TUTORIAL_STEPS.map((step) => step.id)).toEqual([
      "welcome",
      "interface",
      "exploration",
      "combat",
      "growth",
    ]);
    expect(TUTORIAL_STEPS.every((step) => step.controls.length > 0)).toBe(true);
  });

  it("references only known semantic controls and unique content IDs", () => {
    const controlIds = new Set(Object.keys(CONTROL_GUIDANCE));
    const referencedControls = [
      ...TUTORIAL_STEPS.flatMap((step) => step.controls),
      ...TIPS.flatMap((tip) => tip.controls ?? []),
    ];

    expect(referencedControls.every((id) => controlIds.has(id))).toBe(true);
    expect(new Set(TUTORIAL_STEPS.map((step) => step.id)).size)
      .toBe(TUTORIAL_STEPS.length);
    expect(new Set(TIPS.map((tip) => tip.id)).size).toBe(TIPS.length);
  });

  it("normalizes and completes tutorial progress idempotently", () => {
    expect(normalizeTutorialProgress(undefined)).toEqual({ completed: false });
    expect(normalizeTutorialProgress({ completed: "yes" })).toEqual({
      completed: false,
    });

    const progress = createTutorialProgress();
    expect(completeTutorial(progress)).toBe(true);
    expect(completeTutorial(progress)).toBe(false);
    expect(progress.completed).toBe(true);
  });

  it("keeps advanced tips locked until matching progression is reached", () => {
    const player = createTestPlayer();

    expect(getUnlockedTips(createTutorialTipContext(player)).map((tip) => tip.id))
      .toEqual([
        "controls.context",
        "controls.shortcuts",
        "combat.turns",
        "combat.resources",
        "exploration.fog",
      ]);

    expect(getUnlockedTips({
      level: 3,
      companionCount: 1,
      hasMount: true,
      hasNauticalDiscovery: true,
      hasEnteredDungeon: true,
      hasSkillCheck: true,
      hasTrapExperience: true,
      discoveredFeatureIds: new Set(FEATURE_IDS),
    }).map((tip) => tip.id))
      .toEqual(TIPS.map((tip) => tip.id));
  });

  it("keeps mount advice unlocked while the player is dismounted", () => {
    const player = createTestPlayer();
    const mount = getItem("mountDonkey");
    expect(mount).toBeDefined();
    player.inventory.push(mount!);

    expect(createTutorialTipContext(player).hasMount).toBe(true);
    expect(
      getUnlockedTips(createTutorialTipContext(player), "advanced")
        .map((tip) => tip.id),
    ).toContain("advanced.mounts");
  });
});
