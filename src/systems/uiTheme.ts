import type * as Phaser from "phaser";

export const UI_FONT_DISPLAY = '"Palatino Linotype", Palatino, Georgia, serif';
export const UI_FONT_BODY = '"Trebuchet MS", "Lucida Grande", sans-serif';
export const UI_FONT_DATA = 'Menlo, Consolas, monospace';

export const UI_COLORS = {
  backdrop: 0x10191f,
  panel: 0x17232b,
  raised: 0x263942,
  selected: 0x38544f,
  border: 0xc3b99e,
  gold: 0xd9c38f,
  text: 0xf3eddd,
  muted: 0xb9c7c7,
  accent: 0x91c6bb,
} as const;

export const UI_CSS = {
  panel: "#17232b", raised: "#263942", selected: "#38544f",
  gold: "#d9c38f", text: "#f3eddd", muted: "#b9c7c7", accent: "#91c6bb",
} as const;

const LEGACY_BACKGROUNDS: ReadonlySet<string> = new Set([
  "#1a1a2e", "#2a2a4e", "#20273a", "#29324a", "#334351", "#333355", "#222244",
]);

/** Resolve typography before text is measured; explicit specialty fonts remain untouched. */
export function getGameTextStyle(
  style: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  const size = Number.parseFloat(String(style.fontSize ?? 16));
  const fontFamily = !style.fontFamily || style.fontFamily === "monospace"
    ? size >= 18 ? UI_FONT_DISPLAY : UI_FONT_BODY : style.fontFamily;
  return {
    ...style, fontFamily,
    ...(style.backgroundColor && LEGACY_BACKGROUNDS.has(style.backgroundColor.toLowerCase())
      ? { backgroundColor: UI_CSS.raised } : {}),
  };
}
