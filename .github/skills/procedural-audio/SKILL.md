---
name: procedural-audio
description: Create and modify procedural audio (music, SFX, footsteps) using Web Audio API in 2D&D
license: MIT
---

# Procedural Audio System

All audio in 2D&D is synthesized at runtime via the Web Audio API — no external audio files.
The main engine lives in `src/systems/audio.ts`; immutable scores and motifs
live in `src/data/music.ts`, pure resolution in `src/systems/music.ts`, and
audio-clock scheduling/owned voices in `src/systems/musicPlayback.ts`.
Focused trap synthesis lives in `src/systems/trapAudio.ts`. See
[`docs/audio.md`](../../../docs/audio.md).

## Architecture

### Audio Engine Singleton
```typescript
import { audioEngine } from "../systems/audio";

// Must be called from a user gesture (click/keydown) — browsers block autoplay
audioEngine.init();
```

### Gain Node Graph
```
AudioContext.destination
  └── masterGain (volume * muted)
       ├── musicGain  (music tracks)
       ├── sfxGain    (attack, chest, dungeon, potion, trap SFX)
       ├── dialogGain (NPC dialogue blips)
       └── footstepGain (terrain footsteps, very low volume)
```

### Volume Persistence
All volume settings are persisted with accessibility settings in the versioned
`2dnd_preferences` document. `audioEngine` subscribes to that shared store so
title and in-game controls update the live gain graph immediately. The legacy
`2dnd_audio_prefs` key migrates automatically and preferences remain separate
from `2dnd_save`.

```typescript
audioEngine.setMasterVolume(0.8);  // Affects all channels
audioEngine.setMusicVolume(0.6);   // Music only
audioEngine.setSFXVolume(0.4);     // SFX + footsteps
audioEngine.setDialogVolume(0.5);  // Dialog blips
audioEngine.toggleMute();          // All persisted to localStorage
```

## Musical Scales

Six scales define the musical character of each location:

| Scale | Mood | Used For |
|-------|------|----------|
| `MAJOR_PENTA` | Happy, bright | Grasslands, villages, highlands, campaign ending |
| `MINOR_PENTA` | Melancholic | Frozen, ancient, mystical areas |
| `HARMONIC_MINOR` | Exotic, desert | Arid, canyon, title screen |
| `DIMINISHED` | Eerie, unsettling | Swamp, murky areas |
| `NATURAL_MINOR` | Dark, moody | Scorched, volcanic, industrial |
| `PHRYGIAN_DOM` | Tense, intense | Boss fights, battle theme |

## BiomeProfile Interface

Every music track is driven by a `BiomeProfile`:

```typescript
interface BiomeProfile {
  baseNote: number;       // Semitone offset from A4 (440Hz)
  scale: Scale;           // Readonly semitone intervals
  bpm: number;            // Beats per minute
  wave: OscillatorType;   // Lead oscillator: "sine" | "square" | "sawtooth" | "triangle"
  padWave: OscillatorType; // Bass/pad oscillator type
  motif?: readonly number[]; // Fixed scale degrees across octaves
}
```

### Adding a New Biome Profile
Add to `BIOME_PROFILES` in `data/music.ts`. The key matches the first word of
chunk names; `BIOME_ALIASES` resolves the original named regions:

```typescript
export const BIOME_PROFILES: Record<string, BiomeProfile> = {
  // ...existing entries...
  Mystic: {
    baseNote: 3, scale: HARMONIC_MINOR, bpm: 74, wave: "triangle", padWave: "sine",
    motif: [0, 2, 4, 1, 3, 2, 0, 1, 7, 5, 6, 3, 4, 2, 1, 0],
  },
};
```

### Adding a New Boss Music Override
Add to `BOSS_OVERRIDES` in `data/music.ts` with the boss monster's ID as key:

```typescript
const BOSS_OVERRIDES: Record<string, Partial<BiomeProfile>> = {
  // ...existing entries...
  ancientLich: { baseNote: -12, bpm: 130, scale: DIMINISHED, wave: "square", padWave: "sawtooth" },
};
```

### Adding a New City Music Override
Add to `CITY_OVERRIDES` in `data/music.ts` with the canonical city name as key.
Give it a distinct 16-note motif as well as tempo/timbre:

```typescript
const CITY_OVERRIDES: Record<string, Partial<BiomeProfile>> = {
  // ...existing entries...
  Starhaven: {
    baseNote: 7, bpm: 110, scale: MAJOR_PENTA, wave: "sine", padWave: "triangle",
    motif: [0, 3, 2, 4, 1, 3, 5, 2, 7, 4, 6, 3, 2, 4, 1, 0],
  },
};
```

### Area routing

Overworld prioritizes dungeon, city, sailing, then the outdoor region.
`playDungeonMusic(dungeonId)` uses `DUNGEON_PROFILES` keyed by canonical dungeon
ID, including Tideglass Grotto. `playCityMusic(cityName, period)` supports the
same dusk/night shift as outdoor music. Shop resolves the canonical `cityId`;
never select a score from a title containing district/shop names.

Always refresh music at a chunk boundary, even if `changeZoneWeather()` returns
false. The engine deduplicates kind/ID/day-night, so updates within an unchanged
area do not restart the phrase. Return from Battle or Shop restores area music
through normal Overworld creation. Music selection never mutates campaign state.

## Orchestral Layers

`buildMusicBar()` develops four four-bar phrases: statement, answer, breath
and lift. Preserve the recognizable opening motif, then use an octave answer,
rests and a countermelody. Layers are deterministic and never consume gameplay RNG:

1. **Lead**: the profile waveform and phrase rhythm
2. **Bass**: low scale-degree anchors on alternate beats
3. **Harmony**: quiet sustained sine voicings
4. **Bell**: offbeat countermelody in lift/danger phrases
5. **Kick/hihat**: bounded percussion, denser in combat and outdoor storms

Night/snow/fog reduce layers. Title, ending and defeat stay drum-free.
Battle derives pressure from the actual combined party HP, including KO actors;
damage/healing refresh context, and 35% HP or less adds urgency at the next bar.
Never restart the track or change tempo for an arrangement update.

`ProceduralMusicPlayer` uses 120-ms lookahead against the audio clock.
Skip missed beats after stalls, pause scheduling for hidden/suspended audio,
and resume only one scheduler. Own every voice/envelope/filter and independently
gained crossfade; disconnect ended/cancelled nodes, cap outgoing tracks at one,
and cancel fanfare voices too. Reuse the engine noise buffer for hats, weather
and traps. Audio variation uses the existing seeded helper with its own stream.
Do not persist any arrangement/clock/voice/pressure state.

### Night Mode
Major scales automatically shift to their relative minor at dusk/night.
Already-minor scales drop the root by two semitones. Dungeon themes ignore
outdoor time. `buildMusicPhrase()` is deterministic and consumes no shared RNG.

## Campaign ending music

`audioEngine.playEndingMusic()` selects the warm, resolved `ENDING_PROFILE`.
Keep `ending` as its own `TrackKind`, include it in `playAllSounds()`, and call
`playTitleMusic()` before Ending hands off to Boot so the ending loop does not
continue on the title screen.

## Defeat result music

`audioEngine.playDefeatMusic()` selects the slow natural-minor
`DEFEAT_PROFILE`. Keep `defeat` as its own `TrackKind`, include it in
`playAllSounds()`, and start it from `DefeatScene` rather than Battle so the
result sequence owns its music lifecycle. Stop the weather overlay first with
`playWeatherSFX(WeatherType.Clear)` without mutating the persisted weather state.

## Campaign cutscene cues

`audioEngine.playCutsceneCue()` accepts the typed cues exported by the cutscene
data hub. Keep cue selection in immutable cutscene definitions and synthesis in
`audio.ts`. Route cues through the existing SFX channel, keep them short, and
disconnect each oscillator and gain node after `ended` so long cutscene chains
do not retain Web Audio graph nodes.

## Adding New SFX

SFX methods follow this pattern using the `sfxGain` node:

```typescript
playNewSFX(): void {
  if (!this.ctx || !this.sfxGain) return;
  const ctx = this.ctx;
  const dest = this.sfxGain;

  // Create oscillators/noise, connect through gain nodes to dest
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 440;
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.25);
}
```

### Existing SFX Catalog

| Method | Sound Design | Trigger |
|--------|-------------|---------|
| `playAttackSFX()` | Swoosh + impact thump + metallic clang | Normal melee/spell hit |
| `playMissSFX()` | Airy highpass whoosh + descending pitch | Missed attack |
| `playCriticalHitSFX()` | Deep slam + noise crunch + rising sting + bell | Critical hit (nat 20) |
| `playChestOpenSFX()` | 4-note ascending twinkle + shimmer | Opening a chest |
| `playDungeonEnterSFX()` | Deep boom + eerie tone + stone scrape | Entering a dungeon |
| `playTrapSFX(type)` | Per-type oscillator/noise profile | Triggering a dungeon trap |
| `playPotionSFX()` | 3 glug bubbles + healing shimmer | Using a consumable |
| `playSpellSFX()` | Rising magical charge + bright release | Spell presentation |
| `playAbilitySFX()` | Compact class-action pulse | Ability presentation |
| `playDefendSFX()` | Two-tone shield brace | Defend presentation |
| `playFleeSFX()` | Rising filtered retreat sweep | Flee attempt |
| `playFaintSFX()` | Descending collapse tone | Once-only faint state |
| `playFootstepSFX(terrain)` | Filtered noise burst, varies by terrain | Every player step |
| `playDialogueBlip(pitch)` | Quick square wave blip | NPC dialogue (future) |
| `playCutsceneCue(cue)` | Typed procedural sting | Campaign cutscene step |
| `playGatheringStartSFX(discipline)` | Discipline-specific start cue | Gathering begins |
| `playGatheringActionSFX(discipline, action)` | Short input feedback | Gathering input |
| `playGatheringResultSFX(success, rarity)` | Success/failure rarity phrase | Gathering resolves |
| `playDiceCue(outcome)` | Deterministic short oscillator phrase; returns cleanup | Already-resolved dice presentation |

### Footstep Terrain Mapping
The `playFootstepSFX(terrainType)` method uses the Terrain enum value to pick filter parameters:
- Grass (0): soft rustle, high filter, low volume
- Sand (4): shifting sound, highpass filter
- Mountain (2): rocky crunch, low filter
- Swamp (14): squelch, lowpass filter
- DungeonFloor (9): echoing stone tap

## Weather Ambient SFX

Weather SFX use looping noise buffers routed through `sfxGain`:
- **Rain**: Lowpass-filtered white noise (800Hz cutoff)
- **Snow**: Very soft highpass noise (3000Hz)
- **Sandstorm**: Bandpass noise (1200Hz, Q=0.8)
- **Storm**: Heavy lowpass rain + periodic sine thunder rumble
- **Fog**: Sustained low sine drone (80Hz)

## Testing

Audio tests verify the API surface and state (no actual audio output in test env).
`music.test.ts` covers every canonical chunk/city/dungeon, distinct melodies,
day/night, unchanged definitions/RNG and track deduplication.
`e2e/area-music.spec.ts` drives actual travel, interiors and returns in muted
headless Chromium:
```typescript
expect(typeof audioEngine.playAttackSFX).toBe("function");
expect(() => audioEngine.playAttackSFX()).not.toThrow(); // no-op without AudioContext
```

## Common Pitfalls
- ❌ Never add external audio files — synthesize everything
- ❌ Never call `audioEngine.init()` outside a user gesture — browsers will block it
- ❌ Don't forget to add new SFX methods to the `playAllSounds()` demo and test file
- Trap profiles belong in `trapAudio.ts`; keep `audio.ts` as the public routing
  surface.
- ❌ Don't use volumes above 0.3 for individual oscillators — they stack up quickly
- ❌ Don't leave ended cutscene oscillators or gain nodes connected
- Battle presentation owns action-cue selection so scenes do not play the same
  synthesized cue twice.
- Dice cues must not use shared RNG or noise buffers. Their scene-owned manager
  cancels cues on replacement, skip, preference changes, and shutdown.
