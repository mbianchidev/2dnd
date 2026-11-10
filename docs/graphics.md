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

## World city cartography

Every mainland city, Tidehaven and the eligible Starfall Atoll has a distinct
procedural landmark in `data/worldCityArt.ts`. The pure painter in
`systems/worldCityArt.ts` uses three- or four-column, two- or three-row
silhouettes: willow cottages, iron ramparts, harbor sails, snow longhouses,
root platforms, canyon bridges, marsh stilts, orchards, furnaces, oasis domes,
beacons, causeways, a lighthouse and an observatory.

`renderers/worldCities.ts` shares those textures between exploration and both
atlas zoom levels. It draws only explored footprint cells after the canonical
gate is explored. Movement reveals use the same path as initial rendering.
Existing town and secret-island label IDs remain stable for discovery inspection.
These are cartographic extents, not extra entrances or building collision:
the existing gate tile, route, quest barrier, walkability and boat/dock checks
remain authoritative. Starfall keeps its ordinary Water terrain and does not
appear without validated NG+ authority, even after a debug world reveal.

The atlas uses the terrain art palette, a measured header/legend and a
Phaser 4 WebGL mask filter, with the supported geometry mask on Canvas.
Panned map content is intentionally clipped; chrome and detail labels remain
measured and auditable. Region hit areas are clipped to the map viewport, so
hidden portions cannot intercept a control. Drag and click are distinguished
on release. Preference reflow preserves zoom, pan and the selected region;
closing the atlas releases its mask, reflow subscription and owned listeners.

## Battle HUD

Attack, Defend, Abilities, Spells, Items and Flee have separate procedural
pixel-art icons: sword, shield, fist, spellbook, potion and fleeing boot.
Selection borders and unavailable markers are separate from those icons, so
their identity never depends on selection. A quiet bottom-left command folio
appears only for an accepted hero decision. Commands and their native hit
targets disappear during action presentation, enemy/gambit turns and blocking
history views. Selecting Attack keeps the folio and selected command visible
until an enemy is confirmed. Its command hit targets and native buttons remain
disabled while choosing that target; cancelling restores the same selection.
Manual companion choices follow the same accepted-decision input gate.

Hero and companion HP/MP share live procedural portraits in a right-hand stack:
green health, blue mana, explicit values and native labeled meters. **U**, the
visible Compact/Expand control, the controller View button, or the touch HUD
control switches to a small portrait-and-gauge row. Preference v4 stores only
that display choice under `2dnd_preferences`; campaigns are untouched.
Companion scene actors and portraits reuse the same hero descriptor and leased
frames, including owned gear. Both layouts retain supported text scales,
high contrast, current resources and cleanup ownership.

There is no permanent enemy vitals dashboard. A health tooltip appears over
an actively targeted monster only while it is hovered or equivalently focused,
and only when `GroupCombatant.hpRevealed` authorizes its HP. Moving away,
cancelling targeting, action presentation and defeat remove the tooltip and
its native meter. Unknown HP has no placeholder or hidden value. Manual
companion target rows never print enemy HP directly.

The initiative timeline is a thin brass thread of small canonical actor icons,
not a text table. Its current portrait has a larger rim and an arrow; duplicate
monsters keep their letters, and hover/native labels retain full names.
Killed monsters and KO party actors disappear immediately; remaining surprise
turns use the actual ambush queue. It is a read-only projection of stable
combatant IDs, never a second initiative scheduler. It does not expose
initiative totals/modifiers, consume RNG, advance a turn or persist state.

The latest action appears briefly in a light scene-local receipt, then fades.
Reduced motion keeps it static before removal. Dice arithmetic remains in the
same bounded Battle history rather than becoming another permanent caption.
**J**, the Log control, controller Menu/north button, or touch LOG opens the
full history; arrows, wheel or triggers scroll it. Closing it restores the
decision without confirming an action. Reading history pauses a timed budget;
ordinary action notices do not. Handoff, blur and shutdown clear transient
feedback, and no history survives the battle.

## Dialogue portraits

Every dialogue step names a staged `speakerActorId`. Portraits resolve that
stable actor, not a display-name match. The speaking character and listening
hero receive separate framed busts with explicit Speaking/Listening labels.
Hero portraits use the same live descriptor as the stage, including cosmetics
and equipment; named NPCs use their canonical city palette through
`npcVisuals.ts` and the shared `npcArt.ts` painter. Boss portraits retain their
actual monster-family art.

`renderers/cutsceneDialogue.ts` owns the shared Cutscene/Ending dialogue layout,
native announcement, portrait texture leases and preference reflow. Text wraps
at its supported size, and the panel grows from measured copy and captions.
Stage actors move above that measured panel. Reset, replay, step replacement
and shutdown release the previous portraits without changing quests, rewards,
seen/pending IDs or character ownership.

## Buildings and rewards

Libraries and guesthouses now occupy three- or four-tile-wide, three-tile-deep
street footprints rather than a miniature one-tile house marker.
`CityChunk.buildings` binds their facade to the same blocked map cells and real
door connection. Boarded residences are scenery only: they have neither a
connection nor an invisible interaction target. Existing shop identities and
street district indexes remain stable.
Facades sit below actors while roofs stay above them, keeping the hero visible
when standing in a doorway. Both static graphics layers are owned and released
by the map renderer.
Initial rendering and every movement reveal share `citySurface.ts` and
`getOrCreateCityTerrainTexture()`: facade footprints retain bare biome ground,
furniture retains wooden floors and wall decorations retain masonry. Movement
cannot restore the obsolete miniature house tiles behind a full-size facade.

Every explored shop or inn displays a small exterior category banner, even
from the far side of the district. Weapons, armor, magic/potions, general
supplies, banks, mounts and the shipwright have explicit labels; inns say
**INN 24H**. The banner is scenery, not another entrance or interaction target.
Measured placement keeps every banner clear of the minimap, including when
walking moves that HUD to the opposite corner.

Use the existing interact control on a building door to enter its room.
Move around counters, stock shelves, reading tables, beds and hearths. Interact
with the clerk across the counter or from beside them to trade or request an
inn rest. Primary merchants retain their canonical appearance, district clerks
have stable palettes, and resting never removes the innkeeper. Doorways and
clerks share `systems/cityServices.ts` hours: all non-inn services, including
shipwright repairs and upgrades, close during Night and reopen at Dawn. A
visitor already indoors may still leave.

Sacks, pantries and books can be searched or read without floating plus signs,
hand-cursor hints, automatic Search/Read prompts or minimap loot markers.
Existing story guidance remains; ordinary supplies and optional study are
discoveries rather than highlighted objectives. Pointer, touch and the gamepad
cursor still activate the same guarded interactions. Supplies are explicitly
offered rather than treated as theft.
Windows, framed pictures, candle stands, chairs, barrels, woven rugs and table
settings complement the shelves, beds and hearths. Decoration never adds
repeatable rewards or blocks the established counter, book or exit approaches.
Walk-through street buildings also have a woven rug in every connected floor
area. Those rugs are presentation-only and change neither tiles nor collision.

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
doors, stairs and landmarks, not ordinary loot or optional books. Fogged terrain
and markers are absent from its output. Its accessible description exposes the same known information
without announcing every movement step. Menus and dialogue hide the minimap.

Trade menus measure their title, balance, controls, equipment summary and
feedback. Item lists render only whole visible rows without geometry masks.
Arrow keys and the mouse wheel page the list; Enter activates the selected
available row, and Info or `I` opens a paged description. Equipment details page
with their visible control or Tab. Escape closes item details or confirmations
before leaving the shop. These views preserve inventory indexes and the
existing buy/sell, price, protection and action owners.
Negotiate, sale confirmations and item details stay open after their opening
click or tap. Blank panel space does not dismiss a confirmation. Release-based
controls require a matching press on that same live control, so opening,
closing or replacing a menu cannot trigger a control beneath it. Blur and
visibility loss cancel a held choice without spending the negotiation attempt.
Shop keyboard confirms also require a fresh accepted press; holding Enter
through a dialog cancellation cannot buy an item underneath it.

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
