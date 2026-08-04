import * as Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import type { CutsceneStep } from "../data/cutscenes";
import type { CampaignEndingSummary } from "../systems/cutscenes";
import type { PartyDefeatResult } from "../systems/party";

export interface CampaignEndingChoiceCallbacks {
  continuePostGame: () => void;
  replay: () => void;
  returnToTitle: () => void;
  select: (index: number) => void;
}

export interface DefeatResultPresentation {
  encounterName: string;
  encounterType: "boss" | "random";
  result: PartyDefeatResult;
}

export type ResultTheme = "ending" | "defeat";

export class ResultRenderer {
  private content: Phaser.GameObjects.Container | null = null;
  private choiceButtons: Phaser.GameObjects.Text[] = [];
  private selectedChoice = 0;
  private hintTween: Phaser.Tweens.Tween | null = null;
  private ambientTweens: Phaser.Tweens.Tween[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    theme: ResultTheme = "ending",
  ) {
    this.createBackdrop(theme);
  }

  createAdvanceZone(): Phaser.GameObjects.Zone {
    return this.scene.add.zone(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
    ).setInteractive().setDepth(1);
  }

  renderStep(
    step: CutsceneStep,
    summary: CampaignEndingSummary,
  ): void {
    this.clearContent();
    this.content = this.scene.add.container(0, 0).setDepth(2);

    if (step.type === "narration") {
      this.renderNarration(step.heading, step.text);
    } else if (step.type === "dialogue") {
      this.renderDialogue(step.speaker, step.text);
    } else if (step.type === "summary") {
      this.renderSummary(step.heading, summary);
    } else {
      this.renderCredits(step.lines);
    }

    const hint = this.scene.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT - 24,
      "SPACE / ENTER / click to continue  |  ESC to skip",
      {
        fontSize: "11px",
        fontFamily: "monospace",
        color: "#8f96ba",
      },
    ).setOrigin(0.5);
    this.content.add(hint);
    this.hintTween = this.scene.tweens.add({
      targets: hint,
      alpha: 0.45,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });
  }

  renderDefeatIntro(presentation: DefeatResultPresentation): void {
    this.clearContent();
    this.content = this.scene.add.container(0, 0).setDepth(2);
    const encounterLabel = presentation.encounterType === "boss"
      ? "BOSS ENCOUNTER"
      : "WILDERNESS ENCOUNTER";
    const title = this.scene.add.text(
      GAME_WIDTH / 2,
      105,
      "THE PARTY HAS FALLEN",
      {
        fontSize: "27px",
        fontFamily: "monospace",
        color: "#ff9a9a",
        fontStyle: "bold",
      },
    ).setOrigin(0.5);
    const encounter = this.scene.add.text(
      GAME_WIDTH / 2,
      158,
      `${encounterLabel}\n${presentation.encounterName}`,
      {
        fontSize: "14px",
        fontFamily: "monospace",
        color: "#d7c2cf",
        align: "center",
        lineSpacing: 6,
      },
    ).setOrigin(0.5);
    const party = presentation.result.actors.map((actor) =>
      `${actor.name}  Lv.${actor.level}  [KO]`
    );
    const defeatedParty = this.scene.add.text(
      GAME_WIDTH / 2,
      270,
      ["DEFEATED PARTY", ...party].join("\n"),
      {
        fontSize: "16px",
        fontFamily: "monospace",
        color: "#f4e8ee",
        align: "center",
        lineSpacing: 10,
      },
    ).setOrigin(0.5);
    const hint = this.createHint("SPACE / ENTER / click to view recovery");
    this.content.add([title, encounter, defeatedParty, hint]);
  }

  renderDefeatSummary(
    presentation: DefeatResultPresentation,
    continueRecovery: () => void,
  ): void {
    this.clearContent();
    this.content = this.scene.add.container(0, 0).setDepth(3);
    const { result } = presentation;
    const title = this.scene.add.text(
      GAME_WIDTH / 2,
      44,
      "DEFEAT RECOVERY",
      {
        fontSize: "24px",
        fontFamily: "monospace",
        color: "#ffb0a6",
        fontStyle: "bold",
      },
    ).setOrigin(0.5);
    const panels = this.scene.add.graphics();
    panels.fillStyle(0x180d16, 0.92);
    panels.fillRoundedRect(34, 82, GAME_WIDTH - 68, 334, 12);
    panels.lineStyle(2, 0x8e5265, 0.75);
    panels.strokeRoundedRect(34, 82, GAME_WIDTH - 68, 334, 12);
    const actorPenaltyLines = result.actors.map((actor) =>
      `${actor.name}: -${actor.xpLost} XP  (${actor.xpBefore} -> ${actor.xpAfter})`
    );
    const lines = [
      "APPLIED PENALTIES",
      `Gold: -${result.goldLost}  (${result.goldBefore} -> ${result.goldAfter})`,
      ...actorPenaltyLines,
      "",
      "RECOVERY LOCATION",
      result.recoveryLocation.name,
      `Chunk ${result.recoveryLocation.chunkX},${result.recoveryLocation.chunkY}`
        + `  Tile ${result.recoveryLocation.x},${result.recoveryLocation.y}`,
      "",
      "The defeated party awakens at half HP and MP.",
      "Battle effects have been cleared.",
    ];
    const details = this.scene.add.text(64, 108, lines.join("\n"), {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#f1e4e9",
      lineSpacing: 8,
      wordWrap: { width: GAME_WIDTH - 128, useAdvancedWrap: true },
    });
    const button = this.scene.add.text(
      GAME_WIDTH / 2,
      455,
      "Continue from Recovery",
      {
        fontSize: "16px",
        fontFamily: "monospace",
        color: "#fff0e8",
        backgroundColor: "#6b3345",
        padding: { x: 22, y: 9 },
      },
    ).setOrigin(0.5).setInteractive({ useHandCursor: true });
    button.on("pointerdown", continueRecovery);
    const hint = this.scene.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT - 22,
      "SPACE / ENTER to continue",
      {
        fontSize: "11px",
        fontFamily: "monospace",
        color: "#b88d9c",
      },
    ).setOrigin(0.5);
    this.content.add([title, panels, details, button, hint]);
  }

  showChoices(callbacks: CampaignEndingChoiceCallbacks): void {
    this.clearContent();
    this.content = this.scene.add.container(0, 0).setDepth(3);

    const title = this.scene.add.text(
      GAME_WIDTH / 2,
      105,
      "THE COVENANT IS RESTORED",
      {
        fontSize: "25px",
        fontFamily: "monospace",
        color: "#ffe38a",
        fontStyle: "bold",
      },
    ).setOrigin(0.5);
    const subtitle = this.scene.add.text(
      GAME_WIDTH / 2,
      154,
      "The completed world remains open.",
      {
        fontSize: "14px",
        fontFamily: "monospace",
        color: "#d7dcff",
      },
    ).setOrigin(0.5);
    this.content.add([title, subtitle]);

    const actions = [
      callbacks.continuePostGame,
      callbacks.replay,
      callbacks.returnToTitle,
    ];
    const labels = [
      "Continue Post-game",
      "Replay Epilogue",
      "Return to Title",
    ];
    this.choiceButtons = labels.map((label, index) => {
      const button = this.scene.add.text(
        GAME_WIDTH / 2,
        235 + index * 58,
        label,
        {
          fontSize: "15px",
          fontFamily: "monospace",
          color: "#d9ddff",
          backgroundColor: "#252b52",
          padding: { x: 22, y: 9 },
        },
      ).setOrigin(0.5).setInteractive({ useHandCursor: true });
      button.on("pointerover", () => callbacks.select(index));
      button.on("pointerdown", actions[index]);
      this.content!.add(button);
      return button;
    });

    const hint = this.scene.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT - 34,
      "UP / DOWN to choose  |  SPACE / ENTER to confirm",
      {
        fontSize: "11px",
        fontFamily: "monospace",
        color: "#8f96ba",
      },
    ).setOrigin(0.5);
    this.content.add(hint);
    this.setChoiceSelection(0);
  }

  setChoiceSelection(index: number): void {
    if (this.choiceButtons.length === 0) return;
    this.selectedChoice = Math.min(
      Math.max(index, 0),
      this.choiceButtons.length - 1,
    );
    this.choiceButtons.forEach((button, buttonIndex) => {
      const selected = buttonIndex === this.selectedChoice;
      button.setColor(selected ? "#fff2a8" : "#d9ddff");
      button.setBackgroundColor(selected ? "#48528c" : "#252b52");
    });
  }

  destroy(): void {
    this.clearContent();
    for (const tween of this.ambientTweens) tween.remove();
    this.ambientTweens = [];
  }

  private createBackdrop(theme: ResultTheme): void {
    const background = this.scene.add.graphics().setDepth(0);
    if (theme === "defeat") {
      background.fillStyle(0x09060b, 1);
      background.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      background.fillStyle(0x2a101b, 0.94);
      background.fillCircle(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 15, 220);
      background.lineStyle(2, 0x8e5265, 0.55);
      background.strokeCircle(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 15, 168);
      for (let index = 0; index < 30; index++) {
        const mote = this.scene.add.circle(
          (index * 97 + 31) % GAME_WIDTH,
          (index * 61 + 17) % GAME_HEIGHT,
          index % 5 === 0 ? 2 : 1,
          index % 3 === 0 ? 0xc46a73 : 0x72505f,
          0.55,
        ).setDepth(1);
        this.ambientTweens.push(this.scene.tweens.add({
          targets: mote,
          y: mote.y + 36 + (index % 4) * 8,
          alpha: 0.15,
          duration: 2200 + (index % 6) * 350,
          delay: (index % 8) * 120,
          yoyo: true,
          repeat: -1,
        }));
      }
      return;
    }
    background.fillStyle(0x080b1d, 1);
    background.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    background.fillStyle(0x171c3f, 0.9);
    background.fillCircle(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 25, 205);
    background.lineStyle(2, 0xd9b95b, 0.55);
    background.strokeCircle(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 25, 152);

    for (let index = 0; index < 48; index++) {
      const x = (index * 137 + 43) % GAME_WIDTH;
      const y = (index * 83 + 29) % GAME_HEIGHT;
      const radius = index % 7 === 0 ? 1.5 : 0.8;
      background.fillStyle(index % 3 === 0 ? 0xffe8a3 : 0xaebcff, 0.7);
      background.fillCircle(x, y, radius);
    }

    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2 - 25;
    for (let index = 0; index < 12; index++) {
      const angle = (Math.PI * 2 * index) / 12 - Math.PI / 2;
      const x = centerX + Math.cos(angle) * 152;
      const y = centerY + Math.sin(angle) * 152;
      background.fillStyle(0xffd96b, 0.9);
      background.fillCircle(x, y, 4);
    }
    background.fillStyle(0x9bdcff, 0.8);
    background.fillTriangle(centerX, centerY - 36, centerX - 18, centerY, centerX + 18, centerY);
    background.fillStyle(0xff9b6b, 0.8);
    background.fillTriangle(centerX - 34, centerY + 28, centerX - 2, centerY + 12, centerX - 12, centerY + 48);
    background.fillStyle(0xc5a3ff, 0.8);
    background.fillTriangle(centerX + 34, centerY + 28, centerX + 2, centerY + 12, centerX + 12, centerY + 48);
  }

  private renderNarration(heading: string | undefined, text: string): void {
    if (heading) {
      const headingText = this.scene.add.text(
        GAME_WIDTH / 2,
        132,
        heading.toUpperCase(),
        {
          fontSize: "24px",
          fontFamily: "monospace",
          color: "#ffe38a",
          fontStyle: "bold",
        },
      ).setOrigin(0.5);
      this.content!.add(headingText);
    }
    const body = this.scene.add.text(
      GAME_WIDTH / 2,
      238,
      text,
      {
        fontSize: "16px",
        fontFamily: "monospace",
        color: "#eef0ff",
        align: "center",
        lineSpacing: 8,
        wordWrap: { width: 500, useAdvancedWrap: true },
      },
    ).setOrigin(0.5);
    this.content!.add(body);
  }

  private renderDialogue(speaker: string, text: string): void {
    const panel = this.scene.add.graphics();
    panel.fillStyle(0x11162f, 0.94);
    panel.fillRoundedRect(62, 128, GAME_WIDTH - 124, 245, 12);
    panel.lineStyle(2, 0xd9b95b, 0.7);
    panel.strokeRoundedRect(62, 128, GAME_WIDTH - 124, 245, 12);
    const speakerText = this.scene.add.text(92, 155, speaker, {
      fontSize: "17px",
      fontFamily: "monospace",
      color: "#ffe38a",
      fontStyle: "bold",
    });
    const body = this.scene.add.text(92, 205, text, {
      fontSize: "15px",
      fontFamily: "monospace",
      color: "#eef0ff",
      lineSpacing: 7,
      wordWrap: { width: GAME_WIDTH - 184, useAdvancedWrap: true },
    });
    this.content!.add([panel, speakerText, body]);
  }

  private renderSummary(
    heading: string,
    summary: CampaignEndingSummary,
  ): void {
    const title = this.scene.add.text(
      GAME_WIDTH / 2,
      52,
      heading.toUpperCase(),
      {
        fontSize: "21px",
        fontFamily: "monospace",
        color: "#ffe38a",
        fontStyle: "bold",
      },
    ).setOrigin(0.5);
    this.content!.add(title);

    const panels = this.scene.add.graphics();
    panels.fillStyle(0x0d1229, 0.88);
    panels.fillRoundedRect(28, 88, 282, 350, 10);
    panels.fillRoundedRect(328, 88, 284, 350, 10);
    panels.lineStyle(1, 0x8f96ba, 0.35);
    panels.strokeRoundedRect(28, 88, 282, 350, 10);
    panels.strokeRoundedRect(328, 88, 284, 350, 10);
    this.content!.add(panels);

    const leftLines = [
      "HERO",
      summary.hero,
      "",
      "PARTY",
      ...(summary.party.length > 1
        ? summary.party.slice(1).map((member) => `- ${member}`)
        : ["- No companions recruited"]),
      "",
      `CITIES: ${summary.discoveredCities.current}/${summary.discoveredCities.total}`,
      `CODEX ENTRIES: ${summary.codexEntries}`,
      ...summary.pendingProgression.map((line) => `- ${line}`),
    ];
    const rightLines = [
      "REWARDS",
      ...summary.rewards.map((reward) => `- ${reward}`),
      ...(summary.optionalBonuses.length > 0
        ? ["", "OPTIONAL FEATS", ...summary.optionalBonuses.map((reward) => `- ${reward}`)]
        : []),
      "",
      "KEYSTONE GUARDIANS",
      ...summary.campaignBosses.map((boss) => `- ${boss}`),
    ];
    const left = this.scene.add.text(52, 98, leftLines.join("\n"), {
      fontSize: "11px",
      fontFamily: "monospace",
      color: "#dfe4ff",
      lineSpacing: 4,
      wordWrap: { width: 250, useAdvancedWrap: true },
    });
    const right = this.scene.add.text(340, 98, rightLines.join("\n"), {
      fontSize: "11px",
      fontFamily: "monospace",
      color: "#dfe4ff",
      lineSpacing: 4,
      wordWrap: { width: 250, useAdvancedWrap: true },
    });
    this.content!.add([left, right]);
  }

  private renderCredits(lines: readonly string[]): void {
    const title = this.scene.add.text(
      GAME_WIDTH / 2,
      84,
      "CREDITS",
      {
        fontSize: "25px",
        fontFamily: "monospace",
        color: "#ffe38a",
        fontStyle: "bold",
      },
    ).setOrigin(0.5);
    this.content!.add(title);

    lines.forEach((line, index) => {
      const text = this.scene.add.text(
        GAME_WIDTH / 2,
        155 + index * 48,
        line,
        {
          fontSize: index === 0 ? "20px" : "14px",
          fontFamily: "monospace",
          color: index === lines.length - 1 ? "#fff2a8" : "#dfe4ff",
          align: "center",
        },
      ).setOrigin(0.5);
      this.content!.add(text);
    });
  }

  private createHint(text: string): Phaser.GameObjects.Text {
    const hint = this.scene.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT - 24,
      text,
      {
        fontSize: "11px",
        fontFamily: "monospace",
        color: "#b88d9c",
      },
    ).setOrigin(0.5);
    this.hintTween = this.scene.tweens.add({
      targets: hint,
      alpha: 0.4,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });
    return hint;
  }

  private clearContent(): void {
    this.hintTween?.remove();
    this.hintTween = null;
    this.content?.destroy();
    this.content = null;
    this.choiceButtons = [];
  }
}
