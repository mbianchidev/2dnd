# Procedural area music

[Documentation index](README.md) | [Architecture](architecture.md)

All music and sound effects are synthesized with Web Audio. No external tracks
are downloaded. Master, Music, SFX, Dialog and mute remain shared title/in-game
preferences, separate from campaign saves.

## Area scores

Each region uses its own fixed 16-note motif, scale, root, tempo and lead/bass
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
scores are independent of outdoor time. Battle, boss, victory, title, ending
and defeat themes keep their existing roles. Returning from a battle or shop,
entering/leaving an interior and crossing a region boundary selects the correct
area track. Region changes refresh music even when the weather stays unchanged;
updates inside the same track do not restart its phrase.
Local debug `/time` changes refresh the score's day/night variant immediately.

## Ownership

`src/data/music.ts` owns immutable profiles, scale-degree motifs, city/boss
overrides, dungeon IDs and legacy named-region aliases.
`src/systems/music.ts` resolves profiles and deterministic day/night phrases.
`src/systems/audio.ts` owns the Web Audio graph, crossfades, playback and cues.
Initialize the engine only from a user gesture.

Overworld selects music from authoritative city/dungeon/sailing/location state.
Shop resolves `cityId` before considering its legacy town name. Music does not
modify location, weather, RNG, quests or campaign ownership.

`tests/music.test.ts` covers complete map/interior coverage, distinct motifs,
day/night shifts, immutable definitions and track deduplication.
`e2e/area-music.spec.ts` exercises actual chunk crossings, city/dungeon entry,
shop/battle return and dungeon exit in muted headless Chromium.
