import * as Phaser from "phaser";
import { debugPanelLog } from "../config";
import {
  MINIGAME_ACTIVITY_IDS,
  MINIGAME_DIFFICULTIES,
  MINIGAME_DIFFICULTY_IDS,
  MINIGAME_VENUES,
  getMinigameActivity,
  getMinigameRecordId,
  getMinigameVenue,
  isMinigameDifficultyId,
  isMinigameVenueId,
} from "../data/minigames";
import { MINIGAME_ACTIVITY_FEATURES } from "../data/featureDiscovery";
import { getCity } from "../data/map";
import { getCodexKnowledgeEntry } from "../data/codexKnowledge";
import { gamePreferences, isReducedMotionEnabled } from "../systems/accessibility";
import { inputPromptSource, getInputPromptSource, mapKeyboardCode } from "../systems/input";
import {
  applyMinigameAction,
  discoverMinigameVenue,
  getMinigameEntryReason,
  getMinigameScore,
  getNearbyMinigameVenue,
  isAtMinigameVenue,
  startMinigame,
} from "../systems/minigames";
import { getMinigameForecast } from "../systems/minigameRules";
import { consumeMinigameRecoveryNotice } from "../systems/minigameState";
import { commitMinigameMutation } from "../systems/minigameTransactions";
import {
  MinigameInputGate,
  getArcheryMeterAim,
  getMinigameControlPrompt,
  getMinigameGamePresentation,
} from "../systems/minigamePresentation";
import { isFeatureAvailable, revealFeature } from "../systems/featureDiscovery";
import { moveGridSelection, restoreLayoutFocus } from "../systems/layout";
import { MinigamePanelRenderer } from "../renderers/minigames";
import { MinigameVenueRenderer } from "../renderers/minigameVenues";
import { createStatusAnnouncer } from "../utils/ui";
import type {
  MinigameActivityId,
  MinigameDifficultyId,
  MinigameVenueId,
} from "../data/minigames";
import type { CodexData, CodexUnlockResult } from "../systems/codex";
import type {
  MinigameActionRequest,
  MinigameMutationResult,
  MinigameSession,
  MinigameStartRequest,
} from "../systems/minigameTypes";
import type { PlayerState } from "../systems/player";
import type { SaveActionResult } from "../systems/save";
import type { WeatherType } from "../systems/weather";
import type { GridNavigationDirection } from "../systems/layout";
import type { MinigamePanelAction, MinigamePanelContent } from "../renderers/minigames";

type MinigameView = "lobby" | "setup" | "rules" | "records" | "game" | "pause" | "result" | "error";

export interface MinigameManagerCallbacks {
  autoSave(): SaveActionResult;
  updateHUD(): void;
  showMessage(message: string, color?: string): void;
  showCodexUnlocks(result: CodexUnlockResult): void;
}

export interface MinigameDebugResult {
  readonly messages: readonly string[];
  readonly relocated: boolean;
}

export class MinigameManager {
  private readonly panel: MinigamePanelRenderer;
  private readonly venues: MinigameVenueRenderer;
  private readonly gate = new MinigameInputGate();
  private player: PlayerState | null = null;
  private codex: CodexData | null = null;
  private mode: MinigameView = "lobby";
  private returnMode: MinigameView = "lobby";
  private errorReturnMode: MinigameView = "lobby";
  private venueId: MinigameVenueId = "willowInnTable";
  private activityId: MinigameActivityId = "crownAndBones";
  private difficultyId: MinigameDifficultyId = "friendly";
  private stake = 5;
  private practice = false;
  private debug = false;
  private timeStep = 0;
  private weather: WeatherType | null = null;
  private selectedId = "";
  private page = 0;
  private previewAim = 0;
  private meterBase = 0;
  private meterEpoch = 0;
  private focusPaused = false;
  private errorMessage = "";
  private retry: (() => void) | null = null;
  private previousContext: unknown;
  private previousFocus: HTMLElement | null = null;
  private liveRegion: HTMLDivElement | null = null;
  private unsubscribePreferences: (() => void) | null = null;
  private unsubscribeSource: (() => void) | null = null;
  private readonly heldConfirmations = new Map<string, () => void>();
  private scoreSession: MinigameSession | null = null;
  private cachedScore = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly callbacks: MinigameManagerCallbacks,
  ) {
    this.panel = new MinigamePanelRenderer(scene);
    this.venues = new MinigameVenueRenderer(scene);
  }

  isOpen(): boolean {
    return this.liveRegion !== null;
  }

  getDebugState(): string {
    if (!this.isOpen()) return "";
    const pending = this.player?.progression.minigames.pending;
    if (pending && pending !== this.scoreSession) {
      this.scoreSession = pending;
      this.cachedScore = getMinigameScore(pending);
    }
    return ` [MINIGAME:${pending?.activityId ?? this.activityId}] [MINIGAME_VIEW:${this.mode}]`
      + ` [MINIGAME_VENUE:${this.venueId}] [MINIGAME_PHASE:${pending?.phase ?? "idle"}]`
      + ` [MINIGAME_REV:${pending?.revision ?? 0}] [MINIGAME_SCORE:${pending ? this.cachedScore : 0}]`;
  }

  getPrompt(player: PlayerState): string | undefined {
    const venue = getNearbyMinigameVenue(player);
    return venue && player.position.x === venue.x && player.position.y === venue.y
      ? `[SPACE] ${getMinigameActivity(venue.activityId).name}` : undefined;
  }

  discoverNearby(player: PlayerState): boolean {
    const venue = getNearbyMinigameVenue(player);
    return venue ? discoverMinigameVenue(player.progression.minigames, venue.id) : false;
  }

  renderVenues(
    player: PlayerState,
    explored: (x: number, y: number) => boolean,
    activate: (venueId: MinigameVenueId) => void,
  ): void {
    this.venues.render(player, explored, activate);
  }

  updateVenueVisibility(explored: (x: number, y: number) => boolean): void {
    this.venues.updateVisibility(explored);
  }

  startNearby(player: PlayerState, codex: CodexData, timeStep: number, weather: WeatherType): boolean {
    const venue = getNearbyMinigameVenue(player);
    if (!venue || player.position.x !== venue.x || player.position.y !== venue.y) return false;
    this.openVenue(player, codex, venue.id, timeStep, weather);
    return true;
  }

  openVenue(
    player: PlayerState,
    codex: CodexData,
    venueId: MinigameVenueId,
    timeStep: number,
    weather: WeatherType,
  ): void {
    const venue = getMinigameVenue(venueId);
    if (!isAtMinigameVenue(player, venue)) {
      this.callbacks.showMessage(`Visit ${venue.name}, district ${venue.cityChunkIndex + 1}, marker (${venue.x},${venue.y}).`, "#ffe38a");
      return;
    }
    this.venueId = venueId;
    this.activityId = venue.activityId;
    this.difficultyId = "friendly";
    this.stake = 5;
    this.practice = false;
    this.debug = false;
    this.mode = "lobby";
    this.page = 0;
    this.attach(player, codex, timeStep, weather);
    this.render();
  }

  openRecords(player: PlayerState, codex: CodexData, timeStep: number, weather: WeatherType): void {
    const activity = MINIGAME_ACTIVITY_IDS.find((id) => isFeatureAvailable(player, MINIGAME_ACTIVITY_FEATURES[id]));
    if (!activity) {
      this.callbacks.showMessage("Discover a marked activity venue first.", "#ffe38a");
      return;
    }
    this.activityId = activity;
    this.mode = "records";
    this.page = 0;
    this.debug = false;
    this.attach(player, codex, timeStep, weather);
    this.render();
  }

  resumePending(player: PlayerState, codex: CodexData, timeStep: number, weather: WeatherType): boolean {
    const notice = consumeMinigameRecoveryNotice(player.progression.minigames);
    if (notice) {
      this.callbacks.showMessage(notice, "#ffe38a");
      this.callbacks.autoSave();
    }
    const pending = player.progression.minigames.pending;
    if (!pending) return false;
    this.venueId = pending.venueId;
    this.activityId = pending.activityId;
    this.difficultyId = pending.difficultyId;
    this.practice = pending.practice;
    this.debug = pending.debug;
    this.stake = pending.feePaid || MINIGAME_DIFFICULTIES[pending.difficultyId].crownStakeCap;
    this.mode = pending.phase === "result" ? "result" : "game";
    this.attach(player, codex, timeStep, weather);
    this.resetMeter();
    this.render();
    return true;
  }

  private attach(player: PlayerState, codex: CodexData, timeStep: number, weather: WeatherType): void {
    this.player = player;
    this.codex = codex;
    this.timeStep = timeStep;
    this.weather = weather;
    if (this.isOpen()) return;
    this.previousContext = this.scene.data.get("semanticInputContext");
    this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.scene.data.set("semanticInputContext", "minigame");
    this.focusPaused = false;
    this.liveRegion = createStatusAnnouncer("minigame-live-region");
    this.scene.input.keyboard?.resetKeys();
    this.scene.input.keyboard?.on("keydown", this.handleKeyDown);
    this.scene.input.keyboard?.on("keyup", this.handleKeyUp);
    this.scene.events.on(Phaser.Scenes.Events.UPDATE, this.onFrame);
    this.scene.scale.on(Phaser.Scale.Events.RESIZE, this.onPresentationChange);
    this.scene.game.events.on(Phaser.Core.Events.BLUR, this.pauseForFocus);
    this.scene.game.events.on(Phaser.Core.Events.FOCUS, this.resumeForFocus);
    this.unsubscribePreferences = gamePreferences.subscribe(this.onPresentationChange);
    this.unsubscribeSource = inputPromptSource.subscribe(this.onPresentationChange);
    this.scene.game.canvas.dataset["minigameInputOwned"] = "true";
  }

  close(): void {
    if (!this.isOpen()) return;
    this.scene.input.keyboard?.off("keydown", this.handleKeyDown);
    this.scene.input.keyboard?.off("keyup", this.handleKeyUp);
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.onFrame);
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.onPresentationChange);
    this.scene.game.events.off(Phaser.Core.Events.BLUR, this.pauseForFocus);
    this.scene.game.events.off(Phaser.Core.Events.FOCUS, this.resumeForFocus);
    this.unsubscribePreferences?.();
    this.unsubscribeSource?.();
    this.unsubscribePreferences = null;
    this.unsubscribeSource = null;
    this.panel.clear();
    this.liveRegion?.remove();
    this.liveRegion = null;
    if (this.previousContext === undefined) this.scene.data.remove("semanticInputContext");
    else this.scene.data.set("semanticInputContext", this.previousContext);
    this.previousContext = undefined;
    this.heldConfirmations.clear();
    this.gate.clear();
    this.scene.input.keyboard?.resetKeys();
    this.retry = null;
    this.debug = false;
    this.scoreSession = null;
    delete this.scene.game.canvas.dataset["minigameInputOwned"];
    delete this.scene.game.canvas.dataset["minigameAcceptedAim"];
    if (this.previousFocus?.isConnected) this.previousFocus.focus({ preventScroll: true });
    this.previousFocus = null;
  }

  clear(): void {
    this.close();
    this.venues.clear();
    this.player = null;
    this.codex = null;
    this.weather = null;
  }

  private readonly pauseForFocus = (): void => {
    this.focusPaused = true;
    this.heldConfirmations.clear();
  };

  private readonly resumeForFocus = (): void => {
    this.focusPaused = false;
    this.meterBase = this.previewAim;
    this.meterEpoch = this.scene.time.now;
  };

  private readonly onPresentationChange = (): void => {
    if (!this.isOpen()) return;
    this.meterBase = this.previewAim;
    this.meterEpoch = this.scene.time.now;
    this.render();
  };

  private readonly onFrame = (): void => {
    const pending = this.player?.progression.minigames.pending;
    if (this.mode !== "game" || pending?.activityId !== "archery"
      || pending.phase !== "playing" || this.focusPaused || isReducedMotionEnabled()
    ) return;
    const aim = getArcheryMeterAim(this.meterBase, this.scene.time.now - this.meterEpoch, pending.difficultyId);
    if (aim === this.previewAim) return;
    this.previewAim = aim;
    const view = getMinigameGamePresentation(pending, getInputPromptSource(), false, aim);
    this.panel.refreshGame(view.status, view.board);
  };

  private resetMeter(preserve = false): void {
    const pending = this.player?.progression.minigames.pending;
    if (pending?.activityId !== "archery") return;
    if (!preserve) this.previewAim = pending.game.aim;
    this.meterBase = this.previewAim;
    this.meterEpoch = this.scene.time.now;
  }

  private request(): MinigameStartRequest {
    if (!this.player || this.weather === null) throw new Error("[minigames] The venue context is unavailable.");
    const state = this.player.progression.minigames;
    return {
      sequence: state.sequence + 1, venueId: this.venueId,
      difficultyId: this.difficultyId, stake: this.stake,
      practice: this.practice, debug: this.debug, timeStep: this.timeStep,
      weather: getMinigameForecast(this.venueId, state.seed, state.sequence + 1, this.timeStep, this.weather),
    };
  }

  private perform(request: MinigameActionRequest | MinigameStartRequest, afterAcknowledgement: "close" | "lobby" = "close"): void {
    if (!this.isOpen() || this.focusPaused) return;
    const player = this.player;
    const codex = this.codex;
    if (!player || !codex) return;
    const actionId = "action" in request ? request.action.type : "start";
    if (!this.gate.accept(actionId, this.scene.time.now)) return;
    const previousIds = new Set(codex.unlockedEntryIds);
    const operation = (): MinigameMutationResult => {
      const result = "action" in request
        ? applyMinigameAction(player, request, codex) : startMinigame(player, request);
      if (!("action" in request) && result.changed && !request.debug) {
        const pending = player.progression.minigames.pending;
        if (pending) {
          revealFeature(player, MINIGAME_ACTIVITY_FEATURES[pending.activityId]);
          revealFeature(player, "minigames");
        }
      }
      return result;
    };
    const result = commitMinigameMutation(player, codex, operation, () => this.callbacks.autoSave());
    this.callbacks.updateHUD();
    if (!result.ok) {
      this.errorReturnMode = this.mode === "error" ? this.errorReturnMode : this.mode;
      this.errorMessage = result.message;
      this.retry = () => this.perform(request, afterAcknowledgement);
      this.mode = "error";
      this.page = 0;
      this.render();
      this.announce(result.message);
      return;
    }
    if (!result.changed) return;
    if ("action" in request && request.action.type === "fire" && request.action.aim !== undefined) {
      this.scene.game.canvas.dataset["minigameAcceptedAim"] = String(request.action.aim);
    }
    const entries = codex.unlockedEntryIds.filter((id) => !previousIds.has(id))
      .flatMap((id) => {
        const entry = getCodexKnowledgeEntry(id);
        return entry ? [entry] : [];
      });
    if (entries.length > 0) this.callbacks.showCodexUnlocks({ unlockedIds: entries.map((entry) => entry.id), entries });
    if ("action" in request && request.action.type === "acknowledge") {
      if (afterAcknowledgement === "close") this.close();
      else {
        this.mode = "lobby";
        this.page = 0;
        this.render();
      }
      return;
    }
    const pending = player.progression.minigames.pending;
    this.mode = pending?.phase === "result" ? "result" : "game";
    this.errorMessage = "";
    this.retry = null;
    this.page = 0;
    this.resetMeter();
    this.render();
    if (result.receipt) {
      debugPanelLog(`[MINIGAME] ${result.message}${result.receipt.debug ? " [DEBUG]" : result.receipt.practice ? " [PRACTICE]" : ""}`);
    }
  }

  private gameRequest(action: MinigameActionRequest["action"]): MinigameActionRequest {
    const pending = this.player?.progression.minigames.pending;
    if (!pending) throw new Error("[minigames] No activity is pending.");
    return { sessionId: pending.sessionId, expectedRevision: pending.revision, action };
  }

  private begin(): void {
    this.perform(this.request());
  }

  private showRules(): void {
    this.returnMode = this.mode;
    this.mode = "rules";
    this.page = 0;
    this.render();
  }

  private back(): void {
    if (this.mode === "game") {
      this.mode = "pause";
      this.page = 0;
      this.render();
    } else if (this.mode === "pause") {
      this.mode = "game";
      this.resetMeter(true);
      this.render();
    } else if (this.mode === "rules") {
      this.mode = this.returnMode;
      this.page = 0;
      this.resetMeter(true);
      this.render();
    } else if (this.mode === "setup") {
      this.mode = "lobby";
      this.render();
    } else if (this.mode === "error") {
      this.mode = this.errorReturnMode;
      this.resetMeter(true);
      this.render();
    } else if (this.mode === "result") {
      this.perform(this.gameRequest({ type: "acknowledge" }));
    } else if (this.mode === "records" && this.player?.progression.minigames.pending) {
      this.mode = "result";
      this.render();
    } else {
      this.close();
    }
  }

  private nextPage(): void {
    this.page = (this.page + 1) % Math.max(1, this.panel.pageCount);
    this.render();
  }

  private announce(message: string): void {
    if (this.liveRegion) this.liveRegion.textContent = message;
  }

  private action(id: string, label: string, execute: () => void, disabled = false): MinigamePanelAction {
    return { id, label, execute, disabled };
  }

  private availableActivities(): readonly MinigameActivityId[] {
    const player = this.player;
    return player ? MINIGAME_ACTIVITY_IDS.filter((id) =>
      isFeatureAvailable(player, MINIGAME_ACTIVITY_FEATURES[id])) : [];
  }

  private nextActivity(): void {
    const activities = this.availableActivities();
    if (activities.length < 2) return;
    this.activityId = activities[(activities.indexOf(this.activityId) + 1) % activities.length]!;
    this.page = 0;
    this.render();
  }

  private recordParagraphs(): string[] {
    const player = this.player;
    if (!player) return [];
    const state = player.progression.minigames;
    const lines = ["Personal board only. Gold medal: 80+. Practice and debug grant no paid medals or rewards."];
    for (const venue of MINIGAME_VENUES) {
      if (venue.activityId !== this.activityId || !state.discoveredVenueIds.includes(venue.id)) continue;
      lines.push(`${venue.name}: ${getCity(venue.cityId)?.name ?? venue.cityId}, district ${venue.cityChunkIndex + 1}, marker (${venue.x},${venue.y}).`);
      for (const difficultyId of MINIGAME_DIFFICULTY_IDS) {
        const recordId = getMinigameRecordId(venue.id, difficultyId);
        lines.push(`${MINIGAME_DIFFICULTIES[difficultyId].name}: paid ${state.bests[recordId]?.score ?? "--"}/100; practice ${state.practiceBests[recordId]?.score ?? "--"}/100.`);
      }
    }
    const recent = state.history.filter((entry) => entry.activityId === this.activityId).slice(-6).reverse();
    lines.push("Recent personal runs:");
    if (recent.length === 0) lines.push("No recorded runs yet.");
    for (const entry of recent) {
      lines.push(`${entry.debug ? "[DEBUG] " : entry.practice ? "[PRACTICE] " : ""}${entry.outcome}: ${entry.score}/100, entry ${entry.feePaid}g, payout ${entry.goldPaid}g, hull wear ${entry.conditionLost}.`);
    }
    return lines;
  }

  private content(): Omit<MinigamePanelContent, "selectedId" | "page" | "onSelect" | "onBack"> {
    const player = this.player;
    if (!player) throw new Error("[minigames] The modal has no player.");
    const activity = getMinigameActivity(this.activityId);
    const venue = getMinigameVenue(this.venueId);
    const difficulty = MINIGAME_DIFFICULTIES[this.difficultyId];
    const prompt = getMinigameControlPrompt("menu", getInputPromptSource());
    const label = this.debug ? " [DEBUG]" : this.practice ? " [PRACTICE]" : "";
    const base = { title: `${activity.name}${label}`, prompt, paragraphs: [] as readonly string[] };
    if (this.mode === "game") {
      const pending = player.progression.minigames.pending;
      if (!pending) throw new Error("[minigames] The playing session disappeared.");
      const view = getMinigameGamePresentation(pending, getInputPromptSource(), isReducedMotionEnabled(), this.previewAim);
      const requestBase = { sessionId: pending.sessionId, expectedRevision: pending.revision };
      if (pending.activityId === "crownAndBones") {
        return {
          ...base, ...view,
          actions: [
            this.action("roll", "Roll", () => this.perform({ ...requestBase, action: { type: "roll" } })),
            this.action("bank", "Bank", () => this.perform({ ...requestBase, action: { type: "bank" } })),
            this.action("rules", "Rules", () => this.showRules()),
          ],
        };
      }
      if (pending.activityId === "archery") {
        return {
          ...base, ...view,
          actions: [
            this.action("fire", "Fire", () => this.perform({ ...requestBase, action: { type: "fire", aim: this.previewAim } })),
            this.action("aim-left", "Aim -1", () => this.perform({ ...requestBase, action: { type: "aimTo", aim: Math.max(0, this.previewAim - 1) } })),
            this.action("aim-right", "Aim +1", () => this.perform({ ...requestBase, action: { type: "aimTo", aim: Math.min(100, this.previewAim + 1) } })),
          ],
          onAim: (aim) => this.perform({ ...requestBase, action: { type: "aimTo", aim } }),
        };
      }
      const actions = this.panel.hasTouchPad()
        ? [this.action("pause", "Pause / leave", () => this.back())]
        : (["north", "west", "east", "south"] as const).map((heading) =>
          this.action(`sail-${heading}`, heading.toUpperCase(), () =>
            this.perform({ ...requestBase, action: { type: "sail", heading } })));
      return { ...base, ...view, actions, columns: this.panel.hasTouchPad() ? 1 : 2 };
    }
    if (this.mode === "pause") {
      const request = this.gameRequest({ type: "abandon" });
      return {
        ...base, status: "The course is paused. Nothing else can move or spend resources.",
        paragraphs: [
          "Abandoning forfeits the already-paid entry. No prize or reputation is granted, and committed hull wear remains.",
          "Resume keeps the exact same challenge and score. Rules can be consulted without rerolling.",
        ],
        actions: [
          this.action("resume", "Resume", () => this.back()),
          this.action("rules", "Rules", () => this.showRules()),
          this.action("abandon", "Abandon", () => this.perform(request)),
        ],
      };
    }
    if (this.mode === "result") {
      const receipt = player.progression.minigames.pending?.receipt;
      if (!receipt) throw new Error("[minigames] The settled receipt disappeared.");
      const acknowledgement = this.gameRequest({ type: "acknowledge" });
      return {
        ...base, status: `${receipt.outcome.toUpperCase()} | Score ${receipt.score}/100\n`
          + `Entry ${receipt.feePaid}g | Payout ${receipt.goldPaid}g | Net ${receipt.goldPaid - receipt.feePaid}g`,
        paragraphs: [
          `Hull condition lost: ${receipt.conditionLost}. First-only bonus: ${receipt.bonusGold}g.`,
          receipt.milestoneId ? "First paid difficulty medal recorded. Bounded reputation and a cosmetic achievement may be earned."
            : receipt.debug ? "DEBUG: no natural records, rewards, reputation, or achievements."
              : receipt.practice ? "Practice: personal practice record only; no currency, reputation, or achievements."
                : "Your personal record is saved. Repeat skill payouts never exceed the fee.",
          "This result has already been settled once. Closing or reloading cannot apply it again.",
        ],
        actions: [
          this.action("again", "Again", () => this.perform(acknowledgement, "lobby")),
          this.action("board", "Personal board", () => {
            this.returnMode = "result";
            this.mode = "records";
            this.page = 0;
            this.render();
          }),
          this.action("close", "Close", () => this.perform(acknowledgement)),
        ],
      };
    }
    if (this.mode === "error") {
      return {
        ...base, title: "Activity could not be saved",
        status: "No uncommitted charge, payout, score, or hull wear was applied.",
        paragraphs: [this.errorMessage, "The last committed session remains intact. Restore local saving and retry, or go back to the previous activity view."],
        actions: [
          this.action("retry", "Retry", () => this.retry?.()),
          this.action("next-page", "More", () => this.nextPage()),
          this.action("back", "Back", () => this.back()),
        ],
      };
    }
    if (this.mode === "rules") {
      return {
        ...base, status: `Rules and instructions | Page ${this.page + 1}`,
        paragraphs: [activity.summary, ...activity.instructions],
        actions: [
          this.action("next-page", "Next page", () => this.nextPage()),
          this.action("board", "Personal board", () => {
            this.mode = "records";
            this.page = 0;
            this.render();
          }, player.progression.minigames.pending !== null),
          this.action("back", "Back", () => this.back()),
        ],
      };
    }
    if (this.mode === "records") {
      const nearby = getNearbyMinigameVenue(player);
      const canPlay = !player.progression.minigames.pending && nearby?.activityId === this.activityId;
      return {
        ...base, status: `Personal records | Page ${this.page + 1}`,
        paragraphs: this.recordParagraphs(),
        actions: [
          this.action("next-activity", "Next activity", () => this.nextActivity(), this.availableActivities().length < 2 || player.progression.minigames.pending !== null),
          this.action("next-page", "Next page", () => this.nextPage()),
          this.action(canPlay ? "venue" : "rules", canPlay ? "Play here" : "Rules", () => {
            if (canPlay && nearby) {
              this.venueId = nearby.id;
              this.mode = "lobby";
              this.page = 0;
              this.render();
            } else this.showRules();
          }),
        ],
      };
    }
    const planned = this.request();
    const reason = getMinigameEntryReason(player, planned);
    const fee = this.debug || this.practice ? 0 : this.activityId === "crownAndBones" ? this.stake : difficulty.entryFee;
    if (this.mode === "setup") {
      return {
        ...base, status: `${venue.name}\n${difficulty.name} | ${this.practice ? "Free practice" : `Entry ${fee}g`} | Gold ${player.gold}g`,
        paragraphs: [
          this.activityId === "crownAndBones" ? `Stake cap ${difficulty.crownStakeCap}g; total payout cap ${difficulty.crownStakeCap * 2}g.`
            : "Paid 80+ refunds the fee; a first difficulty medal earns a finite bonus. Free practice grants no rewards.",
          reason ?? "This difficulty is available. Back returns to the entry instructions.",
        ],
        actions: [
          this.action("difficulty", `Mode: ${difficulty.name}`, () => {
            const index = MINIGAME_DIFFICULTY_IDS.indexOf(this.difficultyId);
            this.difficultyId = MINIGAME_DIFFICULTY_IDS[(index + 1) % MINIGAME_DIFFICULTY_IDS.length]!;
            this.stake = Math.min(this.stake, MINIGAME_DIFFICULTIES[this.difficultyId].crownStakeCap);
            this.render();
          }),
          this.action(this.activityId === "crownAndBones" ? "stake" : "practice",
            this.activityId === "crownAndBones" ? `Stake: ${this.stake}g` : this.practice ? "Free practice" : "Paid entry",
            () => {
              if (this.activityId === "crownAndBones") this.stake = this.stake % difficulty.crownStakeCap + 1;
              else this.practice = !this.practice;
              this.render();
            }),
          this.action("back", "Back", () => this.back()),
        ],
      };
    }
    return {
      ...base, status: `${venue.name}\n${difficulty.name} | ${this.practice ? "Free practice" : `Entry ${fee}g`} | Gold ${player.gold}g`,
      paragraphs: [
        ...(reason ? [reason] : []),
        this.activityId === "crownAndBones" ? "Bones 6/36; Crown 6/36; other safe 24/36."
          : this.activityId === "archery" ? "Five arrows; the same borrowed bow and score for every class."
            : `Course forecast: ${planned.weather}. City weather is unchanged.`,
        this.activityId === "crownAndBones" ? "Bank: 0.5x / 1x / 1.5x / 2x, including entry; rounded down."
          : "Setup offers free practice. Paid 80+ refunds the fee; first medal bonus only once.",
      ].filter(Boolean),
      actions: [
        this.action("play", "Play", () => this.perform(planned), reason !== undefined),
        this.action("setup", "Setup", () => { this.mode = "setup"; this.render(); }),
        this.action("rules", "Help / board", () => this.showRules()),
      ],
    };
  }

  private render(): void {
    if (!this.isOpen()) return;
    const content = this.content();
    const actions = content.actions.filter((action) => !action.disabled);
    const focus = restoreLayoutFocus(actions.map((action) => ({
      id: action.id, visible: true, enabled: true,
    })), this.selectedId);
    this.selectedId = focus.items[focus.index]?.id ?? actions[0]?.id ?? "";
    this.panel.render({
      ...content, selectedId: this.selectedId, page: this.page,
      onSelect: (id) => { this.selectedId = id; this.panel.setSelected(id); },
      onBack: () => this.back(),
    });
    this.announce(`${content.title}. ${content.status}. ${content.paragraphs.join(" ")} ${content.prompt}`);
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.isOpen() || this.focusPaused) return;
    const action = mapKeyboardCode(event.code, "minigame");
    if (action === "confirm" || action === "cancel") {
      if (event.repeat || this.heldConfirmations.has(event.code)) return;
      const mode = this.mode;
      const pending = this.player?.progression.minigames.pending;
      const archerySessionId = pending?.activityId === "archery" ? pending.sessionId : undefined;
      const arrowIndex = pending?.activityId === "archery" ? pending.game.shots.length : -1;
      const execute = action === "cancel" ? () => this.back()
        : mode === "game" && this.player?.progression.minigames.pending?.activityId === "regatta"
          ? () => this.back()
          : mode === "game" && archerySessionId
            ? () => {
              const current = this.player?.progression.minigames.pending;
              if (current?.activityId === "archery" && current.sessionId === archerySessionId
                && current.game.shots.length === arrowIndex && current.phase === "playing"
              ) this.perform(this.gameRequest({ type: "fire", aim: this.previewAim }));
            }
            : this.panel.visibleActions.find((entry) => entry.id === this.selectedId)?.execute;
      if (execute) this.heldConfirmations.set(event.code, () => { if (this.mode === mode) execute(); });
      event.preventDefault();
      return;
    }
    const directions: Readonly<Record<string, GridNavigationDirection>> = {
      navigateUp: "up", navigateDown: "down", navigateLeft: "left", navigateRight: "right",
    };
    const direction = action ? directions[action] : undefined;
    if (!direction || !this.gate.accept(direction, this.scene.time.now, 35)) return;
    event.preventDefault();
    const pending = this.player?.progression.minigames.pending;
    if (this.mode === "game" && pending?.activityId === "archery") {
      const delta = { left: -1, right: 1, up: 5, down: -5 }[direction];
      this.perform(this.gameRequest({ type: "aimTo", aim: Math.max(0, Math.min(100, this.previewAim + delta)) }));
    } else if (this.mode === "game" && pending?.activityId === "regatta") {
      const heading = { up: "north", down: "south", left: "west", right: "east" } as const;
      this.perform(this.gameRequest({ type: "sail", heading: heading[direction] }));
    } else {
      const actions = this.panel.visibleActions;
      const index = actions.findIndex((entry) => entry.id === this.selectedId);
      const next = moveGridSelection(index, actions.length, this.panel.columns, direction);
      const selected = actions[next];
      if (selected) {
        this.selectedId = selected.id;
        this.panel.setSelected(selected.id);
        this.announce(selected.label);
      }
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    const execute = this.heldConfirmations.get(event.code);
    this.heldConfirmations.delete(event.code);
    execute?.();
  };

  executeDebug(
    player: PlayerState,
    codex: CodexData,
    args: string,
    timeStep: number,
    weather: WeatherType,
  ): MinigameDebugResult {
    const [command = "list", value, difficulty] = args.trim().split(/\s+/);
    if (command === "list") {
      return { relocated: false, messages: MINIGAME_VENUES.map((venue) =>
        `${venue.id}: ${getMinigameActivity(venue.activityId).name}, ${venue.cityId}/${venue.cityChunkIndex}, (${venue.x},${venue.y})`) };
    }
    if (command === "status") {
      const state = player.progression.minigames;
      return { relocated: false, messages: [
        `Sessions ${state.sequence}; settled ${state.settledSequence}; pending ${state.pending?.sessionId ?? "none"}.`,
        ...MINIGAME_ACTIVITY_IDS.map((id) => `${id}: ${state.statistics[id].completions} paid completions, ${state.statistics[id].medals} medals.`),
      ] };
    }
    if (!isMinigameVenueId(value)) return { relocated: false, messages: ["Usage: /minigame list|status|near <venueId>|play <venueId> [difficulty]"] };
    if (this.isOpen() || player.progression.minigames.pending) {
      return { relocated: false, messages: ["Close or finish the current activity before changing its debug context."] };
    }
    const venue = getMinigameVenue(value);
    if (command === "near") {
      if (player.progression.gathering.pending || player.progression.worldEvents.pending
        || player.progression.nautical.pendingMerchantRoute || player.progression.nautical.pendingEncounter
        || player.progression.nautical.pendingHazard
      ) return { relocated: false, messages: ["Finish the pending world activity first."] };
      const city = getCity(venue.cityId);
      if (!city) throw new Error(`[minigames] Missing city for ${value}.`);
      player.position = {
        ...player.position, inCity: true, cityId: venue.cityId,
        cityChunkIndex: venue.cityChunkIndex, x: venue.x, y: venue.y,
        chunkX: city.chunkX, chunkY: city.chunkY,
        inDungeon: false, dungeonId: "", dungeonLevel: 0,
      };
      player.progression.nautical.sailing = false;
      discoverMinigameVenue(player.progression.minigames, value);
      return { relocated: true, messages: [`Moved near ${venue.name}. No activity was completed.`] };
    }
    if (command !== "play" || (difficulty !== undefined && !isMinigameDifficultyId(difficulty))) {
      return { relocated: false, messages: ["Use /minigame play <venueId> [friendly|seasoned|expert]."] };
    }
    if (!isAtMinigameVenue(player, venue)) return { relocated: false, messages: ["Visit the venue or use /minigame near first."] };
    this.openVenue(player, codex, value, timeStep, weather);
    this.debug = true;
    this.difficultyId = isMinigameDifficultyId(difficulty) ? difficulty : "friendly";
    this.stake = MINIGAME_DIFFICULTIES[this.difficultyId].crownStakeCap;
    this.begin();
    return { relocated: false, messages: ["Debug activity: no currency, hull wear, reputation, natural records, or achievement credit."] };
  }
}
