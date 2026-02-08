/**
 * Turn-based battle scene with D&D dice mechanics.
 */

import Phaser from "phaser";
import type { Monster } from "../data/monsters";
import { getSpell, type Spell } from "../data/spells";
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
  monsterAttack,
  attemptFlee,
} from "../systems/combat";
import { abilityModifier } from "../utils/dice";
import { isDebug, debugLog, debugPanelLog, debugPanelState, debugPanelClear } from "../config";

type BattlePhase = "init" | "playerTurn" | "monsterTurn" | "victory" | "defeat" | "fled";

export class BattleScene extends Phaser.Scene {
  private player!: PlayerState;
  private monster!: Monster;
  private monsterHp!: number;
  private defeatedBosses!: Set<string>;
  private phase: BattlePhase = "init";
  private logLines: string[] = [];
  private logText!: Phaser.GameObjects.Text;
  private statsText!: Phaser.GameObjects.Text;
  private monsterText!: Phaser.GameObjects.Text;
  private monsterSprite!: Phaser.GameObjects.Sprite;
  private actionButtons: Phaser.GameObjects.Container[] = [];
  private spellMenu: Phaser.GameObjects.Container | null = null;
  private itemMenu: Phaser.GameObjects.Container | null = null;

  constructor() {
    super({ key: "BattleScene" });
  }

  init(data: {
    player: PlayerState;
    monster: Monster;
    defeatedBosses: Set<string>;
  }): void {
    this.player = data.player;
    this.monster = data.monster;
    this.monsterHp = data.monster.hp;
    this.defeatedBosses = data.defeatedBosses;
    this.phase = "init";
    this.logLines = [];
    this.actionButtons = [];
    this.spellMenu = null;
    this.itemMenu = null;
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

    // Monster display area (top half)
    const monsterBg = this.add.graphics();
    monsterBg.fillStyle(0x151530, 1);
    monsterBg.fillRect(0, 0, w, h * 0.45);

    // Monster sprite (tinted with monster color)
    this.monsterSprite = this.add.sprite(w / 2, h * 0.22, "monster");
    this.monsterSprite.setTint(this.monster.color);
    this.monsterSprite.setScale(1.5);

    // Monster name and HP
    this.monsterText = this.add
      .text(w / 2, h * 0.4, "", {
        fontSize: "16px",
        fontFamily: "monospace",
        color: "#ff6666",
        align: "center",
      })
      .setOrigin(0.5);
    this.updateMonsterDisplay();

    // Battle log (middle area)
    const logBg = this.add.graphics();
    logBg.fillStyle(0x1a1a2e, 0.95);
    logBg.fillRect(0, h * 0.45, w, h * 0.25);
    logBg.lineStyle(1, 0xc0a060, 0.5);
    logBg.strokeRect(0, h * 0.45, w, h * 0.25);

    this.logText = this.add.text(10, h * 0.46, "", {
      fontSize: "12px",
      fontFamily: "monospace",
      color: "#ccc",
      wordWrap: { width: w - 20 },
      lineSpacing: 3,
    });

    // Player stats (bottom-left)
    const statsBg = this.add.graphics();
    statsBg.fillStyle(0x1a1a2e, 0.95);
    statsBg.fillRect(0, h * 0.7, w * 0.4, h * 0.3);
    statsBg.lineStyle(1, 0xc0a060, 0.5);
    statsBg.strokeRect(0, h * 0.7, w * 0.4, h * 0.3);

    this.statsText = this.add.text(10, h * 0.72, "", {
      fontSize: "13px",
      fontFamily: "monospace",
      color: "#88ccff",
      lineSpacing: 4,
    });
    this.updatePlayerStats();

    // Action buttons (bottom-right)
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

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const btnX = w * 0.4 + 20;
    const btnY = h * 0.72;
    const btnW = 130;
    const btnH = 32;
    const gap = 8;

    const actions = [
      { label: "⚔ Attack", action: () => this.doPlayerAttack() },
      { label: "✦ Spells", action: () => this.showSpellMenu() },
      { label: "🎒 Items", action: () => this.showItemMenu() },
      { label: "🏃 Flee", action: () => this.doFlee() },
    ];

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

    const container = this.add.container(w * 0.4 + 20, this.cameras.main.height * 0.45 - spells.length * 28 - 10);

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

    const container = this.add.container(w * 0.4 + 20, this.cameras.main.height * 0.45 - consumables.length * 28 - 10);

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
    const hpBar = this.getHpBar(this.monsterHp, this.monster.hp, 20);
    this.monsterText.setText(
      `${this.monster.name}  HP: ${this.monsterHp}/${this.monster.hp}\n${hpBar}`
    );
    // Flash monster on hit
    if (this.monsterHp <= 0) {
      this.monsterSprite.setAlpha(0.3);
    }
  }

  private updatePlayerStats(): void {
    const p = this.player;
    this.statsText.setText(
      `${p.name} Lv.${p.level}\n` +
        `HP: ${p.hp}/${p.maxHp} ${this.getHpBar(p.hp, p.maxHp, 12)}\n` +
        `MP: ${p.mp}/${p.maxMp} ${this.getMpBar(p.mp, p.maxMp, 12)}\n` +
        `AC: ${getArmorClass(p)}`
    );
  }

  private getHpBar(current: number, max: number, length: number): string {
    const filled = Math.max(0, Math.min(length, Math.round((current / max) * length)));
    return "[" + "█".repeat(filled) + "░".repeat(length - filled) + "]";
  }

  private getMpBar(current: number, max: number, length: number): string {
    const filled = Math.max(0, Math.min(length, Math.round((current / max) * length)));
    return "[" + "▓".repeat(filled) + "░".repeat(length - filled) + "]";
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
      M: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M),
      G: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.G),
      L: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.L),
      X: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X),
    };

    // Kill monster instantly
    debugKeys.K.on("down", () => {
      if (!isDebug()) return;
      debugLog("CHEAT: Kill monster");
      this.addLog("[DEBUG] Monster killed!");
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
      this.addLog(`[DEBUG] HP restored to ${this.player.maxHp}!`);
    });

    // Restore MP
    debugKeys.M.on("down", () => {
      if (!isDebug()) return;
      debugLog("CHEAT: Restore MP", { before: this.player.mp, max: this.player.maxMp });
      this.player.mp = this.player.maxMp;
      this.updatePlayerStats();
      this.addLog(`[DEBUG] MP restored to ${this.player.maxMp}!`);
    });

    // Add gold
    debugKeys.G.on("down", () => {
      if (!isDebug()) return;
      this.player.gold += 100;
      debugLog("CHEAT: +100 gold", { total: this.player.gold });
      this.addLog(`[DEBUG] +100 gold (total: ${this.player.gold})`);
    });

    // Level up
    debugKeys.L.on("down", () => {
      if (!isDebug()) return;
      const needed = xpForLevel(this.player.level + 1) - this.player.xp;
      const xpResult = awardXP(this.player, Math.max(needed, 0));
      debugLog("CHEAT: Level up", { newLevel: xpResult.newLevel, spells: xpResult.newSpells.map((s: Spell) => s.name) });
      this.addLog(`[DEBUG] Level up! Now Lv.${xpResult.newLevel}`);
      for (const spell of xpResult.newSpells) {
        this.addLog(`[DEBUG] Learned ${spell.name}!`);
      }
      this.updatePlayerStats();
    });

    // Max XP (set XP to 1 below next level)
    debugKeys.X.on("down", () => {
      if (!isDebug()) return;
      this.player.xp = xpForLevel(this.player.level + 1) - 1;
      debugLog("CHEAT: XP set to", this.player.xp);
      this.addLog(`[DEBUG] XP set to ${this.player.xp}`);
    });
  }

  private updateDebugPanel(): void {
    const p = this.player;
    debugPanelState(
      `BATTLE | Phase: ${this.phase} | ` +
      `Monster: ${this.monster.name} HP ${this.monsterHp}/${this.monster.hp} AC ${this.monster.ac} | ` +
      `Player: HP ${p.hp}/${p.maxHp} MP ${p.mp}/${p.maxMp} AC ${getArmorClass(p)} | ` +
      `Lv.${p.level} XP ${p.xp}/${xpForLevel(p.level + 1)} Gold ${p.gold} | ` +
      `Cheats: K=Kill H=Heal M=MP G=Gold L=LvUp`
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
      this.addLog(
        `⚔ ${this.monster.name} appears! Initiative: You ${result.playerRoll} vs ${this.monster.name} ${result.monsterRoll}`
      );

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
    this.phase = "monsterTurn"; // prevent double actions

    try {
      const result = playerAttack(this.player, this.monster);
      debugLog("Player attack", { roll: result.roll, hit: result.hit, critical: result.critical, damage: result.damage, monsterAC: this.monster.ac });
      this.addLog(result.message);
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

  private doPlayerSpell(spellId: string): void {
    if (this.phase !== "playerTurn") return;
    this.phase = "monsterTurn";

    try {
      const result = playerCastSpell(this.player, spellId, this.monster);
      debugLog("Player spell", { spellId, roll: result.roll, hit: result.hit, damage: result.damage, mpUsed: result.mpUsed });
      this.addLog(result.message);
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

    this.phase = "monsterTurn";
    try {
      const dexMod = abilityModifier(this.player.stats.dexterity);
      const result = attemptFlee(dexMod);
      debugLog("Flee attempt", { success: result.success, dexMod });
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
      const result = monsterAttack(this.monster, this.player);
      debugLog("Monster attack", {
        naturalRoll: result.roll,
        attackBonus: result.attackBonus,
        totalRoll: result.totalRoll,
        targetAC: result.targetAC,
        hit: result.hit,
        critical: result.critical,
        damage: result.damage,
        playerHP: this.player.hp,
      });
      this.addLog(result.message);
      if (isDebug()) {
        this.addLog(
          `  ↳ [roll d20=${result.roll} +${result.attackBonus} = ${result.totalRoll} vs AC ${result.targetAC}]`
        );
      }
      this.updatePlayerStats();

      if (result.hit) {
        this.cameras.main.shake(150, 0.01);
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

        // Award XP and gold
        this.player.gold += this.monster.goldReward;
        const xpResult = awardXP(this.player, this.monster.xpReward);
        this.addLog(
          `Gained ${this.monster.xpReward} XP and ${this.monster.goldReward} gold!`
        );

        if (xpResult.leveledUp) {
          this.addLog(`🎉 LEVEL UP! Now level ${xpResult.newLevel}!`);
          for (const spell of xpResult.newSpells) {
            this.addLog(`✦ Learned ${spell.name}!`);
          }
        }

        // Track boss defeats
        if (this.monster.isBoss) {
          this.defeatedBosses.add(this.monster.id);
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

  private returnToOverworld(): void {
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(500, () => {
      this.scene.start("OverworldScene", {
        player: this.player,
        defeatedBosses: this.defeatedBosses,
      });
    });
  }
}
