import { PixelSurface } from "./pixelArt";
import { UI_COLORS } from "./uiTheme";
import type { EscapeMenuAction } from "./featureDiscovery";

export type MenuIconId = EscapeMenuAction | "newGame" | "newGamePlus" | "continue" | "saveSlots" | "map" | "equipment";

/** Original two-tone symbols stay consistent across platforms and input sources. */
export function createMenuIconArt(id: MenuIconId): PixelSurface {
  const art = new PixelSurface(20, 20);
  const ink = UI_COLORS.text;
  const gold = UI_COLORS.gold;
  const line = (x1: number, y1: number, x2: number, y2: number): void => art.line(x1, y1, x2, y2, ink);
  if (id === "inventory") {
    art.rect(4, 6, 12, 12, ink);
    art.rect(5, 7, 10, 10, UI_COLORS.panel);
    line(7, 6, 7, 3); line(7, 3, 13, 3); line(13, 3, 13, 6);
    art.rect(8, 10, 4, 3, gold);
  } else if (id === "party") {
    for (const [x, y] of [[5, 7], [14, 7], [10, 4]]) {
      art.ellipse(x!, y!, 2, 2, ink);
      art.rect(x! - 2, y! + 4, 5, 6, x === 10 ? gold : ink);
    }
  } else if (id === "codex" || id === "questJournal" || id === "chronicle" || id === "tips") {
    art.rect(3, 3, 14, 14, ink);
    art.rect(4, 4, 12, 12, UI_COLORS.panel);
    art.rect(6, 3, 1, 14, gold);
    if (id === "codex") { line(9, 7, 14, 7); line(9, 10, 14, 10); line(9, 13, 12, 13); }
    if (id === "questJournal") { line(9, 10, 11, 12); line(11, 12, 15, 7); }
    if (id === "chronicle") { art.ellipse(12, 10, 3, 3, gold); art.rect(12, 7, 1, 4, UI_COLORS.panel); }
    if (id === "tips") { art.rect(11, 7, 2, 5, gold); art.rect(11, 14, 2, 1, gold); }
  } else if (id === "achievements") {
    line(5, 3, 15, 3); line(5, 3, 7, 11); line(15, 3, 13, 11);
    line(7, 11, 13, 11); line(10, 11, 10, 16); line(6, 17, 14, 17);
    line(4, 5, 2, 5); line(2, 5, 3, 9); line(3, 9, 6, 10);
    line(16, 5, 18, 5); line(18, 5, 17, 9); line(17, 9, 14, 10);
    art.rect(8, 5, 4, 4, gold);
  } else if (id === "crafting") {
    line(4, 16, 14, 6); art.rect(10, 3, 7, 4, gold);
    line(5, 4, 15, 15); art.rect(13, 13, 4, 4, ink);
  } else if (id === "gathering") {
    art.ellipse(8, 8, 5, 3, gold);
    art.ellipse(14, 12, 3, 4, ink);
    line(5, 16, 14, 5); line(5, 16, 5, 18);
  } else if (id === "minigames") {
    art.rect(3, 3, 14, 14, ink); art.rect(4, 4, 12, 12, UI_COLORS.panel);
    for (const [x, y] of [[6, 6], [12, 6], [9, 9], [6, 12], [12, 12]]) art.rect(x!, y!, 2, 2, gold);
  } else if (id === "devotion") {
    art.polygon([{ x: 10, y: 1 }, { x: 13, y: 7 }, { x: 18, y: 10 },
      { x: 13, y: 13 }, { x: 10, y: 18 }, { x: 7, y: 13 }, { x: 2, y: 10 }, { x: 7, y: 7 }], ink);
    art.rect(8, 8, 4, 4, gold);
  } else if (id === "settings") {
    art.ellipse(10, 10, 6, 6, ink);
    for (const [x, y, w, h] of [[8, 1, 4, 18], [1, 8, 18, 4]]) art.rect(x!, y!, w!, h!, ink);
    art.ellipse(10, 10, 3, 3, UI_COLORS.panel);
    art.pixel(10, 10, gold);
  } else if (id === "save" || id === "saveSlots") {
    art.rect(3, 2, 14, 16, ink); art.rect(5, 3, 9, 5, UI_COLORS.panel);
    art.rect(6, 11, 8, 5, gold);
    if (id === "saveSlots") art.rect(1, 5, 1, 12, gold);
  } else if (id === "map") {
    line(2, 4, 7, 2); line(7, 2, 12, 5); line(12, 5, 17, 3);
    line(2, 4, 2, 16); line(17, 3, 17, 15); line(2, 16, 7, 14); line(7, 14, 12, 17); line(12, 17, 17, 15);
    line(7, 2, 7, 14); line(12, 5, 12, 17); art.rect(9, 9, 3, 3, gold);
  } else if (id === "equipment") {
    line(5, 16, 15, 3); line(15, 3, 16, 7); line(16, 7, 7, 16); line(5, 12, 10, 17);
    art.rect(4, 16, 3, 3, gold);
  } else if (id === "quit") {
    line(3, 2, 3, 18); line(3, 2, 12, 2); line(12, 2, 12, 6); line(3, 18, 12, 18);
    line(7, 10, 18, 10); line(14, 6, 18, 10); line(18, 10, 14, 14);
    art.rect(5, 4, 2, 12, gold);
  } else {
    art.polygon([{ x: 4, y: 3 }, { x: 16, y: 10 }, { x: 4, y: 17 }], ink);
    if (id === "continue") art.rect(2, 3, 1, 14, gold);
    if (id === "newGame" || id === "newGamePlus") {
      art.rect(12, 12, 7, 2, gold); art.rect(15, 9, 2, 8, gold);
      if (id === "newGamePlus") art.rect(2, 2, 2, 2, gold);
    }
  }
  return art;
}
