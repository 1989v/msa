import { COLORS, TILE_SIZE } from '../constants'
import type { World } from '../types'
import { drawTiles } from './tiles'
import { drawFurniture } from './furniture'
import { drawCharacters } from './sprites'
import { drawBubbles } from './bubbles'

export interface RenderOverlay {
  hoveredAgentId: string | null
  selectedAgentId: string | null
}

export function drawWorld(
  ctx: CanvasRenderingContext2D,
  world: World,
  overlay: RenderOverlay = { hoveredAgentId: null, selectedAgentId: null },
): void {
  const w = world.cols * TILE_SIZE
  const h = world.rows * TILE_SIZE

  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = COLORS.background
  ctx.fillRect(0, 0, w, h)

  drawTiles(ctx, world)
  drawFurniture(ctx, world)
  drawCharacters(ctx, world, overlay)
  drawBubbles(ctx, world)
}
