import type { CompanionState } from "../systems/party";
import {
  allocateStatPoint,
  getArmorClass,
  type PlayerStats,
  type ProgressingActorState,
} from "../systems/player";

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
  x: number;
  y: number;
  addText(
    x: number,
    y: number,
    text: string,
    color?: string,
    fontSize?: number,
    width?: number,
  ): void;
  addButton(
    x: number,
    y: number,
    label: string,
    onClick: () => void,
    color?: string,
    width?: number,
  ): void;
  changed(message: string): void;
  nextTarget(): void;
}

export function renderPartyStatus(options: PartyStatusRenderOptions): void {
  const {
    memberName,
    state,
    companion,
    targetName,
    x,
    y,
    addText,
    addButton,
    changed,
    nextTarget,
  } = options;
  let currentY = y;
  addText(x, currentY, `${memberName} Lv.${state.level}`, "#ffd700", 14);
  currentY += 24;
  addText(
    x,
    currentY,
    `HP ${state.hp}/${state.maxHp}  MP ${state.mp}/${state.maxMp}  AC ${getArmorClass(state)}`,
  );
  currentY += 22;
  addText(x, currentY, `XP ${state.xp}  Pending levels ${state.pendingLevelUps}`);
  currentY += 24;
  if (companion) {
    addButton(x, currentY, `Control: ${companion.controlMode}`, () => {
      companion.controlMode = companion.controlMode === "manual"
        ? "gambit"
        : "manual";
      changed("Companion control updated.");
    }, "#aaffaa", 180);
    currentY += 34;
  }
  addText(x, currentY, "Stats", "#c0a060");
  currentY += 20;
  STAT_LABELS.forEach(({ key, label }, index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    addText(x + column * 105, currentY + row * 26, `${label} ${state.stats[key]}`);
    if (state.pendingStatPoints > 0) {
      addButton(x + column * 105 + 62, currentY + row * 26 - 3, "+", () => {
        if (allocateStatPoint(state, key)) changed(`${label} increased.`);
      }, "#88ff88", 26);
    }
  });
  currentY += 64;
  addText(x, currentY, "Equipment", "#c0a060");
  currentY += 20;
  for (const label of [
    state.equippedWeapon?.name ?? "Bare Hands",
    state.equippedArmor?.name ?? "No Armor",
    state.equippedShield?.name ?? "No Shield",
  ]) {
    addText(x + 8, currentY, label);
    currentY += 18;
  }
  addText(x, currentY + 8, `Target: ${targetName}`, "#c0a060");
  addButton(x + 210, currentY + 3, "Next Target", nextTarget, "#bbbbff", 110);
}
