/**
 * PlayerRenderer: renders the player sprite and mount on the overworld.
 * Extracted from OverworldScene to reduce file size.
 */

import { getPlayerClass, getActiveWeaponSprite } from "../systems/classes";
import { getMount } from "../data/mounts";
import type { PlayerState } from "../systems/player";

const TILE_SIZE = 32;

/** Rider offset when mounted: shift left so mount head/neck is visible, shift up to sit on mount back. */
const MOUNT_RIDER_OFFSET_X = -3;
const MOUNT_RIDER_OFFSET_Y = 8;

/**
 * Handles rendering and refreshing the player sprite and mount sprite.
 */
export class PlayerRenderer {
  private scene: Phaser.Scene;
  playerSprite!: Phaser.GameObjects.Sprite;
  mountSprite: Phaser.GameObjects.Sprite | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
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
    if (this.mountSprite) {
      this.mountSprite.destroy();
      this.mountSprite = null;
    }

    const isMounted = player.mountId && !player.position.inDungeon && !player.position.inCity;
    const tileX = player.position.x * TILE_SIZE + TILE_SIZE / 2;
    const tileY = player.position.y * TILE_SIZE + TILE_SIZE / 2;

    // Player texture — prefer the equipped variant (reflects weapon/shield), fall back to base class texture
    const equippedKey = `player_equipped_${player.appearanceId}`;
    const baseKey = `player_${player.appearanceId}`;
    const playerKey = this.scene.textures.exists(equippedKey)
      ? equippedKey
      : this.scene.textures.exists(baseKey) ? baseKey : "player";

    if (isMounted) {
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

    // (Re)generate the equipped texture so legs & equipment are rendered correctly
    this.refreshPlayerSprite(player);
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
  refreshPlayerSprite(player: PlayerState): void {
    const cls = getPlayerClass(player.appearanceId);
    const texKey = `player_equipped_${player.appearanceId}`;
    const weaponSpr = getActiveWeaponSprite(player.appearanceId, player.equippedWeapon);
    if (this.scene.textures.exists(texKey)) this.scene.textures.remove(texKey);

    const gfx = this.scene.add.graphics();
    // Body
    gfx.fillStyle(cls.bodyColor, 1);
    gfx.fillRect(8, 10, 16, 16);
    // Clothing details
    this.drawClothingInline(gfx, cls.bodyColor, cls.clothingStyle);
    // Head (use custom appearance if set)
    const skinColor = player.customAppearance?.skinColor ?? cls.skinColor;
    gfx.fillStyle(skinColor, 1);
    gfx.fillCircle(16, 8, 6);
    // Hair
    if (player.customAppearance && player.customAppearance.hairStyle > 0) {
      gfx.fillStyle(player.customAppearance.hairColor, 1);
      const hs = player.customAppearance.hairStyle;
      if (hs === 1) {
        gfx.fillRect(11, 2, 10, 4);
      } else if (hs === 2) {
        gfx.fillRect(10, 1, 12, 5);
        gfx.fillRect(9, 4, 4, 6);
        gfx.fillRect(19, 4, 4, 6);
      } else if (hs === 3) {
        gfx.fillRect(10, 1, 12, 5);
        gfx.fillRect(8, 3, 5, 14);
        gfx.fillRect(19, 3, 5, 14);
      }
    }
    // Legs — when mounted only draw the near-side leg (far leg hidden behind mount body)
    gfx.fillStyle(cls.legColor, 1);
    const isMounted = !!player.mountId && !player.position.inDungeon && !player.position.inCity;
    if (isMounted) {
      gfx.fillRect(12, 24, 6, 5);
    } else {
      gfx.fillRect(9, 26, 5, 6);
      gfx.fillRect(18, 26, 5, 6);
    }
    // Weapon from current equipment
    this.drawWeaponInline(gfx, weaponSpr);
    // Shield (if equipped and weapon is not two-handed)
    this.drawShieldInline(gfx, !!player.equippedShield && !player.equippedWeapon?.twoHanded);

    gfx.generateTexture(texKey, TILE_SIZE, TILE_SIZE);
    gfx.destroy();

    this.playerSprite.setTexture(texKey);
  }

  /** Inline clothing drawing for OverworldScene sprite refresh. */
  private drawClothingInline(
    gfx: Phaser.GameObjects.Graphics,
    bodyColor: number,
    clothingStyle: string
  ): void {
    const darker = (c: number) => {
      const r = Math.max(0, ((c >> 16) & 0xff) - 40);
      const g = Math.max(0, ((c >> 8) & 0xff) - 40);
      const b = Math.max(0, (c & 0xff) - 40);
      return (r << 16) | (g << 8) | b;
    };
    const lighter = (c: number) => {
      const r = Math.min(255, ((c >> 16) & 0xff) + 50);
      const g = Math.min(255, ((c >> 8) & 0xff) + 50);
      const b = Math.min(255, (c & 0xff) + 50);
      return (r << 16) | (g << 8) | b;
    };

    switch (clothingStyle) {
      case "heavy":
        gfx.fillStyle(lighter(bodyColor), 1);
        gfx.fillRect(6, 10, 4, 5);
        gfx.fillRect(22, 10, 4, 5);
        gfx.fillStyle(darker(bodyColor), 1);
        gfx.fillRect(12, 14, 8, 2);
        gfx.fillRect(14, 10, 4, 2);
        break;
      case "robe":
        gfx.fillStyle(darker(bodyColor), 1);
        gfx.fillRect(6, 12, 3, 16);
        gfx.fillRect(23, 12, 3, 16);
        gfx.fillStyle(lighter(bodyColor), 1);
        gfx.fillRect(13, 10, 6, 1);
        gfx.fillRect(10, 25, 12, 2);
        break;
      case "leather":
        gfx.fillStyle(darker(bodyColor), 1);
        gfx.fillRect(10, 12, 2, 10);
        gfx.fillRect(20, 12, 2, 10);
        gfx.fillStyle(lighter(bodyColor), 1);
        gfx.fillRect(12, 22, 8, 2);
        break;
      case "vestment":
        gfx.fillStyle(lighter(bodyColor), 1);
        gfx.fillRect(13, 10, 2, 14);
        gfx.fillRect(17, 10, 2, 14);
        gfx.fillStyle(0xffd700, 1);
        gfx.fillRect(14, 12, 4, 4);
        gfx.fillRect(15, 11, 2, 1);
        break;
      case "bare":
        gfx.fillStyle(darker(bodyColor), 1);
        gfx.fillRect(10, 11, 12, 1);
        gfx.fillRect(11, 12, 2, 8);
        gfx.fillRect(19, 12, 2, 8);
        gfx.fillStyle(0x5d4037, 1);
        gfx.fillRect(8, 10, 3, 2);
        gfx.fillRect(21, 10, 3, 2);
        break;
      case "wrap":
        gfx.fillStyle(darker(bodyColor), 1);
        gfx.fillRect(10, 20, 12, 3);
        gfx.fillStyle(lighter(bodyColor), 1);
        gfx.fillRect(8, 14, 2, 6);
        gfx.fillRect(22, 14, 2, 6);
        gfx.fillRect(14, 10, 4, 1);
        break;
      case "performer":
        gfx.fillStyle(lighter(bodyColor), 1);
        gfx.fillRect(6, 10, 3, 14);
        gfx.fillStyle(darker(bodyColor), 1);
        gfx.fillRect(12, 22, 8, 2);
        gfx.fillStyle(0xffd700, 1);
        gfx.fillRect(13, 10, 6, 1);
        gfx.fillRect(15, 22, 2, 2);
        break;
    }
  }

  /** Inline weapon drawing for OverworldScene sprite refresh. */
  private drawWeaponInline(
    gfx: Phaser.GameObjects.Graphics,
    weaponSprite: string
  ): void {
    switch (weaponSprite) {
      case "sword":
        gfx.fillStyle(0xb0bec5, 1);
        gfx.fillRect(26, 6, 3, 18);
        gfx.fillStyle(0x795548, 1);
        gfx.fillRect(24, 20, 7, 3);
        break;
      case "staff":
        gfx.fillStyle(0x5d4037, 1);
        gfx.fillRect(27, 4, 2, 22);
        gfx.fillStyle(0x64ffda, 1);
        gfx.fillCircle(28, 4, 3);
        break;
      case "dagger":
        gfx.fillStyle(0xb0bec5, 1);
        gfx.fillRect(26, 14, 2, 10);
        gfx.fillStyle(0x795548, 1);
        gfx.fillRect(25, 22, 4, 2);
        break;
      case "bow":
        gfx.fillStyle(0x795548, 1);
        gfx.fillRect(27, 5, 2, 20);
        gfx.fillStyle(0xbdbdbd, 1);
        gfx.fillRect(29, 7, 1, 16);
        break;
      case "mace":
        gfx.fillStyle(0x795548, 1);
        gfx.fillRect(27, 12, 2, 14);
        gfx.fillStyle(0xb0bec5, 1);
        gfx.fillRect(25, 8, 6, 6);
        break;
      case "axe":
        gfx.fillStyle(0x795548, 1);
        gfx.fillRect(27, 6, 2, 18);
        gfx.fillStyle(0xb0bec5, 1);
        gfx.fillRect(24, 6, 5, 8);
        break;
      case "fist":
        gfx.fillStyle(0xbdbdbd, 1);
        gfx.fillRect(25, 16, 6, 6);
        gfx.fillStyle(0x9e9e9e, 1);
        gfx.fillRect(25, 17, 6, 1);
        gfx.fillRect(25, 19, 6, 1);
        break;
    }
  }

  /** Inline shield drawing for OverworldScene sprite refresh. */
  private drawShieldInline(gfx: Phaser.GameObjects.Graphics, hasShield: boolean): void {
    if (!hasShield) return;
    // Shield body (wood base)
    gfx.fillStyle(0x795548, 1);
    gfx.fillRect(1, 12, 6, 10);
    // Shield face (metal)
    gfx.fillStyle(0x90a4ae, 1);
    gfx.fillRect(2, 13, 4, 8);
    // Shield emblem (cross)
    gfx.fillStyle(0xffd700, 1);
    gfx.fillRect(3, 15, 2, 4);
    gfx.fillRect(2, 16, 4, 2);
  }
}
