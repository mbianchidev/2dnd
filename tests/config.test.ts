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

  it("returns false for a subdomain of github.io", () => {
    vi.stubGlobal("location", { hostname: "org.github.io" });
    expect(isLocalDev()).toBe(false);
  });

  it("returns false for a non-loopback domain containing github.io", () => {
    vi.stubGlobal("location", { hostname: "github.io.example.com" });
    expect(isLocalDev()).toBe(false);
  });

  it.each(["127.0.0.1", "[::1]", "game.localhost"])(
    "returns true for loopback host %s",
    (hostname) => {
      vi.stubGlobal("location", { hostname });
      expect(isLocalDev()).toBe(true);
    },
  );

  it("returns false for an Electron custom-protocol host", () => {
    vi.stubGlobal("location", { hostname: "2dnd" });
    expect(isLocalDev()).toBe(false);
  });
});
