import type { GroupCombatant } from "./groupCombat";
import { PixelSurface } from "./pixelArt";
import type { HeroVisualDescriptor } from "./heroVisuals";

export const BATTLE_HUD_ACTION_IDS = ["attack", "defend", "abilities", "spells", "items", "flee"] as const;
export type BattleHudActionId = typeof BATTLE_HUD_ACTION_IDS[number];

export interface BattleHudResource {
  readonly current: number;
  readonly maximum: number;
}

export interface BattleHudAlly {
  readonly id: string;
  readonly name: string;
  readonly details?: string;
  readonly accessibleDetails?: string;
  readonly health: BattleHudResource;
  readonly mana: BattleHudResource;
  readonly portrait: HeroVisualDescriptor;
  readonly level: number;
}

export interface BattleHudEnemy {
  readonly id: string;
  readonly name: string;
  readonly selected: boolean;
  readonly alive: boolean;
  readonly health?: BattleHudResource;
}

export interface BattleHudPalette {
  readonly panel: number;
  readonly track: number;
  readonly health: number;
  readonly mana: number;
  readonly text: number;
  readonly outline: number;
}

export function getBattleResourceRatio(resource: BattleHudResource): number {
  if (!Number.isFinite(resource.current) || !Number.isFinite(resource.maximum) || resource.maximum < 0) {
    throw new Error("[battle-hud] Invalid resource values.");
  }
  return resource.maximum > 0 ? Math.max(0, Math.min(1, resource.current / resource.maximum)) : 0;
}

/** Project only revealed knowledge; unknown health never reaches HUD or accessibility nodes. */
export function createEnemyHudView(enemy: GroupCombatant, selected: boolean): BattleHudEnemy {
  return {
    id: enemy.id, name: enemy.label, selected, alive: enemy.isAlive,
    ...(enemy.hpRevealed ? { health: { current: enemy.currentHp, maximum: enemy.maxHp } } : {}),
  };
}

export function getBattleHudPalette(highContrast: boolean): BattleHudPalette {
  return {
    panel: highContrast ? 0x000000 : 0x152330,
    track: highContrast ? 0x000000 : 0x101925,
    health: 0x39734b,
    mana: 0x2874a5,
    text: highContrast ? 0xffffff : 0xf6f2e6,
    outline: highContrast ? 0xffffff : 0xd8cba4,
  };
}

/** Six original silhouettes retain their meaning when disabled or selected. */
export function createBattleActionIcon(action: BattleHudActionId): PixelSurface {
  const art = new PixelSurface(16, 16);
  const dark = 0x17232f;
  const light = 0xf0e4b7;
  switch (action) {
    case "attack":
      art.line(3, 13, 12, 3, dark, 3);
      art.line(5, 10, 12, 3, 0xbdd5da, 2);
      art.line(6, 9, 12, 3, 0xf2f1d9);
      art.line(3, 8, 8, 13, 0xd8ad65, 2);
      art.line(2, 13, 4, 11, 0xa57a4c, 2);
      art.pixel(2, 14, light);
      break;
    case "defend":
      art.polygon([{ x: 2, y: 2 }, { x: 13, y: 2 }, { x: 12, y: 10 },
        { x: 8, y: 14 }, { x: 3, y: 10 }], light);
      art.polygon([{ x: 4, y: 4 }, { x: 11, y: 4 }, { x: 10, y: 9 },
        { x: 8, y: 12 }, { x: 5, y: 9 }], 0x568baf);
      art.line(8, 4, 8, 11, 0xc3e0dc);
      break;
    case "abilities":
      art.rect(4, 5, 8, 7, dark);
      art.rect(5, 6, 6, 6, 0xe7b969);
      for (let x = 4; x <= 10; x += 2) art.rect(x, 3, 2, 5, 0xf2d28d);
      art.rect(3, 7, 3, 4, 0xd69b50);
      art.rect(6, 12, 5, 2, light);
      art.line(1, 2, 2, 3, light);
      art.line(13, 2, 14, 1, light);
      art.line(13, 7, 15, 7, light);
      break;
    case "spells":
      art.polygon([{ x: 1, y: 3 }, { x: 7, y: 4 }, { x: 8, y: 5 },
        { x: 9, y: 4 }, { x: 14, y: 3 }, { x: 14, y: 12 },
        { x: 9, y: 13 }, { x: 8, y: 14 }, { x: 6, y: 13 }, { x: 1, y: 12 }], 0xb7a1d5);
      art.rect(3, 5, 4, 6, light);
      art.rect(9, 5, 4, 6, 0xe4d8b8);
      art.line(8, 5, 8, 12, dark);
      art.line(4, 7, 6, 7, 0x685177);
      art.line(10, 8, 12, 8, 0x685177);
      break;
    case "items":
      art.rect(6, 1, 5, 3, light);
      art.rect(6, 4, 5, 3, 0xb6d5d9);
      art.volume(8, 10, 5, 4, 0xbc6171, dark);
      art.rect(5, 8, 3, 2, 0xefb3ae);
      art.line(7, 12, 11, 12, light);
      break;
    case "flee":
      art.rect(8, 2, 5, 6, 0xe0bb7a);
      art.polygon([{ x: 8, y: 6 }, { x: 12, y: 6 }, { x: 12, y: 10 },
        { x: 15, y: 11 }, { x: 14, y: 14 }, { x: 6, y: 14 }, { x: 6, y: 10 }], 0xb99a6b);
      art.line(7, 14, 14, 14, light, 1);
      art.line(1, 5, 5, 5, 0xb8dcbe);
      art.line(0, 9, 4, 9, 0xb8dcbe);
      art.line(2, 12, 4, 12, light);
      break;
  }
  return art;
}
