import { Terrain } from "./mapTypes";
import type { WorldEventDefinition } from "./worldEvents";

export const DEVOTION_WORLD_EVENTS: readonly WorldEventDefinition[] = [
  {
    id: "unfinishedSkySpan", family: "discovery",
    title: "The Unfinished Sky-Span", source: "An Orivane model",
    prompt: "A roadside glass bowl holds a tiny hovering span. Its last tile has fallen beside a traveler's pack.",
    weight: 5, cooldownSteps: 18, maxRepeats: 1,
    eligibility: { terrains: [Terrain.Grass, Terrain.Path, Terrain.Forest] },
    choices: [
      {
        id: "mendSkySpan", label: "Return the fallen tile",
        detail: "Orivane +8; Selquor/Tessune +4 devotion if followed.",
        type: "resolve",
        outcome: {
          id: "skySpanRepaired",
          summary: "You return the floating tile without closing the gap left for the next maker.",
          rewards: [{ id: "skySpanInsight", type: "xp", amount: 30 }],
          futureHooks: [{
            type: "alignment", axis: "goodEvil", delta: 2,
            reasonId: "skySpan.returned",
          }],
        },
      },
      {
        id: "leaveSkySpan", label: "Leave the model as it is",
        detail: "Continue without a promise or devotion change.",
        type: "resolve",
        outcome: { id: "skySpanLeft", summary: "The unfinished span remains available to the next traveler." },
      },
    ],
  },
  {
    id: "fallenEchoGlass", family: "traveler",
    title: "The Fallen Echo Glass", source: "A Selquor account carrier",
    prompt: "A carrier searches the roadside for a hollow glass account. A merchant offers coin to claim its voice instead.",
    weight: 5, cooldownSteps: 18, maxRepeats: 1,
    eligibility: { terrains: [Terrain.Grass, Terrain.Path, Terrain.Forest, Terrain.Canyon] },
    choices: [
      {
        id: "returnEchoGlass", label: "Return the account to its speaker",
        detail: "Selquor +8; Orivane/Tessune +4 devotion if followed.",
        type: "resolve",
        outcome: {
          id: "echoGlassReturned",
          summary: "The carrier's account returns to its own voice, including the parts nobody wanted to hear.",
          rewards: [{ id: "echoReturnInsight", type: "xp", amount: 30 }],
          futureHooks: [{
            type: "alignment", axis: "goodEvil", delta: 3,
            reasonId: "echoGlass.returned",
          }],
        },
      },
      {
        id: "claimEchoGlass", label: "Sell the account as your own",
        detail: "30 gold; Selquor -12, Orivane -4, Tessune -2 devotion.",
        type: "resolve",
        outcome: {
          id: "echoGlassTaken",
          summary: "The merchant pays for the voice. Its speaker is left without the glass account.",
          rewards: [{ id: "echoSaleGold", type: "gold", amount: 30 }],
          futureHooks: [{
            type: "alignment", axis: "goodEvil", delta: -3,
            reasonId: "echoGlass.claimed",
          }],
        },
      },
    ],
  },
  {
    id: "turningShoalBeacon", family: "shrine",
    title: "The Turning Shoal Beacon", source: "A Tessune channel model",
    prompt: "A blueglass model floats above a shoal. Its open channel points toward a safe crossing for every passing boat.",
    weight: 5, cooldownSteps: 18, maxRepeats: 1,
    eligibility: { terrains: [Terrain.Water] },
    choices: [
      {
        id: "shareShoalBeacon", label: "Leave the safe crossing marked",
        detail: "Tessune +8; Orivane/Selquor +4 devotion if followed.",
        type: "resolve",
        outcome: {
          id: "beaconShared",
          summary: "The blueglass channel remains open for the next crew. It names no shore they must choose.",
          rewards: [{ id: "shoalSharedInsight", type: "xp", amount: 30 }],
          futureHooks: [{
            type: "reputation", factionId: "roadwardens", delta: 3,
            reasonId: "shoalBeacon.shared",
          }],
        },
      },
      {
        id: "pocketShoalBeacon", label: "Sell the blueglass model",
        detail: "30 gold; Tessune -12, Orivane -4, Selquor -2 devotion.",
        type: "resolve",
        outcome: {
          id: "beaconPocketed",
          summary: "The model leaves the shoal. Other crews must find their own safe crossing.",
          rewards: [{ id: "shoalSaleGold", type: "gold", amount: 30 }],
          futureHooks: [{
            type: "alignment", axis: "goodEvil", delta: -3,
            reasonId: "shoalBeacon.pocketed",
          }],
        },
      },
    ],
  },
];
