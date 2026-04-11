import { COLORS } from '../constants'
import type { Character, World } from '../types'
import { CharState } from '../types'
import type { RenderOverlay } from './renderer'
import { ensureSpriteCache, getBakedSprite, type AnimKind } from './spriteCache'
import { CHARACTER_TILES, SPRITE_TYPE_TO_CHARACTER } from '../assets/catalog'
import { drawTileFromSheet, getSheet } from '../assets/loader'

function idleBobOffset(char: Character): number {
  if (
    char.state === CharState.IDLE ||
    char.state === CharState.WAITING ||
    char.state === CharState.QUEUED
  ) {
    return char.frame === 1 ? -1 : 0
  }
  return 0
}

function animKindFor(c: Character): AnimKind {
  if (c.state === CharState.TYPE) return c.frame === 1 ? 'type1' : 'type0'
  if (c.state === CharState.WALK || c.state === CharState.WANDER) {
    return c.frame === 1 ? 'walk1' : 'walk0'
  }
  return 'idle'
}

function pickCharacterTile(c: Character) {
  const idx = SPRITE_TYPE_TO_CHARACTER[c.spriteType] ?? 0
  return CHARACTER_TILES[idx % CHARACTER_TILES.length]
}

function drawAssetCharacter(
  ctx: CanvasRenderingContext2D,
  c: Character,
  dx: number,
  dy: number,
): boolean {
  const tile = pickCharacterTile(c)
  if (!getSheet(tile.sheet)) return false
  // Small walking bounce for walk states
  const walkBounce =
    (c.state === CharState.WALK || c.state === CharState.WANDER) && c.frame === 1 ? -1 : 0
  return drawTileFromSheet(ctx, tile.sheet, tile.col, tile.row, dx, dy + walkBounce)
}

export function drawCharacters(
  ctx: CanvasRenderingContext2D,
  world: World,
  overlay: RenderOverlay,
): void {
  ensureSpriteCache()

  const chars = [...world.characters.values()].sort((a, b) => a.y - b.y)

  for (const c of chars) {
    const alpha = c.despawning
      ? Math.max(0, c.spawnTimer)
      : c.spawnTimer < 1
        ? c.spawnTimer
        : 1

    const bob = idleBobOffset(c)
    const dx = Math.round(c.x - 8)
    const dy = Math.round(c.y - 14) + bob

    ctx.globalAlpha = alpha

    // Try asset sprite first, fall back to procedural bake
    if (!drawAssetCharacter(ctx, c, dx, dy)) {
      const baked = getBakedSprite(c.spriteType, c.dir, animKindFor(c))
      if (baked) {
        ctx.drawImage(baked as CanvasImageSource, dx, dy)
      }
    }

    ctx.globalAlpha = 1

    // Spawn matrix bars
    if (c.spawnTimer < 1 && !c.despawning) {
      const progress = c.spawnTimer
      ctx.fillStyle = 'rgba(88, 166, 255, 0.6)'
      for (let i = 0; i < 4; i++) {
        const yOff = -14 + ((i * 4) + (progress * 16) % 16)
        ctx.fillRect(Math.round(c.x - 8), Math.round(c.y + yOff), 16, 1)
      }
    }

    // Outlines
    if (overlay.selectedAgentId === c.agentId) {
      ctx.strokeStyle = COLORS.selected
      ctx.lineWidth = 1
      ctx.strokeRect(dx - 1, dy - 1, 18, 18)
    } else if (overlay.hoveredAgentId === c.agentId) {
      ctx.strokeStyle = COLORS.hover
      ctx.lineWidth = 1
      ctx.strokeRect(dx - 0.5, dy - 0.5, 17, 17)
    }
  }
}
