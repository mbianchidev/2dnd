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
import { isDebug, debugLog, debugPanelLog, debugPanelState, debugPanelClear, setDebugCommandHandler } from "../config";
import type { BestiaryData } from "../systems/bestiary";
import { recordDefeat, discoverAC } from "../systems/bestiary";
import { type WeatherState, WeatherType, createWeatherState, getWeatherAccuracyPenalty, getMonsterWeatherBoost, WEATHER_LABEL } from "../systems/weather";

type BattlePhase = "init" | "playerTurn" | "monsterTurn" | "victory" | "defeat" | "fled";

export class BattleScene extends Phaser.Scene {
  private player!: PlayerState;
  private monster!: Monster;
  private monsterHp!: number;
  private defeatedBosses!: Set<string>;
  private bestiary!: BestiaryData;
  private timeStep = 0;
  private weatherState: WeatherState = createWeatherState();
  private phase: BattlePhase = "init";
  private logLines: string[] = [];
  private logText!: Phaser.GameObjects.Text;
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

  // AC discovery tracking
  private acHighestMiss = 0;
  private acLowestHit = Infinity;
  private acDiscovered = false;

  // Item drops collected this battle
  private droppedItemIds: string[] = [];

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
  }): void {
    this.player = data.player;
    this.monster = data.monster;
    this.monsterHp = data.monster.hp;
    this.defeatedBosses = data.defeatedBosses;
    this.bestiary = data.bestiary;
    this.timeStep = data.timeStep ?? 0;
    this.weatherState = data.weatherState ?? createWeatherState();
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
    this.setupDebug();
    this.rollForInitiative();
  }

  update(): void {
    this.updateDebugPanel();
  }

  private drawBattleUI(): void {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    // Full battle background
    const bg = this.add.graphics();
    bg.fillStyle(0x151530, 1);
    bg.fillRect(0, 0, w, h);

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
    const playerTextureKey = `player_${this.player.appearanceId}`;
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

    // Battle log (bottom strip, above action buttons)
    const logBg = this.add.graphics();
    logBg.fillStyle(0x1a1a2e, 0.95);
    logBg.fillRect(0, h * 0.78, w, h * 0.22);
    logBg.lineStyle(1, 0xc0a060, 0.5);
    logBg.strokeRect(0, h * 0.78, w, h * 0.22);

    this.logText = this.add.text(10, h * 0.79, "", {
      fontSize: "12px",
      fontFamily: "monospace",
      color: "#ccc",
      wordWrap: { width: w * 0.5 - 20 },
      lineSpacing: 3,
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
      const color = canUse ? "#ffddaa" : "#666";
      const text = this.add
        .text(0, i * 28, `${ability.name} (${ability.mpCost} MP) - ${ability.type}`, {
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
    this.playerDefending = false;
    this.monsterDefending = false;
    this.phase = "monsterTurn";

    try {
      const weatherPenalty = getWeatherAccuracyPenalty(this.weatherState.current);
      const boost = getMonsterWeatherBoost(this.monster.id, this.weatherState.current);
      const result = playerUseAbility(this.player, abilityId, this.monster, weatherPenalty + boost.acBonus);
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

    const container = this.add.container(w * 0.52, this.cameras.main.height * 0.78 - consumables.length * 28 - 10);

    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a3e, 0.95);
    bg.fillRect(-5, -5, 260, consumables.length * 28 + 10);
    bg.lineStyle(1, 0xc0a060, 1);
    bg.strokeRect(-5, -5, 260, consumables.length * 28 + 10);
    container.add(bg);

    consumables.forEach((item, i) => {
      const realIndex = this.player.inventory.indexOf(item);
      const text = this.add
        .text(0, i * 28, `${item.name} - ${item.description}`, {
          fontSize: "12px",
          fontFamily: "monospace",
          color: "#aaffaa",
        })
        .setInteractive({ useHandCursor: true });

      text.on("pointerover", () => text.setColor("#ffd700"));
      text.on("pointerout", () => text.setColor("#aaffaa"));
      text.on("pointerdown", () => {
        this.itemMenu?.destroy();
        this.itemMenu = null;
        this.doUseItem(realIndex);
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
    if (this.logLines.length > 6) this.logLines.shift();
    this.logText.setText(this.logLines.join("\n"));
    // Also push to the HTML debug panel (always, panel visibility is toggled separately)
    debugPanelLog(msg, msg.startsWith("[DEBUG]"));
  }

  // --- Debug ---

  private setupDebug(): void {
    debugPanelClear();
    debugPanelLog(`=== Battle: ${this.player.name} vs ${this.monster.name} ===`);

    // Register cheat keys (only work when debug is on)
    const debugKeys = {
      K: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.K),
      H: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.H),
      P: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.P),
      G: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.G),
      L: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.L),
      X: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X),
    };

    // Kill monster instantly
    debugKeys.K.on("down", () => {
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

    // Full heal
    debugKeys.H.on("down", () => {
      if (!isDebug()) return;
      debugLog("CHEAT: Full heal", { before: this.player.hp, max: this.player.maxHp });
      this.player.hp = this.player.maxHp;
      this.updatePlayerStats();
      debugPanelLog(`[CHEAT] HP restored to ${this.player.maxHp}!`, true);
    });

    // Restore MP
    debugKeys.P.on("down", () => {
      if (!isDebug()) return;
      debugLog("CHEAT: Restore MP", { before: this.player.mp, max: this.player.maxMp });
      this.player.mp = this.player.maxMp;
      this.updatePlayerStats();
      debugPanelLog(`[CHEAT] MP restored to ${this.player.maxMp}!`, true);
    });

    // Add gold
    debugKeys.G.on("down", () => {
      if (!isDebug()) return;
      this.player.gold += 100;
      debugLog("CHEAT: +100 gold", { total: this.player.gold });
      debugPanelLog(`[CHEAT] +100 gold (total: ${this.player.gold})`, true);
    });

    // Level up
    debugKeys.L.on("down", () => {
      if (!isDebug()) return;
      const needed = xpForLevel(this.player.level + 1) - this.player.xp;
      const xpResult = awardXP(this.player, Math.max(needed, 0));
      debugLog("CHEAT: Level up", { newLevel: xpResult.newLevel, spells: xpResult.newSpells.map((s: Spell) => s.name) });
      debugPanelLog(`[CHEAT] Level up! Now Lv.${xpResult.newLevel}`, true);
      for (const spell of xpResult.newSpells) {
        debugPanelLog(`[CHEAT] Learned ${spell.name}!`, true);
      }
      this.updatePlayerStats();
    });

    // Max XP (set XP to 1 below next level)
    debugKeys.X.on("down", () => {
      if (!isDebug()) return;
      this.player.xp = xpForLevel(this.player.level + 1) - 1;
      debugLog("CHEAT: XP set to", this.player.xp);
      debugPanelLog(`[CHEAT] XP set to ${this.player.xp}`, true);
    });

    // Register debug command handler for battle scene
    setDebugCommandHandler((cmd, args) => {
      const val = parseInt(args, 10);
      switch (cmd) {
        case "kill":
          this.monsterHp = 0;
          this.updateMonsterDisplay();
          if (this.phase === "playerTurn" || this.phase === "monsterTurn") {
            this.phase = "playerTurn";
            this.checkBattleEnd();
          }
          debugPanelLog(`[CMD] Monster killed!`, true);
          break;
        case "heal":
          this.player.hp = this.player.maxHp;
          this.player.mp = this.player.maxMp;
          this.updatePlayerStats();
          debugPanelLog(`[CMD] Fully healed!`, true);
          break;
        case "gold":
          if (!isNaN(val)) { this.player.gold = val; debugPanelLog(`[CMD] Gold set to ${val}`, true); }
          break;
        case "hp":
          if (!isNaN(val)) { this.player.hp = Math.min(val, this.player.maxHp); this.updatePlayerStats(); debugPanelLog(`[CMD] HP set to ${this.player.hp}`, true); }
          break;
        case "mp":
          if (!isNaN(val)) { this.player.mp = Math.min(val, this.player.maxMp); this.updatePlayerStats(); debugPanelLog(`[CMD] MP set to ${this.player.mp}`, true); }
          break;
        case "help":
          debugPanelLog(`── Debug Commands (Battle) ──`, true);
          debugPanelLog(`/kill         Kill monster instantly`, true);
          debugPanelLog(`/heal         Restore full HP & MP`, true);
          debugPanelLog(`/gold <n>     Set gold amount`, true);
          debugPanelLog(`/hp <n>       Set current HP`, true);
          debugPanelLog(`/mp <n>       Set current MP`, true);
          debugPanelLog(`── Hotkeys: K=Kill H=Heal P=MP G=Gold L=LvUp X=MaxXP ──`, true);
          break;
        default:
          debugPanelLog(`Unknown command: /${cmd}. Type /help`, true);
      }
    });
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
      const result = rollInitiative(dexMod, this.monster.attackBonus);
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
      const boost = getMonsterWeatherBoost(this.monster.id, this.weatherState.current);
      if (this.weatherState.current !== WeatherType.Clear) {
        this.addLog(`${WEATHER_LABEL[this.weatherState.current]} — attacks are harder to land (penalty: ${weatherPenalty})`);
      }
      if (boost.acBonus > 0) {
        this.addLog(`${this.monster.name} thrives in this weather! (+${boost.acBonus} AC, +${boost.attackBonus} ATK, +${boost.damageBonus} DMG)`);
      }

      if (result.playerFirst) {
        this.addLog("You act first!");
        this.phase = "playerTurn";
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
    this.closeAllSubMenus();
    this.playerDefending = false; // reset defend on new action
    this.phase = "monsterTurn"; // prevent double actions

    try {
      const monsterDefBonus = this.monsterDefending ? 2 : 0;
      const weatherPenalty = getWeatherAccuracyPenalty(this.weatherState.current);
      const boost = getMonsterWeatherBoost(this.monster.id, this.weatherState.current);
      const result = playerAttack(this.player, this.monster, monsterDefBonus + boost.acBonus, weatherPenalty);
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
    this.closeAllSubMenus();
    this.monsterDefending = false; // reset monster defend
    this.playerDefending = true;
    this.phase = "monsterTurn";
    this.addLog(`${this.player.name} takes a defensive stance! (+2 AC)`);
    debugPanelLog(`  ↳ [Defend] AC ${getArmorClass(this.player)} → ${getArmorClass(this.player) + 2}`, false, "roll-detail");
    this.updatePlayerStats();
    this.time.delayedCall(800, () => this.doMonsterTurn());
  }

  private doPlayerSpell(spellId: string): void {
    if (this.phase !== "playerTurn") return;
    this.playerDefending = false;
    this.monsterDefending = false;
    this.phase = "monsterTurn";

    try {
      const weatherPenalty = getWeatherAccuracyPenalty(this.weatherState.current);
      const boost = getMonsterWeatherBoost(this.monster.id, this.weatherState.current);
      const result = playerCastSpell(this.player, spellId, this.monster, weatherPenalty + boost.acBonus);
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
        this.cameras.main.flash(200, 100, 100, 255);
      }

      this.checkBattleEnd();
    } catch (err) {
      this.handleError("doPlayerSpell", err);
    }
  }

  private doUseItem(itemIndex: number): void {
    if (this.phase !== "playerTurn") return;
    this.playerDefending = false;
    this.phase = "monsterTurn";

    try {
      const result = useItem(this.player, itemIndex);
      this.addLog(result.message);
      this.updatePlayerStats();

      if (result.used) {
        this.time.delayedCall(800, () => this.doMonsterTurn());
      } else {
        this.phase = "playerTurn";
      }
    } catch (err) {
      this.handleError("doUseItem", err);
      this.phase = "playerTurn";
    }
  }

  private doFlee(): void {
    if (this.phase !== "playerTurn") return;

    if (this.monster.isBoss) {
      this.addLog("Cannot flee from a boss fight!");
      return;
    }

    this.closeAllSubMenus();
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
        this.phase = "playerTurn";
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
            this.phase = "playerTurn";
            return;
          }
        }
      }

      // Normal attack — pass player defend bonus + weather effects
      const defendBonus = this.playerDefending ? 2 : 0;
      const weatherPenalty = getWeatherAccuracyPenalty(this.weatherState.current);
      const boost = getMonsterWeatherBoost(this.monster.id, this.weatherState.current);
      const result = monsterAttack(this.monster, this.player, defendBonus, weatherPenalty, boost.attackBonus, boost.damageBonus);
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
        this.cameras.main.shake(150, 0.01);
        // Shake player sprite
        this.tweens.add({
          targets: this.playerSprite,
          x: this.playerSprite.x - 8,
          duration: 50,
          yoyo: true,
          repeat: 2,
        });
      }

      if (this.player.hp <= 0) {
        this.phase = "defeat";
        this.addLog("You have been defeated...");
        this.time.delayedCall(2000, () => this.handleDefeat());
        return;
      }

      this.phase = "playerTurn";
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
            this.addLog(`★ +${xpResult.asiGained} stat points to spend! Press T on the map.`);
          }
        }

        // Track boss defeats
        if (this.monster.isBoss) {
          this.defeatedBosses.add(this.monster.id);
        }

        // Record in bestiary
        recordDefeat(this.bestiary, this.monster, this.acDiscovered, this.droppedItemIds);

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
    // On defeat: restore half HP, lose some gold, return to nearest town
    this.player.hp = Math.floor(this.player.maxHp / 2);
    this.player.mp = Math.floor(this.player.maxMp / 2);
    this.player.gold = Math.floor(this.player.gold * 0.7);
    // Return to first town
    this.player.x = 2;
    this.player.y = 2;
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

  private returnToOverworld(): void {
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(500, () => {
      this.scene.start("OverworldScene", {
        player: this.player,
        defeatedBosses: this.defeatedBosses,
        bestiary: this.bestiary,
        timeStep: this.timeStep,
        weatherState: this.weatherState,
      });
    });
  }
}
