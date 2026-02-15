/**
 * OverlayManager — manages all UI overlays in the overworld scene:
 * equip (gear/skills/items), menu, settings, world map, stat allocation,
 * inn confirmation, bank, and town picker.
 */

import Phaser from "phaser";
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  TERRAIN_COLORS,
  CITIES,
  Terrain,
  getChunk,
  getInnCost,
  hasSparkleAt,
} from "../data/map";
import { getSpell } from "../data/spells";
import { getAbility } from "../data/abilities";
import { getMount } from "../data/mounts";
import {
  type PlayerState,
  type PlayerStats,
  xpForLevel,
  processPendingLevelUps,
  allocateStatPoint,
  applyBankInterest,
  equipOffHand,
  castSpellOutsideCombat,
  useAbilityOutsideCombat,
  useItem,
  isLightWeapon,
  getArmorClass,
} from "../systems/player";
import { getPlayerClass } from "../systems/classes";
import { abilityModifier } from "../systems/dice";
import { CYCLE_LENGTH } from "../systems/daynight";
import { audioEngine } from "../systems/audio";
import type { CodexData } from "../systems/codex";
import type { Item } from "../data/items";

const TILE_SIZE = 32;

/** Callbacks the OverlayManager uses to interact with the parent scene. */
export interface OverlayCallbacks {
  updateHUD: () => void;
  autoSave: () => void;
  showMessage: (text: string, color?: string) => void;
  renderMap: () => void;
  applyDayNightTint: () => void;
  createPlayer: () => void;
  refreshPlayerSprite: () => void;
  respawnCityNpcs: () => void;
  saveAndQuit: () => void;
  getTimeStep: () => number;
  setTimeStep: (t: number) => void;
  evacuateDungeon: () => void;
  getHUDInfo: () => string;
}

export class OverlayManager {
  private scene: Phaser.Scene;
  private callbacks: OverlayCallbacks;

  // Overlay containers
  equipOverlay: Phaser.GameObjects.Container | null = null;
  statOverlay: Phaser.GameObjects.Container | null = null;
  menuOverlay: Phaser.GameObjects.Container | null = null;
  worldMapOverlay: Phaser.GameObjects.Container | null = null;
  settingsOverlay: Phaser.GameObjects.Container | null = null;
  innConfirmOverlay: Phaser.GameObjects.Container | null = null;
  bankOverlay: Phaser.GameObjects.Container | null = null;
  townPickerOverlay: Phaser.GameObjects.Container | null = null;

  // Pagination state
  equipPage: "gear" | "skills" | "items" = "gear";
  gearWeaponPage = 0;
  gearOffHandPage = 0;
  gearArmorPage = 0;
  gearShieldPage = 0;
  gearMountPage = 0;
  itemsPage = 0;
  spellsPage = 0;
  abilitiesPage = 0;
  pendingTeleportCost = 0;

  constructor(scene: Phaser.Scene, callbacks: OverlayCallbacks) {
    this.scene = scene;
    this.callbacks = callbacks;
  }

  // ── Query ──────────────────────────────────────────────────────────

  /** Check if any overlay is currently open. */
  isOpen(): boolean {
    return !!(
      this.equipOverlay ||
      this.statOverlay ||
      this.menuOverlay ||
      this.worldMapOverlay ||
      this.settingsOverlay ||
      this.innConfirmOverlay ||
      this.bankOverlay ||
      this.townPickerOverlay
    );
  }

  /** Destroy all overlays. */
  destroyAll(): void {
    this.equipOverlay?.destroy(); this.equipOverlay = null;
    this.statOverlay?.destroy(); this.statOverlay = null;
    this.menuOverlay?.destroy(); this.menuOverlay = null;
    this.worldMapOverlay?.destroy(); this.worldMapOverlay = null;
    this.settingsOverlay?.destroy(); this.settingsOverlay = null;
    this.innConfirmOverlay?.destroy(); this.innConfirmOverlay = null;
    this.bankOverlay?.destroy(); this.bankOverlay = null;
    this.townPickerOverlay?.destroy(); this.townPickerOverlay = null;
  }

  // ── Equip Overlay ──────────────────────────────────────────────────

  /** Toggle the equip overlay open/closed. */
  toggleEquipOverlay(player: PlayerState): void {
    if (this.equipOverlay) {
      this.equipOverlay.destroy();
      this.equipOverlay = null;
      return;
    }
    this.equipPage = "gear";
    this.gearWeaponPage = 0;
    this.gearOffHandPage = 0;
    this.gearArmorPage = 0;
    this.gearShieldPage = 0;
    this.gearMountPage = 0;
    this.itemsPage = 0;
    this.spellsPage = 0;
    this.abilitiesPage = 0;
    this.buildEquipOverlay(player);
  }

  /** Build (or rebuild) the equip overlay panel. */
  buildEquipOverlay(player: PlayerState): void {
    if (this.equipOverlay) {
      this.equipOverlay.destroy();
      this.equipOverlay = null;
    }

    const w = this.scene.cameras.main.width;
    const h = this.scene.cameras.main.height;
    const infoPanelW = 150;
    const panelW = 280;
    const totalW = infoPanelW + panelW + 6;
    const panelH = 470;
    const startX = Math.floor((w - totalW) / 2);
    const px = startX + infoPanelW + 6; // right panel (gear/skills/items)
    const py = Math.floor((h - panelH) / 2) - 20;

    this.equipOverlay = this.scene.add.container(0, 0).setDepth(50);

    // Dim background
    const dim = this.scene.add.graphics();
    dim.fillStyle(0x000000, 0.5);
    dim.fillRect(0, 0, w, h);
    dim.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    dim.on("pointerdown", () => this.toggleEquipOverlay(player));
    this.equipOverlay.add(dim);

    // --- Left info panel ---
    const ipx = startX;
    const infoBg = this.scene.add.graphics();
    infoBg.fillStyle(0x1a1a2e, 0.95);
    infoBg.fillRect(ipx, py, infoPanelW, panelH);
    infoBg.lineStyle(2, 0xc0a060, 1);
    infoBg.strokeRect(ipx, py, infoPanelW, panelH);
    this.equipOverlay.add(infoBg);

    this.buildInfoPanel(player, ipx + 8, py + 8, infoPanelW - 16);

    // --- Right panel background ---
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.95);
    bg.fillRect(px, py, panelW, panelH);
    bg.lineStyle(2, 0xc0a060, 1);
    bg.strokeRect(px, py, panelW, panelH);
    this.equipOverlay.add(bg);

    // Tab bar
    const tabY = py + 8;
    const tabPositions = [0.17, 0.5, 0.83];
    const tabs: { label: string; page: "gear" | "skills" | "items" }[] = [
      { label: "⚔ Gear", page: "gear" },
      { label: "✦ Skills", page: "skills" },
      { label: "🎒 Items", page: "items" },
    ];
    const ulGfx = this.scene.add.graphics();
    ulGfx.lineStyle(2, 0xffd700, 1);
    for (let t = 0; t < 3; t++) {
      const tx = px + panelW * tabPositions[t];
      const tab = this.scene.add.text(tx, tabY, tabs[t].label, {
        fontSize: "12px", fontFamily: "monospace",
        color: this.equipPage === tabs[t].page ? "#ffd700" : "#888",
      }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
      const pg = tabs[t].page;
      tab.on("pointerdown", () => { this.equipPage = pg; this.buildEquipOverlay(player); });
      this.equipOverlay.add(tab);
      if (this.equipPage === tabs[t].page) {
        ulGfx.lineBetween(tx - 28, tabY + 16, tx + 28, tabY + 16);
      }
    }
    this.equipOverlay.add(ulGfx);

    if (this.equipPage === "gear") {
      this.buildEquipGearPage(player, px, py + 28, panelW, panelH - 28);
    } else if (this.equipPage === "skills") {
      this.buildEquipSkillsPage(player, px, py + 28, panelW, panelH - 28);
    } else {
      this.buildEquipItemsPage(player, px, py + 28, panelW, panelH - 28);
    }

    // Close hint
    const hint = this.scene.add.text(px + panelW / 2, py + panelH - 14, "Press E or click to close", {
      fontSize: "10px", fontFamily: "monospace", color: "#666",
    }).setOrigin(0.5, 1);
    this.equipOverlay.add(hint);
  }

  /** Build the left-side info panel showing player status, location, and stats. */
  private buildInfoPanel(player: PlayerState, x: number, y: number, w: number): void {
    const p = player;
    const cls = getPlayerClass(p.appearanceId);
    let cy = y;

    const addLine = (text: string, color = "#ccc", size = "10px") => {
      const t = this.scene.add.text(x, cy, text, {
        fontSize: size, fontFamily: "monospace", color,
        wordWrap: { width: w },
      });
      this.equipOverlay!.add(t);
      cy += parseInt(size) + 6;
    };

    addLine(`${p.name}`, "#ffd700", "13px");
    addLine(`${cls.label}  Lv.${p.level}`, "#aabbcc", "11px");
    cy += 6;

    // Location & world info — each on its own line
    const hudInfo = this.callbacks.getHUDInfo();
    const infoParts = hudInfo.split("  ").filter(Boolean);
    for (const part of infoParts) {
      addLine(part.trim(), "#999");
    }
    cy += 6;

    // HP / MP / XP / Gold
    const hpPct = Math.round((p.hp / p.maxHp) * 100);
    const hpColor = hpPct > 50 ? "#88ff88" : hpPct > 25 ? "#ffdd44" : "#ff6666";
    addLine(`HP: ${p.hp}/${p.maxHp}`, hpColor);
    addLine(`MP: ${p.mp}/${p.maxMp}`, "#88ccff");
    const xpNeeded = xpForLevel(p.level + 1);
    addLine(`XP: ${p.xp}/${xpNeeded}`, "#cc88ff");
    addLine(`Gold: ${p.gold}g`, "#ffd700");
    cy += 8;

    // Ability scores
    addLine("― Stats ―", "#c0a060", "10px");
    cy += 2;
    const mod = (stat: number) => {
      const m = abilityModifier(stat);
      return m >= 0 ? `+${m}` : `${m}`;
    };
    addLine(`STR ${p.stats.strength} (${mod(p.stats.strength)})`, "#ddd");
    addLine(`DEX ${p.stats.dexterity} (${mod(p.stats.dexterity)})`, "#ddd");
    addLine(`CON ${p.stats.constitution} (${mod(p.stats.constitution)})`, "#ddd");
    addLine(`INT ${p.stats.intelligence} (${mod(p.stats.intelligence)})`, "#ddd");
    addLine(`WIS ${p.stats.wisdom} (${mod(p.stats.wisdom)})`, "#ddd");
    addLine(`CHA ${p.stats.charisma} (${mod(p.stats.charisma)})`, "#ddd");
    cy += 6;

    // AC + To-Hit
    const ac = getArmorClass(p);
    const primaryStat = cls.primaryStat;
    const primaryVal = p.stats[primaryStat as keyof typeof p.stats];
    const primaryMod = abilityModifier(primaryVal);
    const profBonus = Math.floor((p.level - 1) / 4) + 2;
    const toHit = primaryMod + profBonus;
    addLine(`AC: ${ac}`, "#aaddff");
    addLine(`To-Hit: ${toHit >= 0 ? "+" : ""}${toHit}`, "#aaddff");

    if (p.pendingStatPoints > 0) {
      cy += 6;
      addLine(`★ ${p.pendingStatPoints} Stat Pts`, "#ffd700");
    }

    // Mount
    if (p.mountId && !p.position.inDungeon && !p.position.inCity) {
      cy += 6;
      const mount = getMount(p.mountId);
      addLine(`🐴 ${mount?.name ?? "Mount"}`, "#88ff88");
    }
  }

  /** Gear page: header stats, ability scores, equipment slots, mounts. */
  private buildEquipGearPage(player: PlayerState, px: number, py: number, panelW: number, _panelH: number): void {
    const p = player;
    const ac = getArmorClass(p);
    let cy = py + 6;

    // Header stats
    const xpNeeded = xpForLevel(p.level + 1);
    const header = this.scene.add.text(px + 14, cy, [
      `${p.name}  Lv.${p.level}`,
      `HP: ${p.hp}/${p.maxHp}   MP: ${p.mp}/${p.maxMp}   AC: ${ac}`,
      `EXP: ${p.xp}/${xpNeeded}  (${xpNeeded - p.xp} to next)`,
    ].join("\n"), {
      fontSize: "11px", fontFamily: "monospace", color: "#ccc", lineSpacing: 4,
    });
    this.equipOverlay!.add(header);
    cy += 48;

    // Ability scores
    const fmtStat = (label: string, val: number): string => {
      const mod = abilityModifier(val);
      const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
      const padVal = val < 10 ? ` ${val}` : `${val}`;
      return `${label} ${padVal} (${modStr})`;
    };
    const appearance = getPlayerClass(p.appearanceId);
    const primaryVal = p.stats[appearance.primaryStat];
    const primaryMod = abilityModifier(primaryVal);
    const profBonus = Math.floor((p.level - 1) / 4) + 2;
    const toHit = primaryMod + profBonus;
    const toHitStr = toHit >= 0 ? `+${toHit}` : `${toHit}`;
    const statsBlock = this.scene.add.text(px + 14, cy, [
      `― Stats ―  To-Hit: ${toHitStr}`,
      `${fmtStat("STR", p.stats.strength)}  ${fmtStat("DEX", p.stats.dexterity)}`,
      `${fmtStat("CON", p.stats.constitution)}  ${fmtStat("INT", p.stats.intelligence)}`,
      `${fmtStat("WIS", p.stats.wisdom)}  ${fmtStat("CHA", p.stats.charisma)}`,
    ].join("\n"), {
      fontSize: "11px", fontFamily: "monospace", color: "#ccc", lineSpacing: 4,
    });
    this.equipOverlay!.add(statsBlock);
    cy += 68;

    const MAX_SLOT_VISIBLE = 3;

    // Weapon slot — exclude the off-hand equipped weapon so it only appears in the off-hand section
    const mainHandWeapons = p.inventory.filter(
      (i) => i.type === "weapon" && i.id !== p.equippedOffHand?.id,
    );
    cy = this.renderGearSlot(player, px, cy, panelW, "Weapon", "weapon",
      p.equippedWeapon, (item) => {
        p.equippedWeapon = item;
        if (item?.twoHanded) { p.equippedShield = null; p.equippedOffHand = null; }
        if (!isLightWeapon(item)) { p.equippedOffHand = null; }
        this.callbacks.refreshPlayerSprite(); this.buildEquipOverlay(player);
      },
      () => { p.equippedWeapon = null; p.equippedOffHand = null; this.callbacks.refreshPlayerSprite(); this.buildEquipOverlay(player); },
      this.gearWeaponPage, MAX_SLOT_VISIBLE,
      (dir) => { this.gearWeaponPage += dir; this.buildEquipOverlay(player); },
      "dmg",
      mainHandWeapons);
    cy += 4;

    // Off-hand weapon slot (conditional) — only light weapons not equipped in main hand
    const canShowOffHand = isLightWeapon(p.equippedWeapon) && !p.equippedWeapon?.twoHanded;
    if (canShowOffHand) {
      const offHandWeapons = p.inventory.filter(
        (i) => i.type === "weapon" && i.light && !i.twoHanded && i.id !== p.equippedWeapon?.id,
      );
      if (offHandWeapons.length > 0 || p.equippedOffHand) {
        cy = this.renderGearSlot(player, px, cy, panelW, "Off-Hand", "weapon",
          p.equippedOffHand,
          (item) => {
            if (item) {
              const result = equipOffHand(p, item);
              if (!result.success) {
                this.callbacks.showMessage(result.message, "#ff6666");
              }
            }
            this.callbacks.refreshPlayerSprite(); this.buildEquipOverlay(player);
          },
          () => { p.equippedOffHand = null; this.callbacks.refreshPlayerSprite(); this.buildEquipOverlay(player); },
          this.gearOffHandPage, MAX_SLOT_VISIBLE,
          (dir) => { this.gearOffHandPage += dir; this.buildEquipOverlay(player); },
          "dmg",
          offHandWeapons);
        cy += 4;
      }
    }

    // Armor slot
    cy = this.renderGearSlot(player, px, cy, panelW, "Armor", "armor",
      p.equippedArmor, (item) => { p.equippedArmor = item; this.buildEquipOverlay(player); },
      () => { p.equippedArmor = null; this.buildEquipOverlay(player); },
      this.gearArmorPage, MAX_SLOT_VISIBLE,
      (dir) => { this.gearArmorPage += dir; this.buildEquipOverlay(player); },
      "AC");
    cy += 4;

    // Shield slot
    const isTwoHanded = p.equippedWeapon?.twoHanded === true;
    if (isTwoHanded) {
      const shieldLabel = this.scene.add.text(px + 14, cy, "Shield:", { fontSize: "11px", fontFamily: "monospace", color: "#c0a060" });
      this.equipOverlay!.add(shieldLabel);
      cy += 16;
      const note = this.scene.add.text(px + 20, cy, "(two-handed weapon)", { fontSize: "11px", fontFamily: "monospace", color: "#666" });
      this.equipOverlay!.add(note);
      cy += 16;
    } else {
      cy = this.renderGearSlot(player, px, cy, panelW, "Shield", "shield",
        p.equippedShield, (item) => { p.equippedShield = item; if (item) p.equippedOffHand = null; this.callbacks.refreshPlayerSprite(); this.buildEquipOverlay(player); },
        () => { p.equippedShield = null; this.callbacks.refreshPlayerSprite(); this.buildEquipOverlay(player); },
        this.gearShieldPage, MAX_SLOT_VISIBLE,
        (dir) => { this.gearShieldPage += dir; this.buildEquipOverlay(player); },
        "AC");
    }
    cy += 4;

    // Mount slot
    const mountLabel = this.scene.add.text(px + 14, cy, "Mount:", {
      fontSize: "11px", fontFamily: "monospace", color: "#c0a060",
    });
    this.equipOverlay!.add(mountLabel);
    cy += 16;

    const ownedMounts = p.inventory.filter((i) => i.type === "mount");
    const currentMount = p.mountId ? getMount(p.mountId) : undefined;
    const MAX_MOUNT_VISIBLE = 3;

    if (ownedMounts.length === 0 && !currentMount) {
      const none = this.scene.add.text(px + 20, cy, "On Foot", {
        fontSize: "11px", fontFamily: "monospace", color: "#666",
      });
      this.equipOverlay!.add(none);
      cy += 16;
    } else {
      const mountEntries: { mountId: string; name: string; speed: number; isActive: boolean }[] = [];
      if (currentMount) {
        mountEntries.push({ mountId: currentMount.id, name: currentMount.name, speed: currentMount.speedMultiplier, isActive: true });
      }
      for (const mi of ownedMounts) {
        if (mi.mountId && mi.mountId !== p.mountId) {
          const md = getMount(mi.mountId);
          if (md) mountEntries.push({ mountId: md.id, name: md.name, speed: md.speedMultiplier, isActive: false });
        }
      }
      if (currentMount) {
        mountEntries.push({ mountId: "", name: "Dismount (on foot)", speed: 0, isActive: false });
      }

      const mountTotalPages = Math.max(1, Math.ceil(mountEntries.length / MAX_MOUNT_VISIBLE));
      const mountPage = Math.min(this.gearMountPage, mountTotalPages - 1);
      const mountStart = mountPage * MAX_MOUNT_VISIBLE;
      const visibleMounts = mountEntries.slice(mountStart, mountStart + MAX_MOUNT_VISIBLE);

      for (const me of visibleMounts) {
        if (me.mountId === "" && me.speed === 0) {
          const dismountTxt = this.scene.add.text(px + 20, cy, "  Dismount (on foot)", {
            fontSize: "11px", fontFamily: "monospace", color: "#aaddff",
          }).setInteractive({ useHandCursor: true });
          dismountTxt.on("pointerover", () => dismountTxt.setColor("#ffd700"));
          dismountTxt.on("pointerout", () => dismountTxt.setColor("#aaddff"));
          dismountTxt.on("pointerdown", () => { p.mountId = ""; this.buildEquipOverlay(player); });
          this.equipOverlay!.add(dismountTxt);
        } else {
          const prefix = me.isActive ? "► " : "  ";
          const color = me.isActive ? "#88ff88" : "#aaddff";
          const txt = this.scene.add.text(px + 20, cy,
            `${prefix}${me.name} (×${me.speed} speed)${me.isActive ? " [riding]" : ""}`,
            { fontSize: "11px", fontFamily: "monospace", color },
          ).setInteractive({ useHandCursor: true });
          if (me.isActive) {
            txt.on("pointerover", () => txt.setColor("#ff6666"));
            txt.on("pointerout", () => txt.setColor(color));
            txt.on("pointerdown", () => { p.mountId = ""; this.buildEquipOverlay(player); });
          } else {
            txt.on("pointerover", () => txt.setColor("#ffd700"));
            txt.on("pointerout", () => txt.setColor(color));
            txt.on("pointerdown", () => { p.mountId = me.mountId; this.buildEquipOverlay(player); });
          }
          this.equipOverlay!.add(txt);
        }
        cy += 14;
      }

      if (mountTotalPages > 1) {
        const nav = this.scene.add.text(px + 20, cy, `◄ ${mountPage + 1}/${mountTotalPages} ►`, {
          fontSize: "10px", fontFamily: "monospace", color: "#888",
        }).setInteractive({ useHandCursor: true });
        nav.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
          const mid = nav.x + nav.width / 2;
          this.gearMountPage += pointer.x < mid ? -1 : 1;
          this.gearMountPage = Math.max(0, Math.min(this.gearMountPage, mountTotalPages - 1));
          this.buildEquipOverlay(player);
        });
        this.equipOverlay!.add(nav);
        cy += 14;
      }
    }
  }

  /** Render a paginated gear slot and return the new cy position. */
  private renderGearSlot(
    player: PlayerState,
    px: number, cy: number, _panelW: number,
    slotLabel: string, slotType: string,
    equipped: Item | null,
    onEquip: (item: Item | null) => void,
    onUnequip: () => void,
    page: number, maxVisible: number,
    onPageChange: (dir: number) => void,
    effectLabel: string,
    customItems?: Item[],
  ): number {
    const p = player;
    const label = this.scene.add.text(px + 14, cy, `${slotLabel}:`, {
      fontSize: "11px", fontFamily: "monospace", color: "#c0a060",
    });
    this.equipOverlay!.add(label);
    cy += 16;

    const ownedItems = customItems ?? p.inventory.filter((i) => i.type === slotType);
    if (ownedItems.length === 0 && !equipped) {
      const none = this.scene.add.text(px + 20, cy, slotType === "weapon" ? "Bare Hands" : `No ${slotLabel}`, {
        fontSize: "11px", fontFamily: "monospace", color: "#666",
      });
      this.equipOverlay!.add(none);
      cy += 16;
      return cy;
    }

    const allItems = equipped
      ? [equipped, ...ownedItems.filter((i) => i.id !== equipped.id)]
      : ownedItems;

    const totalPages = Math.ceil(allItems.length / maxVisible);
    const safePage = Math.min(page, totalPages - 1);
    const start = safePage * maxVisible;
    const visible = allItems.slice(start, start + maxVisible);

    for (const item of visible) {
      const isEquipped = equipped?.id === item.id;
      const prefix = isEquipped ? "► " : "  ";
      const color = isEquipped ? "#88ff88" : "#aaddff";
      const txt = this.scene.add.text(px + 20, cy,
        `${prefix}${item.name} (+${item.effect} ${effectLabel})${isEquipped ? " [eq]" : ""}`,
        { fontSize: "11px", fontFamily: "monospace", color },
      ).setInteractive({ useHandCursor: true });
      if (isEquipped) {
        txt.on("pointerover", () => txt.setColor("#ff6666"));
        txt.on("pointerout", () => txt.setColor(color));
        txt.on("pointerdown", () => onUnequip());
      } else {
        txt.on("pointerover", () => txt.setColor("#ffd700"));
        txt.on("pointerout", () => txt.setColor(color));
        txt.on("pointerdown", () => onEquip(item));
      }
      this.equipOverlay!.add(txt);
      cy += 14;
    }

    if (totalPages > 1) {
      const pg = safePage;
      const nav = this.scene.add.text(px + 20, cy, `◄ ${pg + 1}/${totalPages} ►`, {
        fontSize: "10px", fontFamily: "monospace", color: "#888",
      }).setInteractive({ useHandCursor: true });
      nav.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        const mid = nav.x + nav.width / 2;
        onPageChange(pointer.x < mid ? -1 : 1);
      });
      this.equipOverlay!.add(nav);
      cy += 14;
    }

    return cy;
  }

  /** Items page: grouped consumables and key items with pagination. */
  private buildEquipItemsPage(player: PlayerState, px: number, py: number, panelW: number, _panelH: number): void {
    const p = player;
    let cy = py + 6;
    const MAX_ITEMS_VISIBLE = 10;

    const consumables = p.inventory.filter((i) => i.type === "consumable");
    const grouped = new Map<string, { item: typeof consumables[0]; count: number }>();
    for (const item of consumables) {
      const existing = grouped.get(item.id);
      if (existing) { existing.count++; } else { grouped.set(item.id, { item, count: 1 }); }
    }
    const keyItems = p.inventory.filter((i) => i.type === "key");

    type ItemEntry = { label: string; desc: string; color: string; itemId?: string };
    const allEntries: ItemEntry[] = [];
    for (const [, { item, count }] of grouped) {
      allEntries.push({ label: `${item.name} ×${count}`, desc: item.description, color: "#aaddff", itemId: item.id });
    }
    for (const ki of keyItems) {
      allEntries.push({ label: ki.name, desc: ki.description, color: "#ffdd88" });
    }

    const totalPages = Math.max(1, Math.ceil(allEntries.length / MAX_ITEMS_VISIBLE));
    const safePage = Math.min(this.itemsPage, totalPages - 1);
    const visible = allEntries.slice(safePage * MAX_ITEMS_VISIBLE, (safePage + 1) * MAX_ITEMS_VISIBLE);

    const header = this.scene.add.text(px + 14, cy, `― Items (${allEntries.length}) ―`, {
      fontSize: "12px", fontFamily: "monospace", color: "#c0a060",
    });
    this.equipOverlay!.add(header);
    cy += 18;

    if (allEntries.length === 0) {
      const none = this.scene.add.text(px + 20, cy, "No items.", {
        fontSize: "11px", fontFamily: "monospace", color: "#666",
      });
      this.equipOverlay!.add(none);
      cy += 16;
    } else {
      for (const entry of visible) {
        const isConsumable = !!entry.itemId;
        const txt = this.scene.add.text(px + 20, cy, entry.label, {
          fontSize: "11px", fontFamily: "monospace", color: entry.color,
        });
        if (isConsumable) {
          txt.setInteractive({ useHandCursor: true });
          txt.on("pointerover", () => txt.setColor("#ffd700"));
          txt.on("pointerout", () => txt.setColor(entry.color));
          txt.on("pointerdown", () => {
            const idx = p.inventory.findIndex((i) => i.id === entry.itemId && i.type === "consumable");
            if (idx >= 0) {
              const result = useItem(p, idx);
              if (result.used) {
                if (result.teleport) {
                  this.pendingTeleportCost = 0;
                  this.toggleEquipOverlay(player);
                  this.showTownPicker(player);
                  if (audioEngine.initialized) audioEngine.playTeleportSFX();
                  return;
                }
                if (audioEngine.initialized) audioEngine.playPotionSFX();
                this.callbacks.updateHUD();
              } else {
                this.callbacks.showMessage(result.message, "#ff6666");
              }
              this.buildEquipOverlay(player);
            }
          });
        }
        this.equipOverlay!.add(txt);
        const desc = this.scene.add.text(px + 30, cy + 13, entry.desc, {
          fontSize: "9px", fontFamily: "monospace", color: "#888",
          wordWrap: { width: panelW - 50 },
        });
        this.equipOverlay!.add(desc);
        cy += 28;
      }
    }

    if (totalPages > 1) {
      cy += 4;
      const nav = this.scene.add.text(px + 20, cy, `◄ ${safePage + 1}/${totalPages} ►`, {
        fontSize: "10px", fontFamily: "monospace", color: "#888",
      }).setInteractive({ useHandCursor: true });
      nav.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        const mid = nav.x + nav.width / 2;
        this.itemsPage += pointer.x < mid ? -1 : 1;
        this.itemsPage = Math.max(0, Math.min(this.itemsPage, totalPages - 1));
        this.buildEquipOverlay(player);
      });
      this.equipOverlay!.add(nav);
    }
  }

  /** Skills page: paginated spells and abilities. */
  private buildEquipSkillsPage(player: PlayerState, px: number, py: number, panelW: number, _panelH: number): void {
    const p = player;
    const appearance = getPlayerClass(p.appearanceId);
    const primaryMod = abilityModifier(p.stats[appearance.primaryStat]);
    let cy = py + 6;
    const MAX_SPELL_VISIBLE = 5;
    const MAX_ABILITY_VISIBLE = 5;

    // Spells
    const spellTotalPages = Math.max(1, Math.ceil(p.knownSpells.length / MAX_SPELL_VISIBLE));
    const spellPage = Math.min(this.spellsPage, spellTotalPages - 1);
    const spellStart = spellPage * MAX_SPELL_VISIBLE;
    const visibleSpells = p.knownSpells.slice(spellStart, spellStart + MAX_SPELL_VISIBLE);

    const spellsHeader = this.scene.add.text(px + 14, cy, `― Spells (${p.knownSpells.length}) ―`, {
      fontSize: "12px", fontFamily: "monospace", color: "#c0a060",
    });
    this.equipOverlay!.add(spellsHeader);
    cy += 18;

    if (p.knownSpells.length === 0) {
      const none = this.scene.add.text(px + 20, cy, "No spells learned yet.", {
        fontSize: "11px", fontFamily: "monospace", color: "#666",
      });
      this.equipOverlay!.add(none);
      cy += 16;
    } else {
      for (const spellId of visibleSpells) {
        const spell = getSpell(spellId);
        if (!spell) continue;
        const dmgOrHeal = spell.type === "heal" ? "heal" : "dmg";
        const hasDice = spell.damageDie > 0 && spell.damageCount > 0;
        const diceStr = hasDice ? `${spell.damageCount}d${spell.damageDie}` : "";
        const modStr = primaryMod >= 0 ? `+${primaryMod}` : `${primaryMod}`;
        const diceInfo = hasDice ? `  ${diceStr}${modStr} ${dmgOrHeal}` : "";
        const isUsable = spell.type === "heal" || spell.type === "utility";
        let canCast = false;
        if (isUsable) {
          canCast = p.mp >= spell.mpCost && (spell.type !== "heal" || p.hp < p.maxHp);
          // Block teleport in dungeons
          if (spell.id === "teleport" && p.position.inDungeon) {
            canCast = false;
          }
        }
        const baseColor = isUsable ? (canCast ? "#ccffcc" : "#666") : "#aaddff";
        const txt = this.scene.add.text(px + 20, cy,
          `${spell.name}  ${spell.mpCost} MP${diceInfo}`,
          { fontSize: "11px", fontFamily: "monospace", color: baseColor },
        );
        if (isUsable) {
          txt.setInteractive({ useHandCursor: canCast });
          if (canCast) {
            txt.on("pointerover", () => txt.setColor("#ffd700"));
            txt.on("pointerout", () => txt.setColor(baseColor));
            txt.on("pointerdown", () => {
              const result = castSpellOutsideCombat(p, spell.id);
              if (result.teleport) {
                this.pendingTeleportCost = spell.mpCost;
                this.toggleEquipOverlay(player);
                this.showTownPicker(player);
                return;
              }
              this.callbacks.showMessage(result.message);
              audioEngine.playPotionSFX();
              this.buildEquipOverlay(player);
              this.callbacks.updateHUD();
            });
          }
        }
        this.equipOverlay!.add(txt);
        const desc = this.scene.add.text(px + 30, cy + 14,
          spell.description,
          { fontSize: "9px", fontFamily: "monospace", color: "#888", wordWrap: { width: panelW - 50 } },
        );
        this.equipOverlay!.add(desc);
        cy += 16 + Math.max(14, desc.height) + 4;
      }
      if (spellTotalPages > 1) {
        const nav = this.scene.add.text(px + 20, cy, `◄ ${spellPage + 1}/${spellTotalPages} ►`, {
          fontSize: "10px", fontFamily: "monospace", color: "#888",
        }).setInteractive({ useHandCursor: true });
        nav.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
          const mid = nav.x + nav.width / 2;
          this.spellsPage += pointer.x < mid ? -1 : 1;
          this.spellsPage = Math.max(0, Math.min(this.spellsPage, spellTotalPages - 1));
          this.buildEquipOverlay(player);
        });
        this.equipOverlay!.add(nav);
        cy += 16;
      }
    }
    cy += 8;

    // Abilities
    const knownAbilities = p.knownAbilities ?? [];
    const abilityTotalPages = Math.max(1, Math.ceil(knownAbilities.length / MAX_ABILITY_VISIBLE));
    const abilityPage = Math.min(this.abilitiesPage, abilityTotalPages - 1);
    const abilityStart = abilityPage * MAX_ABILITY_VISIBLE;
    const visibleAbilities = knownAbilities.slice(abilityStart, abilityStart + MAX_ABILITY_VISIBLE);

    const abilitiesHeader = this.scene.add.text(px + 14, cy, `― Abilities (${knownAbilities.length}) ―`, {
      fontSize: "12px", fontFamily: "monospace", color: "#c0a060",
    });
    this.equipOverlay!.add(abilitiesHeader);
    cy += 18;

    if (knownAbilities.length === 0) {
      const none = this.scene.add.text(px + 20, cy, "No abilities learned yet.", {
        fontSize: "11px", fontFamily: "monospace", color: "#666",
      });
      this.equipOverlay!.add(none);
      cy += 16;
    } else {
      for (const abilityId of visibleAbilities) {
        const ability = getAbility(abilityId);
        if (!ability) continue;
        const dmgOrHeal = ability.type === "heal" ? "heal" : "dmg";
        const hasDice = ability.damageDie > 0 && ability.damageCount > 0;
        const diceStr = hasDice ? `${ability.damageCount}d${ability.damageDie}` : "";
        const aMod = abilityModifier(p.stats[ability.statKey]);
        const aModStr = aMod >= 0 ? `+${aMod}` : `${aMod}`;
        const bonusTag = ability.bonusAction ? " [bonus]" : "";
        const diceInfo = hasDice ? `  ${diceStr}${aModStr} ${dmgOrHeal}` : "";
        const isUsable = ability.type === "heal" || ability.type === "utility";
        let canUse = isUsable && p.mp >= ability.mpCost && (ability.type !== "heal" || p.hp < p.maxHp);
        // Special usability checks for shortRest and evac
        if (ability.id === "shortRest") {
          const inWilds = !p.position.inDungeon && !p.position.inCity;
          canUse = inWilds && p.shortRestsRemaining > 0 && (p.hp < p.maxHp || p.mp < p.maxMp || (p.pendingLevelUps ?? 0) > 0);
        }
        if (ability.id === "evac") {
          canUse = p.position.inDungeon && p.mp >= ability.mpCost;
        }
        if (ability.id === "fastTravel") {
          canUse = !p.position.inDungeon && p.mp >= ability.mpCost;
        }
        const baseColor = isUsable ? (canUse ? "#ccffcc" : "#666") : "#aaddff";
        const txt = this.scene.add.text(px + 20, cy,
          `${ability.name}  ${ability.mpCost} MP${diceInfo}${bonusTag}`,
          { fontSize: "11px", fontFamily: "monospace", color: baseColor },
        );
        if (isUsable) {
          txt.setInteractive({ useHandCursor: canUse });
          if (canUse) {
            txt.on("pointerover", () => txt.setColor("#ffd700"));
            txt.on("pointerout", () => txt.setColor(baseColor));
            txt.on("pointerdown", () => {
              const result = useAbilityOutsideCombat(p, ability.id);
              if (result.teleport) {
                this.pendingTeleportCost = ability.mpCost;
                this.toggleEquipOverlay(player);
                this.showTownPicker(player);
                return;
              }
              if (result.evac) {
                this.toggleEquipOverlay(player);
                this.callbacks.showMessage(result.message, "#88ff88");
                this.callbacks.evacuateDungeon();
                return;
              }
              this.callbacks.showMessage(result.message);
              if (ability.id === "shortRest") {
                audioEngine.playCampfireSFX();
                if (p.pendingStatPoints > 0) {
                  this.toggleEquipOverlay(player);
                  this.scene.time.delayedCall(500, () => this.showStatOverlay(player));
                  return;
                }
              } else {
                audioEngine.playPotionSFX();
              }
              this.buildEquipOverlay(player);
              this.callbacks.updateHUD();
            });
          }
        }
        this.equipOverlay!.add(txt);
        const desc = this.scene.add.text(px + 30, cy + 14,
          ability.description,
          { fontSize: "9px", fontFamily: "monospace", color: "#888", wordWrap: { width: panelW - 50 } },
        );
        this.equipOverlay!.add(desc);
        cy += 16 + Math.max(14, desc.height) + 4;
      }
      if (abilityTotalPages > 1) {
        const nav = this.scene.add.text(px + 20, cy, `◄ ${abilityPage + 1}/${abilityTotalPages} ►`, {
          fontSize: "10px", fontFamily: "monospace", color: "#888",
        }).setInteractive({ useHandCursor: true });
        nav.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
          const mid = nav.x + nav.width / 2;
          this.abilitiesPage += pointer.x < mid ? -1 : 1;
          this.abilitiesPage = Math.max(0, Math.min(this.abilitiesPage, abilityTotalPages - 1));
          this.buildEquipOverlay(player);
        });
        this.equipOverlay!.add(nav);
      }
    }
  }

  // ── Rolled Stats Overlay ───────────────────────────────────────────

  /** Show the initial stat overview after character creation. */
  showRolledStatsOverlay(player: PlayerState): void {
    if (this.statOverlay) {
      this.statOverlay.destroy();
      this.statOverlay = null;
    }

    const w = this.scene.cameras.main.width;
    const h = this.scene.cameras.main.height;
    const panelW = 260;
    const panelH = 240;
    const px = Math.floor((w - panelW) / 2);
    const py = Math.floor((h - panelH) / 2) - 20;

    this.statOverlay = this.scene.add.container(0, 0).setDepth(60);

    const dim = this.scene.add.graphics();
    dim.fillStyle(0x000000, 0.6);
    dim.fillRect(0, 0, w, h);
    this.statOverlay.add(dim);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.95);
    bg.fillRect(px, py, panelW, panelH);
    bg.lineStyle(2, 0xffd700, 1);
    bg.strokeRect(px, py, panelW, panelH);
    this.statOverlay.add(bg);

    const title = this.scene.add.text(px + panelW / 2, py + 12, "📊 Your Stats", {
      fontSize: "15px", fontFamily: "monospace", color: "#ffd700",
    }).setOrigin(0.5, 0);
    this.statOverlay.add(title);

    const p = player;
    const statNames: { key: keyof PlayerStats; label: string }[] = [
      { key: "strength", label: "STR" },
      { key: "dexterity", label: "DEX" },
      { key: "constitution", label: "CON" },
      { key: "intelligence", label: "INT" },
      { key: "wisdom", label: "WIS" },
      { key: "charisma", label: "CHA" },
    ];

    let cy = py + 40;
    for (const { key, label } of statNames) {
      const val = p.stats[key];
      const mod = abilityModifier(val);
      const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
      const txt = this.scene.add.text(px + 30, cy, `${label}:  ${val}  (${modStr})`, {
        fontSize: "13px", fontFamily: "monospace", color: "#ddd",
      });
      this.statOverlay.add(txt);
      cy += 22;
    }

    cy += 8;
    const hpMp = this.scene.add.text(px + 30, cy, `HP: ${p.maxHp}   MP: ${p.maxMp}`, {
      fontSize: "12px", fontFamily: "monospace", color: "#88cc88",
    });
    this.statOverlay.add(hpMp);

    const closeHint = this.scene.add.text(px + panelW / 2, py + panelH - 14, "Press SPACE to continue", {
      fontSize: "11px", fontFamily: "monospace", color: "#888",
    }).setOrigin(0.5, 1);
    this.statOverlay.add(closeHint);

    this.scene.tweens.add({ targets: closeHint, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });

    const handler = (): void => {
      if (this.statOverlay) {
        this.statOverlay.destroy();
        this.statOverlay = null;
      }
    };
    this.scene.input.keyboard!.once("keydown-SPACE", handler);
  }

  // ── Menu Overlay ───────────────────────────────────────────────────

  /** Toggle the in-game menu. */
  toggleMenuOverlay(player: PlayerState, defeatedBosses: Set<string>, codex: CodexData): void {
    if (this.menuOverlay) {
      this.menuOverlay.destroy();
      this.menuOverlay = null;
      return;
    }
    this.showMenuOverlay(player, defeatedBosses, codex);
  }

  /** Show the menu overlay with Resume / Settings / Quit. */
  showMenuOverlay(player: PlayerState, defeatedBosses: Set<string>, codex: CodexData): void {
    if (this.equipOverlay) { this.equipOverlay.destroy(); this.equipOverlay = null; }
    if (this.statOverlay) { this.statOverlay.destroy(); this.statOverlay = null; }

    const w = this.scene.cameras.main.width;
    const h = this.scene.cameras.main.height;
    const panelW = 220;
    const panelH = 200;
    const px = Math.floor((w - panelW) / 2);
    const py = Math.floor((h - panelH) / 2) - 10;

    this.menuOverlay = this.scene.add.container(0, 0).setDepth(70);

    const dim = this.scene.add.graphics();
    dim.fillStyle(0x000000, 0.6);
    dim.fillRect(0, 0, w, h);
    this.menuOverlay.add(dim);
    dim.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    dim.on("pointerdown", () => this.toggleMenuOverlay(player, defeatedBosses, codex));

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.95);
    bg.fillRect(px, py, panelW, panelH);
    bg.lineStyle(2, 0xffd700, 1);
    bg.strokeRect(px, py, panelW, panelH);
    this.menuOverlay.add(bg);

    const title = this.scene.add.text(px + panelW / 2, py + 14, "⚙ Menu", {
      fontSize: "14px", fontFamily: "monospace", color: "#ffd700",
    }).setOrigin(0.5, 0);
    this.menuOverlay.add(title);

    // Resume
    const resumeBtn = this.scene.add.text(px + panelW / 2, py + 48, "▶ Resume", {
      fontSize: "14px", fontFamily: "monospace", color: "#88ff88",
      backgroundColor: "#2a2a4e", padding: { x: 16, y: 6 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    resumeBtn.on("pointerover", () => resumeBtn.setColor("#ffd700"));
    resumeBtn.on("pointerout", () => resumeBtn.setColor("#88ff88"));
    resumeBtn.on("pointerdown", () => this.toggleMenuOverlay(player, defeatedBosses, codex));
    this.menuOverlay.add(resumeBtn);

    // Settings
    const settingsBtn = this.scene.add.text(px + panelW / 2, py + 90, "🔊 Settings", {
      fontSize: "14px", fontFamily: "monospace", color: "#aabbff",
      backgroundColor: "#2a2a4e", padding: { x: 16, y: 6 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    settingsBtn.on("pointerover", () => settingsBtn.setColor("#ffd700"));
    settingsBtn.on("pointerout", () => settingsBtn.setColor("#aabbff"));
    settingsBtn.on("pointerdown", () => {
      this.toggleMenuOverlay(player, defeatedBosses, codex);
      this.showSettingsOverlay();
    });
    this.menuOverlay.add(settingsBtn);

    // Quit
    const quitBtn = this.scene.add.text(px + panelW / 2, py + 132, "✕ Quit to Title", {
      fontSize: "14px", fontFamily: "monospace", color: "#ff6666",
      backgroundColor: "#2a2a4e", padding: { x: 16, y: 6 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    quitBtn.on("pointerover", () => quitBtn.setColor("#ff4444"));
    quitBtn.on("pointerout", () => quitBtn.setColor("#ff6666"));
    quitBtn.on("pointerdown", () => {
      this.callbacks.saveAndQuit();
    });
    this.menuOverlay.add(quitBtn);

    const hint = this.scene.add.text(px + panelW / 2, py + panelH - 8, "Press ESC to close", {
      fontSize: "10px", fontFamily: "monospace", color: "#666",
    }).setOrigin(0.5, 1);
    this.menuOverlay.add(hint);
  }

  // ── Settings Overlay ───────────────────────────────────────────────

  /** Toggle the settings overlay. */
  toggleSettingsOverlay(): void {
    if (this.settingsOverlay) {
      this.settingsOverlay.destroy();
      this.settingsOverlay = null;
      return;
    }
    this.showSettingsOverlay();
  }

  /** Show audio settings with volume sliders and mute toggle. */
  showSettingsOverlay(): void {
    if (this.menuOverlay) { this.menuOverlay.destroy(); this.menuOverlay = null; }
    if (this.equipOverlay) { this.equipOverlay.destroy(); this.equipOverlay = null; }
    if (this.statOverlay) { this.statOverlay.destroy(); this.statOverlay = null; }
    if (this.settingsOverlay) { this.settingsOverlay.destroy(); this.settingsOverlay = null; }

    const w = this.scene.cameras.main.width;
    const h = this.scene.cameras.main.height;
    const panelW = 300;
    const panelH = 290;
    const px = Math.floor((w - panelW) / 2);
    const py = Math.floor((h - panelH) / 2) - 10;

    this.settingsOverlay = this.scene.add.container(0, 0).setDepth(75);

    const dim = this.scene.add.graphics();
    dim.fillStyle(0x000000, 0.6);
    dim.fillRect(0, 0, w, h);
    dim.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    dim.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.x < px || pointer.x > px + panelW || pointer.y < py || pointer.y > py + panelH) {
        this.toggleSettingsOverlay();
      }
    });
    this.settingsOverlay.add(dim);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.95);
    bg.fillRect(px, py, panelW, panelH);
    bg.lineStyle(2, 0xffd700, 1);
    bg.strokeRect(px, py, panelW, panelH);
    bg.setInteractive(new Phaser.Geom.Rectangle(px, py, panelW, panelH), Phaser.Geom.Rectangle.Contains);
    this.settingsOverlay.add(bg);

    const title = this.scene.add.text(px + panelW / 2, py + 12, "🔊 Audio Settings", {
      fontSize: "14px", fontFamily: "monospace", color: "#ffd700",
    }).setOrigin(0.5, 0);
    this.settingsOverlay.add(title);

    const sliderY = py + 44;
    const sliderX = px + 16;
    const sliderW = panelW - 32;
    const barH = 10;
    const sliderSpacing = 48;

    const channels: { label: string; value: number; setter: (v: number) => void }[] = [
      { label: "Master", value: audioEngine.state.masterVolume, setter: (v) => audioEngine.setMasterVolume(v) },
      { label: "Music", value: audioEngine.state.musicVolume, setter: (v) => audioEngine.setMusicVolume(v) },
      { label: "SFX", value: audioEngine.state.sfxVolume, setter: (v) => audioEngine.setSFXVolume(v) },
      { label: "Dialog", value: audioEngine.state.dialogVolume, setter: (v) => audioEngine.setDialogVolume(v) },
    ];

    channels.forEach((ch, i) => {
      const y = sliderY + i * sliderSpacing;

      const valText = this.scene.add.text(sliderX + sliderW, y - 2, `${ch.label}: ${Math.round(ch.value * 100)}%`, {
        fontSize: "11px", fontFamily: "monospace", color: "#ccc",
      }).setOrigin(1, 0);
      this.settingsOverlay!.add(valText);

      const track = this.scene.add.graphics();
      track.fillStyle(0x333355, 1);
      track.fillRect(sliderX, y + 14, sliderW, barH);
      track.lineStyle(1, 0x555577, 1);
      track.strokeRect(sliderX, y + 14, sliderW, barH);
      this.settingsOverlay!.add(track);

      const fill = this.scene.add.graphics();
      const drawFill = (v: number): void => {
        fill.clear();
        fill.fillStyle(0x4488ff, 1);
        fill.fillRect(sliderX, y + 14, sliderW * v, barH);
      };
      drawFill(ch.value);
      this.settingsOverlay!.add(fill);

      let currentKnobX = sliderX + sliderW * ch.value;
      const knob = this.scene.add.graphics();
      const drawKnob = (kx: number): void => {
        knob.clear();
        knob.fillStyle(0xffd700, 1);
        knob.fillCircle(kx, y + 14 + barH / 2, 7);
        knob.lineStyle(1, 0xaa8800, 1);
        knob.strokeCircle(kx, y + 14 + barH / 2, 7);
      };
      drawKnob(currentKnobX);
      this.settingsOverlay!.add(knob);

      const knobZone = this.scene.add.zone(currentKnobX, y + 14 + barH / 2, 22, 22)
        .setInteractive({ useHandCursor: true, draggable: true });
      this.settingsOverlay!.add(knobZone);

      knobZone.on("drag", (_pointer: Phaser.Input.Pointer, dragX: number) => {
        const clampedX = Phaser.Math.Clamp(dragX, sliderX, sliderX + sliderW);
        const ratio = (clampedX - sliderX) / sliderW;
        ch.setter(ratio);
        ch.value = ratio;
        currentKnobX = clampedX;
        drawFill(ratio);
        drawKnob(clampedX);
        knobZone.setPosition(clampedX, y + 14 + barH / 2);
        valText.setText(`${ch.label}: ${Math.round(ratio * 100)}%`);
      });
    });

    const muteY = sliderY + channels.length * sliderSpacing + 4;
    const muteBtn = this.scene.add.text(px + panelW / 2, muteY, audioEngine.state.muted ? "🔇 Unmute" : "🔊 Mute All", {
      fontSize: "13px", fontFamily: "monospace", color: audioEngine.state.muted ? "#ff6666" : "#88ccff",
      backgroundColor: "#2a2a4e", padding: { x: 12, y: 4 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    muteBtn.on("pointerdown", () => {
      const muted = audioEngine.toggleMute();
      muteBtn.setText(muted ? "🔇 Unmute" : "🔊 Mute All");
      muteBtn.setColor(muted ? "#ff6666" : "#88ccff");
    });
    this.settingsOverlay.add(muteBtn);

    const hint = this.scene.add.text(px + panelW / 2, py + panelH - 10, "Click outside or press ESC to close", {
      fontSize: "10px", fontFamily: "monospace", color: "#666",
    }).setOrigin(0.5, 1);
    this.settingsOverlay.add(hint);
  }

  // ── ASI Stat Allocation Overlay ────────────────────────────────────

  /** Show the ASI (Ability Score Improvement) overlay for stat allocation. */
  showStatOverlay(player: PlayerState): void {
    if (this.equipOverlay) { this.equipOverlay.destroy(); this.equipOverlay = null; }
    if (this.statOverlay) { this.statOverlay.destroy(); this.statOverlay = null; }

    const w = this.scene.cameras.main.width;
    const h = this.scene.cameras.main.height;
    const panelW = 280;
    const panelH = 320;
    const px = Math.floor((w - panelW) / 2);
    const py = Math.floor((h - panelH) / 2) - 10;

    this.statOverlay = this.scene.add.container(0, 0).setDepth(60);

    const dim = this.scene.add.graphics();
    dim.fillStyle(0x000000, 0.6);
    dim.fillRect(0, 0, w, h);
    this.statOverlay.add(dim);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.95);
    bg.fillRect(px, py, panelW, panelH);
    bg.lineStyle(2, 0xffd700, 1);
    bg.strokeRect(px, py, panelW, panelH);
    this.statOverlay.add(bg);

    const title = this.scene.add.text(px + panelW / 2, py + 10, "★ Ability Score Improvement", {
      fontSize: "13px", fontFamily: "monospace", color: "#ffd700",
    }).setOrigin(0.5, 0);
    this.statOverlay.add(title);

    const remaining = this.scene.add.text(px + panelW / 2, py + 30, `Points remaining: ${player.pendingStatPoints}`, {
      fontSize: "12px", fontFamily: "monospace", color: "#88ff88",
    }).setOrigin(0.5, 0);
    this.statOverlay.add(remaining);

    const p = player;
    const statNames: { key: keyof PlayerStats; label: string }[] = [
      { key: "strength", label: "STR" },
      { key: "dexterity", label: "DEX" },
      { key: "constitution", label: "CON" },
      { key: "intelligence", label: "INT" },
      { key: "wisdom", label: "WIS" },
      { key: "charisma", label: "CHA" },
    ];

    let cy = py + 54;
    for (const { key, label } of statNames) {
      const val = p.stats[key];
      const mod = abilityModifier(val);
      const modStr = mod >= 0 ? `+${mod}` : `${mod}`;

      const row = this.scene.add.text(px + 20, cy, `${label}:  ${val}  (${modStr})`, {
        fontSize: "12px", fontFamily: "monospace", color: "#ddd",
      });
      this.statOverlay.add(row);

      const btn = this.scene.add.text(px + panelW - 40, cy - 2, "[+]", {
        fontSize: "14px", fontFamily: "monospace", color: "#88ff88",
      }).setInteractive({ useHandCursor: true });

      btn.on("pointerover", () => btn.setColor("#ffd700"));
      btn.on("pointerout", () => btn.setColor("#88ff88"));
      btn.on("pointerdown", () => {
        if (allocateStatPoint(p, key)) {
          this.callbacks.updateHUD();
          this.showStatOverlay(player);
        }
      });

      this.statOverlay.add(btn);
      cy += 28;
    }

    if (p.pendingStatPoints <= 0) {
      const confirmBtn = this.scene.add.text(px + panelW / 2, py + panelH - 36, "✔ Confirm", {
        fontSize: "12px", fontFamily: "monospace", color: "#88ff88",
        backgroundColor: "#1a2e1a", padding: { x: 6, y: 3 },
      }).setOrigin(0.5, 0.5).setInteractive({ useHandCursor: true });
      confirmBtn.on("pointerover", () => confirmBtn.setColor("#ffd700"));
      confirmBtn.on("pointerout", () => confirmBtn.setColor("#88ff88"));
      confirmBtn.on("pointerdown", () => {
        this.statOverlay?.destroy();
        this.statOverlay = null;
      });
      this.statOverlay.add(confirmBtn);

      const hint = this.scene.add.text(px + panelW / 2, py + panelH - 10,
        "All points allocated!", {
          fontSize: "9px", fontFamily: "monospace", color: "#666",
        }).setOrigin(0.5, 1);
      this.statOverlay.add(hint);
    } else {
      const hint = this.scene.add.text(px + panelW / 2, py + panelH - 10,
        "Click [+] to allocate", {
          fontSize: "10px", fontFamily: "monospace", color: "#666",
        }).setOrigin(0.5, 1);
      this.statOverlay.add(hint);
    }
  }

  // ── Inn Confirmation Overlay ───────────────────────────────────────

  /** Show the inn rest confirmation with Sleep/Wait/Cancel options. */
  showInnConfirmation(player: PlayerState): void {
    if (this.innConfirmOverlay) return;
    const innCost = getInnCost(player.position.cityId);
    const container = this.scene.add.container(0, 0).setDepth(55);
    const boxW = 280;
    const boxH = 120;
    const boxX = (MAP_WIDTH * TILE_SIZE - boxW) / 2;
    const boxY = (MAP_HEIGHT * TILE_SIZE - boxH) / 2;

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.97);
    bg.fillRoundedRect(boxX, boxY, boxW, boxH, 8);
    bg.lineStyle(2, 0xc0a060, 1);
    bg.strokeRoundedRect(boxX, boxY, boxW, boxH, 8);
    container.add(bg);

    const prompt = this.scene.add.text(boxX + boxW / 2, boxY + 10, `Rest at the inn for ${innCost}g?`, {
      fontSize: "12px", fontFamily: "monospace", color: "#ffd700",
    }).setOrigin(0.5, 0);
    container.add(prompt);

    const DAWN_STEP = 0;
    const NIGHT_STEP = 265;

    const sleepBtn = this.scene.add.text(boxX + boxW / 2, boxY + 32, "🌅 Sleep Until Morning", {
      fontSize: "12px", fontFamily: "monospace", color: "#88ff88",
      backgroundColor: "#2a2a4e", padding: { x: 10, y: 4 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    sleepBtn.on("pointerover", () => sleepBtn.setColor("#ffd700"));
    sleepBtn.on("pointerout", () => sleepBtn.setColor("#88ff88"));
    sleepBtn.on("pointerdown", () => {
      const timeStep = this.callbacks.getTimeStep();
      const currentCycle = Math.floor(timeStep / CYCLE_LENGTH);
      const targetStep = (currentCycle + 1) * CYCLE_LENGTH + DAWN_STEP;
      this.executeInnRest(player, targetStep, "You sleep soundly at the inn. Good morning! HP and MP restored.");
    });
    container.add(sleepBtn);

    const waitBtn = this.scene.add.text(boxX + boxW / 2, boxY + 58, "🌙 Wait Until Night", {
      fontSize: "12px", fontFamily: "monospace", color: "#aaaaff",
      backgroundColor: "#2a2a4e", padding: { x: 10, y: 4 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    waitBtn.on("pointerover", () => waitBtn.setColor("#ffd700"));
    waitBtn.on("pointerout", () => waitBtn.setColor("#aaaaff"));
    waitBtn.on("pointerdown", () => {
      const timeStep = this.callbacks.getTimeStep();
      const currentPos = ((timeStep % CYCLE_LENGTH) + CYCLE_LENGTH) % CYCLE_LENGTH;
      const currentCycle = Math.floor(timeStep / CYCLE_LENGTH);
      const targetStep = currentPos < NIGHT_STEP
        ? currentCycle * CYCLE_LENGTH + NIGHT_STEP
        : (currentCycle + 1) * CYCLE_LENGTH + NIGHT_STEP;
      this.executeInnRest(player, targetStep, "You rest at the inn and wait for nightfall. HP and MP restored.");
    });
    container.add(waitBtn);

    const cancelBtn = this.scene.add.text(boxX + boxW / 2, boxY + 86, "Cancel", {
      fontSize: "12px", fontFamily: "monospace", color: "#ff8888",
      backgroundColor: "#2a2a4e", padding: { x: 12, y: 4 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    cancelBtn.on("pointerover", () => cancelBtn.setColor("#ffd700"));
    cancelBtn.on("pointerout", () => cancelBtn.setColor("#ff8888"));
    cancelBtn.on("pointerdown", () => this.dismissInnConfirmation());
    container.add(cancelBtn);

    this.innConfirmOverlay = container;
  }

  /** Execute inn rest: deduct gold, heal, advance time, process level-ups. */
  private executeInnRest(player: PlayerState, targetTimeStep: number, message: string): void {
    this.dismissInnConfirmation();
    const innCost = getInnCost(player.position.cityId);
    if (player.gold < innCost) {
      this.callbacks.showMessage(`Not enough gold to rest! (Need ${innCost}g)`, "#ff6666");
      return;
    }

    this.scene.cameras.main.fadeOut(800, 0, 0, 0);
    this.scene.cameras.main.once("camerafadeoutcomplete", () => {
      player.gold -= innCost;
      player.hp = player.maxHp;
      player.mp = player.maxMp;
      player.shortRestsRemaining = 2;
      this.callbacks.setTimeStep(targetTimeStep);

      const levelResult = processPendingLevelUps(player);
      let fullMsg = message;
      if (levelResult.leveledUp) {
        fullMsg += ` 🎉 LEVEL UP to ${levelResult.newLevel}!`;
        for (const spell of levelResult.newSpells) {
          fullMsg += ` ✦ Learned ${spell.name}!`;
        }
        for (const ability of levelResult.newAbilities) {
          fullMsg += ` ⚡ Learned ${ability.name}!`;
        }
        if (levelResult.asiGained > 0) {
          fullMsg += ` ★ +${levelResult.asiGained} stat points!`;
        }
      }

      this.callbacks.applyDayNightTint();
      this.callbacks.respawnCityNpcs();
      this.callbacks.updateHUD();
      this.callbacks.autoSave();

      this.scene.cameras.main.fadeIn(800, 0, 0, 0);
      this.callbacks.showMessage(fullMsg, "#88ff88");

      if (levelResult.asiGained > 0 || player.pendingStatPoints > 0) {
        this.scene.time.delayedCall(1200, () => this.showStatOverlay(player));
      }
    });
  }

  /** Dismiss inn confirmation overlay. */
  dismissInnConfirmation(): void {
    if (this.innConfirmOverlay) {
      this.innConfirmOverlay.destroy();
      this.innConfirmOverlay = null;
    }
  }

  // ── Town Picker Overlay ────────────────────────────────────────────

  /** Show a town picker for fast travel / teleport. */
  showTownPicker(player: PlayerState): void {
    if (this.townPickerOverlay) return;

    const w = MAP_WIDTH * TILE_SIZE;
    const h = MAP_HEIGHT * TILE_SIZE;

    const visitedCityIds = new Set<string>();
    for (const key of Object.keys(player.progression.exploredTiles)) {
      if (key.startsWith("c:")) {
        const cityId = key.split(",")[0].substring(2);
        visitedCityIds.add(cityId);
      }
    }

    const visitedCities = CITIES.filter((c) => visitedCityIds.has(c.id));

    const container = this.scene.add.container(0, 0).setDepth(56);

    const dim = this.scene.add.graphics();
    dim.fillStyle(0x000000, 0.6);
    dim.fillRect(0, 0, w, h);
    dim.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    dim.on("pointerdown", () => this.dismissTownPicker());
    container.add(dim);

    const panelW = 240;
    const panelH = Math.min(60 + visitedCities.length * 22, h - 40);
    const px = (w - panelW) / 2;
    const py = (h - panelH) / 2;

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1a1a3e, 0.95);
    bg.fillRoundedRect(px, py, panelW, panelH, 8);
    bg.lineStyle(2, 0xffd700, 1);
    bg.strokeRoundedRect(px, py, panelW, panelH, 8);
    container.add(bg);

    const title = this.scene.add.text(px + panelW / 2, py + 10, "🗺 Travel to...", {
      fontSize: "13px", fontFamily: "monospace", color: "#ffd700",
    }).setOrigin(0.5, 0);
    container.add(title);

    if (visitedCities.length === 0) {
      const noTowns = this.scene.add.text(px + panelW / 2, py + 36, "No towns visited yet!", {
        fontSize: "11px", fontFamily: "monospace", color: "#ff8888",
      }).setOrigin(0.5, 0);
      container.add(noTowns);
    } else {
      let cy = py + 34;
      for (const city of visitedCities) {
        const isCurrent = player.position.inCity && player.position.cityId === city.id;
        const isCurrentChunk = !player.position.inCity && !player.position.inDungeon
          && player.position.chunkX === city.chunkX && player.position.chunkY === city.chunkY
          && player.position.x === city.tileX && player.position.y === city.tileY;
        const here = isCurrent || isCurrentChunk;
        const color = here ? "#666" : "#ccffcc";
        const label = here ? `${city.name} (here)` : city.name;
        const btn = this.scene.add.text(px + panelW / 2, cy, label, {
          fontSize: "11px", fontFamily: "monospace", color,
        }).setOrigin(0.5, 0).setInteractive({ useHandCursor: !here });

        if (!here) {
          btn.on("pointerover", () => btn.setColor("#ffd700"));
          btn.on("pointerout", () => btn.setColor(color));
          btn.on("pointerdown", () => {
            player.mp -= this.pendingTeleportCost;
            player.position.chunkX = city.chunkX;
            player.position.chunkY = city.chunkY;
            player.position.x = city.tileX;
            player.position.y = city.tileY;
            if (player.position.inDungeon) { player.position.inDungeon = false; player.position.dungeonId = ""; }
            if (player.position.inCity) { player.position.inCity = false; player.position.cityId = ""; }
            this.dismissTownPicker();
            audioEngine.playTeleportSFX();
            this.callbacks.showMessage(`Teleported to ${city.name}!`, "#88ff88");
            this.callbacks.renderMap();
            this.callbacks.applyDayNightTint();
            this.callbacks.createPlayer();
            this.callbacks.updateHUD();
            this.callbacks.autoSave();
          });
        }
        container.add(btn);
        cy += 20;
      }
    }

    const hint = this.scene.add.text(px + panelW / 2, py + panelH - 14, "Click outside to cancel", {
      fontSize: "9px", fontFamily: "monospace", color: "#666",
    }).setOrigin(0.5, 1);
    container.add(hint);

    this.townPickerOverlay = container;
  }

  /** Dismiss the town picker overlay. */
  dismissTownPicker(): void {
    if (this.townPickerOverlay) {
      this.townPickerOverlay.destroy();
      this.townPickerOverlay = null;
    }
    this.pendingTeleportCost = 0;
  }

  // ── Bank Overlay ───────────────────────────────────────────────────

  /** Show the bank deposit/withdraw overlay. */
  showBankOverlay(player: PlayerState): void {
    if (this.bankOverlay) return;

    const currentDay = Math.floor(this.callbacks.getTimeStep() / CYCLE_LENGTH);
    const interest = applyBankInterest(player, currentDay);

    const container = this.scene.add.container(0, 0).setDepth(55);
    const boxW = 280;
    const boxH = 200;
    const boxX = (MAP_WIDTH * TILE_SIZE - boxW) / 2;
    const boxY = (MAP_HEIGHT * TILE_SIZE - boxH) / 2;

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.97);
    bg.fillRoundedRect(boxX, boxY, boxW, boxH, 8);
    bg.lineStyle(2, 0xc0a060, 1);
    bg.strokeRoundedRect(boxX, boxY, boxW, boxH, 8);
    container.add(bg);

    const bankTitle = this.scene.add.text(boxX + boxW / 2, boxY + 12, "🏦 Bank", {
      fontSize: "14px", fontFamily: "monospace", color: "#ffd700",
    }).setOrigin(0.5, 0).setDepth(56);
    container.add(bankTitle);

    let statusText = `Balance: ${player.bankBalance}g  |  Gold: ${player.gold}g`;
    if (interest > 0) {
      statusText += `\n+${interest}g interest earned!`;
    }
    statusText += "\n2% daily interest on deposits";

    const info = this.scene.add.text(boxX + boxW / 2, boxY + 34, statusText, {
      fontSize: "10px", fontFamily: "monospace", color: "#ccc", align: "center", lineSpacing: 3,
    }).setOrigin(0.5, 0);
    container.add(info);

    // Deposit row
    const row1Y = boxY + 90;
    const depositBtn = this.scene.add.text(boxX + boxW / 2 - 70, row1Y, "Deposit 10g", {
      fontSize: "12px", fontFamily: "monospace", color: "#88ff88",
      backgroundColor: "#2a2a4e", padding: { x: 6, y: 4 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    depositBtn.on("pointerover", () => depositBtn.setColor("#ffd700"));
    depositBtn.on("pointerout", () => depositBtn.setColor("#88ff88"));
    depositBtn.on("pointerdown", () => {
      const amount = Math.min(10, player.gold);
      if (amount > 0) {
        player.gold -= amount;
        player.bankBalance += amount;
        if (player.lastBankDay === 0) player.lastBankDay = currentDay;
        this.dismissBankOverlay();
        this.showBankOverlay(player);
        this.callbacks.updateHUD();
        this.callbacks.autoSave();
      }
    });
    container.add(depositBtn);

    const depositAllBtn = this.scene.add.text(boxX + boxW / 2 + 70, row1Y, "Deposit All", {
      fontSize: "12px", fontFamily: "monospace", color: "#66dd66",
      backgroundColor: "#2a2a4e", padding: { x: 6, y: 4 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    depositAllBtn.on("pointerover", () => depositAllBtn.setColor("#ffd700"));
    depositAllBtn.on("pointerout", () => depositAllBtn.setColor("#66dd66"));
    depositAllBtn.on("pointerdown", () => {
      if (player.gold > 0) {
        player.bankBalance += player.gold;
        player.gold = 0;
        if (player.lastBankDay === 0) player.lastBankDay = currentDay;
        this.dismissBankOverlay();
        this.showBankOverlay(player);
        this.callbacks.updateHUD();
        this.callbacks.autoSave();
      }
    });
    container.add(depositAllBtn);

    // Withdraw row
    const row2Y = row1Y + 30;
    const withdrawBtn = this.scene.add.text(boxX + boxW / 2 - 70, row2Y, "Withdraw 10g", {
      fontSize: "12px", fontFamily: "monospace", color: "#ffaa66",
      backgroundColor: "#2a2a4e", padding: { x: 6, y: 4 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    withdrawBtn.on("pointerover", () => withdrawBtn.setColor("#ffd700"));
    withdrawBtn.on("pointerout", () => withdrawBtn.setColor("#ffaa66"));
    withdrawBtn.on("pointerdown", () => {
      const amount = Math.min(10, player.bankBalance);
      if (amount > 0) {
        player.bankBalance -= amount;
        player.gold += amount;
        this.dismissBankOverlay();
        this.showBankOverlay(player);
        this.callbacks.updateHUD();
        this.callbacks.autoSave();
      }
    });
    container.add(withdrawBtn);

    const withdrawAllBtn = this.scene.add.text(boxX + boxW / 2 + 70, row2Y, "Withdraw All", {
      fontSize: "12px", fontFamily: "monospace", color: "#dd8844",
      backgroundColor: "#2a2a4e", padding: { x: 6, y: 4 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    withdrawAllBtn.on("pointerover", () => withdrawAllBtn.setColor("#ffd700"));
    withdrawAllBtn.on("pointerout", () => withdrawAllBtn.setColor("#dd8844"));
    withdrawAllBtn.on("pointerdown", () => {
      if (player.bankBalance > 0) {
        player.gold += player.bankBalance;
        player.bankBalance = 0;
        this.dismissBankOverlay();
        this.showBankOverlay(player);
        this.callbacks.updateHUD();
        this.callbacks.autoSave();
      }
    });
    container.add(withdrawAllBtn);

    // Close button
    const closeBtn = this.scene.add.text(boxX + boxW / 2, row2Y + 34, "Close", {
      fontSize: "12px", fontFamily: "monospace", color: "#ff8888",
      backgroundColor: "#2a2a4e", padding: { x: 12, y: 4 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    closeBtn.on("pointerover", () => closeBtn.setColor("#ffd700"));
    closeBtn.on("pointerout", () => closeBtn.setColor("#ff8888"));
    closeBtn.on("pointerdown", () => this.dismissBankOverlay());
    container.add(closeBtn);

    this.bankOverlay = container;
  }

  /** Dismiss bank overlay. */
  dismissBankOverlay(): void {
    if (this.bankOverlay) {
      this.bankOverlay.destroy();
      this.bankOverlay = null;
    }
  }

  // ── World Map Overlay ──────────────────────────────────────────────

  /** Toggle the world map overlay. */
  toggleWorldMap(player: PlayerState, defeatedBosses: Set<string>): void {
    if (this.worldMapOverlay) {
      this.worldMapOverlay.destroy();
      this.worldMapOverlay = null;
      this.scene.input.off("wheel");
      this.scene.input.off("pointermove");
      this.scene.input.off("pointerup");
      return;
    }
    this.showWorldMap(player, defeatedBosses);
  }

  /** Refresh the world map overlay if currently open. */
  refreshWorldMap(player: PlayerState, defeatedBosses: Set<string>): void {
    if (!this.worldMapOverlay) return;
    this.worldMapOverlay.destroy();
    this.worldMapOverlay = null;
    this.scene.input.off("wheel");
    this.scene.input.off("pointermove");
    this.scene.input.off("pointerup");
    this.showWorldMap(player, defeatedBosses);
  }

  /** Show the zoomable, pannable world map with overview and detail views. */
  showWorldMap(player: PlayerState, defeatedBosses: Set<string>): void {
    if (this.equipOverlay) { this.equipOverlay.destroy(); this.equipOverlay = null; }
    if (this.statOverlay) { this.statOverlay.destroy(); this.statOverlay = null; }
    if (this.menuOverlay) { this.menuOverlay.destroy(); this.menuOverlay = null; }

    const w = this.scene.cameras.main.width;
    const h = this.scene.cameras.main.height;

    this.worldMapOverlay = this.scene.add.container(0, 0).setDepth(80);

    const dim = this.scene.add.graphics();
    dim.fillStyle(0x000000, 0.6);
    dim.fillRect(0, 0, w, h);
    dim.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    dim.on("pointerdown", () => this.toggleWorldMap(player, defeatedBosses));
    this.worldMapOverlay.add(dim);

    const panelPad = 12;
    const titleH = 28;
    const legendH = 36;
    const panelW = w - 20;
    const panelH = h - 20;
    const px = 10;
    const py = 10;

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.95);
    bg.fillRect(px, py, panelW, panelH);
    bg.lineStyle(2, 0xffd700, 1);
    bg.strokeRect(px, py, panelW, panelH);
    bg.setInteractive(new Phaser.Geom.Rectangle(px, py, panelW, panelH), Phaser.Geom.Rectangle.Contains);
    this.worldMapOverlay.add(bg);

    const title = this.scene.add.text(px + panelW / 2, py + 6, "🗺 World Map", {
      fontSize: "14px", fontFamily: "monospace", color: "#ffd700",
    }).setOrigin(0.5, 0);
    this.worldMapOverlay.add(title);

    const contentX = px + panelPad;
    const contentY = py + titleH + panelPad;
    const contentW = panelW - panelPad * 2;
    const contentH = panelH - titleH - panelPad * 2 - legendH;

    const mapContainer = this.scene.add.container(0, 0);
    this.worldMapOverlay.add(mapContainer);

    const maskShape = this.scene.make.graphics({ x: 0, y: 0 });
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(contentX, contentY, contentW, contentH);
    const mask = maskShape.createGeometryMask();
    mapContainer.setMask(mask);

    let zoomLevel = 1;
    const minZoom = 0.5;
    const maxZoom = 3;
    let panX = 0;
    let panY = 0;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let panStartX = 0;
    let panStartY = 0;
    let detailChunk: { cx: number; cy: number } | null = null;

    const baseTilePixel = 4;
    const gap = 3;

    const redraw = (): void => {
      mapContainer.removeAll(true);

      if (detailChunk) {
        const { cx: dcx, cy: dcy } = detailChunk;
        const chunk = getChunk(dcx, dcy);
        if (!chunk) return;

        const detailTile = Math.min(
          Math.floor(contentW / MAP_WIDTH),
          Math.floor(contentH / MAP_HEIGHT),
        );
        const mapW = MAP_WIDTH * detailTile;
        const mapH = MAP_HEIGHT * detailTile;
        const ox = contentX + Math.floor((contentW - mapW) / 2);
        const oy = contentY + Math.floor((contentH - mapH) / 2);

        const gfx = this.scene.add.graphics();
        for (let ty = 0; ty < MAP_HEIGHT; ty++) {
          for (let tx = 0; tx < MAP_WIDTH; tx++) {
            const terrain = chunk.mapData[ty][tx];
            const exploredKey = `${dcx},${dcy},${tx},${ty}`;
            const explored = !!player.progression.exploredTiles[exploredKey];
            const color = explored ? TERRAIN_COLORS[terrain] : 0x0a0a0a;
            gfx.fillStyle(color, 1);
            gfx.fillRect(ox + tx * detailTile, oy + ty * detailTile, detailTile, detailTile);
            if (detailTile >= 6) {
              gfx.lineStyle(1, 0x000000, 0.15);
              gfx.strokeRect(ox + tx * detailTile, oy + ty * detailTile, detailTile, detailTile);
            }
          }
        }
        mapContainer.add(gfx);

        for (const town of chunk.towns) {
          const eKey = `${dcx},${dcy},${town.x},${town.y}`;
          if (!player.progression.exploredTiles[eKey]) continue;
          const mx = ox + town.x * detailTile + detailTile / 2;
          const my = oy + town.y * detailTile + detailTile / 2;
          const marker = this.scene.add.graphics();
          marker.fillStyle(0xab47bc, 1);
          marker.fillCircle(mx, my, Math.max(4, detailTile / 3));
          mapContainer.add(marker);
          const label = this.scene.add.text(mx, my - detailTile / 2 - 2, town.name, {
            fontSize: "9px", fontFamily: "monospace", color: "#fff",
            stroke: "#000", strokeThickness: 2,
          }).setOrigin(0.5, 1);
          mapContainer.add(label);
        }

        for (const boss of chunk.bosses) {
          const eKey = `${dcx},${dcy},${boss.x},${boss.y}`;
          if (!player.progression.exploredTiles[eKey]) continue;
          if (defeatedBosses.has(boss.monsterId)) continue;
          const mx = ox + boss.x * detailTile + detailTile / 2;
          const my = oy + boss.y * detailTile + detailTile / 2;
          const marker = this.scene.add.graphics();
          marker.fillStyle(0xff0000, 1);
          marker.fillCircle(mx, my, Math.max(4, detailTile / 3));
          marker.lineStyle(1, 0xffffff, 1);
          marker.strokeCircle(mx, my, Math.max(4, detailTile / 3));
          mapContainer.add(marker);
          const label = this.scene.add.text(mx, my - detailTile / 2 - 2, "☠ " + boss.name, {
            fontSize: "8px", fontFamily: "monospace", color: "#ff4444",
            stroke: "#000", strokeThickness: 2,
          }).setOrigin(0.5, 1);
          mapContainer.add(label);
        }

        if (dcx === player.position.chunkX && dcy === player.position.chunkY) {
          const pmx = ox + player.position.x * detailTile + detailTile / 2;
          const pmy = oy + player.position.y * detailTile + detailTile / 2;
          const pm = this.scene.add.graphics();
          pm.fillStyle(0x00ff00, 1);
          pm.fillCircle(pmx, pmy, Math.max(4, detailTile / 3));
          pm.lineStyle(1, 0xffffff, 1);
          pm.strokeCircle(pmx, pmy, Math.max(4, detailTile / 3));
          mapContainer.add(pm);
        }

        const back = this.scene.add.text(contentX + 4, contentY + 4, "◀ Back to World", {
          fontSize: "11px", fontFamily: "monospace", color: "#88ff88",
          backgroundColor: "#1a1a2e", padding: { x: 6, y: 3 },
        }).setOrigin(0, 0).setInteractive({ useHandCursor: true });
        back.on("pointerover", () => back.setColor("#ffd700"));
        back.on("pointerout", () => back.setColor("#88ff88"));
        back.on("pointerdown", () => { detailChunk = null; redraw(); });
        mapContainer.add(back);

        return;
      }

      // Overview
      const tp = baseTilePixel * zoomLevel;
      const chunkW = MAP_WIDTH * tp;
      const chunkH = MAP_HEIGHT * tp;
      const gapZ = gap * zoomLevel;
      const gridW = WORLD_WIDTH * chunkW + (WORLD_WIDTH - 1) * gapZ;
      const gridH = WORLD_HEIGHT * chunkH + (WORLD_HEIGHT - 1) * gapZ;

      const baseX = contentX + (contentW - gridW) / 2 + panX;
      const baseY = contentY + (contentH - gridH) / 2 + panY;

      for (let cy = 0; cy < WORLD_HEIGHT; cy++) {
        for (let cx = 0; cx < WORLD_WIDTH; cx++) {
          const chunk = getChunk(cx, cy);
          if (!chunk) continue;

          const ox = baseX + cx * (chunkW + gapZ);
          const oy = baseY + cy * (chunkH + gapZ);

          const miniGfx = this.scene.add.graphics();
          let hasExplored = false;
          for (let ty = 0; ty < MAP_HEIGHT; ty++) {
            for (let tx = 0; tx < MAP_WIDTH; tx++) {
              const terrain = chunk.mapData[ty][tx];
              const exploredKey = `${cx},${cy},${tx},${ty}`;
              const explored = !!player.progression.exploredTiles[exploredKey];
              if (explored) hasExplored = true;
              let color: number;
              if (!explored) {
                color = 0x0a0a0a;
              } else if (hasSparkleAt(cx, cy, tx, ty) && !player.progression.collectedTreasures.includes(exploredKey)) {
                color = TERRAIN_COLORS[Terrain.MinorTreasure];
              } else {
                color = TERRAIN_COLORS[terrain];
              }
              miniGfx.fillStyle(color, 1);
              miniGfx.fillRect(ox + tx * tp, oy + ty * tp, tp, tp);
            }
          }
          mapContainer.add(miniGfx);

          const border = this.scene.add.graphics();
          const isCurrent = cx === player.position.chunkX && cy === player.position.chunkY;
          border.lineStyle(isCurrent ? 2 : 1, isCurrent ? 0xffd700 : 0x333333, 1);
          border.strokeRect(ox, oy, chunkW, chunkH);
          mapContainer.add(border);

          const clickZone = this.scene.add.zone(ox + chunkW / 2, oy + chunkH / 2, chunkW, chunkH)
            .setInteractive({ useHandCursor: true });
          clickZone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
            if (pointer.getDistance() < 5) {
              detailChunk = { cx, cy };
              redraw();
            }
          });
          mapContainer.add(clickZone);

          for (const town of chunk.towns) {
            const tKey = `${cx},${cy},${town.x},${town.y}`;
            if (!player.progression.exploredTiles[tKey]) continue;
            const mx = ox + town.x * tp + tp / 2;
            const my = oy + town.y * tp + tp / 2;
            const m = this.scene.add.graphics();
            m.fillStyle(0xab47bc, 1);
            m.fillCircle(mx, my, Math.max(2, 3 * zoomLevel));
            mapContainer.add(m);
          }

          for (const boss of chunk.bosses) {
            const bKey = `${cx},${cy},${boss.x},${boss.y}`;
            if (!player.progression.exploredTiles[bKey] || defeatedBosses.has(boss.monsterId)) continue;
            const mx = ox + boss.x * tp + tp / 2;
            const my = oy + boss.y * tp + tp / 2;
            const m = this.scene.add.graphics();
            m.fillStyle(0xff0000, 1);
            m.fillCircle(mx, my, Math.max(2, 3 * zoomLevel));
            m.lineStyle(1, 0xffffff, 1);
            m.strokeCircle(mx, my, Math.max(2, 3 * zoomLevel));
            mapContainer.add(m);
          }

          if (isCurrent) {
            const pmx = ox + player.position.x * tp + tp / 2;
            const pmy = oy + player.position.y * tp + tp / 2;
            const pm = this.scene.add.graphics();
            pm.fillStyle(0x00ff00, 1);
            pm.fillCircle(pmx, pmy, Math.max(2, 3 * zoomLevel));
            pm.lineStyle(1, 0xffffff, 1);
            pm.strokeCircle(pmx, pmy, Math.max(2, 3 * zoomLevel));
            mapContainer.add(pm);
          }
        }
      }
    };

    redraw();

    // Mouse wheel zoom
    this.scene.input.on("wheel", (_pointer: Phaser.Input.Pointer, _gameObjects: Phaser.GameObjects.GameObject[], _deltaX: number, deltaY: number) => {
      if (!this.worldMapOverlay || detailChunk) return;
      const oldZoom = zoomLevel;
      zoomLevel = Phaser.Math.Clamp(zoomLevel - deltaY * 0.001, minZoom, maxZoom);
      if (zoomLevel !== oldZoom) {
        panX = panX * (zoomLevel / oldZoom);
        panY = panY * (zoomLevel / oldZoom);
        redraw();
      }
    });

    // Drag to pan
    bg.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (detailChunk) return;
      isDragging = true;
      dragStartX = pointer.x;
      dragStartY = pointer.y;
      panStartX = panX;
      panStartY = panY;
    });
    this.scene.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!isDragging || !this.worldMapOverlay) return;
      panX = panStartX + (pointer.x - dragStartX);
      panY = panStartY + (pointer.y - dragStartY);
      redraw();
    });
    this.scene.input.on("pointerup", () => { isDragging = false; });

    // Legend
    const legendY = py + panelH - legendH + 4;
    const legendParts: { text: string; color: string }[] = [
      { text: "● ", color: "#00ff00" }, { text: "You  ", color: "#aaa" },
      { text: "● ", color: "#ff4444" }, { text: "Boss  ", color: "#aaa" },
      { text: "● ", color: "#ab47bc" }, { text: "Town  ", color: "#aaa" },
      { text: "|  Scroll to zoom · Drag to pan · Click chunk for detail  |  N to close", color: "#aaa" },
    ];
    let legendCursorX = 0;
    const legendContainer = this.scene.add.container(0, legendY);
    for (const part of legendParts) {
      const t = this.scene.add.text(legendCursorX, 0, part.text, {
        fontSize: "10px", fontFamily: "monospace", color: part.color,
      });
      legendContainer.add(t);
      legendCursorX += t.width;
    }
    legendContainer.setX(px + panelW / 2 - legendCursorX / 2);
    this.worldMapOverlay.add(legendContainer);

    // Zoom controls
    const zoomIn = this.scene.add.text(px + panelW - panelPad - 40, legendY,
      "[+]", { fontSize: "12px", fontFamily: "monospace", color: "#88ff88" })
      .setOrigin(0, 0).setInteractive({ useHandCursor: true });
    zoomIn.on("pointerdown", () => {
      if (detailChunk) return;
      zoomLevel = Phaser.Math.Clamp(zoomLevel + 0.3, minZoom, maxZoom);
      redraw();
    });
    this.worldMapOverlay.add(zoomIn);

    const zoomOut = this.scene.add.text(px + panelW - panelPad - 20, legendY,
      "[-]", { fontSize: "12px", fontFamily: "monospace", color: "#88ff88" })
      .setOrigin(0, 0).setInteractive({ useHandCursor: true });
    zoomOut.on("pointerdown", () => {
      if (detailChunk) return;
      zoomLevel = Phaser.Math.Clamp(zoomLevel - 0.3, minZoom, maxZoom);
      redraw();
    });
    this.worldMapOverlay.add(zoomOut);
  }
}
