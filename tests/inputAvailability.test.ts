import { describe, expect, it, vi } from "vitest";
import { hasLostActiveGamepad, InputAvailabilityStore } from "../src/systems/input";
import { BattleDecisionClock } from "../src/systems/battleTiming";

describe("shared input availability", () => {
  it("recovers a lost active controller even when another pad remains connected", () => {
    expect(hasLostActiveGamepad("gamepad", 0, [1])).toBe(true);
    expect(hasLostActiveGamepad("gamepad", 0, [0, 1])).toBe(false);
    expect(hasLostActiveGamepad("keyboard", 0, [1])).toBe(false);
    expect(hasLostActiveGamepad("pointer", 0, [])).toBe(false);
    expect(hasLostActiveGamepad("touch", 0, [])).toBe(false);
    expect(hasLostActiveGamepad("gamepad", null, [])).toBe(false);
  });

  it("starts without a blocked decision and publishes only changes", () => {
    const store = new InputAvailabilityStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.update({ pageVisible: true });
    expect(listener).not.toHaveBeenCalled();
    store.update({ pageVisible: false, windowFocused: false });
    expect(listener).toHaveBeenCalledOnce();
    expect(store.get()).toEqual({
      pageVisible: false, windowFocused: false,
      textEntryActive: false, controllerRecovery: false,
    });
    unsubscribe();
    store.update({ pageVisible: true });
    expect(listener).toHaveBeenCalledOnce();
  });

  it("keeps controller recovery explicit until acknowledgment or a scene reset", () => {
    const store = new InputAvailabilityStore();
    store.update({ controllerRecovery: true });
    store.update({ pageVisible: true, windowFocused: true });
    expect(store.get().controllerRecovery).toBe(true);
    store.acknowledgeControllerRecovery();
    expect(store.get().controllerRecovery).toBe(false);
    store.update({ controllerRecovery: true, textEntryActive: true });
    store.reset();
    expect(store.get().controllerRecovery).toBe(false);
    expect(store.get().textEntryActive).toBe(false);
  });

  it("pauses synchronously even at a one-millisecond timeout boundary", () => {
    const store = new InputAvailabilityStore();
    const clock = new BattleDecisionClock({
      mode: "timed", durationSeconds: 15, timeoutAction: "defend",
    });
    clock.beginTurn("turn:1", "party:hero");
    clock.advance(0);
    clock.advance(14_999);
    const unsubscribe = store.subscribe((state) => {
      clock.setPaused("visibility", !state.pageVisible);
      clock.setPaused("focus", !state.windowFocused);
      clock.setPaused("overlay", state.textEntryActive);
      clock.setPaused("controller", state.controllerRecovery);
    });
    store.update({ controllerRecovery: true, textEntryActive: true });
    clock.advance(1_000_000);
    expect(clock.claimTimeout("turn:1")).toBe(false);
    store.acknowledgeControllerRecovery();
    clock.advance(1_000_000);
    expect(clock.snapshot.decision?.remainingMs).toBe(1);
    store.update({ textEntryActive: false });
    clock.advance(1_000_000);
    clock.advance(1);
    expect(clock.claimTimeout("turn:1")).toBe(true);
    unsubscribe();
  });
});
