import type { CodexKnowledgeEntry } from "./codexKnowledge";

export const MINIGAME_CODEX_ENTRIES: readonly CodexKnowledgeEntry[] = [
  {
    id: "historyThreePennants", category: "history",
    name: "The Three Pennants",
    summary: "A local festival invitation links tavern restraint, borrowed-bow precision, and safe harbor sailing.",
    details: [
      "Reading the courier's invitation provides venue directions, never a quest requirement or paid entry.",
      "A personal board compares the visitor's own records with fixed medal benchmarks. It has no network leaderboard.",
    ],
    tags: ["festival", "courier", "minigame"], sortOrder: 989,
    sources: [{
      type: "worldEvent", eventId: "festivalInvitation",
      label: "Meet the festival courier", hint: "Travel ordinary grassland roads during Day or Dusk.",
    }],
  },
  {
    id: "historyCrownAndBones",
    category: "history",
    name: "The Four-Roll Table",
    summary: "Roadwardens devised Crown & Bones as a short game of courage and restraint.",
    details: [
      "Two ordinary six-sided dice mark each throw. Seven is Bones; doubles are Crowns.",
      "A hand lasts at most four throws. Stakes and payouts are capped, and no tavern accepts anything but local in-game gold.",
      "A record remembers what happened. It grants no authority over an oath, quest, or road.",
    ],
    tags: ["tavern", "dice", "minigame"],
    sortOrder: 990,
    sources: [{
      type: "minigame", activityId: "crownAndBones",
      label: "Complete Crown & Bones",
      hint: "Visit the Willow Inn or Desert Rose dice table.",
    }],
  },
  {
    id: "historyArrowFair",
    category: "history",
    name: "One Bow for Every Visitor",
    summary: "The Arrow Fair lends identical bows so precision belongs to the participant, not their class.",
    details: [
      "Five numbered targets form each seeded challenge. Gear, spells, and ability scores never change its scoring.",
      "The steady-aim alternative keeps the same targets and score formula without a moving meter.",
      "Laurels honor a first earned difficulty medal. Practicing remains free and gives no currency or reputation.",
    ],
    tags: ["archery", "festival", "minigame"],
    sortOrder: 991,
    sources: [{
      type: "minigame", activityId: "archery",
      label: "Complete a paid Archery Challenge",
      hint: "Find Willowdale's range or Thornvale's daytime Arrow Fair.",
    }],
  },
  {
    id: "historyHarborRegatta",
    category: "history",
    name: "The Buoykeepers' Pennant",
    summary: "Harbor regattas teach captains to read a course, protect a hull, and finish safely.",
    details: [
      "Sandport and Tidehaven keep ordered buoy circuits with a navigable route through their reefs.",
      "Each entry fixes its course and forecast. An abandoned run cannot undo wear already sustained.",
      "The party stays at the harbor venue; sport never moves the campaign's sailing position or opens a quest route.",
    ],
    tags: ["harbor", "boat", "minigame"],
    sortOrder: 992,
    sources: [{
      type: "minigame", activityId: "regatta",
      label: "Complete a paid Harbor Regatta",
      hint: "Bring a serviceable owned boat to Sandport Docks or Tidehaven's Harbor Quarter.",
    }],
  },
];
