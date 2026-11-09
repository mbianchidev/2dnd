# Procedural graphics and building exploration

[Documentation index](README.md) | [Architecture](architecture.md) |
[Gameplay](gameplay.md)

## Art pipeline

The game uses original integer-raster pixel art, generated locally without
external images, fonts, audio assets, or gameplay network requests.
`systems/pixelArt.ts` supplies bounded raster shapes, shaded volumes and
coordinate noise. `renderers/pixelTexture.ts` uploads those pixels with nearest
scaling. Presentation never consumes gameplay RNG.

Terrain plans in `systems/terrainArt.ts` resolve neighboring edges and stable
variants. Shorelines, paths, trees, mountains and masonry use textured,
irregular silhouettes rather than colored tile boxes. Connected fountain tiles
are painted as one transparent landmark. Building exteriors have pitched tiled
roofs, shaded facades, doors and windows.

Dungeon definitions declare a presentation-only `visualTheme`: crypt, ice,
forge or grotto. The existing map, level, trap and encounter owners remain
authoritative. The painter supplies the corresponding stone, frost or warm
mineral palette; explored wall torches provide bounded static lighting.

`systems/humanoidArt.ts` shares recognizable faces, hair, hands, clothing,
equipment and poses between heroes, companions and NPCs. Hero textures retain
the existing descriptor and lease registry. Companions share that descriptor
and equipment painter. Named city and story NPCs retain their canonical
palettes. Every monster family uses `systems/monsterArt.ts`, with distinct
anatomy, shaded contours, real idle/action/faint frames and richer boss forms.
Hydras retain five separately aimable heads; the part IDs, defenses and shared
HP rules do not change.

Actor directors switch explicit frames and own movement, reactions, trails and
cleanup. Blade arcs, arrows, elemental spell travel and healing effects consume
resolved scalar outcomes only. Reduced motion removes travel and settles poses
immediately; animation never spends resources or decides an outcome.

Every battle monster stays on the ground, including winged, spectral and boss
forms. Formation rows choose contact points inside the battlefield ground
plane, not above its horizon. Per-frame visible foot anchors exclude transparent
texture padding. Idle breathing, attacks, casting, reactions and fainting keep
that anchor planted; horizontal motion carries the contact shadow with it.
Body targeting and effects use actual sprite bounds rather than assuming a
center-origin sprite.

## Buildings and rewards

Use the existing interact control on a building door to enter its room.
Move around counters, stock shelves, reading tables, beds and hearths. Interact
beside a counter to trade, or beside marked sacks, pantries and books to search
or read. Pointer, touch and the gamepad cursor activate the same guarded
interaction. Supplies are explicitly offered rather than treated as theft.

`data/cityInteriors.ts` appends immutable rooms after the existing city
districts. It never renumbers street districts, changes an island's dock, or
adds a new persisted position field. Room doors reuse city connections and
the existing full-state Overworld restart. Furniture footprints determine both
collision and interaction distance; their scaled bounds also register with
the layout audit.

Offered coins and canonical herbs have fixed, small, once-per-campaign rewards.
The existing `collectedTreasures` ledger stores stable furnishing IDs.
`claimCityInteriorProp()` checks the live room, adjacency, pending activities
and canonical reward before mutation. It saves before feedback, and restores
gold, inventory, knowledge and the exact affected arrays if persistence fails.
Existing equipment links are not replaced.

Library journals unlock Codex history. Three manuscripts can teach modest
extra base spells to explicitly listed caster classes at owned rank four
with the declared permanent casting score of at least 13. These are study
sources, not legacy exceptions or prestige grants. The normalizer recognizes
only canonical study tokens and qualifying owned base ranks; path-only spells
are never granted. NG+ carries the permanent `study:<id>` tokens and learned
knowledge while resetting ordinary room supplies with the world.

Street districts retain the legacy fog keys. Building rooms are fully visible
from their immutable layout and do not add hundreds of redundant saved fog
entries. Wilderness and dungeon exploration remain incremental. Corrupt
out-of-range city indexes recover to the last street district, not an
arbitrary appended room.

Indoor shops retain their original street identity for negotiations and recipe
discovery. Inns, banks, stables, opening hours and Tidehaven shipwright services
continue through their original owners. The city map lists street districts
and the current building, without adding shortcuts into unvisited rooms.

## Exploration HUD and trade menus

The exploration HUD includes a north-up, circular local minimap. It follows the
hero, moves away from the upper-right map edge when needed, and marks known
doors, stairs, towns, supplies and books. Fogged terrain and markers are absent
from its output. Its accessible description exposes the same known information
without announcing every movement step. Menus and dialogue hide the minimap.

Trade menus measure their title, balance, controls, equipment summary and
feedback. Item lists render only whole visible rows without geometry masks.
Arrow keys and the mouse wheel page the list; Enter activates the selected
available row, and Info or `I` opens a paged description. Equipment details page
with their visible control or Tab. Escape closes item details or confirmations
before leaving the shop. These views preserve inventory indexes and the
existing buy/sell, price, protection and action owners.

Dice keep the exact resolved receipt hidden while tumbling. Numbers, selected
die markers, detailed roll feedback, announcements and outcome cues reveal
after the throw stops or is skipped. Instant and reduced motion reveal
immediately. Mechanics do not wait for the presentation; see
[Dice presentation](dice-presentation.md).
