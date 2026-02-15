# Shop Item Selling Feature

## Overview
This feature enables players to sell unwanted items from their inventory in any shop, providing better inventory management and a full item economy.

## Implementation Summary

### Core Functions

#### `getSellValue(item: Item): number` (src/data/items.ts)
- Calculates sell value as 50% of purchase cost (standard RPG convention)
- Returns 0 for non-sellable items (treasures, quest items)
- Ensures minimum sell value of 1g

#### `canSellItem(item: Item): boolean` (src/data/items.ts)
- Determines if an item can be sold
- Returns false for treasures (cost=0) and quest items (dungeon key)

#### `isLastEquipment(player: PlayerState, item: Item): boolean` (src/systems/player.ts)
- Prevents selling the last weapon, armor, or shield
- Ensures player always has basic equipment

#### `sellItem(player: PlayerState, itemIndex: number, sellValue: number)` (src/systems/player.ts)
- Awards gold to player
- Removes item from inventory
- Returns success status and message

### UI Features

#### Tab-Based Interface
- **Buy Tab**: Original shop functionality with owned count indicator
- **Sell Tab**: Lists inventory items with sell prices and restrictions

#### Visual Feedback
- Color-coded items:
  - White/light gray: Available for transaction
  - Gray: Unavailable (owned, insufficient funds, restricted)
  - Red: Level-locked items
  - Gold: Hovered items
- Status tags:
  - `[OWNED]`: Equipment already owned
  - `[UNSELLABLE]`: Quest items or treasures
  - `[LAST EQUIPMENT]`: Prevents selling last piece
  - `(owned: X)`: Consumable count on buy tab

#### Consistent Format
All items displayed as: `Icon Name Description Price [Tag]`

### Sell Restrictions

1. **Quest Items**: Cannot sell dungeon key
2. **Treasures**: Cannot sell items with cost=0 (chest rewards)
3. **Last Equipment**: Cannot sell last weapon/armor/shield
4. **Equipped Items**: Can sell if not last of type

### Economic Balance

- **Buy Price**: Original item cost (can be discounted)
- **Sell Price**: 50% of original cost
- **Net Loss**: Players lose value when buying and selling (intended game mechanic)

Example:
- Buy Potion: 15g
- Sell Potion: 7g
- Net Loss: 8g

## Testing

### Test Coverage (19 tests in tests/shop.test.ts)

1. **Sell Value Calculation**
   - 50% of cost for regular items
   - 0 for treasures and quest items
   - Minimum 1g enforcement
   - Floor behavior verification

2. **Sell Restrictions**
   - Cannot sell treasures
   - Cannot sell quest items
   - Cannot sell last equipment piece

3. **Transaction Logic**
   - Gold award verification
   - Item removal verification
   - Error handling

4. **Integration Tests**
   - Full buy/sell cycle
   - Economic loss verification
   - Multiple item handling

### All Tests Pass
- 388 total tests (+19 new)
- 100% pass rate
- TypeScript compilation: ✅
- Production build: ✅
- Security scan: ✅ (0 vulnerabilities)

## User Experience

### How to Use

1. **Enter any shop** (overworld towns or city shops)
2. **Click "💰 Sell" tab** to switch to selling mode
3. **Click an item** to sell it instantly
4. **Receive gold** equal to 50% of original cost
5. **Switch back to "🛒 Buy" tab** to purchase items

### Error Messages
- "Cannot be sold!" - Quest items or treasures
- "Last equipment!" - Attempting to sell last weapon/armor/shield
- "Invalid item index!" - System error (should not occur in normal use)

### Tips
- Consumables can always be sold if not quest items
- Equipment can be sold if you have duplicates
- Always keep at least one weapon, armor, and shield
- Sell value is 50% of buy price (you lose gold in the exchange)

## Technical Details

### Files Modified
1. `src/data/items.ts`: Added sell value functions
2. `src/systems/player.ts`: Added sell logic and restrictions
3. `src/scenes/Shop.ts`: Added tab UI and sell mode
4. `tests/shop.test.ts`: Added comprehensive tests (new file)

### Code Quality
- No code duplication (extracted `getItemTypeIcon()` helper)
- Consistent formatting across buy and sell tabs
- Clear separation of concerns
- Well-documented functions
- Comprehensive test coverage

## Future Enhancements (Out of Scope)

Potential improvements for future updates:
- Variable sell prices based on shop type or player reputation
- Bulk selling interface for multiple items
- Item rarity tiers affecting sell value
- Shop-specific buyback lists (limited time to repurchase sold items)
- Visual confirmation dialog for expensive items
- Sell value preview before clicking

## Maintenance Notes

### Adding New Item Types
When adding new item types, update:
1. `getItemTypeIcon()` in Shop.ts with appropriate icon
2. Consider if new type should have sell restrictions
3. Add tests for new type's sell behavior

### Modifying Sell Value
To adjust the sell percentage:
1. Update `getSellValue()` in items.ts
2. Update tests in shop.test.ts
3. Update this documentation

### Adding Sell Restrictions
To restrict selling of new item categories:
1. Update `canSellItem()` in items.ts
2. Add appropriate visual feedback in Shop.ts
3. Add tests for new restriction
