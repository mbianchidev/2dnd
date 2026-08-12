/**
 * PlayerRenderer: renders the player sprite and mount on the overworld.
 * Extracted from OverworldScene to reduce file size.
 */

import * as Phaser from "phaser";
import { getMount } from "../data/mounts";
import type { PlayerState } from "../systems/player";
import { TILE_SIZE } from "../config";
import {
  resolveHeroVisualDescriptor,
  type HeroFacing,
  type HeroPose,
} from "../systems/heroVisuals";
import {
  acquireHeroTexture,
  type HeroTextureLease,
} from "./heroTextures";

/** Rider offset when mounted: shift left so mount head/neck is visible, shift up to sit on mount back. */
const MOUNT_RIDER_OFFSET_X = -3;
const MOUNT_RIDER_OFFSET_Y = 8;

function isMountedInOverworld(player: PlayerState): boolean {
  return !!player.mountId
    && !player.progression.nautical.sailing
    && !player.position.inDungeon
    && !player.position.inCity;
}

/**
 * Handles rendering and refreshing the player sprite and mount sprite.
 */
export class PlayerRenderer {
  private scene: Phaser.Scene;
  playerSprite!: Phaser.GameObjects.Sprite;
  mountSprite: Phaser.GameObjects.Sprite | null = null;
  boatSprite: Phaser.GameObjects.Sprite | null = null;
  /** Current facing direction: front (down), back (up), or side (left/right). */
  private facing: "front" | "back" | "side" = "front";
  private heroTextureLease: HeroTextureLease | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    scene.events?.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.playerSprite?.destroy();
      this.heroTextureLease?.release();
      this.heroTextureLease = null;
    });
  }

  /** Get mount rider X offset (for tween targeting). */
  static get riderOffsetX(): number { return MOUNT_RIDER_OFFSET_X; }
  /** Get mount rider Y offset (for tween targeting). */
  static get riderOffsetY(): number { return MOUNT_RIDER_OFFSET_Y; }

  /** Create or recreate the player sprite (and mount sprite if mounted). */
  createPlayer(player: PlayerState): void {
    if (this.playerSprite) {
      this.playerSprite.destroy();
    }
    this.heroTextureLease?.release();
    this.heroTextureLease = null;
    if (this.mountSprite) {
      this.mountSprite.destroy();
      this.mountSprite = null;
    }
    if (this.boatSprite) {
      this.boatSprite.destroy();
      this.boatSprite = null;
    }

    const isMounted = isMountedInOverworld(player);
    const tileX = player.position.x * TILE_SIZE + TILE_SIZE / 2;
    const tileY = player.position.y * TILE_SIZE + TILE_SIZE / 2;

    const pose: HeroPose = isMounted || player.progression.nautical.sailing
      ? "mounted"
      : "standard";
    this.heroTextureLease = acquireHeroTexture(
      this.scene,
      resolveHeroVisualDescriptor(player),
      "front",
      pose,
    );
    const playerKey = this.heroTextureLease.key;

    if (player.progression.nautical.sailing) {
      const boatId = player.progression.nautical.activeBoatId ?? "reedSkiff";
      this.boatSprite = this.scene.add.sprite(tileX, tileY, `boat_${boatId}`);
      this.boatSprite.setDepth(9);
      this.playerSprite = this.scene.add.sprite(tileX - 2, tileY - 7, playerKey);
      this.playerSprite.setScale(0.72);
      this.playerSprite.setDepth(10);
    } else if (isMounted) {
      // Render mount sprite beneath the player
      const mountKey = `mount_${player.mountId}`;
      this.mountSprite = this.scene.add.sprite(tileX, tileY, mountKey);
      this.mountSprite.setDepth(9);

      // Render player sprite shifted left + up so it sits naturally on the mount
      this.playerSprite = this.scene.add.sprite(
        tileX + MOUNT_RIDER_OFFSET_X,
        tileY - MOUNT_RIDER_OFFSET_Y,
        playerKey
      );
      this.playerSprite.setDepth(10);
    } else {
      this.playerSprite = this.scene.add.sprite(tileX, tileY, playerKey);
      this.playerSprite.setDepth(10);
    }

    this.facing = "front";
  }

  /** Toggle mount / dismount. Returns a status message string or null. */
  toggleMount(player: PlayerState): { message: string; color: string } | null {
    if (player.position.inDungeon || player.position.inCity) {
      return { message: "Cannot ride mounts here.", color: "#ff6666" };
    }

    if (player.mountId) {
      // Dismount
      const mount = getMount(player.mountId);
      player.mountId = "";
      this.createPlayer(player);
      return { message: `Dismounted${mount ? ` ${mount.name}` : ""}.`, color: "#ffd700" };
    } else {
      // Find the best mount in inventory
      const ownedMounts = player.inventory.filter((i) => i.type === "mount" && i.mountId);
      if (ownedMounts.length === 0) {
        return { message: "No mount owned. Visit a stable!", color: "#ff6666" };
      }
      // Pick the fastest mount available
      let bestItem = ownedMounts[0];
      let bestSpeed = getMount(bestItem.mountId!)?.speedMultiplier ?? 0;
      for (let i = 1; i < ownedMounts.length; i++) {
        const md = getMount(ownedMounts[i].mountId!);
        if (md && md.speedMultiplier > bestSpeed) {
          bestSpeed = md.speedMultiplier;
          bestItem = ownedMounts[i];
        }
      }
      player.mountId = bestItem.mountId!;
      const mount = getMount(player.mountId);
      this.createPlayer(player);
      return { message: `🐴 Mounted ${mount?.name ?? "mount"}!`, color: "#88ff88" };
    }
  }

  /** Regenerate the player texture to reflect current equipment (weapon sprite).
   *  Uses a separate key so the base class texture stays clean for the title screen. */
  refreshPlayerSprite(
    player: PlayerState,
    renderMountedPose = isMountedInOverworld(player),
  ): void {
    this.applyHeroTexture(
      player,
      "front",
      renderMountedPose ? "mounted" : "standard",
    );
  }

  /** Generate the back-facing player texture (walking away from camera).
   *  Shows hair covering head, body back with simplified clothing, no weapons/shield. */
  refreshPlayerSpriteBack(player: PlayerState): void {
    this.applyHeroTexture(
      player,
      "back",
      isMountedInOverworld(player) ? "mounted" : "standard",
    );
  }

  /** Update player (and mount) facing direction based on movement.
   *  dx !== 0 = side profile, dy < 0 = back, dy > 0 = front. */
  setFacingDirection(dx: number, dy: number, player: PlayerState): void {
    let want: "front" | "back" | "side";
    if (dy < 0) want = "back";
    else if (dy > 0) want = "front";
    else if (dx !== 0) want = "side";
    else return;

    if (want === this.facing) return;
    this.facing = want;

    if (want === "back") {
      this.refreshPlayerSpriteBack(player);
      if (this.mountSprite && player.mountId) {
        const mountBackKey = `mount_back_${player.mountId}`;
        if (this.scene.textures.exists(mountBackKey)) {
          this.mountSprite.setTexture(mountBackKey);
        }
      }
    } else if (want === "side") {
      this.refreshPlayerSpriteSide(player);
      if (this.mountSprite && player.mountId) {
        const mountKey = `mount_${player.mountId}`;
        if (this.scene.textures.exists(mountKey)) {
          this.mountSprite.setTexture(mountKey);
        }
      }
    } else {
      this.refreshPlayerSprite(player);
      if (this.mountSprite && player.mountId) {
        const mountKey = `mount_${player.mountId}`;
        if (this.scene.textures.exists(mountKey)) {
          this.mountSprite.setTexture(mountKey);
        }
      }
    }
  }

  /** Generate the side-facing player texture (walking left/right).
   *  Shows half-face profile, weapon on visible side, body slightly narrower. */
  private refreshPlayerSpriteSide(player: PlayerState): void {
    this.applyHeroTexture(
      player,
      "side",
      isMountedInOverworld(player) ? "mounted" : "standard",
    );
  }

  private applyHeroTexture(
    player: PlayerState,
    facing: HeroFacing,
    pose: HeroPose,
  ): void {
    const nextLease = acquireHeroTexture(
      this.scene,
      resolveHeroVisualDescriptor(player),
      facing,
      pose,
    );
    this.playerSprite.setTexture(nextLease.key);
    this.heroTextureLease?.release();
    this.heroTextureLease = nextLease;
  }
}
