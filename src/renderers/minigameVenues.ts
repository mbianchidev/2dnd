import * as Phaser from "phaser";
import { TILE_SIZE } from "../config";
import { MINIGAME_VENUES } from "../data/minigames";
import { createOverlayContainer } from "../utils/ui";
import type { MinigameVenueId } from "../data/minigames";
import type { PlayerState } from "../systems/player";
import { drawArcheryTarget, drawDicePlayer } from "./minigameVenueArt";

export class MinigameVenueRenderer {
  private container: Phaser.GameObjects.Container | null = null;
  private props: Array<{
    x: number;
    y: number;
    container: Phaser.GameObjects.Container;
    target: Phaser.GameObjects.Zone;
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
    this.container = createOverlayContainer(this.scene, "minigame-venues", 8, {
      x: 0, y: 0, width: this.scene.cameras.main.width, height: this.scene.cameras.main.height,
    });
    for (const venue of venues) {
      const prop = this.scene.add.container(venue.x * TILE_SIZE, venue.y * TILE_SIZE);
      prop.setData("minigameProp", venue.activityId);
      this.container.add(prop);
      if (venue.activityId === "archery") drawArcheryTarget(this.scene, prop);
      else if (venue.activityId === "crownAndBones") drawDicePlayer(this.scene, prop, venue.cityId);
      else {
        const marker = this.scene.add.graphics();
        marker.lineStyle(2, 0xffffff).lineBetween(4, 2, 4, 28);
        marker.fillStyle(0x172c47).fillRect(5, 2, 24, 18);
        marker.lineStyle(1, 0xffffff).strokeRect(5, 2, 24, 18);
        prop.add(marker);
        prop.add(this.scene.add.text(16, 10, "R", {
          fontFamily: "monospace", fontSize: "10px", color: "#ffffff",
        }).setOrigin(0.5).setData("layoutAuditIgnore", true));
      }
      const target = this.scene.add.zone(0, 0, TILE_SIZE, TILE_SIZE).setOrigin(0);
      target.setData("minigameVenueId", venue.id);
      target.setData("layoutId", `minigame-venue-${venue.id}`);
      target.setData("layoutBounds", {
        x: venue.x * TILE_SIZE, y: venue.y * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE,
      });
      target.setData("minigameProp", venue.activityId);
      target.setData("label", venue.name);
      target.setInteractive({ useHandCursor: true }).on("pointerup", () => activate(venue.id));
      prop.add(target);
      this.props.push({ x: venue.x, y: venue.y, container: prop, target });
    }
    this.updateVisibility(explored);
  }

  updateVisibility(explored: (x: number, y: number) => boolean): void {
    for (const prop of this.props) {
      const visible = explored(prop.x, prop.y);
      prop.container.setVisible(visible);
      if (!visible) prop.target.disableInteractive();
      else if (!prop.target.input?.enabled) prop.target.setInteractive({ useHandCursor: true });
    }
  }

  clear(): void {
    this.container?.destroy(true);
    this.container = null;
    this.props = [];
  }
}
