/**
 * Overlay manager: handles all UI overlays in the overworld scene
 * (equip, menu, settings, world map, stat allocation, bank, inn, dialogue).
 */

import Phaser from "phaser";

export class OverlayManager {
  private scene: Phaser.Scene;
  
  // Overlay containers
  public equipOverlay: Phaser.GameObjects.Container | null = null;
  public statOverlay: Phaser.GameObjects.Container | null = null;
  public menuOverlay: Phaser.GameObjects.Container | null = null;
  public worldMapOverlay: Phaser.GameObjects.Container | null = null;
  public settingsOverlay: Phaser.GameObjects.Container | null = null;
  public dialogueOverlay: Phaser.GameObjects.Container | null = null;
  public innConfirmOverlay: Phaser.GameObjects.Container | null = null;
  public bankOverlay: Phaser.GameObjects.Container | null = null;
  public townPickerOverlay: Phaser.GameObjects.Container | null = null;
  
  // Pagination state
  public equipPage: "gear" | "skills" | "items" = "gear";
  public gearWeaponPage = 0;
  public gearArmorPage = 0;
  public gearShieldPage = 0;
  public gearMountPage = 0;
  public itemsPage = 0;
  public spellsPage = 0;
  public abilitiesPage = 0;
  public pendingTeleportCost = 0;
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }
  
  /**
   * Check if any overlay is currently open.
   */
  isOpen(): boolean {
    return !!(
      this.equipOverlay ||
      this.statOverlay ||
      this.menuOverlay ||
      this.worldMapOverlay ||
      this.settingsOverlay ||
      this.dialogueOverlay ||
      this.innConfirmOverlay ||
      this.bankOverlay ||
      this.townPickerOverlay
    );
  }
  
  /**
   * Destroy all overlays.
   */
  destroyAll(): void {
    this.equipOverlay?.destroy();
    this.equipOverlay = null;
    this.statOverlay?.destroy();
    this.statOverlay = null;
    this.menuOverlay?.destroy();
    this.menuOverlay = null;
    this.worldMapOverlay?.destroy();
    this.worldMapOverlay = null;
    this.settingsOverlay?.destroy();
    this.settingsOverlay = null;
    this.dialogueOverlay?.destroy();
    this.dialogueOverlay = null;
    this.innConfirmOverlay?.destroy();
    this.innConfirmOverlay = null;
    this.bankOverlay?.destroy();
    this.bankOverlay = null;
    this.townPickerOverlay?.destroy();
    this.townPickerOverlay = null;
  }
}
