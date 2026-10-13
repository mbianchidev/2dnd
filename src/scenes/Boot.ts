/**
 * Boot scene: generates all procedural assets and shows a title screen.
 */

import * as Phaser from "phaser";
import { installDicePresentation } from "../managers/dicePresentation";
import { generateAllTextures } from "../renderers/textures";
import { renderCharacterStatsPanel } from "../renderers/characterStats";
import { PLAYER_CLASSES, type PlayerClass } from "../systems/classes";
import type { CustomAppearance } from "../systems/appearance";
import { CharacterAppearanceManager, type CharacterCreationControlHandlers } from "../managers/characterAppearance";
import {
  getSaveSummary,
  hasSave,
  loadGame,
  saveGame,
  reportSaveFailure,
  type SaveActionResult,
  type SaveSlotId,
} from "../systems/save";
import { createCodex } from "../systems/codex";
import { createPlayer, type PlayerState, type PlayerStats, POINT_BUY_COSTS, POINT_BUY_TOTAL, calculatePointsSpent } from "../systems/player";
import { abilityModifier, rollAbilityScore } from "../systems/dice";
import { audioEngine } from "../systems/audio";
import { createWeatherState } from "../systems/weather";
import { SceneTransitionManager } from "../managers/sceneTransition";
import { debugPanelState } from "../config";
import { CAMPAIGN_EPILOGUE_CUTSCENE_ID } from "../data/cutscenes";
import {
  addSettingsControls,
  SETTINGS_PANEL_HEIGHT,
  SETTINGS_PANEL_WIDTH,
} from "../renderers/settings";
import {
  installSceneAccessibility,
  isReducedMotionEnabled,
} from "../systems/accessibility";
import {
  getNewGameCutsceneIds,
  getNextPendingCutscene,
  queueCutscenes,
} from "../systems/cutscenes";
import { openMobileTextInput } from "../managers/input";
import { FACE_BUTTON_ICONS, getInputPromptSource } from "../systems/input";
import { SaveSlotManager } from "../managers/saveSlots";
import { NewGamePlusManager } from "../managers/newGamePlus";
import { listSaveSlots } from "../systems/saveSlots";
import {
  TitleMenuManager,
  type TitleMenuAction,
} from "../managers/titleMenu";
import {
  calcPanelLayout,
  createDimGraphics,
  createOverlayContainer,
  createPanelGraphics,
} from "../utils/ui";
import {
  moveGridSelection,
  type GridNavigationDirection,
} from "../systems/layout";
import { DifficultyOverlayManager } from "../managers/difficulty";
import { getDifficultyProfile, STANDARD_DIFFICULTY_SELECTION } from "../data/difficulty";
import type { DifficultySelection } from "../systems/difficulty";
import { cycleDifficultyProfile } from "../systems/difficultyEditor";
import { getScaledBounds, getTextContentSize, installSceneLayoutAudit, subscribeOverlayReflow, syncInteractiveHitArea } from "../managers/layout";

const BOOT_TEXTURE_MEASURE = "2dnd:boot-textures";
const BOOT_TEXTURE_START_MARK = `${BOOT_TEXTURE_MEASURE}:start`;
const BOOT_TEXTURE_END_MARK = `${BOOT_TEXTURE_MEASURE}:end`;

type CharacterStatMode = "pointbuy" | "random";

interface CharacterStatSelection {
  stats: PlayerStats;
  mode: CharacterStatMode;
}

export class BootScene extends Phaser.Scene {
  private readonly sceneTransitions = new SceneTransitionManager(this);
  private saveSlotManager!: SaveSlotManager;
  private newGamePlusManager!: NewGamePlusManager;
  private titleMenuManager: TitleMenuManager | null = null;
  private titleSettingsContainer: Phaser.GameObjects.Container | null = null;
  private difficultyManager!: DifficultyOverlayManager;
  private newGameDifficulty: DifficultySelection = STANDARD_DIFFICULTY_SELECTION;
  private characterAppearanceManager: CharacterAppearanceManager | null = null;
  private unsubscribeCreationReflow: (() => void) | null = null;

  constructor() {
    super({ key: "BootScene" });
  }

  preload(): void {
    // No external assets to load - we generate everything procedurally
  }

  create(): void {
    this.sceneTransitions.prepare();
    installSceneAccessibility(this, installSceneLayoutAudit);
    this.difficultyManager = new DifficultyOverlayManager(this);
    installDicePresentation(this);
    performance.clearMeasures(BOOT_TEXTURE_MEASURE);
    performance.clearMarks(BOOT_TEXTURE_START_MARK);
    performance.clearMarks(BOOT_TEXTURE_END_MARK);
    performance.mark(BOOT_TEXTURE_START_MARK);
    generateAllTextures(this);
    performance.mark(BOOT_TEXTURE_END_MARK);
    performance.measure(
      BOOT_TEXTURE_MEASURE,
      BOOT_TEXTURE_START_MARK,
      BOOT_TEXTURE_END_MARK,
    );
    performance.clearMarks(BOOT_TEXTURE_START_MARK);
    performance.clearMarks(BOOT_TEXTURE_END_MARK);
    this.newGamePlusManager = new NewGamePlusManager(this,
      (slotId) => this.continueGame(slotId), () => this.updateTitleDebugState());
    this.saveSlotManager = new SaveSlotManager(this, {
      newGamePlus: (slotId) => {
        this.saveSlotManager.close();
        this.newGamePlusManager.open(slotId);
      },
      load: (slotId) => this.continueGame(slotId),
      save: () => ({
        ok: false,
        code: "unsupported",
        message: "Campaigns can only be saved during play.",
      }),
      onStateChange: () => this.updateTitleDebugState(),
    });
    this.events.once("shutdown", () => {
      this.titleMenuManager?.destroy();
      this.saveSlotManager.destroy();
      this.newGamePlusManager.close();
      this.characterAppearanceManager?.destroy();
      this.characterAppearanceManager = null;
      this.unsubscribeCreationReflow?.();
      this.unsubscribeCreationReflow = null;
    });
    this.showTitleScreen();
  }


  /** Format class info string for the selection panel. */
  private formatClassInfo(app: PlayerClass): string {
    const boostParts = Object.entries(app.statBoosts)
      .map(([k, v]) => `${k.slice(0, 3).toUpperCase()}+${v}`)
      .join(", ");
    return `${app.playstyle} | ${boostParts} | d${app.hitDie} HP`;
  }

  private bindCharacterCreationControls(
    handlers: CharacterCreationControlHandlers,
  ): void {
    this.unsubscribeCreationReflow?.();
    this.unsubscribeCreationReflow = null;
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error("[BootScene] Keyboard input is unavailable");
    }
    const boundAt = performance.now();
    const bindings: ReadonlyArray<
      readonly [string, () => void, repeatable: boolean]
    > = [
      ["keydown-UP", handlers.up, true],
      ["keydown-DOWN", handlers.down, true],
      ["keydown-LEFT", handlers.left, true],
      ["keydown-RIGHT", handlers.right, true],
      ["keydown-ENTER", handlers.confirm, false],
      ["keydown-ESC", handlers.cancel, false],
    ];
    for (const [eventName, handler, repeatable] of bindings) {
      keyboard.on(eventName, (event: KeyboardEvent) => {
        if (this.difficultyManager?.isOpen()) return;
        if (event.timeStamp <= boundAt || (!repeatable && event.repeat)) return;
        handler();
      });
    }
  }


  private showTitleScreen(): void {
    this.unsubscribeCreationReflow?.();
    this.unsubscribeCreationReflow = null;
    this.titleMenuManager?.destroy();
    this.titleMenuManager = null;
    this.saveSlotManager.close();
    this.children.removeAll(true);
    this.tweens.killAll();
    this.input.keyboard!.removeAllListeners();
    this.updateTitleDebugState();
    const cx = this.cameras.main.centerX;
    const cy = this.cameras.main.centerY;

    this.cameras.main.setBackgroundColor(0x0a0a1a);

    // Initialize audio on first pointer interaction (browsers require user gesture)
    this.input.once("pointerdown", () => {
      audioEngine.init();
      audioEngine.playTitleMusic();
    });
    // Also initialize on first keyboard press
    this.input.keyboard!.once("keydown", () => {
      audioEngine.init();
      audioEngine.playTitleMusic();
    });

    // ── Favicon / Logo: procedurally draw the D20 die ──
    const logoSize = 72;
    const lx = cx;
    const ly = cy - 120;
    const logo = this.add.graphics();
    // D20 hexagon shape
    const pts = [
      { x: 0, y: -logoSize / 2 },
      { x: logoSize * 0.45, y: -logoSize / 4 },
      { x: logoSize * 0.45, y: logoSize / 4 },
      { x: 0, y: logoSize / 2 },
      { x: -logoSize * 0.45, y: logoSize / 4 },
      { x: -logoSize * 0.45, y: -logoSize / 4 },
    ];
    logo.fillStyle(0x1a1a2e, 1);
    logo.beginPath();
    logo.moveTo(lx + pts[0].x, ly + pts[0].y);
    for (let i = 1; i < pts.length; i++) logo.lineTo(lx + pts[i].x, ly + pts[i].y);
    logo.closePath();
    logo.fillPath();
    logo.lineStyle(2.5, 0xffd700, 1);
    logo.beginPath();
    logo.moveTo(lx + pts[0].x, ly + pts[0].y);
    for (let i = 1; i < pts.length; i++) logo.lineTo(lx + pts[i].x, ly + pts[i].y);
    logo.closePath();
    logo.strokePath();
    // Inner facet lines
    logo.lineStyle(1, 0xffd700, 0.4);
    logo.lineBetween(lx + pts[0].x, ly + pts[0].y, lx + pts[3].x, ly + pts[3].y);
    logo.lineBetween(lx + pts[5].x, ly + pts[5].y, lx + pts[2].x, ly + pts[2].y);
    logo.lineBetween(lx + pts[4].x, ly + pts[4].y, lx + pts[1].x, ly + pts[1].y);
    // "2D" text on the die
    this.add.text(lx, ly + 4, "2D", {
      fontSize: "24px", fontFamily: "monospace", fontStyle: "bold", color: "#ffd700",
    }).setOrigin(0.5);

    // Game title below logo
    this.add
      .text(cx, ly + logoSize / 2 + 18, "2D&D", {
        fontSize: "48px",
        fontFamily: "monospace",
        color: "#ffd700",
        stroke: "#000",
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    this.add
      .text(cx, ly + logoSize / 2 + 60, "An epic tale of magic and dice, in 2d!", {
        fontSize: "13px",
        fontFamily: "monospace",
        color: "#888",
      })
      .setOrigin(0.5);

    const saveExists = hasSave();
    const actions: TitleMenuAction[] = [];
    if (saveExists) {
      const summary = getSaveSummary() ?? "Saved game";
      actions.push({
        id: "continue",
        label: "▶ Continue",
        detail: summary,
        color: "#88ff88",
        activate: () => this.continueGame(),
      });
    }
    actions.push(
      {
        id: "newGame",
        label: "★ New Game",
        color: "#ffffff",
        shortcut: "n",
        activate: () => this.requestNewGame(),
      },
      {
        id: "saveSlots",
        label: "▤ Load / Manage Saves",
        color: "#9fe8ff",
        shortcut: "l",
        activate: () => this.saveSlotManager.open("load"),
      },
      {
        id: "settings",
        label: "🔊 Settings",
        color: "#aabbcc",
        activate: () => this.showTitleSettings(),
      },
    );
    if (listSaveSlots(true).some((slot) => slot.metadata?.campaignStatus === "Complete"
      || slot.metadata?.campaignStatus === "Post-game")) {
      actions.splice(saveExists ? 2 : 1, 0, {
        id: "newGamePlus", label: "New Game+", color: "#ffcc80",
        activate: () => this.newGamePlusManager.open(),
      });
    }

    if (window.desktop) {
      actions.push({
        id: "quit",
        label: "[ Quit Desktop ]",
        color: "#ff7777",
        shortcut: "q",
        activate: () => this.quitDesktopApp(),
      });
    }

    this.titleMenuManager = new TitleMenuManager(this, {
      actions,
      canActivate: () =>
        !this.saveSlotManager.isOpen()
        && !this.newGamePlusManager.isOpen()
        && !this.titleSettingsContainer
        && !this.sceneTransitions.isPending,
      onSelectionChange: () => this.updateTitleDebugState(),
    });
    this.titleMenuManager.open();
  }

  private updateTitleDebugState(): void {
    const selectedAction = this.titleMenuManager?.getSelectedActionId();
    debugPanelState(
      `BOOT | Screen: title`
      + `${selectedAction ? ` [TITLE_ACTION:${selectedAction}]` : ""}`
      + `${this.saveSlotManager?.getDebugState() ?? ""}`
      + `${this.newGamePlusManager?.getDebugState() ?? ""}`,
    );
  }

  private requestNewGame(): void {
    this.saveSlotManager.confirmNewGame(() => {
      this.newGameDifficulty = STANDARD_DIFFICULTY_SELECTION;
      this.showCharacterCreation();
    });
  }

  private quitDesktopApp(): void {
    if (!window.desktop) return;
    debugPanelState("BOOT | Screen: title [QUITTING]");
    window.desktop.quitApp();
  }

  /** Show the shared audio and accessibility settings on the title screen. */
  private showTitleSettings(): void {
    if (this.titleSettingsContainer) return;
    const { w, h, px, py, panelW, panelH } = calcPanelLayout(
      this,
      SETTINGS_PANEL_WIDTH,
      SETTINGS_PANEL_HEIGHT,
    );
    const container = createOverlayContainer(
      this,
      "title-settings",
      90,
      { x: px, y: py, width: panelW, height: panelH },
    );
    this.titleSettingsContainer = container;
    const close = (): void => container.destroy();
    const handleCancel = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close();
    };
    this.input.keyboard?.on("keydown", handleCancel);
    container.once(Phaser.GameObjects.Events.DESTROY, () => {
      this.input.keyboard?.off("keydown", handleCancel);
      if (this.titleSettingsContainer === container) {
        this.titleSettingsContainer = null;
      }
    });
    const dim = createDimGraphics(this, w, h, 0.7);
    dim.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    dim.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.x < px || pointer.x > px + panelW || pointer.y < py || pointer.y > py + panelH) {
        close();
      }
    });
    container.add(dim);
    const bg = createPanelGraphics(this, px, py, panelW, panelH);
    bg.setInteractive(new Phaser.Geom.Rectangle(px, py, panelW, panelH), Phaser.Geom.Rectangle.Contains);
    container.add(bg);
    addSettingsControls(this, container, px, py, panelW, panelH);
    const hint = this.add.text(px + panelW / 2, py + panelH - 10, "Click outside to close", {
      fontSize: "10px", fontFamily: "monospace", color: "#666",
    }).setOrigin(0.5, 1);
    container.add(hint);
  }

  private continueGame(slotId: SaveSlotId = "autosave"): SaveActionResult {
    if (this.sceneTransitions.isPending) return { ok: false, code: "invalid", message: "A handoff is already pending." };
    const save = loadGame(slotId);
    if (!save) return reportSaveFailure("not-found", "The selected campaign has no valid recovery copy.");
    const defeatedBosses = new Set(save.defeatedBosses);
    const weatherState = save.weatherState ?? createWeatherState();
    const timeStep = save.timeStep ?? 0;
    const pendingCutsceneId = getNextPendingCutscene(save.player.progression);
    const saved = saveGame(
      save.player,
      defeatedBosses,
      save.codex,
      save.player.appearanceId,
      timeStep,
      weatherState,
    );
    if (!saved.ok) return saved;
    this.sceneTransitions.startWithFade(() => {
      const state = {
        player: save.player,
        defeatedBosses,
        codex: save.codex,
        timeStep,
        weatherState,
        savedSpecialNpcs: [],
      };
      if (pendingCutsceneId === CAMPAIGN_EPILOGUE_CUTSCENE_ID) {
        this.scene.start("EndingScene", {
          ...state,
          cutsceneId: pendingCutsceneId,
          replay: false,
        });
      } else if (pendingCutsceneId) {
        this.scene.start("CutsceneScene", {
          ...state,
          cutsceneId: pendingCutsceneId,
          replay: false,
        });
      } else {
        this.scene.start("OverworldScene", state);
      }
    }, {
      duration: 500,
      label: "continue game",
    });
    return saved;
  }

  private showCharacterCreation(
    initialName = "Hero",
    initialClassId = PLAYER_CLASSES[0]?.id ?? "",
  ): void {
    this.titleMenuManager?.destroy();
    this.titleMenuManager = null;
    this.saveSlotManager.close();
    debugPanelState("BOOT | Screen: character");
    // Clear the title screen
    this.children.removeAll(true);
    this.tweens.killAll();
    this.input.keyboard!.removeAllListeners();

    const cx = this.cameras.main.centerX;
    const formWidth = this.cameras.main.width - 32;

    const title = this.add
      .text(cx, 15, "Create Your Hero", {
        fontSize: "24px",
        fontFamily: "monospace",
        color: "#ffd700",
      })
      .setOrigin(0.5, 0).setWordWrapWidth(formWidth, true)
      .setData("layoutId", "creation-title");

    // Name entry
    const nameLabel = this.add
      .text(cx, title.y + title.height + 4, "Name (Tab / select to edit):", {
        fontSize: "11px",
        fontFamily: "monospace",
        color: "#c0a060",
      })
      .setOrigin(0.5, 0).setWordWrapWidth(formWidth / 2 - 12, true)
      .setData("layoutId", "creation-name-label");

    let playerName = initialName;
    const nameInputReadyAt = performance.now() + 75;
    const nameText = this.add
      .text(cx, nameLabel.y + nameLabel.height + 3, playerName, {
        fontSize: "18px",
        fontFamily: "monospace",
        color: "#fff",
        backgroundColor: "#1a1a2e",
        padding: { x: 12, y: 4 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true }).setData("layoutId", "creation-name");
    const editName = (): void => {
      openMobileTextInput("Hero name", playerName, 12, (value) => {
        playerName = value.replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 12);
        nameText.setText(playerName || "_");
      });
    };
    nameText.on("pointerdown", editName);
    this.input.keyboard!.on("keydown-TAB", (event: KeyboardEvent) => {
      if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
      event.preventDefault();
      editName();
    });

    // Handle typing for name
    this.input.keyboard!.on("keydown", (event: KeyboardEvent) => {
      if (event.timeStamp < nameInputReadyAt) return;
      if (event.key === "Backspace") {
        playerName = playerName.slice(0, -1);
      } else if (event.key.length === 1 && playerName.length < 12 && /[a-zA-Z0-9 ]/.test(event.key)) {
        playerName += event.key;
      }
      nameText.setText(playerName || "_");
    });

    // Class selection
    const classLabel = this.add
      .text(cx, nameText.y + nameText.height + 6, "Choose Class:", {
        fontSize: "14px",
        fontFamily: "monospace",
        color: "#c0a060",
      })
      .setOrigin(0.5, 0);

    let selectedClassIndex = Math.max(
      0,
      PLAYER_CLASSES.findIndex((entry) => entry.id === initialClassId),
    );
    let selectedAppearance = PLAYER_CLASSES[selectedClassIndex]!;

    // Class option grid
    const cols = 4;
    const optW = (formWidth - 24) / cols;
    let optH = 62;
    const startX = cx - formWidth / 2 + optW / 2;
    let startY = classLabel.y + classLabel.height + 28;

    const optionHighlights: Phaser.GameObjects.Graphics[] = [];
    const classSprites: Phaser.GameObjects.Sprite[] = [];
    const classTexts: Phaser.GameObjects.Text[] = [];
    const hitZones: Phaser.GameObjects.Zone[] = [];

    const infoPanelY = startY + Math.ceil(PLAYER_CLASSES.length / cols) * optH + 4;
    const classDescText = this.add
      .text(cx, infoPanelY, selectedAppearance.description, {
        fontSize: "9px", fontFamily: "monospace", color: "#ccc",
        wordWrap: { width: formWidth, useAdvancedWrap: true },
        align: "center",
      })
      .setOrigin(0.5, 0);

    const classBoostText = this.add
      .text(cx, infoPanelY + 22, this.formatClassInfo(selectedAppearance), {
        fontSize: "9px", fontFamily: "monospace", color: "#c0a060",
        wordWrap: { width: formWidth, useAdvancedWrap: true },
      })
      .setOrigin(0.5, 0);

    // Update info panel when class changes
    const updateInfoPanel = (app: PlayerClass) => {
      classDescText.setText(app.description);
      classBoostText.setText(this.formatClassInfo(app));
    };

    const renderClassSelection = (): void => {
      selectedAppearance = PLAYER_CLASSES[selectedClassIndex]!;
      optionHighlights.forEach((highlight, index) => {
        const selected = index === selectedClassIndex;
        const x = startX + (index % cols) * (optW + 8);
        const y = startY + Math.floor(index / cols) * optH;
        highlight.clear();
        highlight.lineStyle(selected ? 3 : 1, selected ? 0xffd700 : 0x777777, 1);
        if (selected) {
          highlight.fillStyle(0xffd700, 0.1);
          highlight.fillRect(x - optW / 2 + 2, y - 22, optW - 4, optH - 8);
        }
        highlight.strokeRect(x - optW / 2 + 2, y - 22, optW - 4, optH - 8);
        classTexts[index]!.setText(`${selected ? "> " : ""}${PLAYER_CLASSES[index]!.label}`);
      });
      updateInfoPanel(selectedAppearance);
      reflowClassForm();
      debugPanelState(
        `BOOT | Screen: character [CLASS:${selectedAppearance.id}]`,
      );
    };

    PLAYER_CLASSES.forEach((app, i) => {
      const ox = startX + (i % cols) * (optW + 8);
      const oy = startY + Math.floor(i / cols) * optH;
      const highlight = this.add.graphics();
      optionHighlights.push(highlight);
      const sprite = this.add.sprite(ox, oy, `player_${app.id}`).setScale(1.25)
        .setData("layoutId", `creation-class-preview-${app.id}`);
      classSprites.push(sprite);
      const label = this.add.text(ox, oy + 24, app.label, {
          fontSize: "10px",
          fontFamily: "monospace",
          color: "#ccc",
          stroke: "#000",
          strokeThickness: 2,
        })
        .setOrigin(0.5, 0).setWordWrapWidth(optW - 8, true)
        .setData("layoutId", `creation-class-${app.id}`);
      classTexts.push(label);
      const hitZone = this.add.zone(ox, oy + 10, optW - 4, 62).setInteractive({ useHandCursor: true });
      hitZones.push(hitZone);
      hitZone.on("pointerdown", () => {
        selectedClassIndex = i;
        renderClassSelection();
      });
    });

    // Next button
    const btnY = infoPanelY + 46;

    const nextBtn = this.add
      .text(cx, btnY, "[ Next > ]", {
        fontSize: "20px",
        fontFamily: "monospace",
        color: "#88ff88",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true }).setData("layoutId", "creation-class-next");

    nextBtn.on("pointerover", () => nextBtn.setColor("#ffd700"));
    nextBtn.on("pointerout", () => nextBtn.setColor("#88ff88"));

    const goNext = (): void => {
      this.unsubscribeCreationReflow?.();
      this.unsubscribeCreationReflow = null;
      this.showStatAllocation(playerName, selectedAppearance);
    };

    nextBtn.on("pointerdown", goNext);
    const reflowClassForm = (): void => {
      const editKey = getInputPromptSource() === "gamepad" ? FACE_BUTTON_ICONS.left : "Tab";
      nameLabel.setText(`Name (${editKey} / select to edit):`);
      title.setPosition(cx, 8);
      const nameY = title.y + title.displayHeight + 6;
      nameLabel.setPosition(cx - formWidth / 4, nameY);
      nameText.setPosition(cx + formWidth / 4, nameY);
      syncInteractiveHitArea(nameText);
      classLabel.setPosition(cx, nameY + Math.max(nameLabel.displayHeight, nameText.displayHeight) + 6);
      const spriteHeight = Math.max(...classSprites.map((sprite) => sprite.displayHeight));
      const labelHeight = Math.max(...classTexts.map((label) => label.displayHeight));
      optH = spriteHeight + 6 + labelHeight + 12;
      startY = classLabel.y + classLabel.displayHeight + 6 + spriteHeight / 2 + 2;
      classSprites.forEach((sprite, index) => {
        const x = startX + index % cols * (optW + 8);
        const y = startY + Math.floor(index / cols) * optH;
        sprite.setPosition(x, y).setData("layoutBounds", getScaledBounds(sprite));
        classTexts[index]!.setPosition(x, y + spriteHeight / 2 + 6);
        const zone = hitZones[index]!;
        zone.setPosition(x, y + (labelHeight + 6) / 2).setSize(optW - 4, optH - 8);
        if (zone.input) zone.input.hitArea = new Phaser.Geom.Rectangle(0, 0, zone.width, zone.height);
        const selected = index === selectedClassIndex;
        const highlight = optionHighlights[index]!;
        highlight.clear().lineStyle(selected ? 3 : 1, selected ? 0xffd700 : 0x777777, 1);
        highlight.strokeRect(x - optW / 2 + 2, y - spriteHeight / 2 - 2, optW - 4, optH - 8);
      });
      const gridBottom = startY - spriteHeight / 2 - 2 + Math.ceil(PLAYER_CLASSES.length / cols) * optH - 8;
      classDescText.setPosition(cx, gridBottom + 6);
      const descHeight = Math.max(...PLAYER_CLASSES.map((entry) => getTextContentSize(classDescText, entry.description).height));
      classBoostText.setPosition(cx, classDescText.y + descHeight + 6);
      const boostHeight = Math.max(...PLAYER_CLASSES.map((entry) => getTextContentSize(classBoostText, this.formatClassInfo(entry)).height));
      nextBtn.setPosition(cx, classBoostText.y + boostHeight + 6 + nextBtn.displayHeight / 2);
      syncInteractiveHitArea(nextBtn);
    };
    const existingObjects = [...this.children.list];
    const layoutGroup = createOverlayContainer(this, "character-class", 0, {
      x: 8, y: 8, width: this.cameras.main.width - 16, height: this.cameras.main.height - 16,
    });
    layoutGroup.add(existingObjects);
    renderClassSelection();
    this.unsubscribeCreationReflow = subscribeOverlayReflow(this, reflowClassForm);

    if (!isReducedMotionEnabled()) {
      this.tweens.add({
        targets: nextBtn,
        alpha: 0.4,
        duration: 900,
        yoyo: true,
        repeat: -1,
      });
    }

    const moveClassSelection = (direction: GridNavigationDirection): void => {
      selectedClassIndex = moveGridSelection(
        selectedClassIndex,
        PLAYER_CLASSES.length,
        cols,
        direction,
      );
      renderClassSelection();
    };
    this.bindCharacterCreationControls({
      up: () => moveClassSelection("up"),
      down: () => moveClassSelection("down"),
      left: () => moveClassSelection("left"),
      right: () => moveClassSelection("right"),
      confirm: goNext,
      cancel: () => this.showTitleScreen(),
    });
  }

  private showStatAllocation(
    playerName: string,
    selectedClass: PlayerClass,
    initialSelection?: CharacterStatSelection,
  ): void {
    debugPanelState("BOOT | Screen: stats");
    this.unsubscribeCreationReflow?.();
    this.unsubscribeCreationReflow = null;
    this.children.removeAll(true);
    this.tweens.killAll();
    this.input.keyboard!.removeAllListeners();
    const boostParts = Object.entries(selectedClass.statBoosts)
      .map(([k, v]) => `${k.slice(0, 3).toUpperCase()}+${v}`)
      .join(", ");
    let mode: CharacterStatMode = initialSelection?.mode ?? "pointbuy";
    const statKeys: (keyof PlayerStats)[] = [
      "strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma",
    ];
    const statLabels: Record<keyof PlayerStats, string> = {
      strength: "STR", dexterity: "DEX", constitution: "CON",
      intelligence: "INT", wisdom: "WIS", charisma: "CHA",
    };
    let currentStats: PlayerStats = initialSelection
      ? { ...initialSelection.stats }
      : {
        strength: 8, dexterity: 8, constitution: 8,
        intelligence: 8, wisdom: 8, charisma: 8,
      };
    let selectedStatIndex = 0;
    let panel: Phaser.GameObjects.Container | null = null;
    const setMode = (nextMode: CharacterStatMode): void => {
      mode = nextMode;
      if (mode === "pointbuy") {
        currentStats = { strength: 8, dexterity: 8, constitution: 8, intelligence: 8, wisdom: 8, charisma: 8 };
      } else {
        for (const key of statKeys) currentStats[key] = rollAbilityScore();
      }
      renderStats();
    };
    const goNext = (): void => {
      if (mode === "pointbuy" && calculatePointsSpent(currentStats) !== POINT_BUY_TOTAL) return;
      this.unsubscribeCreationReflow?.();
      this.unsubscribeCreationReflow = null;
      this.showAppearanceCustomization(playerName, selectedClass, currentStats, mode);
    };
    const goBack = (): void => {
      this.unsubscribeCreationReflow?.();
      this.unsubscribeCreationReflow = null;
      this.showCharacterCreation(playerName, selectedClass.id);
    };
    const adjustStat = (key: keyof PlayerStats, direction: -1 | 1): void => {
      if (mode !== "pointbuy") return;
      const value = currentStats[key];
      if (direction < 0) {
        if (value <= 8) return;
      } else {
        const nextCost = POINT_BUY_COSTS[value + 1];
        const remaining = POINT_BUY_TOTAL - calculatePointsSpent(currentStats);
        if (value >= 15 || nextCost === undefined || nextCost - (POINT_BUY_COSTS[value] ?? 0) > remaining) return;
      }
      currentStats[key] += direction;
      renderStats();
    };
    const renderStats = (): void => {
      panel?.destroy(true);
      const remaining = POINT_BUY_TOTAL - calculatePointsSpent(currentStats);
      const finalStats: PlayerStats = { ...currentStats };
      for (const key of statKeys) finalStats[key] += selectedClass.statBoosts[key] ?? 0;
      const previewHp = Math.max(10, 25 + abilityModifier(finalStats.constitution) * 3);
      const previewMp = Math.max(4, 8 + abilityModifier(finalStats.intelligence) * 2);
      const toHit = abilityModifier(finalStats[selectedClass.primaryStat]) + 2;
      const toHitStr = toHit >= 0 ? `+${toHit}` : `${toHit}`;
      panel = renderCharacterStatsPanel(this, {
        classLabel: `Class: ${selectedClass.label} (${boostParts})`,
        mode, points: `Points: ${remaining} / ${POINT_BUY_TOTAL}`,
        summary: `HP: ${previewHp}   MP: ${previewMp}   To-Hit: ${toHitStr}\n★ Primary: ${statLabels[selectedClass.primaryStat]}`,
        nextEnabled: mode === "random" || remaining === 0,
        rows: statKeys.map((key, index) => {
          const value = currentStats[key];
          const boost = selectedClass.statBoosts[key] ?? 0;
          const modifier = abilityModifier(value + boost);
          const nextCost = POINT_BUY_COSTS[value + 1];
          const incrementCost = nextCost === undefined ? -1 : nextCost - (POINT_BUY_COSTS[value] ?? 0);
          const canIncrease = value < 15 && incrementCost >= 0 && incrementCost <= remaining;
          return {
            id: key, label: statLabels[key], value: String(value),
            boost: boost > 0 ? `+${boost}→${value + boost}` : "",
            modifier: `(${modifier >= 0 ? "+" : ""}${modifier})`,
            cost: canIncrease && incrementCost > 0 ? `(${incrementCost}pt)` : "",
            primary: selectedClass.primaryStat === key, selected: index === selectedStatIndex,
            canDecrease: value > 8, canIncrease,
            decrease: () => adjustStat(key, -1), increase: () => adjustStat(key, 1),
          };
        }),
        changeMode: setMode,
        reroll: () => {
          for (const key of statKeys) currentStats[key] = rollAbilityScore();
          renderStats();
        },
        next: goNext, back: goBack,
      });
      debugPanelState(
        `BOOT | Screen: stats [STAT:${statKeys[selectedStatIndex]}] `
        + `[MODE:${mode}] [STAT_VALUE:${currentStats[statKeys[selectedStatIndex]!]}] `
        + `[POINTS_REMAINING:${remaining}]`,
      );
    };
    renderStats();
    this.unsubscribeCreationReflow = subscribeOverlayReflow(this, renderStats);
    const moveStatSelection = (direction: "up" | "down"): void => {
      selectedStatIndex = moveGridSelection(
        selectedStatIndex,
        statKeys.length,
        1,
        direction,
      );
      renderStats();
    };
    this.bindCharacterCreationControls({
      up: () => moveStatSelection("up"),
      down: () => moveStatSelection("down"),
      left: () => adjustStat(statKeys[selectedStatIndex]!, -1),
      right: () => adjustStat(statKeys[selectedStatIndex]!, 1),
      confirm: goNext,
      cancel: goBack,
    });
  }

  private showAppearanceCustomization(
    playerName: string,
    selectedClass: PlayerClass,
    baseStats: PlayerStats,
    statMode: CharacterStatMode,
  ): void {
    debugPanelState("BOOT | Screen: appearance");
    this.characterAppearanceManager?.destroy();
    this.children.removeAll(true);
    this.tweens.killAll();
    this.input.keyboard!.removeAllListeners();
    this.characterAppearanceManager = new CharacterAppearanceManager(this, selectedClass, {
      bindControls: (handlers) => this.bindCharacterCreationControls(handlers),
      back: () => {
        this.characterAppearanceManager?.destroy();
        this.characterAppearanceManager = null;
        this.showStatAllocation(playerName, selectedClass, { stats: baseStats, mode: statMode });
      },
      start: (appearance: CustomAppearance) => {
        if (this.sceneTransitions.isPending) return;
        this.startNewGame(createPlayer(playerName.trim() || "Hero", baseStats, selectedClass.id, appearance, {
          difficulty: this.newGameDifficulty,
        }));
      },
      campaignRules: {
        label: () => getDifficultyProfile(this.newGameDifficulty.profileId).name,
        isOpen: () => this.difficultyManager.isOpen(),
        adjust: (direction) => {
          this.newGameDifficulty = cycleDifficultyProfile(
            this.newGameDifficulty, direction,
            this.newGameDifficulty.profileId === "custom" ? this.newGameDifficulty.overrides : {},
          );
        },
        open: () => {
          if (this.difficultyManager.isOpen()) return;
          this.difficultyManager.open({
            selection: this.newGameDifficulty,
            apply: (selection) => {
              this.newGameDifficulty = selection;
              return { ok: true, message: "New campaign rules selected." };
            },
            onClose: () => this.characterAppearanceManager?.refresh(),
            onStateChange: () => {
              if (this.difficultyManager.isOpen()) {
                debugPanelState(`BOOT | Screen: difficulty${this.difficultyManager.getDebugState()}`);
              }
            },
          });
        },
      },
    });
    this.characterAppearanceManager.open();
  }

  private startNewGame(player: PlayerState): void {
    if (this.sceneTransitions.isPending) return;
    const defeatedBosses = new Set<string>();
    const codex = createCodex();
    const weatherState = createWeatherState();
    queueCutscenes(
      player.progression,
      getNewGameCutsceneIds(player, defeatedBosses),
    );
    const cutsceneId = getNextPendingCutscene(player.progression);
    saveGame(
      player,
      defeatedBosses,
      codex,
      player.appearanceId,
      0,
      weatherState,
    );
    this.sceneTransitions.startWithFade(() => {
      const state = {
        player,
        defeatedBosses,
        codex,
        timeStep: 0,
        weatherState,
        savedSpecialNpcs: [],
      };
      if (!cutsceneId) {
        this.scene.start("OverworldScene", state);
        return;
      }
      this.scene.start("CutsceneScene", {
        ...state,
        cutsceneId,
        replay: false,
      });
    }, {
      duration: 500,
      label: "start new game",
    });
  }
}
