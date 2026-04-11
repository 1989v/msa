import { TILE_SIZE, COLORS } from '../constants'
import type { Character, Direction, World } from '../types'
import { Dir, CharState } from '../types'
import { getSpriteConfig } from '@/utils/spriteConfig'
import type { RenderOverlay } from './renderer'

function fill(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
}

/**
 * Draw a 16×16 character centered at (cx, cy). Matches PixelSprite.tsx layout
 * but as canvas rects so it can be composited into the office canvas.
 *
 * Frame 0 = neutral, frame 1 = alt (walking step or typing arm raise).
 */
function drawCharacterBody(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  color: string,
  accent: string,
  skin: string,
  dir: Direction,
  frame: number,
  state: Character['state'],
) {
  const x = Math.round(px - 8)
  const y = Math.round(py - 14)

  // Hair / hat
  fill(ctx, color, x + 5, y + 1, 6, 2)
  fill(ctx, color, x + 4, y + 2, 8, 1)
  // Head
  fill(ctx, skin, x + 5, y + 3, 6, 4)
  // Eyes — direction-aware
  if (dir === Dir.DOWN) {
    fill(ctx, '#2d333b', x + 6, y + 4, 1, 1)
    fill(ctx, '#2d333b', x + 9, y + 4, 1, 1)
  } else if (dir === Dir.LEFT) {
    fill(ctx, '#2d333b', x + 6, y + 4, 1, 1)
    fill(ctx, '#2d333b', x + 8, y + 4, 1, 1)
  } else if (dir === Dir.RIGHT) {
    fill(ctx, '#2d333b', x + 7, y + 4, 1, 1)
    fill(ctx, '#2d333b', x + 9, y + 4, 1, 1)
  } else {
    // UP — back of head, no eyes
    fill(ctx, color, x + 5, y + 3, 6, 1)
  }
  // Mouth
  if (dir !== Dir.UP) {
    fill(ctx, '#c4956a', x + 7, y + 6, 2, 1)
  }
  // Body
  fill(ctx, color, x + 4, y + 7, 8, 4)
  fill(ctx, accent, x + 6, y + 7, 4, 1)

  // Arms — typing frame raises arms 1px
  const typing = state === CharState.TYPE && frame === 1
  fill(ctx, skin, x + 3, y + 8 + (typing ? -1 : 0), 1, 3)
  fill(ctx, skin, x + 12, y + 8 + (typing ? -1 : 0), 1, 3)

  // Legs — walking frame alternates
  const walking = state === CharState.WALK || state === CharState.WANDER
  const lOff = walking && frame === 1 ? -1 : 0
  const rOff = walking && frame === 0 ? -1 : 0
  fill(ctx, accent, x + 5, y + 11 + lOff, 2, 3)
  fill(ctx, accent, x + 9, y + 11 + rOff, 2, 3)

  // Feet
  fill(ctx, '#2d333b', x + 4, y + 14 + lOff, 3, 1)
  fill(ctx, '#2d333b', x + 9, y + 14 + rOff, 3, 1)
}

function idleBobOffset(char: Character): number {
  if (char.state === CharState.IDLE || char.state === CharState.WAITING || char.state === CharState.QUEUED) {
    return char.frame === 1 ? -1 : 0
  }
  return 0
}

export function drawCharacters(
  ctx: CanvasRenderingContext2D,
  world: World,
  overlay: RenderOverlay,
): void {
  // Sort by Y for depth
  const chars = [...world.characters.values()].sort((a, b) => a.y - b.y)

  for (const c of chars) {
    const config = getSpriteConfig(c.spriteType)
    const alpha = c.despawning
      ? Math.max(0, c.spawnTimer)
      : c.spawnTimer < 1
        ? c.spawnTimer
        : 1
    ctx.globalAlpha = alpha
    const bob = idleBobOffset(c)
    drawCharacterBody(
      ctx,
      c.x,
      c.y + bob,
      config.color,
      config.accentColor,
      config.skinColor,
      c.dir,
      c.frame,
      c.state,
    )
    ctx.globalAlpha = 1

    // Spawn effect — vertical scanline bars over character
    if (c.spawnTimer < 1 && !c.despawning) {
      const progress = c.spawnTimer
      ctx.fillStyle = 'rgba(88, 166, 255, 0.6)'
      const barCount = 4
      for (let i = 0; i < barCount; i++) {
        const yOff = -14 + ((i * 4) + (progress * 16) % 16)
        ctx.fillRect(Math.round(c.x - 8), Math.round(c.y + yOff), 16, 1)
      }
    }

    // Outlines
    if (overlay.selectedAgentId === c.agentId) {
      ctx.strokeStyle = COLORS.selected
      ctx.lineWidth = 1
      ctx.strokeRect(Math.round(c.x - 8) - 1, Math.round(c.y - 14) - 1, 18, 18)
    } else if (overlay.hoveredAgentId === c.agentId) {
      ctx.strokeStyle = COLORS.hover
      ctx.lineWidth = 1
      ctx.strokeRect(Math.round(c.x - 8) - 0.5, Math.round(c.y - 14) - 0.5, 17, 17)
    }
  }

  // Avoid lint complaint on unused TILE_SIZE
  void TILE_SIZE
}
