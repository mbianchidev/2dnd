import { afterEach, describe, expect, it, vi } from "vitest";
import { executeProgressionDebugCommand } from "../src/systems/classProgressionDebug";
import { createPlayer } from "../src/systems/player";

const stats = {
  strength: 15, dexterity: 15, constitution: 14,
  intelligence: 15, wisdom: 15, charisma: 15,
};

afterEach(() => vi.restoreAllMocks());

describe("progression debug adapter", () => {
  it("enumerates only shipped profiles and reports total/rank ownership", () => {
    const player = createPlayer("Debug fixture", stats);
    const before = structuredClone(player);
    expect(executeProgressionDebugCommand(player, "list").messages).toHaveLength(12);
    expect(executeProgressionDebugCommand(player, "").messages[0]).toContain("Knight 1");
    expect(executeProgressionDebugCommand(player, "qualify wizard").messages[0]).toContain("met");
    expect(player).toEqual(before);
  });

  it.each(["level unknown", "level wizard 3", "qualify prestige:unshipped", "reset", "respec"])(
    "rejects invalid or unshipped input without changing state: %s", (command) => {
      const player = createPlayer("Debug fixture", stats);
      const before = structuredClone(player);
      expect(executeProgressionDebugCommand(player, command, true).changed).toBe(false);
      expect(player).toEqual(before);
    },
  );

  it("refuses battle/blocked advancement and uses the canonical transaction when allowed", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const player = createPlayer("Debug fixture", stats);
    const before = structuredClone(player);
    expect(executeProgressionDebugCommand(player, "level wizard").changed).toBe(false);
    expect(player).toEqual(before);
    expect(executeProgressionDebugCommand(player, "level wizard", true).changed).toBe(true);
    expect(player.level).toBe(2);
    expect(player.classProgression.classLevels).toEqual({ knight: 1, wizard: 1 });
    expect(player.stats).toEqual(before.stats);
  });

  it("does not partially award XP when a corrupt prepared receipt rejects advancement", () => {
    const player = createPlayer("Debug fixture", stats);
    player.classProgression.pendingLevel = {
      expectedTotalLevel: 99, resourceRoll: 0.5, constitution: 14, intelligence: 15,
    };
    const before = structuredClone(player);
    expect(executeProgressionDebugCommand(player, "level wizard", true).changed).toBe(false);
    expect(player).toEqual(before);
  });
});
