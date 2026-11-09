import { describe, expect, it, vi } from "vitest";
import {
  BATTLE_HUD_ACTION_IDS, createBattleActionIcon, createEnemyHudView,
  getBattleResourceRatio, getBattleHudPalette,
} from "../src/systems/battleHud";
import { createGroupCombatants } from "../src/systems/groupCombat";
import { createSoloEncounter } from "../src/data/monsterGroups";
import { getMonster } from "../src/data/monsters";

describe("battle HUD presentation", () => {
  it("gives all six commands distinct deterministic pixel icons without RNG", () => {
    const rng = vi.spyOn(Math, "random");
    const icons = BATTLE_HUD_ACTION_IDS.map((id) => createBattleActionIcon(id));
    expect(new Set(icons.map((icon) => Buffer.from(icon.pixels).toString("base64"))).size).toBe(6);
    for (const [index, icon] of icons.entries()) {
      expect(icon.width).toBe(16);
      expect(icon.height).toBe(16);
      expect(icon.pixels).toEqual(createBattleActionIcon(BATTLE_HUD_ACTION_IDS[index]!).pixels);
    }
    expect(rng).not.toHaveBeenCalled();
    rng.mockRestore();
  });

  it("keeps exact bounded resource ratios including empty mana and fractional resources", () => {
    expect(getBattleResourceRatio({ current: 25, maximum: 100 })).toBe(0.25);
    expect(getBattleResourceRatio({ current: 0, maximum: 0 })).toBe(0);
    expect(getBattleResourceRatio({ current: 0.5, maximum: 2 })).toBe(0.25);
    expect(getBattleResourceRatio({ current: 120, maximum: 100 })).toBe(1);
    expect(getBattleResourceRatio({ current: -1, maximum: 100 })).toBe(0);
    expect(() => getBattleResourceRatio({ current: NaN, maximum: 10 })).toThrow(/resource/);
  });

  it("exposes only the canonical name until health is known, without unknown placeholders", () => {
    const [enemy] = createGroupCombatants(createSoloEncounter(getMonster("goblin")!));
    const hidden = createEnemyHudView(enemy!, true);
    expect(hidden.name).toBe(enemy!.label);
    expect(hidden).not.toHaveProperty("health");
    expect(JSON.stringify(hidden)).not.toMatch(/HP|maximum|current|FRONT|BACK|\?\?\?/);
    const revealed = { ...enemy!, hpRevealed: true, currentHp: 3, maxHp: 37 };
    expect(createEnemyHudView(revealed, false).health).toEqual({ current: 3, maximum: 37 });
  });

  it("keeps resource labels readable against both the empty track and filled bars", () => {
    const luminance = (color: number): number => {
      const channels = [16, 8, 0].map((shift) => {
        const value = ((color >> shift) & 255) / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
    };
    const contrast = (a: number, b: number): number =>
      (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
    for (const highContrast of [false, true]) {
      const palette = getBattleHudPalette(highContrast);
      for (const fill of [palette.health, palette.mana, palette.track, palette.panel]) {
        expect(contrast(palette.text, fill)).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast(palette.health, palette.track)).toBeGreaterThanOrEqual(3);
      expect(contrast(palette.mana, palette.track)).toBeGreaterThanOrEqual(3);
    }
  });
});
