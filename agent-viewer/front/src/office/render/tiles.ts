import { COLORS, TILE_SIZE } from '../constants'
import { TileType, type World } from '../types'
import { idx } from '../layout/tileMap'

function fill(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
}

/** Wood plank floor — grain lines, checker hue shift. */
function drawFloor(ctx: CanvasRenderingContext2D, col: number, row: number, x: number, y: number) {
  const checker = (col + row) % 2 === 0
  const base = checker ? '#28344a' : '#2e3a52'
  const light = checker ? '#35445e' : '#3b4a65'
  const dark = '#1e2738'
  fill(ctx, base, x, y, TILE_SIZE, TILE_SIZE)
  // Grain lines (horizontal planks)
  fill(ctx, light, x, y, TILE_SIZE, 1)
  fill(ctx, dark, x, y + 7, TILE_SIZE, 1)
  fill(ctx, light, x, y + 8, TILE_SIZE, 1)
  // Subtle speckles
  fill(ctx, dark, x + 3, y + 3, 1, 1)
  fill(ctx, dark, x + 11, y + 12, 1, 1)
  fill(ctx, light, x + 6, y + 5, 1, 1)
  fill(ctx, light, x + 13, y + 10, 1, 1)
}

/** Carpet with rippled weave pattern. */
function drawCarpet(
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  x: number,
  y: number,
  alt: boolean,
) {
  const checker = (col + row) % 2 === 0
  const base = alt ? '#252e42' : '#2a3349'
  const darker = '#1c2334'
  const lighter = alt ? '#313c55' : '#35415c'
  fill(ctx, base, x, y, TILE_SIZE, TILE_SIZE)
  // Weave dots
  for (let ry = 0; ry < TILE_SIZE; ry += 4) {
    for (let rx = 0; rx < TILE_SIZE; rx += 4) {
      const p = (rx + ry + (checker ? 0 : 2)) % 8 === 0 ? lighter : darker
      fill(ctx, p, x + rx, y + ry, 1, 1)
    }
  }
}

/** Break-zone tile — warm cream with tile grid. */
function drawBreak(ctx: CanvasRenderingContext2D, col: number, row: number, x: number, y: number) {
  const checker = (col + row) % 2 === 0
  const base = checker ? '#2b3a32' : '#2f3e36'
  const grout = '#1b2821'
  const highlight = checker ? '#3a4d42' : '#405248'
  fill(ctx, base, x, y, TILE_SIZE, TILE_SIZE)
  // Tile outline
  fill(ctx, grout, x, y + TILE_SIZE - 1, TILE_SIZE, 1)
  fill(ctx, grout, x + TILE_SIZE - 1, y, 1, TILE_SIZE)
  // Highlight corner
  fill(ctx, highlight, x + 1, y + 1, 2, 1)
  fill(ctx, highlight, x + 1, y + 1, 1, 2)
}

/** CEO zone — plush purple carpet with gold flecks. */
function drawCeoFloor(ctx: CanvasRenderingContext2D, col: number, row: number, x: number, y: number) {
  const checker = (col + row) % 2 === 0
  const base = checker ? '#2a1b3d' : '#2e1e42'
  const darker = '#1b1128'
  const accent = '#3d2a52'
  fill(ctx, base, x, y, TILE_SIZE, TILE_SIZE)
  // Diagonal threads
  for (let i = 0; i < TILE_SIZE; i += 4) {
    fill(ctx, darker, x + i, y + (i % TILE_SIZE), 1, 1)
    fill(ctx, accent, x + (i + 2) % TILE_SIZE, y + (i + 2) % TILE_SIZE, 1, 1)
  }
  // Gold flecks
  if ((col * 7 + row * 13) % 5 === 0) {
    fill(ctx, '#d4af37', x + ((col * 3) % (TILE_SIZE - 2)), y + ((row * 5) % (TILE_SIZE - 2)), 1, 1)
  }
}

/** Wall — shaded brick with top highlight. */
function drawWall(ctx: CanvasRenderingContext2D, x: number, y: number) {
  fill(ctx, '#3a4150', x, y, TILE_SIZE, TILE_SIZE)
  fill(ctx, '#555e73', x, y, TILE_SIZE, 3)
  fill(ctx, '#6a7590', x, y, TILE_SIZE, 1)
  fill(ctx, '#252a36', x, y + TILE_SIZE - 1, TILE_SIZE, 1)
  // Brick seams
  fill(ctx, '#2a2f3c', x, y + 7, TILE_SIZE, 1)
  fill(ctx, '#2a2f3c', x, y + 12, TILE_SIZE, 1)
  fill(ctx, '#2a2f3c', x + 7, y + 3, 1, 4)
  fill(ctx, '#2a2f3c', x + 3, y + 8, 1, 4)
  fill(ctx, '#2a2f3c', x + 11, y + 8, 1, 4)
}

export function drawTiles(ctx: CanvasRenderingContext2D, world: World): void {
  for (let row = 0; row < world.rows; row++) {
    for (let col = 0; col < world.cols; col++) {
      const i = idx(world.cols, col, row)
      const t = world.tiles[i]
      if (t === TileType.VOID) continue
      const x = col * TILE_SIZE
      const y = row * TILE_SIZE

      switch (t) {
        case TileType.FLOOR:
          drawFloor(ctx, col, row, x, y)
          break
        case TileType.CARPET_A:
          drawCarpet(ctx, col, row, x, y, false)
          break
        case TileType.CARPET_B:
          drawCarpet(ctx, col, row, x, y, true)
          break
        case TileType.WALL:
          drawWall(ctx, x, y)
          break
        case TileType.BREAK:
          drawBreak(ctx, col, row, x, y)
          break
        case TileType.CEO:
          drawCeoFloor(ctx, col, row, x, y)
          break
        default:
          fill(ctx, COLORS.background, x, y, TILE_SIZE, TILE_SIZE)
      }

      // Team tint overlay on carpet
      const tint = world.tileTint[i]
      if (tint && (t === TileType.CARPET_A || t === TileType.CARPET_B)) {
        ctx.fillStyle = tint
        ctx.globalAlpha = 0.18
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE)
        ctx.globalAlpha = 1
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
