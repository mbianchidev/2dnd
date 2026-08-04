# Inventory presentation

## Ownership and presentation

Hero and companion item ownership remains in each actor's canonical
`inventory` array. Equipment fields continue to reference the exact owned item
objects. Inventory presentation is derived by `src/systems/inventory.ts` and
must never sort, splice, or replace the canonical array.

Presentation preferences use the separate `2dnd_inventory_prefs` local-storage
key:

- sort: type, value, rarity, recent acquisition, or name
- filter: all, equipment, consumables, quest items, or crafting items
- search text

Recent acquisition is the reverse of canonical append order, so it requires no
ownership metadata or save-schema migration. Future crafting items use the
`crafting` item type and already participate in selectors and generated visuals.

## Party and menu access

Press `P` to open party management, then select **Items**. The `Esc` menu also
opens the same Party & Inventory surface directly. `T` remains reserved for
mount control.

Inventory controls:

| Input | Action |
| --- | --- |
| `Up` / `Down` | Move the stable item selection |
| `Page Up` / `Page Down` | Move one visible page |
| `Home` / `End` | Select the first or last result |
| `Enter` | Use, equip, or inspect the selected item |
| `X` | Transfer the selected item to the current target |
| `R` | Cycle sort mode |
| `F` | Cycle filter |
| `/` | Focus search; `Enter` finishes typing |
| `Tab` | Cycle the party target |

Every action is also available through pointer buttons. The manager exposes
semantic inventory actions so future gamepad and mobile controls can invoke the
same behavior without emulating keyboard keys.

## Restrictions

- Equipped items cannot transfer.
- Key items and mounts remain hero-owned.
- Equipment actions target the owning actor.
- Consumables use the existing validated target and consumption rules.
- Sorting, filtering, and search return entries with their original inventory
  indexes, so duplicate items and equipment links remain stable.

Generated item visuals are drawn procedurally from item type and rarity; no
external assets are used.
