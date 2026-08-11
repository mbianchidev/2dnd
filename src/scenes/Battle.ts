/**
 * Turn-based battle scene with D&D dice mechanics.
 */

import * as Phaser from "phaser";
import type { Monster, MonsterAbility } from "../data/monsters";
import { getMonsterTextureKey } from "../data/monsterFamilies";
import {
  createSoloEncounter,
  type MonsterEncounter,
} from "../data/monsterGroups";
import {
  getSpell,
  getSpellTargetType,
  type Spell,
} from "../data/spells";
import {
  getAbility,
  getAbilityRange,
  getAbilityTargetType,
  type Ability,
} from "../data/abilities";
import { getItem, type Item } from "../data/items";
import { discoverCraftingRecipes } from "../systems/crafting";
import type { PlayerState } from "../systems/player";
import {
  getArmorClass,
  useItem,
  xpForLevel,
} from "../systems/player";
import {
  playerAttack,
  playerOffHandAttack,
  playerCastSpellAtTargets,
  playerUseAbility,
  monsterAttackTarget,
  monsterUseAbilityTarget,
  attemptFlee,
} from "../systems/combat";
import type { HealingTarget } from "../systems/combat";
import {
  createBattleActionEconomy,
  createPlayerBattleActionSource,
  type BattleActionSource,
  type BattleActionEconomyState,
  type ResolvedBattleAction,
} from "../systems/battleActions";
import { abilityModifier } from "../systems/dice";
import {
  isDebug,
  debugLog,
  debugPanelLog,
  debugPanelState,
  setDebugCommandHandler,
} from "../config";
import type { CodexData } from "../systems/codex";
import {
  discoverAC,
  discoverElement,
  replayCodexUnlocks,
} from "../systems/codex";
import type {
  Element,
  ElementalInteraction,
} from "../data/elements";
import { type WeatherState, WeatherType, createWeatherState, getWeatherAccuracyPenalty, getMonsterWeatherBoost, WEATHER_LABEL } from "../systems/weather";
import type { SavedSpecialNpc } from "../data/npcs";
import { registerSharedHotkeys, buildSharedCommands, registerCommandRouter, SHARED_HELP, type HelpEntry } from "../systems/debug";
import { getTimePeriod, TimePeriod } from "../systems/daynight";
import { audioEngine } from "../systems/audio";
import {
  applyBattleActorTint,
  BattleBackdropRenderer,
} from "../renderers/battleBackdrop";
import { BATTLE_DEPTH } from "../renderers/battleDepth";
import { PlayerRenderer } from "../renderers/player";
import { BattlePartyRenderer } from "../renderers/battleParty";
import { BattlePartyManager } from "../managers/battleParty";
import { BattlePresentationDirector } from "../managers/battlePresentation";
import {
  createActorTextureFamily,
  resolveMonsterTextureFamily,
} from "../renderers/actorTextures";
import { SceneTransitionManager } from "../managers/sceneTransition";
import {
  installSceneAccessibility,
} from "../systems/accessibility";
import { CAMPAIGN_EPILOGUE_CUTSCENE_ID } from "../data/cutscenes";
import {
  applyPartyDefeat,
  createPartyActionSources,
  distributePartyVictory,
  type PartyDefeatResult,
} from "../systems/party";
import {
  clearAllEffects,
  getActiveEffectNames,
  getEffectACModifier,
  processEndOfTurn as processStatusEndOfTurn,
  processStartOfTurn as processStatusStartOfTurn,
} from "../systems/statusEffects";
import type { ActiveStatusEffect } from "../systems/statusEffects";
import {
  recordMonsterDefeats,
  type QuestUpdate,
} from "../systems/quests";
import {
  captureCutsceneTriggerSnapshot,
  collectNewlyTriggeredCutsceneIds,
  getNextPendingCutscene,
  queueCutscenes,
} from "../systems/cutscenes";
import { saveGame } from "../systems/save";
import { createSharedSceneState } from "../systems/sceneState";
import {
  consumeNextBattleDebugFlag,
  nextBattleAchievementSourceId,
  reconcileAchievements,
  recordAchievementEvent,
  isOneHitDefeat,
} from "../systems/achievements";
import {
  countAliveCombatants,
  createBattleResult,
  createGroupCombatants,
  createHeroCombatant,
  deriveMonsterStats,
  findLowestHpAllyIndex,
  getAttackRangeForWeapon,
  getBattleTargetIds,
  getCombatantById,
  getFormationAttackPenalty,
  getMonsterDefendChance,
  getSelectableTargetIndices,
  getSynergyACBonus,
  getSynergyAttackBonus,
  getSynergyDamageBonus,
  isCombatantActive,
  isPartyDefeated,
  isSynergyActive,
  recordGroupDefeats,
  resolveBattleRewards,
  rollBattleInitiative,
  selectMonsterTarget,
  type AttackRange,
  type BattleCombatantState,
  type BattleOutcome,
  type BattleResolutionHooks,
  type BattleReward,
  type BattleTurn,
  type CompanionTurnContext,
  type GroupCombatant,
  type PartyCombatant,
} from "../systems/groupCombat";
import { CodexDiscoveryManager } from "../managers/codexDiscovery";
import type { CodexKnowledgeEntry } from "../data/codexKnowledge";

type BattlePhase = "init" | "playerTurn" | "monsterTurn" | "victory" | "defeat" | "fled";

interface PendingTargetAction {
  label: string;
  range: AttackRange;
  validIndices: number[];
  execute(targetIndex: number): void;
}

export interface BattleSceneData {
  player: PlayerState;
  encounter?: MonsterEncounter;
  /** Legacy solo input retained for callers during scene-contract migration. */
  monster?: Monster;
  defeatedBosses: Set<string>;
  codex: CodexData;
  timeStep?: number;
  weatherState?: WeatherState;
  biome?: string;
  savedSpecialNpcs?: SavedSpecialNpc[];
  /** Additional accessor-backed party members supplied by companion systems. */
  partyCombatants?: PartyCombatant[];
  /** Runtime-only extension hooks; never persisted in save data. */
  battleHooks?: BattleResolutionHooks;
  codexDiscoveryIds?: string[];
}

export class BattleScene extends Phaser.Scene {
  private readonly sceneTransitions = new SceneTransitionManager(this);
  private player!: PlayerState;
  private encounter!: MonsterEncounter;
  private combatants: GroupCombatant[] = [];
  private heroCombatant!: PartyCombatant;
  private partyCombatants: PartyCombatant[] = [];
  private partyActionSources: BattleActionSource[] = [];
  private battlePartyManager!: BattlePartyManager;
  private battlePartyRenderer!: BattlePartyRenderer;
  private battlePresentation!: BattlePresentationDirector;
  private battleHooks: BattleResolutionHooks | undefined;
  private battleResultReported = false;
  private defeatResult: PartyDefeatResult | null = null;
  private playerEconomy!: BattleActionEconomyState;
  private defeatedBosses!: Set<string>;
  private codex!: CodexData;
  private timeStep = 0;
  private weatherState: WeatherState = createWeatherState();
  private savedSpecialNpcs: SavedSpecialNpc[] = [];
  private questUpdates: QuestUpdate[] = [];
  private codexDiscoveryIds: string[] = [];
  private codexDiscovery!: CodexDiscoveryManager;
  private battleHookCodexEntries: CodexKnowledgeEntry[] = [];
  private achievementBattleSourceId = "";
  private achievementBattleDebug = false;
  private oneHitDefeatIds = new Set<string>();
  private phase: BattlePhase = "init";
  private logLines: string[] = [];
  private logText!: Phaser.GameObjects.Text;
  private logScrollOffset = 0;
  private logAreaY = 0;
  private logAreaH = 0;
  private monsterTexts: Phaser.GameObjects.Text[] = [];
  private monsterSprites: Phaser.GameObjects.Sprite[] = [];
  private synergyText!: Phaser.GameObjects.Text;
  private targetCursor!: Phaser.GameObjects.Text;
  private targetHint!: Phaser.GameObjects.Text;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private playerStatsText!: Phaser.GameObjects.Text;
  private actionButtons: Phaser.GameObjects.Container[] = [];
  private actionButtonLabels: Array<{
    text: Phaser.GameObjects.Text;
    label: string;
  }> = [];
  private actionButtonActions: Array<() => void> = [];
  private selectedActionIndex = 0;
  private spellMenu: Phaser.GameObjects.Container | null = null;
  private itemMenu: Phaser.GameObjects.Container | null = null;
  private abilityMenu: Phaser.GameObjects.Container | null = null;
  private battleSpellPage = 0;
  private battleAbilityPage = 0;
  private battleItemPage = 0;
  private pendingTargetAction: PendingTargetAction | null = null;
  private selectedTargetIndex = 0;
  private turnOrder: BattleTurn[] = [];
  private currentTurnIndex = 0;
  private activeMonsterIndex: number | null = null;
  private warCryCombatants = new Set<number>();
  private inSurpriseRound = false;
  private surpriseQueue: number[] = [];
  private surpriseCursor = 0;

  private battleBackdrop!: BattleBackdropRenderer;
  private biome = "grass";
  private isReturningToOverworld = false;

  constructor() {
    super({ key: "BattleScene" });
  }

  private get targetCombatant(): GroupCombatant {
    const combatant = this.combatants[this.selectedTargetIndex];
    if (!combatant) {
      throw new Error(
        `[BattleScene] Invalid target index ${this.selectedTargetIndex}`,
      );
    }
    return combatant;
  }

  private get primaryMonster(): Monster {
    const monster = this.combatants[0]?.monster;
    if (!monster) throw new Error("[BattleScene] Encounter has no monsters");
    return monster;
  }

  private get monster(): Monster {
    return this.targetCombatant.monster;
  }

  private get monsterEffects(): ActiveStatusEffect[] {
    return this.targetCombatant.effects;
  }

  private get monsterDefending(): boolean {
    return this.targetCombatant.isDefending;
  }

  private get monsterSprite(): Phaser.GameObjects.Sprite {
    const sprite = this.monsterSprites[this.selectedTargetIndex];
    if (!sprite) throw new Error("[BattleScene] Target sprite is unavailable");
    return sprite;
  }

  private get allCombatants(): BattleCombatantState[] {
    return [...this.partyCombatants, ...this.combatants];
  }

  private get playerDefending(): boolean {
    return this.heroCombatant?.isDefending ?? false;
  }

  private set playerDefending(value: boolean) {
    if (this.heroCombatant) this.heroCombatant.isDefending = value;
  }

  private get bonusActionUsed(): boolean {
    return this.playerEconomy.bonusActionUsed;
  }

  private set bonusActionUsed(value: boolean) {
    this.playerEconomy = Object.freeze({
      ...this.playerEconomy,
      bonusActionUsed: value,
    });
  }

  private get turnActionUsed(): boolean {
    return this.playerEconomy.actionUsed;
  }

  private set turnActionUsed(value: boolean) {
    this.playerEconomy = Object.freeze({
      ...this.playerEconomy,
      actionUsed: value,
    });
  }

  private get itemsUsedThisTurn(): number {
    return this.playerEconomy.itemsUsed;
  }

  private set itemsUsedThisTurn(value: number) {
    this.playerEconomy = Object.freeze({
      ...this.playerEconomy,
      itemsUsed: value,
    });
  }

  init(data: BattleSceneData): void {
    this.player = data.player;
    if (!data.encounter && !data.monster) {
      throw new Error("[BattleScene] Missing encounter data");
    }
    this.encounter = data.encounter ?? createSoloEncounter(data.monster!);
    this.achievementBattleSourceId = nextBattleAchievementSourceId(
      this.player,
      this.encounter.id,
    );
    this.achievementBattleDebug = consumeNextBattleDebugFlag(this.player)
      || this.encounter.id.includes("debug:");
    this.oneHitDefeatIds = new Set();
    this.combatants = createGroupCombatants(this.encounter);
    this.heroCombatant = createHeroCombatant(this.player);
    this.partyCombatants = [
      this.heroCombatant,
      ...(data.partyCombatants ?? []).filter(
        (combatant) => combatant.id !== this.heroCombatant.id,
      ),
    ];
    this.partyActionSources = [
      createPlayerBattleActionSource(this.player, this.heroCombatant),
      ...createPartyActionSources(
        this.player.party,
        this.partyCombatants.filter(
          (combatant) => combatant.actorKind === "companion",
        ),
      ),
    ];
    this.battlePartyManager = new BattlePartyManager(
      this,
      this.player.party,
      this.partyActionSources,
      {
        refresh: () => {
          this.updateMonsterDisplay();
          this.updatePlayerStats();
          this.battlePartyRenderer?.update(
            this.partyCombatants,
            this.partyActionSources,
          );
        },
        present: (result) => this.presentResolvedBattleAction(result),
        afterAction: (previouslyAliveEnemyIds) =>
          this.afterPartyAction(previouslyAliveEnemyIds),
      },
    );
    this.battlePartyRenderer = new BattlePartyRenderer(this);
    this.playerEconomy = createBattleActionEconomy(this.heroCombatant.id);
    this.battleHooks = data.battleHooks;
    this.battleResultReported = false;
    this.defeatResult = null;
    this.defeatedBosses = data.defeatedBosses;
    this.codex = data.codex;
    this.timeStep = data.timeStep ?? 0;
    this.weatherState = data.weatherState ?? createWeatherState();
    this.biome = data.biome ?? "grass";
    this.savedSpecialNpcs = data.savedSpecialNpcs ?? [];
    this.codexDiscoveryIds = data.codexDiscoveryIds ?? [];
    this.battleHookCodexEntries = [];
    this.questUpdates = [];
    this.phase = "init";
    this.logLines = [];
    this.logScrollOffset = 0;
    this.actionButtons = [];
    this.actionButtonLabels = [];
    this.actionButtonActions = [];
    this.selectedActionIndex = 0;
    this.spellMenu = null;
    this.itemMenu = null;
    this.abilityMenu = null;
    this.pendingTargetAction = null;
    this.selectedTargetIndex = 0;
    this.turnOrder = [];
    this.currentTurnIndex = 0;
    this.activeMonsterIndex = null;
    this.warCryCombatants = new Set<number>();
    this.inSurpriseRound = false;
    this.surpriseQueue = [];
    this.surpriseCursor = 0;
    this.playerDefending = false;
    for (const combatant of this.combatants) {
      const entry = this.codex.entries[combatant.monster.id];
      combatant.hpRevealed = (entry?.timesDefeated ?? 0) >= 1;
      combatant.acDiscovered = entry?.acDiscovered ?? false;
      combatant.elementalDiscoveries = new Set(
        entry?.discoveredElements ?? [],
      );
    }
    this.isReturningToOverworld = false;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x0a0a1a);
    this.sceneTransitions.prepare(300);
    installSceneAccessibility(this);
    this.battlePresentation = new BattlePresentationDirector(this);
    this.codexDiscovery = new CodexDiscoveryManager(this);
    this.battleBackdrop = new BattleBackdropRenderer(this);
    this.battleBackdrop.render({
      biome: this.getInitialBackdropBiome(),
      timeStep: this.timeStep,
      weather: this.weatherState.current,
      primaryMonster: this.primaryMonster,
    });

    this.drawBattleUI();
    this.battlePartyRenderer.render(
      this.partyCombatants,
      this.partyActionSources,
    );
    for (const combatant of this.partyCombatants) {
      if (combatant.actorKind !== "companion") continue;
      const sprite = this.battlePartyRenderer.getSprite(combatant.id);
      if (sprite) {
        this.battleBackdrop.addActorShadow(
          combatant.id,
          sprite.x,
          sprite.y + 20,
          14,
          5,
        );
      }
    }
    this.registerBattlePresentationActors();
    this.battlePresentation.syncCombatants(this.allCombatants);
    this.setupDebug();
    this.applyDayNightTint();

    // ESC cancels targeting first, then closes any open sub-menu.
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on("down", () => {
      if (this.pendingTargetAction) this.cancelTargetSelection();
      else this.closeAllSubMenus();
    });
    const navigateHorizontal = (direction: number): void => {
      if (this.pendingTargetAction) this.cycleTarget(direction);
      else this.battleMenuPageChange(direction);
    };
    const navigateVertical = (direction: number): void => {
      if (this.pendingTargetAction) this.cycleTarget(direction);
      else this.cycleActionSelection(direction);
    };
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT).on("down", () => navigateHorizontal(-1));
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT).on("down", () => navigateHorizontal(1));
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP).on("down", () => navigateVertical(-1));
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN).on("down", () => navigateVertical(1));
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A).on("down", () => navigateHorizontal(-1));
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D).on("down", () => navigateHorizontal(1));
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W).on("down", () => navigateVertical(-1));
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S).on("down", () => navigateVertical(1));
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER).on("down", () => this.confirmBattleSelection());
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE).on("down", () => this.confirmBattleSelection());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.battlePresentation?.cleanup();
      this.battleBackdrop?.destroy();
      this.codexDiscovery.clear();
    });

    this.rollForInitiative();

    // Start battle or boss music
    if (audioEngine.initialized) {
      const boss = this.combatants.find((combatant) => combatant.monster.isBoss);
      if (boss) {
        audioEngine.playBossMusic(boss.monster.id);
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

    // --- Monsters in front/back formation ---
    this.monsterSprites = [];
    this.monsterTexts = [];
    const frontIndices = this.combatants.flatMap((combatant, index) =>
      combatant.position === "front" ? [index] : []
    );
    const backIndices = this.combatants.flatMap((combatant, index) =>
      combatant.position === "back" ? [index] : []
    );

    for (const [index, combatant] of this.combatants.entries()) {
      const row = combatant.position === "front" ? frontIndices : backIndices;
      const rowIndex = row.indexOf(index);
      const centerX = combatant.position === "front" ? 0.66 : 0.7;
      const spacing = combatant.position === "front" ? 0.19 : 0.17;
      const x = w * (centerX + (rowIndex - (row.length - 1) / 2) * spacing);
      const y = h * (combatant.position === "front" ? 0.39 : 0.23);
      const textureKey = getMonsterTextureKey(combatant.monster);
      const sprite = this.add.sprite(x, y, textureKey);
      sprite.setScale(
        combatant.monster.isBoss
          ? 1.7
          : combatant.position === "front" ? 1.55 : 1.25,
      );
      sprite.setDepth(
        combatant.position === "front"
          ? BATTLE_DEPTH.frontActors
          : BATTLE_DEPTH.backActors,
      );
      sprite.setInteractive({ useHandCursor: true });
      sprite.on("pointerdown", () => this.handleMonsterPointer(index));
      this.monsterSprites.push(sprite);
      this.battleBackdrop.addActorShadow(
        combatant.id,
        x,
        y + (combatant.position === "front" ? 28 : 22),
        combatant.monster.isBoss ? 28 : 20,
        combatant.monster.isBoss ? 8 : 6,
      );

      const text = this.add
        .text(w * 0.47, 6 + index * 38, "", {
          fontSize: "9px",
          fontFamily: "monospace",
          color: "#ff8888",
          backgroundColor: "#0a0a1acc",
          padding: { x: 4, y: 2 },
          wordWrap: { width: w * 0.5 },
        })
        .setDepth(BATTLE_DEPTH.ui)
        .setInteractive({ useHandCursor: true });
      text.on("pointerdown", () => this.handleMonsterPointer(index));
      this.monsterTexts.push(text);
    }

    this.synergyText = this.add
      .text(w * 0.72, h * 0.69, "", {
        fontSize: "10px",
        fontFamily: "monospace",
        color: "#ffd166",
        align: "center",
        backgroundColor: "#0a0a1acc",
        padding: { x: 5, y: 3 },
        wordWrap: { width: w * 0.48 },
      })
      .setOrigin(0.5, 0)
      .setDepth(BATTLE_DEPTH.ui);
    this.targetCursor = this.add
      .text(0, 0, "▼", {
        fontSize: "18px",
        color: "#ffd700",
      })
      .setOrigin(0.5, 1)
      .setDepth(BATTLE_DEPTH.uiOverlay)
      .setVisible(false);
    this.targetHint = this.add
      .text(w * 0.52, h * 0.745, "", {
        fontSize: "9px",
        fontFamily: "monospace",
        color: "#ffd700",
      })
      .setDepth(BATTLE_DEPTH.uiOverlay)
      .setVisible(false);
    this.updateMonsterDisplay();

    // --- Player (foreground, lower-left) ---
    // Prefer the equipped texture (reflects weapon, shield, custom skin & hair)
    const equippedKey = `player_equipped_${this.player.appearanceId}`;
    const baseKey = `player_${this.player.appearanceId}`;
    const playerTextureKey = this.textures.exists(equippedKey) ? equippedKey : baseKey;
    this.playerSprite = this.add.sprite(w * 0.22, h * 0.50, playerTextureKey);
    this.playerSprite.setScale(2.0);
    this.playerSprite.setFlipX(false);
    this.playerSprite.setDepth(BATTLE_DEPTH.frontActors);
    this.battleBackdrop.addActorShadow(
      this.heroCombatant.id,
      this.playerSprite.x,
      this.playerSprite.y + 30,
      22,
      7,
    );
    this.refreshBattlePlayerSprite();

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
        wordWrap: { width: w * 0.4 },
      })
      .setOrigin(0.5, 0)
      .setDepth(BATTLE_DEPTH.ui);
    this.updatePlayerStats();

    // Battle log (bottom strip) — scrollable
    this.logAreaY = h * 0.78;
    this.logAreaH = h * 0.22;
    const logBg = this.add.graphics();
    logBg.fillStyle(0x1a1a2e, 0.95);
    logBg.fillRect(0, this.logAreaY, w, this.logAreaH);
    logBg.lineStyle(1, 0xc0a060, 0.5);
    logBg.strokeRect(0, this.logAreaY, w, this.logAreaH);
    logBg.setDepth(BATTLE_DEPTH.uiBackdrop);

    this.logText = this.add.text(10, this.logAreaY + 4, "", {
      fontSize: "12px",
      fontFamily: "monospace",
      color: "#ccc",
      wordWrap: { width: w * 0.5 - 20 },
      lineSpacing: 5,
    }).setDepth(BATTLE_DEPTH.ui);

    // Mouse wheel scrolling on the log area
    this.input.on("wheel", (_pointer: Phaser.Input.Pointer, _gos: Phaser.GameObjects.GameObject[], _dx: number, dy: number) => {
      const maxOffset = Math.max(0, this.logLines.length - 1);
      const direction = dy < 0 ? 1 : -1;
      const nextOffset = Phaser.Math.Clamp(
        this.logScrollOffset + direction,
        0,
        maxOffset,
      );
      if (nextOffset === this.logScrollOffset) return;
      this.logScrollOffset = nextOffset;
      this.renderBattleLog();
    });

    // Action buttons (bottom-right area)
    this.createActionButtons();
  }

  private createActionButtons(): void {
    // Clear existing
    this.actionButtons.forEach((b) => b.destroy());
    this.actionButtons = [];
    this.actionButtonLabels = [];
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
    const btnW = 145;
    const btnH = 28;
    const gap = 5;

    const actions: { label: string; action: () => void }[] = [
      { label: "Attack", action: () => this.doPlayerAttack() },
    ];
    actions.push({ label: "Defend", action: () => this.doDefend() });
    if (hasAbilities) {
      actions.push({ label: "Abilities", action: () => this.showAbilityMenu() });
    }
    actions.push(
      { label: "Spells", action: () => this.showSpellMenu() },
      { label: "Items", action: () => this.showItemMenu() },
      { label: "Flee", action: () => this.doFlee() },
    );

    actions.forEach((act, i) => {
      const container = this.add.container(btnX + (i % 2) * (btnW + gap), btnY + Math.floor(i / 2) * (btnH + gap));
      container.setDepth(BATTLE_DEPTH.ui);

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
        .setOrigin(0.5)
        .setData("accessibilityMaxWidth", btnW - 12);

      bg.on("pointerover", () => {
        this.selectedActionIndex = i;
        this.updateButtonStates();
        bg.setTexture("buttonHover");
        label.setColor("#ffd700");
      });
      bg.on("pointerout", () => {
        bg.setTexture("button");
        label.setColor("#ddd");
      });
      bg.on("pointerdown", () => {
        if (this.phase === "playerTurn" && !this.pendingTargetAction) {
          act.action();
        }
      });

      container.add([bg, label]);
      this.actionButtons.push(container);
      this.actionButtonLabels.push({ text: label, label: act.label });
      this.actionButtonActions.push(act.action);
    });

    // Set initial visual state
    this.updateButtonStates();
  }

  /** Dim or enable action buttons based on current phase. */
  private updateButtonStates(): void {
    const enabled = this.phase === "playerTurn" && !this.pendingTargetAction;
    for (const btn of this.actionButtons) {
      btn.setAlpha(enabled ? 1 : 0.4);
    }
    for (const [index, action] of this.actionButtonLabels.entries()) {
      const selected = enabled && index === this.selectedActionIndex;
      action.text
        .setText(`${enabled ? selected ? "▶" : "✓" : "×"} ${action.label}`)
        .setColor(selected ? "#ffd700" : "#dddddd");
    }
  }

  private cycleActionSelection(direction: number): void {
    if (
      this.phase !== "playerTurn"
      || this.pendingTargetAction
      || this.actionButtonActions.length === 0
    ) {
      return;
    }
    this.selectedActionIndex = (
      this.selectedActionIndex + direction + this.actionButtonActions.length
    ) % this.actionButtonActions.length;
    this.updateButtonStates();
  }

  private confirmBattleSelection(): void {
    if (this.pendingTargetAction) {
      this.confirmTargetSelection();
      return;
    }
    if (this.phase !== "playerTurn") return;
    this.actionButtonActions[this.selectedActionIndex]?.();
  }

  /** Start a player turn, including status ticks, saves, and skipped turns. */
  private startPlayerTurn(): void {
    if (
      this.phase === "victory"
      || this.phase === "defeat"
      || this.phase === "fled"
    ) {
      return;
    }
    this.playerEconomy = createBattleActionEconomy(this.heroCombatant.id);
    this.playerDefending = false;
    this.activeMonsterIndex = null;
    this.pendingTargetAction = null;
    this.phase = "playerTurn";
    this.updateMonsterDisplay();
    this.updateButtonStates();

    const statusResult = processStatusStartOfTurn(
      this.player.activeEffects,
      this.player.stats,
    );
    for (const message of statusResult.messages) {
      this.addLog(`${this.player.name}: ${message}`);
    }
    this.updatePlayerStats();
    if (statusResult.tickDamage > 0) {
      this.player.hp = Math.max(0, this.player.hp - statusResult.tickDamage);
      this.updatePlayerStats();
    }
    if (this.player.hp <= 0) {
      this.battlePresentation.presentFaint(this.heroCombatant.id, 0);
      if (this.handlePartyDefeatIfNeeded()) return;
      this.addLog(`${this.player.name} is knocked out!`);
      this.advanceTurn(0);
      return;
    }
    if (statusResult.skipTurn) {
      this.addLog(`${this.player.name} cannot act this turn!`);
      this.closeAllSubMenus();
      this.finishPlayerTurn();
    }
  }

  private finishPlayerTurn(delay = 800): void {
    const statusResult = processStatusEndOfTurn(this.player.activeEffects);
    for (const message of statusResult.messages) {
      this.addLog(`${this.player.name}: ${message}`);
    }
    this.phase = "monsterTurn";
    this.updatePlayerStats();
    this.updateButtonStates();
    this.advanceTurn(delay);
  }

  private startCompanionTurn(combatant: PartyCombatant): void {
    this.phase = "monsterTurn";
    combatant.isDefending = false;
    this.updateButtonStates();
    const statusResult = processStatusStartOfTurn(
      combatant.effects,
      combatant.stats,
    );
    for (const message of statusResult.messages) {
      this.addLog(`${combatant.label}: ${message}`);
    }
    if (statusResult.tickDamage > 0) {
      combatant.currentHp -= statusResult.tickDamage;
    }
    if (!isCombatantActive(combatant)) {
      this.addLog(`${combatant.label} is knocked out!`);
      this.battlePresentation.presentFaint(combatant.id, 0);
      if (this.handlePartyDefeatIfNeeded()) return;
      this.advanceTurn(0);
      return;
    }
    if (statusResult.skipTurn) {
      this.addLog(`${combatant.label} cannot act this turn!`);
      this.finishCompanionTurn(combatant);
      return;
    }

    let completed = false;
    const completeTurn = (): void => {
      if (completed) return;
      completed = true;
      this.finishCompanionTurn(combatant);
    };
    const context: CompanionTurnContext = {
      combatant,
      actors: this.allCombatants,
      enemies: this.combatants,
      weatherPenalty: getWeatherAccuracyPenalty(this.weatherState.current),
      getEnemyDefenseBonus: (targetId: string): number => {
        const targetIndex = this.combatants.findIndex(
          (enemy) => enemy.id === targetId,
        );
        return targetIndex >= 0
          ? getSynergyACBonus(
              this.encounter.synergy,
              this.combatants,
              targetIndex,
            )
          : 0;
      },
      recordElementalInteraction: (
        targetId,
        interaction,
        element,
      ): void => {
        const targetIndex = this.combatants.findIndex(
          (enemy) => enemy.id === targetId,
        );
        if (targetIndex >= 0) {
          this.recordElementalDiscovery(
            interaction,
            element,
            targetIndex,
          );
        }
      },
      addLog: (message: string): void => this.addLog(message),
      completeTurn,
    };
    try {
      this.battlePartyManager.startTurn(combatant, context);
    } catch (error) {
      this.handleError("startCompanionTurn", error);
      completeTurn();
    }
  }

  private finishCompanionTurn(combatant: PartyCombatant): void {
    const statusResult = processStatusEndOfTurn(combatant.effects);
    for (const message of statusResult.messages) {
      this.addLog(`${combatant.label}: ${message}`);
    }
    this.advanceTurn();
  }

  private finishMonsterTurn(combatantIndex: number): void {
    const combatant = this.combatants[combatantIndex];
    if (!combatant) {
      this.handleError(
        "finishMonsterTurn",
        new Error(`Missing combatant ${combatantIndex}`),
      );
      return;
    }
    const statusResult = processStatusEndOfTurn(combatant.effects);
    for (const message of statusResult.messages) {
      this.addLog(`${combatant.label}: ${message}`);
    }
    this.activeMonsterIndex = null;
    this.updateMonsterDisplay();
    this.updatePlayerStats();
    if (this.inSurpriseRound) {
      this.advanceSurpriseRound();
    } else {
      this.advanceTurn();
    }
  }

  private beginCurrentTurn(): void {
    if (
      this.phase === "victory"
      || this.phase === "defeat"
      || this.phase === "fled"
    ) {
      return;
    }
    const turn = this.turnOrder[this.currentTurnIndex];
    if (!turn) {
      this.handleError("beginCurrentTurn", new Error("Initiative order is empty"));
      return;
    }
    const actor = getCombatantById(this.allCombatants, turn.combatantId);
    if (!actor || !isCombatantActive(actor)) {
      this.advanceTurn(0);
      return;
    }
    if (actor.actorKind === "hero") {
      this.startPlayerTurn();
      return;
    }
    if (actor.actorKind === "companion") {
      this.startCompanionTurn(actor as PartyCombatant);
      return;
    }
    const combatantIndex = this.combatants.findIndex(
      (combatant) => combatant.id === actor.id,
    );
    if (combatantIndex < 0) {
      this.handleError(
        "beginCurrentTurn",
        new Error(`Enemy combatant ${actor.id} is unavailable`),
      );
      return;
    }
    this.doMonsterTurn(combatantIndex);
  }

  private advanceTurn(delay = 550): void {
    this.time.delayedCall(delay, () => {
      if (
        this.phase === "victory"
        || this.phase === "defeat"
        || this.phase === "fled"
      ) {
        return;
      }
      for (let attempts = 0; attempts < this.turnOrder.length; attempts++) {
        this.currentTurnIndex =
          (this.currentTurnIndex + 1) % this.turnOrder.length;
        const turn = this.turnOrder[this.currentTurnIndex];
        const actor = turn
          ? getCombatantById(this.allCombatants, turn.combatantId)
          : undefined;
        if (actor && isCombatantActive(actor)) {
          this.beginCurrentTurn();
          return;
        }
      }
      if (countAliveCombatants(this.combatants) === 0) {
        this.checkBattleEnd(false);
      } else if (isPartyDefeated(this.partyCombatants)) {
        this.handlePartyDefeatIfNeeded();
      } else {
        this.handleError(
          "advanceTurn",
          new Error("No active combatant found in initiative order"),
        );
      }
    });
  }

  private startSurpriseRound(): void {
    this.surpriseQueue = this.combatants.flatMap((combatant, index) =>
      combatant.isAlive ? [index] : []
    );
    this.surpriseCursor = 0;
    this.inSurpriseRound = this.surpriseQueue.length > 0;
    if (!this.inSurpriseRound) {
      this.beginCurrentTurn();
      return;
    }
    this.addLog("Ambush! The monsters gain a surprise round!");
    this.phase = "monsterTurn";
    this.updateButtonStates();
    this.time.delayedCall(700, () => {
      const first = this.surpriseQueue[0];
      if (first !== undefined) this.doMonsterTurn(first);
    });
  }

  private advanceSurpriseRound(delay = 350): void {
    this.time.delayedCall(delay, () => {
      this.surpriseCursor++;
      while (
        this.surpriseCursor < this.surpriseQueue.length
        && !this.combatants[this.surpriseQueue[this.surpriseCursor]!]?.isAlive
      ) {
        this.surpriseCursor++;
      }
      const next = this.surpriseQueue[this.surpriseCursor];
      if (next !== undefined) {
        this.doMonsterTurn(next);
        return;
      }
      this.inSurpriseRound = false;
      this.currentTurnIndex = 0;
      this.beginCurrentTurn();
    });
  }

  private closeAllSubMenus(): void {
    if (this.spellMenu) { this.spellMenu.destroy(); this.spellMenu = null; }
    if (this.itemMenu) { this.itemMenu.destroy(); this.itemMenu = null; }
    if (this.abilityMenu) { this.abilityMenu.destroy(); this.abilityMenu = null; }
  }

  private handleMonsterPointer(targetIndex: number): void {
    const combatant = this.combatants[targetIndex];
    if (!combatant?.isAlive) return;
    if (this.pendingTargetAction) {
      if (!this.pendingTargetAction.validIndices.includes(targetIndex)) {
        this.addLog(`${combatant.label} is protected by the front row!`);
        return;
      }
      this.selectedTargetIndex = targetIndex;
      this.confirmTargetSelection();
      return;
    }
    this.selectedTargetIndex = targetIndex;
    this.updateMonsterDisplay();
  }

  private beginTargetSelection(
    label: string,
    range: AttackRange,
    execute: (targetIndex: number) => void,
  ): void {
    const validIndices = getSelectableTargetIndices(this.combatants, range);
    if (validIndices.length === 0) {
      this.addLog("No valid targets!");
      return;
    }
    this.closeAllSubMenus();
    if (!validIndices.includes(this.selectedTargetIndex)) {
      this.selectedTargetIndex = validIndices[0]!;
    }
    this.pendingTargetAction = {
      label,
      range,
      validIndices,
      execute,
    };
    this.updateButtonStates();
    this.updateMonsterDisplay();
  }

  private cycleTarget(direction: number): void {
    const pending = this.pendingTargetAction;
    if (!pending || pending.validIndices.length === 0) return;
    const current = pending.validIndices.indexOf(this.selectedTargetIndex);
    const next = (Math.max(0, current) + direction + pending.validIndices.length)
      % pending.validIndices.length;
    this.selectedTargetIndex = pending.validIndices[next]!;
    this.updateMonsterDisplay();
  }

  private confirmTargetSelection(): void {
    const pending = this.pendingTargetAction;
    if (!pending || !pending.validIndices.includes(this.selectedTargetIndex)) {
      return;
    }
    const targetIndex = this.selectedTargetIndex;
    this.pendingTargetAction = null;
    this.updateButtonStates();
    this.updateMonsterDisplay();
    pending.execute(targetIndex);
  }

  private cancelTargetSelection(): void {
    if (!this.pendingTargetAction) return;
    this.pendingTargetAction = null;
    this.addLog("Targeting cancelled.");
    this.updateButtonStates();
    this.updateMonsterDisplay();
  }

  private updateTargetSelectionDisplay(): void {
    const pending = this.pendingTargetAction;
    for (const [index, sprite] of this.monsterSprites.entries()) {
      const combatant = this.combatants[index];
      if (!combatant?.isAlive) {
        sprite.setAlpha(0.3);
      } else if (pending) {
        sprite.setAlpha(
          pending.validIndices.includes(index)
            ? index === this.selectedTargetIndex ? 1 : 0.75
            : 0.35,
        );
      } else if (this.activeMonsterIndex !== null) {
        sprite.setAlpha(index === this.activeMonsterIndex ? 1 : 0.72);
      } else {
        sprite.setAlpha(1);
      }
    }

    if (!pending) {
      this.targetCursor.setVisible(false);
      this.targetHint.setVisible(false);
      return;
    }
    const sprite = this.monsterSprites[this.selectedTargetIndex];
    const combatant = this.combatants[this.selectedTargetIndex];
    if (!sprite || !combatant) return;
    const penalty = getFormationAttackPenalty(
      this.combatants,
      this.selectedTargetIndex,
      pending.range,
    );
    this.targetCursor
      .setPosition(sprite.x, sprite.y - sprite.displayHeight / 2 - 2)
      .setVisible(true);
    this.targetHint
      .setText(
        `${pending.label}: ${combatant.label}`
        + (penalty > 0 ? ` (-${penalty} melee penalty)` : "")
        + " — arrows/WASD, Enter/Space",
      )
      .setVisible(true);
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
    container.setDepth(BATTLE_DEPTH.uiOverlay);

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
    container.setDepth(BATTLE_DEPTH.uiOverlay);

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
    if (!ability) {
      this.addLog("Unknown ability!");
      return;
    }

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
    if (this.player.mp < ability.mpCost) {
      this.addLog("Not enough MP!");
      return;
    }

    const targetType = getAbilityTargetType(ability);
    if (
      targetType === "self"
      || targetType === "single_ally"
      || targetType === "all_allies"
      || targetType === "all_party"
    ) {
      const targetIds = getBattleTargetIds(
        this.allCombatants,
        this.heroCombatant.id,
        targetType,
      );
      const healingTargets = targetIds.flatMap((targetId) => {
        const target = getCombatantById(this.partyCombatants, targetId);
        return target ? [target] : [];
      });
      const fallback = this.combatants.findIndex((combatant) => combatant.isAlive);
      if (fallback >= 0) {
        this.performPlayerAbility(abilityId, fallback, healingTargets);
      }
      return;
    }
    const range = getAbilityRange(ability);
    this.beginTargetSelection(
      ability.name,
      range,
      (targetIndex) => this.performPlayerAbility(abilityId, targetIndex),
    );
  }

  private performPlayerAbility(
    abilityId: string,
    targetIndex: number,
    healingTargets?: PartyCombatant[],
  ): void {
    if (this.phase !== "playerTurn") return;
    this.selectedTargetIndex = targetIndex;
    const ability = getAbility(abilityId);
    if (!ability) {
      this.addLog("Unknown ability!");
      return;
    }

    try {
      const range = getAbilityRange(ability);
      const formationPenalty = ability.type === "damage"
        ? getFormationAttackPenalty(this.combatants, targetIndex, range)
        : 0;
      const targetProtection = ability.type === "damage"
        ? (this.monsterDefending ? 2 : 0)
          + getSynergyACBonus(
            this.encounter.synergy,
            this.combatants,
            targetIndex,
          )
        : 0;
      const weatherPenalty = getWeatherAccuracyPenalty(this.weatherState.current)
        + formationPenalty
        + targetProtection;
      const result = playerUseAbility(
        this.player,
        abilityId,
        this.monster,
        weatherPenalty,
        this.monsterEffects,
        healingTargets,
      );
      debugLog("Player ability", { abilityId, roll: result.roll, hit: result.hit, damage: result.damage, mpUsed: result.mpUsed });
      if (result.roll !== undefined) {
        debugPanelLog(
          `  ↳ [Player Ability ${abilityId} → ${this.targetCombatant.label}] d20=${result.roll} +${result.attackMod ?? 0} = ${result.totalRoll ?? 0} vs AC ${result.targetAC ?? this.monster.ac} → ${result.hit ? (result.critical ? "CRIT" : "HIT") : "MISS"} dmg=${result.damage} mp=${result.mpUsed}`,
          false, "roll-detail"
        );
      }
      const rollSuffix = result.roll !== undefined
        ? this.formatPlayerRoll(result.roll, result.attackMod ?? 0, result.totalRoll ?? 0, result.hit, result.critical, targetIndex)
        : "";
      this.addLog(result.message + rollSuffix);
      for (const healingResult of result.healingResults ?? []) {
        const target = getCombatantById(
          this.partyCombatants,
          healingResult.targetId,
        );
        if (target) {
          this.addLog(`${target.label} recovers ${healingResult.healing} HP!`);
        }
      }
      if (result.mpUsed === 0 && !result.hit) {
        this.updatePlayerStats();
        return;
      }

      this.playerDefending = false;
      if (ability.bonusAction) {
        this.bonusActionUsed = true;
      } else {
        this.turnActionUsed = true;
        this.phase = "monsterTurn";
      }

      this.recordElementalDiscovery(
        result.elementalLabel,
        ability.element,
        targetIndex,
      );
      this.applyPartyDamageToEnemy(targetIndex, result.damage);
      this.updateMonsterDisplay();
      this.battlePresentation.presentAction({
        actorId: this.heroCombatant.id,
        kind: "ability",
        successful: result.mpUsed > 0 || result.hit,
        critical: result.critical,
        targets: [
          ...(result.damage > 0
            ? [{
                targetId: this.targetCombatant.id,
                hit: result.hit,
                damage: result.damage,
                healing: 0,
              }]
            : []),
          ...(result.healingResults ?? []).map((healingResult) => ({
            targetId: healingResult.targetId,
            hit: true,
            damage: 0,
            healing: healingResult.healing,
          })),
        ],
      });
      this.updatePlayerStats();

      this.checkBattleEnd(!ability.bonusAction);

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
    container.setDepth(BATTLE_DEPTH.uiOverlay);

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
    renderer.refreshPlayerSprite(this.player, false);
    // The texture is regenerated in-place; update our sprite
    const texKey = `player_equipped_${this.player.appearanceId}`;
    if (this.textures.exists(texKey)) {
      this.playerSprite.setTexture(texKey);
    }
  }

  private updateMonsterDisplay(): void {
    for (const [index, combatant] of this.combatants.entries()) {
      const text = this.monsterTexts[index];
      if (!text) continue;
      const defendTag = combatant.isDefending ? " [DEF]" : "";
      const selectedTag = index === this.selectedTargetIndex ? "▶ " : "  ";
      const positionTag = combatant.position.toUpperCase();
      const effectLine = combatant.effects.length > 0
        ? ` | ${this.getStatusSummary(combatant.effects)}`
        : "";
      const hpLine = combatant.hpRevealed
        ? `${combatant.currentHp}/${combatant.monster.hp} ${this.getHpBar(combatant.currentHp, combatant.monster.hp, 8)}`
        : "???";
      text.setText(
        `${selectedTag}${combatant.label}${defendTag} [${positionTag}]\n`
        + `  HP ${hpLine}${effectLine}`,
      );
    }

    const synergy = this.encounter.synergy;
    if (!synergy) {
      this.synergyText.setText("");
    } else {
      const names: Record<typeof synergy.type, string> = {
        pack_tactics: "Pack Tactics",
        shield_wall: "Shield Wall",
        war_cry: "War Cry",
        healer_support: "Healer Support",
        elemental_combo: "Elemental Combo",
      };
      const active = isSynergyActive(synergy, this.combatants);
      const warCry = this.warCryCombatants.size > 0
        ? ` | ${this.warCryCombatants.size} enraged`
        : "";
      this.synergyText.setText(
        `${names[synergy.type]} ${active ? "ACTIVE" : "BROKEN"}${warCry}\n`
        + synergy.description,
      );
      this.synergyText.setColor(active ? "#ffd166" : "#777777");
    }
    this.updateTargetSelectionDisplay();
  }

  private updatePlayerStats(): void {
    const p = this.player;
    const defendTag = this.playerDefending ? " [DEF]" : "";
    const effectLine = p.activeEffects.length > 0
      ? `\nEffects: ${this.getStatusSummary(p.activeEffects)}`
      : "";
    this.playerStatsText.setText(
      `${p.name} Lv.${p.level}${defendTag}\n` +
        `HP: ${p.hp}/${p.maxHp} ${this.getHpBar(p.hp, p.maxHp, 8)}\n` +
        `MP: ${p.mp}/${p.maxMp} ${this.getMpBar(p.mp, p.maxMp, 8)}\n` +
        `AC: ${getArmorClass(p)}${this.playerDefending ? "+2" : ""}${effectLine}`
    );
    this.battlePartyRenderer?.update(
      this.partyCombatants,
      this.partyActionSources,
    );
  }

  private getStatusSummary(effects: ActiveStatusEffect[]): string {
    const names = getActiveEffectNames(effects);
    const visibleNames = names.slice(0, 3);
    if (names.length > visibleNames.length) {
      visibleNames.push(`+${names.length - visibleNames.length} more`);
    }
    return visibleNames.join(", ");
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
    this.logScrollOffset = 0;
    this.renderBattleLog();
    // Also push to the HTML debug panel (always, panel visibility is toggled separately)
    debugPanelLog(msg, msg.startsWith("[DEBUG]"));
  }

  private renderBattleLog(): void {
    if (this.logLines.length === 0) {
      this.logText.setText("");
      return;
    }

    const visibleHeight = this.logAreaH - 8;
    const endIndex = Math.max(
      1,
      this.logLines.length - this.logScrollOffset,
    );
    let startIndex = endIndex - 1;
    let visibleText = `${this.logLines[startIndex]}\n `;
    this.logText.setText(visibleText);

    while (startIndex > 0) {
      const candidate = `${this.logLines
        .slice(startIndex - 1, endIndex)
        .join("\n")}\n `;
      this.logText.setText(candidate);
      if (this.logText.height > visibleHeight) {
        this.logText.setText(visibleText);
        break;
      }
      startIndex--;
      visibleText = candidate;
    }

    this.logText.setY(this.logAreaY + 4);
  }

  // --- Debug ---

  private setupDebug(): void {
    debugPanelLog(`── Battle: ${this.player.name} vs ${this.encounter.name} ──`, true);

    const cb = { updateUI: () => this.updatePlayerStats() };

    // Shared hotkeys: G=Gold, H=Heal, P=MP, L=LvUp
    registerSharedHotkeys(this, this.player, cb);

    // Battle-only hotkeys
    const kKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.K);
    kKey.on("down", () => {
      if (!isDebug()) return;
      debugLog("CHEAT: Kill encounter");
      debugPanelLog("[CHEAT] Encounter defeated!", true);
      this.defeatEncounterForDebug();
    });

    // Slash commands: shared + battle-specific
    const cmds = buildSharedCommands(this.player, cb);

    cmds.set("kill", () => {
      this.defeatEncounterForDebug();
      debugPanelLog(`[CMD] Encounter defeated!`, true);
    });
    cmds.set("defeat", () => {
      this.defeatPartyForDebug();
      debugPanelLog("[CMD] Party defeated!", true);
    });
    cmds.set("backdrop", (args) => this.handleBackdropDebugCommand(args));

    // Help entries
    const helpEntries: HelpEntry[] = [
      { usage: "/kill", desc: "Defeat the encounter instantly" },
      { usage: "/defeat", desc: "Defeat the active party instantly" },
      {
        usage: "/backdrop <inspect|labels|set>",
        desc: "Inspect or set biome/time/weather layers",
      },
      ...SHARED_HELP,
    ];

    registerCommandRouter(cmds, "Battle", helpEntries);
  }

  private defeatEncounterForDebug(): void {
    if (
      this.phase === "victory"
      || this.phase === "defeat"
      || this.phase === "fled"
    ) {
      return;
    }
    for (const [index, combatant] of this.combatants.entries()) {
      if (combatant.isAlive) this.setCombatantHp(index, 0);
    }
    this.updateMonsterDisplay();
    this.checkBattleEnd(false);
  }

  private defeatPartyForDebug(): void {
    if (
      this.phase === "victory"
      || this.phase === "defeat"
      || this.phase === "fled"
    ) {
      return;
    }
    for (const combatant of this.partyCombatants) {
      combatant.currentHp = 0;
    }
    this.updatePlayerStats();
    this.battlePartyRenderer.update(
      this.partyCombatants,
      this.partyActionSources,
    );
    this.handlePartyDefeatIfNeeded();
  }

  private updateDebugPanel(): void {
    const p = this.player;
    const defInfo = this.playerDefending ? " [DEF+2]" : "";
    const monsters = this.combatants
      .map((combatant) =>
        `${combatant.label} ${combatant.currentHp}/${combatant.monster.hp}`
        + ` [${combatant.monster.family}:${getMonsterTextureKey(combatant.monster)}]`
        + (combatant.isDefending ? "[DEF]" : "")
      )
      .join(" | ");
    debugPanelState(
      `BATTLE | Phase: ${this.phase} | ` +
      `Anim: ${this.battlePresentation?.debugState ?? "init"} | ` +
      `Backdrop: ${this.biome}/${getTimePeriod(this.timeStep)}/${this.weatherState.current} | ` +
      `Monsters: ${monsters} | ` +
      `Player: HP ${p.hp}/${p.maxHp} MP ${p.mp}/${p.maxMp} AC ${getArmorClass(p)}${defInfo} | ` +
      `Lv.${p.level} XP ${p.xp}/${xpForLevel(p.level + 1)} Gold ${p.gold}\n` +
      `Cheats: K=Kill H=Heal P=MP G=+100Gold L=LvUp X=MaxXP`
    );
  }

  private handleBackdropDebugCommand(args: string): void {
    const [action = "inspect", biomeArg, timeArg, weatherArg] = args
      .trim()
      .toLowerCase()
      .split(/\s+/);
    if (action === "inspect") {
      debugPanelLog(
        `[BACKDROP] ${this.battleBackdrop.getInspectionReport()}`,
        true,
      );
      return;
    }

    if (action === "labels") {
      const visible = biomeArg !== "off";
      this.battleBackdrop.setInspectionLabels(visible);
      debugPanelLog(`[BACKDROP] Labels ${visible ? "on" : "off"}`, true);
      return;
    }
    if (action !== "set" || !biomeArg || !timeArg || !weatherArg) {
      debugPanelLog(
        "Usage: /backdrop set <biome> <dawn|day|dusk|night> "
          + "<clear|rain|snow|sandstorm|storm|fog>",
        true,
      );
      return;
    }
    const timeSteps: Record<string, number> = {
      dawn: 10,
      day: 100,
      dusk: 235,
      night: 300,
    };
    const weatherTypes: Record<string, WeatherType> = {
      clear: WeatherType.Clear,
      rain: WeatherType.Rain,
      snow: WeatherType.Snow,
      sandstorm: WeatherType.Sandstorm,
      storm: WeatherType.Storm,
      fog: WeatherType.Fog,
    };
    const timeStep = timeSteps[timeArg];
    const weather = weatherTypes[weatherArg];
    if (timeStep === undefined || weather === undefined) {
      debugPanelLog("[BACKDROP] Unknown time or weather value", true);
      return;
    }
    this.biome = biomeArg;
    this.timeStep = timeStep;
    this.weatherState.current = weather;
    this.battleBackdrop.render({
      biome: this.biome,
      timeStep: this.timeStep,
      weather,
      primaryMonster: this.primaryMonster,
    });
    this.applyDayNightTint();
    debugPanelLog(
      `[BACKDROP] Set ${this.biome}/${timeArg}/${weather}`,
      true,
    );
  }

  private getInitialBackdropBiome(): string {
    const bossBiome: Record<string, string> = {
      troll: "dungeon",
      cryptLich: "dungeon",
      frostWarden: "tundra",
      infernoForgemaster: "volcanic",
      kraken: "sea",
    };
    return bossBiome[this.primaryMonster.id] ?? this.biome;
  }

  // --- Combat Flow ---

  private rollForInitiative(): void {
    try {
      const result = rollBattleInitiative(
        this.allCombatants,
        (combatant) => {
          if (combatant.side === "party") {
            if (
              this.achievementBattleDebug
              && combatant.id === this.heroCombatant.id
            ) {
              return 1_000;
            }
            return abilityModifier((combatant as PartyCombatant).stats.dexterity);
          }
          const enemy = combatant as GroupCombatant;
          return enemy.monster.attackBonus
            + getMonsterWeatherBoost(
              enemy.monster.id,
              this.weatherState.current,
            ).initiativeBonus;
        },
      );
      this.turnOrder = result.order;
      this.currentTurnIndex = 0;
      const playerRoll = result.rolls[this.heroCombatant.id] ?? 0;
      const monsterRolls = this.combatants.map(
        (combatant) => result.rolls[combatant.id] ?? 0,
      );
      debugLog("Group initiative", {
        playerRoll,
        monsterRolls,
        order: result.order,
      });
      debugPanelLog(
        `  ↳ [Initiative] Party=${this.partyCombatants.map((combatant) => `${combatant.label}:${result.rolls[combatant.id] ?? 0}`).join(", ")}; Monsters=${monsterRolls.join(", ")}`,
        false, "roll-detail"
      );
      this.addLog(
        `⚔ ${this.encounter.name} appears (${this.combatants.length} foe${this.combatants.length === 1 ? "" : "s"})!`
      );

      // Announce weather effects and monster boost
      const weatherPenalty = getWeatherAccuracyPenalty(this.weatherState.current);
      if (this.weatherState.current !== WeatherType.Clear) {
        this.addLog(`${WEATHER_LABEL[this.weatherState.current]} — attacks are harder to land (penalty: ${weatherPenalty})`);
      }
      const boosted = this.combatants.filter((combatant) =>
        getMonsterWeatherBoost(
          combatant.monster.id,
          this.weatherState.current,
        ).attackBonus > 0
      );
      if (boosted.length > 0) {
        this.addLog(
          `${boosted.map((combatant) => combatant.label).join(", ")} thrive in this weather!`,
        );
      }

      if (this.encounter.surpriseRound) {
        this.startSurpriseRound();
        return;
      }
      const first = this.turnOrder[0];
      const firstActor = first
        ? getCombatantById(this.allCombatants, first.combatantId)
        : undefined;
      this.addLog(
        firstActor?.actorKind === "hero"
          ? "You act first!"
          : `${firstActor?.label ?? "A combatant"} acts first!`,
      );
      this.time.delayedCall(700, () => this.beginCurrentTurn());
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
    const range = getAttackRangeForWeapon(this.player.equippedWeapon);
    this.beginTargetSelection(
      "Attack",
      range,
      (targetIndex) => this.performPlayerAttack(targetIndex, range),
    );
  }

  private performPlayerAttack(
    targetIndex: number,
    range: AttackRange,
  ): void {
    if (this.phase !== "playerTurn" || this.turnActionUsed) return;
    this.selectedTargetIndex = targetIndex;
    this.closeAllSubMenus();
    this.playerDefending = false; // reset defend on new action
    this.turnActionUsed = true;
    this.phase = "monsterTurn"; // prevent double actions

    try {
      const monsterDefBonus = (this.monsterDefending ? 2 : 0)
        + getSynergyACBonus(
          this.encounter.synergy,
          this.combatants,
          targetIndex,
        );
      const weatherPenalty = getWeatherAccuracyPenalty(this.weatherState.current)
        + getFormationAttackPenalty(this.combatants, targetIndex, range);
      const result = playerAttack(
        this.player,
        this.monster,
        monsterDefBonus,
        weatherPenalty,
        this.monsterEffects,
      );
      debugLog("Player attack", { target: this.targetCombatant.label, roll: result.roll, hit: result.hit, critical: result.critical, damage: result.damage, monsterAC: this.monster.ac });
      debugPanelLog(
        `  ↳ [Player Attack → ${this.targetCombatant.label}] d20=${result.roll} +${result.attackMod} = ${result.totalRoll} vs AC ${result.targetAC} → ${result.hit ? (result.critical ? "CRIT" : "HIT") : "MISS"} dmg=${result.damage}`,
        false, "roll-detail"
      );
      this.addLog(result.message + this.formatPlayerRoll(result.roll, result.attackMod, result.totalRoll, result.hit, result.critical, targetIndex));
      this.recordElementalDiscovery(
        result.elementalLabel,
        this.player.equippedWeapon?.element,
        targetIndex,
      );
      this.applyPartyDamageToEnemy(targetIndex, result.damage);
      this.updateMonsterDisplay();
      this.battlePresentation.presentAction({
        actorId: this.heroCombatant.id,
        kind: "attack",
        successful: true,
        critical: result.critical,
        targets: [{
          targetId: this.targetCombatant.id,
          hit: result.hit,
          damage: result.damage,
          healing: 0,
        }],
      });

      // Off-hand bonus action: if player has an off-hand weapon and bonus action is unused,
      // automatically follow up with an off-hand attack (no ability mod bonus per D&D 5e TWF)
      if (
        this.player.equippedOffHand
        && !this.bonusActionUsed
        && countAliveCombatants(this.combatants) > 0
      ) {
        this.bonusActionUsed = true;
        const offHandTargets = getSelectableTargetIndices(
          this.combatants,
          "melee",
        );
        const offHandTarget = this.combatants[targetIndex]?.isAlive
          ? targetIndex
          : offHandTargets[0];
        if (offHandTarget === undefined) {
          this.checkBattleEnd();
          return;
        }
        this.selectedTargetIndex = offHandTarget;
        const offHandDefendBonus = (this.monsterDefending ? 2 : 0)
          + getSynergyACBonus(
            this.encounter.synergy,
            this.combatants,
            offHandTarget,
          );
        const offHandPenalty = getFormationAttackPenalty(
          this.combatants,
          offHandTarget,
          "melee",
        );
        const offResult = playerOffHandAttack(
          this.player,
          this.monster,
          offHandDefendBonus,
          getWeatherAccuracyPenalty(this.weatherState.current) + offHandPenalty,
          this.monsterEffects,
        );
        debugLog("Player off-hand attack (bonus action)", { roll: offResult.roll, hit: offResult.hit, critical: offResult.critical, damage: offResult.damage });
        debugPanelLog(
          `  ↳ [Off-Hand → ${this.targetCombatant.label}] d20=${offResult.roll} +${offResult.attackMod} = ${offResult.totalRoll} vs AC ${offResult.targetAC} → ${offResult.hit ? (offResult.critical ? "CRIT" : "HIT") : "MISS"} dmg=${offResult.damage}`,
          false, "roll-detail"
        );
        this.addLog(offResult.message + this.formatPlayerRoll(offResult.roll, offResult.attackMod, offResult.totalRoll, offResult.hit, offResult.critical, offHandTarget));
        this.recordElementalDiscovery(
          offResult.elementalLabel,
          this.player.equippedOffHand?.element,
          offHandTarget,
        );
        this.applyPartyDamageToEnemy(offHandTarget, offResult.damage);
        this.updateMonsterDisplay();
        this.battlePresentation.presentAction({
          actorId: this.heroCombatant.id,
          kind: "attack",
          successful: true,
          critical: offResult.critical,
          targets: [{
            targetId: this.targetCombatant.id,
            hit: offResult.hit,
            damage: offResult.damage,
            healing: 0,
          }],
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
    this.playerDefending = true;
    this.turnActionUsed = true;
    this.phase = "monsterTurn";
    const hasShield = !!this.player.equippedShield && !this.player.equippedWeapon?.twoHanded;
    const shieldNote = hasShield ? ", shield -1 dmg" : "";
    this.addLog(`${this.player.name} takes a defensive stance! (+2 AC${shieldNote})`);
    debugPanelLog(`  ↳ [Defend] AC ${getArmorClass(this.player)} → ${getArmorClass(this.player) + 2}${shieldNote}`, false, "roll-detail");
    this.battlePresentation.presentAction({
      actorId: this.heroCombatant.id,
      kind: "defend",
      successful: true,
      targets: [{
        targetId: this.heroCombatant.id,
        hit: true,
        damage: 0,
        healing: 0,
      }],
    });
    this.updatePlayerStats();
    this.finishPlayerTurn();
  }

  private doPlayerSpell(spellId: string): void {
    if (this.phase !== "playerTurn") return;
    if (this.turnActionUsed) {
      this.addLog("Turn action already used!");
      return;
    }
    const spell = getSpell(spellId);
    if (!spell) {
      this.addLog("Unknown spell!");
      return;
    }
    if (this.player.mp < spell.mpCost) {
      this.addLog("Not enough MP!");
      return;
    }
    const targetType = getSpellTargetType(spell);
    if (targetType === "single" || targetType === "single_enemy") {
      this.beginTargetSelection(
        spell.name,
        "ranged",
        (targetIndex) => this.performPlayerSpell(
          spellId,
          [this.combatants[targetIndex]!.id],
        ),
      );
      return;
    }
    const targetIds = getBattleTargetIds(
      this.allCombatants,
      this.heroCombatant.id,
      targetType,
    );
    if (targetIds.length === 0) {
      this.addLog("No valid targets!");
      return;
    }
    this.performPlayerSpell(spellId, targetIds);
  }

  private performPlayerSpell(
    spellId: string,
    targetIds: string[],
  ): void {
    if (this.phase !== "playerTurn" || this.turnActionUsed) return;
    const spell = getSpell(spellId);
    if (!spell) {
      this.addLog("Unknown spell!");
      return;
    }
    if (this.player.mp < spell.mpCost) {
      this.addLog("Not enough MP!");
      return;
    }
    const isDamageSpell = spell.type === "damage";
    const enemyTargets = targetIds.flatMap((targetId) => {
      const index = this.combatants.findIndex(
        (combatant) => combatant.id === targetId,
      );
      return index >= 0
        ? [{ combatant: this.combatants[index]!, index }]
        : [];
    });
    const healingTargets = targetIds.flatMap((targetId) => {
      const combatant = getCombatantById(this.partyCombatants, targetId);
      return combatant ? [combatant as HealingTarget] : [];
    });
    if (isDamageSpell && enemyTargets.length === 0) {
      this.addLog("No valid targets!");
      return;
    }
    const weatherPenalty = getWeatherAccuracyPenalty(this.weatherState.current);
    const targets = enemyTargets.map(({ combatant, index }) => {
      return {
        monster: combatant.monster,
        monsterEffects: combatant.effects,
        weatherPenalty,
        acPenalty: (combatant.isDefending ? 2 : 0)
          + getSynergyACBonus(
            this.encounter.synergy,
            this.combatants,
            index,
          ),
      };
    });

    this.playerDefending = false;
    this.turnActionUsed = true;
    this.phase = "monsterTurn";

    try {
      const result = playerCastSpellAtTargets(
        this.player,
        spellId,
        targets,
        healingTargets,
      );
      debugLog("Player group spell", {
        spellId,
        targetIds,
        hit: result.hit,
        damage: result.damage,
        mpUsed: result.mpUsed,
      });
      this.addLog(result.message);

      for (const targetResult of result.results) {
        const target = enemyTargets[targetResult.targetIndex];
        if (!target) continue;
        const combatantIndex = target.index;
        const combatant = target.combatant;
        const rollSuffix = targetResult.roll !== undefined
          && !targetResult.autoHit
          ? this.formatPlayerRoll(
              targetResult.roll,
              targetResult.spellMod ?? 0,
              targetResult.totalRoll ?? 0,
              targetResult.hit,
              false,
              combatantIndex,
            )
          : "";
        this.addLog(
          targetResult.message.replace(
            combatant.monster.name,
            combatant.label,
          ) + rollSuffix,
        );
        debugPanelLog(
          `  ↳ [Player Spell ${spellId} → ${combatant.label}] ${targetResult.autoHit ? "AUTO-HIT" : targetResult.hit ? "HIT" : "MISS"} dmg=${targetResult.damage} mp=${result.mpUsed}`,
          false, "roll-detail"
        );
        this.recordElementalDiscovery(
          targetResult.elementalLabel,
          spell.element,
          combatantIndex,
        );
        this.applyPartyDamageToEnemy(combatantIndex, targetResult.damage);
      }
      for (const healingResult of result.healingResults) {
        const target = getCombatantById(
          this.partyCombatants,
          healingResult.targetId,
        );
        if (!target) continue;
        this.addLog(`${target.label} recovers ${healingResult.healing} HP!`);
      }

      this.updateMonsterDisplay();
      this.updatePlayerStats();
      this.battlePresentation.presentAction({
        actorId: this.heroCombatant.id,
        kind: "spell",
        successful: result.mpUsed > 0,
        targets: [
          ...result.results.flatMap((targetResult) => {
            const target = enemyTargets[targetResult.targetIndex];
            return target
              ? [{
                  targetId: target.combatant.id,
                  hit: targetResult.hit,
                  damage: targetResult.damage,
                  healing: 0,
                }]
              : [];
          }),
          ...result.healingResults.map((healingResult) => ({
            targetId: healingResult.targetId,
            hit: true,
            damage: 0,
            healing: healingResult.healing,
          })),
        ],
      });

      this.checkBattleEnd();
    } catch (err) {
      this.handleError("performPlayerSpell", err);
    }
  }

  private doUseItem(itemIndex: number): void {
    if (this.phase !== "playerTurn") return;

    // Items are bonus actions: 1st item is free, 2nd item sacrifices turn action
    if (this.itemsUsedThisTurn >= 2) {
      this.addLog("Cannot use more than 2 items per turn!");
      return;
    }
    if (this.itemsUsedThisTurn === 0 && this.bonusActionUsed) {
      this.addLog("Bonus action already used this turn!");
      return;
    }
    if (this.itemsUsedThisTurn === 1 && this.turnActionUsed) {
      this.addLog("No actions remaining this turn!");
      return;
    }

    try {
      const result = useItem(this.player, itemIndex);
      this.addLog(result.message);
      this.updatePlayerStats();

      if (result.used) {
        this.battlePresentation.presentAction({
          actorId: this.heroCombatant.id,
          kind: "item",
          successful: true,
          targets: [{
            targetId: this.heroCombatant.id,
            hit: true,
            damage: 0,
            healing: 0,
          }],
        });
        this.itemsUsedThisTurn++;
        if (this.itemsUsedThisTurn === 1) {
          // First item: bonus action used, player still has turn action
          this.bonusActionUsed = true;
          this.addLog("(Bonus action — you can still act this turn)");
          this.closeAllSubMenus();
        } else {
          // Second item: sacrifices turn action, end turn
          this.turnActionUsed = true;
          this.addLog("(Used 2 items — turn action spent)");
          this.closeAllSubMenus();
          this.finishPlayerTurn();
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

    if (this.combatants.some((combatant) => combatant.monster.isBoss)) {
      this.addLog("Cannot flee from a boss fight!");
      return;
    }

    this.closeAllSubMenus();
    this.turnActionUsed = true;
    this.phase = "monsterTurn";
    try {
      const dexMod = abilityModifier(this.player.stats.dexterity);
      const aliveCount = countAliveCombatants(this.combatants);
      const result = attemptFlee(dexMod, aliveCount);
      debugLog("Flee attempt", { success: result.success, dexMod, aliveCount });
      debugPanelLog(
        `  ↳ [Flee] dexMod=${dexMod} → ${result.success ? "ESCAPED" : "FAILED"}`,
        false, "roll-detail"
      );
      this.addLog(result.message);
      this.battlePresentation.presentAction({
        actorId: this.heroCombatant.id,
        kind: "flee",
        successful: result.success,
        targets: [],
      });

      if (result.success) {
        this.phase = "fled";
        this.reportBattleResult("fled");
        saveGame(
          this.player,
          this.defeatedBosses,
          this.codex,
          this.player.appearanceId,
          this.timeStep,
          this.weatherState,
        );
        this.time.delayedCall(1000, () => this.returnToOverworld());
      } else {
        this.finishPlayerTurn();
      }
    } catch (err) {
      this.handleError("doFlee", err);
    }
  }

  private doMonsterTurn(combatantIndex: number): void {
    if (this.phase === "victory" || this.phase === "defeat" || this.phase === "fled")
      return;

    try {
      const combatant = this.combatants[combatantIndex];
      if (!combatant?.isAlive) {
        if (this.inSurpriseRound) this.advanceSurpriseRound(0);
        else this.advanceTurn(0);
        return;
      }
      this.phase = "monsterTurn";
      this.activeMonsterIndex = combatantIndex;
      combatant.isDefending = false;
      this.updateButtonStates();
      this.updateMonsterDisplay();
      const statusResult = processStatusStartOfTurn(
        combatant.effects,
        deriveMonsterStats(combatant.monster.attackBonus),
      );
      for (const message of statusResult.messages) {
        this.addLog(`${combatant.label}: ${message}`);
      }
      this.updateMonsterDisplay();
      if (statusResult.tickDamage > 0) {
        this.setCombatantHp(
          combatantIndex,
          combatant.currentHp - statusResult.tickDamage,
        );
        this.updateMonsterDisplay();
      }
      if (!combatant.isAlive) {
        this.checkBattleEnd(false);
        if (countAliveCombatants(this.combatants) > 0) {
          if (this.inSurpriseRound) this.advanceSurpriseRound(0);
          else this.advanceTurn(0);
        }
        return;
      }
      if (statusResult.skipTurn) {
        this.addLog(`${combatant.label} cannot act this turn!`);
        this.finishMonsterTurn(combatantIndex);
        return;
      }

      const supportAbility = isSynergyActive(
        this.encounter.synergy,
        this.combatants,
      ) && this.encounter.synergy?.type === "healer_support"
        && combatant.position === "back"
        ? combatant.monster.abilities?.find(
            (ability) =>
              ability.type === "heal"
              && this.combatants.some(
                (ally) =>
                  ally.isAlive && ally.currentHp < ally.monster.hp,
              ),
          )
        : undefined;
      if (supportAbility) {
        this.executeMonsterAbility(
          combatantIndex,
          supportAbility,
          this.heroCombatant,
        );
        return;
      }

      const defendChance = getMonsterDefendChance(
        this.encounter.synergy,
        this.combatants,
        combatantIndex,
      );
      if (Math.random() < defendChance) {
        combatant.isDefending = true;
        this.addLog(`${combatant.label} takes a defensive stance!`);
        const statusAC = getEffectACModifier(combatant.effects);
        const synergyAC = getSynergyACBonus(
          this.encounter.synergy,
          this.combatants,
          combatantIndex,
        );
        debugPanelLog(`  ↳ [Monster Defend] ${combatant.label} AC ${combatant.monster.ac + statusAC + synergyAC} → ${combatant.monster.ac + statusAC + synergyAC + 2}`, false, "roll-detail");
        this.battlePresentation.presentAction({
          actorId: combatant.id,
          kind: "defend",
          successful: true,
          targets: [{
            targetId: combatant.id,
            hit: true,
            damage: 0,
            healing: 0,
          }],
        });
        this.updateMonsterDisplay();
        this.finishMonsterTurn(combatantIndex);
        return;
      }

      const partyTarget = selectMonsterTarget(this.partyCombatants);
      if (!partyTarget) {
        this.handlePartyDefeatIfNeeded();
        return;
      }

      // Check for monster ability use
      if (combatant.monster.abilities) {
        for (const ability of combatant.monster.abilities) {
          if (Math.random() < ability.chance) {
            this.executeMonsterAbility(combatantIndex, ability, partyTarget);
            return;
          }
        }
      }

      // Normal attack — target one living party combatant.
      const defendBonus = partyTarget.isDefending ? 2 : 0;
      const weatherPenalty = getWeatherAccuracyPenalty(this.weatherState.current);
      const boost = getMonsterWeatherBoost(combatant.monster.id, this.weatherState.current);
      const warCryActive = this.warCryCombatants.has(combatantIndex);
      const synergyAttackBonus = getSynergyAttackBonus(
        this.encounter.synergy,
        this.combatants,
        combatantIndex,
        warCryActive,
      );
      const synergyDamageBonus = getSynergyDamageBonus(
        this.encounter.synergy,
        this.combatants,
        combatantIndex,
      );
      const result = monsterAttackTarget(
        combatant.monster,
        partyTarget,
        defendBonus,
        weatherPenalty,
        boost.attackBonus,
        combatant.effects,
        synergyAttackBonus,
        synergyDamageBonus,
      );
      if (warCryActive) this.warCryCombatants.delete(combatantIndex);

      // Shield defend bonus: reduce incoming damage by 1 when defending with a shield equipped
      const partyTargetSource = this.partyActionSources.find(
        (source) => source.combatant.id === partyTarget.id,
      );
      const shieldDefendReduction = (
        partyTarget.isDefending
        && partyTargetSource?.state.equippedShield
        && !partyTargetSource.state.equippedWeapon?.twoHanded
      ) ? 1 : 0;
      if (shieldDefendReduction > 0 && result.hit && result.damage > 0) {
        const reduced = Math.min(shieldDefendReduction, result.damage);
        result.damage -= reduced;
        partyTarget.currentHp = Math.min(
          partyTarget.maxHp,
          partyTarget.currentHp + reduced,
        );
      }

      debugLog("Monster attack", {
        monster: combatant.label,
        naturalRoll: result.roll,
        attackBonus: result.attackBonus,
        totalRoll: result.totalRoll,
        targetAC: result.targetAC,
        hit: result.hit,
        critical: result.critical,
        damage: result.damage,
        target: partyTarget.id,
        targetHP: partyTarget.currentHp,
        targetDefending: partyTarget.isDefending,
        shieldDefendReduction,
      });
      debugPanelLog(
        `  ↳ [Monster Attack ${combatant.label} → ${partyTarget.label}] d20=${result.roll} +=${result.attackBonus} = ${result.totalRoll} vs AC ${result.targetAC}${partyTarget.isDefending ? " (DEF+2)" : ""}${shieldDefendReduction ? " (shield -1)" : ""} → ${result.hit ? (result.critical ? "CRIT" : "HIT") : "MISS"} dmg=${result.damage} → HP ${partyTarget.currentHp}`,
        false, "roll-detail"
      );
      // Only show the outcome message, never the enemy's roll details
      this.addLog(
        result.message.replace(combatant.monster.name, combatant.label),
      );

      this.battlePresentation.presentAction({
        actorId: combatant.id,
        kind: "attack",
        successful: true,
        critical: result.critical,
        targets: [{
          targetId: partyTarget.id,
          hit: result.hit,
          damage: result.damage,
          healing: 0,
        }],
      });
      if (!isCombatantActive(partyTarget)) {
        this.battlePresentation.presentFaint(partyTarget.id);
      }

      if (this.handlePartyDefeatIfNeeded()) return;

      this.finishMonsterTurn(combatantIndex);
    } catch (err) {
      this.handleError("doMonsterTurn", err);
    }
  }

  private executeMonsterAbility(
    combatantIndex: number,
    ability: MonsterAbility,
    partyTarget: PartyCombatant,
  ): void {
    const combatant = this.combatants[combatantIndex];
    if (!combatant?.isAlive) return;
    const result = monsterUseAbilityTarget(
      ability,
      combatant.monster,
      partyTarget,
      combatant.effects,
      getSynergyDamageBonus(
        this.encounter.synergy,
        this.combatants,
        combatantIndex,
      ),
    );
    debugLog("Monster ability", {
      monster: combatant.label,
      name: ability.name,
      damage: result.damage,
      healing: result.healing,
    });
    debugPanelLog(
      `  ↳ [Monster Ability ${combatant.label}] ${ability.name} → dmg=${result.damage} heal=${result.healing}`,
      false, "roll-detail"
    );

    if (result.healing > 0) {
      const supportHealing = ability.type === "heal"
        && this.encounter.synergy?.type === "healer_support"
        && isSynergyActive(this.encounter.synergy, this.combatants);
      const healTargetIndex = supportHealing
        ? (findLowestHpAllyIndex(this.combatants) ?? combatantIndex)
        : combatantIndex;
      const healTarget = this.combatants[healTargetIndex]!;
      this.setCombatantHp(
        healTargetIndex,
        Math.min(
          healTarget.monster.hp,
          healTarget.currentHp + result.healing,
        ),
      );
      this.addLog(
        healTargetIndex === combatantIndex
          ? result.message.replace(combatant.monster.name, combatant.label)
          : `${combatant.label} uses ${ability.name}! ${healTarget.label} recovers ${result.healing} HP!`,
      );
      this.battlePresentation.presentAction({
        actorId: combatant.id,
        kind: "ability",
        successful: true,
        targets: [{
          targetId: healTarget.id,
          hit: true,
          damage: 0,
          healing: result.healing,
        }],
      });
    } else {
      this.addLog(
        result.message.replace(combatant.monster.name, combatant.label),
      );
      this.battlePresentation.presentAction({
        actorId: combatant.id,
        kind: "ability",
        successful: true,
        targets: [{
          targetId: partyTarget.id,
          hit: result.damage > 0,
          damage: result.damage,
          healing: 0,
        }],
      });
    }
    if (result.damage > 0 && !isCombatantActive(partyTarget)) {
      this.battlePresentation.presentFaint(partyTarget.id);
    }

    this.updateMonsterDisplay();
    this.updatePlayerStats();
    if (this.handlePartyDefeatIfNeeded()) return;
    this.finishMonsterTurn(combatantIndex);
  }

  private handlePartyDefeatIfNeeded(): boolean {
    if (!isPartyDefeated(this.partyCombatants)) return false;
    if (this.phase === "defeat") return true;
    this.phase = "defeat";
    this.updateButtonStates();
    this.addLog("Your party has been defeated...");
    this.battlePresentation.syncCombatants(this.partyCombatants);
    this.time.delayedCall(2000, () => this.handleDefeat());
    return true;
  }

  private handleEnemyDefeat(
    combatantIndex: number,
    synergyWasActive: boolean,
  ): void {
    const combatant = this.combatants[combatantIndex];
    if (!combatant) return;
    combatant.isAlive = false;
    combatant.isKnockedOut = true;
    combatant.isDefending = false;
    this.warCryCombatants.delete(combatantIndex);
    this.addLog(`${combatant.label} is defeated!`);
    this.battlePresentation.presentFaint(combatant.id);
    this.battleHooks?.onCombatantDefeated?.(combatant);

    if (
      this.encounter.synergy?.type === "war_cry"
      && synergyWasActive
    ) {
      for (const [index, ally] of this.combatants.entries()) {
        if (ally.isAlive) this.warCryCombatants.add(index);
      }
      if (this.warCryCombatants.size > 0) {
        this.addLog("War Cry! Each survivor gains +2 on its next attack.");
      }
    }

    const synergyIsActive = isSynergyActive(
      this.encounter.synergy,
      this.combatants,
    );
    if (this.encounter.synergy && synergyWasActive && !synergyIsActive) {
      this.addLog(`${this.encounter.synergy.description} The synergy breaks!`);
    }

    if (this.selectedTargetIndex === combatantIndex) {
      const next = this.combatants.findIndex((ally) => ally.isAlive);
      if (next >= 0) this.selectedTargetIndex = next;
    }
  }

  private afterPartyAction(
    previouslyAliveEnemyIds: ReadonlySet<string>,
  ): boolean {
    const synergyWasActive = this.encounter.synergy
      ? this.combatants.length - previouslyAliveEnemyIds.size
        < this.encounter.synergy.breakThreshold
      : false;
    for (const [index, combatant] of this.combatants.entries()) {
      if (
        previouslyAliveEnemyIds.has(combatant.id)
        && !isCombatantActive(combatant)
      ) {
        this.handleEnemyDefeat(index, synergyWasActive);
      }
    }
    this.updateMonsterDisplay();
    this.updatePlayerStats();
    this.battlePartyRenderer.update(
      this.partyCombatants,
      this.partyActionSources,
    );
    if (countAliveCombatants(this.combatants) === 0) {
      this.handleVictory();
      return true;
    }
    return false;
  }

  private setCombatantHp(combatantIndex: number, value: number): void {
    const combatant = this.combatants[combatantIndex];
    if (!combatant) {
      throw new Error(`[BattleScene] Missing combatant ${combatantIndex}`);
    }
    if (!combatant.isAlive && value > 0) return;

    const wasAlive = combatant.isAlive;
    const synergyWasActive = isSynergyActive(
      this.encounter.synergy,
      this.combatants,
    );
    combatant.currentHp = Phaser.Math.Clamp(
      value,
      0,
      combatant.monster.hp,
    );
    if (combatant.currentHp > 0 || !wasAlive) return;

    this.handleEnemyDefeat(combatantIndex, synergyWasActive);
  }

  private checkBattleEnd(endPlayerTurn = true): void {
    try {
      if (countAliveCombatants(this.combatants) === 0) {
        this.handleVictory();
      } else if (endPlayerTurn) {
        this.finishPlayerTurn();
      }
    } catch (err) {
      this.handleError("checkBattleEnd", err);
    }
  }

  private handleVictory(): void {
    if (this.phase === "victory") return;
    const cutsceneSnapshot = captureCutsceneTriggerSnapshot(
      this.player,
      this.defeatedBosses,
    );
    this.phase = "victory";
    this.pendingTargetAction = null;
    this.updateButtonStates();
    this.updateMonsterDisplay();
    this.addLog(`${this.encounter.name} is defeated!`);

    const droppedItems: Item[] = [];
    for (const combatant of this.combatants) {
      for (const drop of combatant.monster.drops ?? []) {
        if (Math.random() >= drop.chance) continue;
        const item = getItem(drop.itemId);
        if (!item) continue;
        droppedItems.push({ ...item });
        combatant.droppedItemIds.push(drop.itemId);
      }
    }

    const rewards = resolveBattleRewards(this.encounter, this.battleHooks);
    const battleResult = this.reportBattleResult(
      "victory",
      rewards,
      this.combatants.flatMap((combatant) => combatant.droppedItemIds),
    );
    const distribution = distributePartyVictory(this.player, battleResult);
    this.addLog(
      `Party gained ${rewards.xp} XP and ${rewards.gold} gold!`,
    );
    for (const combatantId of distribution.penalizedIds) {
      const combatant = getCombatantById(this.partyCombatants, combatantId);
      if (combatant) {
        this.addLog(`${combatant.label} was knocked out and lost current-level XP.`);
      }
    }

    for (const item of droppedItems) {
      this.player.inventory.push(item);
      discoverCraftingRecipes(this.player, {
        type: "item",
        itemId: item.id,
      });
      this.addLog(`🌟 Found: ${item.name}!`);
    }
    for (const combatant of this.combatants) {
      if (combatant.monster.isBoss) {
        this.defeatedBosses.add(combatant.monster.id);
      }
    }
    const questResult = recordMonsterDefeats(
      this.player,
      this.defeatedBosses,
      this.combatants.map((combatant) => combatant.monster.id),
    );
    this.questUpdates = questResult.updates;
    recordGroupDefeats(this.codex, this.combatants);
    const codexUnlocks = replayCodexUnlocks(this.codex, this.player);
    reconcileAchievements({
      player: this.player,
      defeatedBosses: this.defeatedBosses,
      codex: this.codex,
    }, {
      sourceId: this.achievementBattleSourceId,
    });
    queueCutscenes(
      this.player.progression,
      collectNewlyTriggeredCutsceneIds(
        cutsceneSnapshot,
        captureCutsceneTriggerSnapshot(this.player, this.defeatedBosses),
      ),
    );
    saveGame(
      this.player,
      this.defeatedBosses,
      this.codex,
      this.player.appearanceId,
      this.timeStep,
      this.weatherState,
    );
    if (questResult.changed) {
      this.addLog("Quest progress recorded.");
    }
    this.codexDiscovery.show([
      ...codexUnlocks.entries,
      ...this.battleHookCodexEntries,
    ]);
    if (audioEngine.initialized) {
      audioEngine.playVictoryJingle();
    }
    this.battlePresentation.presentVictory(
      this.partyCombatants
        .filter(isCombatantActive)
        .map((combatant) => combatant.id),
    );
    this.updatePlayerStats();
    this.time.delayedCall(2500, () => this.returnToOverworld());
  }

  private reportBattleResult(
    outcome: BattleOutcome,
    rewards: BattleReward = { xp: 0, gold: 0 },
    droppedItemIds: string[] = [],
  ): ReturnType<typeof createBattleResult> {
    const result = createBattleResult(
      outcome,
      this.partyCombatants,
      this.combatants,
      rewards,
      droppedItemIds,
    );
    if (!this.battleResultReported) {
      this.battleResultReported = true;
      recordAchievementEvent(this.player, {
        type: "battleResolved",
        sourceId: this.achievementBattleSourceId,
        outcome,
        oneHitDefeats: this.oneHitDefeatIds.size,
        debug: this.achievementBattleDebug,
      });
      const feedback = this.battleHooks?.onBattleResolved?.(result);
      for (const message of feedback?.messages ?? []) {
        this.addLog(message);
      }
      this.battleHookCodexEntries.push(...(feedback?.codexEntries ?? []));
    }
    return result;
  }

  private handleDefeat(): void {
    if (this.defeatResult) return;
    const result = this.reportBattleResult("defeat");
    this.defeatResult = applyPartyDefeat(
      this.player,
      result.knockedOutPartyIds,
    );
    reconcileAchievements({
      player: this.player,
      defeatedBosses: this.defeatedBosses,
      codex: this.codex,
    }, {
      sourceId: this.achievementBattleSourceId,
    });
    saveGame(
      this.player,
      this.defeatedBosses,
      this.codex,
      this.player.appearanceId,
      this.timeStep,
      this.weatherState,
    );
    this.returnToDefeatResult();
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
    critical: boolean | undefined,
    targetIndex: number = this.selectedTargetIndex,
  ): string {
    if (naturalRoll === undefined || naturalRoll === 20 || naturalRoll === 1) return "";
    const combatant = this.combatants[targetIndex];
    if (!combatant) return "";

    // Track AC discovery
    if (hit) {
      combatant.acLowestHit = Math.min(combatant.acLowestHit, total);
    } else {
      combatant.acHighestMiss = Math.max(combatant.acHighestMiss, total);
    }

    if (
      !combatant.acDiscovered
      && combatant.acLowestHit === combatant.acHighestMiss + 1
    ) {
      combatant.acDiscovered = true;
      // Also update the bestiary immediately
      discoverAC(this.codex, combatant.monster.id);
      this.addLog(`🔍 You deduce ${combatant.label}'s AC is ${combatant.acLowestHit}!`);
    }

    const acSuffix = combatant.acDiscovered
      ? ` vs AC ${combatant.monster.ac}`
      : "";
    return ` (d20: ${naturalRoll} +${mod} = ${total}${acSuffix})`;
  }

  private handleError(context: string, err: unknown): void {
    const msg = err instanceof Error ? err.message : String(err);
    debugLog(`BattleScene.${context}`, err);
    debugPanelLog(`ERROR in ${context}: ${msg}`);
    this.addLog(`⚠ Something went wrong (${context})`);
  }

  private applyDayNightTint(): void {
    applyBattleActorTint(
      this.biome,
      this.timeStep,
      [
        ...this.monsterSprites,
        this.playerSprite,
        ...this.partyCombatants.flatMap((combatant) => {
          if (combatant.actorKind !== "companion") return [];
          const sprite = this.battlePartyRenderer.getSprite(combatant.id);
          return sprite ? [sprite] : [];
        }),
      ],
    );
  }

  private returnToOverworld(): void {
    if (this.isReturningToOverworld) return;
    this.startBattleHandoff(() => {
      const state = createSharedSceneState({
        player: this.player,
        defeatedBosses: this.defeatedBosses,
        codex: this.codex,
        timeStep: this.timeStep,
        weatherState: this.weatherState,
        savedSpecialNpcs: this.savedSpecialNpcs,
        codexDiscoveryIds: this.codexDiscoveryIds,
      });
      const cutsceneId = getNextPendingCutscene(this.player.progression);
      if (cutsceneId === CAMPAIGN_EPILOGUE_CUTSCENE_ID) {
        this.scene.start("EndingScene", {
          ...state,
          cutsceneId,
          replay: false,
          questUpdates: this.questUpdates,
        });
      } else if (cutsceneId) {
        this.scene.start("CutsceneScene", {
          ...state,
          cutsceneId,
          replay: false,
          questUpdates: this.questUpdates,
        });
      } else {
        this.scene.start("OverworldScene", {
          ...state,
          questUpdates: this.questUpdates,
        });
      }
    }, {
      duration: 500,
      label: "battle return",
    });
  }

  private returnToDefeatResult(): void {
    if (!this.defeatResult || this.isReturningToOverworld) return;
    const defeatResult = this.defeatResult;
    this.startBattleHandoff(() => {
      this.scene.start("DefeatScene", {
        ...createSharedSceneState({
          player: this.player,
          defeatedBosses: this.defeatedBosses,
          codex: this.codex,
          timeStep: this.timeStep,
          weatherState: this.weatherState,
          savedSpecialNpcs: this.savedSpecialNpcs,
          codexDiscoveryIds: this.codexDiscoveryIds,
        }),
        encounterName: this.encounter.name,
        encounterType: this.combatants.some(
          (combatant) => combatant.monster.isBoss,
        )
          ? "boss"
          : "random",
        defeatResult,
      });
    }, {
      duration: 500,
      red: 24,
      green: 0,
      blue: 8,
      label: "battle defeat result",
    });
  }

  private startBattleHandoff(
    startScene: () => void,
    options: {
      duration: number;
      red?: number;
      green?: number;
      blue?: number;
      label: string;
    },
  ): void {
    if (this.isReturningToOverworld) return;
    const queued = this.sceneTransitions.startWithFade(startScene, options);
    if (!queued) return;
    this.isReturningToOverworld = true;
    this.cleanupBattleTransientState();
  }

  private cleanupBattleTransientState(): void {
    this.closeAllSubMenus();
    this.pendingTargetAction = null;
    this.battlePartyManager.clear();
    this.battlePartyRenderer.clear();
    this.battlePresentation?.cleanup();
    this.battleBackdrop?.stopDynamicEffects();
    this.input?.keyboard?.removeAllKeys(true, false);
    setDebugCommandHandler(null);
    for (const combatant of this.partyCombatants) {
      clearAllEffects(combatant.effects);
    }
    for (const combatant of this.combatants) {
      clearAllEffects(combatant.effects);
    }
  }

  private registerBattlePresentationActors(): void {
    const heroTexture = this.playerSprite.texture.key;
    this.playerSprite.setData("presentationActorId", this.heroCombatant.id);
    this.battlePresentation.registerActor({
      id: this.heroCombatant.id,
      role: "hero",
      sprite: this.playerSprite,
      textureFamily: createActorTextureFamily({
        id: `hero.${this.player.appearanceId}`,
        role: "hero",
        fallbackTextureKey: heroTexture,
        framePrefix: `player_${this.player.appearanceId}_battle`,
      }),
    });

    for (const [index, combatant] of this.combatants.entries()) {
      const sprite = this.monsterSprites[index];
      if (!sprite) continue;
      sprite.setData("presentationActorId", combatant.id);
      this.battlePresentation.registerActor({
        id: combatant.id,
        role: combatant.monster.isBoss ? "boss" : "monster",
        sprite,
        textureFamily: resolveMonsterTextureFamily(
          combatant.monster,
          (textureKey) => this.textures.exists(textureKey),
        ),
      });
    }

    for (const combatant of this.partyCombatants) {
      if (combatant.actorKind !== "companion") continue;
      const sprite = this.battlePartyRenderer.getSprite(combatant.id);
      if (!sprite) continue;
      sprite.setData("presentationActorId", combatant.id);
      this.battlePresentation.registerActor({
        id: combatant.id,
        role: "companion",
        sprite,
        textureFamily: createActorTextureFamily({
          id: `companion.${combatant.sourceId}`,
          role: "companion",
          fallbackTextureKey: sprite.texture.key,
          framePrefix: `companion_${combatant.sourceId}_battle`,
        }),
      });
    }
  }

  private presentResolvedBattleAction(result: ResolvedBattleAction): void {
    for (const targetResult of result.targets) {
      if (targetResult.hpBefore === undefined) {
        continue;
      }
      const target = this.combatants.find(
        (combatant) => combatant.id === targetResult.targetId,
      );
      if (
        target
        && isOneHitDefeat(
          targetResult.hpBefore,
          target.monster.hp,
          targetResult.damage,
        )
      ) {
        this.oneHitDefeatIds.add(target.id);
      }
    }
    this.battlePresentation.presentAction({
      actorId: result.plan.actorId,
      kind: result.plan.kind,
      successful: result.executed,
      targets: result.targets,
    });
  }

  private applyPartyDamageToEnemy(
    combatantIndex: number,
    damage: number,
  ): void {
    const combatant = this.combatants[combatantIndex];
    if (!combatant) {
      throw new Error(`[BattleScene] Missing combatant ${combatantIndex}`);
    }
    const hpBefore = combatant.currentHp;
    if (isOneHitDefeat(hpBefore, combatant.monster.hp, damage)) {
      this.oneHitDefeatIds.add(combatant.id);
    }
    this.setCombatantHp(combatantIndex, hpBefore - damage);
  }

  private recordElementalDiscovery(
    interaction: ElementalInteraction | undefined,
    element: Element | undefined,
    targetIndex: number = this.selectedTargetIndex,
  ): void {
    if (!interaction || !element) return;
    const combatant = this.combatants[targetIndex];
    if (!combatant) return;
    combatant.elementalDiscoveries.add(element);
    discoverElement(this.codex, combatant.monster.id, element);
  }
}
