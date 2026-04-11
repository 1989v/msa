import { COLORS, TILE_SIZE } from '../constants'
import { TileType, type World } from '../types'
import { idx } from '../layout/tileMap'
import { FLOOR_TILES } from '../assets/catalog'
import { drawTileFromSheet } from '../assets/loader'

function tileColor(tile: TileType, col: number, row: number): string {
  const checker = (col + row) % 2 === 0
  switch (tile) {
    case TileType.FLOOR:
      return checker ? COLORS.floor : COLORS.floorAlt
    case TileType.CARPET_A:
      return COLORS.carpetA
    case TileType.CARPET_B:
      return COLORS.carpetB
    case TileType.WALL:
      return COLORS.wall
    case TileType.BREAK:
      return checker ? COLORS.breakFloor : COLORS.breakFloorAlt
    case TileType.CEO:
      return checker ? COLORS.ceoFloor : COLORS.ceoFloorAlt
    default:
      return COLORS.background
  }
}

/**
 * Paint a base color for the tile, then overlay an asset tile if available.
 * Finally apply team tint on carpets.
 */
function drawBaseTile(
  ctx: CanvasRenderingContext2D,
  tile: TileType,
  col: number,
  row: number,
  x: number,
  y: number,
): void {
  ctx.fillStyle = tileColor(tile, col, row)
  ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE)

  const checker = (col + row) % 2 === 0
  let ref: { sheet: 'modernCity' | 'tinyTown'; col: number; row: number } | null = null
  switch (tile) {
    case TileType.FLOOR:
      ref = checker ? FLOOR_TILES.plain : FLOOR_TILES.plainDark
      break
    case TileType.CARPET_A:
    case TileType.CARPET_B:
      ref = FLOOR_TILES.carpet
      break
    case TileType.BREAK:
      ref = FLOOR_TILES.tan
      break
    case TileType.CEO:
      ref = FLOOR_TILES.carpet
      break
  }
  if (ref) {
    drawTileFromSheet(ctx, ref.sheet, ref.col, ref.row, x, y)
  }
}

export function drawTiles(ctx: CanvasRenderingContext2D, world: World): void {
  for (let row = 0; row < world.rows; row++) {
    for (let col = 0; col < world.cols; col++) {
      const i = idx(world.cols, col, row)
      const t = world.tiles[i]
      if (t === TileType.VOID) continue
      const x = col * TILE_SIZE
      const y = row * TILE_SIZE

      drawBaseTile(ctx, t, col, row, x, y)

      // Team tint overlay on carpet
      const tint = world.tileTint[i]
      if (tint && (t === TileType.CARPET_A || t === TileType.CARPET_B)) {
        ctx.fillStyle = tint
        ctx.globalAlpha = 0.22
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE)
        ctx.globalAlpha = 1
      }

      // Wall top highlight (procedural)
      if (t === TileType.WALL) {
        ctx.fillStyle = COLORS.wallTop
        ctx.fillRect(x, y, TILE_SIZE, 2)
      }
    }
  }

  // Zone borders
  for (const zone of world.teamZones.values()) {
    ctx.strokeStyle = `${zone.color}66`
    ctx.lineWidth = 1
    ctx.strokeRect(
      zone.x * TILE_SIZE + 0.5,
      zone.y * TILE_SIZE + 0.5,
      zone.w * TILE_SIZE - 1,
      zone.h * TILE_SIZE - 1,
    )
  }
}
