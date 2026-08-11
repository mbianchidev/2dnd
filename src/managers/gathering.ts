import * as Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, debugPanelLog } from "../config";
import {
  GATHERING_DEFINITIONS,
  GATHERING_DISCIPLINES,
  getGatheringOutcome,
  getGatheringResource,
  type GatheringDiscipline,
} from "../data/gathering";
import { getItem } from "../data/items";
import { Terrain } from "../data/mapTypes";
import { createSoloEncounter, type MonsterEncounter } from "../data/monsterGroups";
import { getMonster } from "../data/monsters";
import {
  applyGatheringAction,
  claimGatheringReward,
  findGatheringNodes,
  getAvailableGatheringNode,
  getGatheringScore,
  getGatheringStatusLines,
  isGatheringGameComplete,
  resetGatheringState,
  movePlayerNearGatheringNode,
  resolveGatheringGame,
  startGathering,
  type GatheringAction,
  type GatheringDirection,
  type GatheringNode,
  type PendingGathering,
} from "../systems/gathering";
import { getGatheringDiscoveryDisciplines } from "../systems/featureDiscovery";
import { GATHERING_DISCIPLINE_FEATURES } from "../data/featureDiscovery";
import { revealFeature } from "../systems/featureDiscovery";
import { audioEngine } from "../systems/audio";
import type { CodexData, CodexUnlockResult } from "../systems/codex";
import { unlockCodexFromSignal } from "../systems/codex";
import type { BattleResolutionHooks } from "../systems/groupCombat";
import type { PlayerState } from "../systems/player";
import type { WeatherType } from "../systems/weather";
import { discoverCraftingRecipes } from "../systems/crafting";
import { reconcileCraftingRecipes } from "../systems/crafting";
import type { CraftingRecipeId } from "../data/crafting";
import { createOverlayContainer } from "../utils/ui";

export interface GatheringManagerCallbacks {
  autoSave(): void;
  updateHUD(): void;
  updateLocation(): void;
  showMessage(message: string, color?: string): void;
  showCodexUnlocks(result: CodexUnlockResult): void;
  showCraftingUnlocks(recipeIds: readonly CraftingRecipeId[]): void;
  suppressDebugAchievements(): void;
  startBattle(
    encounter: MonsterEncounter,
    terrain: Terrain,
    hooks: BattleResolutionHooks,
    immediate: boolean,
  ): void;
}

interface GatheringKeys {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  w: Phaser.Input.Keyboard.Key;
  a: Phaser.Input.Keyboard.Key;
  s: Phaser.Input.Keyboard.Key;
  d: Phaser.Input.Keyboard.Key;
  enter: Phaser.Input.Keyboard.Key;
  space: Phaser.Input.Keyboard.Key;
  escape: Phaser.Input.Keyboard.Key;
}

const DIRECTION_SYMBOLS: Readonly<Record<GatheringDirection, string>> = {
  up: "UP",
  right: "RIGHT",
  down: "DOWN",
  left: "LEFT",
};

export class GatheringManager {
  private container: Phaser.GameObjects.Container | null = null;
  private player: PlayerState | null = null;
  private codex: CodexData | null = null;
  private timeStep = 0;
  private weather: WeatherType | null = null;
  private keys: GatheringKeys | null = null;
  private tickTimer: Phaser.Time.TimerEvent | null = null;
  private statusIndex = 0;
  private mode: "game" | "status" | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly callbacks: GatheringManagerCallbacks,
  ) {}

  private ensureKeys(): GatheringKeys {
    if (this.keys) return this.keys;
    const keyboard = this.scene.input.keyboard;
    if (!keyboard) throw new Error("Gathering requires keyboard input.");
    this.keys = {
      up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      w: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      s: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      d: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      enter: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
      space: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      escape: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
    };
    return this.keys;
  }

  isOpen(): boolean {
    return this.container !== null;
  }

  isGameOpen(): boolean {
    return this.mode === "game" && this.container !== null;
  }

  getDebugState(): string {
    const pending = this.player?.progression.gathering.pending;
    if (this.mode === "status") {
      return ` [GATHERING_STATUS:${this.statusIndex + 1}]`;
    }
    if (!pending || this.mode !== "game") return "";
    return ` [GATHERING:${pending.discipline}] [GATHERING_PHASE:${pending.game.phase}]`
      + ` [GATHERING_SCORE:${getGatheringScore(pending.game)}]`
      + ` [GATHERING_OUTCOME:${pending.outcomeId}]`;
  }

  getPrompt(player: PlayerState): string | undefined {
    const available = getAvailableGatheringNode(player);
    if (available.node) {
      return `[SPACE] ${GATHERING_DEFINITIONS[available.node.discipline].prompt}`;
    }

    if (available.cooldown && available.remainingSteps) {
      return `${GATHERING_DEFINITIONS[available.cooldown.discipline].name} node recovers in ${available.remainingSteps} steps`;
    }
    return undefined;
  }

  discoverNearby(player: PlayerState): boolean {
    const available = getAvailableGatheringNode(player);
    const discipline = available.node?.discipline ?? available.cooldown?.discipline;
    if (!discipline) return false;
    const disciplineChanged = revealFeature(
      player,
      GATHERING_DISCIPLINE_FEATURES[discipline],
    );
    const gatheringChanged = revealFeature(player, "gathering");
    return disciplineChanged || gatheringChanged;
  }

  startNearby(
    player: PlayerState,
    codex: CodexData,
    timeStep: number,
    weather: WeatherType,
    reducedMotion: boolean,
  ): boolean {
    const available = getAvailableGatheringNode(player);
    if (!available.node) {
      if (available.cooldown) {
        this.callbacks.showMessage(
          `${GATHERING_DEFINITIONS[available.cooldown.discipline].name} node recovers in ${available.remainingSteps ?? 0} steps.`,
          "#ffcc80",
        );
        return true;
      }
      return false;
    }
    this.player = player;
    this.codex = codex;
    this.timeStep = timeStep;
    this.weather = weather;
    startGathering(player, available.node, {
      timeStep,
      weather,
      reducedMotion,
      sea: player.progression.nautical.sailing,
    });
    this.callbacks.autoSave();
    audioEngine.playGatheringStartSFX(available.node.discipline);
    this.openGame();
    return true;
  }

  resumePending(
    player: PlayerState,
    codex: CodexData,
    timeStep: number,
    weather: WeatherType,
  ): boolean {
    const pending = player.progression.gathering.pending;
    if (!pending) return false;
    this.player = player;
    this.codex = codex;
    this.timeStep = timeStep;
    this.weather = weather;
    if (pending.phase === "battle") {
      this.startPendingBattle();
    } else {
      this.openGame();
    }
    return true;
  }

  openStatus(player: PlayerState): void {
    this.player = player;
    this.statusIndex = 0;
    this.mode = "status";
    this.renderStatus();
  }

  update(): boolean {
    if (!this.container) return false;
    const keys = this.ensureKeys();
    if (this.mode === "status") {
      if (
        Phaser.Input.Keyboard.JustDown(keys.up)
        || Phaser.Input.Keyboard.JustDown(keys.w)
        || Phaser.Input.Keyboard.JustDown(keys.left)
        || Phaser.Input.Keyboard.JustDown(keys.a)
      ) {
        this.moveStatus(-1);
      } else if (
        Phaser.Input.Keyboard.JustDown(keys.down)
        || Phaser.Input.Keyboard.JustDown(keys.s)
        || Phaser.Input.Keyboard.JustDown(keys.right)
        || Phaser.Input.Keyboard.JustDown(keys.d)
      ) {
        this.moveStatus(1);
      } else if (
        Phaser.Input.Keyboard.JustDown(keys.escape)
        || Phaser.Input.Keyboard.JustDown(keys.space)
        || Phaser.Input.Keyboard.JustDown(keys.enter)
      ) {
        this.close();
      }
      return true;
    }

    if (Phaser.Input.Keyboard.JustDown(keys.escape)) {
      this.cancelAttempt();
      return true;
    }
    const direction = this.readDirection(keys);
    if (direction) {
      this.act({ type: "direction", direction });
    } else if (
      Phaser.Input.Keyboard.JustDown(keys.enter)
      || Phaser.Input.Keyboard.JustDown(keys.space)
    ) {
      this.act({ type: "confirm" });
    }
    return true;
  }

  listNodes(player: PlayerState): readonly string[] {
    return findGatheringNodes(player).map((node) => {
      const cooldown =
        player.progression.gathering.nodeStates[node.id]?.cooldownRemaining ?? 0;
      return `${node.id} ${Terrain[node.location.terrain]} cooldown=${cooldown}`;
    });
  }

  trigger(
    player: PlayerState,
    codex: CodexData,
    discipline: string,
    timeStep: number,
    weather: WeatherType,
    reducedMotion: boolean,
  ): string {
    const node = findGatheringNodes(player).find(
      (candidate) => candidate.discipline === discipline,
    );
    if (!node) return `No reachable ${discipline} node at the current position.`;
    player.progression.gathering.nodeStates[node.id] = {
      attempts: 0,
      cooldownRemaining: 0,
    };
    this.player = player;
    this.codex = codex;
    this.timeStep = timeStep;
    this.weather = weather;
    startGathering(player, node, {
      timeStep,
      weather,
      reducedMotion,
      sea: player.progression.nautical.sailing,
    });
    this.callbacks.autoSave();
    this.openGame();
    return `Triggered ${discipline} at ${node.id}.`;
  }

  near(player: PlayerState, discipline: string): string {
    if (!GATHERING_DISCIPLINES.includes(discipline as GatheringDiscipline)) {
      return "Unknown gathering discipline.";
    }
    const node = movePlayerNearGatheringNode(
      player,
      discipline as GatheringDiscipline,
    );
    if (!node) return `No safe ${discipline} approach exists in this map.`;
    this.callbacks.autoSave();
    this.callbacks.updateLocation();
    return `Moved near ${discipline} node ${node.id}.`;
  }

  resolveDebug(success: boolean): string {
    const player = this.player;
    const pending = player?.progression.gathering.pending;
    if (!player || !pending) return "No gathering activity is pending.";
    pending.debug = true;
    pending.game.score = success ? 100 : 0;
    pending.game.phase = "complete";
    if (pending.game.kind === "fishing") pending.game.failed = !success;
    this.resolveCompleted();
    return success ? "Gathering resolved as success." : "Gathering resolved as failure.";
  }

  reset(player: PlayerState, seed?: number): void {
    this.close();
    resetGatheringState(player, seed);
    this.callbacks.autoSave();
    this.callbacks.updateLocation();
  }

  status(player: PlayerState): readonly string[] {
    return getGatheringStatusLines(player);
  }

  close(): void {
    this.tickTimer?.remove();
    this.tickTimer = null;
    this.container?.destroy(true);
    this.container = null;
    this.mode = null;
  }

  clear(): void {
    this.close();
    this.player = null;
    this.codex = null;
    this.weather = null;
  }

  private openGame(): void {
    this.mode = "game";
    this.renderGame();
    this.scheduleTick();
  }

  private scheduleTick(): void {
    this.tickTimer?.remove();
    this.tickTimer = null;
    const pending = this.player?.progression.gathering.pending;
    if (!pending || pending.reducedMotion || pending.phase !== "playing") return;
    const timedPhase = (
      pending.game.kind === "fishing"
      && (pending.game.phase === "waiting" || pending.game.phase === "bite")
    ) || (
      pending.game.kind === "foraging"
      && pending.game.phase === "reveal"
    );
    if (!timedPhase) return;
    this.tickTimer = this.scene.time.delayedCall(650, () => {
      this.tickTimer = null;
      this.act({ type: "tick" });
    });
  }

  private readDirection(keys: GatheringKeys): GatheringDirection | undefined {
    if (
      Phaser.Input.Keyboard.JustDown(keys.up)
      || Phaser.Input.Keyboard.JustDown(keys.w)
    ) return "up";
    if (
      Phaser.Input.Keyboard.JustDown(keys.right)
      || Phaser.Input.Keyboard.JustDown(keys.d)
    ) return "right";
    if (
      Phaser.Input.Keyboard.JustDown(keys.down)
      || Phaser.Input.Keyboard.JustDown(keys.s)
    ) return "down";
    if (
      Phaser.Input.Keyboard.JustDown(keys.left)
      || Phaser.Input.Keyboard.JustDown(keys.a)
    ) return "left";
    return undefined;
  }

  private act(action: GatheringAction): void {
    const player = this.player;
    const pending = player?.progression.gathering.pending;
    if (!player || !pending || pending.phase !== "playing") return;
    applyGatheringAction(pending, action);
    audioEngine.playGatheringActionSFX(
      pending.discipline,
      action.type === "direction" ? action.direction : action.type,
    );
    this.callbacks.autoSave();
    if (isGatheringGameComplete(pending.game)) {
      this.resolveCompleted();
      return;
    }
    this.renderGame();
    this.scheduleTick();
  }

  private resolveCompleted(): void {
    const player = this.player;
    if (!player) return;
    const pending = player.progression.gathering.pending;
    const debug = pending?.debug === true;
    const resolution = resolveGatheringGame(player);
    this.close();
    if (!resolution.resolved) return;
    if (resolution.battle) {
      audioEngine.playGatheringResultSFX(false, resolution.rarity);
      this.callbacks.showMessage(resolution.message, "#ffb74d");
      const codex = this.codex;
      this.callbacks.autoSave();
      this.callbacks.startBattle(
        resolution.battle,
        player.progression.gathering.pending!.location.terrain,
        {
          onBattleResolved: (result) => {
            const reward = claimGatheringReward(
              player,
              result.outcome === "victory",
            );
            if (reward.success && reward.itemId) {
              discoverCraftingRecipes(player, {
                type: "item",
                itemId: reward.itemId,
              });
              if (codex) {
                this.callbacks.showCraftingUnlocks(
                  reconcileCraftingRecipes(player, codex),
                );
              }
            }
            const codexUnlocks = reward.success
              ? this.unlockRewardCodex(reward.itemId, codex)
              : { unlockedIds: [], entries: [] };
            if (debug) this.callbacks.suppressDebugAchievements();
            this.callbacks.autoSave();
            return {
              messages: [reward.message],
              codexEntries: codexUnlocks.entries,
            };
          },
        },
        true,
      );
      return;
    }
    audioEngine.playGatheringResultSFX(resolution.success, resolution.rarity);
    if (resolution.success) {
      if (resolution.itemId) {
        discoverCraftingRecipes(player, {
          type: "item",
          itemId: resolution.itemId,
        });
      }
      if (this.codex) {
        this.callbacks.showCraftingUnlocks(
          reconcileCraftingRecipes(player, this.codex),
        );
      }
      this.callbacks.showCodexUnlocks(this.unlockRewardCodex(resolution.itemId));
    }
    if (debug) this.callbacks.suppressDebugAchievements();
    this.callbacks.showMessage(
      resolution.message,
      resolution.success ? "#8cffb0" : "#ff8a80",
    );
    debugPanelLog(
      `[GATHER] ${resolution.success ? "success" : "failure"} score=${resolution.score}`
        + (resolution.resourceId ? ` resource=${resolution.resourceId}` : ""),
      true,
    );
    this.callbacks.autoSave();
    this.callbacks.updateHUD();
    this.callbacks.updateLocation();
  }

  private unlockRewardCodex(
    itemId: string | undefined,
    codex: CodexData | null = this.codex,
  ): CodexUnlockResult {
    if (!itemId || !codex) return { unlockedIds: [], entries: [] };
    return unlockCodexFromSignal(codex, {
      type: "itemAcquired",
      itemId,
    });
  }

  private startPendingBattle(): void {
    const player = this.player;
    const pending = player?.progression.gathering.pending;
    if (!player || !pending || pending.phase !== "battle") return;
    const outcome = getGatheringResource(pending.resourceId);
    const item = outcome ? getItem(outcome.itemId) : undefined;
    this.callbacks.showMessage(
      item ? `${item.name} is guarded by a special creature!` : "A special creature appears!",
      "#ffb74d",
    );
    const monsterId = getGatheringOutcome(pending.outcomeId)?.battleMonsterId;
    if (!monsterId) {
      throw new Error(`[gathering] Pending outcome ${pending.outcomeId} has no battle`);
    }
    const monster = getMonster(monsterId);
    if (!monster) throw new Error(`[gathering] Missing pending monster ${monsterId}`);
    const encounter = createSoloEncounter(monster);
    const codex = this.codex;
    const debug = pending.debug;
    this.callbacks.startBattle(
      {
        ...encounter,
        id: `gathering:${pending.instanceId}`,
        name: `Gathering: ${encounter.name}`,
      },
      pending.location.terrain,
      {
        onBattleResolved: (result) => {
          const reward = claimGatheringReward(player, result.outcome === "victory");
          if (reward.success && reward.itemId) {
            discoverCraftingRecipes(player, {
              type: "item",
              itemId: reward.itemId,
            });
            if (codex) {
              this.callbacks.showCraftingUnlocks(
                reconcileCraftingRecipes(player, codex),
              );
            }
          }
          const codexUnlocks = reward.success
            ? this.unlockRewardCodex(reward.itemId, codex)
            : { unlockedIds: [], entries: [] };
          if (debug) this.callbacks.suppressDebugAchievements();
          this.callbacks.autoSave();
          return { messages: [reward.message], codexEntries: codexUnlocks.entries };
        },
      },
      true,
    );
  }

  private cancelAttempt(): void {
    const pending = this.player?.progression.gathering.pending;
    if (!pending) {
      this.close();
      return;
    }
    pending.game.score = 0;
    pending.game.phase = "complete";
    if (pending.game.kind === "fishing") pending.game.failed = true;
    this.resolveCompleted();
  }

  private renderGame(): void {
    this.container?.destroy(true);
    const pending = this.player?.progression.gathering.pending;
    if (!pending || pending.phase !== "playing") return;
    const container = this.createPanel(
      GATHERING_DEFINITIONS[pending.discipline].name,
      this.gameInstructions(pending),
    );
    const y = 174;
    if (pending.game.kind === "fishing") {
      const status = pending.game.phase === "waiting"
        ? "Listen for the bite..."
        : pending.game.phase === "bite"
          ? "BITE! Confirm now!"
          : `Balance tension: ${DIRECTION_SYMBOLS[pending.game.tensionPattern[pending.game.patternIndex] ?? "up"]}`;
      container.add(this.centerText(status, y, "#82d9ff", 20));
    } else if (pending.game.kind === "mining") {
      const target = pending.game.pattern[pending.game.patternIndex] ?? "up";
      container.add(this.centerText(
        `Vein mark: ${DIRECTION_SYMBOLS[target]}`,
        y,
        "#ffd180",
        20,
      ));
      container.add(this.centerText(
        `Selected strike: ${DIRECTION_SYMBOLS[pending.game.selected]}`,
        y + 34,
        "#ffffff",
        16,
      ));
    } else {
      const cue = pending.game.pattern[Math.min(
        pending.game.revealIndex,
        pending.game.pattern.length - 1,
      )] ?? "up";
      const status = pending.game.phase === "reveal"
        ? `Remember: ${DIRECTION_SYMBOLS[cue]}`
        : "Repeat the hidden trail";
      container.add(this.centerText(status, y, "#b9f6ca", 20));
    }
    container.add(this.centerText(
      `Score ${getGatheringScore(pending.game)} | ${pending.reducedMotion ? "step-based timing" : "live timing"}`,
      278,
      "#ffffff",
      14,
    ));
    this.addDirectionButtons(container, pending);
    this.container = container;
  }

  private gameInstructions(pending: PendingGathering): string {
    if (pending.game.kind === "fishing") {
      return pending.reducedMotion
        ? "Confirm advances the wait. Confirm the visible bite, then follow tension directions."
        : "Confirm during the bite window, then follow tension directions.";
    }
    if (pending.game.kind === "mining") {
      return "Choose the matching direction, then confirm each precision strike.";
    }
    return pending.reducedMotion
      ? "Confirm each shown clue, then repeat the direction sequence."
      : "Memorize each shown clue, then repeat the hidden sequence.";
  }

  private createPanel(title: string, subtitle: string): Phaser.GameObjects.Container {
    const panelWidth = 560;
    const panelHeight = 410;
    const panelX = (GAME_WIDTH - panelWidth) / 2;
    const panelY = (GAME_HEIGHT - panelHeight) / 2;
    const container = createOverlayContainer(
      this.scene,
      "gathering",
      105,
      {
        x: panelX,
        y: panelY,
        width: panelWidth,
        height: panelHeight,
      },
    );
    const backdrop = this.scene.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x000000,
      0.84,
    ).setInteractive();
    const panel = this.scene.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      panelWidth,
      panelHeight,
      0x101820,
      0.99,
    ).setStrokeStyle(3, 0x80cbc4);
    container.add([backdrop, panel]);
    container.add(this.centerText(title, 82, "#ffffff", 24));
    container.add(this.centerText(subtitle, 118, "#d5e8ef", 13, 500));
    return container;
  }

  private centerText(
    text: string,
    y: number,
    color: string,
    fontSize: number,
    wrap = 520,
  ): Phaser.GameObjects.Text {
    return this.scene.add.text(GAME_WIDTH / 2, y, text, {
      fontFamily: "monospace",
      fontSize: `${fontSize}px`,
      color,
      align: "center",
      wordWrap: { width: wrap },
    }).setOrigin(0.5);
  }

  private addDirectionButtons(
    container: Phaser.GameObjects.Container,
    pending: PendingGathering,
  ): void {
    const directions: readonly GatheringDirection[] = ["up", "left", "down", "right"];
    directions.forEach((direction, index) => {
      const x = 194 + index * 84;
      const button = this.scene.add.text(x, 342, DIRECTION_SYMBOLS[direction], {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#ffffff",
        backgroundColor: "#27434d",
        padding: { x: 10, y: 8 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      button.on("pointerdown", () => this.act({ type: "direction", direction }));
      container.add(button);
    });
    const confirmLabel = pending.reducedMotion
      && (
        pending.game.kind === "fishing"
        && pending.game.phase === "waiting"
        || pending.game.kind === "foraging"
        && pending.game.phase === "reveal"
      )
      ? "STEP"
      : "CONFIRM";
    const confirm = this.scene.add.text(GAME_WIDTH / 2, 395, confirmLabel, {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#102018",
      backgroundColor: "#80cbc4",
      padding: { x: 18, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    confirm.on("pointerdown", () => this.act({ type: "confirm" }));
    container.add(confirm);
  }

  private renderStatus(): void {
    this.container?.destroy(true);
    const player = this.player;
    if (!player) return;
    const container = this.createPanel(
      "Gathering Record",
      "Totals, discovered materials, and nearby recovery hints. Rare entries remain hidden until found.",
    );
    const visibleDisciplines = getGatheringDiscoveryDisciplines(player);
    const lines = getGatheringStatusLines(player, visibleDisciplines);
    container.add(this.scene.add.text(70, 145, lines.join("\n"), {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#e0f2f1",
      lineSpacing: 8,
    }));
    const discovered = player.progression.gathering.discoveredResourceIds;
    const selectedId = discovered[this.statusIndex];
    const resource = selectedId ? getGatheringResource(selectedId) : undefined;
    const item = resource ? getItem(resource.itemId) : undefined;
    const detail = resource && item
      ? `${item.name} [${resource.rarity.toUpperCase()}]\n${item.description}\n`
        + `Recipe input: ${resource.recipeInput.materialId}\n`
        + `Categories: ${resource.recipeInput.categories.join(", ")} | Tier ${resource.recipeInput.tier}\n`
        + `Tags: ${resource.recipeInput.tags.join(", ")}`
      : "No materials discovered yet.";
    container.add(this.scene.add.text(70, 270, detail, {
      fontFamily: "monospace",
      fontSize: "13px",
      color: "#ffffff",
      wordWrap: { width: 500 },
      lineSpacing: 5,
    }));
    const nearby = getAvailableGatheringNode(player);
    const hint = nearby.node
      ? `Nearby: ${GATHERING_DEFINITIONS[nearby.node.discipline].name} node ready`
      : nearby.cooldown
        ? `Nearby: ${GATHERING_DEFINITIONS[nearby.cooldown.discipline].name} recovers in ${nearby.remainingSteps ?? 0} steps`
        : "Nearby: no gathering node";
    container.add(this.centerText(
      hint,
      414,
      "#80cbc4",
      12,
    ));
    const previous = this.scene.add.text(190, 462, "PREVIOUS", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#ffffff",
      backgroundColor: "#27434d",
      padding: { x: 10, y: 7 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    previous.on("pointerdown", () => this.moveStatus(-1));
    const close = this.scene.add.text(320, 462, "CLOSE", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#102018",
      backgroundColor: "#80cbc4",
      padding: { x: 12, y: 7 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    close.on("pointerdown", () => this.close());
    const next = this.scene.add.text(450, 462, "NEXT", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#ffffff",
      backgroundColor: "#27434d",
      padding: { x: 10, y: 7 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    next.on("pointerdown", () => this.moveStatus(1));
    container.add([previous, close, next]);
    this.container = container;
  }

  private moveStatus(delta: number): void {
    const count = this.player?.progression.gathering.discoveredResourceIds.length ?? 0;
    if (count === 0) return;
    this.statusIndex = (this.statusIndex + delta + count) % count;
    this.renderStatus();
  }
}
