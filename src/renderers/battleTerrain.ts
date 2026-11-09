import type * as Phaser from "phaser";
import { artNoise, shadePixelColor as shade } from "../systems/pixelArt";
import type { BattleBackdropLayout, BattleBiome } from "./battleDepth";

/** Perspective-scaled grain, grass and stone break up flat arena bands without per-frame work. */
export function drawBattleTerrainDetail(
  graphics: Phaser.GameObjects.Graphics, layout: BattleBackdropLayout, biome: BattleBiome, color: number,
): void {
  const groundHeight = layout.height - layout.groundTop;
  for (let index = 0; index < 260; index++) {
    const y = layout.groundTop + 2 + artNoise(index, 19) % Math.max(1, Math.floor(groundHeight - 4));
    const x = artNoise(7, index) % Math.max(1, Math.floor(layout.width - 8));
    const perspective = (y - layout.groundTop) / groundHeight;
    const width = Math.round(3 + perspective * (biome === "sea" ? 24 : 8));
    const height = biome === "sea" ? 1 : Math.max(1, Math.round(1 + perspective * 2));
    graphics.fillStyle(shade(color, index % 2 ? 19 : -18), 0.65).fillRect(x, y, width, height);
    if ((biome === "grass" || biome === "forest" || biome === "deep_forest" || biome === "swamp") && index % 4 === 0) {
      graphics.lineStyle(1, shade(color, 31), 0.7).lineBetween(x + 2, y, x, y - height * 2);
      graphics.lineBetween(x + 3, y, x + 5, y - height * 3);
    } else if ((biome === "dungeon" || biome === "canyon" || biome === "volcanic") && index % 6 === 0) {
      graphics.lineStyle(1, shade(color, -26), 0.7).lineBetween(x, y + 2, x + width, y + height + 2);
    }
  }
}
