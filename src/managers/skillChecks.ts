import {
  Terrain,
  getTerrainAt,
  getTownBiome,
  hasSparkleAt,
} from "../data/map";
import { getNpcTemplate } from "../data/npcs";
import {
  applyNonlethalDamage,
  formatSkillCheckResult,
  getMinorTreasureGold,
  rollSkillCheck,
  selectExplorationEvent,
} from "../systems/skillChecks";
import { debugPanelLog } from "../config";
import type { ChestData } from "../data/map";
import type { NpcInstance } from "../data/npcs";
import type { NpcSkillChallenge } from "../data/skillChecks";
import type { MapRenderer } from "../renderers/map";
import type { PlayerState } from "../systems/player";
import type { DialogueSystem } from "./dialogue";

export interface SkillCheckManagerCallbacks {
  showMessage: (text: string, color?: string) => void;
  updateHUD: () => void;
  autoSave: () => void;
  revealAround: (radius?: number) => void;
  revealTileSprites: () => void;
}

export class SkillCheckManager {
  constructor(private readonly callbacks: SkillCheckManagerCallbacks) {}

  collectMinorTreasure(
    player: PlayerState,
    mapRenderer: MapRenderer,
  ): boolean {
    const { x, y, chunkX, chunkY } = player.position;
    if (player.position.inDungeon) return false;
    if (!hasSparkleAt(chunkX, chunkY, x, y)) return false;

    const key = `${chunkX},${chunkY},${x},${y}`;
    if (player.progression.collectedTreasures.includes(key)) return false;

    const result = rollSkillCheck(player.stats, "wisdom", 11);
    player.progression.skillChecks[`treasure:${key}`] = result;
    player.progression.collectedTreasures.push(key);
    const goldAmount = getMinorTreasureGold(result.success);
    player.gold += goldAmount;

    const terrain = getTerrainAt(chunkX, chunkY, x, y);
    if (mapRenderer.tileSprites[y]?.[x] && terrain !== undefined) {
      const textureKey = terrain === Terrain.Town
        ? `tile_town_${getTownBiome(chunkX, chunkY, x, y)}`
        : `tile_${terrain}`;
      mapRenderer.tileSprites[y][x].setTexture(textureKey);
    }

    const outcome = result.success
      ? `You uncover the hidden cache: ${goldAmount} gold.`
      : `You miss the cache but recover ${goldAmount} loose gold.`;
    this.callbacks.showMessage(
      `Wisdom check (${formatSkillCheckResult(result)}): ${outcome}`,
      result.success ? "#4fc3f7" : "#ffcc80",
    );
    this.callbacks.updateHUD();
    this.callbacks.autoSave();
    return true;
  }

  checkExplorationEvent(player: PlayerState, terrain: Terrain): boolean {
    const environment = player.position.inDungeon ? "dungeon" : "overworld";
    const event = selectExplorationEvent(terrain, environment);
    if (!event) return false;

    const result = rollSkillCheck(player.stats, event.ability, event.dc);
    const abilityLabel = event.ability.charAt(0).toUpperCase()
      + event.ability.slice(1);
    let consequence = result.success ? event.successText : event.failureText;

    if (result.success) {
      if (event.successGold) {
        player.gold += event.successGold;
        consequence += ` Gained ${event.successGold} gold.`;
      }
      if (event.revealRadius) {
        this.callbacks.revealAround(event.revealRadius);
        this.callbacks.revealTileSprites();
      }
    } else if (event.failureDamage) {
      const previousHp = player.hp;
      player.hp = applyNonlethalDamage(player.hp, event.failureDamage);
      consequence += ` Lost ${previousHp - player.hp} HP.`;
    }

    this.callbacks.showMessage(
      `${abilityLabel} check (${formatSkillCheckResult(result)}): ${consequence}`,
      result.success ? "#88ff88" : "#ff8888",
    );
    debugPanelLog(
      `[CHECK] ${event.id}: ${result.success ? "success" : "failure"} (${result.total}/${result.dc})`,
      true,
    );
    this.callbacks.updateHUD();
    this.callbacks.autoSave();
    return true;
  }

  resolveNpcSkillChallenge(
    player: PlayerState,
    challenge: NpcSkillChallenge,
    npc: NpcInstance,
    dialogueSystem: DialogueSystem,
  ): void {
    const result = rollSkillCheck(
      player.stats,
      challenge.ability,
      challenge.dc,
      { optionId: challenge.approach },
    );
    player.progression.skillChecks[challenge.id] = result;

    let consequence: string;
    if (result.success) {
      player.gold += challenge.successGold;
      consequence = `${challenge.successText} Gained ${challenge.successGold} gold.`;
    } else {
      const lostGold = Math.min(player.gold, challenge.failureGoldLoss ?? 0);
      player.gold -= lostGold;
      consequence = challenge.failureText;
      if (lostGold > 0) consequence += ` Lost ${lostGold} gold.`;
    }

    const approach = challenge.approach === "persuade"
      ? "Persuasion"
      : "Bluff";
    const speaker = getNpcTemplate(npc.templateId)?.label ?? "Citizen";
    dialogueSystem.showSpecialDialogue(
      speaker,
      `${approach} (${formatSkillCheckResult(result)}): ${consequence}`,
    );
    debugPanelLog(
      `[CHECK] ${challenge.id}: ${result.success ? "success" : "failure"} (${result.total}/${result.dc})`,
      true,
    );
    this.callbacks.updateHUD();
    this.callbacks.autoSave();
  }

  resolveChestChecks(player: PlayerState, chest: ChestData): string[] {
    const feedback: string[] = [];
    if (chest.lockDc !== undefined) {
      const checkId = `chest:${chest.id}:lock`;
      const existing = player.progression.skillChecks[checkId];
      const result = existing ?? rollSkillCheck(
        player.stats,
        "dexterity",
        chest.lockDc,
      );
      if (!existing) {
        player.progression.skillChecks[checkId] = result;
        if (!result.success && chest.trapDamage) {
          const previousHp = player.hp;
          player.hp = applyNonlethalDamage(player.hp, chest.trapDamage);
          feedback.push(
            `Dexterity check (${formatSkillCheckResult(result)}): the trap fires for ${previousHp - player.hp} HP.`,
          );
        } else {
          feedback.push(
            `Dexterity check (${formatSkillCheckResult(result)}): lock and trap defeated.`,
          );
        }
      }
    }
    if (chest.secretDc !== undefined) {
      const checkId = `chest:${chest.id}:secret`;
      const existing = player.progression.skillChecks[checkId];
      if (!existing) {
        const result = rollSkillCheck(
          player.stats,
          "wisdom",
          chest.secretDc,
        );
        player.progression.skillChecks[checkId] = result;
        if (result.success && chest.secretGold) {
          player.gold += chest.secretGold;
          feedback.push(
            `Wisdom check (${formatSkillCheckResult(result)}): found ${chest.secretGold} hidden gold.`,
          );
        } else {
          feedback.push(
            `Wisdom check (${formatSkillCheckResult(result)}): no hidden compartment found.`,
          );
        }
      }
    }
    return feedback;
  }
}
