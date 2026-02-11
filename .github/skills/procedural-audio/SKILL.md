---
name: procedural-audio
description: Create and modify procedural audio (music, SFX, footsteps) using Web Audio API in 2D&D
license: MIT
---

# Procedural Audio System

All audio in 2D&D is synthesized at runtime via the Web Audio API — no external audio files.
The system lives in `src/systems/audio.ts` (~1,300 lines).

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
       ├── sfxGain    (attack, chest, dungeon, potion SFX)
       ├── dialogGain (NPC dialogue blips)
       └── footstepGain (terrain footsteps, very low volume)
```

### Volume Persistence
All volume settings are persisted to `localStorage` under key `2dnd_audio_prefs`.
The engine loads saved preferences on construction and saves after every setter call.

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
| `MAJOR_PENTA` | Happy, bright | Grasslands, villages, highlands |
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
  scale: Scale;           // Array of semitone intervals
  bpm: number;            // Beats per minute
  wave: OscillatorType;   // Lead oscillator: "sine" | "square" | "sawtooth" | "triangle"
  padWave: OscillatorType; // Bass/pad oscillator type
}
```

### Adding a New Biome Profile
Add to `BIOME_PROFILES` record. The key must match the first word of chunk names:

```typescript
export const BIOME_PROFILES: Record<string, BiomeProfile> = {
  // ...existing entries...
  Mystic: { baseNote: 3, scale: HARMONIC_MINOR, bpm: 74, wave: "triangle", padWave: "sine" },
};
```

### Adding a New Boss Music Override
Add to `BOSS_OVERRIDES` with the boss monster's ID as key:

```typescript
const BOSS_OVERRIDES: Record<string, Partial<BiomeProfile>> = {
  // ...existing entries...
  ancientLich: { baseNote: -12, bpm: 130, scale: DIMINISHED, wave: "square", padWave: "sawtooth" },
};
```

### Adding a New City Music Override
Add to `CITY_OVERRIDES` with the city name as key:

```typescript
const CITY_OVERRIDES: Record<string, Partial<BiomeProfile>> = {
  // ...existing entries...
  Starhaven: { baseNote: 7, bpm: 110, scale: MAJOR_PENTA, wave: "sine", padWave: "triangle" },
};
```

## Orchestral Layers

Every track automatically layers these instruments via `playNote()`:

1. **Lead** — profile's `wave` type at the melody frequency
2. **Pad/Bass** — profile's `padWave` at half frequency, every other beat
3. **Strings** — sine with 5Hz vibrato, sustained every 4 beats
4. **Brass** — sawtooth stab a fifth above, offset every 4 beats
5. **Kick drum** — pitched-down sine (150→40Hz) on even beats
6. **Hihat** — filtered noise burst on odd beats

### Night Mode
Major scales automatically shift to their relative minor at night.
Already-minor scales drop the root by 2–3 semitones for a darker feel.

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
| `playPotionSFX()` | 3 glug bubbles + healing shimmer | Using a consumable |
| `playFootstepSFX(terrain)` | Filtered noise burst, varies by terrain | Every player step |
| `playDialogueBlip(pitch)` | Quick square wave blip | NPC dialogue (future) |

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

Audio tests verify the API surface and state (no actual audio output in test env):
```typescript
expect(typeof audioEngine.playAttackSFX).toBe("function");
expect(() => audioEngine.playAttackSFX()).not.toThrow(); // no-op without AudioContext
```

## Common Pitfalls
- ❌ Never add external audio files — synthesize everything
- ❌ Never call `audioEngine.init()` outside a user gesture — browsers will block it
- ❌ Don't forget to add new SFX methods to the `playAllSounds()` demo and test file
- ❌ Don't use volumes above 0.3 for individual oscillators — they stack up quickly
