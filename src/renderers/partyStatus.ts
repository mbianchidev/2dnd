import type { CompanionState } from "../systems/party";
import { getItemDescription } from "../data/items";
import {
  allocateStatPoint,
  getArmorClass,
  type PlayerStats,
  type ProgressingActorState,
} from "../systems/player";
import { getActorStartingClass, getProgressionDisplayName, getProgressionTracks } from "../systems/classProgression";
import { getPlayerClass } from "../systems/classes";
import { layoutResponsiveGrid, paginateMeasuredItems } from "../systems/layout";
import { getScaledBounds, syncInteractiveHitArea } from "../managers/layout";
import type * as Phaser from "phaser";

const STAT_LABELS: Array<{ key: keyof PlayerStats; label: string }> = [
  { key: "strength", label: "STR" },
  { key: "dexterity", label: "DEX" },
  { key: "constitution", label: "CON" },
  { key: "intelligence", label: "INT" },
  { key: "wisdom", label: "WIS" },
  { key: "charisma", label: "CHA" },
];

export interface PartyStatusRenderOptions {
  memberName: string;
  state: ProgressingActorState;
  companion?: CompanionState;
  targetName: string;
  campaignRulesLabel?: string;
  openCampaignRules?(): void;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  changePage(page: number): void;
  addText(
    x: number,
    y: number,
    text: string,
    color?: string,
    fontSize?: number,
    width?: number,
  ): Phaser.GameObjects.Text;
  addButton(
    x: number,
    y: number,
    label: string,
    onClick: () => void,
    color?: string,
    width?: number,
  ): Phaser.GameObjects.Text;
  changed(message: string): void;
  nextTarget(): void;
  openProgression?(): void;
}

export function renderPartyStatus(options: PartyStatusRenderOptions): void {
  const {
    memberName,
    state,
    companion,
    targetName,
    x,
    y, width, height,
    addText,
    addButton,
    changed,
    nextTarget,
  } = options;
  const rows: Phaser.GameObjects.Text[][] = [];
  const line = (value: string, color = "#dddddd", size = 11): void => {
    rows.push([addText(x, y, value, color, size, width)]);
  };
  line(`${memberName} Lv.${state.level}`, "#ffd700", 14);
  const tracks = getProgressionTracks(state);
  const classLabel = tracks.length <= 2 ? getProgressionDisplayName(state)
    : `${getPlayerClass(getActorStartingClass(state)).label}; ${tracks.length} classes`;
  line(classLabel, "#b8ddff");
  if (!companion && options.openProgression) {
    rows.push([addButton(x, y, "Class progression", options.openProgression, "#aaffcc", Math.min(width, 180))]);
  }
  line(`HP ${state.hp}/${state.maxHp}  MP ${state.mp}/${state.maxMp}  AC ${getArmorClass(state)}`);
  line(`XP ${state.xp}  Pending levels ${state.pendingLevelUps}`);
  if (options.campaignRulesLabel) {
    if (options.openCampaignRules) {
      rows.push([addButton(x, y, `Rules: ${options.campaignRulesLabel} (view)`,
        options.openCampaignRules, "#e5eef6", Math.min(width, 250))]);
    } else line(`Rules: ${options.campaignRulesLabel}`, "#e5eef6");
  }
  if (companion) {
    rows.push([addButton(x, y, `Control: ${companion.controlMode}`, () => {
      companion.controlMode = companion.controlMode === "manual"
        ? "gambit"
        : "manual";
      changed("Companion control updated.");
    }, "#aaffaa", Math.min(width, 180))]);
  }
  line("Stats", "#c0a060");
  const statCells = STAT_LABELS.map(({ key, label }) => {
    const value = addText(x, y, `${label} ${state.stats[key]}`, "#dddddd", 11);
    value.setData("layoutId", `party-stat-${key}`);
    const cell = [value];
    if (state.pendingStatPoints > 0) {
      const plus = addButton(x, y, "+", () => {
        if (allocateStatPoint(state, key)) changed(`${label} increased.`);
      }, "#88ff88", 26);
      plus.setData("layoutId", `party-stat-${key}-increase`);
      cell.push(plus);
    }
    return cell;
  });
  const cellWidth = Math.max(...statCells.map((cell) =>
    cell.reduce((sum, label) => sum + label.displayWidth, 0) + 8
  ));
  const grid = layoutResponsiveGrid({
    availableWidth: width, minColumnWidth: cellWidth, columnGap: 8,
    rowGap: 6, maxColumns: 3, itemHeights: statCells.map((cell) => Math.max(...cell.map((label) => label.displayHeight))),
  });
  for (let index = 0; index < grid.rows; index += 1) rows.push(statCells.slice(index * grid.columns, (index + 1) * grid.columns).flat());
  line("Equipment", "#c0a060");
  for (const label of [
    state.equippedWeapon?.name ?? "Bare Hands",
    state.equippedArmor
      ? `${state.equippedArmor.name}: ${getItemDescription(state.equippedArmor)}` : "No Armor",
    state.equippedShield?.name ?? "No Shield",
  ]) {
    line(label);
  }
  line(`Target: ${targetName}`, "#c0a060");
  rows.push([addButton(x, y, "Next Target", nextTarget, "#bbbbff", 110)]);
  rows.forEach((row) => row.forEach((label) => {
    if (label.style.fixedWidth > 0) {
      label.setWordWrapWidth(label.style.fixedWidth - 12, true).setFixedSize(label.style.fixedWidth, 0);
    }
  }));
  const rowHeights = rows.map((row) => Math.max(...row.map((label) => label.displayHeight)));
  let pages = paginateMeasuredItems(rowHeights, height, 6);
  if (pages.length > 1) pages = paginateMeasuredItems(rowHeights, height - 38, 6);
  const page = Math.max(0, Math.min(options.page, Math.max(0, pages.length - 1)));
  const visible = new Set(pages[page] ?? []);
  let cursor = y;
  rows.forEach((row, index) => {
    row.forEach((label) => {
      label.setVisible(visible.has(index)).setActive(visible.has(index));
      if (label.input) label.input.enabled = visible.has(index);
    });
    if (!visible.has(index)) return;
    let left = x;
    row.forEach((label, cellIndex) => {
      const bounds = getScaledBounds(label);
      const column = row.length > 1 ? Math.floor(cellIndex / (state.pendingStatPoints > 0 ? 2 : 1)) : 0;
      if (row.length > 1 && cellIndex % (state.pendingStatPoints > 0 ? 2 : 1) === 0) left = x + column * (grid.cells[0]!.width + 8);
      label.setPosition(label.x + left - bounds.x, label.y + cursor - bounds.y);
      left += label.displayWidth + 6;
      syncInteractiveHitArea(label);
    });
    cursor += rowHeights[index]! + 6;
  });
  if (pages.length > 1) {
    addButton(x, y + height - 28, `‹ ${page + 1}/${pages.length}`, () =>
      options.changePage((page - 1 + pages.length) % pages.length), "#b8ddff", 78)
      .setData("layoutId", "party-status-page-previous");
    addButton(x + width - 90, y + height - 28, "Next ›", () =>
      options.changePage((page + 1) % pages.length), "#b8ddff", 90)
      .setData("layoutId", "party-status-page-next");
  }
}
