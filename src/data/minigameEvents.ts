import { Terrain } from "./mapTypes";
import { TimePeriod } from "../systems/daynight";
import type { WorldEventDefinition } from "./worldEvents";

export const MINIGAME_WORLD_EVENTS: readonly WorldEventDefinition[] = [
  {
    id: "festivalInvitation", family: "traveler",
    title: "An Invitation to the Three Pennants",
    source: "A festival courier",
    prompt: "A courier offers a local invitation: a tavern table, a borrowed bow, and a harbor buoy circuit.",
    weight: 1, cooldownSteps: 30, maxRepeats: 1,
    eligibility: { terrains: [Terrain.Grass], periods: [TimePeriod.Day, TimePeriod.Dusk] },
    choices: [
      {
        id: "readInvitation", label: "Read the venue directions",
        detail: "Discover optional venues; no fee, quest, or alignment change",
        type: "resolve",
        outcome: {
          id: "venuesLearned",
          summary: "Willow Inn hosts Crown & Bones, Willowdale lends a range bow, and Sandport Docks hosts a regatta. Visit to play; all are optional.",
          discoverMinigameVenueIds: ["willowInnTable", "willowdaleRange", "sandportRegatta"],
        },
      },
      {
        id: "continueJourney", label: "Continue your journey",
        detail: "No penalty; venues can still be found in their cities",
        type: "resolve",
        outcome: { id: "invitationDeclined", summary: "The courier wishes you safe roads. The activities remain optional." },
      },
    ],
  },
];
