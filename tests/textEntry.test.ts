import { describe, expect, it } from "vitest";
import {
  editTextSelection,
  moveTextKeySelection,
  TEXT_KEY_ROWS,
} from "../src/systems/textEntry";

describe("controller text entry", () => {
  it("navigates the visible keyboard rows without hidden selection gaps", () => {
    expect(moveTextKeySelection({ row: 0, column: 9 }, "down")).toEqual({
      row: 1, column: 9,
    });
    expect(moveTextKeySelection({ row: 3, column: 9 }, "down")).toEqual({
      row: 4, column: 4,
    });
    expect(moveTextKeySelection({ row: 4, column: 4 }, "right")).toEqual({
      row: 4, column: 0,
    });
    expect(moveTextKeySelection({ row: 0, column: 0 }, "up")).toEqual({
      row: 4, column: 0,
    });
    expect(new Set(TEXT_KEY_ROWS.flat().map((key) => key.id)).size).toBe(
      TEXT_KEY_ROWS.flat().length,
    );
  });

  it("replaces a selected name, preserves a cursor and respects length", () => {
    expect(editTextSelection("Hero", 0, 4, "d", 12)).toEqual({
      value: "d", cursor: 1,
    });
    expect(editTextSelection("ac", 1, 1, "b", 3)).toEqual({
      value: "abc", cursor: 2,
    });
    expect(editTextSelection("abc", 1, 1, "d", 3)).toEqual({
      value: "abc", cursor: 1,
    });
    expect(editTextSelection("abcdef", 2, 5, "xyz", 6)).toEqual({
      value: "abxyzf", cursor: 5,
    });
  });

  it("deletes a selection or preceding character without removing the suffix", () => {
    expect(editTextSelection("Hero", 0, 4, "backspace", 12)).toEqual({
      value: "", cursor: 0,
    });
    expect(editTextSelection("abcd", 2, 2, "backspace", 12)).toEqual({
      value: "acd", cursor: 1,
    });
    expect(editTextSelection("abc", 0, 0, "backspace", 12)).toEqual({
      value: "abc", cursor: 0,
    });
    expect(editTextSelection("abc", 1, 2, "clear", 12)).toEqual({
      value: "", cursor: 0,
    });
    expect(editTextSelection("a\u{1f600}b", 3, 3, "backspace", 12)).toEqual({
      value: "ab", cursor: 1,
    });
  });

  it("rejects invalid lengths rather than silently creating an unusable input", () => {
    expect(() => editTextSelection("", 0, 0, "a", 0)).toThrow(/length/i);
    expect(() => editTextSelection("", 0, 0, "a", Number.NaN)).toThrow(/length/i);
  });
});
