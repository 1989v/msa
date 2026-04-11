/**
 * Semantic → sprite sheet coordinate catalog.
 *
 * All references are to `packed` tilemaps from /public/office-assets/, which
 * have no padding between tiles. Each tile is 16×16 px.
 *
 * Only entries that have been visually verified should be uncommented /
 * promoted to the catalog. Unknown entries fall back to procedural rendering.
 */

export type SheetId = 'modernCity' | 'tinyTown'

export interface SheetInfo {
  id: SheetId
  url: string
  cols: number
  rows: number
  tileSize: number
}

export const SHEETS: Record<SheetId, SheetInfo> = {
  modernCity: {
    id: 'modernCity',
    url: '/office-assets/kenney-modern-city/Tilemap/tilemap_packed.png',
    cols: 37,
    rows: 28,
    tileSize: 16,
  },
  tinyTown: {
    id: 'tinyTown',
    url: '/office-assets/kenney-tiny-town/Tilemap/tilemap_packed.png',
    cols: 12,
    rows: 11,
    tileSize: 16,
  },
}

export interface TileRef {
  sheet: SheetId
  col: number
  row: number
}

/**
 * Tile indices for Tiny Town characters. Rows 9-10 of tiny-town have a strip
 * of small humanoid sprites (single front-facing frame each).
 */
export const CHARACTER_TILES: TileRef[] = [
  // Row 9 (characters start around here)
  { sheet: 'tinyTown', col: 0, row: 9 },
  { sheet: 'tinyTown', col: 1, row: 9 },
  { sheet: 'tinyTown', col: 2, row: 9 },
  { sheet: 'tinyTown', col: 3, row: 9 },
  { sheet: 'tinyTown', col: 4, row: 9 },
  { sheet: 'tinyTown', col: 5, row: 9 },
  // Row 10
  { sheet: 'tinyTown', col: 0, row: 10 },
  { sheet: 'tinyTown', col: 1, row: 10 },
  { sheet: 'tinyTown', col: 2, row: 10 },
  { sheet: 'tinyTown', col: 3, row: 10 },
]

/**
 * Map our sprite type names to character tile indices. We have 10 sprite types
 * and use CHARACTER_TILES.length tiles, cycling if needed.
 */
export const SPRITE_TYPE_TO_CHARACTER: Record<string, number> = {
  warrior: 0,
  mage: 1,
  archer: 2,
  healer: 3,
  scholar: 4,
  sentinel: 5,
  architect: 6,
  strategist: 7,
  rogue: 8,
  merchant: 9,
}

/**
 * Floor tile picks from Modern City. Row 0-1 contain brick/concrete wall
 * exteriors that look like clean floor textures when used as floor.
 */
export const FLOOR_TILES = {
  // Gray concrete floor
  plain: { sheet: 'modernCity' as SheetId, col: 9, row: 0 },
  // Darker gray variant
  plainDark: { sheet: 'modernCity' as SheetId, col: 10, row: 0 },
  // Tan/cream floor
  tan: { sheet: 'modernCity' as SheetId, col: 14, row: 0 },
  // Reddish brick/carpet
  carpet: { sheet: 'modernCity' as SheetId, col: 1, row: 0 },
}

/**
 * Furniture catalog — each entry is a list of tile refs relative to the
 * furniture's own (0,0). Multi-tile items list multiple refs.
 *
 * When a furniture type is missing here, the renderer falls back to
 * procedural drawing.
 */
export interface FurnitureSpriteDef {
  tiles: Array<{ dx: number; dy: number; ref: TileRef }>
}

export const FURNITURE_SPRITES: Partial<Record<string, FurnitureSpriteDef>> = {
  // Leave empty for now — procedural fallback renders everything.
  // Populate as individual tile indices are visually verified.
}
