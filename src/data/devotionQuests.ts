import type { DevotionQuestId } from "./devotion";
import type { QuestDefinition } from "./quests";

export const DEVOTION_QUESTS: Readonly<Record<DevotionQuestId, QuestDefinition>> = {
  mendTheSpan: {
    id: "mendTheSpan", name: "Mend the Unfinished Span", type: "side",
    summary: "Return a model span to its two makers without claiming either one's work. No affiliation is required.",
    stages: [
      {
        id: "findTheFirstMaker", title: "A place for another hand",
        summary: "Ask Elowen who first made the Span House's hovering tiles.",
        objectives: [{
          id: "askElowenAboutSpan", type: "talk", targetId: "willowdaleArchivist",
          description: "Ask Archivist Elowen about the model span.",
          dialogue: [
            "Rovik's model began here, but the joining piece was made in Ironhold. Neither maker called the span their own.",
            "Ask Brann to keep the joining piece in circulation. Orivane is only a story to some builders; the room left for another hand is useful to everyone.",
          ],
        }],
      },
      {
        id: "returnTheJoiningPiece", title: "An unfinished gift",
        summary: "Take the makers' account to Brann in Ironhold.",
        objectives: [{
          id: "shareSpanWithBrann", type: "talk", targetId: "ironholdWarden",
          description: "Return the joining piece's account to Warden Brann.",
          dialogue: [
            "A bridge that honors only its first maker has already forgotten its purpose.",
            "I'll keep the joining piece beside the unfinished model, with room for a third maker's work.",
          ],
        }],
      },
    ],
    completionRewards: [
      { id: "span.xp", type: "xp", amount: 90, message: "Span makers' thanks: +90 XP" },
      { id: "span.gold", type: "gold", amount: 40, message: "Span work stipend: +40 gold" },
    ],
    outcome: "The makers share the model without asking you to share an affiliation.",
  },
  keepTheEcho: {
    id: "keepTheEcho", name: "Keep the Unwelcome Echo", type: "side",
    summary: "Carry two conflicting crossing accounts between Dunerest and Shadowfen without erasing either. No affiliation is required.",
    stages: [
      {
        id: "hearBothAccounts", title: "Two voices in glass",
        summary: "Ask Zahra to preserve the second account of the crossing.",
        objectives: [{
          id: "askZahraAboutEcho", type: "talk", targetId: "dunerestLorekeeper",
          description: "Hear Lorekeeper Zahra's two crossing accounts.",
          dialogue: [
            "One account says the crossing was safe. The other remembers a boat that did not return.",
            "The Echo Room keeps both. Bring that second voice to Vey; a tidy story is not always a true one.",
          ],
        }],
      },
      {
        id: "returnTheSecondVoice", title: "Neither voice erased",
        summary: "Return the second account to Vey in Shadowfen.",
        objectives: [{
          id: "shareEchoWithVey", type: "talk", targetId: "shadowfenFerryman",
          description: "Return the second account to Ferryman Vey.",
          dialogue: [
            "That missing boat was my teacher's. The safe crossing account belongs beside the loss, not over it.",
            "Keep or decline Selquor's imagined company as you choose. You returned a voice that was never yours to claim.",
          ],
        }],
      },
    ],
    completionRewards: [
      { id: "echo.xp", type: "xp", amount: 90, message: "Echo keepers' thanks: +90 XP" },
      { id: "echo.gold", type: "gold", amount: 40, message: "Account-carrying stipend: +40 gold" },
    ],
    outcome: "Both voices remain in the crossing's record, with no affiliation demanded.",
  },
  shareTheShoal: {
    id: "shareTheShoal", name: "Share the Turning Shoal", type: "side",
    summary: "Carry an open crossing account from Sandport to Tidehaven. Merchant passage works without a boat or affiliation.",
    stages: [
      {
        id: "takeTheOpenChart", title: "An unmarked margin",
        summary: "Ask Sable to send an open chart to Tidehaven.",
        objectives: [{
          id: "askSableAboutShoal", type: "talk", targetId: "sandportHarbormaster",
          description: "Ask Harbormaster Sable about the open island chart.",
          dialogue: [
            "Dren's model has a route no keeper may close. Ossa wants the island chart to follow that example.",
            "Take our account to Tidehaven by merchant route or your own boat. The Shoal Room asks no oath of its passengers.",
          ],
        }],
      },
      {
        id: "shareTheIslandPassage", title: "Room to turn back",
        summary: "Bring the chart account to Glasskeeper Ossa in Tidehaven.",
        objectives: [{
          id: "shareChartWithOssa", type: "talk", targetId: "tidehavenGlasskeeper",
          description: "Share the crossing account with Glasskeeper Ossa.",
          dialogue: [
            "The open margin is the important part. A crossing is not generous if it decides where you must land.",
            "Tessune's Turning Shoal is a made-up ocean; the help you brought to this real crossing is your own choice.",
          ],
        }],
      },
    ],
    completionRewards: [
      { id: "shoal.xp", type: "xp", amount: 90, message: "Shoal keepers' thanks: +90 XP" },
      { id: "shoal.gold", type: "gold", amount: 40, message: "Chart-carrying stipend: +40 gold" },
    ],
    outcome: "Tidehaven keeps an open crossing account for affiliated and unaffiliated travelers alike.",
  },
};
