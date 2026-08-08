import * as Phaser from "phaser";
import { CITIES } from "../data/map";
import {
  FACTION_DEFINITIONS,
  getFactionName,
  getTownName,
  type FactionId,
  type TownId,
} from "../data/reputation";
import type { PlayerState } from "../systems/player";
import {
  getAlignmentAxisLabel,
  getAlignmentName,
  getAlignmentThresholdExplanation,
  getReputationScore,
  getReputationThresholdExplanation,
  getReputationTier,
} from "../systems/reputation";

function addText(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  x: number,
  y: number,
  text: string,
  color = "#dddddd",
  fontSize = 10,
  width?: number,
): void {
  container.add(scene.add.text(x, y, text, {
    fontSize: `${fontSize}px`,
    fontFamily: "monospace",
    color,
    ...(width ? { wordWrap: { width } } : {}),
  }));
}

const HISTORY_PAGE_SIZE = 10;

export function getSocialSummaryPageCount(player: PlayerState): number {
  return 3 + Math.max(
    1,
    Math.ceil(player.progression.social.history.length / HISTORY_PAGE_SIZE),
  );
}

export function renderSocialSummary(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  player: PlayerState,
  x: number,
  y: number,
  width: number,
  page: number,
): void {
  const social = player.progression.social;
  const pageCount = getSocialSummaryPageCount(player);
  const resolvedPage = Math.min(Math.max(page, 0), pageCount - 1);
  let currentY = y;
  if (resolvedPage === 0) {
    addText(
      scene,
      container,
      x,
      currentY,
      `Alignment: ${getAlignmentName(social.alignment)}`,
      "#ffd700",
      14,
    );
    currentY += 24;
    addText(
      scene,
      container,
      x,
      currentY,
      `Law/Chaos ${social.alignment.lawChaos} [${getAlignmentAxisLabel("lawChaos", social.alignment.lawChaos)}]`,
    );
    currentY += 18;
    addText(
      scene,
      container,
      x,
      currentY,
      `Good/Evil ${social.alignment.goodEvil} [${getAlignmentAxisLabel("goodEvil", social.alignment.goodEvil)}]`,
    );
    currentY += 22;
    for (const explanation of getAlignmentThresholdExplanation()) {
      addText(scene, container, x, currentY, explanation, "#aaaaaa", 8, width);
      currentY += 14;
    }
    currentY += 10;
    addText(scene, container, x, currentY, "Reputation thresholds", "#c0a060");
    currentY += 20;
    addText(
      scene,
      container,
      x,
      currentY,
      getReputationThresholdExplanation(),
      "#aaaaaa",
      9,
      width,
    );
    return;
  }

  if (resolvedPage === 1) {
    addText(scene, container, x, currentY, "Town reputation", "#ffd700", 14);
    currentY += 24;
    for (const city of CITIES) {
      const townId = city.id as TownId;
      const score = getReputationScore(social, "town", townId);
      addText(
        scene,
        container,
        x + 8,
        currentY,
        `${getTownName(townId)}: ${getReputationTier(score).name} (${score})`,
      );
      currentY += 17;
    }
    return;
  }

  if (resolvedPage === 2) {
    addText(scene, container, x, currentY, "Faction reputation", "#ffd700", 14);
    currentY += 24;
    for (const faction of FACTION_DEFINITIONS) {
      const factionId = faction.id as FactionId;
      const score = getReputationScore(social, "faction", factionId);
      addText(
        scene,
        container,
        x + 8,
        currentY,
        `${getFactionName(factionId)}: ${getReputationTier(score).name} (${score})`,
      );
      currentY += 22;
    }
    return;
  }

  addText(scene, container, x, currentY, "Recent causes", "#ffd700", 14);
  currentY += 24;
  const historyPage = resolvedPage - 3;
  const history = social.history.slice().reverse().slice(
    historyPage * HISTORY_PAGE_SIZE,
    (historyPage + 1) * HISTORY_PAGE_SIZE,
  );
  if (history.length === 0) {
    addText(scene, container, x + 8, currentY, "No recorded shifts.", "#888888");
    return;
  }
  for (const entry of history) {
    addText(
      scene,
      container,
      x + 8,
      currentY,
      `${entry.cause}: ${entry.summary}`,
      "#dddddd",
      8,
      width - 8,
    );
    currentY += 30;
  }
}
