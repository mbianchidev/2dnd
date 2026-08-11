import * as Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, debugPanelLog } from "../config";
import {
  getWorldEventDefinition,
  WORLD_EVENT_DEFINITIONS,
  type WorldEventChoiceDefinition,
} from "../data/worldEvents";
import {
  forceWorldEvent,
  getPendingWorldEventEncounter,
  prepareWorldEventBattle,
  resetWorldEventState,
  resolveWorldEventBattle,
  resolveWorldEventChoice,
  rollWorldEvent,
  type WorldEventContext,
} from "../systems/worldEvents";
import {
  isWorldEventMarkedDebug,
  markNextBattleAsDebug,
  markWorldEventAsDebug,
} from "../systems/achievements";
import type { CodexData, CodexUnlockResult } from "../systems/codex";
import type { BattleResolutionHooks } from "../systems/groupCombat";
import type { MonsterEncounter } from "../data/monsterGroups";
import type { PlayerState } from "../systems/player";
import type { QuestUpdate } from "../systems/quests";
import type { Terrain } from "../data/mapTypes";
import type { SocialMutationResult } from "../systems/reputation";
import { createOverlayContainer } from "../utils/ui";
import { layoutTextStack } from "./layout";
import { paginateMeasuredItems } from "../systems/layout";

export interface WorldEventManagerCallbacks {
  autoSave(): void;
  updateHUD(): void;
  showMessage(message: string, color?: string): void;
  handleQuestUpdates(updates: readonly QuestUpdate[]): void;
  showCodexUnlocks(result: CodexUnlockResult): void;
  handleSocialEffects(effects: readonly SocialMutationResult[]): void;
  startBattle(
    encounter: MonsterEncounter,
    terrain: Terrain,
    hooks: BattleResolutionHooks,
    immediate: boolean,
  ): void;
}

export class WorldEventManager {
  private container: Phaser.GameObjects.Container | null = null;
  private selectedIndex = 0;
  private player: PlayerState | null = null;
  private codex: CodexData | null = null;
  private defeatedBosses: ReadonlySet<string> = new Set();
  private terrain: Terrain | null = null;
  private keys: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    w: Phaser.Input.Keyboard.Key;
    s: Phaser.Input.Keyboard.Key;
    enter: Phaser.Input.Keyboard.Key;
    space: Phaser.Input.Keyboard.Key;
    escape: Phaser.Input.Keyboard.Key;
  } | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly callbacks: WorldEventManagerCallbacks,
  ) {}

  private ensureKeys(): NonNullable<WorldEventManager["keys"]> {
    if (this.keys) return this.keys;
    const keyboard = this.scene.input.keyboard;
    if (!keyboard) throw new Error("World events require keyboard input.");
    this.keys = {
      up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      w: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      s: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      enter: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
      space: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      escape: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
    };
    return this.keys;
  }

  isOpen(): boolean {
    return this.container !== null;
  }

  getDebugState(): string {
    const pending = this.player?.progression.worldEvents.pending;
    return pending
      ? ` [WORLD_EVENT:${pending.eventId}] [WORLD_EVENT_PHASE:${pending.phase}]`
        + (pending.phase === "choice"
          ? ` [WORLD_EVENT_SELECTION:${this.selectedIndex + 1}/${this.getChoices().length}]`
          : "")
      : "";
  }

  checkAfterStep(
    player: PlayerState,
    codex: CodexData,
    defeatedBosses: ReadonlySet<string>,
    context: WorldEventContext,
  ): boolean {
    const result = rollWorldEvent(player.progression.worldEvents, context);
    if (!result.triggered) return false;
    this.callbacks.autoSave();
    this.open(player, codex, defeatedBosses, context.location.terrain);
    debugPanelLog(
      `[EVENT] ${result.pending?.eventId ?? "unknown"} triggered `
      + `(${(result.chance * 100).toFixed(1)}% chance)`,
      true,
    );
    return true;
  }

  resumePending(
    player: PlayerState,
    codex: CodexData,
    defeatedBosses: ReadonlySet<string>,
  ): boolean {
    const pending = player.progression.worldEvents.pending;
    if (!pending) return false;
    this.player = player;
    this.codex = codex;
    this.defeatedBosses = defeatedBosses;
    this.terrain = pending.location.terrain;
    if (pending.phase === "battle") {
      this.startPreparedBattle();
    } else {
      this.open(player, codex, defeatedBosses, pending.location.terrain);
    }
    return true;
  }

  force(
    player: PlayerState,
    codex: CodexData,
    defeatedBosses: ReadonlySet<string>,
    eventId: string,
    context: WorldEventContext,
    debug = false,
  ): void {
    const pending = forceWorldEvent(
      player.progression.worldEvents,
      eventId,
      context,
    );
    if (debug) markWorldEventAsDebug(player, pending.instanceId);
    this.callbacks.autoSave();
    this.open(player, codex, defeatedBosses, context.location.terrain);
  }

  reset(player: PlayerState, seed?: number): void {
    this.close();
    resetWorldEventState(player, seed);
    this.callbacks.autoSave();
  }

  list(): readonly string[] {
    return WORLD_EVENT_DEFINITIONS.map((event) =>
      `${event.id} (${event.family}, weight ${event.weight})`
    );
  }

  update(): boolean {
    if (!this.container) return false;
    const keys = this.ensureKeys();
    if (
      Phaser.Input.Keyboard.JustDown(keys.up)
      || Phaser.Input.Keyboard.JustDown(keys.w)
    ) {
      this.moveSelection(-1);
    } else if (
      Phaser.Input.Keyboard.JustDown(keys.down)
      || Phaser.Input.Keyboard.JustDown(keys.s)
    ) {
      this.moveSelection(1);
    } else if (
      Phaser.Input.Keyboard.JustDown(keys.enter)
      || Phaser.Input.Keyboard.JustDown(keys.space)
    ) {
      this.chooseSelected();
    } else if (Phaser.Input.Keyboard.JustDown(keys.escape)) {
      const choices = this.getChoices();
      if (choices.length > 0) {
        this.selectedIndex = choices.length - 1;
        this.chooseSelected();
      }
    }
    return true;
  }

  close(): void {
    this.container?.destroy(true);
    this.container = null;
  }

  clear(): void {
    this.close();
    this.player = null;
    this.codex = null;
    this.terrain = null;
    this.defeatedBosses = new Set();
  }

  private open(
    player: PlayerState,
    codex: CodexData,
    defeatedBosses: ReadonlySet<string>,
    terrain: Terrain,
  ): void {
    this.player = player;
    this.codex = codex;
    this.defeatedBosses = defeatedBosses;
    this.terrain = terrain;
    this.selectedIndex = 0;
    this.render();
  }

  private getChoices(): readonly WorldEventChoiceDefinition[] {
    const eventId = this.player?.progression.worldEvents.pending?.eventId;
    return eventId ? getWorldEventDefinition(eventId)?.choices ?? [] : [];
  }

  private moveSelection(delta: number): void {
    const choices = this.getChoices();
    if (choices.length === 0) return;
    this.selectedIndex = (
      this.selectedIndex + delta + choices.length
    ) % choices.length;
    this.render();
  }

  private chooseSelected(): void {
    const player = this.player;
    const codex = this.codex;
    const choice = this.getChoices()[this.selectedIndex];
    if (!player || !codex || !choice) return;
    if (choice.type === "battle") {
      prepareWorldEventBattle(player, choice.id);
      this.close();
      this.callbacks.autoSave();
      this.startPreparedBattle();
      return;
    }

    const resolution = resolveWorldEventChoice(
      player,
      codex,
      this.defeatedBosses,
      choice.id,
    );
    this.close();
    if (resolution.resolved) {
      debugPanelLog(
        `[EVENT] ${choice.id}: ${resolution.summary}`,
        true,
      );
      this.callbacks.handleQuestUpdates(resolution.questUpdates);
      this.callbacks.showCodexUnlocks(resolution.codexUnlocks);
      this.callbacks.handleSocialEffects(resolution.socialEffects);
      this.callbacks.updateHUD();
      this.callbacks.showMessage(resolution.summary, "#f7c948");
      this.callbacks.autoSave();
    }
  }

  private startPreparedBattle(): void {
    const player = this.player;
    const codex = this.codex;
    const terrain = this.terrain;
    if (!player || !codex || terrain === null) return;
    const pending = player.progression.worldEvents.pending;
    if (pending && isWorldEventMarkedDebug(player, pending.instanceId)) {
      markNextBattleAsDebug(player);
    }
    const encounter = getPendingWorldEventEncounter(player);
    this.callbacks.startBattle(
      encounter,
      terrain,
      {
        onBattleResolved: (result) => {
          const resolution = resolveWorldEventBattle(
            player,
            codex,
            this.defeatedBosses,
            result.outcome,
          );
          debugPanelLog(
            `[EVENT] battle ${result.outcome}: ${resolution.summary}`,
            true,
          );
          return {
            messages: resolution.socialEffects
              .filter((effect) => effect.changed)
              .map((effect) => `Social: ${effect.summary}`),
            codexEntries: resolution.codexUnlocks.entries,
          };
        },
      },
      true,
    );
  }

  private render(): void {
    this.close();
    const pending = this.player?.progression.worldEvents.pending;
    const event = pending
      ? getWorldEventDefinition(pending.eventId)
      : undefined;
    if (!event || pending?.phase !== "choice") return;

    const panelWidth = 520;
    const panelHeight = 360;
    const panelX = (GAME_WIDTH - panelWidth) / 2;
    const panelY = (GAME_HEIGHT - panelHeight) / 2;
    const container = createOverlayContainer(
      this.scene,
      "world-event",
      98,
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
      0.82,
    ).setInteractive();
    const panel = this.scene.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      panelWidth,
      panelHeight,
      0x111827,
      0.99,
    ).setStrokeStyle(3, 0xf7c948);
    const family = this.scene.add.text(
      GAME_WIDTH / 2,
      panelY + 18,
      `[${event.family.toUpperCase()} EVENT]`,
      {
        fontSize: "12px",
        fontFamily: "monospace",
        color: "#f7c948",
      },
    ).setOrigin(0.5);
    const title = this.scene.add.text(
      GAME_WIDTH / 2,
      panelY + 44,
      event.title,
      {
        fontSize: "22px",
        fontFamily: "monospace",
        fontStyle: "bold",
        color: "#ffffff",
      },
    ).setOrigin(0.5);
    const prompt = this.scene.add.text(
      GAME_WIDTH / 2,
      panelY + 76,
      event.prompt,
      {
        fontSize: "13px",
        fontFamily: "monospace",
        color: "#e5e7eb",
        align: "center",
        wordWrap: { width: 430 },
      },
    ).setOrigin(0.5, 0);
    container.add([backdrop, panel, family, title, prompt]);

    const rows = event.choices.map((choice, index) => {
      const selected = index === this.selectedIndex;
      const row = this.scene.add.text(
        0,
        0,
        `${selected ? ">" : " "} ${choice.label}\n  ${choice.detail}`,
        {
          fontSize: "12px",
          fontFamily: "monospace",
          color: selected ? "#ffffff" : "#d1d5db",
          backgroundColor: selected ? "#374151" : "#1f2937",
          padding: { x: 10, y: 5 },
          fixedWidth: 416,
          wordWrap: { width: 396, useAdvancedWrap: true },
        },
      ).setInteractive({ useHandCursor: true });
      row.setData("layoutId", `world-event-choice-${choice.id}`);
      row.on("pointerover", () => {
        if (this.selectedIndex === index) return;
        this.selectedIndex = index;
        this.render();
      });
      row.on("pointerdown", () => {
        this.selectedIndex = index;
        this.chooseSelected();
      });
      return row;
    });
    const choiceStartY = Math.max(panelY + 118, prompt.y + prompt.height + 16);
    const footerY = panelY + panelHeight - 18;
    const pages = paginateMeasuredItems(
      rows.map((row) => row.displayHeight),
      Math.max(1, footerY - choiceStartY - 30),
      8,
    );
    const pageIndex = Math.max(
      0,
      pages.findIndex((page) => page.includes(this.selectedIndex)),
    );
    const visibleIndexes = new Set(pages[pageIndex] ?? []);
    const visibleRows = rows.filter((_row, index) => visibleIndexes.has(index));
    rows
      .filter((_row, index) => !visibleIndexes.has(index))
      .forEach((row) => row.destroy());
    container.add(visibleRows);
    layoutTextStack(visibleRows, {
      x: 112,
      y: choiceStartY,
      width: 416,
      gap: 8,
      hitAreaPadding: 4,
    });
    const pageLabel = pages.length > 1
      ? ` | Page ${pageIndex + 1}/${pages.length}`
      : "";
    const footer = this.scene.add.text(
      GAME_WIDTH / 2,
      footerY,
      `Up/Down choose | Enter/Space confirm | Esc selects the safe exit${pageLabel}`,
      {
        fontSize: "10px",
        fontFamily: "monospace",
        color: "#cbd5e1",
        align: "center",
        wordWrap: { width: panelWidth - 40 },
      },
    ).setOrigin(0.5, 1);
    footer.setData("layoutId", "world-event-footer");
    container.add(footer);
    this.container = container;
  }
}
