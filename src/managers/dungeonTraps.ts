import * as Phaser from "phaser";
import { debugLog, debugPanelLog } from "../config";
import { getDungeon } from "../data/map";
import {
  getTrapDefinition,
  type DungeonTrap,
} from "../data/traps";
import { audioEngine } from "../systems/audio";
import type { PlayerState } from "../systems/player";
import {
  attemptTrapDetection,
  attemptTrapDisarm,
  generateDungeonTraps,
  getDungeonTrapAt,
  getNearbyDungeonTraps,
  getTrapDropDestination,
  getTrapEntryDisposition,
  selectActionableTrap,
  triggerDungeonTrap,
} from "../systems/traps";
import { TrapRenderer } from "../renderers/traps";

export interface DungeonTrapCallbacks {
  showMessage: (text: string, color?: string) => void;
  autoSave: () => void;
  updateHUD: () => void;
  setMovementLocked: (locked: boolean) => void;
  startAlarmEncounter: () => void;
  restartDungeon: () => void;
}

export class DungeonTrapManager {
  private readonly scene: Phaser.Scene;
  private readonly callbacks: DungeonTrapCallbacks;
  private readonly renderer: TrapRenderer;
  private traps: DungeonTrap[] = [];
  private layoutKey = "";
  private focusedTrapId: string | null = null;
  private isExplored: (x: number, y: number) => boolean = () => false;

  constructor(scene: Phaser.Scene, callbacks: DungeonTrapCallbacks) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.renderer = new TrapRenderer(scene);
  }

  clear(): void {
    this.renderer.clear();
    this.traps = [];
    this.layoutKey = "";
    this.focusedTrapId = null;
  }

  render(
    player: PlayerState,
    isExplored: (x: number, y: number) => boolean,
  ): void {
    this.isExplored = isExplored;
    this.refreshLayout(player);
    this.renderer.render(player, this.traps, this.isExplored);
  }

  scanNearby(player: PlayerState): void {
    if (!player.position.inDungeon) return;
    this.refreshLayout(player);
    const nearby = getNearbyDungeonTraps(
      this.traps,
      player.position.x,
      player.position.y,
      1,
    ).sort((left, right) => left.id.localeCompare(right.id));
    const detected: DungeonTrap[] = [];
    let stateChanged = false;

    for (const trap of nearby) {
      if (player.progression.trapStates[trap.id] !== undefined) continue;
      const result = attemptTrapDetection(player, trap);
      if (!result.attempted) continue;
      stateChanged = true;
      debugLog("[traps] Detection check", {
        trap: trap.id,
        roll: result.roll,
        modifier: result.modifier,
        total: result.total,
        dc: result.dc,
        success: result.success,
        automatic: result.automatic,
      });
      if (result.success) detected.push(trap);
    }

    if (!stateChanged) return;
    this.renderCurrent(player);
    this.callbacks.autoSave();
    if (detected.length > 0) {
      const trap = detected[0];
      const definition = getTrapDefinition(trap.type);
      this.renderer.animateDetection(trap);
      this.callbacks.showMessage(
        `${definition.name} detected! ${definition.cue}`,
        "#ffdd66",
      );
      debugPanelLog(`[TRAP] Detected ${definition.name}`, true);
    }
  }

  blocksMoveTo(player: PlayerState, x: number, y: number): boolean {
    if (!player.position.inDungeon) return false;
    this.refreshLayout(player);
    const trap = getDungeonTrapAt(this.traps, x, y);
    if (!trap) return false;

    let state = player.progression.trapStates[trap.id];
    if (state === undefined) {
      const result = attemptTrapDetection(player, trap);
      state = player.progression.trapStates[trap.id];
      this.renderCurrent(player);
      this.callbacks.autoSave();
      debugLog("[traps] Entry detection check", {
        trap: trap.id,
        roll: result.roll,
        modifier: result.modifier,
        total: result.total,
        dc: result.dc,
        success: result.success,
        automatic: result.automatic,
      });
      if (result.success) {
        const definition = getTrapDefinition(trap.type);
        this.renderer.animateDetection(trap);
        this.callbacks.showMessage(
          `${definition.name} detected! Press Space to disarm.`,
          "#ffdd66",
        );
        debugPanelLog(`[TRAP] Detected ${definition.name}`, true);
      }
    }

    if (getTrapEntryDisposition(state) !== "blocked") return false;
    this.focusedTrapId = trap.id;
    const definition = getTrapDefinition(trap.type);
    this.renderer.animateDetection(trap);
    this.callbacks.showMessage(
      `${definition.name} blocks the path. Press Space to disarm.`,
      "#ffdd66",
    );
    return true;
  }

  handleArrival(player: PlayerState): boolean {
    if (!player.position.inDungeon) return false;
    this.refreshLayout(player);
    const trap = getDungeonTrapAt(
      this.traps,
      player.position.x,
      player.position.y,
    );
    if (!trap) return false;
    const disposition = getTrapEntryDisposition(
      player.progression.trapStates[trap.id],
    );
    if (disposition !== "trigger") return false;
    return this.triggerTrap(player, trap, true);
  }

  handleAction(player: PlayerState): boolean {
    const trap = this.getActionableTrap(player);
    if (!trap) return false;

    this.callbacks.setMovementLocked(true);
    const result = attemptTrapDisarm(player, trap);
    const definition = getTrapDefinition(trap.type);
    if (result.success) {
      this.focusedTrapId = null;
      this.renderCurrent(player);
      this.renderer.animateDisarm(trap);
      this.callbacks.updateHUD();
      this.callbacks.autoSave();
      this.callbacks.showMessage(
        `${definition.name} disarmed! +${result.rewardXp} XP`,
        "#88ff88",
      );
      debugPanelLog(`[TRAP] Disarmed ${definition.name}`, true);
      this.scene.time.delayedCall(350, () => {
        this.callbacks.setMovementLocked(false);
      });
      return true;
    }

    this.callbacks.showMessage(
      `Disarm failed (${result.total} vs DC ${result.dc})!`,
      "#ff6666",
    );
    debugPanelLog(`[TRAP] Failed to disarm ${definition.name}`, true);
    return this.triggerTrap(
      player,
      trap,
      trap.x === player.position.x && trap.y === player.position.y,
    );
  }

  getActionPrompt(player: PlayerState): string | null {
    const trap = this.getActionableTrap(player);
    if (!trap) return null;
    return `${getTrapDefinition(trap.type).name} detected  [SPACE] Disarm`;
  }

  private refreshLayout(player: PlayerState): void {
    if (!player.position.inDungeon) {
      this.clear();
      return;
    }
    const key = [
      player.position.dungeonId,
      player.position.dungeonLevel,
      player.progression.trapSeed,
    ].join(":");
    if (key === this.layoutKey) return;
    const dungeon = getDungeon(player.position.dungeonId);
    if (!dungeon) {
      this.clear();
      return;
    }
    this.layoutKey = key;
    this.focusedTrapId = null;
    this.traps = generateDungeonTraps(
      dungeon,
      player.position.dungeonLevel,
      player.progression.trapSeed,
    );
  }

  private renderCurrent(player: PlayerState): void {
    this.renderer.render(player, this.traps, this.isExplored);
  }

  private getActionableTrap(player: PlayerState): DungeonTrap | undefined {
    if (!player.position.inDungeon) return undefined;
    this.refreshLayout(player);
    const trap = selectActionableTrap(
      this.traps,
      player.progression.trapStates,
      player.position.x,
      player.position.y,
      this.focusedTrapId,
    );
    if (!trap) this.focusedTrapId = null;
    return trap;
  }

  private triggerTrap(
    player: PlayerState,
    trap: DungeonTrap,
    allowLevelDrop: boolean,
  ): boolean {
    const result = triggerDungeonTrap(player, trap);
    if (!result.triggered) {
      this.callbacks.setMovementLocked(false);
      return false;
    }

    this.focusedTrapId = null;
    this.callbacks.setMovementLocked(true);
    this.renderCurrent(player);
    this.renderer.animateTrigger(trap);
    if (audioEngine.initialized) audioEngine.playTrapSFX(trap.type);
    this.scene.cameras.main.shake(260, 0.012);
    this.callbacks.updateHUD();
    this.callbacks.showMessage(result.message, "#ff6666");
    debugPanelLog(
      `[TRAP] ${getTrapDefinition(trap.type).name} triggered`,
      true,
    );

    const destination = allowLevelDrop && result.dropsLevel
      ? getTrapDropDestination(player)
      : null;
    if (result.startsEncounter) {
      this.callbacks.startAlarmEncounter();
      return true;
    }

    if (destination) {
      player.position.dungeonLevel = destination.level;
      player.position.x = destination.x;
      player.position.y = destination.y;
      this.callbacks.autoSave();
      this.scene.time.delayedCall(600, () => {
        this.callbacks.restartDungeon();
      });
      return true;
    }

    this.callbacks.autoSave();
    this.scene.time.delayedCall(600, () => {
      this.callbacks.setMovementLocked(false);
      this.scanNearby(player);
    });
    return true;
  }
}
