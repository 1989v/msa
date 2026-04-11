import { COLORS } from '../constants'
import type { World } from '../types'

export function drawBubbles(ctx: CanvasRenderingContext2D, world: World): void {
  for (const c of world.characters.values()) {
    if (!c.bubble) continue
    const cx = Math.round(c.x)
    const cy = Math.round(c.y) - 20

    // Rounded rect background
    const w = 14
    const h = 10
    const x = cx - Math.floor(w / 2)
    const y = cy - h

    ctx.fillStyle = COLORS.bubbleBg
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = COLORS.bubbleBorder
    ctx.fillRect(x, y, w, 1)
    ctx.fillRect(x, y + h - 1, w, 1)
    ctx.fillRect(x, y, 1, h)
    ctx.fillRect(x + w - 1, y, 1, h)

    // Tail
    ctx.fillStyle = COLORS.bubbleBg
    ctx.fillRect(cx - 1, y + h, 2, 2)
    ctx.fillStyle = COLORS.bubbleBorder
    ctx.fillRect(cx - 1, y + h + 2, 1, 1)
    ctx.fillRect(cx + 1, y + h + 2, 1, 1)

    // Icon
    ctx.fillStyle = c.bubble === 'waiting' ? '#d29922' : '#a78bfa'
    if (c.bubble === 'waiting') {
      // Simple '?'
      ctx.fillRect(cx - 1, y + 2, 3, 1)
      ctx.fillRect(cx + 1, y + 3, 1, 2)
      ctx.fillRect(cx, y + 5, 1, 1)
      ctx.fillRect(cx, y + 7, 1, 1)
    } else {
      // Clipboard bars
      ctx.fillRect(cx - 3, y + 2, 6, 1)
      ctx.fillRect(cx - 3, y + 4, 4, 1)
      ctx.fillRect(cx - 3, y + 6, 5, 1)
    }
  }
}
