/**
 * Turn-based battle scene with D&D dice mechanics.
 */

import Phaser from "phaser";
import type { Monster } from "../data/monsters";
import { getSpell, type Spell } from "../data/spells";
import { getAbility, type Ability } from "../data/abilities";
import { getItem, type Item } from "../data/items";
import type { PlayerState } from "../systems/player";
import {
  awardXP,
  getArmorClass,
  useItem,
  xpForLevel,
} from "../systems/player";
import {
  rollInitiative,
  playerAttack,
  playerOffHandAttack,
  playerCastSpell,
  playerUseAbility,
  monsterAttack,
  monsterUseAbility,
  attemptFlee,
} from "../systems/combat";
import { abilityModifier } from "../systems/dice";
import { isDebug, debugLog, debugPanelLog, debugPanelState } from "../config";
import type { CodexData } from "../systems/codex";
import { recordDefeat, discoverAC } from "../systems/codex";
import { type WeatherState, WeatherType, createWeatherState, getWeatherAccuracyPenalty, getMonsterWeatherBoost, WEATHER_LABEL } from "../systems/weather";
import type { SavedSpecialNpc } from "../data/npcs";
import { registerSharedHotkeys, buildSharedCommands, registerCommandRouter, SHARED_HELP, type HelpEntry } from "../systems/debug";
import { getTimePeriod, TimePeriod, PERIOD_TINT } from "../systems/daynight";
import { audioEngine } from "../systems/audio";
import { drawTimeSky as _drawTimeSky, drawCelestialBody as _drawCelestialBody, drawTerrainForeground as _drawTerrainForeground, applyBattleDayNightTint, createBattleWeatherParticles } from "../renderers/battleEffects";
import { PlayerRenderer } from "../renderers/player";

type BattlePhase = "init" | "playerTurn" | "monsterTurn" | "victory" | "defeat" | "fled";

export class BattleScene extends Phaser.Scene {
  private player!: PlayerState;
  private monster!: Monster;
  private monsterHp!: number;
  private defeatedBosses!: Set<string>;
  private codex!: CodexData;
  private timeStep = 0;
  private weatherState: WeatherState = createWeatherState();
  private savedSpecialNpcs: SavedSpecialNpc[] = [];
  private phase: BattlePhase = "init";
  private logLines: string[] = [];
  private logText!: Phaser.GameObjects.Text;
  private logContainer!: Phaser.GameObjects.Container;
  private logMaskGraphics!: Phaser.GameObjects.Graphics;
  private logAreaY = 0;
  private logAreaH = 0;
  private monsterText!: Phaser.GameObjects.Text;
  private monsterSprite!: Phaser.GameObjects.Sprite;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private playerStatsText!: Phaser.GameObjects.Text;
  private actionButtons: Phaser.GameObjects.Container[] = [];
  private spellMenu: Phaser.GameObjects.Container | null = null;
  private itemMenu: Phaser.GameObjects.Container | null = null;
  private abilityMenu: Phaser.GameObjects.Container | null = null;
  private battleSpellPage = 0;
  private battleAbilityPage = 0;
  private battleItemPage = 0;

  // Defend state
  private playerDefending = false;
  private monsterDefending = false;

  // Bonus action tracking (items are bonus actions, not turn actions)
  private bonusActionUsed = false;
  private itemsUsedThisTurn = 0;
  private turnActionUsed = false;

  // AC discovery tracking
  private acHighestMiss = 0;
  private acLowestHit = Infinity;
  private acDiscovered = false;

  // HP discovery: hidden until monster type has been defeated once
  private hpRevealed = false;

  // Item drops collected this battle
  private droppedItemIds: string[] = [];
  private weatherParticles: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private stormLightningTimer: Phaser.Time.TimerEvent | null = null;
  private biome = "grass";
  private bgImage: Phaser.GameObjects.Image | null = null;

  constructor() {
    super({ key: "BattleScene" });
  }

  init(data: {
    player: PlayerState;
    monster: Monster;
    defeatedBosses: Set<string>;
    codex: CodexData;
    timeStep?: number;
    weatherState?: WeatherState;
    biome?: string;
    savedSpecialNpcs?: SavedSpecialNpc[];
  }): void {
    this.player = data.player;
    this.monster = data.monster;
    this.monsterHp = data.monster.hp;
    this.defeatedBosses = data.defeatedBosses;
    this.codex = data.codex;
    this.timeStep = data.timeStep ?? 0;
    this.weatherState = data.weatherState ?? createWeatherState();
    this.biome = data.biome ?? "grass";
    this.savedSpecialNpcs = data.savedSpecialNpcs ?? [];
    this.phase = "init";
    this.logLines = [];
    this.actionButtons = [];
    this.spellMenu = null;
    this.itemMenu = null;
    this.abilityMenu = null;
    this.acHighestMiss = 0;
    this.acLowestHit = Infinity;
    this.acDiscovered = false;
    this.hpRevealed = (this.codex.entries[this.monster.id]?.timesDefeated ?? 0) >= 1;
    this.playerDefending = false;
    this.monsterDefending = false;
    this.droppedItemIds = [];
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x0a0a1a);
    this.cameras.main.fadeIn(300);

    this.drawBattleUI();
    this.drawTimeSky();
    this.drawCelestialBody();
    this.setupDebug();
    this.createWeatherParticles();
    this.applyDayNightTint();

    // ESC closes any open sub-menu
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on("down", () => {
      this.closeAllSubMenus();
    });
    // A/D or Left/Right for sub-menu paging
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT).on("down", () => this.battleMenuPageChange(-1));
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT).on("down", () => this.battleMenuPageChange(1));
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A).on("down", () => this.battleMenuPageChange(-1));
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D).on("down", () => this.battleMenuPageChange(1));

    this.rollForInitiative();

    // Start battle or boss music
    if (audioEngine.initialized) {
      if (this.monster.isBoss) {
        audioEngine.playBossMusic(this.monster.id);
      } else {
        audioEngine.playBattleMusic();
      }
    }
  }

  update(): void {
    this.updateDebugPanel();
    this.updateButtonStates();
  }

  private drawBattleUI(): void {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    // Full battle background — biome or boss-specific
    const bgKey = this.monster.isBoss
      ? `bg_boss_${this.monster.id}`
      : `bg_${this.biome}`;
    if (this.textures.exists(bgKey)) {
      this.bgImage = this.add.image(w / 2, h / 2, bgKey);
    } else {
      // Fallback flat fill
      const bg = this.add.graphics();
      bg.fillStyle(0x151530, 1);
      bg.fillRect(0, 0, w, h);
      this.bgImage = null;
      bg.fillRect(0, 0, w, h);
    }

    // --- Monster (center, below its info box) ---
    const textureKey = this.monster.isBoss ? "monster_boss" : "monster";
    this.monsterSprite = this.add.sprite(w * 0.55, h * 0.30, textureKey);
    this.monsterSprite.setTint(this.monster.color);
    this.monsterSprite.setScale(this.monster.isBoss ? 1.8 : 2.0);
    this.monsterSprite.setDepth(1); // above sky overlay

    // Monster name and HP bar (centered above monster)
    this.monsterText = this.add
      .text(w * 0.55, h * 0.05, "", {
        fontSize: "13px",
        fontFamily: "monospace",
        color: "#ff6666",
        align: "center",
        backgroundColor: "#0a0a1a80",
        padding: { x: 6, y: 4 },
      })
      .setOrigin(0.5, 0)
      .setDepth(2);
    this.updateMonsterDisplay();

    // --- Player (foreground, lower-left) ---
    // Prefer the equipped texture (reflects weapon, shield, custom skin & hair)
    const equippedKey = `player_equipped_${this.player.appearanceId}`;
    const baseKey = `player_${this.player.appearanceId}`;
    const playerTextureKey = this.textures.exists(equippedKey) ? equippedKey : baseKey;
    this.playerSprite = this.add.sprite(w * 0.22, h * 0.50, playerTextureKey);
    this.playerSprite.setScale(2.0);
    this.playerSprite.setFlipX(false);
    this.playerSprite.setDepth(1.5); // above monster (foreground perspective)

    // Player name + HP/MP bar (right below player sprite)
    this.playerStatsText = this.add
      .text(w * 0.22, h * 0.60, "", {
        fontSize: "13px",
        fontFamily: "monospace",
        color: "#88ccff",
        align: "center",
        lineSpacing: 3,
        backgroundColor: "#0a0a1a80",
        padding: { x: 6, y: 4 },
      })
      .setOrigin(0.5, 0)
      .setDepth(2);
    this.updatePlayerStats();

    // Draw biome-specific foreground terrain for depth
    this.drawTerrainForeground();

    // Battle log (bottom strip) — scrollable
    this.logAreaY = h * 0.78;
    this.logAreaH = h * 0.22;
    const logBg = this.add.graphics();
    logBg.fillStyle(0x1a1a2e, 0.95);
    logBg.fillRect(0, this.logAreaY, w, this.logAreaH);
    logBg.lineStyle(1, 0xc0a060, 0.5);
    logBg.strokeRect(0, this.logAreaY, w, this.logAreaH);
    logBg.setDepth(3);

    // Scrollable container for log text
    this.logContainer = this.add.container(0, 0);
    this.logContainer.setDepth(4);
    this.logText = this.add.text(10, this.logAreaY + 4, "", {
      fontSize: "12px",
      fontFamily: "monospace",
      color: "#ccc",
      wordWrap: { width: w * 0.5 - 20 },
      lineSpacing: 5,
    });
    this.logContainer.add(this.logText);

    // Mask to clip log to the log area
    this.logMaskGraphics = this.make.graphics({ x: 0, y: 0 });
    this.logMaskGraphics.fillStyle(0xffffff);
    this.logMaskGraphics.fillRect(0, this.logAreaY, w * 0.52, this.logAreaH);
    const logMask = this.logMaskGraphics.createGeometryMask();
    this.logContainer.setMask(logMask);

    // Mouse wheel scrolling on the log area
    this.input.on("wheel", (_pointer: Phaser.Input.Pointer, _gos: Phaser.GameObjects.GameObject[], _dx: number, dy: number) => {
      const textHeight = this.logText.height;
      const visibleH = this.logAreaH - 8;
      const maxScroll = Math.max(0, textHeight - visibleH);
      if (maxScroll <= 0) return;
      const currentY = this.logText.y - (this.logAreaY + 4);
      const newY = Phaser.Math.Clamp(currentY - dy * 0.5, -maxScroll, 0);
      this.logText.setY(this.logAreaY + 4 + newY);
    });

    // Action buttons (bottom-right area)
    this.createActionButtons();
  }

  private createActionButtons(): void {
    // Clear existing
    this.actionButtons.forEach((b) => b.destroy());
    this.actionButtons = [];
    if (this.spellMenu) {
      this.spellMenu.destroy();
      this.spellMenu = null;
    }
    if (this.itemMenu) {
      this.itemMenu.destroy();
      this.itemMenu = null;
    }
    if (this.abilityMenu) {
      this.abilityMenu.destroy();
      this.abilityMenu = null;
    }

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const hasAbilities = (this.player.knownAbilities ?? []).length > 0;
    const btnX = w * 0.52;
    const btnY = h * 0.80;
    const btnW = 110;
    const btnH = 28;
    const gap = 5;

    const actions: { label: string; action: () => void }[] = [
      { label: "⚔ Attack", action: () => this.doPlayerAttack() },
    ];
    actions.push({ label: "🛡 Defend", action: () => this.doDefend() });
    if (hasAbilities) {
      actions.push({ label: "⚡ Abilities", action: () => this.showAbilityMenu() });
    }
    actions.push(
      { label: "✦ Spells", action: () => this.showSpellMenu() },
      { label: "🎒 Items", action: () => this.showItemMenu() },
      { label: "🏃 Flee", action: () => this.doFlee() },
    );

    actions.forEach((act, i) => {
      const container = this.add.container(btnX + (i % 2) * (btnW + gap), btnY + Math.floor(i / 2) * (btnH + gap));
      container.setDepth(5);

      const bg = this.add
        .image(0, 0, "button")
        .setOrigin(0, 0)
        .setDisplaySize(btnW, btnH)
        .setInteractive({ useHandCursor: true });

      const label = this.add
        .text(btnW / 2, btnH / 2, act.label, {
          fontSize: "13px",
          fontFamily: "monospace",
          color: "#ddd",
        })
        .setOrigin(0.5);

      bg.on("pointerover", () => {
        bg.setTexture("buttonHover");
        label.setColor("#ffd700");
      });
      bg.on("pointerout", () => {
        bg.setTexture("button");
        label.setColor("#ddd");
      });
      bg.on("pointerdown", () => {
        if (this.phase === "playerTurn") act.action();
      });

      container.add([bg, label]);
      this.actionButtons.push(container);
    });

    // Set initial visual state
    this.updateButtonStates();
  }

  /** Dim or enable action buttons based on current phase. */
  private updateButtonStates(): void {
    const enabled = this.phase === "playerTurn";
    for (const btn of this.actionButtons) {
      btn.setAlpha(enabled ? 1 : 0.4);
    }
  }

  /** Reset bonus action tracking for a new player turn. */
  private startPlayerTurn(): void {
    this.bonusActionUsed = false;
    this.itemsUsedThisTurn = 0;
    this.turnActionUsed = false;
    this.phase = "playerTurn";
  }

  private closeAllSubMenus(): void {
    if (this.spellMenu) { this.spellMenu.destroy(); this.spellMenu = null; }
    if (this.itemMenu) { this.itemMenu.destroy(); this.itemMenu = null; }
    if (this.abilityMenu) { this.abilityMenu.destroy(); this.abilityMenu = null; }
  }

  /** Handle A/D or Left/Right paging in open battle sub-menus. */
  private battleMenuPageChange(dir: number): void {
    if (this.spellMenu) {
      this.battleSpellPage += dir;
      this.showSpellMenu(true);
    } else if (this.abilityMenu) {
      this.battleAbilityPage += dir;
      this.showAbilityMenu(true);
    } else if (this.itemMenu) {
      this.battleItemPage += dir;
      this.showItemMenu(true);
    }
  }

  private showSpellMenu(keepPage = false): void {
    if (this.spellMenu && !keepPage) {
      this.spellMenu.destroy();
      this.spellMenu = null;
      return;
    }
    this.closeAllSubMenus();
    if (!keepPage) this.battleSpellPage = 0;

    const w = this.cameras.main.width;
    const spells = this.player.knownSpells
      .map((id) => getSpell(id))
      .filter((s): s is Spell => s !== undefined && s.type !== "utility");

    if (spells.length === 0) { this.addLog("No spells known!"); return; }

    const MAX_PER_PAGE = 5;
    const totalPages = Math.max(1, Math.ceil(spells.length / MAX_PER_PAGE));
    this.battleSpellPage = Math.max(0, Math.min(this.battleSpellPage, totalPages - 1));
    const start = this.battleSpellPage * MAX_PER_PAGE;
    const visible = spells.slice(start, start + MAX_PER_PAGE);
    const rowH = 36;
    const menuH = visible.length * rowH + (totalPages > 1 ? 20 : 0) + 10;

    const container = this.add.container(w * 0.52, this.cameras.main.height * 0.78 - menuH - 10);
    container.setDepth(6);

    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a3e, 0.95);
    bg.fillRect(-5, -5, 260, menuH);
    bg.lineStyle(1, 0xc0a060, 1);
    bg.strokeRect(-5, -5, 260, menuH);
    container.add(bg);

    visible.forEach((spell, i) => {
      const canCast = this.player.mp >= spell.mpCost;
      const color = canCast ? "#aaddff" : "#666";
      const text = this.add.text(0, i * rowH, `${spell.name} (${spell.mpCost} MP)`, {
        fontSize: "12px", fontFamily: "monospace", color,
      }).setInteractive({ useHandCursor: canCast });
      const desc = this.add.text(0, i * rowH + 14, spell.description, {
        fontSize: "9px", fontFamily: "monospace", color: "#888",
        wordWrap: { width: 250 },
      });
      if (canCast) {
        text.on("pointerover", () => text.setColor("#ffd700"));
        text.on("pointerout", () => text.setColor(color));
        text.on("pointerdown", () => { this.closeAllSubMenus(); this.doPlayerSpell(spell.id); });
      }
      container.add([text, desc]);
    });

    if (totalPages > 1) {
      const navY = visible.length * rowH;
      const prevBtn = this.add.text(10, navY, "◄ A", {
        fontSize: "10px", fontFamily: "monospace", color: this.battleSpellPage > 0 ? "#aaa" : "#444",
      }).setInteractive({ useHandCursor: this.battleSpellPage > 0 });
      if (this.battleSpellPage > 0) {
        prevBtn.on("pointerover", () => prevBtn.setColor("#ffd700"));
        prevBtn.on("pointerout", () => prevBtn.setColor("#aaa"));
        prevBtn.on("pointerdown", () => { this.battleSpellPage--; this.showSpellMenu(true); });
      }
      container.add(prevBtn);

      const pageLabel = this.add.text(120, navY, `${this.battleSpellPage + 1}/${totalPages}`, {
        fontSize: "10px", fontFamily: "monospace", color: "#888",
      }).setOrigin(0.5, 0);
      container.add(pageLabel);

      const nextBtn = this.add.text(200, navY, "D ►", {
        fontSize: "10px", fontFamily: "monospace", color: this.battleSpellPage < totalPages - 1 ? "#aaa" : "#444",
      }).setInteractive({ useHandCursor: this.battleSpellPage < totalPages - 1 });
      if (this.battleSpellPage < totalPages - 1) {
        nextBtn.on("pointerover", () => nextBtn.setColor("#ffd700"));
        nextBtn.on("pointerout", () => nextBtn.setColor("#aaa"));
        nextBtn.on("pointerdown", () => { this.battleSpellPage++; this.showSpellMenu(true); });
      }
      container.add(nextBtn);
    }

    this.spellMenu = container;
  }

  private showAbilityMenu(keepPage = false): void {
    if (this.abilityMenu && !keepPage) {
      this.abilityMenu.destroy();
      this.abilityMenu = null;
      return;
    }
    this.closeAllSubMenus();
    if (!keepPage) this.battleAbilityPage = 0;

    const w = this.cameras.main.width;
    const abilities = (this.player.knownAbilities ?? [])
      .map((id) => getAbility(id))
      .filter((a): a is Ability => a !== undefined && a.type !== "utility");

    if (abilities.length === 0) { this.addLog("No abilities known!"); return; }

    const MAX_PER_PAGE = 5;
    const totalPages = Math.max(1, Math.ceil(abilities.length / MAX_PER_PAGE));
    this.battleAbilityPage = Math.max(0, Math.min(this.battleAbilityPage, totalPages - 1));
    const start = this.battleAbilityPage * MAX_PER_PAGE;
    const visible = abilities.slice(start, start + MAX_PER_PAGE);
    const rowH = 36;
    const menuH = visible.length * rowH + (totalPages > 1 ? 20 : 0) + 10;

    const container = this.add.container(w * 0.52, this.cameras.main.height * 0.78 - menuH - 10);
    container.setDepth(6);

    const bg = this.add.graphics();
    bg.fillStyle(0x1a2a1e, 0.95);
    bg.fillRect(-5, -5, 260, menuH);
    bg.lineStyle(1, 0xc0a060, 1);
    bg.strokeRect(-5, -5, 260, menuH);
    container.add(bg);

    visible.forEach((ability, i) => {
      const canUse = this.player.mp >= ability.mpCost;
      const isBonusAction = ability.bonusAction ?? false;
      const bonusTag = isBonusAction ? " [BA]" : "";
      const color = canUse ? (isBonusAction ? "#aaffaa" : "#ffddaa") : "#666";
      const text = this.add.text(0, i * rowH, `${ability.name}${bonusTag} (${ability.mpCost} MP)`, {
        fontSize: "12px", fontFamily: "monospace", color,
      }).setInteractive({ useHandCursor: canUse });
      const desc = this.add.text(0, i * rowH + 14, ability.description, {
        fontSize: "9px", fontFamily: "monospace", color: "#888",
        wordWrap: { width: 250 },
      });
      if (canUse) {
        text.on("pointerover", () => text.setColor("#ffd700"));
        text.on("pointerout", () => text.setColor(color));
        text.on("pointerdown", () => { this.closeAllSubMenus(); this.doPlayerAbility(ability.id); });
      }
      container.add([text, desc]);
    });

    if (totalPages > 1) {
      const navY = visible.length * rowH;
      const prevBtn = this.add.text(10, navY, "◄ A", {
        fontSize: "10px", fontFamily: "monospace", color: this.battleAbilityPage > 0 ? "#aaa" : "#444",
      }).setInteractive({ useHandCursor: this.battleAbilityPage > 0 });
      if (this.battleAbilityPage > 0) {
        prevBtn.on("pointerover", () => prevBtn.setColor("#ffd700"));
        prevBtn.on("pointerout", () => prevBtn.setColor("#aaa"));
        prevBtn.on("pointerdown", () => { this.battleAbilityPage--; this.showAbilityMenu(true); });
      }
      container.add(prevBtn);

      const pageLabel = this.add.text(120, navY, `${this.battleAbilityPage + 1}/${totalPages}`, {
        fontSize: "10px", fontFamily: "monospace", color: "#888",
      }).setOrigin(0.5, 0);
      container.add(pageLabel);

      const nextBtn = this.add.text(200, navY, "D ►", {
        fontSize: "10px", fontFamily: "monospace", color: this.battleAbilityPage < totalPages - 1 ? "#aaa" : "#444",
      }).setInteractive({ useHandCursor: this.battleAbilityPage < totalPages - 1 });
      if (this.battleAbilityPage < totalPages - 1) {
        nextBtn.on("pointerover", () => nextBtn.setColor("#ffd700"));
        nextBtn.on("pointerout", () => nextBtn.setColor("#aaa"));
        nextBtn.on("pointerdown", () => { this.battleAbilityPage++; this.showAbilityMenu(true); });
      }
      container.add(nextBtn);
    }

    this.abilityMenu = container;
  }

  private doPlayerAbility(abilityId: string): void {
    if (this.phase !== "playerTurn") return;

    const ability = getAbility(abilityId);
    if (!ability) return;

    // Bonus action abilities don't use the turn action
    if (ability.bonusAction) {
      if (this.bonusActionUsed) {
        this.addLog("Bonus action already used this turn!");
        return;
      }
    } else {
      if (this.turnActionUsed) {
        this.addLog("Turn action already used!");
        return;
      }
    }

    this.playerDefending = false;
    this.monsterDefending = false;

    if (ability.bonusAction) {
      // Bonus action ability — doesn't end the turn
      this.bonusActionUsed = true;
    } else {
      // Regular ability — ends the turn
      this.turnActionUsed = true;
      this.phase = "monsterTurn";
    }

    try {
      const weatherPenalty = getWeatherAccuracyPenalty(this.weatherState.current);
      const result = playerUseAbility(this.player, abilityId, this.monster, weatherPenalty);
      debugLog("Player ability", { abilityId, roll: result.roll, hit: result.hit, damage: result.damage, mpUsed: result.mpUsed });
      if (result.roll !== undefined) {
        debugPanelLog(
          `  ↳ [Player Ability ${abilityId}] d20=${result.roll} +${result.attackMod ?? 0} = ${result.totalRoll ?? 0} vs AC ${this.monster.ac} → ${result.hit ? (result.critical ? "CRIT" : "HIT") : "MISS"} dmg=${result.damage} mp=${result.mpUsed}`,
          false, "roll-detail"
        );
      }
      const rollSuffix = result.roll !== undefined
        ? this.formatPlayerRoll(result.roll, result.attackMod ?? 0, result.totalRoll ?? 0, result.hit, result.critical)
        : "";
      this.addLog(result.message + rollSuffix);
      this.monsterHp = Math.max(0, this.monsterHp - result.damage);
      this.updateMonsterDisplay();
      this.updatePlayerStats();

      // Play distinct sounds for ability outcomes
      if (audioEngine.initialized) {
        if (result.critical) {
          audioEngine.playCriticalHitSFX();
        } else if (result.hit && result.damage > 0) {
          audioEngine.playAttackSFX();
        } else if (!result.hit) {
          audioEngine.playMissSFX();
        }
      }

      if (result.hit && result.damage > 0) {
        this.tweens.add({
          targets: this.monsterSprite,
          x: this.monsterSprite.x + 10,
          duration: 50,
          yoyo: true,
          repeat: 2,
        });
      }

      this.checkBattleEnd();

      // For bonus action abilities, add a log hint if player still has actions
      if (ability.bonusAction && this.phase === "playerTurn") {
        this.addLog("(Bonus action — you can still act this turn)");
        this.closeAllSubMenus();
      }
    } catch (err) {
      this.handleError("doPlayerAbility", err);
    }
  }

  private showItemMenu(keepPage = false): void {
    if (this.itemMenu && !keepPage) {
      this.itemMenu.destroy();
      this.itemMenu = null;
      return;
    }
    this.closeAllSubMenus();
    if (!keepPage) this.battleItemPage = 0;

    const w = this.cameras.main.width;
    const TOTAL_PAGES = 3;
    const PAGE_LABELS = ["Consumables", "Weapons", "Defense"];
    this.battleItemPage = Math.max(0, Math.min(this.battleItemPage, TOTAL_PAGES - 1));

    // Build rows for current page
    type MenuRow = { label: string; color: string; interactive: boolean; action?: () => void };
    const rows: MenuRow[] = [];

    if (this.battleItemPage === 0) {
      // --- Page 1: Consumables ---
      const consumables = this.player.inventory.filter((item) => item.type === "consumable" && item.id !== "chimaeraWing");
      type StackEntry = { item: Item; count: number };
      const stacks: StackEntry[] = [];
      const seen = new Map<string, number>();
      for (const item of consumables) {
        const existing = seen.get(item.id);
        if (existing !== undefined) { stacks[existing].count++; }
        else { seen.set(item.id, stacks.length); stacks.push({ item, count: 1 }); }
      }
      if (stacks.length === 0) {
        rows.push({ label: "  No consumables", color: "#666", interactive: false });
      }
      for (const stack of stacks) {
        const countLabel = stack.count > 1 ? ` x${stack.count}` : "";
        rows.push({
          label: `  ${stack.item.name}${countLabel} — ${stack.item.description}`,
          color: "#aaffaa", interactive: true,
          action: () => {
            const realIndex = this.player.inventory.findIndex(it => it.id === stack.item.id && it.type === "consumable");
            this.closeAllSubMenus();
            if (realIndex >= 0) this.doUseItem(realIndex);
          },
        });
      }
    } else if (this.battleItemPage === 1) {
      // --- Page 2: Weapons ---
      const inventoryWeapons = this.player.inventory.filter((item) => item.type === "weapon");
      if (this.player.equippedWeapon) {
        const eq = this.player.equippedWeapon;
        rows.push({ label: `  ► ${eq.name} (+${eq.effect} dmg) [main]`, color: "#88ff88", interactive: false });
      }
      if (this.player.equippedOffHand) {
        const oh = this.player.equippedOffHand;
        rows.push({ label: `  ► ${oh.name} (+${oh.effect} dmg) [off]`, color: "#88ff88", interactive: false });
      }
      let hasUnequipped = false;
      for (const wpn of inventoryWeapons) {
        if (wpn.id === this.player.equippedWeapon?.id) continue;
        if (wpn.id === this.player.equippedOffHand?.id) continue;
        hasUnequipped = true;
        rows.push({
          label: `  ${wpn.name} (+${wpn.effect} dmg) [equip]`,
          color: "#aaddff", interactive: true,
          action: () => { this.doBattleWeaponSwap(wpn); },
        });
      }
      if (rows.length === 0 && !hasUnequipped) {
        rows.push({ label: "  No weapons", color: "#666", interactive: false });
      }
    } else {
      // --- Page 3: Defense ---
      if (this.player.equippedArmor) {
        const arm = this.player.equippedArmor;
        rows.push({ label: `  ${arm.name} (+${arm.effect} AC) [eq]`, color: "#88ff88", interactive: false });
      }
      if (this.player.equippedShield) {
        const sh = this.player.equippedShield;
        rows.push({ label: `  ${sh.name} (+${sh.effect} AC) [eq]`, color: "#88ff88", interactive: false });
      }
      if (rows.length === 0) {
        rows.push({ label: "  No armor or shield", color: "#666", interactive: false });
      }
    }

    const rowH = 24;
    const headerH = 20;
    const navH = 22;
    const menuH = headerH + rows.length * rowH + navH + 10;
    const container = this.add.container(w * 0.52, this.cameras.main.height * 0.78 - menuH - 10);
    container.setDepth(6);

    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a3e, 0.95);
    bg.fillRect(-5, -5, 280, menuH);
    bg.lineStyle(1, 0xc0a060, 1);
    bg.strokeRect(-5, -5, 280, menuH);
    container.add(bg);

    // Page header
    const header = this.add.text(130, 0, `― ${PAGE_LABELS[this.battleItemPage]} ―`, {
      fontSize: "11px", fontFamily: "monospace", color: "#c0a060",
    }).setOrigin(0.5, 0);
    container.add(header);

    // Rows
    rows.forEach((row, i) => {
      const text = this.add.text(0, headerH + i * rowH, row.label, {
        fontSize: "11px", fontFamily: "monospace", color: row.color,
        wordWrap: { width: 270 },
      });
      if (row.interactive && row.action) {
        text.setInteractive({ useHandCursor: true });
        const baseColor = row.color;
        text.on("pointerover", () => text.setColor("#ffd700"));
        text.on("pointerout", () => text.setColor(baseColor));
        text.on("pointerdown", () => row.action!());
      }
      container.add(text);
    });

    // Navigation: ◄ A   page/total   D ►
    const navY = headerH + rows.length * rowH + 4;
    const prevBtn = this.add.text(10, navY, "◄ A", {
      fontSize: "10px", fontFamily: "monospace", color: this.battleItemPage > 0 ? "#aaa" : "#444",
    }).setInteractive({ useHandCursor: this.battleItemPage > 0 });
    if (this.battleItemPage > 0) {
      prevBtn.on("pointerover", () => prevBtn.setColor("#ffd700"));
      prevBtn.on("pointerout", () => prevBtn.setColor("#aaa"));
      prevBtn.on("pointerdown", () => { this.battleItemPage--; this.showItemMenu(true); });
    }
    container.add(prevBtn);

    const pageLabel = this.add.text(130, navY, `${this.battleItemPage + 1}/${TOTAL_PAGES}`, {
      fontSize: "10px", fontFamily: "monospace", color: "#888",
    }).setOrigin(0.5, 0);
    container.add(pageLabel);

    const nextBtn = this.add.text(230, navY, "D ►", {
      fontSize: "10px", fontFamily: "monospace", color: this.battleItemPage < TOTAL_PAGES - 1 ? "#aaa" : "#444",
    }).setInteractive({ useHandCursor: this.battleItemPage < TOTAL_PAGES - 1 });
    if (this.battleItemPage < TOTAL_PAGES - 1) {
      nextBtn.on("pointerover", () => nextBtn.setColor("#ffd700"));
      nextBtn.on("pointerout", () => nextBtn.setColor("#aaa"));
      nextBtn.on("pointerdown", () => { this.battleItemPage++; this.showItemMenu(true); });
    }
    container.add(nextBtn);

    this.itemMenu = container;
  }

  /** Swap main-hand weapon during battle (bonus action). */
  private doBattleWeaponSwap(newWeapon: Item): void {
    if (this.phase !== "playerTurn") return;
    if (this.bonusActionUsed) {
      this.addLog("Bonus action already used this turn!");
      return;
    }

    const oldWeapon = this.player.equippedWeapon;
    this.player.equippedWeapon = newWeapon;

    // If new weapon is two-handed, clear shield and off-hand
    if (newWeapon.twoHanded) {
      this.player.equippedShield = null;
      this.player.equippedOffHand = null;
    }
    // If new weapon is not light, clear off-hand
    if (!newWeapon.light || newWeapon.twoHanded) {
      this.player.equippedOffHand = null;
    }

    this.bonusActionUsed = true;
    const swapMsg = oldWeapon
      ? `Swapped ${oldWeapon.name} → ${newWeapon.name}!`
      : `Equipped ${newWeapon.name}!`;
    this.addLog(swapMsg + " (bonus action)");
    debugPanelLog(`  ↳ [Weapon Swap] ${swapMsg}`, false, "roll-detail");

    // Regenerate player sprite texture to reflect new weapon
    this.refreshBattlePlayerSprite();
    this.updatePlayerStats();

    this.closeAllSubMenus();
  }

  /** Regenerate the player equipped texture and update the battle sprite. */
  private refreshBattlePlayerSprite(): void {
    const renderer = new PlayerRenderer(this);
    // Create a dummy sprite for the renderer (it needs playerSprite to exist)
    renderer.playerSprite = this.playerSprite;
    renderer.refreshPlayerSprite(this.player);
    // The texture is regenerated in-place; update our sprite
    const texKey = `player_equipped_${this.player.appearanceId}`;
    if (this.textures.exists(texKey)) {
      this.playerSprite.setTexture(texKey);
    }
  }

  private updateMonsterDisplay(): void {
    const defendTag = this.monsterDefending ? " [DEF]" : "";
    if (this.hpRevealed) {
      const hpBar = this.getHpBar(this.monsterHp, this.monster.hp, 14);
      this.monsterText.setText(
        `${this.monster.name}${defendTag}\nHP: ${this.monsterHp}/${this.monster.hp}\n${hpBar}`
      );
    } else {
      this.monsterText.setText(
        `${this.monster.name}${defendTag}\nHP: ???`
      );
    }
    // Flash monster on hit
    if (this.monsterHp <= 0) {
      this.monsterSprite.setAlpha(0.3);
    }
  }

  private updatePlayerStats(): void {
    const p = this.player;
    const defendTag = this.playerDefending ? " [DEF]" : "";
    this.playerStatsText.setText(
      `${p.name} Lv.${p.level}${defendTag}\n` +
        `HP: ${p.hp}/${p.maxHp} ${this.getHpBar(p.hp, p.maxHp, 8)}\n` +
        `MP: ${p.mp}/${p.maxMp} ${this.getMpBar(p.mp, p.maxMp, 8)}\n` +
        `AC: ${getArmorClass(p)}${this.playerDefending ? "+2" : ""}`
    );
  }

  private getHpBar(current: number, max: number, length: number): string {
    const filled = Math.max(0, Math.min(length, Math.round((current / max) * length)));
    return "[" + "=".repeat(filled) + "-".repeat(length - filled) + "]";
  }

  private getMpBar(current: number, max: number, length: number): string {
    const filled = Math.max(0, Math.min(length, Math.round((current / max) * length)));
    return "[" + "#".repeat(filled) + "-".repeat(length - filled) + "]";
  }

  private addLog(msg: string): void {
    this.logLines.push(msg);
    // Show all log lines with a blank line at the end for readability
    this.logText.setText(this.logLines.join("\n") + "\n ");
    // Auto-scroll to bottom
    const textHeight = this.logText.height;
    const visibleH = this.logAreaH - 8;
    if (textHeight > visibleH) {
      this.logText.setY(this.logAreaY + 4 - (textHeight - visibleH));
    }
    // Also push to the HTML debug panel (always, panel visibility is toggled separately)
    debugPanelLog(msg, msg.startsWith("[DEBUG]"));
  }

  // --- Debug ---

  private setupDebug(): void {
    debugPanelLog(`── Battle: ${this.player.name} vs ${this.monster.name} ──`, true);

    const cb = { updateUI: () => this.updatePlayerStats() };

    // Shared hotkeys: G=Gold, H=Heal, P=MP, L=LvUp
    registerSharedHotkeys(this, this.player, cb);

    // Battle-only hotkeys
    const kKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.K);
    kKey.on("down", () => {
      if (!isDebug()) return;
      debugLog("CHEAT: Kill monster");
      debugPanelLog("[CHEAT] Monster killed!", true);
      this.monsterHp = 0;
      this.updateMonsterDisplay();
      if (this.phase === "playerTurn" || this.phase === "monsterTurn") {
        this.phase = "playerTurn";
        this.checkBattleEnd();
      }
    });

    // Slash commands: shared + battle-specific
    const cmds = buildSharedCommands(this.player, cb);

    cmds.set("kill", () => {
      this.monsterHp = 0;
      this.updateMonsterDisplay();
      if (this.phase === "playerTurn" || this.phase === "monsterTurn") {
        this.phase = "playerTurn";
        this.checkBattleEnd();
      }
      debugPanelLog(`[CMD] Monster killed!`, true);
    });

    // Help entries
    const helpEntries: HelpEntry[] = [
      { usage: "/kill", desc: "Kill monster instantly" },
      ...SHARED_HELP,
    ];

    registerCommandRouter(cmds, "Battle", helpEntries);
  }

  private updateDebugPanel(): void {
    const p = this.player;
    const defInfo = this.playerDefending ? " [DEF+2]" : "";
    const mDefInfo = this.monsterDefending ? " [DEF+2]" : "";
    debugPanelState(
      `BATTLE | Phase: ${this.phase} | ` +
      `Monster: ${this.monster.name} HP ${this.monsterHp}/${this.monster.hp} AC ${this.monster.ac}${mDefInfo} | ` +
      `Player: HP ${p.hp}/${p.maxHp} MP ${p.mp}/${p.maxMp} AC ${getArmorClass(p)}${defInfo} | ` +
      `Lv.${p.level} XP ${p.xp}/${xpForLevel(p.level + 1)} Gold ${p.gold}\n` +
      `Cheats: K=Kill H=Heal P=MP G=+100Gold L=LvUp X=MaxXP`
    );
  }

  private getAttackMod(): number {
    const profBonus = Math.floor((this.player.level - 1) / 4) + 2;
    return abilityModifier(this.player.stats.strength) + profBonus;
  }

  private getSpellMod(): number {
    const profBonus = Math.floor((this.player.level - 1) / 4) + 2;
    return abilityModifier(this.player.stats.intelligence) + profBonus;
  }

  // --- Combat Flow ---

  private rollForInitiative(): void {
    try {
      const dexMod = abilityModifier(this.player.stats.dexterity);
      const boost = getMonsterWeatherBoost(this.monster.id, this.weatherState.current);
      const result = rollInitiative(dexMod, this.monster.attackBonus + boost.initiativeBonus);
      debugLog("Initiative", { playerRoll: result.playerRoll, monsterRoll: result.monsterRoll, playerFirst: result.playerFirst });
      debugPanelLog(
        `  ↳ [Initiative] Player d20+mod=${result.playerRoll} vs Monster d20+mod=${result.monsterRoll}`,
        false, "roll-detail"
      );
      this.addLog(
        `⚔ ${this.monster.name} appears! You rolled ${result.playerRoll} for initiative.`
      );

      // Announce weather effects and monster boost
      const weatherPenalty = getWeatherAccuracyPenalty(this.weatherState.current);
      if (this.weatherState.current !== WeatherType.Clear) {
        this.addLog(`${WEATHER_LABEL[this.weatherState.current]} — attacks are harder to land (penalty: ${weatherPenalty})`);
      }
      if (boost.attackBonus > 0) {
        this.addLog(`${this.monster.name} thrives in this weather! (+${boost.initiativeBonus} Initiative, +${boost.attackBonus} ATK)`);
      }

      if (result.playerFirst) {
        this.addLog("You act first!");
        this.startPlayerTurn();
      } else {
        this.addLog(`${this.monster.name} acts first!`);
        this.phase = "monsterTurn";
        this.time.delayedCall(1000, () => this.doMonsterTurn());
      }
    } catch (err) {
      this.handleError("rollForInitiative", err);
    }
  }

  private doPlayerAttack(): void {
    if (this.phase !== "playerTurn") return;
    if (this.turnActionUsed) {
      this.addLog("Turn action already used!");
      return;
    }
    this.closeAllSubMenus();
    this.playerDefending = false; // reset defend on new action
    this.turnActionUsed = true;
    this.phase = "monsterTurn"; // prevent double actions

    try {
      const monsterDefBonus = this.monsterDefending ? 2 : 0;
      const weatherPenalty = getWeatherAccuracyPenalty(this.weatherState.current);
      const result = playerAttack(this.player, this.monster, monsterDefBonus, weatherPenalty);
      // Reset monster defend after player attacks
      this.monsterDefending = false;
      debugLog("Player attack", { roll: result.roll, hit: result.hit, critical: result.critical, damage: result.damage, monsterAC: this.monster.ac });
      debugPanelLog(
        `  ↳ [Player Attack] d20=${result.roll} +${result.attackMod} = ${result.totalRoll} vs AC ${this.monster.ac} → ${result.hit ? (result.critical ? "CRIT" : "HIT") : "MISS"} dmg=${result.damage}`,
        false, "roll-detail"
      );
      this.addLog(result.message + this.formatPlayerRoll(result.roll, result.attackMod, result.totalRoll, result.hit, result.critical));
      this.monsterHp = Math.max(0, this.monsterHp - result.damage);
      this.updateMonsterDisplay();

      // Play distinct attack sounds based on outcome
      if (audioEngine.initialized) {
        if (result.critical) {
          audioEngine.playCriticalHitSFX();
        } else if (result.hit) {
          audioEngine.playAttackSFX();
        } else {
          audioEngine.playMissSFX();
        }
      }

      if (result.hit) {
        this.tweens.add({
          targets: this.monsterSprite,
          x: this.monsterSprite.x + 10,
          duration: 50,
          yoyo: true,
          repeat: 2,
        });
      }

      // Off-hand bonus action: if player has an off-hand weapon and bonus action is unused,
      // automatically follow up with an off-hand attack (no ability mod bonus per D&D 5e TWF)
      if (this.player.equippedOffHand && !this.bonusActionUsed && this.monsterHp > 0) {
        this.bonusActionUsed = true;
        const offResult = playerOffHandAttack(this.player, this.monster, 0, weatherPenalty);
        debugLog("Player off-hand attack (bonus action)", { roll: offResult.roll, hit: offResult.hit, critical: offResult.critical, damage: offResult.damage });
        debugPanelLog(
          `  ↳ [Off-Hand] d20=${offResult.roll} +${offResult.attackMod} = ${offResult.totalRoll} vs AC ${this.monster.ac} → ${offResult.hit ? (offResult.critical ? "CRIT" : "HIT") : "MISS"} dmg=${offResult.damage}`,
          false, "roll-detail"
        );
        this.addLog(offResult.message + this.formatPlayerRoll(offResult.roll, offResult.attackMod, offResult.totalRoll, offResult.hit, offResult.critical));
        this.monsterHp = Math.max(0, this.monsterHp - offResult.damage);
        this.updateMonsterDisplay();

        if (audioEngine.initialized) {
          if (offResult.critical) audioEngine.playCriticalHitSFX();
          else if (offResult.hit) audioEngine.playAttackSFX();
          else audioEngine.playMissSFX();
        }
        if (offResult.hit) {
          this.tweens.add({ targets: this.monsterSprite, x: this.monsterSprite.x + 10, duration: 50, yoyo: true, repeat: 1 });
        }
      }

      this.checkBattleEnd();
    } catch (err) {
      this.handleError("doPlayerAttack", err);
    }
  }

  private doDefend(): void {
    if (this.phase !== "playerTurn") return;
    if (this.turnActionUsed) {
      this.addLog("Turn action already used!");
      return;
    }
    this.closeAllSubMenus();
    this.monsterDefending = false; // reset monster defend
    this.playerDefending = true;
    this.turnActionUsed = true;
    this.phase = "monsterTurn";
    const hasShield = !!this.player.equippedShield && !this.player.equippedWeapon?.twoHanded;
    const shieldNote = hasShield ? ", shield -1 dmg" : "";
    this.addLog(`${this.player.name} takes a defensive stance! (+2 AC${shieldNote})`);
    debugPanelLog(`  ↳ [Defend] AC ${getArmorClass(this.player)} → ${getArmorClass(this.player) + 2}${shieldNote}`, false, "roll-detail");
    this.updatePlayerStats();
    this.time.delayedCall(800, () => this.doMonsterTurn());
  }

  private doPlayerSpell(spellId: string): void {
    if (this.phase !== "playerTurn") return;
    if (this.turnActionUsed) {
      this.addLog("Turn action already used!");
      return;
    }
    this.playerDefending = false;
    this.monsterDefending = false;
    this.turnActionUsed = true;
    this.phase = "monsterTurn";

    try {
      const weatherPenalty = getWeatherAccuracyPenalty(this.weatherState.current);
      const result = playerCastSpell(this.player, spellId, this.monster, weatherPenalty);
      debugLog("Player spell", { spellId, roll: result.roll, hit: result.hit, damage: result.damage, mpUsed: result.mpUsed });
      if (result.roll !== undefined) {
        debugPanelLog(
          `  ↳ [Player Spell ${spellId}] d20=${result.roll} +${result.spellMod ?? 0} = ${result.totalRoll ?? 0} vs AC ${this.monster.ac} → ${result.autoHit ? "AUTO-HIT" : result.hit ? "HIT" : "MISS"} dmg=${result.damage} mp=${result.mpUsed}`,
          false, "roll-detail"
        );
      } else {
        debugPanelLog(
          `  ↳ [Player Spell ${spellId}] ${result.hit ? "SUCCESS" : "FAIL"} dmg=${result.damage} mp=${result.mpUsed}`,
          false, "roll-detail"
        );
      }
      const rollSuffix = result.roll !== undefined && !result.autoHit
        ? this.formatPlayerRoll(result.roll, result.spellMod ?? 0, result.totalRoll ?? 0, result.hit, false)
        : "";
      this.addLog(result.message + rollSuffix);
      this.monsterHp = Math.max(0, this.monsterHp - result.damage);
      this.updateMonsterDisplay();
      this.updatePlayerStats();

      if (result.hit && result.damage > 0) {
        if (audioEngine.initialized) audioEngine.playAttackSFX();
        this.cameras.main.flash(200, 100, 100, 255);
      } else if (!result.hit && audioEngine.initialized) {
        audioEngine.playMissSFX();
      }

      this.checkBattleEnd();
    } catch (err) {
      this.handleError("doPlayerSpell", err);
    }
  }

  private doUseItem(itemIndex: number): void {
    if (this.phase !== "playerTurn") return;

    // Items are bonus actions: 1st item is free, 2nd item sacrifices turn action
    if (this.itemsUsedThisTurn >= 2) {
      this.addLog("Cannot use more than 2 items per turn!");
      return;
    }
    if (this.itemsUsedThisTurn === 1 && this.turnActionUsed) {
      this.addLog("No actions remaining this turn!");
      return;
    }

    try {
      const result = useItem(this.player, itemIndex);
      this.addLog(result.message);
      if (result.used && audioEngine.initialized) audioEngine.playPotionSFX();
      this.updatePlayerStats();

      if (result.used) {
        this.itemsUsedThisTurn++;
        if (this.itemsUsedThisTurn === 1) {
          // First item: bonus action used, player still has turn action
          this.addLog("(Bonus action — you can still act this turn)");
          this.closeAllSubMenus();
        } else {
          // Second item: sacrifices turn action, end turn
          this.turnActionUsed = true;
          this.addLog("(Used 2 items — turn action spent)");
          this.closeAllSubMenus();
          this.phase = "monsterTurn";
          this.time.delayedCall(800, () => this.doMonsterTurn());
        }
      }
    } catch (err) {
      this.handleError("doUseItem", err);
    }
  }

  private doFlee(): void {
    if (this.phase !== "playerTurn") return;
    if (this.turnActionUsed) {
      this.addLog("Turn action already used!");
      return;
    }

    if (this.monster.isBoss) {
      this.addLog("Cannot flee from a boss fight!");
      return;
    }

    this.closeAllSubMenus();
    this.turnActionUsed = true;
    this.phase = "monsterTurn";
    try {
      const dexMod = abilityModifier(this.player.stats.dexterity);
      const result = attemptFlee(dexMod);
      debugLog("Flee attempt", { success: result.success, dexMod });
      debugPanelLog(
        `  ↳ [Flee] dexMod=${dexMod} → ${result.success ? "ESCAPED" : "FAILED"}`,
        false, "roll-detail"
      );
      this.addLog(result.message);

      if (result.success) {
        this.phase = "fled";
        this.time.delayedCall(1000, () => this.returnToOverworld());
      } else {
        this.time.delayedCall(800, () => this.doMonsterTurn());
      }
    } catch (err) {
      this.handleError("doFlee", err);
    }
  }

  private doMonsterTurn(): void {
    if (this.phase === "victory" || this.phase === "defeat" || this.phase === "fled")
      return;

    try {
      // Small chance (8%) the monster defends instead of attacking
      if (Math.random() < 0.08) {
        this.monsterDefending = true;
        this.addLog(`${this.monster.name} takes a defensive stance!`);
        debugPanelLog(`  ↳ [Monster Defend] AC ${this.monster.ac} → ${this.monster.ac + 2}`, false, "roll-detail");
        this.updateMonsterDisplay();
        this.playerDefending = false;
        this.updatePlayerStats();
        this.startPlayerTurn();
        return;
      }

      // Reset monster defend at start of their action turn
      this.monsterDefending = false;
      this.updateMonsterDisplay();

      // Check for monster ability use
      if (this.monster.abilities) {
        for (const ability of this.monster.abilities) {
          if (Math.random() < ability.chance) {
            const result = monsterUseAbility(ability, this.monster, this.player);
            debugLog("Monster ability", { name: ability.name, damage: result.damage, healing: result.healing });
            debugPanelLog(
              `  ↳ [Monster Ability] ${ability.name} → dmg=${result.damage} heal=${result.healing}`,
              false, "roll-detail"
            );
            this.addLog(result.message);

            if (result.healing > 0) {
              this.monsterHp = Math.min(this.monster.hp, this.monsterHp + result.healing);
              this.updateMonsterDisplay();
            }

            this.updatePlayerStats();
            if (result.damage > 0) {
              this.cameras.main.shake(200, 0.015);
            }

            if (this.player.hp <= 0) {
              this.phase = "defeat";
              this.addLog("You have been defeated...");
              this.time.delayedCall(2000, () => this.handleDefeat());
              return;
            }

            this.playerDefending = false;
            this.updatePlayerStats();
            this.startPlayerTurn();
            return;
          }
        }
      }

      // Normal attack — pass player defend bonus + weather effects
      const defendBonus = this.playerDefending ? 2 : 0;
      const weatherPenalty = getWeatherAccuracyPenalty(this.weatherState.current);
      const boost = getMonsterWeatherBoost(this.monster.id, this.weatherState.current);
      const result = monsterAttack(this.monster, this.player, defendBonus, weatherPenalty, boost.attackBonus);

      // Shield defend bonus: reduce incoming damage by 1 when defending with a shield equipped
      const shieldDefendReduction = (this.playerDefending && this.player.equippedShield && !this.player.equippedWeapon?.twoHanded) ? 1 : 0;
      if (shieldDefendReduction > 0 && result.hit && result.damage > 0) {
        const reduced = Math.min(shieldDefendReduction, result.damage);
        result.damage -= reduced;
        // Re-apply corrected damage to player HP (monsterAttack already subtracted the original)
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + reduced);
      }

      debugLog("Monster attack", {
        naturalRoll: result.roll,
        attackBonus: result.attackBonus,
        totalRoll: result.totalRoll,
        targetAC: result.targetAC,
        hit: result.hit,
        critical: result.critical,
        damage: result.damage,
        playerHP: this.player.hp,
        playerDefending: this.playerDefending,
        shieldDefendReduction,
      });
      debugPanelLog(
        `  ↳ [Monster Attack] d20=${result.roll} +=${result.attackBonus} = ${result.totalRoll} vs AC ${result.targetAC}${this.playerDefending ? " (DEF+2)" : ""}${shieldDefendReduction ? " (shield -1)" : ""} → ${result.hit ? (result.critical ? "CRIT" : "HIT") : "MISS"} dmg=${result.damage} → Player HP ${this.player.hp}`,
        false, "roll-detail"
      );
      // Only show the outcome message, never the enemy's roll details
      this.addLog(result.message);

      // Reset player defend after monster's turn
      this.playerDefending = false;
      this.updatePlayerStats();

      if (result.hit) {
        if (audioEngine.initialized) {
          if (result.critical) {
            audioEngine.playCriticalHitSFX();
          } else {
            audioEngine.playAttackSFX();
          }
        }
        this.cameras.main.shake(150, 0.01);
        // Shake player sprite
        this.tweens.add({
          targets: this.playerSprite,
          x: this.playerSprite.x - 8,
          duration: 50,
          yoyo: true,
          repeat: 2,
        });
      } else if (audioEngine.initialized) {
        audioEngine.playMissSFX();
      }

      if (this.player.hp <= 0) {
        this.phase = "defeat";
        this.addLog("You have been defeated...");
        this.time.delayedCall(2000, () => this.handleDefeat());
        return;
      }

      this.startPlayerTurn();
    } catch (err) {
      this.handleError("doMonsterTurn", err);
    }
  }

  private checkBattleEnd(): void {
    try {
      if (this.monsterHp <= 0) {
        this.phase = "victory";
        this.addLog(`${this.monster.name} is defeated!`);

        // Roll for item drops
        const droppedItems: Item[] = [];
        if (this.monster.drops) {
          for (const drop of this.monster.drops) {
            if (Math.random() < drop.chance) {
              const item = getItem(drop.itemId);
              if (item) {
                droppedItems.push({ ...item });
                this.droppedItemIds.push(drop.itemId);
              }
            }
          }
        }

        // Award XP and gold
        this.player.gold += this.monster.goldReward;
        const xpResult = awardXP(this.player, this.monster.xpReward);
        this.addLog(
          `Gained ${this.monster.xpReward} XP and ${this.monster.goldReward} gold!`
        );

        // Award dropped items
        for (const item of droppedItems) {
          this.player.inventory.push(item);
          this.addLog(`🌟 Found: ${item.name}!`);
        }

        if (xpResult.pendingLevels > 0) {
          this.addLog(`⬆ ${xpResult.pendingLevels} level-up${xpResult.pendingLevels > 1 ? "s" : ""} pending! Rest to level up.`);
        }

        // Track boss defeats
        if (this.monster.isBoss) {
          this.defeatedBosses.add(this.monster.id);
        }

        // Record in bestiary
        recordDefeat(this.codex, this.monster, this.acDiscovered, this.droppedItemIds);

        // Play victory jingle
        if (audioEngine.initialized) {
          audioEngine.playVictoryJingle();
        }

        this.updatePlayerStats();
        this.time.delayedCall(2500, () => this.returnToOverworld());
      } else {
        this.time.delayedCall(800, () => this.doMonsterTurn());
      }
    } catch (err) {
      this.handleError("checkBattleEnd", err);
    }
  }

  private handleDefeat(): void {
    // Play defeat music
    if (audioEngine.initialized) {
      audioEngine.playDefeatMusic();
    }
    // On defeat: restore half HP, lose some gold, return to last visited town
    this.player.hp = Math.floor(this.player.maxHp / 2);
    this.player.mp = Math.floor(this.player.maxMp / 2);
    this.player.gold = Math.floor(this.player.gold * 0.7);
    // Return to last town (or Willowdale as fallback)
    this.player.position.x = this.player.lastTownX ?? 2;
    this.player.position.y = this.player.lastTownY ?? 2;
    this.player.position.chunkX = this.player.lastTownChunkX ?? 1;
    this.player.position.chunkY = this.player.lastTownChunkY ?? 1;
    this.player.position.inDungeon = false;
    this.player.position.dungeonId = "";
    this.addLog("You wake up in town, bruised but alive...");
    this.time.delayedCall(2000, () => this.returnToOverworld());
  }

  /**
   * Format a player roll string and track AC discovery.
   * Crits (nat 20) and fumbles (nat 1) don't reveal AC info.
   */
  private formatPlayerRoll(
    naturalRoll: number | undefined,
    mod: number,
    total: number,
    hit: boolean,
    critical: boolean | undefined
  ): string {
    if (naturalRoll === undefined || naturalRoll === 20 || naturalRoll === 1) return "";

    // Track AC discovery
    if (hit) {
      this.acLowestHit = Math.min(this.acLowestHit, total);
    } else {
      this.acHighestMiss = Math.max(this.acHighestMiss, total);
    }

    if (!this.acDiscovered && this.acLowestHit === this.acHighestMiss + 1) {
      this.acDiscovered = true;
      // Also update the bestiary immediately
      discoverAC(this.codex, this.monster.id);
      this.addLog(`🔍 You deduce the ${this.monster.name}'s AC is ${this.acLowestHit}!`);
    }

    const acSuffix = this.acDiscovered ? ` vs AC ${this.monster.ac}` : "";
    return ` (d20: ${naturalRoll} +${mod} = ${total}${acSuffix})`;
  }

  private handleError(context: string, err: unknown): void {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[BattleScene.${context}]`, err);
    debugPanelLog(`ERROR in ${context}: ${msg}`);
    this.addLog(`⚠ Something went wrong (${context})`);
  }

  private drawTimeSky(): void {
    _drawTimeSky(this, this.biome, this.timeStep);
  }

  private drawCelestialBody(): void {
    _drawCelestialBody(this, this.biome, this.timeStep);
  }

  private drawTerrainForeground(): void {
    _drawTerrainForeground(this, this.biome);
  }

  private applyDayNightTint(): void {
    applyBattleDayNightTint(this, this.biome, this.timeStep, this.bgImage, this.monsterSprite, this.monster.color, this.playerSprite);
  }

  private createWeatherParticles(): void {
    const result = createBattleWeatherParticles(this, this.weatherState, this.weatherParticles, this.stormLightningTimer);
    this.weatherParticles = result.particles;
    this.stormLightningTimer = result.timer;
  }

  private returnToOverworld(): void {
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(500, () => {
      this.scene.start("OverworldScene", {
        player: this.player,
        defeatedBosses: this.defeatedBosses,
        codex: this.codex,
        timeStep: this.timeStep,
        weatherState: this.weatherState,
        savedSpecialNpcs: this.savedSpecialNpcs,
      });
    });
  }
}
