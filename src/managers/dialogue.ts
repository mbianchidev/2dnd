import type { CityData } from "../data/map";
import { MAP_WIDTH, MAP_HEIGHT } from "../data/map";
import {
  getNpcTemplate,
  getNpcDialogue,
  getShopkeeperDialogue,
  ANIMAL_DIALOGUES,
} from "../data/npcs";
import type { NpcInstance } from "../data/npcs";
import { audioEngine } from "../systems/audio";
import { getTimePeriod, TimePeriod } from "../systems/daynight";
import { TILE_SIZE } from "../config";

/**
 * Manages NPC dialogue boxes — regular city NPCs, animals, and special overworld NPCs.
 */
export class DialogueSystem {
  private scene: Phaser.Scene;
  private dialogueOverlay: Phaser.GameObjects.Container | null = null;
  private questSequence: {
    speakerName: string;
    pages: string[];
    pageIndex: number;
    lineText: Phaser.GameObjects.Text;
    pageText: Phaser.GameObjects.Text;
    onComplete: () => void;
  } | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Show a dialogue box for a special overworld NPC (quest giver, etc.). */
  showSpecialDialogue(speakerName: string, line: string): void {
    this.dismissDialogue();

    const container = this.scene.add.container(0, 0).setDepth(50);
    const boxW = MAP_WIDTH * TILE_SIZE - 20;
    const boxH = 46;
    const boxX = 10;
    const boxY = MAP_HEIGHT * TILE_SIZE;

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.95);
    bg.fillRoundedRect(boxX, boxY, boxW, boxH, 4);
    bg.lineStyle(2, 0x4dd0e1, 1);
    bg.strokeRoundedRect(boxX, boxY, boxW, boxH, 4);
    container.add(bg);

    const nameText = this.scene.add.text(boxX + 8, boxY + 4, `✦ ${speakerName}`, {
      fontSize: "10px", fontFamily: "monospace", color: "#4dd0e1",
    });
    container.add(nameText);

    const lineText = this.scene.add.text(boxX + 8, boxY + 18, line, {
      fontSize: "11px", fontFamily: "monospace", color: "#ddd",
      wordWrap: { width: boxW - 16 },
    });
    container.add(lineText);

    this.dialogueOverlay = container;

    // Auto-dismiss after 3 seconds
    this.scene.time.delayedCall(3000, () => {
      if (this.dialogueOverlay === container) {
        this.scene.tweens.add({ targets: container, alpha: 0, duration: 500, onComplete: () => {
          if (this.dialogueOverlay === container) { container.destroy(); this.dialogueOverlay = null; }
        }});
      }
    });
  }

  /** Show a dialogue box for a city NPC, including shopkeepers. */
  showNpcDialogue(npcDef: NpcInstance, npcIndex: number, city: CityData, timeStep: number): void {
    this.dismissDialogue();

    const tpl = getNpcTemplate(npcDef.templateId);
    if (!tpl) return;

    let speakerName: string;
    let line: string;
    const isNight = getTimePeriod(timeStep) === TimePeriod.Night;

    if (npcDef.shopIndex !== undefined) {
      const shop = city.shops[npcDef.shopIndex];
      if (shop) {
        speakerName = shop.name;
        line = getShopkeeperDialogue(shop.type, npcIndex);
      } else {
        speakerName = npcDef.name ?? tpl.label;
        line = getNpcDialogue(city.id, npcIndex, tpl.ageGroup, npcDef.templateId, isNight);
      }
    } else {
      speakerName = npcDef.name ?? tpl.label;
      line = getNpcDialogue(city.id, npcIndex, tpl.ageGroup, npcDef.templateId, isNight);
    }

    if (audioEngine.initialized) audioEngine.playDialogueBlips(line);

    const container = this.scene.add.container(0, 0).setDepth(50);
    const boxW = MAP_WIDTH * TILE_SIZE - 20;
    const boxH = 46;
    const boxX = 10;
    const boxY = MAP_HEIGHT * TILE_SIZE;

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.95);
    bg.fillRoundedRect(boxX, boxY, boxW, boxH, 4);
    bg.lineStyle(2, 0xc0a060, 1);
    bg.strokeRoundedRect(boxX, boxY, boxW, boxH, 4);
    container.add(bg);

    const nameText = this.scene.add.text(boxX + 8, boxY + 4, speakerName, {
      fontSize: "10px", fontFamily: "monospace", color: "#ffd700",
    });
    container.add(nameText);

    const lineText = this.scene.add.text(boxX + 8, boxY + 18, line, {
      fontSize: "11px", fontFamily: "monospace", color: "#ddd",
      wordWrap: { width: boxW - 16 },
    });
    container.add(lineText);

    this.dialogueOverlay = container;

    // Auto-dismiss after 3 seconds (shops dismiss earlier via handleAction flow)
    this.scene.time.delayedCall(3000, () => {
      if (this.dialogueOverlay === container) {
        this.scene.tweens.add({ targets: container, alpha: 0, duration: 500, onComplete: () => {
          if (this.dialogueOverlay === container) { container.destroy(); this.dialogueOverlay = null; }
        }});
      }
    });
  }

  /** Show a brief auto-dismissing dialogue for an animal sprite. */
  showAnimalDialogue(spriteName: string): void {
    this.dismissDialogue();

    const pool = ANIMAL_DIALOGUES[spriteName];
    if (!pool) return;

    const line = pool[Math.floor(Math.random() * pool.length)];
    const rawName = spriteName.replace("sprite_", "");
    const speakerName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

    if (audioEngine.initialized) audioEngine.playDialogueBlips(line, -5);

    const container = this.scene.add.container(0, 0).setDepth(50);
    const boxW = MAP_WIDTH * TILE_SIZE - 20;
    const boxH = 46;
    const boxX = 10;
    const boxY = MAP_HEIGHT * TILE_SIZE;

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.95);
    bg.fillRoundedRect(boxX, boxY, boxW, boxH, 4);
    bg.lineStyle(2, 0xc0a060, 1);
    bg.strokeRoundedRect(boxX, boxY, boxW, boxH, 4);
    container.add(bg);

    const nameText = this.scene.add.text(boxX + 8, boxY + 4, speakerName, {
      fontSize: "11px", fontFamily: "monospace", color: "#ffd700",
    });
    container.add(nameText);

    const lineText = this.scene.add.text(boxX + 8, boxY + 18, line, {
      fontSize: "12px", fontFamily: "monospace", color: "#ffffff",
      wordWrap: { width: boxW - 16 },
    });
    container.add(lineText);

    this.dialogueOverlay = container;
    this.scene.time.delayedCall(2000, () => {
      if (this.dialogueOverlay === container) {
        container.destroy();
        this.dialogueOverlay = null;
      }
    });
  }

  /**
   * Show a manual multi-page quest conversation.
   * The callback runs once after the player acknowledges the final page.
   */
  showQuestDialogue(
    speakerName: string,
    pages: string[],
    onComplete: () => void,
  ): void {
    if (pages.length === 0) {
      throw new Error("[dialogue] Quest dialogue requires at least one page");
    }
    this.dismissDialogue();

    const container = this.scene.add.container(0, 0).setDepth(50);
    const boxW = MAP_WIDTH * TILE_SIZE - 20;
    const boxH = 58;
    const boxX = 10;
    const boxY = MAP_HEIGHT * TILE_SIZE - 12;

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x15152a, 0.98);
    bg.fillRoundedRect(boxX, boxY, boxW, boxH, 4);
    bg.lineStyle(2, 0x7e57c2, 1);
    bg.strokeRoundedRect(boxX, boxY, boxW, boxH, 4);
    container.add(bg);

    const nameText = this.scene.add.text(boxX + 8, boxY + 4, speakerName, {
      fontSize: "10px",
      fontFamily: "monospace",
      color: "#d1c4e9",
    });
    container.add(nameText);

    const lineText = this.scene.add.text(boxX + 8, boxY + 18, pages[0], {
      fontSize: "11px",
      fontFamily: "monospace",
      color: "#ffffff",
      wordWrap: { width: boxW - 16 },
    });
    container.add(lineText);

    const pageText = this.scene.add.text(
      boxX + boxW - 8,
      boxY + boxH - 10,
      this.questPageLabel(0, pages.length),
      {
        fontSize: "8px",
        fontFamily: "monospace",
        color: "#b39ddb",
      },
    ).setOrigin(1, 0.5);
    container.add(pageText);

    this.dialogueOverlay = container;
    this.questSequence = {
      speakerName,
      pages: [...pages],
      pageIndex: 0,
      lineText,
      pageText,
      onComplete,
    };
    if (audioEngine.initialized) audioEngine.playDialogueBlips(pages[0]);
  }

  /** Advance quest dialogue, returning true when Space was consumed. */
  advanceDialogue(): boolean {
    const sequence = this.questSequence;
    if (!sequence) return false;

    if (sequence.pageIndex < sequence.pages.length - 1) {
      sequence.pageIndex++;
      const page = sequence.pages[sequence.pageIndex];
      sequence.lineText.setText(page);
      sequence.pageText.setText(
        this.questPageLabel(sequence.pageIndex, sequence.pages.length),
      );
      if (audioEngine.initialized) audioEngine.playDialogueBlips(page);
      return true;
    }

    const onComplete = sequence.onComplete;
    this.dismissDialogue();
    onComplete();
    return true;
  }

  private questPageLabel(pageIndex: number, pageCount: number): string {
    const action = pageIndex >= pageCount - 1 ? "Finish" : "Next";
    return `[SPACE] ${action}  ${pageIndex + 1}/${pageCount}`;
  }

  /** Dismiss the current dialogue box, if any. */
  dismissDialogue(): void {
    if (this.dialogueOverlay) {
      this.dialogueOverlay.destroy();
      this.dialogueOverlay = null;
    }
    this.questSequence = null;
  }

  /** Returns whether a dialogue box is currently open. */
  isDialogueOpen(): boolean {
    return !!this.dialogueOverlay;
  }
}
