import { getMonster, type Monster } from "../data/monsters";
import type { CutsceneActorCue, CutsceneDialogueStep } from "../data/cutsceneTypes";
import type { QuestNpcId } from "../data/quests";
import { resolveHeroVisualDescriptor, type HeroVisualDescriptor } from "./heroVisuals";
import { resolveNamedNpcVisual, type NpcVisualDescriptor } from "./npcVisuals";
import type { PlayerState } from "./player";

interface PortraitBase {
  readonly actorId: string;
  readonly label: string;
  readonly speaking: boolean;
}

export type CutscenePortrait =
  | (PortraitBase & { readonly kind: "hero"; readonly visual: HeroVisualDescriptor })
  | (PortraitBase & { readonly kind: "npc"; readonly npcId: QuestNpcId; readonly visual: NpcVisualDescriptor })
  | (PortraitBase & { readonly kind: "monster"; readonly monster: Monster });

/** Bind portraits to data-owned actors, never to translated/display-name matching. */
export function resolveCutscenePortraits(
  step: CutsceneDialogueStep,
  player: PlayerState,
  heroDescriptor: HeroVisualDescriptor = resolveHeroVisualDescriptor(player),
): readonly CutscenePortrait[] {
  const actors = step.presentation?.actors ?? [];
  const speaker = actors.find(({ id }) => id === step.speakerActorId);
  if (!speaker) throw new Error(`[cutscene] Missing portrait speaker ${step.speakerActorId}.`);
  const listener = actors.find((actor) => actor.id !== speaker.id
    && (speaker.role === "hero" || actor.role === "hero"));
  const portrait = (actor: CutsceneActorCue): CutscenePortrait => {
    const base = { actorId: actor.id, label: actor.label.replace("{hero}", player.name), speaking: actor.id === speaker.id };
    if (actor.role === "hero") return { ...base, kind: "hero", visual: heroDescriptor };
    if (actor.role === "character") {
      return { ...base, kind: "npc", npcId: actor.npcId, visual: resolveNamedNpcVisual(actor.npcId) };
    }
    const monster = getMonster(actor.id);
    if (!monster) throw new Error(`[cutscene] Missing portrait monster ${actor.id}.`);
    return { ...base, kind: "monster", monster };
  };
  return [portrait(speaker), ...(listener ? [portrait(listener)] : [])];
}
