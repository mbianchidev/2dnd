import * as Phaser from "phaser";
import { TILE_SIZE } from "../config";
import { MINIGAME_VENUES } from "../data/minigames";
import type { MinigameVenueId } from "../data/minigames";
import type { PlayerState } from "../systems/player";

export class MinigameVenueRenderer {
  private container: Phaser.GameObjects.Container | null = null;
  private signs: Array<{
    x: number;
    y: number;
    container: Phaser.GameObjects.Container;
    label: Phaser.GameObjects.Text;
  }> = [];

  constructor(private readonly scene: Phaser.Scene) {}

  render(
    player: PlayerState,
    explored: (x: number, y: number) => boolean,
    activate: (venueId: MinigameVenueId) => void,
  ): void {
    this.clear();
    if (!player.position.inCity) return;
    const venues = MINIGAME_VENUES.filter((venue) =>
      venue.cityId === player.position.cityId && venue.cityChunkIndex === player.position.cityChunkIndex);
    if (venues.length === 0) return;
    this.container = this.scene.add.container(0, 0).setDepth(8);
    for (const venue of venues) {
      const sign = this.scene.add.container(0, 0);
      this.container.add(sign);
      const x = venue.x * TILE_SIZE + 4;
      const y = venue.y * TILE_SIZE + 2;
      const marker = this.scene.add.graphics();
      marker.lineStyle(2, 0xffffff).lineBetween(x, y, x, y + 26);
      marker.fillStyle(0x172c47).fillRect(x + 1, y, 24, 18);
      marker.lineStyle(1, 0xffffff).strokeRect(x + 1, y, 24, 18);
      sign.add(marker);
      const label = venue.activityId === "crownAndBones" ? "D" : venue.activityId === "archery" ? "A" : "R";
      const text = this.scene.add.text(x + 12, y + 8, label, {
        fontFamily: "monospace", fontSize: "10px", color: "#ffffff",
      }).setOrigin(0.5);
      text.setData("minigameVenueId", venue.id);
      text.setInteractive({ useHandCursor: true }).on("pointerup", () => activate(venue.id));
      sign.add(text);
      this.signs.push({ x: venue.x, y: venue.y, container: sign, label: text });
    }
    this.updateVisibility(explored);
  }

  updateVisibility(explored: (x: number, y: number) => boolean): void {
    for (const sign of this.signs) {
      const visible = explored(sign.x, sign.y);
      sign.container.setVisible(visible);
      if (!visible) sign.label.disableInteractive();
      else if (!sign.label.input?.enabled) sign.label.setInteractive({ useHandCursor: true });
    }
  }

  clear(): void {
    this.container?.destroy(true);
    this.container = null;
    this.signs = [];
  }
}
