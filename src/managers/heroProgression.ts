import * as Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import {
  MAX_ABILITY_SCORE,
  PROGRESSION_PROFILES,
  STAT_KEYS,
  getProgressionProfile,
  type ProgressionTrackId,
} from "../data/classProgression";
import { getAbility } from "../data/abilities";
import { getSpell } from "../data/spells";
import { getTalent } from "../data/talents";
import { gamePreferences } from "../systems/accessibility";
import {
  commitHeroLevelUp,
  getActorStartingClass,
  getFeatureSources,
  getProficiencyBonus,
  getTrackLevel,
  prepareNextHeroLevelUp,
  previewHeroLevelUp,
  qualifyNextClass,
  type HeroLevelUpPreview,
} from "../systems/classProgression";
import { abilityModifier } from "../systems/dice";
import { paginateMeasuredItems, wrapMeasuredText, type LayoutRect } from "../systems/layout";
import { allocateStatPoint, getArmorClass, getAttackModifier, type PlayerState, type PlayerStats } from "../systems/player";
import { layoutProgressionPanel, type ProgressionPanelLayout } from "../systems/progressionPresentation";
import { createDimGraphics, createOverlayContainer, createPanelGraphics } from "../utils/ui";
import { syncInteractiveHitArea } from "./layout";

type ProgressionMode = "sheet" | "level" | "stats" | "result";
const STAT_LABELS = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

export interface HeroProgressionCallbacks {
  autoSave(): void;
  updateHUD(): void;
  showMessage(message: string, color?: string): void;
  isInputBlocked(): boolean;
}

interface ConfirmationSnapshot {
  mode: ProgressionMode;
  level: number;
  trackId: ProgressionTrackId;
  statIndex: number;
  points: number;
}

export class HeroProgressionManager {
  private container: Phaser.GameObjects.Container | null = null;
  private player: PlayerState | null = null;
  private mode: ProgressionMode = "sheet";
  private selectedTrackId: ProgressionTrackId = "knight";
  private selectedStatIndex = 0;
  private layout: ProgressionPanelLayout | null = null;
  private detailPage = 0;
  private detailPageCount = 1;
  private receipt: HeroLevelUpPreview | null = null;
  private confirmation: ConfirmationSnapshot | null = null;
  private cancelling = false;
  private unsubscribe: (() => void) | null = null;
  private liveRegion: HTMLDivElement | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly callbacks: HeroProgressionCallbacks,
  ) {}

  isOpen(): boolean {
    return this.container !== null;
  }

  getDebugState(): string {
    const player = this.player;
    if (!player || !this.container) return "";
    const preview = this.mode === "level" ? previewHeroLevelUp(player, this.selectedTrackId) : null;
    const growth = preview?.ok ? ` HP:${preview.preview.hpGain} MP:${preview.preview.mpGain}` : "";
    return ` [PROGRESSION:${this.mode} Track:${this.selectedTrackId} Total:${player.level}`
      + ` Ready:${player.classProgression.readyLevelUps} Pending:${player.pendingLevelUps}`
      + ` Points:${player.pendingStatPoints} Stat:${STAT_KEYS[this.selectedStatIndex]}${growth}]`;
  }

  open(player: PlayerState, mode: "sheet" | "level" | "stats" = "sheet"): void {
    this.close();
    this.player = player;
    this.selectedTrackId = getActorStartingClass(player);
    this.selectedStatIndex = 0;
    this.mode = mode;
    if (mode === "sheet" && player.classProgression.readyLevelUps > 0) {
      if (this.prepareNext()) this.mode = "level";
    }
    this.scene.input.keyboard?.on("keydown", this.handleKeyDown);
    this.scene.input.keyboard?.on("keyup", this.handleKeyUp);
    this.scene.input.on("wheel", this.handleWheel);
    this.scene.scale.on("resize", this.render, this);
    window.addEventListener("blur", this.clearConfirmation, true);
    document.addEventListener("visibilitychange", this.clearConfirmation, true);
    this.unsubscribe = gamePreferences.subscribe(() => this.render());
    this.liveRegion = document.createElement("div");
    this.liveRegion.id = "hero-progression-live-region";
    this.liveRegion.setAttribute("role", "status");
    this.liveRegion.setAttribute("aria-live", "polite");
    Object.assign(this.liveRegion.style, {
      position: "absolute", width: "1px", height: "1px", overflow: "hidden",
      clipPath: "inset(50%)", whiteSpace: "nowrap",
    });
    document.body.append(this.liveRegion);
    this.render();
  }

  close(): void {
    this.scene.input.keyboard?.off("keydown", this.handleKeyDown);
    this.scene.input.keyboard?.off("keyup", this.handleKeyUp);
    this.scene.input.off("wheel", this.handleWheel);
    this.scene.scale.off("resize", this.render, this);
    window.removeEventListener("blur", this.clearConfirmation, true);
    document.removeEventListener("visibilitychange", this.clearConfirmation, true);
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.container?.destroy();
    this.container = null;
    this.player = null;
    this.receipt = null;
    this.confirmation = null;
    this.cancelling = false;
    this.detailPage = 0;
    this.layout = null;
    this.liveRegion?.remove();
    this.liveRegion = null;
  }

  private selectedIndex(): number {
    return this.mode === "stats" ? this.selectedStatIndex
      : Math.max(0, PROGRESSION_PROFILES.findIndex((profile) => profile.id === this.selectedTrackId));
  }

  private render(): void {
    const player = this.player;
    if (!player) return;
    this.container?.destroy();
    const viewport = { x: 16, y: 12, width: GAME_WIDTH - 32, height: GAME_HEIGHT - 24 };
    const container = createOverlayContainer(this.scene, "hero-progression", 70, viewport);
    this.container = container;
    const dim = createDimGraphics(this.scene, GAME_WIDTH, GAME_HEIGHT);
    dim.setInteractive(new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT), Phaser.Geom.Rectangle.Contains);
    container.add(dim);
    container.add(createPanelGraphics(this.scene, viewport.x, viewport.y, viewport.width, viewport.height));
    let y = viewport.y + 12;
    const title = this.mode === "stats" ? "Allocate ability scores"
      : this.mode === "level" ? "Level-up choice"
        : this.mode === "result" ? `Level ${player.level} committed` : "Hero progression";
    const header = this.addText("progression-title", viewport.x + 12, y, title, 16, viewport.width - 24, "#ffd700");
    y += header.displayHeight + 6;
    const owner = this.addText("progression-owner", viewport.x + 12, y,
      `Starting: ${getProgressionProfile(getActorStartingClass(player))?.label}`
        + `   Total: ${player.level}/20   Proficiency: +${getProficiencyBonus(player)}`,
      10, viewport.width - 24);
    y += owner.displayHeight + 6;
    const pending = this.addText("progression-pending", viewport.x + 12, y,
      `${player.classProgression.readyLevelUps} rested / ${player.pendingLevelUps} earned levels`
        + `; ${player.pendingStatPoints} stat points`,
      10, viewport.width - 24);
    y += pending.displayHeight;
    const hint = this.addText("progression-hint", 0, 0,
      "Up/down select; left/right pages; Enter confirms\nPgUp/PgDn details; Tab stats; Esc close",
      8, viewport.width - 24, "#b0bec5");
    const cssScale = Math.max(0.1, this.scene.game.canvas.clientWidth / GAME_WIDTH);
    const measuredButtonHeight = Math.max(34, Math.ceil(44 / cssScale), pending.displayHeight + 16);
    this.layout = layoutProgressionPanel({
      viewport, headerBottom: y, desiredButtonHeight: measuredButtonHeight,
      hintHeight: hint.displayHeight,
      itemCount: this.mode === "stats" ? STAT_KEYS.length : PROGRESSION_PROFILES.length,
      selectedIndex: this.selectedIndex(),
    });
    hint.setPosition(this.layout.hint.x, this.layout.hint.y);
    this.renderRows(player, this.layout);
    this.renderDetails(player, this.layout.details);
    this.renderControls(player, this.layout);
  }

  private renderRows(player: PlayerState, layout: ProgressionPanelLayout): void {
    const page = layout.pages[layout.selectedPage] ?? [];
    page.forEach((index, offset) => {
      const bounds = {
        x: layout.list.x, y: layout.list.y + offset * (layout.buttonHeight + 6),
        width: layout.list.width, height: layout.buttonHeight,
      };
      if (this.mode === "stats") {
        const stat = STAT_KEYS[index]!;
        const value = player.stats[stat];
        const available = player.pendingStatPoints > 0 && value < MAX_ABILITY_SCORE;
        const points = player.pendingStatPoints;
        this.addButton(`progression-stat-${stat}`, bounds,
          `${index === this.selectedStatIndex ? "> " : ""}${STAT_LABELS[index]} ${value} ${available ? "[+]" : "[-]"}`,
          () => {
            this.selectedStatIndex = index;
            this.allocate(stat, points);
          }, index === this.selectedStatIndex, true);
      } else {
        const profile = PROGRESSION_PROFILES[index]!;
        const qualification = qualifyNextClass(player, profile.id);
        this.addButton(`progression-track-${profile.id}`, bounds,
          `${profile.id === this.selectedTrackId ? "> " : ""}${profile.label}`
            + ` ${getTrackLevel(player, profile.id)}${qualification.qualified ? "" : " [X]"}`,
          () => {
            this.selectedTrackId = profile.id;
            this.detailPage = 0;
            this.render();
          }, profile.id === this.selectedTrackId, true);
      }
    });
  }

  private details(player: PlayerState): string {
    if (this.mode === "stats") {
      const stat = STAT_KEYS[this.selectedStatIndex]!;
      const value = player.stats[stat];
      const bonus = stat === "constitution" ? `+${player.level} max/current HP`
        : stat === "intelligence" ? `+${player.level} max/current MP` : "No direct HP/MP change";
      return `${STAT_LABELS[this.selectedStatIndex]} ${value} -> ${Math.min(MAX_ABILITY_SCORE, value + 1)}\n`
        + `Modifier ${abilityModifier(value)} -> ${abilityModifier(Math.min(MAX_ABILITY_SCORE, value + 1))}\n`
        + `${bonus}\nScore ceiling: ${MAX_ABILITY_SCORE}.\n`
        + "Allocation preserves the existing per-score-point retroactive growth.\n"
        + "Prepared level gains remain frozen.\nNo respec: spent points cannot be removed.";
    }
    if (this.mode === "result" && this.receipt) return this.formatPreview(this.receipt);
    const profile = getProgressionProfile(this.selectedTrackId);
    if (!profile) return "Unknown progression track.";
    if (this.mode === "level") {
      const result = previewHeroLevelUp(player, profile.id);
      return result.ok ? this.formatPreview(result.preview) : result.message;
    }
    const features = profile.grants.filter((grant) =>
      getFeatureSources(player, grant.kind, grant.id).some((source) => source.trackId === profile.id)
    ).map((grant) => {
      const name = grant.kind === "spell" ? getSpell(grant.id)?.name
        : grant.kind === "ability" ? getAbility(grant.id)?.name : getTalent(grant.id)?.name;
      return `${grant.kind}: ${name ?? grant.id}`;
    });
    return `HP ${player.hp}/${player.maxHp}; MP ${player.mp}/${player.maxMp}; AC ${getArmorClass(player)}\n`
      + `Weapon attack ${getAttackModifier(player) >= 0 ? "+" : ""}${getAttackModifier(player)}\n`
      + STAT_KEYS.map((stat, index) => `${STAT_LABELS[index]} ${player.stats[stat]}`).join("; ") + "\n"
      + `Gear: ${[player.equippedWeapon, player.equippedArmor, player.equippedShield, player.equippedOffHand]
        .map((item) => item?.name ?? "none").join("; ")}\n`
      + `${profile.label}: owned rank ${getTrackLevel(player, profile.id)}/${profile.maxRank}\n`
      + `HP die: d${profile.hpGrowth.hitDie}; shared MP: INT.\n`
      + `Casting stat: ${profile.primaryStat.toUpperCase()}.\n`
      + `${qualifyNextClass(player, profile.id).message}\n`
      + "ASIs and common talents use total level; class features use owned rank.\n"
      + "Equipment: weapons, armor and shields.\n"
      + `${features.length > 0 ? features.join("\n") : "No features earned in this class."}\n`
      + "Rest to advance earned levels. Starting boosts/equipment are never granted again.";
  }

  private formatPreview(preview: HeroLevelUpPreview): string {
    return `Total level ${preview.totalLevel}: ${preview.label} ${preview.trackLevel}\n`
      + `+${preview.hpGain} HP / +${preview.mpGain} MP (frozen)\n`
      + `Proficiency +${preview.proficiencyBonus}; ASI +${preview.asiGained}\n`
      + `Spells: ${preview.newSpells.map((spell) => spell.name).join(", ") || "none"}\n`
      + `Abilities: ${preview.newAbilities.map((ability) => ability.name).join(", ") || "none"}\n`
      + `Talents: ${preview.newTalents.map((talent) => talent.name).join(", ") || "none"}\n`
      + "Shared features apply once. One action and one bonus action remain unchanged.";
  }

  private renderDetails(player: PlayerState, bounds: LayoutRect): void {
    const content = this.details(player);
    const text = this.addText("progression-details", bounds.x, bounds.y, "Mg", 11, bounds.width);
    const singleHeight = text.displayHeight;
    text.setText("Mg\nMg");
    const lineHeight = text.displayHeight - singleHeight;
    text.style.syncFont(text.canvas, text.context);
    const lines = wrapMeasuredText(content, bounds.width,
      (value) => text.context.measureText(value).width);
    const pages = paginateMeasuredItems(lines.map(() => lineHeight), bounds.height);
    this.detailPageCount = Math.max(1, pages.length);
    this.detailPage = Math.min(this.detailPage, this.detailPageCount - 1);
    text.setText((pages[this.detailPage] ?? []).map((index) => lines[index]).join("\n"));
    if (this.liveRegion) {
      this.liveRegion.textContent = `${this.mode}. ${content} Details page ${this.detailPage + 1}/${this.detailPageCount}.`;
    }
  }

  private renderControls(player: PlayerState, layout: ProgressionPanelLayout): void {
    const controls: Array<{ id: string; label: string; activate(): void }> = [];
    if (layout.pages.length > 1) controls.push(
      { id: "previous", label: "Prev", activate: () => this.movePage(-1) },
      { id: "next", label: "Next", activate: () => this.movePage(1) },
    );
    if (this.detailPageCount > 1) controls.push({
      id: "details", label: "Details", activate: () => this.moveDetails(1),
    });
    if (this.mode !== "stats" && player.pendingStatPoints > 0) controls.push({
      id: "stats", label: "Stats", activate: () => { this.mode = "stats"; this.detailPage = 0; this.render(); },
    });
    controls.push({ id: "close", label: "Close", activate: () => this.close() });
    const gap = 6;
    const width = (layout.controls.width - gap * (controls.length - 1)) / controls.length;
    controls.forEach((control, index) => this.addButton(
      `progression-control-${control.id}`,
      { ...layout.controls, x: layout.controls.x + index * (width + gap), width },
      control.label, control.activate, false, true,
    ));
    const preview = this.mode === "level" ? previewHeroLevelUp(player, this.selectedTrackId) : null;
    const label = this.mode === "level" ? preview?.ok ? "Advance selected class" : "Requirements not met"
      : this.mode === "stats" ? player.pendingStatPoints > 0 ? "Allocate selected score" : "Continue"
        : this.mode === "result" ? player.pendingStatPoints > 0 ? "Allocate stats"
          : player.classProgression.readyLevelUps > 0 ? "Review next level" : "Done"
          : player.pendingStatPoints > 0 ? "Allocate stats" : "Done";
    const snapshot = this.snapshot(player);
    this.addButton("progression-primary", layout.primary, label,
      () => this.activate(snapshot), true, this.mode !== "level" || preview?.ok === true);
  }

  private addText(
    id: string, x: number, y: number, value: string, fontSize: number, width: number, color = "#dddddd",
  ): Phaser.GameObjects.Text {
    const text = this.scene.add.text(x, y, value, {
      fontSize: `${fontSize}px`, fontFamily: "monospace", color,
      wordWrap: { width }, lineSpacing: 4,
    });
    text.setData("layoutId", id);
    this.container?.add(text);
    return text;
  }

  private addButton(
    id: string, bounds: LayoutRect, label: string, activate: () => void, selected: boolean, enabled: boolean,
  ): void {
    const text = this.scene.add.text(bounds.x, bounds.y, label, {
      fontSize: "11px", fontFamily: "monospace", align: "center",
      color: enabled ? selected ? "#ffffff" : "#dde7f4" : "#b0bec5",
      backgroundColor: selected ? "#455a7a" : "#2a2a4e",
      wordWrap: { width: bounds.width - 8 },
    });
    const top = Math.max(0, (bounds.height - text.displayHeight) / 2);
    text.setPadding({ left: 4, right: 4, top, bottom: top });
    text.setFixedSize(bounds.width, bounds.height);
    text.setData("layoutId", id);
    if (enabled) {
      text.setInteractive({ useHandCursor: true });
      syncInteractiveHitArea(text);
      text.on("pointerdown", () => {
        if (!this.callbacks.isInputBlocked()) activate();
      });
    }
    this.container?.add(text);
  }

  private snapshot(player: PlayerState): ConfirmationSnapshot {
    return {
      mode: this.mode, level: player.level, trackId: this.selectedTrackId,
      statIndex: this.selectedStatIndex, points: player.pendingStatPoints,
    };
  }

  private activate(snapshot: ConfirmationSnapshot): void {
    const player = this.player;
    if (!player || this.callbacks.isInputBlocked() || snapshot.mode !== this.mode
      || snapshot.level !== player.level || snapshot.trackId !== this.selectedTrackId
      || snapshot.statIndex !== this.selectedStatIndex) return;
    if (this.mode === "level") {
      const result = commitHeroLevelUp(player, {
        trackId: snapshot.trackId, expectedTotalLevel: snapshot.level,
      });
      if (!result.ok) {
        this.callbacks.showMessage(result.message, "#ffaaaa");
        return;
      }
      this.receipt = result.receipt;
      this.mode = "result";
      this.callbacks.updateHUD();
      this.callbacks.autoSave();
      this.callbacks.showMessage(result.message, "#aaffaa");
      this.detailPage = 0;
      this.render();
    } else if (this.mode === "stats" && player.pendingStatPoints > 0) {
      this.allocate(STAT_KEYS[this.selectedStatIndex]!, snapshot.points);
    } else if (player.pendingStatPoints > 0) {
      this.mode = "stats";
      this.detailPage = 0;
      this.render();
    } else if (player.classProgression.readyLevelUps > 0 && this.prepareNext()) {
      this.mode = "level";
      this.detailPage = 0;
      this.render();
    } else {
      this.close();
    }
  }

  private allocate(stat: keyof PlayerStats, expectedPoints: number): void {
    const player = this.player;
    if (!player || player.pendingStatPoints !== expectedPoints) return;
    if (!allocateStatPoint(player, stat)) {
      this.callbacks.showMessage("No point is available, or this score is at its ceiling.", "#ffcc80");
      this.render();
      return;
    }
    this.callbacks.updateHUD();
    this.callbacks.autoSave();
    this.render();
  }

  private prepareNext(): boolean {
    const player = this.player;
    if (!player) return false;
    const result = prepareNextHeroLevelUp(player);
    if (!result.ok) {
      this.callbacks.showMessage(result.message, "#ffaaaa");
      return false;
    }
    this.callbacks.autoSave();
    return true;
  }

  private moveSelection(offset: number): void {
    const count = this.mode === "stats" ? STAT_KEYS.length : PROGRESSION_PROFILES.length;
    const next = (this.selectedIndex() + offset + count) % count;
    if (this.mode === "stats") this.selectedStatIndex = next;
    else this.selectedTrackId = PROGRESSION_PROFILES[next]!.id;
    this.detailPage = 0;
    this.render();
  }

  private movePage(offset: number): void {
    const layout = this.layout;
    if (!layout || layout.pages.length <= 1) return;
    const page = (layout.selectedPage + offset + layout.pages.length) % layout.pages.length;
    const next = layout.pages[page]?.[0];
    if (next === undefined) return;
    if (this.mode === "stats") this.selectedStatIndex = next;
    else this.selectedTrackId = PROGRESSION_PROFILES[next]!.id;
    this.detailPage = 0;
    this.render();
  }

  private moveDetails(offset: number): void {
    this.detailPage = (this.detailPage + offset + this.detailPageCount) % this.detailPageCount;
    this.render();
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.player || this.callbacks.isInputBlocked()) return;
    const key = event.key.toLowerCase();
    if (event.repeat && ["enter", " ", "escape", "tab"].includes(key)) return;
    if (key === "arrowup" || key === "w") this.moveSelection(-1);
    else if (key === "arrowdown" || key === "s") this.moveSelection(1);
    else if (key === "arrowleft" || key === "a") this.movePage(-1);
    else if (key === "arrowright" || key === "d") this.movePage(1);
    else if (key === "pageup") this.moveDetails(-1);
    else if (key === "pagedown") this.moveDetails(1);
    else if (key === "escape") this.cancelling = true;
    else if (key === "tab" && this.player.pendingStatPoints > 0) {
      this.mode = this.mode === "stats"
        ? this.player.classProgression.pendingLevel ? "level" : "sheet" : "stats";
      this.detailPage = 0;
      this.render();
    } else if (key === "enter" || key === " ") {
      this.confirmation = this.snapshot(this.player);
    } else return;
    event.preventDefault();
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && this.cancelling) {
      this.close();
      return;
    }
    if (event.key !== "Enter" && event.key !== " ") return;
    const confirmation = this.confirmation;
    this.confirmation = null;
    if (confirmation) this.activate(confirmation);
  };

  private readonly clearConfirmation = (): void => {
    this.confirmation = null;
    this.cancelling = false;
  };

  private readonly handleWheel = (
    _pointer: Phaser.Input.Pointer, _objects: Phaser.GameObjects.GameObject[],
    _deltaX: number, deltaY: number,
  ): void => {
    if (!this.player || this.callbacks.isInputBlocked() || deltaY === 0) return;
    this.moveDetails(deltaY > 0 ? 1 : -1);
  };
}
