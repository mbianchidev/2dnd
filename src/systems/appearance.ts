/**
 * Player cosmetic appearance customization.
 * Handles skin color, hair style, and hair color options —
 * independent of class selection (see classes.ts for class mechanics).
 */

/** Custom appearance overrides (skin color, hair). */
export interface CustomAppearance {
  skinColor: number;
  hairStyle: number; // 0=bald, 1=short, 2=medium, 3=long
  hairColor: number;
}

export const SKIN_COLOR_OPTIONS: { label: string; color: number }[] = [
  { label: "Light", color: 0xffccbc },
  { label: "Tan", color: 0xd7a97c },
  { label: "Medium", color: 0xc68642 },
  { label: "Dark", color: 0x8d6e63 },
  { label: "Deep", color: 0x5d4037 },
];

export const HAIR_STYLE_OPTIONS: { label: string; id: number }[] = [
  { label: "Bald", id: 0 },
  { label: "Short", id: 1 },
  { label: "Medium", id: 2 },
  { label: "Long", id: 3 },
];

export const HAIR_COLOR_OPTIONS: { label: string; color: number }[] = [
  { label: "Black", color: 0x1a1a1a },
  { label: "Brown", color: 0x5d4037 },
  { label: "Blonde", color: 0xffd54f },
  { label: "Red", color: 0xb71c1c },
  { label: "White", color: 0xeeeeee },
  { label: "Blue", color: 0x1565c0 },
];
