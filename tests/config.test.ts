import { describe, it, expect, vi, afterEach } from "vitest";
import { isLocalDev } from "../src/config";

describe("isLocalDev", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns false on a github.io domain", () => {
    vi.stubGlobal("location", { hostname: "user.github.io" });
    expect(isLocalDev()).toBe(false);
  });

  it("returns true on localhost", () => {
    vi.stubGlobal("location", { hostname: "localhost" });
    expect(isLocalDev()).toBe(true);
  });

  it("returns true when location is undefined", () => {
    vi.stubGlobal("location", undefined);
    expect(isLocalDev()).toBe(true);
  });
});
