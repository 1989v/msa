import { TILE_SIZE } from '../constants'
import type { Furniture, World } from '../types'

function fill(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
}

function drawDesk(ctx: CanvasRenderingContext2D, f: Furniture) {
  const px = f.col * TILE_SIZE
  const py = f.row * TILE_SIZE
  const w = f.w * TILE_SIZE
  const h = TILE_SIZE
  const teamColor = f.color ?? '#58a6ff'

  // Desktop
  fill(ctx, '#5c4033', px, py + 2, w, 6)
  fill(ctx, '#6b4c3b', px, py + 2, w, 2)
  // Edge tint
  fill(ctx, teamColor, px, py + 1, w, 1)
  // Monitor
  const mx = px + Math.floor(w / 2) - 5
  const my = py - 1
  fill(ctx, '#1c2530', mx, my, 10, 7)
  fill(ctx, teamColor, mx + 1, my + 1, 8, 5)
  fill(ctx, '#ffffff', mx + 2, my + 2, 3, 1)
  fill(ctx, '#ffffff', mx + 2, my + 4, 5, 1)
  fill(ctx, '#484f58', mx + 3, my + 7, 4, 1)
  // Legs
  fill(ctx, '#3a2a1c', px + 1, py + 8, 2, 6)
  fill(ctx, '#3a2a1c', px + w - 3, py + 8, 2, 6)
  // Chair hint behind seat
  fill(ctx, '#2d333b', px + Math.floor(w / 2) - 3, py + h + 2, 6, 3)
}

function drawCeoDesk(ctx: CanvasRenderingContext2D, f: Furniture) {
  const px = f.col * TILE_SIZE
  const py = f.row * TILE_SIZE
  const w = f.w * TILE_SIZE
  // Big wood desk
  fill(ctx, '#6b4c3b', px, py + 2, w, 10)
  fill(ctx, '#7d5a47', px, py + 2, w, 2)
  fill(ctx, '#a78bfa', px, py + 1, w, 1)
  // Desk legs
  fill(ctx, '#4a3728', px + 2, py + 12, 3, 4)
  fill(ctx, '#4a3728', px + w - 5, py + 12, 3, 4)
  // Monitor
  const mx = px + Math.floor(w / 2) - 6
  fill(ctx, '#1c2530', mx, py + 1, 12, 8)
  fill(ctx, '#8b5cf6', mx + 1, py + 2, 10, 6)
  // Nameplate
  fill(ctx, '#d4af37', px + Math.floor(w / 2) - 4, py + 8, 8, 2)
}

function drawSofa(ctx: CanvasRenderingContext2D, f: Furniture) {
  const px = f.col * TILE_SIZE
  const py = f.row * TILE_SIZE
  const w = f.w * TILE_SIZE
  // Backrest
  fill(ctx, '#3b4a6b', px, py + 2, w, 5)
  fill(ctx, '#4c5f85', px, py + 2, w, 2)
  // Cushions
  fill(ctx, '#5a6e9b', px + 1, py + 7, w - 2, 5)
  for (let i = 0; i < f.w - 1; i++) {
    fill(ctx, '#3b4a6b', px + (i + 1) * TILE_SIZE - 1, py + 7, 1, 5)
  }
  // Base shadow
  fill(ctx, '#1d2537', px, py + 12, w, 2)
}

function drawPlant(ctx: CanvasRenderingContext2D, f: Furniture) {
  const px = f.col * TILE_SIZE
  const py = f.row * TILE_SIZE
  // Pot
  fill(ctx, '#6b3410', px + 5, py + 10, 6, 5)
  fill(ctx, '#8b4513', px + 5, py + 10, 6, 2)
  // Leaves
  fill(ctx, '#2f8f4a', px + 3, py + 4, 10, 6)
  fill(ctx, '#3fb950', px + 5, py + 2, 6, 5)
  fill(ctx, '#56d364', px + 6, py + 3, 4, 2)
}

function drawWhiteboard(ctx: CanvasRenderingContext2D, f: Furniture) {
  const px = f.col * TILE_SIZE
  const py = f.row * TILE_SIZE
  const w = f.w * TILE_SIZE
  fill(ctx, '#484f58', px, py, w, 1)
  fill(ctx, '#e6edf3', px, py + 1, w, 10)
  fill(ctx, '#484f58', px, py + 11, w, 2)
  fill(ctx, '#58a6ff', px + 2, py + 3, 4, 1)
  fill(ctx, '#3fb950', px + 2, py + 5, 6, 1)
  fill(ctx, '#f85149', px + 2, py + 7, 3, 1)
}

function drawVending(ctx: CanvasRenderingContext2D, f: Furniture) {
  const px = f.col * TILE_SIZE
  const py = f.row * TILE_SIZE
  fill(ctx, '#c2340a', px + 2, py, 12, 16)
  fill(ctx, '#f85149', px + 3, py + 1, 10, 8)
  fill(ctx, '#ffffff', px + 4, py + 2, 3, 2)
  fill(ctx, '#ffffff', px + 8, py + 2, 3, 2)
  fill(ctx, '#ffffff', px + 4, py + 5, 3, 2)
  fill(ctx, '#ffffff', px + 8, py + 5, 3, 2)
  fill(ctx, '#1f2933', px + 4, py + 10, 8, 5)
  fill(ctx, '#3fb950', px + 10, py + 12, 1, 1)
}

function drawCooler(ctx: CanvasRenderingContext2D, f: Furniture) {
  const px = f.col * TILE_SIZE
  const py = f.row * TILE_SIZE
  fill(ctx, '#58a6ff', px + 4, py + 1, 8, 6)
  fill(ctx, '#a5d6ff', px + 5, py + 2, 6, 4)
  fill(ctx, '#8b949e', px + 3, py + 7, 10, 2)
  fill(ctx, '#484f58', px + 5, py + 9, 6, 6)
  fill(ctx, '#2d333b', px + 6, py + 11, 4, 2)
}

export function drawFurniture(ctx: CanvasRenderingContext2D, world: World): void {
  const sorted = [...world.furniture].sort((a, b) => (a.row + a.h) - (b.row + b.h))
  for (const f of sorted) {
    switch (f.type) {
      case 'desk':
        drawDesk(ctx, f)
        break
      case 'ceoDesk':
        drawCeoDesk(ctx, f)
        break
      case 'sofa':
        drawSofa(ctx, f)
        break
      case 'plant':
        drawPlant(ctx, f)
        break
      case 'whiteboard':
        drawWhiteboard(ctx, f)
        break
      case 'vendingMachine':
        drawVending(ctx, f)
        break
      case 'cooler':
        drawCooler(ctx, f)
        break
    }
  }
}
