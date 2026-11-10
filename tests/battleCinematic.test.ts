import { describe, expect, it, vi } from "vitest";
import { createGroupCombatants } from "../src/systems/groupCombat";
import { createSoloEncounter } from "../src/data/monsterGroups";
import { getMonster } from "../src/data/monsters";
import {
  BattleLogState, getBattleDecisionVisibility, getTargetHealthView,
  BATTLE_NOTICE_ENTER_MS, BATTLE_NOTICE_HOLD_MS, BATTLE_NOTICE_FADE_MS,
} from "../src/systems/battleCinematic";

describe("cinematic Battle presentation", () => {
  it("shows commands only for accepted controlled decisions, never action animation or menus", () => {
    const ready = {
      controlledDecision: true, animationActive: false, blocked: false,
      submenuOpen: false, targeting: false,
    };
    expect(getBattleDecisionVisibility(ready)).toEqual({ decision: true, commands: true, commandsEnabled: true });
    expect(getBattleDecisionVisibility({ ...ready, animationActive: true }))
      .toEqual({ decision: false, commands: false, commandsEnabled: false });
    expect(getBattleDecisionVisibility({ ...ready, controlledDecision: false }).commands).toBe(false);
    expect(getBattleDecisionVisibility({ ...ready, blocked: true }).decision).toBe(false);
    expect(getBattleDecisionVisibility({ ...ready, submenuOpen: true }))
      .toEqual({ decision: true, commands: false, commandsEnabled: false });
    expect(getBattleDecisionVisibility({ ...ready, targeting: true }))
      .toEqual({ decision: true, commands: true, commandsEnabled: false });
    expect(getBattleDecisionVisibility({ ...ready, targeting: true, animationActive: true }))
      .toEqual({ decision: false, commands: false, commandsEnabled: false });
  });

  it("exposes enemy HP only for a valid known-health hovered or focused target", () => {
    const enemy = createGroupCombatants(createSoloEncounter(getMonster("goblin")!))[0]!;
    const context = { targeting: true, targetIds: [enemy.id], hoveredId: enemy.id, focusedId: null };
    expect(getTargetHealthView([enemy], context)).toBeNull();
    enemy.hpRevealed = true;
    expect(getTargetHealthView([enemy], context)).toMatchObject({
      id: enemy.id, name: enemy.label, health: { current: enemy.currentHp, maximum: enemy.maxHp },
    });
    expect(getTargetHealthView([enemy], { ...context, targeting: false })).toBeNull();
    expect(getTargetHealthView([enemy], { ...context, hoveredId: null })).toBeNull();
    expect(getTargetHealthView([enemy], { ...context, hoveredId: null, focusedId: enemy.id })?.id).toBe(enemy.id);
    expect(getTargetHealthView([enemy], { ...context, targetIds: [] })).toBeNull();
    enemy.currentHp = 0;
    expect(getTargetHealthView([enemy], context)).toBeNull();
  });

  it("coalesces an action into one short notice, fades it, and retains exact full history", () => {
    const log = new BattleLogState();
    log.append("Fixture attacks Goblin A.");
    log.append("Goblin A takes 14 damage.");
    log.append("Goblin A falls.");
    expect(log.commitNotice()).toBe(true);
    expect(log.readNotice(false).text).toBe("Fixture attacks Goblin A.\nGoblin A takes 14 damage.\nGoblin A falls.");
    log.advance(BATTLE_NOTICE_ENTER_MS);
    expect(log.readNotice(false).alpha).toBe(1);
    log.advance(BATTLE_NOTICE_HOLD_MS);
    expect(log.readNotice(false).visible).toBe(true);
    log.advance(BATTLE_NOTICE_FADE_MS / 2);
    expect(log.readNotice(false).alpha).toBeCloseTo(0.5);
    log.advance(BATTLE_NOTICE_FADE_MS / 2);
    expect(log.readNotice(false).visible).toBe(false);
    expect(log.entries.map(({ text }) => text)).toEqual([
      "Fixture attacks Goblin A.", "Goblin A takes 14 damage.", "Goblin A falls.",
    ]);
  });

  it("keeps reduced-motion feedback static, replaces stale notices, and resets at cleanup", () => {
    const log = new BattleLogState();
    const random = vi.spyOn(Math, "random").mockImplementation(() => { throw new Error("Presentation used RNG."); });
    try {
      log.append("First action.");
      log.commitNotice();
      expect(log.readNotice(true)).toMatchObject({ alpha: 1, offsetY: 0, visible: true });
      log.advance(500);
      log.append("Latest action.");
      log.commitNotice();
      expect(log.readNotice(true).text).toBe("Latest action.");
      log.clearNotice();
      expect(log.readNotice(true).visible).toBe(false);
      expect(log.entries).toHaveLength(2);
      log.reset();
      expect(log.entries).toHaveLength(0);
      expect(log.commitNotice()).toBe(false);
      expect(() => log.advance(-1)).toThrow("elapsed");
    } finally { random.mockRestore(); }
  });

  it("bounds history without making old action IDs or log notices persistent authority", () => {
    const log = new BattleLogState();
    for (let index = 0; index < 205; index++) log.append(`Fixture event ${index}.`);
    expect(log.entries).toHaveLength(200);
    expect(log.entries[0]!.text).toBe("Fixture event 5.");
    log.commitNotice();
    expect(log.readNotice(false).text.split("\n")).toHaveLength(3);
    log.reset();
    log.append("A new battle.");
    expect(log.entries[0]!.id).toBe(1);
  });
});
