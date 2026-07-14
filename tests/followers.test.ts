import { describe, expect, it } from "vitest";
import { advanceFollowerTrail } from "../src/managers/companionFollowers";

describe("companion follower trail", () => {
  it("moves each follower into the prior actor tile", () => {
    expect(
      advanceFollowerTrail(
        [
          { x: 4, y: 4 },
          { x: 3, y: 4 },
          { x: 2, y: 4 },
        ],
        { x: 5, y: 4 },
        3,
      ),
    ).toEqual([
      { x: 5, y: 4 },
      { x: 4, y: 4 },
      { x: 3, y: 4 },
    ]);
  });

  it("initializes missing follower positions at the leader tile", () => {
    expect(
      advanceFollowerTrail([], { x: 7, y: 8 }, 2),
    ).toEqual([
      { x: 7, y: 8 },
      { x: 7, y: 8 },
    ]);
  });

  it("trims stale follower positions when the active party shrinks", () => {
    expect(
      advanceFollowerTrail(
        [
          { x: 4, y: 4 },
          { x: 3, y: 4 },
          { x: 2, y: 4 },
        ],
        { x: 5, y: 4 },
        1,
      ),
    ).toEqual([{ x: 5, y: 4 }]);
  });
});
