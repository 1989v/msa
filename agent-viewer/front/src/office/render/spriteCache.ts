import { SPRITE_CONFIGS, type SpriteConfig } from '@/utils/spriteConfig'
import { Dir, type Direction } from '../types'

const SPRITE_W = 16
const SPRITE_H = 16

type AnimKind =
  | 'idle'
  | 'walk0'
  | 'walk1'
  | 'walk2'
  | 'walk3'
  | 'type0'
  | 'type1'
  | 'rest'

const ANIM_KINDS: AnimKind[] = [
  'idle',
  'walk0',
  'walk1',
  'walk2',
  'walk3',
  'type0',
  'type1',
  'rest',
]
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

/** Walk leg offsets per 4-frame cycle (left, right shift in px). */
function walkLegOffsets(frame: number): { lShift: number; rShift: number } {
  switch (frame) {
    case 0:
      return { lShift: -1, rShift: 0 }
    case 1:
      return { lShift: 0, rShift: 0 }
    case 2:
      return { lShift: 0, rShift: -1 }
    case 3:
      return { lShift: 0, rShift: 0 }
    default:
      return { lShift: 0, rShift: 0 }
  }
}

/** Walk arm swing opposite of legs. */
function walkArmOffsets(frame: number): { lArm: number; rArm: number } {
  switch (frame) {
    case 0:
      return { lArm: 0, rArm: -1 }
    case 1:
      return { lArm: 0, rArm: 0 }
    case 2:
      return { lArm: -1, rArm: 0 }
    case 3:
      return { lArm: 0, rArm: 0 }
    default:
      return { lArm: 0, rArm: 0 }
  }
}

function drawRestPose(
  ctx: CanvasRenderingContext2D,
  config: SpriteConfig,
  dir: Direction,
) {
  const fill = (color: string, x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = color
    ctx.fillRect(x, y, w, h)
  }
  const bodyColor = config.color
  const bodyDark = darken(config.color, 0.35)
  const bodyLight = lighten(config.color, 0.2)
  const accent = config.accentColor
  const skin = config.skinColor
  const skinShade = darken(config.skinColor, 0.2)
  const hair = darken(config.color, 0.55)
  const hairLight = darken(config.color, 0.35)
  const pants = '#2c3a4f'
  const outline = '#0c1017'

  // Slightly slumped/lower posture — shifted down 1px + rounded shoulders
  const shift = 1

  // Hair
  fill(hair, 5, 1 + shift, 6, 1)
  fill(hair, 4, 2 + shift, 1, 2)
  fill(hair, 11, 2 + shift, 1, 2)
  fill(hairLight, 5, 2 + shift, 6, 1)

  // Head / face
  fill(skin, 5, 3 + shift, 6, 4)
  fill(skinShade, 10, 4 + shift, 1, 3)

  // Eyes — closed/sleepy (horizontal lines)
  if (dir !== Dir.UP) {
    fill(outline, 6, 5 + shift, 1, 1)
    fill(outline, 9, 5 + shift, 1, 1)
    fill(outline, 7, 6 + shift, 2, 1) // small smile
  }

  // Collar / shirt
  fill('#f0f6fc', 4, 7 + shift, 8, 1)
  // Body (slightly wider — slumped)
  fill(bodyColor, 3, 8 + shift, 10, 4)
  fill(accent, 7, 7 + shift, 2, 1) // tie
  fill(accent, 7, 8 + shift, 2, 2)
  fill(bodyLight, 3, 8 + shift, 1, 1)
  fill(bodyDark, 12, 8 + shift, 1, 4)
  fill(darken(accent, 0.3), 5, 11 + shift, 6, 1) // belt

  // Arms resting on lap
  fill(bodyColor, 2, 9 + shift, 2, 2)
  fill(bodyColor, 12, 9 + shift, 2, 2)
  fill(skin, 2, 11 + shift, 1, 1)
  fill(skin, 13, 11 + shift, 1, 1)

  // Legs bent forward (shorter)
  fill(pants, 5, 12 + shift, 2, 2)
  fill(pants, 9, 12 + shift, 2, 2)
  fill('#1a1f28', 4, 14 + shift, 3, 1)
  fill('#1a1f28', 9, 14 + shift, 3, 1)
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

  if (anim === 'rest') {
    drawRestPose(ctx, config, dir)
    return canvas
  }

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

  // Determine walk frame (0..3) or type frame (0..1)
  let walkFrame = 0
  if (anim === 'walk0') walkFrame = 0
  else if (anim === 'walk1') walkFrame = 1
  else if (anim === 'walk2') walkFrame = 2
  else if (anim === 'walk3') walkFrame = 3
  const typeFrame = anim === 'type1' ? 1 : 0
  const isWalking = anim.startsWith('walk')
  const isTyping = anim === 'type0' || anim === 'type1'

  // Hair
  fill(hair, 5, 1, 6, 1)
  fill(hair, 4, 2, 1, 2)
  fill(hair, 11, 2, 1, 2)
  fill(hairLight, 5, 2, 6, 1)
  fill(outline, 4, 1, 1, 1)
  fill(outline, 11, 1, 1, 1)

  // Head / face
  fill(skin, 5, 3, 6, 1)
  fill(skin, 5, 4, 6, 1)
  fill(skin, 5, 5, 6, 1)
  fill(skin, 5, 6, 6, 1)
  fill(skinShade, 10, 4, 1, 3)
  fill(skinShade, 5, 6, 6, 1)

  // Eyes per direction
  if (dir !== Dir.UP) {
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
    fill(lighten(skin, 0.25), 6, 5, 1, 1)
    fill(lighten(skin, 0.25), 9, 5, 1, 1)
    fill(accentDark, 7, 6, 2, 1)
  } else {
    fill(hair, 5, 3, 6, 2)
    fill(hairLight, 5, 4, 6, 1)
  }

  // Collar
  fill('#f0f6fc', 4, 7, 8, 1)
  fill(darken('#f0f6fc', 0.2), 4, 7, 1, 1)
  fill(darken('#f0f6fc', 0.2), 11, 7, 1, 1)

  // Body rows
  fill(bodyColor, 4, 8, 8, 1)
  fill(bodyColor, 4, 9, 8, 1)
  fill(bodyColor, 4, 10, 8, 1)
  fill(bodyColor, 4, 11, 8, 1)
  fill(accent, 7, 7, 2, 1)
  fill(accent, 7, 8, 2, 1)
  fill(accent, 7, 9, 2, 1)
  fill(accent, 7, 10, 1, 1)
  fill(accent, 8, 10, 1, 1)
  fill(bodyDark, 11, 8, 1, 4)
  fill(bodyLight, 4, 8, 1, 1)
  fill(accentDark, 5, 11, 6, 1)

  // Arms
  const armOff = isWalking ? walkArmOffsets(walkFrame) : { lArm: 0, rArm: 0 }
  const typeOff = isTyping && typeFrame === 1 ? -1 : 0
  const lArmY = isTyping ? 8 + typeOff : 8 + armOff.lArm
  const rArmY = isTyping ? 8 + typeOff : 8 + armOff.rArm

  fill(bodyColor, 3, lArmY, 1, 2)
  fill(bodyColor, 12, rArmY, 1, 2)
  fill(bodyDark, 12, rArmY + 1, 1, 1)

  if (isTyping) {
    // Both hands forward toward desk
    fill(skin, 5, 10 + typeOff, 1, 1)
    fill(skin, 10, 10 + typeOff, 1, 1)
    fill(skin, 3, 10 + typeOff, 1, 1)
    fill(skin, 12, 10 + typeOff, 1, 1)
  } else {
    fill(skin, 3, 10 + armOff.lArm, 1, 1)
    fill(skin, 12, 10 + armOff.rArm, 1, 1)
  }

  // Legs
  const { lShift, rShift } = isWalking ? walkLegOffsets(walkFrame) : { lShift: 0, rShift: 0 }
  fill(pants, 5, 12 + lShift, 2, 2)
  fill(pantsLight, 5, 12 + lShift, 1, 2)
  fill(pants, 9, 12 + rShift, 2, 2)
  fill(pantsLight, 9, 12 + rShift, 1, 2)

  // Shoes
  fill(shoe, 4, 14 + lShift, 3, 1)
  fill(shoeHi, 4, 14 + lShift, 1, 1)
  fill(shoe, 9, 14 + rShift, 3, 1)
  fill(shoeHi, 9, 14 + rShift, 1, 1)

  // Outline hints
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
