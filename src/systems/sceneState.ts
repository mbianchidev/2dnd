import type { SavedSpecialNpc } from "../data/npcs";
import type { CodexData } from "./codex";
import type { PlayerState } from "./player";
import type { WeatherState } from "./weather";

export interface SharedSceneState {
  player: PlayerState;
  defeatedBosses: Set<string>;
  codex: CodexData;
  timeStep: number;
  weatherState: WeatherState;
  savedSpecialNpcs: SavedSpecialNpc[];
}

export function createSharedSceneState(
  state: SharedSceneState,
): SharedSceneState {
  return {
    player: state.player,
    defeatedBosses: state.defeatedBosses,
    codex: state.codex,
    timeStep: state.timeStep,
    weatherState: state.weatherState,
    savedSpecialNpcs: state.savedSpecialNpcs,
  };
}
