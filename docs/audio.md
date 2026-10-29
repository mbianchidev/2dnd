# Procedural area music

[Documentation index](README.md) | [Architecture](architecture.md)

All music and sound effects are synthesized with Web Audio. No external tracks
are downloaded. Master, Music, SFX, Dialog and mute remain shared title/in-game
preferences, separate from campaign saves.

## Area scores

Each region uses its own recognizable 16-note motif, scale, root, tempo and lead/bass
timbres. City interiors use the city's score rather than the surrounding chunk's
music. Named shops retain their canonical city's score, including when their
display title contains district and shop names.

| Area | Musical character |
| --- | --- |
| Plains and Heartlands | Bright pastoral pentatonic |
| Woodlands and ancient forests | Wandering woodland or mystical minor motifs |
| Frozen reaches and highlands | Spacious cold melodies or rising mountain phrases |
| Deserts and canyons | Harmonic-minor travelling motifs |
| Marshes and scorched lands | Diminished or driving minor melodies |
| Cities and island settlements | Individual town themes, harbor shanty or atoll reverie |
| Heartlands Crypt | Low, slow natural minor |
| Frost Cavern | Sparse minor-pentatonic echoes |
| Volcanic Forge | Driving square-wave Phrygian dominant |
| Tideglass Grotto | Subdued, rippling minor-pentatonic phrases |
| Sailing | A separate sea motif |

Dusk/night shifts outdoor and city scores to their darker variant. Dungeon
scores are independent of outdoor time and weather. Title and ending music clear
outdoor ambience without changing saved weather. Battle, boss, victory, title, ending
and defeat themes keep their existing roles. Returning from a battle or shop,
entering/leaving an interior and crossing a region boundary selects the correct
area track. Region changes refresh music even when the weather stays unchanged;
updates inside the same track do not restart its phrase.
Local debug `/time` changes refresh the score's day/night variant immediately.

## Adaptive arrangements

Scores develop through four four-bar phrases: statement, answer, breath and
lift. The opening preserves the area's melody; later phrases introduce an
octave response, breathing space and a bell countermelody over sustained harmony.
Night, snow and fog use quieter, sparser layers. Outdoor storms add rhythmic
energy, while title, ending and defeat scores remain free of combat drums.

Battle and boss scores derive pressure from the active party's actual combined
HP, including knocked-out allies. At 35% remaining HP or less, additional offbeat
percussion and a countermelody increase urgency. Healing and damage refresh that
read-only context. Layer changes take effect at the next bar, never restart the
track or change its tempo, and cannot affect decisions, difficulty or rewards.

## Playback and resource ownership

The player schedules notes against the AudioContext clock with a 120-ms
lookahead, rather than sounding notes on JavaScript interval ticks. A delayed
tab skips missed beats instead of allocating a burst of catch-up voices.
Suspended audio and hidden documents stop music scheduling; returning resumes
without duplicating a scheduler.

Independent track gains overlap for a short crossfade. Every oscillator, noise
source, filter and envelope disconnects after playback or cancellation.
Rapid travel retains at most one outgoing track; stop also cancels fanfare
voices and delayed cleanup. Weather refreshes reuse an unchanged overlay.
Ambience, percussion and traps share one noise buffer, and audio variation uses
an isolated seeded stream instead of consuming gameplay RNG.

All arrangement, pressure, clock and voice state is runtime-only. Existing
Master, Music, SFX, Dialog and mute controls are unchanged; there are no new save
fields or settings.

## Ownership

`src/data/music.ts` owns immutable profiles, scale-degree motifs, city/boss
overrides, dungeon IDs and legacy named-region aliases.
`src/systems/music.ts` resolves profiles, deterministic bars and party pressure.
`src/systems/musicPlayback.ts` owns the music clock, voices and crossfades.
`src/systems/audio.ts` routes tracks/cues and owns the shared Web Audio channels.
Initialize the engine only from a user gesture.

Overworld selects music from authoritative city/dungeon/sailing/location state.
Shop resolves `cityId` before considering its legacy town name. Music does not
modify location, weather, RNG, quests or campaign ownership.

`tests/music.test.ts` covers complete map/interior coverage and track deduplication.
`musicArrangement.test.ts`, `musicPlayback.test.ts` and `audioLifecycle.test.ts`
cover deterministic form, adaptive layers, exact scheduling, bounded voices,
stalled/hidden/suspended clocks, crossfades, cancellation and shared noise.
`e2e/area-music.spec.ts` exercises actual chunk crossings, city/dungeon entry,
shop/battle return, dungeon exit, weather changes, phrase development and
damage-driven battle pressure in muted headless Chromium.
