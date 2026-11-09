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

Battle and Cutscene scenery share the integer scan conversion in `pixelArt.ts`
through `renderers/pixelScenery.ts`. Curves and diagonals use two-pixel raster
steps instead of smooth vector edges. Sky bands, ground grain and scenery
reuse the world's terrain palette. Battle retains its separate depth/weather
bands; Cutscene and Ending still use one static Graphics buffer, distinct
landmarks, bounded plans, and camera overscan.

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

## Battle HUD

Attack, Defend, Abilities, Spells, Items and Flee have separate procedural
pixel-art icons: sword, shield, fist, spellbook, potion and fleeing boot.
Selection borders and unavailable markers are separate from those icons, so
their identity does not disappear during enemy turns.

Hero and companion HP/MP use filled health and mana bars with numeric values
and explicit labels, not character-based meters. The measured party panel
supports every text scale and high contrast. Native labeled meters expose the
same accepted values without adding a live announcement on every change.
Resource updates read the existing actor owners and never interpolate or alter
combat values.

Enemy HUD rows contain only the canonical name/duplicate letter. A real health
bar is added only when `GroupCombatant.hpRevealed` is true under the existing
Codex rule. Unknown HP has no placeholder, bar, native meter or hidden value.
Formation/defend/status tags are not appended to enemy names; formation,
animation and normal combat feedback still convey gameplay state.

## Buildings and rewards

Libraries and guesthouses now occupy three- or four-tile-wide, three-tile-deep
street footprints rather than a miniature one-tile house marker.
`CityChunk.buildings` binds their facade to the same blocked map cells and real
door connection. Boarded residences are scenery only: they have neither a
connection nor an invisible interaction target. Existing shop identities and
street district indexes remain stable.

Use the existing interact control on a building door to enter its room.
Move around counters, stock shelves, reading tables, beds and hearths. Interact
beside a counter to trade, or beside marked sacks, pantries and books to search
or read. Pointer, touch and the gamepad cursor activate the same guarded
interaction. Supplies are explicitly offered rather than treated as theft.
Windows, framed pictures, candle stands, chairs, barrels, woven rugs and table
settings complement the shelves, beds and hearths. Decoration never adds
repeatable rewards or blocks the established counter, book or exit approaches.

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

## Menus and character customization

Menus use a shared dark blue-green folio palette, translucent panels, restrained
warm borders and visible selection ribbons. `systems/uiTheme.ts` resolves serif
Palatino/Georgia headings and Trebuchet/Lucida body text before measurement;
tabular scores use the system monospace stack. Fonts are local system fallbacks,
not downloaded assets. Native name/search/slot dialogs use the matching CSS
tokens in `game.html`. Their 20/16/13-pixel heading/input/hint hierarchy is
separate from the deliberately compact debug and application-header utility text.
`menuIcons.ts` generates original two-tone symbols rather than platform emoji.
The Adventure menu follows its actual two-column grid with all four directions,
including the last partial row; hidden features create no empty action or icon.

Appearance has four categories: **Hair & skin**, **Features**, **Clothing** and
**Details**. Tab or the visible category controls switch pages; up/down chooses
a row and left/right cycles its named choices. Pointer/touch and the gamepad
cursor use the same arrows. The live portrait can turn front, side or back.
Nine hairstyles, nine skin tones, twelve hair colors, eye color, facial hair,
body build, outfit/trouser/trim colors, accessories and optional class headwear
are cosmetic only. Equipment remains visibly layered over clothing.

`systems/appearance.ts` owns choices, creation defaults and unknown
normalization; `heroVisuals.ts` includes every visible override in the shared
descriptor/cache key. Creation leases the same textures as gameplay scenes and
releases them after destroying its sprites. Reflow never randomizes or resets
choices. Schema v28 carries the added optional overrides without changing
legacy appearance, class ranks, stats, equipment or campaign ownership.
