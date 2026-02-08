/**
 * Player appearance customization options.
 */

export interface PlayerAppearance {
  id: string;
  label: string;
  bodyColor: number;
  skinColor: number;
  legColor: number;
}

export const PLAYER_APPEARANCES: PlayerAppearance[] = [
  { id: "knight",   label: "Knight",        bodyColor: 0x3f51b5, skinColor: 0xffccbc, legColor: 0x1a237e },
  { id: "ranger",   label: "Ranger",        bodyColor: 0x2e7d32, skinColor: 0xffccbc, legColor: 0x1b5e20 },
  { id: "mage",     label: "Mage",          bodyColor: 0x6a1b9a, skinColor: 0xffccbc, legColor: 0x4a148c },
  { id: "rogue",    label: "Rogue",         bodyColor: 0x37474f, skinColor: 0xffccbc, legColor: 0x263238 },
  { id: "paladin",  label: "Paladin",       bodyColor: 0xffd600, skinColor: 0xffccbc, legColor: 0xc0a060 },
  { id: "warlock",  label: "Warlock",       bodyColor: 0xb71c1c, skinColor: 0xd7ccc8, legColor: 0x880e4f },
  { id: "cleric",   label: "Cleric",        bodyColor: 0xeeeeee, skinColor: 0x8d6e63, legColor: 0xbdbdbd },
  { id: "barbarian",label: "Barbarian",     bodyColor: 0x795548, skinColor: 0xa1887f, legColor: 0x4e342e },
];

export function getAppearance(id: string): PlayerAppearance {
  return PLAYER_APPEARANCES.find((a) => a.id === id) ?? PLAYER_APPEARANCES[0];
}
