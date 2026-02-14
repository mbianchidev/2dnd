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
  playerCastSpell,
  playerUseAbility,
  monsterAttack,
  monsterUseAbility,
  attemptFlee,
} from "../systems/combat";
import { abilityModifier } from "../utils/dice";
import { isDebug, debugLog, debugPanelLog, debugPanelState, debugPanelClear } from "../config";
import type { BestiaryData } from "../systems/bestiary";
import { recordDefeat, discoverAC } from "../systems/bestiary";
import { type WeatherState, WeatherType, createWeatherState, getWeatherAccuracyPenalty, getMonsterWeatherBoost, WEATHER_LABEL } from "../systems/weather";
import type { SavedSpecialNpc } from "../data/npcs";
import { registerSharedHotkeys, buildSharedCommands, registerCommandRouter, SHARED_HELP, type HelpEntry } from "../systems/debug";
import { getTimePeriod, TimePeriod, PERIOD_TINT } from "../systems/daynight";
import { audioEngine } from "../systems/audio";

type BattlePhase = "init" | "playerTurn" | "monsterTurn" | "victory" | "defeat" | "fled";

export class BattleScene extends Phaser.Scene {
  private player!: PlayerState;
  private monster!: Monster;
  private monsterHp!: number;
  private defeatedBosses!: Set<string>;
  private bestiary!: BestiaryData;
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
    bestiary: BestiaryData;
    timeStep?: number;
    weatherState?: WeatherState;
    biome?: string;
    savedSpecialNpcs?: SavedSpecialNpc[];
  }): void {
    this.player = data.player;
    this.monster = data.monster;
    this.monsterHp = data.monster.hp;
    this.defeatedBosses = data.defeatedBosses;
    this.bestiary = data.bestiary;
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
    this.playerDefending = false;
    this.monsterDefending = false;
    this.droppedItemIds = [];
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x0a0a1a);
    this.cameras.main.fadeIn(300);

    this.drawBattleUI();
    this.drawCelestialBody();
    this.setupDebug();
    this.createWeatherParticles();
    this.applyDayNightTint();
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

    // --- Monster (top-right) ---
    const textureKey = this.monster.isBoss ? "monster_boss" : "monster";
    this.monsterSprite = this.add.sprite(w * 0.72, h * 0.18, textureKey);
    this.monsterSprite.setTint(this.monster.color);
    this.monsterSprite.setScale(this.monster.isBoss ? 1.2 : 1.5);

    // Monster name and HP bar (below monster sprite)
    this.monsterText = this.add
      .text(w * 0.72, h * 0.32, "", {
        fontSize: "13px",
        fontFamily: "monospace",
        color: "#ff6666",
        align: "center",
      })
      .setOrigin(0.5);
    this.updateMonsterDisplay();

    // --- Player (bottom-left) ---
    // Prefer the equipped texture (reflects weapon, shield, custom skin & hair)
    const equippedKey = `player_equipped_${this.player.appearanceId}`;
    const baseKey = `player_${this.player.appearanceId}`;
    const playerTextureKey = this.textures.exists(equippedKey) ? equippedKey : baseKey;
    this.playerSprite = this.add.sprite(w * 0.25, h * 0.52, playerTextureKey);
    this.playerSprite.setScale(1.5);
    this.playerSprite.setFlipX(false);

    // Player name + HP/MP bar (below player sprite)
    this.playerStatsText = this.add
      .text(w * 0.25, h * 0.64, "", {
        fontSize: "13px",
        fontFamily: "monospace",
        color: "#88ccff",
        align: "center",
        lineSpacing: 3,
      })
      .setOrigin(0.5, 0);
    this.updatePlayerStats();

    // Battle log (bottom strip, above action buttons) — scrollable
    this.logAreaY = h * 0.78;
    this.logAreaH = h * 0.22;
    const logBg = this.add.graphics();
    logBg.fillStyle(0x1a1a2e, 0.95);
    logBg.fillRect(0, this.logAreaY, w, this.logAreaH);
    logBg.lineStyle(1, 0xc0a060, 0.5);
    logBg.strokeRect(0, this.logAreaY, w, this.logAreaH);

    // Scrollable container for log text
    this.logContainer = this.add.container(0, 0);
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
      { label: "🛡 Defend", action: () => this.doDefend() },
    ];
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

  private showSpellMenu(): void {
    if (this.spellMenu) {
      this.spellMenu.destroy();
      this.spellMenu = null;
      return;
    }
    if (this.itemMenu) {
      this.itemMenu.destroy();
      this.itemMenu = null;
    }

    const w = this.cameras.main.width;
    const spells = this.player.knownSpells
      .map((id) => getSpell(id))
      .filter((s): s is Spell => s !== undefined);

    const container = this.add.container(w * 0.52, this.cameras.main.height * 0.78 - spells.length * 28 - 10);

    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a3e, 0.95);
    bg.fillRect(-5, -5, 260, spells.length * 28 + 10);
    bg.lineStyle(1, 0xc0a060, 1);
    bg.strokeRect(-5, -5, 260, spells.length * 28 + 10);
    container.add(bg);

    spells.forEach((spell, i) => {
      const canCast = this.player.mp >= spell.mpCost;
      const color = canCast ? "#aaddff" : "#666";
      const text = this.add
        .text(0, i * 28, `${spell.name} (${spell.mpCost} MP) - ${spell.type}`, {
          fontSize: "12px",
          fontFamily: "monospace",
          color,
        })
        .setInteractive({ useHandCursor: canCast });

      if (canCast) {
        text.on("pointerover", () => text.setColor("#ffd700"));
        text.on("pointerout", () => text.setColor(color));
        text.on("pointerdown", () => {
          this.spellMenu?.destroy();
          this.spellMenu = null;
          this.doPlayerSpell(spell.id);
        });
      }
      container.add(text);
    });

    this.spellMenu = container;
  }

  private showAbilityMenu(): void {
    if (this.abilityMenu) {
      this.abilityMenu.destroy();
      this.abilityMenu = null;
      return;
    }
    if (this.spellMenu) { this.spellMenu.destroy(); this.spellMenu = null; }
    if (this.itemMenu) { this.itemMenu.destroy(); this.itemMenu = null; }

    const w = this.cameras.main.width;
    const abilities = (this.player.knownAbilities ?? [])
      .map((id) => getAbility(id))
      .filter((a): a is Ability => a !== undefined);

    if (abilities.length === 0) {
      this.addLog("No abilities known!");
      return;
    }

    const container = this.add.container(w * 0.52, this.cameras.main.height * 0.78 - abilities.length * 28 - 10);

    const bg = this.add.graphics();
    bg.fillStyle(0x1a2a1e, 0.95);
    bg.fillRect(-5, -5, 260, abilities.length * 28 + 10);
    bg.lineStyle(1, 0xc0a060, 1);
    bg.strokeRect(-5, -5, 260, abilities.length * 28 + 10);
    container.add(bg);

    abilities.forEach((ability, i) => {
      const canUse = this.player.mp >= ability.mpCost;
      const isBonusAction = ability.bonusAction ?? false;
      const bonusTag = isBonusAction ? " [BA]" : "";
      const color = canUse ? (isBonusAction ? "#aaffaa" : "#ffddaa") : "#666";
      const text = this.add
        .text(0, i * 28, `${ability.name}${bonusTag} (${ability.mpCost} MP) - ${ability.type}`, {
          fontSize: "12px",
          fontFamily: "monospace",
          color,
        })
        .setInteractive({ useHandCursor: canUse });

      if (canUse) {
        text.on("pointerover", () => text.setColor("#ffd700"));
        text.on("pointerout", () => text.setColor(color));
        text.on("pointerdown", () => {
          this.abilityMenu?.destroy();
          this.abilityMenu = null;
          this.doPlayerAbility(ability.id);
        });
      }
      container.add(text);
    });

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

  private showItemMenu(): void {
    if (this.itemMenu) {
      this.itemMenu.destroy();
      this.itemMenu = null;
      return;
    }
    if (this.spellMenu) {
      this.spellMenu.destroy();
      this.spellMenu = null;
    }

    const w = this.cameras.main.width;
    const consumables = this.player.inventory.filter(
      (item) => item.type === "consumable"
    );

    if (consumables.length === 0) {
      this.addLog("No usable items!");
      return;
    }

    // Stack consumables by id — group into { item, count, firstIndex }
    const stacks: { item: typeof consumables[0]; count: number; firstIndex: number }[] = [];
    const seen = new Map<string, number>(); // id → index in stacks[]
    for (const item of consumables) {
      const existing = seen.get(item.id);
      if (existing !== undefined) {
        stacks[existing].count++;
      } else {
        seen.set(item.id, stacks.length);
        stacks.push({ item, count: 1, firstIndex: this.player.inventory.indexOf(item) });
      }
    }

    const container = this.add.container(w * 0.52, this.cameras.main.height * 0.78 - stacks.length * 28 - 10);

    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a3e, 0.95);
    bg.fillRect(-5, -5, 260, stacks.length * 28 + 10);
    bg.lineStyle(1, 0xc0a060, 1);
    bg.strokeRect(-5, -5, 260, stacks.length * 28 + 10);
    container.add(bg);

    stacks.forEach((stack, i) => {
      const countLabel = stack.count > 1 ? ` x${stack.count}` : "";
      const text = this.add
        .text(0, i * 28, `${stack.item.name}${countLabel} - ${stack.item.description}`, {
          fontSize: "12px",
          fontFamily: "monospace",
          color: "#aaffaa",
        })
        .setInteractive({ useHandCursor: true });

      text.on("pointerover", () => text.setColor("#ffd700"));
      text.on("pointerout", () => text.setColor("#aaffaa"));
      text.on("pointerdown", () => {
        // Find the first inventory index for this item id
        const realIndex = this.player.inventory.findIndex(it => it.id === stack.item.id && it.type === "consumable");
        this.itemMenu?.destroy();
        this.itemMenu = null;
        if (realIndex >= 0) this.doUseItem(realIndex);
      });
      container.add(text);
    });

    this.itemMenu = container;
  }

  private updateMonsterDisplay(): void {
    const hpBar = this.getHpBar(this.monsterHp, this.monster.hp, 14);
    const defendTag = this.monsterDefending ? " [DEF]" : "";
    this.monsterText.setText(
      `${this.monster.name}${defendTag}\nHP: ${this.monsterHp}/${this.monster.hp}\n${hpBar}`
    );
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
    debugPanelClear();
    debugPanelLog(`=== Battle: ${this.player.name} vs ${this.monster.name} ===`);

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

    const xKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    xKey.on("down", () => {
      if (!isDebug()) return;
      this.player.xp = xpForLevel(this.player.level + 1) - 1;
      debugLog("CHEAT: XP set to", this.player.xp);
      debugPanelLog(`[CHEAT] XP set to ${this.player.xp}`, true);
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

    registerCommandRouter(cmds, "Battle", helpEntries, "K=Kill H=Heal P=MP G=Gold L=LvUp X=MaxXP");
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
    this.addLog(`${this.player.name} takes a defensive stance! (+2 AC)`);
    debugPanelLog(`  ↳ [Defend] AC ${getArmorClass(this.player)} → ${getArmorClass(this.player) + 2}`, false, "roll-detail");
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
      });
      debugPanelLog(
        `  ↳ [Monster Attack] d20=${result.roll} +${result.attackBonus} = ${result.totalRoll} vs AC ${result.targetAC}${this.playerDefending ? " (DEF+2)" : ""} → ${result.hit ? (result.critical ? "CRIT" : "HIT") : "MISS"} dmg=${result.damage} → Player HP ${this.player.hp}`,
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

        if (xpResult.leveledUp) {
          this.addLog(`🎉 LEVEL UP! Now level ${xpResult.newLevel}!`);
          for (const spell of xpResult.newSpells) {
            this.addLog(`✦ Learned ${spell.name}!`);
          }
          for (const ability of xpResult.newAbilities) {
            this.addLog(`⚡ Learned ${ability.name}!`);
          }
          for (const talent of xpResult.newTalents) {
            this.addLog(`🏅 Talent: ${talent.name} — ${talent.description}`);
          }
          if (xpResult.asiGained > 0) {
            this.addLog(`★ +${xpResult.asiGained} stat points to spend!`);
          }
        }

        // Track boss defeats
        if (this.monster.isBoss) {
          this.defeatedBosses.add(this.monster.id);
        }

        // Record in bestiary
        recordDefeat(this.bestiary, this.monster, this.acDiscovered, this.droppedItemIds);

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
    this.player.x = this.player.lastTownX ?? 2;
    this.player.y = this.player.lastTownY ?? 2;
    this.player.chunkX = this.player.lastTownChunkX ?? 1;
    this.player.chunkY = this.player.lastTownChunkY ?? 1;
    this.player.inDungeon = false;
    this.player.dungeonId = "";
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
      discoverAC(this.bestiary, this.monster.id);
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

  /**
   * Draw a sun or moon in the sky area of the battle background.
   * Positioned on the LEFT side of the sky to avoid overlapping the monster
   * sprite (which sits at top-right ~72% x, ~18% y).
   *   Dawn  → sun low-left (rising)
   *   Day   → sun upper-left
   *   Dusk  → sun mid-left (setting)
   *   Night → moon upper-left + stars
   */
  private drawCelestialBody(): void {
    // Skip for dungeons — no sky visible
    if (this.biome === "dungeon") return;

    const w = this.cameras.main.width;
    const skyH = this.cameras.main.height * 0.45; // sky occupies roughly top 45%
    const period = getTimePeriod(this.timeStep);
    const gfx = this.add.graphics();
    gfx.setDepth(0.5); // above bg image, below sprites

    switch (period) {
      case TimePeriod.Dawn: {
        // Sun rising — low left
        const sx = w * 0.12;
        const sy = skyH * 0.78;
        gfx.fillStyle(0xffcc66, 0.15);
        gfx.fillCircle(sx, sy, 50);
        gfx.fillStyle(0xffaa33, 0.2);
        gfx.fillCircle(sx, sy, 30);
        gfx.fillStyle(0xffdd44, 1);
        gfx.fillCircle(sx, sy, 16);
        gfx.fillStyle(0xffee88, 1);
        gfx.fillCircle(sx - 3, sy - 3, 10);
        break;
      }
      case TimePeriod.Day: {
        // Sun high — upper-left quadrant
        const sx = w * 0.22;
        const sy = skyH * 0.18;
        gfx.fillStyle(0xffffcc, 0.12);
        gfx.fillCircle(sx, sy, 60);
        gfx.fillStyle(0xffff88, 0.18);
        gfx.fillCircle(sx, sy, 35);
        gfx.fillStyle(0xffee44, 1);
        gfx.fillCircle(sx, sy, 18);
        gfx.fillStyle(0xffff99, 1);
        gfx.fillCircle(sx - 3, sy - 3, 12);
        gfx.lineStyle(1.5, 0xffee44, 0.3);
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
          gfx.lineBetween(
            sx + Math.cos(a) * 22, sy + Math.sin(a) * 22,
            sx + Math.cos(a) * 40, sy + Math.sin(a) * 40,
          );
        }
        break;
      }
      case TimePeriod.Dusk: {
        // Sun setting — mid-left, dropping lower
        const sx = w * 0.15;
        const sy = skyH * 0.72;
        gfx.fillStyle(0xff6633, 0.15);
        gfx.fillCircle(sx, sy, 55);
        gfx.fillStyle(0xff8844, 0.2);
        gfx.fillCircle(sx, sy, 32);
        gfx.fillStyle(0xff7733, 1);
        gfx.fillCircle(sx, sy, 17);
        gfx.fillStyle(0xffaa55, 1);
        gfx.fillCircle(sx - 2, sy - 2, 11);
        break;
      }
      case TimePeriod.Night: {
        // Moon — upper-left area (well away from monster at top-right)
        const mx = w * 0.18;
        const my = skyH * 0.2;
        gfx.fillStyle(0xaabbdd, 0.1);
        gfx.fillCircle(mx, my, 45);
        gfx.fillStyle(0xccddff, 0.12);
        gfx.fillCircle(mx, my, 28);
        gfx.fillStyle(0xe8eeff, 1);
        gfx.fillCircle(mx, my, 14);
        gfx.fillStyle(0x0a0a1a, 1);
        gfx.fillCircle(mx + 6, my - 4, 11);
        // Stars — scattered across sky but avoiding monster area (right 60-90% x)
        gfx.fillStyle(0xffffff, 0.7);
        const starPositions = [
          [w * 0.05, skyH * 0.12], [w * 0.15, skyH * 0.42],
          [w * 0.28, skyH * 0.08], [w * 0.38, skyH * 0.3],
          [w * 0.42, skyH * 0.05], [w * 0.08, skyH * 0.28],
          [w * 0.32, skyH * 0.4], [w * 0.48, skyH * 0.15],
        ];
        for (const [sx, sy] of starPositions) {
          gfx.fillCircle(sx, sy, 1.5);
        }
        gfx.fillStyle(0xccccee, 0.4);
        gfx.fillCircle(w * 0.03, skyH * 0.35, 1);
        gfx.fillCircle(w * 0.25, skyH * 0.48, 1);
        gfx.fillCircle(w * 0.45, skyH * 0.38, 1);
        gfx.fillCircle(w * 0.35, skyH * 0.18, 1);
        break;
      }
    }
  }

  /** Apply day/night tint to the battle background, monster, and player sprites. */
  private applyDayNightTint(): void {
    const period = this.biome === "dungeon" ? TimePeriod.Dungeon : getTimePeriod(this.timeStep);
    const tint = PERIOD_TINT[period];
    // Tint the background image
    if (this.bgImage) {
      this.bgImage.setTint(tint);
    }
    // Tint monster sprite (blend with its color tint)
    if (tint !== 0xffffff) {
      // Blend the monster's base color with the time-of-day tint
      const monsterColor = this.monster.color;
      const blended = this.blendTints(monsterColor, tint);
      this.monsterSprite.setTint(blended);
      // Player sprite gets pure time tint
      this.playerSprite.setTint(tint);
    }
  }

  /** Blend two 0xRRGGBB colors — 70% first, 30% second. */
  private blendTints(a: number, b: number): number {
    const rA = (a >> 16) & 0xff, gA = (a >> 8) & 0xff, bA = a & 0xff;
    const rB = (b >> 16) & 0xff, gB = (b >> 8) & 0xff, bB = b & 0xff;
    const r = Math.round(rA * 0.7 + rB * 0.3);
    const g = Math.round(gA * 0.7 + gB * 0.3);
    const bl = Math.round(bA * 0.7 + bB * 0.3);
    return (r << 16) | (g << 8) | bl;
  }

  /** Create weather particle effects for the battle scene. */
  private createWeatherParticles(): void {
    if (this.weatherParticles) {
      this.weatherParticles.destroy();
      this.weatherParticles = null;
    }
    if (this.stormLightningTimer) {
      this.stormLightningTimer.destroy();
      this.stormLightningTimer = null;
    }

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const weather = this.weatherState.current;

    if (weather === WeatherType.Clear) return;

    const configs: Record<string, () => Phaser.GameObjects.Particles.ParticleEmitter> = {
      [WeatherType.Rain]: () => this.add.particles(0, -10, "particle_rain", {
        x: { min: 0, max: w },
        quantity: 3,
        lifespan: 1800,
        speedY: { min: 220, max: 380 },
        speedX: { min: -20, max: -40 },
        scale: { start: 1, end: 0.5 },
        alpha: { start: 0.7, end: 0.15 },
        frequency: 25,
      }),
      [WeatherType.Snow]: () => this.add.particles(0, -10, "particle_snow", {
        x: { min: 0, max: w },
        quantity: 1,
        lifespan: 5000,
        speedY: { min: 25, max: 70 },
        speedX: { min: -25, max: 25 },
        scale: { start: 1, end: 0.3 },
        alpha: { start: 0.8, end: 0.1 },
        frequency: 70,
      }),
      [WeatherType.Sandstorm]: () => this.add.particles(w + 10, 0, "particle_sand", {
        y: { min: 0, max: h },
        quantity: 5,
        lifespan: 2200,
        speedX: { min: -420, max: -260 },
        speedY: { min: -20, max: 30 },
        scale: { start: 1.3, end: 0.5 },
        alpha: { start: 0.9, end: 0.15 },
        frequency: 14,
      }),
      [WeatherType.Storm]: () => this.add.particles(0, -10, "particle_storm", {
        x: { min: 0, max: w },
        quantity: 5,
        lifespan: 1200,
        speedY: { min: 380, max: 520 },
        speedX: { min: -70, max: -110 },
        scale: { start: 1, end: 0.5 },
        alpha: { start: 0.85, end: 0.2 },
        frequency: 14,
      }),
      [WeatherType.Fog]: () => this.add.particles(0, 0, "particle_fog", {
        x: { min: 0, max: w },
        y: { min: 0, max: h },
        quantity: 2,
        lifespan: 5000,
        speedX: { min: 5, max: 15 },
        speedY: { min: -5, max: 5 },
        scale: { start: 2.5, end: 5 },
        alpha: { start: 0.35, end: 0.04 },
        frequency: 140,
      }),
    };

    const factory = configs[weather];
    if (factory) {
      this.weatherParticles = factory();
      this.weatherParticles.setDepth(5);
    }

    // Sporadic lightning flashes during storms
    if (weather === WeatherType.Storm) {
      const scheduleFlash = () => {
        this.stormLightningTimer = this.time.delayedCall(
          2000 + Math.random() * 6000,
          () => {
            this.cameras.main.flash(120, 255, 255, 255, true);
            scheduleFlash();
          },
        );
      };
      scheduleFlash();
    }
  }

  private returnToOverworld(): void {
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(500, () => {
      this.scene.start("OverworldScene", {
        player: this.player,
        defeatedBosses: this.defeatedBosses,
        bestiary: this.bestiary,
        timeStep: this.timeStep,
        weatherState: this.weatherState,
        savedSpecialNpcs: this.savedSpecialNpcs,
      });
    });
  }
}
