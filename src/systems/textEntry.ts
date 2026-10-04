import type { GridNavigationDirection } from "./layout";

export interface CharacterTextKey {
  readonly kind: "character";
  readonly id: string;
  readonly value: string;
}

export interface CommandTextKey {
  readonly kind: "command";
  readonly id: string;
  readonly label: string;
  readonly command: "shift" | "backspace" | "clear" | "done" | "cancel";
}

export type TextKey = CharacterTextKey | CommandTextKey;

export interface TextKeySelection {
  readonly row: number;
  readonly column: number;
}

export interface TextEditResult {
  readonly value: string;
  readonly cursor: number;
}

function characterKeys(values: string): CharacterTextKey[] {
  return [...values].map((value) => ({
    kind: "character",
    id: `character-${value.charCodeAt(0)}`,
    value,
  }));
}

export const TEXT_KEY_ROWS: readonly (readonly TextKey[])[] = [
  characterKeys("1234567890"),
  characterKeys("qwertyuiop"),
  characterKeys("asdfghjkl'"),
  [
    { kind: "command", id: "shift", label: "Aa", command: "shift" },
    ...characterKeys("zxcvbnm.-"),
  ],
  [
    ...characterKeys(" "),
    { kind: "command", id: "backspace", label: "Delete", command: "backspace" },
    { kind: "command", id: "clear", label: "Clear", command: "clear" },
    { kind: "command", id: "done", label: "Done", command: "done" },
    { kind: "command", id: "cancel", label: "Cancel", command: "cancel" },
  ],
];

export function moveTextKeySelection(
  selection: TextKeySelection,
  direction: GridNavigationDirection,
): TextKeySelection {
  let row = Math.max(0, Math.min(TEXT_KEY_ROWS.length - 1, selection.row));
  let column = Math.max(0, Math.min(TEXT_KEY_ROWS[row]!.length - 1, selection.column));
  if (direction === "up" || direction === "down") {
    row = (row + (direction === "up" ? -1 : 1) + TEXT_KEY_ROWS.length)
      % TEXT_KEY_ROWS.length;
    column = Math.min(column, TEXT_KEY_ROWS[row]!.length - 1);
  } else {
    const count = TEXT_KEY_ROWS[row]!.length;
    column = (column + (direction === "left" ? -1 : 1) + count) % count;
  }
  return { row, column };
}

/** Edit the input's actual selection, not a second controller-owned text value. */
export function editTextSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  insertion: string,
  maximumLength: number,
): TextEditResult {
  if (!Number.isInteger(maximumLength) || maximumLength < 1) {
    throw new Error("Text entry requires a positive integer maximum length");
  }
  const start = Math.max(0, Math.min(value.length, selectionStart));
  const end = Math.max(start, Math.min(value.length, selectionEnd));
  if (insertion === "clear") return { value: "", cursor: 0 };
  if (insertion === "backspace") {
    const preceding = [...value.slice(0, start)];
    const removedLength = preceding[preceding.length - 1]?.length ?? 0;
    const from = start === end ? start - removedLength : start;
    return { value: value.slice(0, from) + value.slice(end), cursor: from };
  }
  const remainingLength = value.length - (end - start);
  const inserted = insertion.slice(0, Math.max(0, maximumLength - remainingLength));
  return {
    value: value.slice(0, start) + inserted + value.slice(end),
    cursor: start + inserted.length,
  };
}
