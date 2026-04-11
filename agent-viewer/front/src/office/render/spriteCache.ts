import { SPRITE_CONFIGS, type SpriteConfig } from '@/utils/spriteConfig'
import { Dir, type Direction } from '../types'

const SPRITE_W = 16
const SPRITE_H = 16

type AnimKind = 'idle' | 'walk0' | 'walk1' | 'type0' | 'type1'

const ANIM_KINDS: AnimKind[] = ['idle', 'walk0', 'walk1', 'type0', 'type1']
const DIRECTIONS: Direction[] = [Dir.DOWN, Dir.LEFT, Dir.RIGHT, Dir.UP]

type BakedCanvas = HTMLCanvasElement | OffscreenCanvas

const cache = new Map<string, BakedCanvas>()

function cacheKey(type: string, dir: Direction, anim: AnimKind): string {
  return `${type}:${dir}:${anim}`
}

function makeCanvas(): BakedCanvas {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(SPRITE_W, SPRITE_H)
  }
  const c = document.createElement('canvas')
  c.width = SPRITE_W
  c.height = SPRITE_H
  return c
}

function bakeVariant(
  config: SpriteConfig,
  dir: Direction,
  anim: AnimKind,
): BakedCanvas {
  const canvas = makeCanvas()
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  ctx.clearRect(0, 0, SPRITE_W, SPRITE_H)
  ctx.imageSmoothingEnabled = false

  const fill = (color: string, x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = color
    ctx.fillRect(x, y, w, h)
  }

  const color = config.color
  const accent = config.accentColor
  const skin = config.skinColor
  const frame = anim === 'walk0' || anim === 'type0' ? 0 : 1

  // Hair/hat
  fill(color, 5, 1, 6, 2)
  fill(color, 4, 2, 8, 1)
  // Head
  fill(skin, 5, 3, 6, 4)
  // Eyes per direction
  if (dir === Dir.DOWN) {
    fill('#2d333b', 6, 4, 1, 1)
    fill('#2d333b', 9, 4, 1, 1)
  } else if (dir === Dir.LEFT) {
    fill('#2d333b', 6, 4, 1, 1)
    fill('#2d333b', 8, 4, 1, 1)
  } else if (dir === Dir.RIGHT) {
    fill('#2d333b', 7, 4, 1, 1)
    fill('#2d333b', 9, 4, 1, 1)
  } else {
    fill(color, 5, 3, 6, 1) // back of head cap
  }
  // Mouth (not when facing up)
  if (dir !== Dir.UP) {
    fill('#c4956a', 7, 6, 2, 1)
  }
  // Body
  fill(color, 4, 7, 8, 4)
  fill(accent, 6, 7, 4, 1)

  // Arms — typing raises arms 1px
  const typing = anim === 'type0' || anim === 'type1'
  const armYOff = typing && frame === 1 ? -1 : 0
  fill(skin, 3, 8 + armYOff, 1, 3)
  fill(skin, 12, 8 + armYOff, 1, 3)

  // Legs — walking alternates
  const walking = anim === 'walk0' || anim === 'walk1'
  const lOff = walking && frame === 1 ? -1 : 0
  const rOff = walking && frame === 0 ? -1 : 0
  fill(accent, 5, 11 + lOff, 2, 3)
  fill(accent, 9, 11 + rOff, 2, 3)

  // Feet
  fill('#2d333b', 4, 14 + lOff, 3, 1)
  fill('#2d333b', 9, 14 + rOff, 3, 1)

  return canvas
}

export function ensureSpriteCache(): void {
  if (cache.size > 0) return
  for (const type of Object.keys(SPRITE_CONFIGS)) {
    const config = SPRITE_CONFIGS[type]
    for (const dir of DIRECTIONS) {
      for (const anim of ANIM_KINDS) {
        cache.set(cacheKey(type, dir, anim), bakeVariant(config, dir, anim))
      }
    }
  }
}

export function getBakedSprite(
  type: string,
  dir: Direction,
  anim: AnimKind,
): BakedCanvas | null {
  if (cache.size === 0) ensureSpriteCache()
  return cache.get(cacheKey(type, dir, anim))
    ?? cache.get(cacheKey('warrior', dir, anim))
    ?? null
}

export type { AnimKind }
