/**
 * HUD renderer: manages the heads-up display (HP/MP/XP bars, location text, gold, etc.).
 */

import Phaser from "phaser";
import type { PlayerState } from "../systems/player";
import { xpForLevel } from "../systems/player";
import { MAP_WIDTH, MAP_HEIGHT } from "../data/map";

const TILE_SIZE = 32;

export class HUDRenderer {
  private scene: Phaser.Scene;
  private hudText!: Phaser.GameObjects.Text;
  private locationText!: Phaser.GameObjects.Text;
  private messageText: Phaser.GameObjects.Text | null = null;
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }
  
  /**
   * Create the HUD elements (HP/MP/XP bars, location text).
   */
  createHUD(): void {
    const barX = 10;
    const barY = 10;
    
    this.hudText = this.scene.add.text(barX, barY, "", {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#fff",
      backgroundColor: "#000",
      padding: { x: 4, y: 4 },
    }).setDepth(100).setScrollFactor(0);
    
    this.locationText = this.scene.add.text(MAP_WIDTH * TILE_SIZE - 10, 10, "", {
      fontSize: "13px",
      fontFamily: "monospace",
      color: "#ffd700",
      backgroundColor: "#000",
      padding: { x: 4, y: 4 },
    }).setOrigin(1, 0).setDepth(100).setScrollFactor(0);
  }
  
  /**
   * Update HUD with current player stats.
   */
  updateHUD(player: PlayerState): void {
    if (!this.hudText) return;
    
    const xpNeeded = xpForLevel(player.level + 1);
    const hpBar = this.makeBar(player.hp, player.maxHp, 10, "█");
    const mpBar = this.makeBar(player.mp, player.maxMp, 10, "█");
    const xpBar = this.makeBar(player.xp, xpNeeded, 10, "▓");
    
    const lines = [
      `HP ${hpBar} ${player.hp}/${player.maxHp}`,
      `MP ${mpBar} ${player.mp}/${player.maxMp}`,
      `XP ${xpBar} ${player.xp}/${xpNeeded}`,
      `Gold: ${player.gold}g  Lv.${player.level}`,
    ];
    
    this.hudText.setText(lines.join("\n"));
  }
  
  /**
   * Update location text with current biome/city.
   */
  updateLocationText(text: string): void {
    if (!this.locationText) return;
    this.locationText.setText(text);
  }
  
  /**
   * Show a temporary message on screen.
   */
  showMessage(text: string, color = "#ffd700"): void {
    if (this.messageText) {
      this.messageText.destroy();
    }
    
    const x = (MAP_WIDTH * TILE_SIZE) / 2;
    const y = (MAP_HEIGHT * TILE_SIZE) / 2 - 60;
    
    this.messageText = this.scene.add.text(x, y, text, {
      fontSize: "16px",
      fontFamily: "monospace",
      color: color,
      backgroundColor: "#000",
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setDepth(150).setScrollFactor(0);
    
    this.scene.tweens.add({
      targets: this.messageText,
      alpha: 0,
      duration: 2000,
      delay: 1000,
      onComplete: () => {
        if (this.messageText) {
          this.messageText.destroy();
          this.messageText = null;
        }
      },
    });
  }
  
  /**
   * Get the HUD text object.
   */
  getHudText(): Phaser.GameObjects.Text {
    return this.hudText;
  }
  
  /**
   * Get the location text object.
   */
  getLocationText(): Phaser.GameObjects.Text {
    return this.locationText;
  }
  
  /**
   * Helper to draw a progress bar.
   */
  private makeBar(current: number, max: number, length: number, char: string): string {
    const filled = Math.floor((current / max) * length);
    return char.repeat(filled) + "·".repeat(length - filled);
  }
  
  /**
   * Draw shield icon inline in HUD graphics.
   */
  drawShieldInline(gfx: Phaser.GameObjects.Graphics, hasShield: boolean): void {
    if (!hasShield) return;
    
    // Draw a small shield icon
    gfx.fillStyle(0x888888, 1);
    gfx.fillRect(0, 0, 4, 6);
    gfx.fillStyle(0xaaaaaa, 1);
    gfx.fillTriangle(0, 0, 4, 0, 2, -2);
  }
}
