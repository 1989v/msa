import type { Character, World } from '../types'

/**
 * Pick the topmost character whose bounding box contains the logical px/py.
 * Characters are drawn as 16×16 centered on (c.x, c.y - 8).
 */
export function pickCharacter(world: World, px: number, py: number): Character | null {
  let best: Character | null = null
  let bestY = -Infinity
  for (const c of world.characters.values()) {
    const left = c.x - 8
    const right = c.x + 8
    const top = c.y - 14
    const bottom = c.y + 2
    if (px >= left && px <= right && py >= top && py <= bottom) {
      if (c.y > bestY) {
        bestY = c.y
        best = c
      }
    }
  }
  return best
}
