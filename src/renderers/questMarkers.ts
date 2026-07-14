import * as Phaser from "phaser";
import { DUNGEONS, getChunk, getCityForTown } from "../data/map";
import { TILE_SIZE } from "../config";
import {
  getQuestAccessDecision,
  getQuestMarkerForNpc,
} from "../systems/quests";
import type { PlayerState } from "../systems/player";
import type { CityRenderer } from "./city";

export class QuestMarkerRenderer {
  private scene: Phaser.Scene;
  private gateGraphics: Phaser.GameObjects.Graphics[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  refreshNpcMarkers(cityRenderer: CityRenderer, player: PlayerState): void {
    cityRenderer.refreshQuestMarkers((npcId) =>
      getQuestMarkerForNpc(player, npcId)
    );
  }

  renderGateMarkers(player: PlayerState, debugBypass: boolean): void {
    this.clearGateMarkers();
    if (
      debugBypass
      || player.position.inCity
      || player.position.inDungeon
    ) {
      return;
    }

    const chunk = getChunk(player.position.chunkX, player.position.chunkY);
    if (!chunk) return;

    for (const town of chunk.towns) {
      const city = getCityForTown(
        player.position.chunkX,
        player.position.chunkY,
        town.x,
        town.y,
      );
      if (!city) continue;
      const decision = getQuestAccessDecision(player, {
        type: "city",
        id: city.id,
      });
      if (!decision.allowed) this.drawSeal(town.x, town.y);
    }

    for (const dungeon of DUNGEONS) {
      if (
        dungeon.entranceChunkX !== player.position.chunkX
        || dungeon.entranceChunkY !== player.position.chunkY
      ) {
        continue;
      }
      const decision = getQuestAccessDecision(player, {
        type: "dungeon",
        id: dungeon.id,
      });
      if (!decision.allowed) {
        this.drawSeal(dungeon.entranceTileX, dungeon.entranceTileY);
      }
    }
  }

  clear(): void {
    this.clearGateMarkers();
  }

  private drawSeal(tileX: number, tileY: number): void {
    const centerX = tileX * TILE_SIZE + TILE_SIZE / 2;
    const centerY = tileY * TILE_SIZE + TILE_SIZE / 2;
    const radius = TILE_SIZE * 0.34;
    const graphics = this.scene.add.graphics().setDepth(14);
    graphics.fillStyle(0x3a1028, 0.72);
    graphics.fillCircle(centerX, centerY, radius);
    graphics.lineStyle(3, 0xff5c8a, 0.95);
    graphics.strokeCircle(centerX, centerY, radius);
    graphics.lineBetween(
      centerX - radius * 0.55,
      centerY - radius * 0.55,
      centerX + radius * 0.55,
      centerY + radius * 0.55,
    );
    graphics.lineBetween(
      centerX + radius * 0.55,
      centerY - radius * 0.55,
      centerX - radius * 0.55,
      centerY + radius * 0.55,
    );
    this.gateGraphics.push(graphics);
  }

  private clearGateMarkers(): void {
    for (const graphics of this.gateGraphics) graphics.destroy();
    this.gateGraphics = [];
  }
}
