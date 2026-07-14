import {
  getQuestDangerState,
  getQuestMarkerForNpc,
  markQuestWarningSeen,
  reconcileQuestState,
} from "../systems/quests";
import { MAIN_QUEST_ID } from "../data/quests";
import type { PlayerState } from "../systems/player";
import type {
  QuestDangerContext,
  QuestDangerState,
  QuestProcessResult,
  QuestUpdate,
} from "../systems/quests";
import type { CityRenderer } from "../renderers/city";
import type { QuestJournalManager } from "./questJournal";

export interface QuestFlowCallbacks {
  renderMap(): void;
  showMessage(message: string, color?: string): void;
  autoSave(): void;
}

/** Coordinates quest state with Overworld-owned UI and location flow. */
export class QuestFlowManager {
  private readonly player: PlayerState;
  private readonly defeatedBosses: ReadonlySet<string>;
  private readonly journal: QuestJournalManager;
  private readonly cityRenderer: CityRenderer;
  private readonly callbacks: QuestFlowCallbacks;
  private pendingUpdates: QuestUpdate[];
  private initialStateChanged = false;
  private pendingDangerConfirmationId: string | null = null;

  constructor(
    player: PlayerState,
    defeatedBosses: ReadonlySet<string>,
    journal: QuestJournalManager,
    cityRenderer: CityRenderer,
    callbacks: QuestFlowCallbacks,
    incomingUpdates: QuestUpdate[] = [],
  ) {
    this.player = player;
    this.defeatedBosses = defeatedBosses;
    this.journal = journal;
    this.cityRenderer = cityRenderer;
    this.callbacks = callbacks;
    this.pendingUpdates = [...incomingUpdates];

    const reconciled = reconcileQuestState(player, defeatedBosses);
    this.pendingUpdates.push(...reconciled.updates);
    this.initialStateChanged = reconciled.changed || incomingUpdates.length > 0;
  }

  /** Refresh markers and deliver load/Battle updates after the map is rendered. */
  afterInitialRender(): void {
    this.refreshMarkers();
    this.warnAboutCurrentDanger();
    this.journal.enqueueUpdates(this.pendingUpdates);
    this.pendingUpdates = [];
    if (this.initialStateChanged) {
      this.callbacks.autoSave();
      this.initialStateChanged = false;
    }
  }

  handleResult(result: QuestProcessResult): void {
    if (!result.changed) return;
    this.refreshUi();
    this.callbacks.autoSave();
    this.journal.enqueueUpdates(result.updates);
  }

  refreshUi(): void {
    this.callbacks.renderMap();
    this.journal.refresh(this.player);
  }

  refreshMarkers(): void {
    this.cityRenderer.refreshQuestMarkers((npcId) =>
      getQuestMarkerForNpc(this.player, npcId)
    );
  }

  getCurrentDangerState(): QuestDangerState | null {
    const position = this.player.position;
    const context: QuestDangerContext = position.inDungeon
      ? { type: "dungeon", id: position.dungeonId }
      : position.inCity
        ? { type: "city", id: position.cityId }
        : {
          type: "chunk",
          x: position.chunkX,
          y: position.chunkY,
        };
    return getQuestDangerState(this.player, context);
  }

  confirmDanger(context: QuestDangerContext): boolean {
    const danger = getQuestDangerState(this.player, context);
    if (!danger || danger.seen) return true;
    if (this.pendingDangerConfirmationId === danger.id) {
      markQuestWarningSeen(this.player, danger.id);
      this.pendingDangerConfirmationId = null;
      this.callbacks.autoSave();
      return true;
    }

    this.pendingDangerConfirmationId = danger.id;
    this.callbacks.showMessage(
      `${danger.warning} Press SPACE again to continue.`,
      "#ffb74d",
    );
    return false;
  }

  warnAboutCurrentDanger(): void {
    const danger = this.getCurrentDangerState();
    if (!danger || danger.seen) return;
    markQuestWarningSeen(this.player, danger.id);
    this.pendingUpdates.push({
      type: "warning",
      questId: MAIN_QUEST_ID,
      message: danger.warning,
    });
    this.callbacks.autoSave();
  }
}
