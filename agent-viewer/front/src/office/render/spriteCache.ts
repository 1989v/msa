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

/** Darken a hex color by mixing with black. */
function darken(hex: string, amount: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const k = 1 - amount
  const rr = Math.round(r * k).toString(16).padStart(2, '0')
  const gg = Math.round(g * k).toString(16).padStart(2, '0')
  const bb = Math.round(b * k).toString(16).padStart(2, '0')
  return `#${rr}${gg}${bb}`
}

/** Lighten a hex color by mixing with white. */
function lighten(hex: string, amount: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const rr = Math.round(r + (255 - r) * amount).toString(16).padStart(2, '0')
  const gg = Math.round(g + (255 - g) * amount).toString(16).padStart(2, '0')
  const bb = Math.round(b + (255 - b) * amount).toString(16).padStart(2, '0')
  return `#${rr}${gg}${bb}`
}

/**
 * 16×16 character bake. Layout (x = column, y = row):
 *
 *    0 1 2 3 4 5 6 7 8 9 A B C D E F
 * 0  . . . . . . . . . . . . . . . .
 * 1  . . . . . H H H H H H . . . . .    H = hair
 * 2  . . . . H h h h h h h H . . . .    h = hair highlight
 * 3  . . . . H s s s s s s H . . . .    s = face
 * 4  . . . . s S E s s E S s . . . .    S = sclera, E = pupil
 * 5  . . . . s c s s s s c s . . . .    c = cheek tint
 * 6  . . . . s s s m m s s s . . . .    m = mouth
 * 7  . . . . W W W W W W W W . . . .    W = white collar
 * 8  . . . A t t t T T t t t A . . .    A = sleeve, t = shirt, T = tie
 * 9  . . . A t t t T T t t t A . . .
 * A  . . . H t t b b b b t t H . . .    b = belt accent, H = hand (skin)
 * B  . . . . t t t t t t t t . . . .
 * C  . . . . P P . . . . P P . . . .    P = pants
 * D  . . . . P P . . . . P P . . . .
 * E  . . . S S S . . . . S S S . . .    S = shoes
 * F  . . . . . . . . . . . . . . . .
 */
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

  const bodyColor = config.color
  const bodyDark = darken(config.color, 0.35)
  const bodyLight = lighten(config.color, 0.2)
  const accent = config.accentColor
  const accentDark = darken(config.accentColor, 0.3)
  const skin = config.skinColor
  const skinShade = darken(config.skinColor, 0.2)
  const hair = darken(config.color, 0.55)
  const hairLight = darken(config.color, 0.35)
  const pants = '#2c3a4f'
  const pantsLight = '#38465c'
  const shoe = '#1a1f28'
  const shoeHi = '#2a313d'
  const outline = '#0c1017'
  const frame = anim === 'walk0' || anim === 'type0' ? 0 : 1

  // ---------- HAIR ----------
  fill(hair, 5, 1, 6, 1)
  fill(hair, 4, 2, 1, 2)
  fill(hair, 11, 2, 1, 2)
  fill(hairLight, 5, 2, 6, 1)
  // Hair contour
  fill(outline, 4, 1, 1, 1)
  fill(outline, 11, 1, 1, 1)

  // ---------- HEAD / FACE ----------
  fill(skin, 5, 3, 6, 1)
  fill(skin, 5, 4, 6, 1)
  fill(skin, 5, 5, 6, 1)
  fill(skin, 5, 6, 6, 1)
  // Face side shading
  fill(skinShade, 10, 4, 1, 3)
  fill(skinShade, 5, 6, 6, 1)

  // ---------- EYES (per direction) ----------
  if (dir !== Dir.UP) {
    // White sclera
    if (dir === Dir.DOWN) {
      fill('#ffffff', 6, 4, 1, 1)
      fill('#ffffff', 9, 4, 1, 1)
      fill(outline, 6, 4, 1, 1)
      fill(outline, 9, 4, 1, 1)
    } else if (dir === Dir.LEFT) {
      fill(outline, 5, 4, 1, 1)
      fill(outline, 7, 4, 1, 1)
    } else if (dir === Dir.RIGHT) {
      fill(outline, 8, 4, 1, 1)
      fill(outline, 10, 4, 1, 1)
    }
    // Cheek tint (down/side)
    fill(lighten(skin, 0.25), 6, 5, 1, 1)
    fill(lighten(skin, 0.25), 9, 5, 1, 1)
    // Mouth
    fill(accentDark, 7, 6, 2, 1)
  } else {
    // Back of head — no face, just hair
    fill(hair, 5, 3, 6, 2)
    fill(hairLight, 5, 4, 6, 1)
  }

  // ---------- COLLAR ----------
  fill('#f0f6fc', 4, 7, 8, 1)
  fill(darken('#f0f6fc', 0.2), 4, 7, 1, 1)
  fill(darken('#f0f6fc', 0.2), 11, 7, 1, 1)

  // ---------- BODY / SHIRT ----------
  // Main shirt rows
  fill(bodyColor, 4, 8, 8, 1)
  fill(bodyColor, 4, 9, 8, 1)
  fill(bodyColor, 4, 10, 8, 1)
  fill(bodyColor, 4, 11, 8, 1)
  // Tie in center (accent)
  fill(accent, 7, 7, 2, 1)
  fill(accent, 7, 8, 2, 1)
  fill(accent, 7, 9, 2, 1)
  fill(accent, 7, 10, 1, 1)
  fill(accent, 8, 10, 1, 1)
  // Body side shading
  fill(bodyDark, 11, 8, 1, 4)
  fill(bodyLight, 4, 8, 1, 1)
  // Belt
  fill(accentDark, 5, 11, 6, 1)

  // ---------- ARMS ----------
  const typing = anim === 'type0' || anim === 'type1'
  const armYShift = typing ? (frame === 1 ? -1 : 0) : 0

  // Sleeves (color)
  fill(bodyColor, 3, 8 + armYShift, 1, 2)
  fill(bodyColor, 12, 8 + armYShift, 1, 2)
  fill(bodyDark, 12, 9 + armYShift, 1, 1)
  // Hands (skin)
  if (typing) {
    // Hands brought forward over desk
    fill(skin, 5, 10 + armYShift, 1, 1)
    fill(skin, 10, 10 + armYShift, 1, 1)
    fill(skin, 3, 10 + armYShift, 1, 1)
    fill(skin, 12, 10 + armYShift, 1, 1)
  } else {
    fill(skin, 3, 10 + armYShift, 1, 1)
    fill(skin, 12, 10 + armYShift, 1, 1)
  }

  // ---------- PANTS / LEGS ----------
  const walking = anim === 'walk0' || anim === 'walk1'
  const lShift = walking && frame === 1 ? -1 : 0
  const rShift = walking && frame === 0 ? -1 : 0

  // Left leg
  fill(pants, 5, 12 + lShift, 2, 2)
  fill(pantsLight, 5, 12 + lShift, 1, 2)
  // Right leg
  fill(pants, 9, 12 + rShift, 2, 2)
  fill(pantsLight, 9, 12 + rShift, 1, 2)

  // ---------- SHOES ----------
  fill(shoe, 4, 14 + lShift, 3, 1)
  fill(shoeHi, 4, 14 + lShift, 1, 1)
  fill(shoe, 9, 14 + rShift, 3, 1)
  fill(shoeHi, 9, 14 + rShift, 1, 1)

  // ---------- OUTLINE ----------
  // Light silhouette outline on outer edges (body sides)
  fill(outline, 3, 11, 1, 1)
  fill(outline, 12, 11, 1, 1)

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
