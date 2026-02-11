---
name: weather-and-daynight
description: Implement weather effects and day/night cycle mechanics in 2D&D
license: MIT
---

# Weather & Day/Night Systems

Two interrelated systems that affect encounters, combat, visuals, and audio.

## Day/Night Cycle (`src/systems/daynight.ts`)

### Cycle Structure
- **Total steps:** 360 (one step per player movement)
- ~9 minutes per full cycle at sustained walking speed

| Period | Steps | Duration | Tint Color |
|--------|-------|----------|------------|
| Dawn   | 0–44  | 45 steps | `0xffd5a0` (warm orange) |
| Day    | 45–219 | 175 steps | `0xffffff` (no tint) |
| Dusk   | 220–264 | 45 steps | `0xffa570` (deep orange) |
| Night  | 265–359 | 95 steps | `0x6688cc` (cool blue) |

### Key Exports

```typescript
import {
  TimePeriod,           // enum: Dawn, Day, Dusk, Night
  CYCLE_LENGTH,         // 360
  getTimePeriod,        // (step: number) → TimePeriod
  getEncounterMultiplier, // Dawn/Day=1.0, Dusk=1.25, Night=1.5
  isNightTime,          // true during Dusk and Night
  PERIOD_TINT,          // Record<TimePeriod, 0xRRGGBB>
  PERIOD_LABEL,         // Record<TimePeriod, "🌅 Dawn" etc.>
} from "../systems/daynight";
```

### Visual Effects
- **Overworld:** Tint applied to every tile sprite via `applyDayNightTint()`
- **Battle:** Background image tinted + celestial body drawn (sun/moon)
  - Dawn: sun low-left (rising)
  - Day: sun upper-left with rays
  - Dusk: sun mid-left (setting, redder)
  - Night: crescent moon upper-left + scattered stars
- **Music:** Night mode shifts major scales to relative minor, darker tone

### Gameplay Effects
- Encounter rate increases at dusk (+25%) and night (+50%)
- Night-exclusive monsters spawn during Dusk and Night periods
- `timeStep` is persisted in save data and passed through all scene transitions

## Weather System (`src/systems/weather.ts`)

### Weather Types

| Type | Visual | Audio | Combat Effect |
|------|--------|-------|--------------|
| Clear | None | None | None |
| Rain | Blue rain particles | Lowpass filtered noise | Accuracy penalty |
| Snow | White slow particles | Soft highpass noise | Accuracy penalty |
| Sandstorm | Tan fast horizontal | Bandpass midrange noise | Accuracy penalty |
| Storm | Heavy rain + lightning | Heavy noise + thunder rumble | Accuracy + monster boost |
| Fog | Large slow blobs | Low sine drone | Accuracy penalty |

### Weather State

```typescript
interface WeatherState {
  current: WeatherType;
  stepsUntilChange: number; // Countdown to next weather check
}

// Create fresh state (starts Clear, 40 steps until first check)
const state = createWeatherState();
```

### Biome-Weighted Probabilities
Each chunk name maps to weather weights. Examples:
- Mountain chunks: high Snow/Fog probability
- Desert chunks: high Sandstorm probability
- Swamp chunks: high Fog/Rain probability
- Tundra chunks: Snow dominant

### Key Functions

```typescript
import {
  WeatherType,
  createWeatherState,
  advanceWeather,         // Step-based countdown, may change weather
  changeZoneWeather,      // Called on chunk transition
  getWeatherAccuracyPenalty,  // Accuracy penalty for combat
  getWeatherEncounterMultiplier, // Encounter rate modifier
  getMonsterWeatherBoost, // Per-monster AC/ATK/DMG bonuses
  WEATHER_TINT,           // Tint colors per weather type
  WEATHER_LABEL,          // HUD labels per weather type
} from "../systems/weather";
```

### Combat Effects
```typescript
// In combat, apply weather penalties:
const weatherPenalty = getWeatherAccuracyPenalty(weatherState.current);
const boost = getMonsterWeatherBoost(monster.id, weatherState.current);
// boost.acBonus, boost.attackBonus, boost.damageBonus
```

### Adding a New Weather Type
1. Add to `WeatherType` enum
2. Add probability weights in `BIOME_WEATHER` records
3. Add accuracy penalty in `WEATHER_ACCURACY_PENALTY`
4. Add encounter multiplier in `WEATHER_ENCOUNTER_MULT`
5. Add tint color in `WEATHER_TINT`
6. Add label in `WEATHER_LABEL`
7. Add particle config in `OverworldScene.updateWeatherParticles()` and `BattleScene.createWeatherParticles()`
8. Add ambient SFX in `audioEngine.playWeatherSFX()`

## Scene Data Flow
Both systems' state must be passed through every scene transition:
```typescript
this.scene.start("NextScene", {
  player: this.player,
  defeatedBosses: this.defeatedBosses,
  bestiary: this.bestiary,
  timeStep: this.timeStep,           // Day/night position
  weatherState: this.weatherState,   // Current weather + countdown
});
```

## Common Pitfalls
- ❌ Don't forget to pass `weatherState` in scene transitions — it resets to Clear otherwise
- ❌ Don't apply weather in dungeons/cities — they force `WeatherType.Clear`
- ❌ Don't forget to call `rerollWeather()` on chunk transitions
- ❌ Don't use hardcoded step numbers — use `getTimePeriod()` and constants
