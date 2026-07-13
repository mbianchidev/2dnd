import * as Phaser from "phaser";
import { getTrapDefinition, type DungeonTrap } from "../data/traps";
import type { PlayerState } from "../systems/player";
import { getTrapState } from "../systems/traps";
import { TILE_SIZE } from "../config";

export class TrapRenderer {
  private readonly scene: Phaser.Scene;
  private readonly cueSprites = new Map<string, Phaser.GameObjects.Sprite>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  clear(): void {
    for (const sprite of this.cueSprites.values()) {
      this.scene.tweens.killTweensOf(sprite);
      sprite.destroy();
    }
    this.cueSprites.clear();
  }

  render(
    player: PlayerState,
    traps: DungeonTrap[],
    isExplored: (x: number, y: number) => boolean,
  ): void {
    this.clear();
    if (!player.position.inDungeon) return;

    for (const trap of traps) {
      if (!isExplored(trap.x, trap.y)) continue;
      const state = getTrapState(player, trap);
      const distance = Math.abs(trap.x - player.position.x)
        + Math.abs(trap.y - player.position.y);
      if (state === undefined || state === "missed") {
        if (distance > 2) continue;
      }

      const sprite = this.scene.add
        .sprite(
          trap.x * TILE_SIZE + TILE_SIZE / 2,
          trap.y * TILE_SIZE + TILE_SIZE / 2,
          `trap_${trap.type}`,
        )
        .setDepth(6);
      sprite.setData("trapId", trap.id);

      if (state === "detected") {
        sprite.setAlpha(0.95);
        this.scene.tweens.add({
          targets: sprite,
          alpha: 0.55,
          duration: 600,
          yoyo: true,
          repeat: -1,
        });
      } else if (state === "disarmed") {
        sprite.setAlpha(0.35).setTint(0x66ff99);
      } else if (state === "triggered") {
        sprite.setAlpha(0.4).setTint(0x777777);
      } else {
        sprite.setAlpha(0.13);
      }

      this.cueSprites.set(trap.id, sprite);
    }
  }

  animateDetection(trap: DungeonTrap): void {
    const sprite = this.cueSprites.get(trap.id);
    if (!sprite) return;
    this.scene.tweens.killTweensOf(sprite);
    sprite.setScale(0.5).setAlpha(1);
    this.scene.tweens.add({
      targets: sprite,
      scale: 1.25,
      duration: 180,
      yoyo: true,
      onComplete: () => {
        if (!sprite.active) return;
        sprite.setScale(1);
        this.scene.tweens.add({
          targets: sprite,
          alpha: 0.55,
          duration: 600,
          yoyo: true,
          repeat: -1,
        });
      },
    });
  }

  animateDisarm(trap: DungeonTrap): void {
    const sprite = this.cueSprites.get(trap.id);
    if (!sprite) return;
    this.scene.tweens.killTweensOf(sprite);
    sprite.clearTint().setTint(0x66ff99).setAlpha(1);
    this.scene.tweens.add({
      targets: sprite,
      scale: 0.65,
      alpha: 0.3,
      duration: 350,
    });
  }

  animateTrigger(trap: DungeonTrap): void {
    const x = trap.x * TILE_SIZE + TILE_SIZE / 2;
    const y = trap.y * TILE_SIZE + TILE_SIZE / 2;
    const sprite = this.scene.add
      .sprite(x, y, `trap_${trap.type}`)
      .setDepth(30)
      .setAlpha(1);
    const destroy = (): void => {
      if (sprite.active) sprite.destroy();
    };

    switch (trap.type) {
      case "spikePit":
        sprite.setScale(0.2);
        this.scene.tweens.add({
          targets: sprite,
          scale: 1.5,
          alpha: 0,
          duration: 500,
          onComplete: destroy,
        });
        break;
      case "poisonDarts":
        sprite.setX(x - TILE_SIZE);
        this.scene.tweens.add({
          targets: sprite,
          x: x + TILE_SIZE,
          alpha: 0,
          duration: 320,
          onComplete: destroy,
        });
        break;
      case "fallingRocks":
        sprite.setY(y - TILE_SIZE * 1.5);
        this.scene.tweens.add({
          targets: sprite,
          y,
          angle: 120,
          alpha: 0,
          duration: 480,
          onComplete: destroy,
        });
        break;
      case "alarm":
        sprite.setScale(0.6);
        this.scene.tweens.add({
          targets: sprite,
          scale: 1.5,
          alpha: 0.2,
          duration: 150,
          yoyo: true,
          repeat: 2,
          onComplete: destroy,
        });
        break;
      case "hiddenFloor":
        this.scene.tweens.add({
          targets: sprite,
          scaleX: 0.05,
          scaleY: 0.05,
          angle: 45,
          alpha: 0,
          duration: 550,
          onComplete: destroy,
        });
        break;
      case "necroticRune":
        this.scene.tweens.add({
          targets: sprite,
          angle: 360,
          scale: 1.8,
          alpha: 0,
          duration: 650,
          onComplete: destroy,
        });
        break;
      case "frostBurst":
        sprite.setTint(getTrapDefinition(trap.type).color);
        this.scene.tweens.add({
          targets: sprite,
          scale: 2.2,
          alpha: 0,
          duration: 420,
          onComplete: destroy,
        });
        break;
      case "flameJet":
        sprite.setY(y + TILE_SIZE / 3);
        this.scene.tweens.add({
          targets: sprite,
          y: y - TILE_SIZE,
          scaleY: 2,
          alpha: 0,
          duration: 480,
          onComplete: destroy,
        });
        break;
    }
  }
}
