/**
 * Boot scene: generates all procedural assets and shows a title screen.
 */

import * as Phaser from "phaser";
import { generateAllTextures, generatePlayerTextureWithHair } from "../renderers/textures";
import { PLAYER_CLASSES, type PlayerClass } from "../systems/classes";
import { SKIN_COLOR_OPTIONS, HAIR_STYLE_OPTIONS, HAIR_COLOR_OPTIONS, type CustomAppearance } from "../systems/appearance";
import { hasSave, loadGame, deleteSave, getSaveSummary } from "../systems/save";
import { saveGame } from "../systems/save";
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
import {
  calcPanelLayout,
  createDimGraphics,
  createOverlayContainer,
  createPanelGraphics,
} from "../utils/ui";

const BOOT_TEXTURE_MEASURE = "2dnd:boot-textures";
const BOOT_TEXTURE_START_MARK = `${BOOT_TEXTURE_MEASURE}:start`;
const BOOT_TEXTURE_END_MARK = `${BOOT_TEXTURE_MEASURE}:end`;

export class BootScene extends Phaser.Scene {
  private readonly sceneTransitions = new SceneTransitionManager(this);

  constructor() {
    super({ key: "BootScene" });
  }

  preload(): void {
    // No external assets to load - we generate everything procedurally
  }

  create(): void {
    this.sceneTransitions.prepare();
    installSceneAccessibility(this);
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
    this.showTitleScreen();
  }


  /** Format class info string for the selection panel. */
  private formatClassInfo(app: PlayerClass): string {
    const boostParts = Object.entries(app.statBoosts)
      .map(([k, v]) => `${k.slice(0, 3).toUpperCase()}+${v}`)
      .join(", ");
    return `${app.playstyle} | ${boostParts} | d${app.hitDie} HP`;
  }


  private showTitleScreen(): void {
    debugPanelState("BOOT | Screen: title");
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

    // Menu options
    let menuY = cy + 60;

    const saveExists = hasSave();

    if (saveExists) {
      const summary = getSaveSummary() ?? "Saved game";
      const continueBtn = this.add
        .text(cx, menuY, "▶ Continue", {
          fontSize: "22px",
          fontFamily: "monospace",
          color: "#88ff88",
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      continueBtn.on("pointerover", () => continueBtn.setColor("#ffd700"));
      continueBtn.on("pointerout", () => continueBtn.setColor("#88ff88"));
      continueBtn.on("pointerdown", () => this.continueGame());

      this.add
        .text(cx, menuY + 24, summary, {
          fontSize: "10px",
          fontFamily: "monospace",
          color: "#666",
        })
        .setOrigin(0.5);

      menuY += 54;
    }

    const newBtn = this.add
      .text(cx, menuY, "★ New Game", {
        fontSize: "22px",
        fontFamily: "monospace",
        color: "#fff",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    newBtn.on("pointerover", () => newBtn.setColor("#ffd700"));
    newBtn.on("pointerout", () => newBtn.setColor("#fff"));
    newBtn.on("pointerdown", () => this.showCharacterCreation());

    menuY += 40;

    // Settings button
    const settingsBtn = this.add
      .text(cx, menuY, "🔊 Settings", {
        fontSize: "16px",
        fontFamily: "monospace",
        color: "#aabbcc",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    settingsBtn.on("pointerover", () => settingsBtn.setColor("#ffd700"));
    settingsBtn.on("pointerout", () => settingsBtn.setColor("#aabbcc"));
    settingsBtn.on("pointerdown", () => this.showTitleSettings());

    if (window.desktop) {
      menuY += 38;
      const quitBtn = this.add
        .text(cx, menuY, "[ Quit Desktop ]", {
          fontSize: "16px",
          fontFamily: "monospace",
          color: "#ff7777",
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      quitBtn.setData("testId", "title-quit-desktop");
      quitBtn.on("pointerover", () => quitBtn.setColor("#ffffff"));
      quitBtn.on("pointerout", () => quitBtn.setColor("#ff7777"));
      quitBtn.on("pointerdown", () => this.quitDesktopApp());
      this.input.keyboard!.once("keydown-Q", () => this.quitDesktopApp());
    }

    // Keyboard shortcuts
    if (saveExists) {
      this.input.keyboard!.once("keydown-SPACE", () => this.continueGame());
      this.input.keyboard!.once("keydown-N", () => this.showCharacterCreation());
    } else {
      this.input.keyboard!.once("keydown-SPACE", () => this.showCharacterCreation());
    }
  }

  private quitDesktopApp(): void {
    if (!window.desktop) return;
    debugPanelState("BOOT | Screen: title [QUITTING]");
    window.desktop.quitApp();
  }

  /** Show the shared audio and accessibility settings on the title screen. */
  private showTitleSettings(): void {
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
    const dim = createDimGraphics(this, w, h, 0.7);
    dim.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    dim.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.x < px || pointer.x > px + panelW || pointer.y < py || pointer.y > py + panelH) {
        container.destroy();
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

  private continueGame(): void {
    if (this.sceneTransitions.isPending) return;
    const save = loadGame();
    if (!save) return;
    const defeatedBosses = new Set(save.defeatedBosses);
    const weatherState = save.weatherState ?? createWeatherState();
    const timeStep = save.timeStep ?? 0;
    const pendingCutsceneId = getNextPendingCutscene(save.player.progression);
    saveGame(
      save.player,
      defeatedBosses,
      save.codex,
      save.player.appearanceId,
      timeStep,
      weatherState,
    );
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
  }

  private showCharacterCreation(): void {
    debugPanelState("BOOT | Screen: character");
    // Clear the title screen
    this.children.removeAll(true);
    this.tweens.killAll();
    this.input.keyboard!.removeAllListeners();

    const cx = this.cameras.main.centerX;

    const title = this.add
      .text(cx, 15, "Create Your Hero", {
        fontSize: "24px",
        fontFamily: "monospace",
        color: "#ffd700",
      })
      .setOrigin(0.5, 0);

    // Name entry
    const nameLabel = this.add
      .text(cx, title.y + title.height + 4, "Name:", {
        fontSize: "14px",
        fontFamily: "monospace",
        color: "#c0a060",
      })
      .setOrigin(0.5, 0);

    let playerName = "Hero";
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
      .setInteractive({ useHandCursor: true });
    nameText.on("pointerdown", () => {
      openMobileTextInput("Hero name", playerName, 12, (value) => {
        playerName = value.replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 12);
        nameText.setText(playerName || "_");
      });
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

    let selectedAppearance = PLAYER_CLASSES[0];

    // Class option grid
    const cols = 4;
    const optW = 72;
    const optH = 62;
    const startX = cx - ((Math.min(cols, PLAYER_CLASSES.length) * optW) / 2) + optW / 2;
    const startY = classLabel.y + classLabel.height + 28;

    const optionHighlights: Phaser.GameObjects.Graphics[] = [];

    PLAYER_CLASSES.forEach((app, i) => {
      const ox = startX + (i % cols) * optW;
      const oy = startY + Math.floor(i / cols) * optH;

      // Highlight box
      const hl = this.add.graphics();
      hl.lineStyle(2, app.id === selectedAppearance.id ? 0xffd700 : 0x444444, 1);
      if (app.id === selectedAppearance.id) {
        hl.fillStyle(0xffd700, 0.1);
        hl.fillRect(ox - 28, oy - 22, 56, 62);
      }
      hl.strokeRect(ox - 28, oy - 22, 56, 62);
      optionHighlights.push(hl);

      // Sprite preview
      this.add.sprite(ox, oy, `player_${app.id}`).setScale(1.8);

      // Label
      this.add
        .text(ox, oy + 24, app.label, {
          fontSize: "10px",
          fontFamily: "monospace",
          color: "#ccc",
          stroke: "#000",
          strokeThickness: 2,
        })
        .setOrigin(0.5, 0);

      // Make the whole box clickable
      const hitZone = this.add.zone(ox, oy + 10, 56, 62).setInteractive({ useHandCursor: true });
      hitZone.on("pointerdown", () => {
        selectedAppearance = app;
        // Update highlights
        optionHighlights.forEach((h, j) => {
          h.clear();
          const isSelected = PLAYER_CLASSES[j].id === app.id;
          h.lineStyle(2, isSelected ? 0xffd700 : 0x444444, 1);
          if (isSelected) {
            h.fillStyle(0xffd700, 0.1);
          }
          const hx = startX + (j % cols) * optW;
          const hy = startY + Math.floor(j / cols) * optH;
          if (isSelected) h.fillRect(hx - 28, hy - 22, 56, 62);
          h.strokeRect(hx - 28, hy - 22, 56, 62);
        });
      });
    });

    // Class info panel (description + playstyle + stat boosts)
    const infoPanelY = startY + Math.ceil(PLAYER_CLASSES.length / cols) * optH + 4;
    const classDescText = this.add
      .text(cx, infoPanelY, selectedAppearance.description, {
        fontSize: "9px", fontFamily: "monospace", color: "#ccc",
        wordWrap: { width: 280 },
        align: "center",
      })
      .setOrigin(0.5, 0);

    const classBoostText = this.add
      .text(cx, infoPanelY + 22, this.formatClassInfo(selectedAppearance), {
        fontSize: "9px", fontFamily: "monospace", color: "#c0a060",
      })
      .setOrigin(0.5, 0);

    // Update info panel when class changes
    const updateInfoPanel = (app: PlayerClass) => {
      classDescText.setText(app.description);
      classBoostText.setText(this.formatClassInfo(app));
    };

    // Re-wire class selection to also update info panel
    PLAYER_CLASSES.forEach((app, i) => {
      const ox = startX + (i % cols) * optW;
      const oy = startY + Math.floor(i / cols) * optH;
      const hitZone = this.add.zone(ox, oy + 10, 56, 62).setInteractive({ useHandCursor: true });
      hitZone.on("pointerdown", () => {
        selectedAppearance = app;
        optionHighlights.forEach((h, j) => {
          h.clear();
          const isSelected = PLAYER_CLASSES[j].id === app.id;
          h.lineStyle(2, isSelected ? 0xffd700 : 0x444444, 1);
          if (isSelected) {
            h.fillStyle(0xffd700, 0.1);
          }
          const hx = startX + (j % cols) * optW;
          const hy = startY + Math.floor(j / cols) * optH;
          if (isSelected) h.fillRect(hx - 28, hy - 22, 56, 62);
          h.strokeRect(hx - 28, hy - 22, 56, 62);
        });
        updateInfoPanel(app);
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
      .setInteractive({ useHandCursor: true });

    nextBtn.on("pointerover", () => nextBtn.setColor("#ffd700"));
    nextBtn.on("pointerout", () => nextBtn.setColor("#88ff88"));

    const goNext = () => {
      this.showStatAllocation(playerName, selectedAppearance);
    };

    nextBtn.on("pointerdown", goNext);

    if (!isReducedMotionEnabled()) {
      this.tweens.add({
        targets: nextBtn,
        alpha: 0.4,
        duration: 900,
        yoyo: true,
        repeat: -1,
      });
    }

    this.input.keyboard!.on("keydown-ENTER", goNext);
  }

  private showStatAllocation(playerName: string, selectedClass: PlayerClass): void {
    debugPanelState("BOOT | Screen: stats");
    this.children.removeAll(true);
    this.tweens.killAll();
    this.input.keyboard!.removeAllListeners();

    const cx = this.cameras.main.centerX;
    const w = this.cameras.main.width;

    // Title
    this.add.text(cx, 8, "Allocate Stats", {
      fontSize: "22px", fontFamily: "monospace", color: "#ffd700",
    }).setOrigin(0.5, 0);

    // Class info with bonuses
    const boostParts = Object.entries(selectedClass.statBoosts)
      .map(([k, v]) => `${k.slice(0, 3).toUpperCase()}+${v}`)
      .join(", ");
    this.add.text(cx, 36, `Class: ${selectedClass.label} (${boostParts})`, {
      fontSize: "11px", fontFamily: "monospace", color: "#888",
    }).setOrigin(0.5, 0);

    // State
    type Mode = "pointbuy" | "random";
    let mode: Mode = "pointbuy";

    const statKeys: (keyof PlayerStats)[] = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
    const statLabels: Record<keyof PlayerStats, string> = {
      strength: "STR", dexterity: "DEX", constitution: "CON",
      intelligence: "INT", wisdom: "WIS", charisma: "CHA",
    };

    let currentStats: PlayerStats = {
      strength: 8, dexterity: 8, constitution: 8,
      intelligence: 8, wisdom: 8, charisma: 8,
    };

    // UI containers — built by render()
    const uiObjects: Phaser.GameObjects.GameObject[] = [];
    const clearUI = () => {
      for (const obj of uiObjects) obj.destroy();
      uiObjects.length = 0;
    };

    // Mode toggle tabs
    const tabY = 56;
    const pointBuyTab = this.add.text(cx - 70, tabY, "[ Point Buy ]", {
      fontSize: "13px", fontFamily: "monospace", color: "#ffd700",
      backgroundColor: "#2a2a4e", padding: { x: 8, y: 4 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });

    const randomTab = this.add.text(cx + 70, tabY, "[ 🎲 Random ]", {
      fontSize: "13px", fontFamily: "monospace", color: "#888",
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });

    const setMode = (m: Mode) => {
      mode = m;
      if (m === "pointbuy") {
        pointBuyTab.setColor("#ffd700").setBackgroundColor("#2a2a4e");
        randomTab.setColor("#888").setBackgroundColor("");
        currentStats = { strength: 8, dexterity: 8, constitution: 8, intelligence: 8, wisdom: 8, charisma: 8 };
      } else {
        randomTab.setColor("#ffd700").setBackgroundColor("#2a2a4e");
        pointBuyTab.setColor("#888").setBackgroundColor("");
        // Roll fresh random stats
        for (const k of statKeys) currentStats[k] = rollAbilityScore();
      }
      renderStats();
    };

    pointBuyTab.on("pointerdown", () => setMode("pointbuy"));
    randomTab.on("pointerdown", () => setMode("random"));

    // Next button (always present, enabled/disabled)
    const nextBtn = this.add.text(cx + 80, 460, "[ Next > ]", {
      fontSize: "18px", fontFamily: "monospace", color: "#88ff88",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    nextBtn.on("pointerover", () => { if (nextBtn.alpha === 1) nextBtn.setColor("#ffd700"); });
    nextBtn.on("pointerout", () => { if (nextBtn.alpha === 1) nextBtn.setColor("#88ff88"); });
    nextBtn.on("pointerdown", () => {
      if (nextBtn.alpha < 1) return;
      this.showAppearanceCustomization(playerName, selectedClass, currentStats);
    });

    // Back button
    const backBtn = this.add.text(cx - 80, 460, "[ < Back ]", {
      fontSize: "16px", fontFamily: "monospace", color: "#aaa",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    backBtn.on("pointerover", () => backBtn.setColor("#ffd700"));
    backBtn.on("pointerout", () => backBtn.setColor("#aaa"));
    backBtn.on("pointerdown", () => this.showCharacterCreation());

    const renderStats = () => {
      clearUI();

      const spent = calculatePointsSpent(currentStats);
      const remaining = POINT_BUY_TOTAL - spent;

      // Points remaining / reroll button
      if (mode === "pointbuy") {
        const ptText = this.add.text(cx, 84, `Points: ${remaining} / ${POINT_BUY_TOTAL}`, {
          fontSize: "13px", fontFamily: "monospace",
          color: remaining === 0 ? "#88ff88" : remaining < 0 ? "#ff6666" : "#ffd700",
        }).setOrigin(0.5, 0);
        uiObjects.push(ptText);
      } else {
        const rerollBtn = this.add.text(cx, 84, "[ 🎲 Re-Roll ]", {
          fontSize: "14px", fontFamily: "monospace", color: "#aaddff",
          backgroundColor: "#2a2a4e", padding: { x: 10, y: 3 },
        }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
        rerollBtn.on("pointerover", () => rerollBtn.setColor("#ffd700"));
        rerollBtn.on("pointerout", () => rerollBtn.setColor("#aaddff"));
        rerollBtn.on("pointerdown", () => {
          for (const k of statKeys) currentStats[k] = rollAbilityScore();
          renderStats();
        });
        uiObjects.push(rerollBtn);
      }

      // Stat rows
      const startY = 112;
      const rowH = 42;
      const leftX = cx - 120;

      statKeys.forEach((key, i) => {
        const y = startY + i * rowH;
        const val = currentStats[key];
        const mod = abilityModifier(val);
        const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
        const classBoost = (selectedClass.statBoosts[key] ?? 0) as number;
        const finalVal = val + classBoost;
        const finalMod = abilityModifier(finalVal);
        const finalModStr = finalMod >= 0 ? `+${finalMod}` : `${finalMod}`;
        const isPrimary = selectedClass.primaryStat === key;

        // Label
        const label = this.add.text(leftX, y, `${statLabels[key]}:`, {
          fontSize: "14px", fontFamily: "monospace",
          color: isPrimary ? "#ffd700" : "#c0a060",
        });
        uiObjects.push(label);

        // Base value
        const valTxt = this.add.text(leftX + 50, y, `${val}`, {
          fontSize: "14px", fontFamily: "monospace", color: "#fff",
        });
        uiObjects.push(valTxt);

        // Class boost indicator
        if (classBoost > 0) {
          const boostTxt = this.add.text(leftX + 72, y, `+${classBoost}→${finalVal}`, {
            fontSize: "11px", fontFamily: "monospace", color: "#88ff88",
          });
          uiObjects.push(boostTxt);
        }

        // Modifier (final)
        const modTxt = this.add.text(leftX + 130, y, `(${finalModStr})`, {
          fontSize: "13px", fontFamily: "monospace", color: "#aaa",
        });
        uiObjects.push(modTxt);

        // +/- buttons (Point Buy only)
        if (mode === "pointbuy") {
          // Cost display for next increment
          const nextVal = val + 1;
          const currentCost = POINT_BUY_COSTS[val] ?? 0;
          const nextCost = POINT_BUY_COSTS[nextVal];
          const incrementCost = nextCost !== undefined ? nextCost - currentCost : -1;

          // [-] button
          const canDecrease = val > 8;
          const minusBtn = this.add.text(leftX + 170, y - 2, "[-]", {
            fontSize: "16px", fontFamily: "monospace",
            color: canDecrease ? "#ff8888" : "#444",
            backgroundColor: canDecrease ? "#2a1a1a" : undefined,
            padding: { x: 4, y: 1 },
          }).setOrigin(0, 0);
          if (canDecrease) {
            minusBtn.setInteractive({ useHandCursor: true });
            minusBtn.on("pointerdown", () => {
              currentStats[key]--;
              renderStats();
            });
          }
          uiObjects.push(minusBtn);

          // [+] button
          const canIncrease = val < 15 && incrementCost >= 0 && incrementCost <= remaining;
          const plusBtn = this.add.text(leftX + 208, y - 2, "[+]", {
            fontSize: "16px", fontFamily: "monospace",
            color: canIncrease ? "#88ff88" : "#444",
            backgroundColor: canIncrease ? "#1a2a1a" : undefined,
            padding: { x: 4, y: 1 },
          }).setOrigin(0, 0);
          if (canIncrease) {
            plusBtn.setInteractive({ useHandCursor: true });
            plusBtn.on("pointerdown", () => {
              currentStats[key]++;
              renderStats();
            });
          }
          uiObjects.push(plusBtn);

          // Cost hint
          if (incrementCost > 0 && canIncrease) {
            const costHint = this.add.text(leftX + 248, y + 2, `(${incrementCost}pt)`, {
              fontSize: "9px", fontFamily: "monospace", color: "#666",
            });
            uiObjects.push(costHint);
          }
        }

        // Primary stat indicator
        if (isPrimary) {
          const starTxt = this.add.text(leftX - 14, y, "★", {
            fontSize: "12px", fontFamily: "monospace", color: "#ffd700",
          });
          uiObjects.push(starTxt);
        }
      });

      // Summary: total HP/MP preview
      const previewY = startY + statKeys.length * rowH + 8;
      const finalStats: PlayerStats = { ...currentStats };
      for (const [k, v] of Object.entries(selectedClass.statBoosts)) {
        finalStats[k as keyof PlayerStats] += v as number;
      }
      const previewHp = Math.max(10, 25 + abilityModifier(finalStats.constitution) * 3);
      const previewMp = Math.max(4, 8 + abilityModifier(finalStats.intelligence) * 2);
      const primaryMod = abilityModifier(finalStats[selectedClass.primaryStat]);
      const profBonus = 2;
      const toHit = primaryMod + profBonus;
      const toHitStr = toHit >= 0 ? `+${toHit}` : `${toHit}`;

      const previewText = this.add.text(cx, previewY, [
        `HP: ${previewHp}   MP: ${previewMp}   To-Hit: ${toHitStr}`,
        `★ Primary: ${statLabels[selectedClass.primaryStat]}`,
      ].join("\n"), {
        fontSize: "11px", fontFamily: "monospace", color: "#aaa",
        align: "center", lineSpacing: 4,
      }).setOrigin(0.5, 0);
      uiObjects.push(previewText);

      // Enable/disable Next button
      if (mode === "pointbuy") {
        const valid = remaining === 0;
        nextBtn.setAlpha(valid ? 1 : 0.4);
      } else {
        nextBtn.setAlpha(1);
      }
    };

    renderStats();
  }

  private showAppearanceCustomization(playerName: string, selectedClass: PlayerClass, baseStats: PlayerStats, preset?: { skinColor: number; hairStyle: number; hairColor: number }): void {
    debugPanelState("BOOT | Screen: appearance");
    this.children.removeAll(true);
    this.tweens.killAll();
    this.input.keyboard!.removeAllListeners();

    const cx = this.cameras.main.centerX;

    // y=8: title (22px tall) → bottom ~30
    this.add
      .text(cx, 8, "Customize Appearance", {
        fontSize: "22px",
        fontFamily: "monospace",
        color: "#ffd700",
      })
      .setOrigin(0.5, 0);

    // y=34: class label (12px) → bottom ~46
    this.add
      .text(cx, 34, `Class: ${selectedClass.label}`, {
        fontSize: "12px",
        fontFamily: "monospace",
        color: "#888",
      })
      .setOrigin(0.5, 0);

    // State — use preset values from randomize if provided, else class default
    let selectedSkinColor = preset?.skinColor ?? selectedClass.skinColor;
    let selectedHairStyle = preset?.hairStyle ?? HAIR_STYLE_OPTIONS[0].id;
    let selectedHairColor = preset?.hairColor ?? HAIR_COLOR_OPTIONS[0].color;

    // y=78: preview sprite center, scale 2 (64px tall: top=46, bottom=110)
    let previewCounter = 0;
    const genPreviewKey = (): string => `preview_custom_${Date.now()}_${previewCounter++}`;
    let curPreviewKey = genPreviewKey();
    generatePlayerTextureWithHair(this,
      curPreviewKey,
      selectedClass.bodyColor,
      selectedSkinColor,
      selectedClass.legColor,
      selectedHairStyle,
      selectedHairColor,
      selectedClass.weaponSprite,
      selectedClass.clothingStyle
    );
    let previewSprite = this.add.sprite(cx, 78, curPreviewKey).setScale(2);

    const updatePreview = () => {
      // Destroy old sprite completely to avoid any cached frame data
      const oldKey = curPreviewKey;
      previewSprite.destroy();
      curPreviewKey = genPreviewKey();
      generatePlayerTextureWithHair(this,
        curPreviewKey,
        selectedClass.bodyColor,
        selectedSkinColor,
        selectedClass.legColor,
        selectedHairStyle,
        selectedHairColor,
        selectedClass.weaponSprite,
        selectedClass.clothingStyle
      );
      previewSprite = this.add.sprite(cx, 78, curPreviewKey).setScale(2);
      if (this.textures.exists(oldKey)) this.textures.remove(oldKey);
    };

    // Randomize button — picks random skin, hair style, and hair colour
    const randomizeAll = () => {
      const rndSkin = SKIN_COLOR_OPTIONS[Math.floor(Math.random() * SKIN_COLOR_OPTIONS.length)].color;
      const rndStyle = HAIR_STYLE_OPTIONS[Math.floor(Math.random() * HAIR_STYLE_OPTIONS.length)].id;
      const rndHairColor = HAIR_COLOR_OPTIONS[Math.floor(Math.random() * HAIR_COLOR_OPTIONS.length)].color;
      // Rebuild the whole screen so selection highlights update
      this.showAppearanceCustomization(playerName, selectedClass, baseStats,
        { skinColor: rndSkin, hairStyle: rndStyle, hairColor: rndHairColor });
    };

    const rndBtn = this.add
      .text(cx, 104, "🎲 Randomize", {
        fontSize: "12px",
        fontFamily: "monospace",
        color: "#88ccff",
        backgroundColor: "#2a2a4e",
        padding: { x: 10, y: 3 },
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true });
    rndBtn.on("pointerover", () => rndBtn.setColor("#ffd700"));
    rndBtn.on("pointerout", () => rndBtn.setColor("#88ccff"));
    rndBtn.on("pointerdown", randomizeAll);

    // y=130: skin color label (13px) → bottom ~143
    this.add
      .text(cx, 130, "Skin Color:", {
        fontSize: "13px",
        fontFamily: "monospace",
        color: "#c0a060",
      })
      .setOrigin(0.5, 0);

    // y=154: skin swatches center (radius 10 → top=144, bottom=164; labels at y=168 → bottom ~176)
    const skinSwatchY = 154;
    const skinSwatchSpacing = 40;
    const skinStartX = cx - ((SKIN_COLOR_OPTIONS.length - 1) * skinSwatchSpacing) / 2;
    const skinHighlights: Phaser.GameObjects.Graphics[] = [];

    SKIN_COLOR_OPTIONS.forEach((opt, i) => {
      const sx = skinStartX + i * skinSwatchSpacing;

      const gfx = this.add.graphics();
      gfx.fillStyle(opt.color, 1);
      gfx.fillCircle(sx, skinSwatchY, 10);
      gfx.lineStyle(2, opt.color === selectedSkinColor ? 0xffd700 : 0x444444, 1);
      gfx.strokeCircle(sx, skinSwatchY, 11);
      skinHighlights.push(gfx);

      this.add
        .text(sx, skinSwatchY + 15, opt.label, {
          fontSize: "8px",
          fontFamily: "monospace",
          color: "#999",
        })
        .setOrigin(0.5, 0);

      const hitZone = this.add.zone(sx, skinSwatchY, 24, 24).setInteractive({ useHandCursor: true });
      hitZone.on("pointerdown", () => {
        selectedSkinColor = opt.color;
        SKIN_COLOR_OPTIONS.forEach((_, j) => {
          const hx = skinStartX + j * skinSwatchSpacing;
          skinHighlights[j].clear();
          skinHighlights[j].fillStyle(SKIN_COLOR_OPTIONS[j].color, 1);
          skinHighlights[j].fillCircle(hx, skinSwatchY, 10);
          skinHighlights[j].lineStyle(2, j === i ? 0xffd700 : 0x444444, 1);
          skinHighlights[j].strokeCircle(hx, skinSwatchY, 11);
        });
        updatePreview();
      });
    });

    // y=186: hair style label (13px) → bottom ~199
    this.add
      .text(cx, 186, "Hair Style:", {
        fontSize: "13px",
        fontFamily: "monospace",
        color: "#c0a060",
      })
      .setOrigin(0.5, 0);

    // y=208: hair style buttons (~25px with padding) → bottom ~233
    const hairStyleY = 208;
    const hairStyleSpacing = 80;
    const hairStyleStartX = cx - ((HAIR_STYLE_OPTIONS.length - 1) * hairStyleSpacing) / 2;
    const hairStyleTexts: Phaser.GameObjects.Text[] = [];

    HAIR_STYLE_OPTIONS.forEach((opt, i) => {
      const sx = hairStyleStartX + i * hairStyleSpacing;
      const txt = this.add
        .text(sx, hairStyleY, opt.label, {
          fontSize: "13px",
          fontFamily: "monospace",
          color: opt.id === selectedHairStyle ? "#ffd700" : "#888",
          backgroundColor: opt.id === selectedHairStyle ? "#2a2a2a" : undefined,
          padding: { x: 6, y: 3 },
        })
        .setOrigin(0.5, 0)
        .setInteractive({ useHandCursor: true });
      hairStyleTexts.push(txt);

      txt.on("pointerdown", () => {
        selectedHairStyle = opt.id;
        hairStyleTexts.forEach((t, j) => {
          t.setColor(j === i ? "#ffd700" : "#888");
          t.setBackgroundColor(j === i ? "#2a2a2a" : "");
        });
        updatePreview();
      });
    });

    // y=244: hair color label (13px) → bottom ~257
    this.add
      .text(cx, 244, "Hair Color:", {
        fontSize: "13px",
        fontFamily: "monospace",
        color: "#c0a060",
      })
      .setOrigin(0.5, 0);

    // y=268: hair color swatches center (radius 10 → top=258, bottom=278; labels at y=282 → bottom ~290)
    const hairSwatchY = 268;
    const hairSwatchSpacing = 40;
    const hairStartX = cx - ((HAIR_COLOR_OPTIONS.length - 1) * hairSwatchSpacing) / 2;
    const hairHighlights: Phaser.GameObjects.Graphics[] = [];

    HAIR_COLOR_OPTIONS.forEach((opt, i) => {
      const hx = hairStartX + i * hairSwatchSpacing;

      const gfx = this.add.graphics();
      gfx.fillStyle(opt.color, 1);
      gfx.fillCircle(hx, hairSwatchY, 10);
      gfx.lineStyle(2, opt.color === selectedHairColor ? 0xffd700 : 0x444444, 1);
      gfx.strokeCircle(hx, hairSwatchY, 11);
      hairHighlights.push(gfx);

      this.add
        .text(hx, hairSwatchY + 15, opt.label, {
          fontSize: "8px",
          fontFamily: "monospace",
          color: "#999",
        })
        .setOrigin(0.5, 0);

      const hitZone = this.add.zone(hx, hairSwatchY, 24, 24).setInteractive({ useHandCursor: true });
      hitZone.on("pointerdown", () => {
        selectedHairColor = opt.color;
        HAIR_COLOR_OPTIONS.forEach((_, j) => {
          const hhx = hairStartX + j * hairSwatchSpacing;
          hairHighlights[j].clear();
          hairHighlights[j].fillStyle(HAIR_COLOR_OPTIONS[j].color, 1);
          hairHighlights[j].fillCircle(hhx, hairSwatchY, 10);
          hairHighlights[j].lineStyle(2, j === i ? 0xffd700 : 0x444444, 1);
          hairHighlights[j].strokeCircle(hhx, hairSwatchY, 11);
        });
        updatePreview();
      });
    });

    // y=312: back/start buttons
    const btnY = 312;

    const backBtn = this.add
      .text(cx - 100, btnY, "[ < Back ]", {
        fontSize: "16px",
        fontFamily: "monospace",
        color: "#aaa",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    backBtn.on("pointerover", () => backBtn.setColor("#ffd700"));
    backBtn.on("pointerout", () => backBtn.setColor("#aaa"));
    backBtn.on("pointerdown", () => this.showStatAllocation(playerName, selectedClass));

    const startBtn = this.add
      .text(cx + 100, btnY, "[ Start Adventure ]", {
        fontSize: "16px",
        fontFamily: "monospace",
        color: "#88ff88",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    startBtn.on("pointerover", () => startBtn.setColor("#ffd700"));
    startBtn.on("pointerout", () => startBtn.setColor("#88ff88"));

    const doStart = () => {
      if (this.sceneTransitions.isPending) return;
      const name = playerName.trim() || "Hero";
      const customAppearance: CustomAppearance = {
        skinColor: selectedSkinColor,
        hairStyle: selectedHairStyle,
        hairColor: selectedHairColor,
      };
      const player = createPlayer(name, baseStats, selectedClass.id, customAppearance);

      this.startNewGame(player);
    };

    startBtn.on("pointerdown", doStart);

    if (!isReducedMotionEnabled()) {
      this.tweens.add({
        targets: startBtn,
        alpha: 0.4,
        duration: 900,
        yoyo: true,
        repeat: -1,
      });
    }

    this.input.keyboard!.on("keydown-ENTER", doStart);
  }

  private startNewGame(player: PlayerState): void {
    if (this.sceneTransitions.isPending) return;
    deleteSave();
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
