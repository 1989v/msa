import { COLORS, TILE_SIZE } from '../constants'
import { TileType, type World } from '../types'
import { idx } from '../layout/tileMap'

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

export function drawTiles(ctx: CanvasRenderingContext2D, world: World): void {
  for (let row = 0; row < world.rows; row++) {
    for (let col = 0; col < world.cols; col++) {
      const i = idx(world.cols, col, row)
      const t = world.tiles[i]
      if (t === TileType.VOID) continue
      const x = col * TILE_SIZE
      const y = row * TILE_SIZE

      ctx.fillStyle = tileColor(t, col, row)
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE)

      // Team tint overlay on carpet
      const tint = world.tileTint[i]
      if (tint && (t === TileType.CARPET_A || t === TileType.CARPET_B)) {
        ctx.fillStyle = tint
        ctx.globalAlpha = 0.18
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE)
        ctx.globalAlpha = 1
      }

      // Wall top highlight
      if (t === TileType.WALL) {
        ctx.fillStyle = COLORS.wallTop
        ctx.fillRect(x, y, TILE_SIZE, 2)
      }
    }
  }

  // Zone borders
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  ctx.lineWidth = 1
  for (const zone of world.teamZones.values()) {
    ctx.strokeStyle = `${zone.color}55`
    ctx.strokeRect(
      zone.x * TILE_SIZE + 0.5,
      zone.y * TILE_SIZE + 0.5,
      zone.w * TILE_SIZE - 1,
      zone.h * TILE_SIZE - 1,
    )
  }
}
