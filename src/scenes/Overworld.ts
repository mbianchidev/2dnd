/**
 * Overworld scene: tile-based map with WASD movement and encounters.
 *
 * Delegates rendering, overlays, NPCs, dialogue, and debug commands to
 * extracted subsystems — see systems/ folder.
 */

import * as Phaser from "phaser";
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  ENCOUNTER_RATES,
  Terrain,
  isWalkable,
  getTerrainAt,
  getChunk,
  getDungeonAt,
  getDungeon,
  getDungeonConnectionAt,
  getDungeonLevelMap,
  getDungeonTotalLevels,
  getChestAt,
  getCity,
  getCityForTown,
  getCityChunk,
  getCityChunkMap,
  getCityChunkShopNearby,
  getCityConnectionAt,
  type ChestLocation,
  type CityData,
  type CityShopData,
  type WorldChunk,
} from "../data/map";
import {
  getRandomEncounter,
  getDungeonEncounter,
  getBoss,
  getDungeonBoss,
  getNightEncounter,
  getMonster,
} from "../data/monsters";
import type { Monster } from "../data/monsters";
import {
  createGroupEncounter,
  createRandomEncounter,
  createSoloEncounter,
  getMonsterGroupTemplate,
  type MonsterEncounter,
} from "../data/monsterGroups";
import {
  createPlayer,
  isLightWeapon,
  type PlayerState,
} from "../systems/player";
import {
  createActivePartyCombatants,
  synchronizeCompanionRecruitment,
  type CompanionState,
} from "../systems/party";
import { CompanionFollowerManager } from "../managers/companionFollowers";
import { PartyOverlayManager } from "../managers/partyOverlay";
import { ChronicleManager } from "../managers/chronicle";
import {
  TutorialManager,
  type TutorialNavigationAction,
} from "../managers/tutorial";
import { isDebug, isLocalDev, debugLog, debugPanelLog, debugPanelState, TILE_SIZE } from "../config";
import {
  createCodex,
  replayCodexUnlocks,
  unlockCodexFromSignal,
  type CodexData,
  type CodexUnlockResult,
} from "../systems/codex";
import { saveGame } from "../systems/save";
import { getItem } from "../data/items";
import {
  getAdjacentCodexReadable,
  getCodexKnowledgeEntry,
  type CodexKnowledgeEntry,
} from "../data/codexKnowledge";
import {
  getCityShopSkillCheckId,
  getNpcSkillChallenge,
  getTownShopSkillCheckId,
} from "../data/skillChecks";
import {
  getTimePeriod,
  getEncounterMultiplier,
  isNightTime,
  TimePeriod,
  PERIOD_LABEL,
  CYCLE_LENGTH,
} from "../systems/daynight";
import {
  type WeatherState,
  WeatherType,
  createWeatherState,
  advanceWeather,
  changeZoneWeather,
  getWeatherEncounterMultiplier,
  WEATHER_LABEL,
} from "../systems/weather";
import { audioEngine } from "../systems/audio";
import { getMount } from "../data/mounts";
import type { SavedSpecialNpc } from "../data/npcs";
import { FogOfWar } from "../managers/fogOfWar";
import {
  EncounterSystem,
  getEffectiveEncounterRate,
} from "../managers/encounter";
import { HUDRenderer } from "../renderers/hud";
import {
  tryGridMove,
  useCityConnection,
  useDungeonConnection,
} from "../systems/movement";
import { MapRenderer } from "../renderers/map";
import { CityRenderer } from "../renderers/city";
import { PlayerRenderer } from "../renderers/player";
import { DialogueSystem } from "../managers/dialogue";
import { SpecialNpcManager, type SpecialNpcCallbacks } from "../managers/specialNpc";
import { OverlayManager } from "../managers/overlay";
import { SceneTransitionManager } from "../managers/sceneTransition";
import { WorldPresentationDirector } from "../managers/worldPresentation";
import {
  getMotionDuration,
  installSceneAccessibility,
  isReducedMotionEnabled,
} from "../systems/accessibility";
import { QuestJournalManager } from "../managers/questJournal";
import { QuestFlowManager } from "../managers/questFlow";
import { DebugCommandSystem, type TimeStepRef } from "../systems/debug";
import { findAdjacentNpc, findAdjacentAnimal } from "../managers/npc";
import { DungeonTrapManager } from "../managers/dungeonTraps";
import {
  completeNpcQuestInteraction,
  getBlockedQuestEntrance,
  getNpcQuestInteraction,
  getQuestNpcIdleDialogue,
  isQuestCompleted,
} from "../systems/quests";
import type { QuestUpdate } from "../systems/quests";
import { SkillCheckManager } from "../managers/skillChecks";
import {
  CAMPAIGN_EPILOGUE_CUTSCENE_ID,
  type CutsceneId,
} from "../data/cutscenes";
import {
  captureCutsceneTriggerSnapshot,
  collectNewlyTriggeredCutsceneIds,
  getEventCutsceneIds,
  getNextPendingCutscene,
  queueCutscenes,
  type CutsceneTriggerSnapshot,
} from "../systems/cutscenes";
import { createSharedSceneState } from "../systems/sceneState";
import { CodexDiscoveryManager } from "../managers/codexDiscovery";
import { WorldEventManager } from "../managers/worldEvents";
import { AchievementOverlayManager } from "../managers/achievementOverlay";
import { AchievementNotificationManager } from "../managers/achievementNotifications";
import type { BattleResolutionHooks } from "../systems/groupCombat";
import {
  resolveOverworldStepTrigger,
  type WorldEventContext,
} from "../systems/worldEvents";
import {
  reconcileAchievements,
  suppressCurrentlyMetAchievements,
} from "../systems/achievements";
import { applySocialMutation } from "../systems/reputation";
import { GatheringManager } from "../managers/gathering";
import { tickGatheringCooldowns } from "../systems/gathering";
import { CraftingManager } from "../managers/crafting";
import {
  discoverCraftingRecipes,
  reconcileCraftingRecipes,
} from "../systems/crafting";
import { getCraftingRecipe, type CraftingRecipeId } from "../data/crafting";
import {
  PORTS,
  getPort,
  getSeaZone,
  getSeaZoneAt,
  type CardinalHeading,
} from "../data/nautical";
import {
  canDisembark,
  canEmbark,
  discoverPort,
  discoverSeaTile,
  disembark,
  embark,
  getActiveBoatState,
  prepareSeaEncounter,
  prepareSeaHazard,
  resolvePendingSeaEncounter,
  resolvePendingSeaHazard,
  synchronizeNauticalQuestRewards,
  executeMerchantRoute,
  resolvePendingMerchantRoute,
  installBoatUpgrade,
  purchaseBoat,
  repairActiveBoat,
} from "../systems/nautical";

/** Terrain enum → human-readable display name for the location HUD. */
const TERRAIN_DISPLAY_NAMES: Record<number, string> = {
  [Terrain.Grass]: "Grassland",
  [Terrain.Forest]: "Forest",
  [Terrain.Mountain]: "Mountain",
  [Terrain.Water]: "Water",
  [Terrain.Sand]: "Desert",
  [Terrain.Town]: "Town",
  [Terrain.Dungeon]: "Dungeon",
  [Terrain.Boss]: "Boss Lair",
  [Terrain.Path]: "Road",
  [Terrain.Tundra]: "Tundra",
  [Terrain.Swamp]: "Swamp",
  [Terrain.DeepForest]: "Deep Forest",
  [Terrain.Volcanic]: "Volcanic",
  [Terrain.Canyon]: "Canyon",
  [Terrain.Flower]: "Grassland",
  [Terrain.Cactus]: "Desert",
  [Terrain.Geyser]: "Volcanic",
  [Terrain.Mushroom]: "Swamp",
  [Terrain.River]: "River",
  [Terrain.Mill]: "Grassland",
  [Terrain.CropField]: "Grassland",
  [Terrain.Casino]: "Town",
  [Terrain.House]: "Town",
  [Terrain.DungeonStairs]: "Stairs",
  [Terrain.DungeonBoss]: "Boss Chamber",
};

/** Terrain enum → short debug label for the debug panel. */
const TERRAIN_DEBUG_NAMES: Record<number, string> = {
  [Terrain.Grass]: "Grass",
  [Terrain.Forest]: "Forest",
  [Terrain.Mountain]: "Mountain",
  [Terrain.Water]: "Water",
  [Terrain.Sand]: "Sand",
  [Terrain.Town]: "Town",
  [Terrain.Dungeon]: "Dungeon",
  [Terrain.Boss]: "Boss",
  [Terrain.Path]: "Path",
  [Terrain.DungeonFloor]: "DFloor",
  [Terrain.DungeonWall]: "DWall",
  [Terrain.DungeonExit]: "DExit",
  [Terrain.DungeonStairs]: "DStairs",
  [Terrain.DungeonBoss]: "DBoss",
  [Terrain.Chest]: "Chest",
  [Terrain.Tundra]: "Tundra",
  [Terrain.Swamp]: "Swamp",
  [Terrain.DeepForest]: "DForest",
  [Terrain.Volcanic]: "Volcanic",
  [Terrain.Canyon]: "Canyon",
};

export interface OverworldSceneData {
  player?: PlayerState;
  defeatedBosses?: Set<string>;
  codex?: CodexData;
  timeStep?: number;
  weatherState?: WeatherState;
  savedSpecialNpcs?: SavedSpecialNpc[];
  questUpdates?: QuestUpdate[];
  codexDiscoveryIds?: string[];
}

export class OverworldScene extends Phaser.Scene {
  private readonly sceneTransitions = new SceneTransitionManager(this);
  private player!: PlayerState;
  private keys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    SPACE: Phaser.Input.Keyboard.Key;
  };
  private isMoving = false;
  private moveDelay = 150;
  private lastMoveTime = 0;
  private hudText!: Phaser.GameObjects.Text;
  private locationText!: Phaser.GameObjects.Text;
  private pendingHudMessage: {
    text: string;
    color: string;
    duration: number;
  } | null = null;
  private lastLocationStr = "";
  private defeatedBosses: Set<string> = new Set();
  private codex: CodexData = createCodex();
  private timeStep = 0;
  private weatherState: WeatherState = createWeatherState();

  // ── Extracted subsystems ──
  private fogOfWar!: FogOfWar;
  private encounterSystem!: EncounterSystem;
  private hudRenderer!: HUDRenderer;
  private mapRenderer!: MapRenderer;
  private cityRenderer!: CityRenderer;
  private playerRenderer!: PlayerRenderer;
  private dialogueSystem!: DialogueSystem;
  private specialNpcManager!: SpecialNpcManager;
  private overlayManager!: OverlayManager;
  private questJournal!: QuestJournalManager;
  private questFlow!: QuestFlowManager;
  private debugCommandSystem!: DebugCommandSystem;
  private dungeonTrapManager!: DungeonTrapManager;
  private skillCheckManager!: SkillCheckManager;
  private companionFollowerManager!: CompanionFollowerManager;
  private worldPresentation!: WorldPresentationDirector;
  private partyOverlayManager!: PartyOverlayManager;
  private chronicleManager!: ChronicleManager;
  private tutorialManager!: TutorialManager;
  private codexDiscovery!: CodexDiscoveryManager;
  private worldEventManager!: WorldEventManager;
  private achievementOverlayManager!: AchievementOverlayManager;
  private achievementNotifications!: AchievementNotificationManager;
  private gatheringManager!: GatheringManager;
  private craftingManager!: CraftingManager;
  private pendingCodexDiscoveryIds: string[] = [];

  constructor() {
    super({ key: "OverworldScene" });
  }

  init(data?: OverworldSceneData): void {
    const fogDisabled = this.fogOfWar?.isFogDisabled() ?? false;
    const encountersEnabled = this.encounterSystem?.areEncountersEnabled() ?? true;

    // Instantiate subsystems
    this.fogOfWar = new FogOfWar();
    this.fogOfWar.setFogDisabled(fogDisabled);
    this.encounterSystem = new EncounterSystem();
    this.encounterSystem.setEncountersEnabled(encountersEnabled);
    this.hudRenderer = new HUDRenderer(this);
    this.mapRenderer = new MapRenderer(this);
    this.cityRenderer = new CityRenderer(this);
    this.playerRenderer = new PlayerRenderer(this);
    this.worldPresentation = new WorldPresentationDirector(this);
    this.companionFollowerManager = new CompanionFollowerManager(
      this,
      this.worldPresentation,
    );
    this.dialogueSystem = new DialogueSystem(this);
    this.specialNpcManager = new SpecialNpcManager(this);
    this.questJournal = new QuestJournalManager(
      this,
      (message, color) => this.showMessage(message, color),
    );
    this.dungeonTrapManager = new DungeonTrapManager(this, {
      showMessage: (text, color) => this.showMessage(text, color),
      autoSave: () => this.autoSave(),
      updateHUD: () => this.updateHUD(),
      setMovementLocked: (locked) => { this.isMoving = locked; },
      startAlarmEncounter: () => {
        const monster = getDungeonEncounter(
          this.player.level,
          this.player.position.dungeonId,
        );
        this.startBattle(monster, Terrain.DungeonFloor, true);
      },
      restartDungeon: () => {
        this.revealAround();
        this.autoSave();
        this.restartOverworld("refresh dungeon traps");
      },
    });
    this.skillCheckManager = new SkillCheckManager({
      showMessage: (text, color) => this.showMessage(text, color),
      updateHUD: () => this.updateHUD(),
      autoSave: () => this.autoSave(),
      revealAround: (radius) => this.revealAround(radius),
      revealTileSprites: () => this.revealTileSprites(),
    });
    this.worldEventManager = new WorldEventManager(this, {
      autoSave: () => this.autoSave(),
      updateHUD: () => this.updateHUD(),
      showMessage: (message, color) => this.showMessage(message, color),
      handleQuestUpdates: (updates) => {
        if (updates.length > 0) {
          this.questFlow.handleResult({
            changed: true,
            updates: [...updates],
          });
        }
      },
      showCodexUnlocks: (result) => this.showCodexUnlocks(result),
      handleSocialEffects: (effects) => {
        for (const effect of effects) {
          if (effect.changed) {
            this.showMessage(`Social: ${effect.summary}`, "#80cbc4");
          }
        }
      },
      startBattle: (encounter, terrain, hooks, immediate) =>
        this.startBattle(encounter, terrain, immediate, hooks),
    });
    this.craftingManager = new CraftingManager(this, {
      autoSave: () => this.autoSave(),
      updateHUD: () => this.updateHUD(),
      showMessage: (message, color) => this.showMessage(message, color),
      refreshActors: () => this.refreshPartyActors(),
      reconcileAchievements: () => {
        reconcileAchievements({
          player: this.player,
          defeatedBosses: this.defeatedBosses,
          codex: this.codex,
        }, { sourceId: "crafting:transaction" });
      },
    });
    this.gatheringManager = new GatheringManager(this, {
      autoSave: () => this.autoSave(),
      updateHUD: () => this.updateHUD(),
      updateLocation: () => this.updateLocationText(),
      showMessage: (message, color) => this.showMessage(message, color),
      showCodexUnlocks: (result) => this.showCodexUnlocks(result),
      showCraftingUnlocks: (recipeIds) =>
        this.showCraftingUnlocks(recipeIds),
      suppressDebugAchievements: () => suppressCurrentlyMetAchievements({
        player: this.player,
        defeatedBosses: this.defeatedBosses,
        codex: this.codex,
      }),
      startBattle: (encounter, terrain, hooks, immediate) =>
        this.startBattle(encounter, terrain, immediate, hooks),
    });
    this.tutorialManager = new TutorialManager(this, {
      autoSave: () => this.autoSave(),
    });
    this.overlayManager = new OverlayManager(this, {
      updateHUD: () => this.updateHUD(),
      autoSave: () => this.autoSave(),
      showMessage: (text: string, color?: string) => this.showMessage(text, color),
      renderMap: () => this.renderMap(),
      applyDayNightTint: () => this.applyDayNightTint(),
      createPlayer: () => this.createPlayerSprite(),
      refreshPlayerSprite: () => this.playerRenderer.refreshPlayerSprite(this.player),
      respawnCityNpcs: () => {
        this.cityRenderer.respawnCityNpcs(
          this.player,
          this.timeStep,
          (x: number, y: number) =>
            this.fogOfWar.isExplored(x, y, this.player),
        );
        this.questFlow?.refreshMarkers();
      },
      saveAndQuit: () => {
        this.autoSave();
        this.sceneTransitions.startImmediately(
          () => this.scene.start("BootScene"),
          "save and quit",
        );
      },
      getTimeStep: () => this.timeStep,
      setTimeStep: (t: number) => { this.timeStep = t; },
      evacuateDungeon: () => this.evacuateDungeon(),
      getHUDInfo: () => this.getHUDInfo(),
      openPartyInventory: () => this.partyOverlayManager.openInventory(this.player),
      openQuestJournal: () => this.openQuestJournal(),
      openChronicle: () => this.chronicleManager.open(this.player),
      openCodex: () => this.openCodex(),
      openAchievements: () => this.openAchievements(),
      openGathering: () => this.openGatheringStatus(),
      openCrafting: () => this.openCrafting(),
      openTips: () => this.tutorialManager.showTips(this.player),
      fadeOutAndIn: (atBlack, duration) =>
        this.sceneTransitions.fadeOutAndIn(atBlack, {
          duration,
          label: "inn rest",
        }),
      travelMerchantRoute: (routeId, currentPortId) =>
        this.travelMerchantRoute(routeId, currentPortId),
    });
    this.partyOverlayManager = new PartyOverlayManager(this, {
      updateHUD: () => this.updateHUD(),
      autoSave: () => this.autoSave(),
      showMessage: (text, color) => this.showMessage(text, color),
      refreshActors: () => {
        this.refreshPartyActors();
      },
      openCrafting: () => this.openCrafting(),
    });

    // Load scene data
    if (data?.player) {
      this.player = data.player;
      this.fogOfWar.setExploredTiles(this.player.progression.exploredTiles);
    } else {
      this.player = createPlayer("Hero", {
        strength: 10, dexterity: 10, constitution: 10,
        intelligence: 10, wisdom: 10, charisma: 10,
      });
    }
    this.defeatedBosses = data?.defeatedBosses ?? new Set();
    this.codex = data?.codex ?? createCodex();
    if (this.defeatedBosses.has("kraken")) {
      applySocialMutation(this.player, {
        sourceId: "boss:kraken:harborSafety",
        cause: "Defeated the Deepwake Kraken",
        alignment: { goodEvil: 5 },
        reputation: [
          { kind: "town", targetId: "tidehaven_city", delta: 30 },
          { kind: "faction", targetId: "roadwardens", delta: 15 },
        ],
      }, this.codex);
    }
    replayCodexUnlocks(this.codex, this.player);
    reconcileCraftingRecipes(this.player, this.codex);
    this.achievementOverlayManager = new AchievementOverlayManager(this, {
      autoSave: () => this.autoSave(),
      showMessage: (message, color) => this.showMessage(message, color),
    });
    this.achievementNotifications = new AchievementNotificationManager(
      this,
      this.player,
      () => this.autoSave(),
    );
    this.pendingCodexDiscoveryIds = data?.codexDiscoveryIds ?? [];
    this.timeStep = data?.timeStep ?? 0;
    this.weatherState = data?.weatherState ?? createWeatherState();
    if (data?.savedSpecialNpcs) {
      this.specialNpcManager.savedSpecialNpcs = data.savedSpecialNpcs;
    }
    this.questFlow = new QuestFlowManager(
      this.player,
      this.defeatedBosses,
      this.questJournal,
      this.cityRenderer,
      {
        renderMap: () => this.renderMap(),
        showMessage: (message, color) => this.showMessage(message, color),
        autoSave: () => this.autoSave(),
      },
      data?.questUpdates,
    );
    this.codexDiscovery = new CodexDiscoveryManager(this);
    synchronizeCompanionRecruitment(this.player);

    // Reset movement state — a tween may have been orphaned when the scene
    // switched to battle mid-move, leaving isMoving permanently true.
    this.isMoving = false;
    this.lastMoveTime = 0;
    this.pendingHudMessage = null;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x111111);
    this.sceneTransitions.prepare(500);
    installSceneAccessibility(this);

    // Dungeons are enclosed — always force clear weather
    if (this.player.position.inDungeon) {
      this.weatherState.current = WeatherType.Clear;
    }

    // Reveal tiles around player on creation (fog of war)
    this.fogOfWar.revealAround(this.player.position.x, this.player.position.y, 2, this.player);

    // Special NPC generation during map rendering may publish a HUD message.
    this.createHUD();
    this.renderMap();
    this.applyDayNightTint();
    this.createPlayerSprite();
    this.refreshPartyActors();
    this.setupInput();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.companionFollowerManager.clear();
      this.worldPresentation.cleanup();
      this.codexDiscovery.clear();
      this.achievementOverlayManager.close();
      this.achievementNotifications.clear();
      this.worldEventManager.clear();
      this.gatheringManager.clear();
      this.craftingManager.clear();
    });
    this.chronicleManager = new ChronicleManager(
      this,
      (cutsceneId) => this.startCutscene(cutsceneId, true),
    );
    this.setupDebug();
    this.updateLocationText();
    this.mapRenderer.updateWeatherParticles(this.weatherState);
    this.updateAudio();
    this.questFlow.afterInitialRender();
    if (this.startNextPendingCutscene()) {
      return;
    }
    if (this.resumePendingNautical()) {
      return;
    }
    if (this.gatheringManager.resumePending(
      this.player,
      this.codex,
      this.timeStep,
      this.weatherState.current,
    )) {
      return;
    }
    if (this.worldEventManager.resumePending(
      this.player,
      this.codex,
      this.defeatedBosses,
    )) {
      return;
    }
    if (this.pendingCodexDiscoveryIds.length > 0) {
      this.codexDiscovery.show(
        this.pendingCodexDiscoveryIds
          .map(getCodexKnowledgeEntry)
          .filter((entry): entry is CodexKnowledgeEntry => entry !== undefined),
      );
      this.pendingCodexDiscoveryIds = [];
    }
    this.discoverCurrentPort();
    if (this.player.position.inDungeon) {
      this.time.delayedCall(150, () => {
        this.dungeonTrapManager.scanNearby(this.player);
        this.updateLocationText();
      });
    }

    if (!this.player.progression.tutorial.completed) {
      this.time.delayedCall(150, () => {
        this.tutorialManager.showTutorial(this.player);
      });
    } else if (this.player.pendingStatPoints > 0) {
      this.time.delayedCall(400, () => this.overlayManager.showStatOverlay(this.player));
    }
  }

  private getSharedState(): ReturnType<typeof createSharedSceneState> {
    return createSharedSceneState({
      player: this.player,
      defeatedBosses: this.defeatedBosses,
      codex: this.codex,
      timeStep: this.timeStep,
      weatherState: this.weatherState,
      savedSpecialNpcs: this.specialNpcManager.snapshotSpecialNpcs(),
      codexDiscoveryIds: this.pendingCodexDiscoveryIds,
    });
  }

  private getRestartData(codexDiscoveryIds: readonly string[] = []): OverworldSceneData {
    return {
      ...this.getSharedState(),
      codexDiscoveryIds: [...codexDiscoveryIds],
    };
  }

  private restartOverworld(
    label: string,
    codexDiscoveryIds: readonly string[] = [],
  ): void {
    this.sceneTransitions.startImmediately(
      () => this.scene.restart(this.getRestartData(codexDiscoveryIds)),
      label,
    );
  }

  private showCodexUnlocks(
    ...results: readonly CodexUnlockResult[]
  ): void {
    const entries = results.flatMap((result) => result.entries);
    this.codexDiscovery.show(entries);
  }

  private showCraftingUnlocks(recipeIds: readonly CraftingRecipeId[]): void {
    if (recipeIds.length === 0) return;
    const names = recipeIds.map((recipeId) => getCraftingRecipe(recipeId).name);
    this.showMessage(`Recipe discovered: ${names.join(", ")}.`, "#f7c948");
  }

  private startCutscene(cutsceneId: CutsceneId, replay = false): boolean {
    if (this.sceneTransitions.isPending) return false;
    this.dialogueSystem.dismissDialogue();
    this.tutorialManager.close();
    this.overlayManager.destroyAll();
    this.partyOverlayManager.close();
    this.craftingManager?.close();
    this.questJournal.close();
    this.chronicleManager?.close();
    this.autoSave();
    const persistentState = this.getSharedState();
    return this.sceneTransitions.startWithFade(() => {
      const sceneKey = cutsceneId === CAMPAIGN_EPILOGUE_CUTSCENE_ID
        ? "EndingScene"
        : "CutsceneScene";
      this.scene.start(sceneKey, {
        ...persistentState,
        cutsceneId,
        replay,
      });
    }, {
      duration: 500,
      label: `${replay ? "replay" : "play"} cutscene ${cutsceneId}`,
    });
  }

  private startNextPendingCutscene(): boolean {
    const cutsceneId = getNextPendingCutscene(this.player.progression);
    return cutsceneId ? this.startCutscene(cutsceneId) : false;
  }

  private queueNewlyTriggeredCutscenes(
    before: CutsceneTriggerSnapshot,
  ): CutsceneId[] {
    const after = captureCutsceneTriggerSnapshot(
      this.player,
      this.defeatedBosses,
    );
    const queued = queueCutscenes(
      this.player.progression,
      collectNewlyTriggeredCutsceneIds(before, after),
    );
    if (queued.length > 0) {
      this.autoSave();
    }
    return queued;
  }

  // ── Debug ───────────────────────────────────────────────────────────────

  private setupDebug(): void {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const scene = this;
    const ref: TimeStepRef = {
      get value(): number { return scene.timeStep; },
      set value(v: number) { scene.timeStep = v; },
    };

    this.debugCommandSystem = new DebugCommandSystem(this, this.player, {
      updateHUD: () => this.updateHUD(),
      showStatOverlay: () => this.overlayManager.showStatOverlay(this.player),
      renderMap: () => this.renderMap(),
      applyDayNightTint: () => this.applyDayNightTint(),
      createPlayer: () => this.createPlayerSprite(),
      refreshWorldMap: () => this.overlayManager.refreshWorldMap(this.player, this.defeatedBosses),
      updateWeatherParticles: () => this.mapRenderer.updateWeatherParticles(this.weatherState),
      updateAudio: () => this.updateAudio(),
      startBattle: (monster, biomeOverride) =>
        this.startBattle(monster, undefined, false, undefined, biomeOverride),
      spawnSpecialNpcs: (chunk) => this.spawnSpecialNpcs(chunk),
      autoSave: () => this.autoSave(),
      restartScene: () => this.restartOverworld("debug scene refresh"),
      refreshQuestUI: () => this.questFlow.refreshUi(),
      refreshPartyActors: () => this.refreshPartyActors(),
      isInputBlocked: () => this.isOverlayOpen(),
      listWorldEvents: () => this.worldEventManager.list(),
      triggerWorldEvent: (eventId) => {
        const terrain = getTerrainAt(
          this.player.position.chunkX,
          this.player.position.chunkY,
          this.player.position.x,
          this.player.position.y,
        );
        if (terrain === undefined || this.player.position.inCity || this.player.position.inDungeon) {
          return "World events can only be triggered on an overworld tile.";
        }
        this.worldEventManager.force(
          this.player,
          this.codex,
          this.defeatedBosses,
          eventId,
          this.getWorldEventContext(terrain),
          true,
        );
        return `Triggered ${eventId}.`;
      },
      resetWorldEvents: () => {
        this.worldEventManager.reset(this.player);
        return "World event state reset.";
      },
      listGatheringNodes: () => this.gatheringManager.listNodes(this.player),
      triggerGathering: (discipline) => this.gatheringManager.trigger(
        this.player,
        this.codex,
        discipline,
        this.timeStep,
        this.weatherState.current,
        isReducedMotionEnabled(),
      ),
      nearGathering: (discipline) => {
        const result = this.gatheringManager.near(this.player, discipline);
        if (result.startsWith("Moved near")) {
          this.restartOverworld("debug near gathering");
        }
        return result;
      },
      resolveGathering: (success) => this.gatheringManager.resolveDebug(success),
      resetGathering: () => {
        this.gatheringManager.reset(this.player);
        return "Gathering state reset.";
      },
      gatheringStatus: () => this.gatheringManager.status(this.player),
    });
    this.debugCommandSystem.fogOfWar = this.fogOfWar;
    this.debugCommandSystem.encounterSystem = this.encounterSystem;
    this.debugCommandSystem.pendingSpecialSpawns = this.specialNpcManager.pendingSpecialSpawns;
    this.debugCommandSystem.weatherState = this.weatherState;
    this.debugCommandSystem.timeStepRef = ref;
    this.debugCommandSystem.codex = this.codex;
    this.debugCommandSystem.defeatedBosses = this.defeatedBosses;
    this.debugCommandSystem.setup();
  }

  // ── Input ───────────────────────────────────────────────────────────────

  private setupInput(): void {
    this.keys = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      SPACE: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
    };

    const cKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.C);
    cKey.on("down", () => {
      if (this.tutorialManager.isOpen()) return;
      if (this.chronicleManager?.isOpen()) {
        this.chronicleManager.close();
        return;
      }
      if (this.isMoving) return;
      if (this.questJournal.isOpen()) return;
      if (this.partyOverlayManager.isOpen()) return;
      if (this.achievementOverlayManager.isOpen()) return;
      this.openCodex();
    });

    const yKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Y);
    yKey.on("down", () => {
      if (this.achievementOverlayManager.isOpen()) {
        this.achievementOverlayManager.close();
        return;
      }
      if (
        this.isMoving
        || this.tutorialManager.isOpen()
        || this.chronicleManager?.isOpen()
        || this.questJournal.isOpen()
        || this.partyOverlayManager.isOpen()
        || this.overlayManager.isOpen()
      ) {
        return;
      }
      this.openAchievements();
    });

    const eKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    eKey.on("down", () => {
      if (this.tutorialManager.isOpen()) return;
      if (this.chronicleManager?.isOpen()) return;
      if (this.isMoving) return;
      if (this.questJournal.isOpen()) return;
      if (this.partyOverlayManager.isOpen()) return;
      if (this.achievementOverlayManager.isOpen()) return;
      this.overlayManager.toggleEquipOverlay(this.player);
    });

    const pKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    pKey.on("down", () => {
      if (this.tutorialManager.isOpen()) return;
      if (this.partyOverlayManager.isInventorySearchActive()) return;
      if (this.chronicleManager?.isOpen()) return;
      if (this.isMoving) return;
      if (this.questJournal.isOpen() || this.overlayManager.isOpen()) return;
      if (this.achievementOverlayManager.isOpen()) return;
      this.partyOverlayManager.toggle(this.player);
    });

    const mKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    mKey.on("down", () => {
      if (this.tutorialManager.isOpen()) return;
      if (this.chronicleManager?.isOpen()) return;
      if (this.isMoving) return;
      if (this.questJournal.isOpen()) return;
      if (this.partyOverlayManager.isOpen()) return;
      if (this.achievementOverlayManager.isOpen()) return;
      if (this.player.position.inCity) {
        this.overlayManager.toggleCityMap(this.player);
      } else {
        this.overlayManager.toggleWorldMap(this.player, this.defeatedBosses);
      }
    });

    const escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    escKey.on("down", () => {
      if (this.isMoving) return;
      if (this.tutorialManager.isOpen()) {
        this.tutorialManager.close();
        return;
      }
      // ESC closes the topmost open overlay, or opens the menu
      if (this.chronicleManager?.isOpen()) {
        this.chronicleManager.close();
      } else if (this.achievementOverlayManager.isOpen()) {
        this.achievementOverlayManager.close();
      } else if (this.craftingManager.isOpen()) {
        this.craftingManager.close();
      } else if (this.partyOverlayManager.isOpen()) {
        this.partyOverlayManager.close();
      } else if (this.questJournal.isOpen()) {
        this.questJournal.close();
      } else if (this.overlayManager.settingsOverlay) {
        this.overlayManager.toggleSettingsOverlay();
      } else if (this.overlayManager.cityMapOverlay) {
        this.overlayManager.dismissCityMap();
      } else if (this.overlayManager.worldMapOverlay) {
        this.overlayManager.toggleWorldMap(this.player, this.defeatedBosses);
      } else if (this.overlayManager.equipOverlay) {
        this.overlayManager.toggleEquipOverlay(this.player);
      } else if (this.overlayManager.bankOverlay) {
        this.overlayManager.dismissBankOverlay();
      } else if (this.overlayManager.innConfirmOverlay) {
        this.overlayManager.dismissInnConfirmation();
      } else if (this.overlayManager.townPickerOverlay) {
        this.overlayManager.dismissTownPicker();
      } else if (this.overlayManager.statOverlay) {
        // Stat overlay stays open (must allocate points)
      } else if (this.overlayManager.menuOverlay) {
        this.overlayManager.toggleMenuOverlay(this.player, this.defeatedBosses, this.codex);
      } else {
        this.overlayManager.toggleMenuOverlay(this.player, this.defeatedBosses, this.codex);
      }
    });

    const qKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    qKey.on("down", () => {
      if (this.tutorialManager.isOpen()) return;
      if (this.chronicleManager?.isOpen()) return;
      if (this.isMoving) return;
      if (
        this.overlayManager.isOpen()
        || this.partyOverlayManager.isOpen()
        || this.achievementOverlayManager.isOpen()
      ) return;
      this.openQuestJournal();
    });

    const tKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.T);
    tKey.on("down", () => {
      if (this.tutorialManager.isOpen()) return;
      if (this.chronicleManager?.isOpen()) return;
      if (this.isMoving) return;
      if (this.questJournal.isOpen()) return;
      if (this.partyOverlayManager.isOpen()) return;
      if (this.achievementOverlayManager.isOpen()) return;
      this.toggleMount();
    });

    const tipsKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F1);
    tipsKey.on("down", () => {
      if (this.isMoving) return;
      if (this.tutorialManager.isOpen()) {
        this.tutorialManager.close();
        return;
      }
      if (this.isOverlayOpen() || this.dialogueSystem.isDialogueOpen()) return;
      this.tutorialManager.showTips(this.player);
    });

    const gatheringKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.K);
    gatheringKey.on("down", () => {
      if (
        this.isMoving
        || this.isOverlayOpen()
        || this.dialogueSystem.isDialogueOpen()
      ) return;
      this.openGatheringStatus();
    });

    const craftingKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.V);
    craftingKey.on("down", () => {
      if (
        this.isMoving
        || this.isOverlayOpen()
        || this.dialogueSystem.isDialogueOpen()
        || this.sceneTransitions.isPending
      ) return;
      this.openCrafting();
    });

    const tutorialKeys: Array<{
      code: number;
      action: TutorialNavigationAction;
    }> = [
      { code: Phaser.Input.Keyboard.KeyCodes.LEFT, action: "previous" },
      { code: Phaser.Input.Keyboard.KeyCodes.A, action: "previous" },
      { code: Phaser.Input.Keyboard.KeyCodes.RIGHT, action: "next" },
      { code: Phaser.Input.Keyboard.KeyCodes.D, action: "next" },
      { code: Phaser.Input.Keyboard.KeyCodes.UP, action: "up" },
      { code: Phaser.Input.Keyboard.KeyCodes.W, action: "up" },
      { code: Phaser.Input.Keyboard.KeyCodes.DOWN, action: "down" },
      { code: Phaser.Input.Keyboard.KeyCodes.S, action: "down" },
      { code: Phaser.Input.Keyboard.KeyCodes.ENTER, action: "confirm" },
    ];
    for (const binding of tutorialKeys) {
      this.input.keyboard!.addKey(binding.code).on("down", () => {
        if (this.tutorialManager.isOpen()) {
          this.tutorialManager.handleAction(binding.action);
        }
      });
    }
  }

  // ── HUD ─────────────────────────────────────────────────────────────────

  private createHUD(): void {
    const hudBg = this.add.graphics();
    hudBg.fillStyle(0x1a1a2e, 0.85);
    hudBg.fillRect(0, MAP_HEIGHT * TILE_SIZE, MAP_WIDTH * TILE_SIZE, 48);
    hudBg.lineStyle(2, 0xc0a060, 1);
    hudBg.strokeRect(0, MAP_HEIGHT * TILE_SIZE, MAP_WIDTH * TILE_SIZE, 48);
    hudBg.setDepth(20);
    hudBg.setAlpha(0); // hidden by default

    this.hudText = this.add
      .text(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE + 8, "", {
        fontSize: "13px",
        fontFamily: "monospace",
        color: "#ddd",
        lineSpacing: 4,
        align: "center",
        wordWrap: { width: MAP_WIDTH * TILE_SIZE - 20 },
      })
      .setOrigin(0.5, 0)
      .setDepth(21)
      .setAlpha(0);

    // Store hudBg ref for fade
    this.hudBg = hudBg;

    // Location text is now part of the HUD message bar
    this.locationText = this.add
      .text(MAP_WIDTH * TILE_SIZE - 10, MAP_HEIGHT * TILE_SIZE + 6, "", {
        fontSize: "11px",
        fontFamily: "monospace",
        color: "#aaa",
        align: "right",
        lineSpacing: 2,
      })
      .setOrigin(1, 0)
      .setDepth(21)
      .setAlpha(0);
    const pending = this.pendingHudMessage;
    this.pendingHudMessage = null;
    if (pending) {
      this.showHUDMessage(pending.text, pending.color, pending.duration);
    }
  }

  private hudBg!: Phaser.GameObjects.Graphics;
  private hudFadeTimer?: Phaser.Time.TimerEvent;

  /** Show a message in the HUD bar (auto-fades after delay). */
  private showHUDMessage(text: string, color = "#ddd", duration = 3000): void {
    if (!this.hudText?.active || !this.hudBg?.active) {
      this.pendingHudMessage = { text, color, duration };
      return;
    }
    this.hudText.setText(text);
    this.hudText.setColor(color);
    this.hudBg.setAlpha(1);
    this.hudText.setAlpha(1);

    // Cancel previous fade
    if (this.hudFadeTimer) this.hudFadeTimer.remove();
    this.tweens.killTweensOf(this.hudBg);
    this.tweens.killTweensOf(this.hudText);

    this.hudFadeTimer = this.time.delayedCall(duration, () => {
      const fadeDuration = getMotionDuration(800);
      if (fadeDuration === 0) {
        this.hudBg.setAlpha(0);
        this.hudText.setAlpha(0);
        return;
      }
      this.tweens.add({
        targets: [this.hudBg, this.hudText],
        alpha: 0,
        duration: fadeDuration,
      });
    });
  }

  /**
   * Show location info in the HUD bar only when it's actionable
   * (e.g. [SPACE] prompts, entering a new zone). Plain terrain is suppressed.
   */
  private showLocationInfo(): void {
    const text = this.getLocationString();
    if (!text) return;

    // Only show the HUD bar for actionable prompts (e.g. [SPACE] Enter/Open/Exit)
    const isActionable = text.includes("[SPACE]");
    if (!isActionable) return;
    if (text === this.lastLocationStr) return;
    this.lastLocationStr = text;

    // Show the right location text
    this.locationText.setText(text);
    this.locationText.setAlpha(1);
    this.hudBg.setAlpha(1);

    // Cancel previous fade
    if (this.hudFadeTimer) this.hudFadeTimer.remove();
    this.tweens.killTweensOf(this.hudBg);
    this.tweens.killTweensOf(this.hudText);
    this.tweens.killTweensOf(this.locationText);

    this.hudFadeTimer = this.time.delayedCall(3000, () => {
      const fadeDuration = getMotionDuration(800);
      if (fadeDuration === 0) {
        this.hudBg.setAlpha(0);
        this.hudText.setAlpha(0);
        this.locationText.setAlpha(0);
        return;
      }
      this.tweens.add({
        targets: [this.hudBg, this.hudText, this.locationText],
        alpha: 0,
        duration: fadeDuration,
      });
    });
  }

  /** Build the HUD info text for the current position — kept for menu. */
  getHUDInfo(): string {
    const p = this.player;
    let regionName: string;
    if (p.position.inDungeon) {
      const dungeon = getDungeon(p.position.dungeonId);
      regionName = dungeon ? `🔻 ${dungeon.name}` : "Dungeon";
    } else if (p.position.inCity) {
      const city = getCity(p.position.cityId);
      const chunk = city ? getCityChunk(city, p.position.cityChunkIndex) : undefined;
      regionName = city && chunk ? `🏘 ${city.name}: ${chunk.name}` : "City";
    } else {
      const chunk = getChunk(p.position.chunkX, p.position.chunkY);
      const sea = p.progression.nautical.sailing
        ? getSeaZoneAt(
          p.position.chunkX,
          p.position.chunkY,
          p.position.x,
          p.position.y,
        )
        : undefined;
      regionName = sea
        ? `⛵ ${getSeaZoneAt(
          p.position.chunkX,
          p.position.chunkY,
          p.position.x,
          p.position.y,
        )?.zoneId ?? "Sea"} (${sea.depth})`
        : chunk?.name ?? "Unknown";
    }
    const timeLabel = p.position.inDungeon ? PERIOD_LABEL[TimePeriod.Dungeon] : PERIOD_LABEL[getTimePeriod(this.timeStep)];
    const weatherLabel = WEATHER_LABEL[this.weatherState.current];
    const mountLabel = (p.mountId && !p.position.inDungeon && !p.position.inCity)
      ? `  🐴 ${getMount(p.mountId)?.name ?? "Mount"}` : "";
    const boat = getActiveBoatState(p.progression.nautical);
    const boatLabel = p.progression.nautical.sailing && boat
      ? `  ⛵ ${boat.id} ${boat.condition}%`
      : "";
    return `${regionName}  ${timeLabel}  ${weatherLabel}${mountLabel}${boatLabel}`;
  }

  private updateHUD(): void {
    // HUD is now event-driven — no persistent display
  }

  private updateLocationText(): void {
    this.showLocationInfo();
  }

  private getLocationString(): string {
    if (this.player.position.inDungeon) {
      const dungeon = getDungeon(this.player.position.dungeonId);
      if (!dungeon) return "???";
      const trapPrompt = this.dungeonTrapManager.getActionPrompt(this.player);
      if (trapPrompt) return trapPrompt;
      const levelMap = getDungeonLevelMap(dungeon, this.player.position.dungeonLevel);
      const terrain = levelMap[this.player.position.y]?.[this.player.position.x];
      const levelLabel = getDungeonTotalLevels(dungeon) > 1 ? ` (Level ${this.player.position.dungeonLevel + 1})` : "";
      if (terrain === Terrain.DungeonExit) return `${dungeon.name}${levelLabel}  [SPACE] Exit`;
      if (terrain === Terrain.DungeonStairs) {
        const connection = getDungeonConnectionAt(
          dungeon,
          this.player.position.dungeonLevel,
          this.player.position.x,
          this.player.position.y,
        );
        const action = connection && connection.toLevel < connection.fromLevel
          ? "Ascend"
          : "Descend";
        return `${dungeon.name}${levelLabel}  [SPACE] ${action}`;
      }
      if (terrain === Terrain.DungeonBoss) {
        const boss = getDungeonBoss(dungeon.id);
        if (boss && !this.defeatedBosses.has(boss.id)) return `${boss.name}'s Lair  [SPACE] Challenge`;
        return `${dungeon.name}${levelLabel}`;
      }
      if (terrain === Terrain.Chest) {
        const chest = getChestAt(this.player.position.x, this.player.position.y, {
          type: "dungeon",
          dungeonId: this.player.position.dungeonId,
          dungeonLevel: this.player.position.dungeonLevel,
        });
        if (chest && !this.player.progression.openedChests.includes(chest.id)) {
          return chest.lockDc
            ? "Locked Chest  [SPACE] Pick Lock"
            : "Treasure Chest  [SPACE] Open";
        }
        return "Opened Chest";
      }
      const gatheringPrompt = this.gatheringManager.getPrompt(this.player);
      if (gatheringPrompt) return `${dungeon.name}${levelLabel}  ${gatheringPrompt}`;
      return `${dungeon.name}${levelLabel}`;
    }

    if (this.player.position.inCity) {
      const city = getCity(this.player.position.cityId);
      if (!city) return "???";
      const chunkIndex = this.player.position.cityChunkIndex;
      const chunk = getCityChunk(city, chunkIndex);
      if (!chunk) return "???";
      const cityMap = chunk.mapData;
      const terrain = cityMap[this.player.position.y]?.[this.player.position.x];
      if (terrain === Terrain.CityExit) return `${city.name}  [SPACE] Leave`;
      if (city.id === "tidehaven_city" && terrain === Terrain.Dungeon) {
        return "Tideglass Grotto  [SPACE] Enter Dungeon";
      }
      if (terrain === Terrain.CityGate) {
        const connection = getCityConnectionAt(
          city,
          chunkIndex,
          this.player.position.x,
          this.player.position.y,
        );
        const destination = connection
          ? getCityChunk(city, connection.toChunkIndex)
          : undefined;
        return destination
          ? `${destination.name}  [SPACE] Enter District`
          : city.name;
      }
      const shop = getCityChunkShopNearby(
        city,
        chunkIndex,
        this.player.position.x,
        this.player.position.y,
      );
      if (shop) return `${shop.name}  [SPACE] Enter`;
      const gatheringPrompt = this.gatheringManager.getPrompt(this.player);
      return gatheringPrompt
        ? `${city.name}: ${chunk.name}  ${gatheringPrompt}`
        : `${city.name}: ${chunk.name}`;
    }

    const terrain = getTerrainAt(this.player.position.chunkX, this.player.position.chunkY, this.player.position.x, this.player.position.y);
    const nautical = this.player.progression.nautical;
    if (nautical.sailing) {
      const tidehaven = getPort("tidehavenPort");
      if (
        this.player.position.chunkX === tidehaven.location.chunkX
        && this.player.position.chunkY === tidehaven.location.chunkY
        && this.player.position.x === tidehaven.location.tileX
        && this.player.position.y === tidehaven.location.tileY
      ) {
        return "Tidehaven Free Port  [SPACE] Enter";
      }
      const sea = getSeaZoneAt(
        this.player.position.chunkX,
        this.player.position.chunkY,
        this.player.position.x,
        this.player.position.y,
      );
      const landing = canDisembark(
        nautical,
        this.player.position,
        nautical.heading,
        getTerrainAt,
        (position) => this.isNauticalLandingBlocked(position),
      );
      return `${sea?.zoneId ?? "Open Sea"} (${sea?.depth ?? "unknown"})`
        + (landing.ok ? "  [SPACE] Disembark" : "");
    }
    const chunk = getChunk(this.player.position.chunkX, this.player.position.chunkY);
    const town = chunk?.towns.find(
      (t) => t.x === this.player.position.x && t.y === this.player.position.y,
    );
    const boss = chunk?.bosses.find(
      (b) => b.x === this.player.position.x && b.y === this.player.position.y,
    );

    let locStr = TERRAIN_DISPLAY_NAMES[terrain ?? 0] ?? "Unknown";
    if (town) {
      const city = getCityForTown(this.player.position.chunkX, this.player.position.chunkY, town.x, town.y);
      if (city) {
        const entranceBlock = getBlockedQuestEntrance(this.player, {
          type: "city",
          targetId: city.id,
          chunkX: city.chunkX,
          chunkY: city.chunkY,
          tileX: city.tileX,
          tileY: city.tileY,
        });
        locStr = entranceBlock
          ? `${entranceBlock.label}  [SPACE] Inspect`
          : `${town.name}  [SPACE] Enter`;
      } else {
        locStr = `${town.name}  [SPACE] Shop`;
      }
    }
    if (boss && !this.defeatedBosses.has(boss.monsterId)) {
      locStr = `${boss.name}'s Lair  [SPACE] Challenge`;
    }
    if (terrain === Terrain.Dungeon) {
      const dungeon = getDungeonAt(this.player.position.chunkX, this.player.position.chunkY, this.player.position.x, this.player.position.y);
      if (dungeon) {
        const entranceBlock = getBlockedQuestEntrance(this.player, {
          type: "dungeon",
          targetId: dungeon.id,
          chunkX: dungeon.entranceChunkX,
          chunkY: dungeon.entranceChunkY,
          tileX: dungeon.entranceTileX,
          tileY: dungeon.entranceTileY,
        });
        if (entranceBlock) {
          locStr = `${entranceBlock.label}  [SPACE] Inspect`;
        } else {
          const hasKey = this.player.inventory.some((i) => i.id === "dungeonKey");
          locStr = (hasKey || isDebug())
            ? `${dungeon.name}  [SPACE] Enter Dungeon`
            : `${dungeon.name}  (Locked — need key)`;
        }
      }
    }
    if (terrain === Terrain.Chest) {
      const chest = getChestAt(this.player.position.x, this.player.position.y, { type: "overworld", chunkX: this.player.position.chunkX, chunkY: this.player.position.chunkY });
      if (chest && !this.player.progression.openedChests.includes(chest.id)) {
        locStr = chest.lockDc
          ? "Locked Chest  [SPACE] Pick Lock"
          : "Treasure Chest  [SPACE] Open";
      } else {
        locStr = "Opened Chest";
      }
    }
    if (!locStr.includes("[SPACE]")) {
      const embarkation = canEmbark(
        nautical,
        this.player.position,
        nautical.heading,
        getTerrainAt,
        () => false,
      );
      if (embarkation.ok) {
        locStr = `${locStr}  [SPACE] Embark`;
      }
    }
    if (!locStr.includes("[SPACE]")) {
      const gatheringPrompt = this.gatheringManager.getPrompt(this.player);
      if (gatheringPrompt) locStr = `${locStr}  ${gatheringPrompt}`;
    }

    return locStr;
  }

  private updateDebugPanel(): void {
    const p = this.player;
    let terrain: Terrain | undefined;
    if (p.position.inDungeon) {
      const dungeon = getDungeon(p.position.dungeonId);
      const levelMap = dungeon ? getDungeonLevelMap(dungeon, p.position.dungeonLevel) : undefined;
      terrain = levelMap?.[p.position.y]?.[p.position.x];
    } else if (p.position.inCity) {
      const city = getCity(p.position.cityId);
      const cityMap = city ? getCityChunkMap(city, p.position.cityChunkIndex) : undefined;
      terrain = cityMap?.[p.position.y]?.[p.position.x];
    } else {
      terrain = getTerrainAt(p.position.chunkX, p.position.chunkY, p.position.x, p.position.y);
    }

    const tName = TERRAIN_DEBUG_NAMES[terrain ?? 0] ?? "?";
    const rate = terrain !== undefined ? (ENCOUNTER_RATES[terrain] ?? 0) : 0;
    const encMult = getEncounterMultiplier(this.timeStep);
    const weatherEncMult = getWeatherEncounterMultiplier(this.weatherState.current);
    const mountEncMult = (!p.position.inDungeon && p.mountId) ? (getMount(p.mountId)?.encounterMultiplier ?? 1) : 1;
    const dangerEncMult = this.questFlow.getCurrentDangerState()
      ?.encounterRateMultiplier ?? 1;
    const effectiveRate = getEffectiveEncounterRate(
      rate,
      encMult,
      weatherEncMult,
      mountEncMult,
      dangerEncMult,
    );
    const dungeonTag = p.position.inDungeon ? ` [DUNGEON:${p.position.dungeonId}]` : "";
    const cityTag = p.position.inCity
      ? ` [CITY:${p.position.cityId}:${p.position.cityChunkIndex}]`
      : "";
    const mountTag = p.mountId ? ` [MOUNT:${p.mountId}]` : "";
    const boatTag = p.progression.nautical.sailing
      ? ` [BOAT:${p.progression.nautical.activeBoatId ?? "none"}]`
      : "";
    const menuTag = this.overlayManager.menuOverlay ? " [MENU]" : "";
    const chronicleTag = this.chronicleManager?.getDebugState() ?? "";
    const worldEventTag = this.worldEventManager?.getDebugState() ?? "";
    const gatheringTag = this.gatheringManager?.getDebugState() ?? "";
    const tutorialTag = this.tutorialManager.isTutorialOpen()
      ? " [TUTORIAL]"
      : this.tutorialManager.isTipsOpen()
        ? " [TIPS]"
        : "";
    const partyTag = this.partyOverlayManager.getDebugState();
    const achievementTag = this.achievementOverlayManager.getDebugState();
    const craftingTag = this.craftingManager.getDebugState();
    const timePeriod = getTimePeriod(this.timeStep);
    debugPanelState(
      `OVERWORLD | Chunk: (${p.position.chunkX},${p.position.chunkY}) Pos: (${p.position.x},${p.position.y}) ${tName}${cityTag}${dungeonTag}${mountTag}${boatTag}${menuTag}${chronicleTag}${worldEventTag}${gatheringTag}${tutorialTag}${partyTag}${achievementTag}${craftingTag} | ` +
      `Anim: ${this.worldPresentation.debugState} | ` +
      `Time: ${timePeriod} (step ${this.timeStep}) | Weather: ${this.weatherState.current} (${this.weatherState.stepsUntilChange} steps) | ` +
      `Enc: ${(effectiveRate * 100).toFixed(0)}% (×${encMult}×${weatherEncMult}${mountEncMult !== 1 ? `×${mountEncMult}` : ""}${dangerEncMult !== 1 ? `×${dangerEncMult}` : ""})${this.encounterSystem.areEncountersEnabled() ? "" : " [OFF]"}${this.fogOfWar.isFogDisabled() ? " Fog[OFF]" : ""} | ` +
      `Bosses: ${this.defeatedBosses.size} | Chests: ${p.progression.openedChests.length} | Checks: ${Object.keys(p.progression.skillChecks).length}`,
    );
  }

  // ── Overlay & dialogue state ────────────────────────────────────────────

  private isOverlayOpen(): boolean {
    return this.overlayManager.isOpen()
      || this.partyOverlayManager.isOpen()
      || this.achievementOverlayManager.isOpen()
      || this.questJournal.isOpen()
      || this.chronicleManager?.isOpen()
      || this.worldEventManager.isOpen()
      || this.gatheringManager.isOpen()
      || this.craftingManager.isOpen()
      || this.tutorialManager.isOpen();
  }

  private openQuestJournal(): void {
    if (this.sceneTransitions.isPending) return;
    this.dialogueSystem.dismissDialogue();
    this.questJournal.toggle(this.player);
  }

  private openCrafting(): void {
    if (
      this.sceneTransitions.isPending
      || this.isMoving
      || this.dialogueSystem.isDialogueOpen()
    ) return;
    this.overlayManager.destroyAll();
    this.partyOverlayManager.close();
    this.autoSave();
    this.craftingManager.open(this.player, this.codex);
  }

  // ── Player movement ─────────────────────────────────────────────────────

  private tweenPlayerTo(tileX: number, tileY: number, duration: number, onComplete: () => void): void {
    const destX = tileX * TILE_SIZE + TILE_SIZE / 2;
    const destY = tileY * TILE_SIZE + TILE_SIZE / 2;
    const mounted = !!this.playerRenderer.mountSprite;
    const sailing = !!this.playerRenderer.boatSprite;
    const flipped = this.playerRenderer.playerSprite.flipX;
    const riderOffX = flipped ? -PlayerRenderer.riderOffsetX : PlayerRenderer.riderOffsetX;
    const motionDuration = getMotionDuration(duration);
    const playerX = destX + (mounted ? riderOffX : sailing ? -2 : 0);
    const playerY = destY - (mounted ? PlayerRenderer.riderOffsetY : sailing ? 7 : 0);
    this.worldPresentation.presentPlayerStep(
      destX < this.playerRenderer.playerSprite.x ? -1 : 1,
    );
    const finishPresentation = (): void => {
      this.worldPresentation.completePlayerStep();
      onComplete();
    };

    if (motionDuration === 0) {
      this.playerRenderer.playerSprite.setPosition(playerX, playerY);
      this.playerRenderer.mountSprite?.setPosition(destX, destY);
      this.playerRenderer.boatSprite?.setPosition(destX, destY);
      finishPresentation();
      return;
    }
    this.tweens.add({
      targets: this.playerRenderer.playerSprite,
      x: playerX,
      y: playerY,
      duration: motionDuration,
      onComplete: finishPresentation,
    });

    if (this.playerRenderer.mountSprite) {
      this.tweens.add({
        targets: this.playerRenderer.mountSprite,
        x: destX,
        y: destY,
        duration: motionDuration,
      });
    }
    if (this.playerRenderer.boatSprite) {
      this.tweens.add({
        targets: this.playerRenderer.boatSprite,
        x: destX,
        y: destY,
        duration: motionDuration,
      });
    }
  }

  private getEffectiveMoveDelay(): number {
    if (this.player.progression.nautical.sailing) {
      return Math.round(this.moveDelay / 1.35);
    }
    if (this.player.position.inDungeon || this.player.position.inCity || !this.player.mountId) {
      return this.moveDelay;
    }
    const mount = getMount(this.player.mountId);
    if (!mount) return this.moveDelay;
    return Math.round(this.moveDelay / mount.speedMultiplier);
  }

  private headingFromDelta(dx: number, dy: number): CardinalHeading {
    if (dy < 0) return "north";
    if (dx > 0) return "east";
    if (dy > 0) return "south";
    return "west";
  }

  private isNauticalLandingBlocked(position: PlayerState["position"]): boolean {
    const terrain = getTerrainAt(
      position.chunkX,
      position.chunkY,
      position.x,
      position.y,
    );
    return terrain === undefined
      || terrain === Terrain.Town
      || terrain === Terrain.Dungeon
      || terrain === Terrain.Boss
      || terrain === Terrain.Chest
      || terrain === Terrain.MinorTreasure;
  }

  private handleNauticalAction(): boolean {
    const state = this.player.progression.nautical;
    const heading = state.heading;
    const blocked = (position: PlayerState["position"]): boolean =>
      this.isNauticalLandingBlocked(position);
    if (state.sailing) {
      const tidehaven = getPort("tidehavenPort");
      if (
        this.player.position.chunkX === tidehaven.location.chunkX
        && this.player.position.chunkY === tidehaven.location.chunkY
        && this.player.position.x === tidehaven.location.tileX
        && this.player.position.y === tidehaven.location.tileY
      ) {
        const city = getCity(tidehaven.cityId);
        if (!city) return false;
        state.sailing = false;
        this.player.position.inCity = true;
        this.player.position.cityId = city.id;
        this.player.position.cityChunkIndex = 0;
        this.player.position.x = city.spawnX;
        this.player.position.y = city.spawnY;
        this.player.lastTownX = tidehaven.location.tileX;
        this.player.lastTownY = tidehaven.location.tileY;
        this.player.lastTownChunkX = tidehaven.location.chunkX;
        this.player.lastTownChunkY = tidehaven.location.chunkY;
        discoverPort(state, "tidehavenPort");
        if (!this.player.progression.discoveredCities.includes(city.id)) {
          this.player.progression.discoveredCities.push(city.id);
        }
        const cityUnlock = unlockCodexFromSignal(this.codex, {
          type: "location",
          locationKind: "city",
          targetId: city.id,
        });
        this.weatherState.current = WeatherType.Clear;
        this.autoSave();
        this.restartOverworld("enter Tidehaven", cityUnlock.unlockedIds);
        return true;
      }
      const check = canDisembark(
        state,
        this.player.position,
        heading,
        getTerrainAt,
        blocked,
      );
      if (!check.ok) return false;
      const result = disembark(
        state,
        this.player.position,
        heading,
        getTerrainAt,
        blocked,
      );
      if (!result.ok) {
        this.showMessage(result.reason ?? "No safe landing.", "#ff8888");
        return true;
      }
      Object.assign(this.player.position, result.position);
      this.createPlayerSprite();
      this.refreshPartyActors();
      this.updateAudio();
      this.autoSave();
      this.restartOverworld("disembark boat");
      return true;
    }

    const check = canEmbark(
      state,
      this.player.position,
      heading,
      getTerrainAt,
      () => false,
    );
    if (!check.ok) return false;
    const result = embark(
      state,
      this.player.position,
      heading,
      getTerrainAt,
      () => false,
    );
    if (!result.ok) {
      this.showMessage(result.reason ?? "Cannot embark.", "#ff8888");
      return true;
    }
    this.player.mountId = "";
    Object.assign(this.player.position, result.position);
    this.companionFollowerManager.clear();
    this.createPlayerSprite();
    this.updateAudio();
    this.autoSave();
    this.restartOverworld("embark boat");
    return true;
  }

  private discoverCurrentPort(): void {
    const position = this.player.position;
    const port = PORTS.find((candidate) =>
      position.inCity
        ? candidate.cityId === position.cityId
        : candidate.location.chunkX === position.chunkX
          && candidate.location.chunkY === position.chunkY
          && candidate.location.tileX === position.x
          && candidate.location.tileY === position.y
    );
    if (!port || !discoverPort(this.player.progression.nautical, port.id)) return;
    this.showMessage(`⚓ Discovered ${port.name}.`, "#80cbc4");
    this.autoSave();
  }

  private travelMerchantRoute(
    routeId: Parameters<typeof executeMerchantRoute>[2],
    currentPortId: Parameters<typeof executeMerchantRoute>[3],
  ): void {
    const state = this.player.progression.nautical;
    const instanceId = `route:${routeId}:${state.stats.routesCompleted + 1}`;
    const started = executeMerchantRoute(
      state,
      this.player,
      routeId,
      currentPortId,
      instanceId,
      (questId) => isQuestCompleted(this.player.progression.quests, questId),
    );
    if (!started.ok || !started.pending) {
      this.showMessage(started.reason ?? "Route unavailable.", "#ff8888");
      return;
    }
    this.autoSave();
    const resolved = resolvePendingMerchantRoute(state, instanceId);
    if (!resolved.ok || !resolved.destinationPortId) {
      this.showMessage(resolved.reason ?? "Route handoff failed.", "#ff8888");
      return;
    }
    this.applyMerchantRouteDestination(resolved.destinationPortId);
    const destination = getPort(resolved.destinationPortId);
    this.overlayManager.toggleWorldMap(this.player, this.defeatedBosses);
    this.showMessage(
      `Merchant route arrived at ${destination.name} `
      + `(${resolved.conditionLost} hull wear).`,
      "#80cbc4",
    );
    this.autoSave();
    this.restartOverworld("merchant route arrival");
  }

  private applyMerchantRouteDestination(
    destinationPortId: Parameters<typeof getPort>[0],
  ): void {
    const destination = getPort(destinationPortId);
    const destinationCity = destination.cityId === "tidehaven_city"
      ? getCity(destination.cityId)
      : undefined;
    Object.assign(this.player.position, {
      inCity: false,
      cityId: "",
      cityChunkIndex: 0,
      inDungeon: false,
      dungeonId: "",
      dungeonLevel: 0,
      chunkX: destination.location.chunkX,
      chunkY: destination.location.chunkY,
      x: destination.location.tileX,
      y: destination.location.tileY,
    });
    if (destinationCity) {
      Object.assign(this.player.position, {
        inCity: true,
        cityId: destinationCity.id,
        cityChunkIndex: 0,
        x: destinationCity.spawnX,
        y: destinationCity.spawnY,
      });
      if (!this.player.progression.discoveredCities.includes(destinationCity.id)) {
        this.player.progression.discoveredCities.push(destinationCity.id);
      }
    }
  }

  private resumePendingNautical(): boolean {
    const state = this.player.progression.nautical;
    if (state.pendingMerchantRoute) {
      const pending = state.pendingMerchantRoute;
      const resolved = resolvePendingMerchantRoute(state, pending.instanceId);
      if (resolved.ok && resolved.destinationPortId) {
        this.applyMerchantRouteDestination(resolved.destinationPortId);
        this.autoSave();
        this.restartOverworld("resume merchant route");
        return true;
      }
    }
    if (state.pendingHazard) {
      const pending = state.pendingHazard;
      const result = resolvePendingSeaHazard(
        state,
        this.player,
        pending.instanceId,
      );
      this.showMessage(
        `${pending.hazardId}: ${result.hpLost} HP, `
        + `${result.conditionLost} hull damage.`,
        result.check?.success ? "#80cbc4" : "#ffab91",
      );
      const boat = getActiveBoatState(state);
      if (boat?.condition === 0) {
        const port = getPort("sandportHarbor");
        state.sailing = false;
        Object.assign(this.player.position, {
          chunkX: port.location.chunkX,
          chunkY: port.location.chunkY,
          x: port.location.tileX,
          y: port.location.tileY,
        });
        this.autoSave();
        this.restartOverworld("recover pending hazard");
        return true;
      }
      this.autoSave();
      return false;
    }
    if (state.pendingEncounter) {
      const pending = state.pendingEncounter;
      const monster = getMonster(pending.monsterId);
      if (!monster) {
        resolvePendingSeaEncounter(state, pending.instanceId, "fled");
        this.autoSave();
        return false;
      }
      const encounter = createRandomEncounter(monster, this.player.level, [
        "sea",
        pending.depth,
        pending.zoneId,
        isNightTime(this.timeStep) ? "night" : "day",
      ]);
      const hooks: BattleResolutionHooks = {
        onBattleResolved: (result) => {
          resolvePendingSeaEncounter(
            state,
            pending.instanceId,
            result.outcome,
          );
        },
      };
      this.startBattle(encounter, Terrain.Water, true, hooks);
      return true;
    }
    return false;
  }

  private resolveNauticalStep(): boolean {
    const position = this.player.position;
    const state = this.player.progression.nautical;
    const sea = getSeaZoneAt(
      position.chunkX,
      position.chunkY,
      position.x,
      position.y,
    );
    const boat = getActiveBoatState(state);
    if (!sea || !boat) return false;
    discoverSeaTile(
      state,
      sea.zoneId,
      position.chunkX,
      position.chunkY,
      position.x,
      position.y,
    );
    const stepId = [
      this.timeStep,
      position.chunkX,
      position.chunkY,
      position.x,
      position.y,
    ].join(":");
    const seed = (
      this.timeStep * 73856093
      ^ position.chunkX * 19349663
      ^ position.chunkY * 83492791
      ^ position.x * 2654435761
      ^ position.y
    ) | 0;
    const hazard = prepareSeaHazard({
      state,
      stepId,
      seed,
      zoneId: sea.zoneId,
      depth: sea.depth,
      timeStep: this.timeStep,
      weather: this.weatherState.current,
    });
    if (hazard) {
      this.autoSave();
      const resolution = resolvePendingSeaHazard(
        state,
        this.player,
        hazard.instanceId,
      );
      const outcome = resolution.check?.success ? "avoided" : "struck";
      this.showMessage(
        `${hazard.hazardId}: ${outcome}; `
        + `${resolution.hpLost} HP, ${resolution.conditionLost} hull.`,
        resolution.check?.success ? "#80cbc4" : "#ffab91",
      );
      if (boat.condition <= 0) {
        const port = getPort("sandportHarbor");
        state.sailing = false;
        Object.assign(this.player.position, {
          chunkX: port.location.chunkX,
          chunkY: port.location.chunkY,
          x: port.location.tileX,
          y: port.location.tileY,
        });
        this.showMessage("The damaged boat is towed to Sandport.", "#ffab91");
        this.autoSave();
        this.restartOverworld("recover disabled boat");
      } else {
        this.autoSave();
      }
      return true;
    }

    const krakenEligible = sea.zoneId === "southreachDeep"
      && sea.depth === "deep"
      && this.player.level >= 15
      && state.stats.seaSteps >= 40
      && !this.defeatedBosses.has("kraken")
      && Math.random() < 0.03;
    const pending = krakenEligible
      ? null
      : prepareSeaEncounter({
        state,
        stepId,
        rateRoll: Math.random(),
        selectionRoll: Math.random(),
        zoneId: sea.zoneId,
        depth: sea.depth,
        timeStep: this.timeStep,
        weather: this.weatherState.current,
        boat,
        position,
      });
    const monster = krakenEligible
      ? getMonster("kraken")
      : pending
        ? getMonster(pending.monsterId)
        : undefined;
    if (!monster) return false;
    const encounter = createRandomEncounter(monster, this.player.level, [
      "sea",
      sea.depth,
      isNightTime(this.timeStep) ? "night" : "day",
      sea.zoneId,
    ]);
    const pendingId = pending?.instanceId;
    const hooks: BattleResolutionHooks = pendingId
      ? {
        onBattleResolved: (result) => {
          resolvePendingSeaEncounter(
            state,
            pendingId,
            result.outcome,
          );
          return {
            messages: [`The ${getSeaZone(sea.zoneId).name} grows quiet again.`],
          };
        },
      }
      : {};
    this.autoSave();
    this.startBattle(encounter, Terrain.Water, false, hooks);
    return true;
  }

  update(time: number): void {
    this.updateDebugPanel();
    this.achievementNotifications.update(
      !this.sceneTransitions.isPending
      && !this.isMoving
      && !this.isOverlayOpen()
      && !this.dialogueSystem.isDialogueOpen()
      && !this.codexDiscovery.isShowing(),
    );

    if (this.tutorialManager.isOpen()) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
        this.tutorialManager.handleAction("confirm");
      }
      return;
    }

    if (this.gatheringManager.isOpen()) {
      this.gatheringManager.update();
      return;
    }

    if (this.worldEventManager.isOpen()) {
      this.worldEventManager.update();
      return;
    }

    if (this.chronicleManager?.isOpen()) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
        this.chronicleManager.replaySelected();
      } else {
        this.chronicleManager.update();
      }
      return;
    }

    // SPACE actions must be processed even when overlays/dialogue are open
    // so the player can dismiss dialogues, inn confirmations, etc.
    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
      this.handleAction();
      return;
    }

    if (this.sceneTransitions.isPending) return;
    if (this.isMoving) return;
    if (this.isOverlayOpen()) return;
    if (this.dialogueSystem.isDialogueOpen()) return;
    if (time - this.lastMoveTime < this.getEffectiveMoveDelay()) return;

    let dx = 0;
    let dy = 0;
    if (this.keys.W.isDown) dy = -1;
    else if (this.keys.S.isDown) dy = 1;
    else if (this.keys.A.isDown) dx = -1;
    else if (this.keys.D.isDown) dx = 1;

    if (dx !== 0 || dy !== 0) this.tryMove(dx, dy, time);
  }

  private tryMove(dx: number, dy: number, time: number): void {
    if (this.sceneTransitions.isPending) return;
    const previousTile = {
      x: this.player.position.x,
      y: this.player.position.y,
    };
    const newX = this.player.position.x + dx;
    const newY = this.player.position.y + dy;
    this.player.progression.nautical.heading = this.headingFromDelta(dx, dy);

    // Update sprite facing direction based on horizontal movement
    if (dx !== 0) {
      const faceLeft = dx < 0;
      this.playerRenderer.playerSprite.setFlipX(faceLeft);
      if (this.playerRenderer.mountSprite) {
        this.playerRenderer.mountSprite.setFlipX(faceLeft);
      }
    }

    // Update front/back/side facing based on movement direction
    this.playerRenderer.setFacingDirection(dx, dy, this.player);

    // ── Dungeon movement ──
    if (this.player.position.inDungeon) {
      const dungeon = getDungeon(this.player.position.dungeonId);
      if (!dungeon) return;
      if (newX < 0 || newX >= MAP_WIDTH || newY < 0 || newY >= MAP_HEIGHT) return;
      const levelMap = getDungeonLevelMap(dungeon, this.player.position.dungeonLevel);
      const terrain = levelMap[newY][newX];
      if (!isWalkable(terrain)) return;
      if (this.dungeonTrapManager.blocksMoveTo(this.player, newX, newY)) {
        this.updateLocationText();
        return;
      }

      this.lastMoveTime = time;
      this.isMoving = true;
      this.player.position.x = newX;
      this.player.position.y = newY;
      if (!this.player.progression.nautical.sailing) {
        this.companionFollowerManager.followStep(previousTile, 120, dx);
      }
      if (audioEngine.initialized) audioEngine.playFootstepSFX(terrain);

      this.tweenPlayerTo(newX, newY, 120, () => {
        this.advanceTime();
        this.questFlow.warnAboutCurrentDanger();
        this.revealAround();
        this.revealTileSprites();
        if (this.dungeonTrapManager.handleArrival(this.player)) {
          this.updateHUD();
          this.updateLocationText();
          return;
        }
        this.isMoving = false;
        this.dungeonTrapManager.scanNearby(this.player);
        this.updateHUD();
        this.updateLocationText();
        if (!this.skillCheckManager.checkExplorationEvent(this.player, terrain)) {
          this.checkEncounter(terrain);
        }
      });
      return;
    }

    // ── City movement ──
    if (this.player.position.inCity) {
      this.dialogueSystem.dismissDialogue();
      this.overlayManager.dismissInnConfirmation();
      this.overlayManager.dismissBankOverlay();

      const city = getCity(this.player.position.cityId);
      if (!city) return;
      const chunk = getCityChunk(city, this.player.position.cityChunkIndex);
      if (!chunk) return;
      const cityMap = chunk.mapData;
      const targetX = this.player.position.x + dx;
      const targetY = this.player.position.y + dy;
      if (targetX < 0 || targetX >= MAP_WIDTH || targetY < 0 || targetY >= MAP_HEIGHT) return;
      const targetTerrain = cityMap[targetY][targetX];
      if (!isWalkable(targetTerrain)) return;

      // Block entry to shops at night (except inn)
      if ((targetTerrain === Terrain.Carpet || targetTerrain === Terrain.ShopFloor) && getTimePeriod(this.timeStep) === TimePeriod.Night) {
        const nearbyShop = getCityChunkShopNearby(
          city,
          this.player.position.cityChunkIndex,
          targetX,
          targetY,
        );
        if (nearbyShop && nearbyShop.type !== "inn") {
          this.showMessage("The shop is closed for the night. Come back in the morning!", "#ff8888");
          return;
        }
      }

      // Shop interior only accessible via carpet entrance
      if (targetTerrain === Terrain.ShopFloor) {
        const curTerrain = cityMap[this.player.position.y]?.[this.player.position.x];
        if (curTerrain !== Terrain.Carpet && curTerrain !== Terrain.ShopFloor) return;
      }

      // Shop exit only through carpet (door)
      const curTerrain = cityMap[this.player.position.y]?.[this.player.position.x];
      if (curTerrain === Terrain.ShopFloor && targetTerrain !== Terrain.ShopFloor && targetTerrain !== Terrain.Carpet) return;

      this.lastMoveTime = time;
      this.isMoving = true;
      this.player.position.x = newX;
      this.player.position.y = newY;
      this.companionFollowerManager.followStep(previousTile, 120, dx);
      if (audioEngine.initialized) audioEngine.playFootstepSFX(targetTerrain);

      this.tweenPlayerTo(newX, newY, 120, () => {
        this.isMoving = false;
        this.advanceTime();
        this.revealAround();
        this.revealTileSprites();
        this.updateHUD();
        this.updateLocationText();
        const city2 = getCity(this.player.position.cityId);
        if (city2) {
          const chunk2 = getCityChunk(city2, this.player.position.cityChunkIndex);
          if (chunk2) {
            const idx = this.cityRenderer.getPlayerShopIndex(
              chunk2.mapData,
              chunk2.shops,
              this.player.position.x,
              this.player.position.y,
            );
            this.cityRenderer.updateShopRoofAlpha(idx);
          }
        }
      });
      return;
    }

    // ── Overworld movement ──
    this.dialogueSystem.dismissDialogue();

    const result = tryGridMove(this.player, dx, dy);
    if (!result.moved) {
      debugLog("Blocked move", { dx, dy });
      return;
    }

    this.lastMoveTime = time;
    this.isMoving = true;

    if (result.chunkChanged) {
      this.advanceTime();
      this.rerollWeather();
      this.restartOverworld("change world chunk");
      return;
    }

    this.companionFollowerManager.followStep(previousTile, 120, dx);

    if (audioEngine.initialized && result.newTerrain !== undefined) {
      if (this.player.progression.nautical.sailing) {
        audioEngine.playSailingSFX();
      } else if (!this.player.position.inDungeon && !this.player.position.inCity && this.player.mountId) {
        audioEngine.playMountedFootstepSFX();
      } else {
        audioEngine.playFootstepSFX(result.newTerrain);
      }
    }

    this.tweenPlayerTo(this.player.position.x, this.player.position.y, 120, () => {
      this.isMoving = false;
      this.advanceTime();
      this.revealAround();
      this.revealTileSprites();
      this.updateHUD();
      this.updateLocationText();
      if (this.player.progression.nautical.sailing) {
        if (this.resolveNauticalStep()) return;
      }
      resolveOverworldStepTrigger({
        worldEvent: () => this.worldEventManager.checkAfterStep(
          this.player,
          this.codex,
          this.defeatedBosses,
          this.getWorldEventContext(result.newTerrain!),
        ),
        treasure: () => this.skillCheckManager.collectMinorTreasure(
          this.player,
          this.mapRenderer,
        ),
        skillCheck: () => this.skillCheckManager.checkExplorationEvent(
          this.player,
          result.newTerrain!,
        ),
        encounter: () => {
          this.checkEncounter(result.newTerrain!);
          return true;
        },
      });
      this.updateHUD();
      this.updateLocationText();
    });
  }

  // ── Encounters & treasure ───────────────────────────────────────────────

  private getWorldEventContext(terrain: Terrain): WorldEventContext {
    const position = this.player.position;
    return {
      location: {
        chunkX: position.chunkX,
        chunkY: position.chunkY,
        x: position.x,
        y: position.y,
        areaName: getChunk(position.chunkX, position.chunkY)?.name ?? "Unknown",
        terrain,
      },
      level: this.player.level,
      timeStep: this.timeStep,
      period: getTimePeriod(this.timeStep),
      weather: this.weatherState.current,
      quests: this.player.progression.quests,
      defeatedBosses: this.defeatedBosses,
      social: this.player.progression.social,
    };
  }

  private checkEncounter(terrain: Terrain): void {
    this.autoSave();
    if (terrain === Terrain.Boss || terrain === Terrain.Town || terrain === Terrain.DungeonExit || terrain === Terrain.Chest || terrain === Terrain.DungeonStairs || terrain === Terrain.DungeonBoss) return;
    if (isDebug() && !this.encounterSystem.areEncountersEnabled()) return;

    if (terrain === Terrain.Water && !this.player.progression.nautical.sailing) return;
    const mountEncMult = (!this.player.position.inDungeon && this.player.mountId)
      ? (getMount(this.player.mountId)?.encounterMultiplier ?? 1) : 1;
    const danger = this.questFlow.getCurrentDangerState();
    const effectiveLevel = this.player.level
      + (danger?.effectiveLevelOffset ?? 0);
    const rate = getEffectiveEncounterRate(
      ENCOUNTER_RATES[terrain],
      getEncounterMultiplier(this.timeStep),
      getWeatherEncounterMultiplier(this.weatherState.current),
      mountEncMult,
      danger?.encounterRateMultiplier ?? 1,
    );

    const forcedGroup = this.getForcedGroupEncounter();
    if (forcedGroup || Math.random() < rate) {
      let monster: Monster;
      const environments: string[] = [];
      if (this.player.position.inDungeon) {
        monster = getDungeonEncounter(
          effectiveLevel,
          this.player.position.dungeonId,
        );
        environments.push("dungeon", this.player.position.dungeonId);
      } else if (isNightTime(this.timeStep) && Math.random() < 0.4) {
        const chunk = getChunk(this.player.position.chunkX, this.player.position.chunkY);
        monster = getNightEncounter(effectiveLevel, chunk?.name);
        environments.push(
          this.terrainToBiome(terrain),
          chunk?.name ?? "",
          "night",
        );
      } else {
        monster = getRandomEncounter(effectiveLevel);
        const chunk = getChunk(this.player.position.chunkX, this.player.position.chunkY);
        environments.push(
          this.terrainToBiome(terrain),
          chunk?.name ?? "",
          isNightTime(this.timeStep) ? "night" : "day",
        );
      }
      const encounter = forcedGroup ?? createRandomEncounter(
        monster,
        effectiveLevel,
        environments,
      );
      debugLog("Encounter!", {
        terrain: Terrain[terrain],
        rate,
        encounter: encounter.name,
        members: encounter.members.map((member) => member.monster.id),
        inDungeon: this.player.position.inDungeon,
        time: getTimePeriod(this.timeStep),
      });
      debugPanelLog(`[ENC] ${encounter.name} appeared! (${(rate * 100).toFixed(0)}% chance)`, true);
      this.startBattle(encounter, terrain);
    }
  }

  private getForcedGroupEncounter(): MonsterEncounter | undefined {
    if (!isLocalDev()) return undefined;
    const search = globalThis.location?.search ?? "";
    const params = new URLSearchParams(search);
    const groupId = params.get("forceGroup");
    if (!groupId) return undefined;
    const template = getMonsterGroupTemplate(groupId);
    const encounter = template ? createGroupEncounter(template) : undefined;
    params.delete("forceGroup");
    const query = params.toString();
    globalThis.history?.replaceState(
      {},
      "",
      `${globalThis.location?.pathname ?? "/"}${query ? `?${query}` : ""}`,
    );
    if (!encounter) {
      debugPanelLog(`[ENC] Unknown forced group: ${groupId}`, true);
    }
    return encounter;
  }

  /** Evac: teleport player to the dungeon entrance (used by Evac ability). */
  private evacuateDungeon(): void {
    if (!this.player.position.inDungeon) return;
    const dungeon = getDungeon(this.player.position.dungeonId);
    if (!dungeon) return;
    this.player.position.inDungeon = false;
    this.player.position.dungeonId = "";
    this.player.position.dungeonLevel = 0;
    this.player.position.chunkX = dungeon.entranceChunkX;
    this.player.position.chunkY = dungeon.entranceChunkY;
    this.player.position.x = dungeon.entranceTileX;
    this.player.position.y = dungeon.entranceTileY;
    this.rerollWeather();
    this.autoSave();
    this.restartOverworld("evacuate dungeon");
  }

  // ── SPACE action handler ────────────────────────────────────────────────

  private showCompanionDialogue(companion: CompanionState): void {
    const line = this.companionFollowerManager.getDialogueLine(companion);
    this.dialogueSystem.showSpecialDialogue(companion.name, line);
    this.autoSave();
  }

  private tryInteractCompanion(): boolean {
    const companion = this.companionFollowerManager.findAdjacentCompanion(
      this.player.party,
      this.player.position.x,
      this.player.position.y,
    );
    if (!companion) return false;
    this.showCompanionDialogue(companion);
    return true;
  }

  private handleAction(): void {
    if (this.chronicleManager?.isOpen()) {
      this.chronicleManager.replaySelected();
      return;
    }
    if (this.partyOverlayManager.isOpen()) {
      this.partyOverlayManager.close();
      return;
    }
    if (this.dialogueSystem.advanceDialogue()) return;
    if (this.dialogueSystem.isDialogueOpen()) {
      this.dialogueSystem.dismissDialogue();
      return;
    }
    if (this.questJournal.isOpen()) {
      this.questJournal.close();
      return;
    }
    if (this.sceneTransitions.isPending) return;

    if (!this.player.position.inDungeon && !this.player.position.inCity) {
      if (this.handleNauticalAction()) return;
    }

    // ── Dungeon ──
    if (this.player.position.inDungeon) {
      const dungeon = getDungeon(this.player.position.dungeonId);
      if (!dungeon) return;
      if (!this.isMoving && this.dungeonTrapManager.handleAction(this.player)) {
        this.updateLocationText();
        return;
      }
      const levelMap = getDungeonLevelMap(dungeon, this.player.position.dungeonLevel);
      const terrain = levelMap[this.player.position.y]?.[this.player.position.x];

      if (terrain === Terrain.DungeonExit) {
        if (this.player.position.dungeonLevel !== 0) return;
        if (dungeon.id === "tideglass_grotto") {
          const city = getCity("tidehaven_city");
          if (!city) return;
          this.player.position.inDungeon = false;
          this.player.position.dungeonId = "";
          this.player.position.dungeonLevel = 0;
          this.player.position.inCity = true;
          this.player.position.cityId = city.id;
          this.player.position.cityChunkIndex = 0;
          this.player.position.x = city.spawnX;
          this.player.position.y = city.spawnY;
          this.weatherState.current = WeatherType.Clear;
          this.autoSave();
          this.restartOverworld("return to Tidehaven");
          return;
        }
        this.player.position.inDungeon = false;
        this.player.position.dungeonId = "";
        this.player.position.dungeonLevel = 0;
        this.player.position.chunkX = dungeon.entranceChunkX;
        this.player.position.chunkY = dungeon.entranceChunkY;
        this.player.position.x = dungeon.entranceTileX;
        this.player.position.y = dungeon.entranceTileY;
        this.rerollWeather();
        this.autoSave();
        this.restartOverworld("exit dungeon");
        return;
      }

      if (terrain === Terrain.DungeonStairs) {
        if (!useDungeonConnection(this.player)) return;
        this.revealAround();
        this.autoSave();
        this.restartOverworld("change dungeon level");
        return;
      }

      if (terrain === Terrain.DungeonBoss) {
        const boss = getDungeonBoss(dungeon.id);
        if (boss && !this.defeatedBosses.has(boss.id)) {
          this.startBattle(boss, Terrain.DungeonBoss);
        }
        return;
      }

      if (terrain === Terrain.Chest) {
        this.openChest({
          type: "dungeon",
          dungeonId: this.player.position.dungeonId,
          dungeonLevel: this.player.position.dungeonLevel,
        });
        return;
      }
      if (this.startGatheringNearby()) return;
      if (this.tryInteractCompanion()) return;
      return;
    }

    // ── City ──
    if (this.player.position.inCity) {
      if (this.dialogueSystem.isDialogueOpen()) { this.dialogueSystem.dismissDialogue(); return; }
      if (this.overlayManager.innConfirmOverlay) { this.overlayManager.dismissInnConfirmation(); return; }
      if (this.overlayManager.bankOverlay) { this.overlayManager.dismissBankOverlay(); return; }

      const city = getCity(this.player.position.cityId);
      if (!city) return;
      const chunkIndex = this.player.position.cityChunkIndex;
      const chunk = getCityChunk(city, chunkIndex);
      if (!chunk) return;
      const cityMap = chunk.mapData;
      const terrain = cityMap[this.player.position.y]?.[this.player.position.x];

      if (terrain === Terrain.CityExit) {
        if (city.id === "tidehaven_city") {
          const boat = getActiveBoatState(this.player.progression.nautical);
          if (!boat || boat.condition <= 0) {
            this.showMessage(
              "No serviceable boat. Use the world map for a merchant route.",
              "#ffab91",
            );
            return;
          }
          const port = getPort("tidehavenPort");
          this.player.position.inCity = false;
          this.player.position.cityId = "";
          this.player.position.cityChunkIndex = 0;
          this.player.position.chunkX = port.location.chunkX;
          this.player.position.chunkY = port.location.chunkY;
          this.player.position.x = port.location.tileX;
          this.player.position.y = port.location.tileY;
          this.player.progression.nautical.sailing = true;
          this.rerollWeather();
          this.autoSave();
          this.restartOverworld("sail from Tidehaven");
          return;
        }
        this.player.position.inCity = false;
        this.player.position.cityId = "";
        this.player.position.cityChunkIndex = 0;
        this.player.position.chunkX = city.chunkX;
        this.player.position.chunkY = city.chunkY;
        this.player.position.x = city.tileX;
        this.player.position.y = city.tileY;
        this.rerollWeather();
        this.autoSave();
        this.restartOverworld("exit city");
        return;
      }

      if (city.id === "tidehaven_city" && terrain === Terrain.Dungeon) {
        const dungeon = getDungeon("tideglass_grotto");
        if (!dungeon) return;
        this.player.position.inCity = false;
        this.player.position.cityId = "";
        this.player.position.cityChunkIndex = 0;
        this.player.position.inDungeon = true;
        this.player.position.dungeonId = dungeon.id;
        this.player.position.dungeonLevel = 0;
        this.player.position.x = dungeon.spawnX;
        this.player.position.y = dungeon.spawnY;
        this.weatherState.current = WeatherType.Clear;
        if (audioEngine.initialized) audioEngine.playDungeonEnterSFX();
        const dungeonUnlock = unlockCodexFromSignal(this.codex, {
          type: "location",
          locationKind: "dungeon",
          targetId: dungeon.id,
        });
        this.autoSave();
        this.restartOverworld(
          "enter Tideglass Grotto",
          dungeonUnlock.unlockedIds,
        );
        return;
      }

      if (terrain === Terrain.CityGate) {
        if (!useCityConnection(this.player)) return;
        this.revealAround();
        this.autoSave();
        this.restartOverworld("change city district");
        return;
      }

      const readable = getAdjacentCodexReadable(
        city.id,
        chunkIndex,
        this.player.position.x,
        this.player.position.y,
      );
      if (readable) {
        this.dialogueSystem.showQuestDialogue(
          readable.title,
          [...readable.text],
          () => {
            const unlock = unlockCodexFromSignal(this.codex, {
              type: "readable",
              readableId: readable.id,
            });
            this.showCraftingUnlocks(discoverCraftingRecipes(this.player, {
              type: "readable",
              readableId: readable.id,
            }));
            this.showCodexUnlocks(unlock);
            this.autoSave();
          },
        );
        return;
      }

      // NPC interaction
      const npcResult = findAdjacentNpc(
        cityMap,
        chunk.shops,
        this.player.position.x,
        this.player.position.y,
        this.cityRenderer,
      );
      if (npcResult) {
        const { npcDef, npcIndex } = npcResult;
        if (npcDef.questNpcId) {
          const interaction = getNpcQuestInteraction(
            this.player,
            npcDef.questNpcId,
          );
          if (interaction) {
            this.dialogueSystem.showQuestDialogue(
              interaction.speaker,
              interaction.pages,
              () => {
                const npcUnlock = unlockCodexFromSignal(this.codex, {
                  type: "npcDialogue",
                  npcId: npcDef.questNpcId!,
                });
                this.showCraftingUnlocks(discoverCraftingRecipes(this.player, {
                  type: "npc",
                  npcId: npcDef.questNpcId!,
                }));
                const cutsceneSnapshot = captureCutsceneTriggerSnapshot(
                  this.player,
                  this.defeatedBosses,
                );
                const result = completeNpcQuestInteraction(
                  this.player,
                  this.defeatedBosses,
                  interaction,
                );
                const recruitments = result.changed
                  ? synchronizeCompanionRecruitment(this.player)
                  : [];
                const boats = result.changed
                  ? synchronizeNauticalQuestRewards(this.player)
                  : [];
                const progressionUnlock = replayCodexUnlocks(
                  this.codex,
                  this.player,
                );
                this.showCodexUnlocks(npcUnlock, progressionUnlock);
                this.questFlow.handleResult(result);
                for (const recruitment of recruitments) {
                  this.showMessage(recruitment.message, "#88ff88");
                }
                for (const boat of boats) {
                  this.showMessage(`⛵ Acquired ${boat.id}.`, "#80cbc4");
                }
                if (recruitments.length > 0) {
                  this.companionFollowerManager.sync(
                    this.player,
                    (companion) => this.showCompanionDialogue(companion),
                  );
                }
                if (
                  this.queueNewlyTriggeredCutscenes(cutsceneSnapshot).length > 0
                ) {
                  this.startNextPendingCutscene();
                }
              },
            );
          } else {
            const idle = getQuestNpcIdleDialogue(npcDef.questNpcId);
            this.dialogueSystem.showSpecialDialogue(idle.speaker, idle.line);
            this.showCodexUnlocks(unlockCodexFromSignal(this.codex, {
              type: "npcDialogue",
              npcId: npcDef.questNpcId,
            }));
            this.showCraftingUnlocks(discoverCraftingRecipes(this.player, {
              type: "npc",
              npcId: npcDef.questNpcId,
            }));
            this.autoSave();
          }
          return;
        }
        const challenge = getNpcSkillChallenge(city.id, npcDef);
        if (challenge && !this.player.progression.skillChecks[challenge.id]) {
          this.skillCheckManager.resolveNpcSkillChallenge(
            this.player,
            challenge,
            npcDef,
            this.dialogueSystem,
          );
          return;
        }
        if (npcDef.shopIndex !== undefined) {
          const npcShopIndex = npcDef.shopIndex;
          const shop = chunk.shops[npcShopIndex];
          if (shop) {
            if (shop.type === "inn") {
              this.dialogueSystem.showNpcDialogue(this.player, npcDef, npcIndex, city, this.timeStep);
              this.time.delayedCall(300, () => {
                this.dialogueSystem.dismissDialogue();
                this.overlayManager.showInnConfirmation(this.player);
              });
              return;
            }
            if (getTimePeriod(this.timeStep) === TimePeriod.Night) {
              this.showMessage("The shop is closed for the night. Come back in the morning!", "#ff8888");
              return;
            }
            if (shop.type === "bank") {
              this.dialogueSystem.showNpcDialogue(this.player, npcDef, npcIndex, city, this.timeStep);
              this.time.delayedCall(800, () => {
                this.dialogueSystem.dismissDialogue();
                this.overlayManager.showBankOverlay(this.player);
              });
              return;
            }
            this.dialogueSystem.showNpcDialogue(this.player, npcDef, npcIndex, city, this.timeStep);
            this.sceneTransitions.startAfter(800, () => {
              this.dialogueSystem.dismissDialogue();
              this.autoSave();
              this.scene.start("ShopScene", {
                player: this.player,
                townName: `${city.name} - ${shop.name}`,
                defeatedBosses: this.defeatedBosses,
                codex: this.codex,
                shopItemIds: shop.shopItems,
                timeStep: this.timeStep,
                weatherState: this.weatherState,
                fromCity: true,
                cityId: city.id,
                savedSpecialNpcs: this.specialNpcManager.snapshotSpecialNpcs(),
                shopSkillCheckId: getCityShopSkillCheckId(
                  city.id,
                  chunkIndex,
                  shop,
                ),
              });
            }, "open city shop");
            return;
          }
        }
        this.dialogueSystem.showNpcDialogue(this.player, npcDef, npcIndex, city, this.timeStep);
        return;
      }

      const nearbyShop = getCityChunkShopNearby(
        city,
        chunkIndex,
        this.player.position.x,
        this.player.position.y,
      );
      if (nearbyShop) {
        if (
          city.id === "tidehaven_city"
          && nearbyShop.name === "Tidehaven Shipwright"
          && this.serviceTidehavenShipwright()
        ) {
          return;
        }
        this.openCityShop(city, chunk.name, nearbyShop, chunkIndex);
        return;
      }

      // Animal interaction
      const animalResult = findAdjacentAnimal(this.player.position.x, this.player.position.y, this.cityRenderer.cityAnimals);
      if (animalResult) {
        this.dialogueSystem.showAnimalDialogue(animalResult.spriteName);
        return;
      }
      if (this.startGatheringNearby()) return;
      if (this.tryInteractCompanion()) return;
      return;
    }

    // ── Overworld ──
    const chunk = getChunk(this.player.position.chunkX, this.player.position.chunkY);
    if (!chunk) return;

    if (this.dialogueSystem.isDialogueOpen()) { this.dialogueSystem.dismissDialogue(); return; }

    // Current-tile entrances and encounters take priority over adjacent visitors.
    const currentTerrain = chunk.mapData[this.player.position.y]?.[this.player.position.x];
    const tileOwnsAction = currentTerrain === Terrain.Town
      || currentTerrain === Terrain.Dungeon
      || currentTerrain === Terrain.Boss
      || currentTerrain === Terrain.Chest;
    const specialResult = tileOwnsAction
      ? undefined
      : this.specialNpcManager.findAdjacentSpecialNpc(
          this.player.position.x,
          this.player.position.y,
        );
    if (specialResult) {
      const regionName = chunk.name ?? "Overworld";
      const callbacks: SpecialNpcCallbacks = {
        autoSave: () => this.autoSave(),
        grantTrapGuidance: () => {
          if (this.player.progression.trapGuidance) return;
          this.player.progression.trapGuidance = true;
          this.showMessage(
            "Adventurer guidance learned: +2 detection, +1 disarming.",
            "#88ff88",
          );
          this.autoSave();
        },
        startShopScene: (config) => {
          this.sceneTransitions.startImmediately(() => {
            this.scene.start("ShopScene", {
              player: this.player,
              townName: config.townName,
              defeatedBosses: this.defeatedBosses,
              codex: this.codex,
              shopItemIds: config.shopItemIds,
              timeStep: this.timeStep,
              weatherState: this.weatherState,
              discount: config.discount,
              savedSpecialNpcs: config.savedSpecialNpcs,
            });
          }, "open special NPC shop");
        },
      };
      this.specialNpcManager.interactSpecialNpc(specialResult.index, this.dialogueSystem, callbacks, regionName);
      return;
    }

    // Town entry
    const town = chunk.towns.find(
      (t) => t.x === this.player.position.x && t.y === this.player.position.y,
    );
    if (town?.hasShop) {
      const city = getCityForTown(this.player.position.chunkX, this.player.position.chunkY, town.x, town.y);
      if (city) {
        const entranceBlock = getBlockedQuestEntrance(this.player, {
          type: "city",
          targetId: city.id,
          chunkX: city.chunkX,
          chunkY: city.chunkY,
          tileX: city.tileX,
          tileY: city.tileY,
        });
        if (entranceBlock) {
          this.dialogueSystem.showSpecialDialogue(
            "Road Barricade",
            entranceBlock.blockedMessage,
          );
          return;
        }
        if (!this.questFlow.confirmDanger({ type: "city", id: city.id })) {
          return;
        }
        this.player.lastTownX = town.x;
        this.player.lastTownY = town.y;
        this.player.lastTownChunkX = this.player.position.chunkX;
        this.player.lastTownChunkY = this.player.position.chunkY;
        if (this.player.mountId) this.player.mountId = "";
        this.player.position.inCity = true;
        this.player.position.cityId = city.id;
        this.player.position.cityChunkIndex = 0;
        debugPanelLog(`[CITY] Entered ${city.name}`, true);
        this.player.position.x = city.spawnX;
        this.player.position.y = city.spawnY;
        this.weatherState.current = WeatherType.Clear;
        for (let ty = 0; ty < MAP_HEIGHT; ty++) {
          for (let tx = 0; tx < MAP_WIDTH; tx++) {
            this.player.progression.exploredTiles[`c:${city.id},${tx},${ty}`] = true;
          }
        }
        if (!this.player.progression.discoveredCities.includes(city.id)) {
          this.player.progression.discoveredCities.push(city.id);
        }
        const cityUnlock = unlockCodexFromSignal(this.codex, {
          type: "location",
          locationKind: "city",
          targetId: city.id,
        });
        this.showCraftingUnlocks(discoverCraftingRecipes(this.player, {
          type: "city",
          cityId: city.id,
        }));
        this.autoSave();
        this.restartOverworld("enter city", cityUnlock.unlockedIds);
        return;
      }

      // No city layout — open shop directly (legacy)
      this.player.lastTownX = town.x;
      this.player.lastTownY = town.y;
      this.player.lastTownChunkX = this.player.position.chunkX;
      this.player.lastTownChunkY = this.player.position.chunkY;
      if (this.player.mountId) this.player.mountId = "";
      this.rerollWeather();
      this.autoSave();
      this.sceneTransitions.startImmediately(() => {
        this.scene.start("ShopScene", {
          player: this.player, townName: town.name,
          defeatedBosses: this.defeatedBosses, codex: this.codex,
          shopItemIds: town.shopItems, timeStep: this.timeStep,
          weatherState: this.weatherState,
          savedSpecialNpcs: this.specialNpcManager.snapshotSpecialNpcs(),
          shopSkillCheckId: getTownShopSkillCheckId(
            this.player.position.chunkX,
            this.player.position.chunkY,
            town.x,
            town.y,
          ),
        });
      }, "open town shop");
      return;
    }

    // Dungeon entry
    const terrain = getTerrainAt(this.player.position.chunkX, this.player.position.chunkY, this.player.position.x, this.player.position.y);
    if (terrain === Terrain.Dungeon) {
      const dungeon = getDungeonAt(this.player.position.chunkX, this.player.position.chunkY, this.player.position.x, this.player.position.y);
      if (dungeon) {
        const entranceBlock = getBlockedQuestEntrance(this.player, {
          type: "dungeon",
          targetId: dungeon.id,
          chunkX: dungeon.entranceChunkX,
          chunkY: dungeon.entranceChunkY,
          tileX: dungeon.entranceTileX,
          tileY: dungeon.entranceTileY,
        });
        if (entranceBlock) {
          this.dialogueSystem.showSpecialDialogue(
            "Road Barricade",
            entranceBlock.blockedMessage,
          );
          return;
        }
        if (!this.questFlow.confirmDanger({
          type: "dungeon",
          id: dungeon.id,
        })) {
          return;
        }
        const hasKey = this.player.inventory.some((i) => i.id === "dungeonKey");
        if (hasKey || isDebug()) {
          const cutsceneSnapshot = captureCutsceneTriggerSnapshot(
            this.player,
            this.defeatedBosses,
          );
          // Consume the dungeon key on first use
          if (hasKey) {
            const keyIdx = this.player.inventory.findIndex((i) => i.id === "dungeonKey");
            if (keyIdx >= 0) {
              this.player.inventory.splice(keyIdx, 1);
              this.showMessage("The dungeon key shatters as the seal breaks!", "#ffd700");
            }
          }
          if (this.player.mountId) this.player.mountId = "";
          this.player.position.inDungeon = true;
          this.player.position.dungeonId = dungeon.id;
          this.player.position.dungeonLevel = 0;
          debugPanelLog(`[DUNGEON] Entered ${dungeon.name}`, true);
          this.player.position.x = dungeon.spawnX;
          this.player.position.y = dungeon.spawnY;
          this.weatherState.current = WeatherType.Clear;
          if (audioEngine.initialized) audioEngine.playDungeonEnterSFX();
          const dungeonUnlock = unlockCodexFromSignal(this.codex, {
            type: "location",
            locationKind: "dungeon",
            targetId: dungeon.id,
          });
          this.autoSave();
          const queuedCutscenes = this.queueNewlyTriggeredCutscenes(
            cutsceneSnapshot,
          );
          if (queuedCutscenes.length === 0) {
            this.restartOverworld("enter dungeon", dungeonUnlock.unlockedIds);
          } else {
            this.pendingCodexDiscoveryIds = [...dungeonUnlock.unlockedIds];
            this.startNextPendingCutscene();
          }
        }
      }
      return;
    }

    // Overworld chest
    if (terrain === Terrain.Chest) {
      this.openChest({ type: "overworld", chunkX: this.player.position.chunkX, chunkY: this.player.position.chunkY });
      return;
    }

    // Boss tile
    const boss = chunk.bosses.find(
      (b) => b.x === this.player.position.x && b.y === this.player.position.y,
    );
    if (boss && !this.defeatedBosses.has(boss.monsterId)) {
      const monster = getBoss(boss.monsterId);
      if (monster) {
        this.startBattle(monster, Terrain.Boss);
        return;
      }
    }
    if (this.startGatheringNearby()) return;
    this.tryInteractCompanion();
  }

  // ── Shared chest opening logic ──────────────────────────────────────────

  private openCityShop(
    city: CityData,
    districtName: string,
    shop: CityShopData,
    chunkIndex: number,
  ): void {
    if (shop.type === "inn") {
      this.overlayManager.showInnConfirmation(this.player);
      return;
    }
    if (getTimePeriod(this.timeStep) === TimePeriod.Night) {
      this.showMessage("The shop is closed for the night. Come back in the morning!", "#ff8888");
      return;
    }
    if (shop.type === "bank") {
      this.overlayManager.showBankOverlay(this.player);
      return;
    }

    this.showCraftingUnlocks(discoverCraftingRecipes(this.player, {
      type: "shop",
      shopId: `${city.id}:${chunkIndex}:${shop.type}:${shop.x},${shop.y}`,
    }));
    this.autoSave();
    const locationName = districtName === city.name
      ? city.name
      : `${city.name} - ${districtName}`;
    this.sceneTransitions.startImmediately(() => {
      this.scene.start("ShopScene", {
        player: this.player,
        townName: `${locationName} - ${shop.name}`,
        defeatedBosses: this.defeatedBosses,
        codex: this.codex,
        shopItemIds: shop.shopItems,
        timeStep: this.timeStep,
        weatherState: this.weatherState,
        fromCity: true,
        cityId: city.id,
        savedSpecialNpcs: this.specialNpcManager.snapshotSpecialNpcs(),
        shopSkillCheckId: getCityShopSkillCheckId(
          city.id,
          chunkIndex,
          shop,
        ),
      });
    }, "open city shop");
  }

  private openChest(location: ChestLocation): void {
    const chest = getChestAt(this.player.position.x, this.player.position.y, location);
    if (!chest) return;
    if (this.player.progression.openedChests.includes(chest.id)) {
      this.showMessage("Already opened.", "#666666");
      return;
    }
    const item = getItem(chest.itemId);
    if (!item) return;

    const feedback = this.skillCheckManager.resolveChestChecks(
      this.player,
      chest,
    );

    this.player.progression.openedChests.push(chest.id);
    const rewards = [
      item,
      ...(chest.bonusItems ?? []).flatMap((bonus) => {
        const bonusItem = getItem(bonus.itemId);
        return bonusItem
          ? Array.from({ length: bonus.quantity }, () => bonusItem)
          : [];
      }),
    ];
    const itemUnlocks: CodexUnlockResult[] = [];
    for (const reward of rewards) {
      this.player.inventory.push({ ...reward });
      itemUnlocks.push(unlockCodexFromSignal(this.codex, {
        type: "itemAcquired",
        itemId: reward.id,
      }));
      this.showCraftingUnlocks(discoverCraftingRecipes(this.player, {
        type: "item",
        itemId: reward.id,
      }));
    }
    if (audioEngine.initialized) audioEngine.playChestOpenSFX();

    // Auto-equip if better
    if (item.type === "weapon" && (!this.player.equippedWeapon || item.effect > this.player.equippedWeapon.effect)) {
      this.player.equippedWeapon = item;
      if (item.twoHanded) { this.player.equippedShield = null; this.player.equippedOffHand = null; }
      if (!isLightWeapon(item)) { this.player.equippedOffHand = null; }
      this.playerRenderer.refreshPlayerSprite(this.player);
    }
    if (item.type === "armor" && (!this.player.equippedArmor || item.effect > this.player.equippedArmor.effect)) {
      this.player.equippedArmor = item;
    }
    if (item.type === "shield" && !this.player.equippedWeapon?.twoHanded && (!this.player.equippedShield || item.effect > this.player.equippedShield.effect)) {
      this.player.equippedShield = item;
      this.playerRenderer.refreshPlayerSprite(this.player);
    }

    feedback.push(`Found ${rewards.map((reward) => reward.name).join(", ")}!`);
    this.showMessage(feedback.join(" "), "#ffd700");
    this.showCodexUnlocks(...itemUnlocks);
    this.updateHUD();
    this.autoSave();
  }

  // ── Mount toggle ────────────────────────────────────────────────────────

  private toggleMount(): void {
    if (this.isOverlayOpen()) return;
    if (this.player.position.inDungeon || this.player.position.inCity) {
      this.showMessage("Cannot ride mounts here.", "#ff6666");
      return;
    }

    if (this.player.mountId) {
      const mount = getMount(this.player.mountId);
      this.player.mountId = "";
      this.createPlayerSprite();
      this.updateHUD();
      this.showMessage(`Dismounted${mount ? ` ${mount.name}` : ""}.`);
    } else {
      const ownedMounts = this.player.inventory.filter((i) => i.type === "mount" && i.mountId);
      if (ownedMounts.length === 0) {
        this.showMessage("No mount owned. Visit a stable!", "#ff6666");
        return;
      }
      let bestItem = ownedMounts[0];
      let bestSpeed = getMount(bestItem.mountId!)?.speedMultiplier ?? 0;
      for (let i = 1; i < ownedMounts.length; i++) {
        const md = getMount(ownedMounts[i].mountId!);
        if (md && md.speedMultiplier > bestSpeed) {
          bestSpeed = md.speedMultiplier;
          bestItem = ownedMounts[i];
        }
      }
      this.player.mountId = bestItem.mountId!;
      const mount = getMount(this.player.mountId);
      this.createPlayerSprite();
      this.updateHUD();
      this.showMessage(`🐴 Mounted ${mount?.name ?? "mount"}!`, "#88ff88");
    }
  }

  // ── Delegation helpers ──────────────────────────────────────────────────

  private renderMap(): void {
    this.cityRenderer.clearAll();
    this.specialNpcManager.clearAll();
    this.mapRenderer.renderMap(
      this.player,
      this.defeatedBosses,
      (x, y) => this.fogOfWar.isExplored(x, y, this.player),
      this.cityRenderer,
      this.timeStep,
    );
    this.dungeonTrapManager.render(
      this.player,
      (x, y) => this.fogOfWar.isExplored(x, y, this.player),
    );
    // Spawn special NPCs on overworld (not in city/dungeon)
    if (!this.player.position.inDungeon && !this.player.position.inCity) {
      const chunk = getChunk(this.player.position.chunkX, this.player.position.chunkY);
      if (chunk) this.spawnSpecialNpcs(chunk);
    }
    this.questFlow?.refreshMarkers();
  }

  private spawnSpecialNpcs(chunk: WorldChunk): void {
    this.specialNpcManager.spawnSpecialNpcs(
      chunk,
      this.timeStep,
      this.cityRenderer,
      (text, color) => this.showMessage(text, color),
      (x, y) => this.fogOfWar.isExplored(x, y, this.player),
    );
  }

  private applyDayNightTint(): void {
    this.mapRenderer.applyDayNightTint(this.player, this.timeStep, this.weatherState);
  }

  private createPlayerSprite(): void {
    this.playerRenderer.createPlayer(this.player);
    this.playerRenderer.refreshPlayerSprite(this.player);
    this.worldPresentation.bindPlayer(
      this.playerRenderer.playerSprite,
      this.player.appearanceId,
    );
    this.worldPresentation.bindMount(
      this.playerRenderer.mountSprite,
      this.player.mountId,
    );
    this.worldPresentation.bindBoat(
      this.playerRenderer.boatSprite,
      this.player.progression.nautical.activeBoatId ?? "",
    );
    if (this.playerRenderer.mountSprite) {
      this.worldPresentation.presentPlayerStep(
        this.playerRenderer.playerSprite.flipX ? -1 : 1,
      );
    }
  }

  private refreshPartyActors(): void {
    this.playerRenderer.refreshPlayerSprite(this.player);
    if (this.player.progression.nautical.sailing) {
      this.companionFollowerManager.clear();
      return;
    }
    this.companionFollowerManager.render(
      this.player,
      (companion) => this.showCompanionDialogue(companion),
    );
  }

  private serviceTidehavenShipwright(): boolean {
    const state = this.player.progression.nautical;
    const boat = getActiveBoatState(state);
    const kitIndex = this.player.inventory.findIndex(
      (item) => item.id === "reinforcedHullKit",
    );
    if (
      boat
      && kitIndex >= 0
      && installBoatUpgrade(state, "reinforcedHull")
    ) {
      this.player.inventory.splice(kitIndex, 1);
      this.showMessage("Installed Reinforced Hull.", "#80cbc4");
      this.autoSave();
      return true;
    }
    if (boat && boat.condition < 100) {
      const missing = 100 - boat.condition;
      const repairable = Math.min(missing, Math.floor(this.player.gold / 2));
      if (repairable <= 0) {
        this.showMessage("Hull repairs cost 2 gold per condition.", "#ffab91");
        return true;
      }
      this.player.gold -= repairable * 2;
      repairActiveBoat(state, repairable);
      this.showMessage(
        `Repaired ${repairable} hull condition for ${repairable * 2} gold.`,
        "#80cbc4",
      );
      this.autoSave();
      return true;
    }
    const charterComplete = isQuestCompleted(
      this.player.progression.quests,
      "tideglassCharter",
    );
    if (
      charterComplete
      && !state.ownedBoats.some((owned) => owned.id === "merchantSloop")
      && this.player.gold >= 900
    ) {
      const result = purchaseBoat(
        state,
        this.player,
        "merchantSloop",
        true,
      );
      if (result.purchased) {
        this.showMessage("Purchased Merchant Sloop for 900 gold.", "#80cbc4");
        this.autoSave();
        return true;
      }
    }
    return false;
  }

  private showMessage(text: string, color = "#ffd700"): void {
    this.showHUDMessage(text, color);
  }

  private revealAround(radius = 2): void {
    this.fogOfWar.revealAround(this.player.position.x, this.player.position.y, radius, this.player);
    this.player.progression.exploredTiles = this.fogOfWar.getExploredTiles();
  }

  private revealTileSprites(): void {
    this.mapRenderer.revealTileSprites(
      this.player,
      (x, y) => this.fogOfWar.isExplored(x, y, this.player),
      this.cityRenderer,
    );
    this.dungeonTrapManager.render(
      this.player,
      (x, y) => this.fogOfWar.isExplored(x, y, this.player),
    );
  }

  // ── Battle / codex / save ───────────────────────────────────────────────

  private terrainToBiome(terrain?: Terrain): string {
    if (this.player.position.inDungeon) return "dungeon";
    if (this.player.progression.nautical.sailing) return "sea";
    if (this.player.position.inCity) return "city";
    switch (terrain) {
      case Terrain.Forest: return "forest";
      case Terrain.DeepForest: return "deep_forest";
      case Terrain.Sand: case Terrain.Cactus: return "sand";
      case Terrain.Tundra: return "tundra";
      case Terrain.Swamp: case Terrain.Mushroom: return "swamp";
      case Terrain.Volcanic: case Terrain.Geyser: return "volcanic";
      case Terrain.Canyon: return "canyon";
      case Terrain.Water: case Terrain.River: return "sea";
      default: return "grass";
    }
  }

  private startBattle(
    encounterOrMonster: MonsterEncounter | Monster,
    terrain?: Terrain,
    immediate = false,
    battleHooks?: BattleResolutionHooks,
    biomeOverride?: string,
  ): void {
    if (this.sceneTransitions.isPending) return;
    const encounter = "members" in encounterOrMonster
      ? encounterOrMonster
      : createSoloEncounter(encounterOrMonster);
    const boss = encounter.members.find((member) => member.monster.isBoss)
      ?.monster;
    if (boss) {
      const queued = queueCutscenes(
        this.player.progression,
        getEventCutsceneIds({ type: "bossPre", bossId: boss.id }),
      );
      if (queued.length > 0) {
        this.autoSave();
        this.startNextPendingCutscene();
        return;
      }
    }
    this.autoSave();
    debugPanelLog(
      `[BATTLE] Fighting ${encounter.name}: `
      + encounter.members
        .map((member) => `${member.monster.name} HP:${member.monster.hp} AC:${member.monster.ac}`)
        .join(" | "),
      true,
    );
    const battleData = {
      player: this.player,
      encounter,
      defeatedBosses: this.defeatedBosses,
      codex: this.codex,
      timeStep: this.timeStep,
      weatherState: this.weatherState,
      biome: biomeOverride ?? this.terrainToBiome(terrain),
      savedSpecialNpcs: this.specialNpcManager.snapshotSpecialNpcs(),
      partyCombatants: createActivePartyCombatants(this.player.party),
      battleHooks,
    };
    if (immediate) {
      this.sceneTransitions.startImmediately(
        () => this.scene.start("BattleScene", battleData),
        "start immediate battle",
      );
      return;
    }
    const queued = this.sceneTransitions.startAfter(
      300,
      () => this.scene.start("BattleScene", battleData),
      "start battle",
    );
    if (queued && !isReducedMotionEnabled()) {
      this.cameras.main.flash(300, 255, 255, 255);
    }
  }

  private openCodex(): void {
    if (this.isMoving) return;
    if (this.sceneTransitions.isPending) return;
    this.tutorialManager.close();
    this.partyOverlayManager.close();
    this.overlayManager.destroyAll();
    this.autoSave();
    this.sceneTransitions.startImmediately(() => {
      this.scene.start("CodexScene", {
        player: this.player,
        defeatedBosses: this.defeatedBosses,
        codex: this.codex,
        timeStep: this.timeStep,
        weatherState: this.weatherState,
        savedSpecialNpcs: this.specialNpcManager.snapshotSpecialNpcs(),
      });
    }, "open codex");
  }

  private autoSave(): void {
    replayCodexUnlocks(this.codex, this.player);
    reconcileAchievements({
      player: this.player,
      defeatedBosses: this.defeatedBosses,
      codex: this.codex,
    }, {
      sourceId: "overworld:autoSave",
    });
    saveGame(this.player, this.defeatedBosses, this.codex, this.player.appearanceId, this.timeStep, this.weatherState);
  }

  private startGatheringNearby(): boolean {
    return this.gatheringManager.startNearby(
      this.player,
      this.codex,
      this.timeStep,
      this.weatherState.current,
      isReducedMotionEnabled(),
    );
  }

  private openGatheringStatus(): void {
    if (this.sceneTransitions.isPending || this.isMoving) return;
    this.autoSave();
    this.gatheringManager.openStatus(this.player);
  }

  private openAchievements(): void {
    if (this.sceneTransitions.isPending || this.isMoving) return;
    this.autoSave();
    this.achievementOverlayManager.open({
      player: this.player,
      defeatedBosses: this.defeatedBosses,
      codex: this.codex,
    });
  }

  // ── Time, weather & audio ───────────────────────────────────────────────

  private advanceTime(): void {
    tickGatheringCooldowns(this.player);
    if (this.player.position.inCity || this.player.position.inDungeon) return;

    const oldPeriod = getTimePeriod(this.timeStep);
    this.timeStep = (this.timeStep + 1) % CYCLE_LENGTH;
    const newPeriod = getTimePeriod(this.timeStep);

    const biomeName = getChunk(this.player.position.chunkX, this.player.position.chunkY)?.name ?? "Heartlands";
    const weatherChanged = advanceWeather(this.weatherState, biomeName, this.timeStep);

    if (oldPeriod !== newPeriod || weatherChanged) {
      this.applyDayNightTint();
      if (weatherChanged) this.mapRenderer.updateWeatherParticles(this.weatherState);
      this.updateAudio();
    }
  }

  private rerollWeather(): void {
    const biomeName = getChunk(this.player.position.chunkX, this.player.position.chunkY)?.name ?? "Heartlands";
    const weatherChanged = changeZoneWeather(this.weatherState, biomeName, this.timeStep);
    if (weatherChanged) {
      this.applyDayNightTint();
      this.mapRenderer.updateWeatherParticles(this.weatherState);
      this.updateAudio();
    }
  }

  private updateAudio(): void {
    if (!audioEngine.initialized) return;
    const chunk = getChunk(this.player.position.chunkX, this.player.position.chunkY);
    const biomeName = chunk?.name ?? "Heartlands";
    const period = getTimePeriod(this.timeStep);
    if (this.player.progression.nautical.sailing) {
      audioEngine.playSailingMusic(period);
    } else {
      audioEngine.playBiomeMusic(biomeName, period);
    }
    audioEngine.playWeatherSFX(this.weatherState.current);
  }
}
