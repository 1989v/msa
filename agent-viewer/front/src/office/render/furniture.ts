import { TILE_SIZE } from '../constants'
import type { Furniture, World } from '../types'

function fill(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
}

/** Desk with monitor, keyboard, mouse, coffee mug, sticky notes. */
function drawDesk(ctx: CanvasRenderingContext2D, f: Furniture) {
  const px = f.col * TILE_SIZE
  const py = f.row * TILE_SIZE
  const w = f.w * TILE_SIZE
  const h = TILE_SIZE
  const accent = f.color ?? '#58a6ff'

  // Drop shadow
  fill(ctx, 'rgba(0,0,0,0.35)', px - 1, py + h + 1, w + 2, 2)

  // Desktop (wood with grain)
  fill(ctx, '#6b4c32', px, py + 2, w, 8)
  fill(ctx, '#7d5a3c', px, py + 2, w, 1)
  fill(ctx, '#8a6748', px + 1, py + 3, w - 2, 1)
  // Wood grain lines
  for (let gx = px + 3; gx < px + w - 2; gx += 4) {
    fill(ctx, '#5a3f2a', gx, py + 5, 1, 1)
    fill(ctx, '#5a3f2a', gx + 2, py + 7, 1, 1)
  }
  // Edge accent (team color)
  fill(ctx, accent, px, py + 1, w, 1)
  fill(ctx, accent, px, py + 2, 1, 8)
  fill(ctx, accent, px + w - 1, py + 2, 1, 8)

  // Legs
  fill(ctx, '#3a2817', px + 1, py + 10, 2, 5)
  fill(ctx, '#2d1e10', px + 1, py + 14, 2, 1)
  fill(ctx, '#3a2817', px + w - 3, py + 10, 2, 5)
  fill(ctx, '#2d1e10', px + w - 3, py + 14, 2, 1)

  // Monitor (centered, elevated)
  const mx = px + Math.floor(w / 2) - 5
  const my = py - 2
  // Monitor back shadow
  fill(ctx, 'rgba(0,0,0,0.25)', mx, my + 1, 10, 8)
  // Bezel
  fill(ctx, '#1a1f28', mx, my, 10, 8)
  fill(ctx, '#2d333b', mx, my, 10, 1)
  // Screen
  fill(ctx, '#0d2438', mx + 1, my + 1, 8, 6)
  // Code-like UI lines
  fill(ctx, '#58a6ff', mx + 2, my + 2, 5, 1)
  fill(ctx, '#3fb950', mx + 2, my + 3, 3, 1)
  fill(ctx, '#d29922', mx + 6, my + 3, 2, 1)
  fill(ctx, '#a78bfa', mx + 2, my + 4, 4, 1)
  fill(ctx, '#58a6ff', mx + 2, my + 5, 6, 1)
  // Screen glow (bottom edge)
  fill(ctx, 'rgba(88,166,255,0.3)', mx + 1, my + 6, 8, 1)
  // Stand
  fill(ctx, '#484f58', mx + 4, my + 8, 2, 1)
  fill(ctx, '#2d333b', mx + 3, my + 9, 4, 1)

  // Keyboard
  fill(ctx, '#2d333b', px + 2, py + 4, 6, 2)
  fill(ctx, '#484f58', px + 2, py + 4, 6, 1)
  // Key hint
  for (let kx = 0; kx < 3; kx++) {
    fill(ctx, '#6e7681', px + 3 + kx * 2, py + 5, 1, 1)
  }

  // Coffee mug (right side)
  fill(ctx, '#e6edf3', px + w - 5, py + 5, 3, 3)
  fill(ctx, '#484f58', px + w - 5, py + 5, 3, 1)
  fill(ctx, '#6a3d1c', px + w - 4, py + 6, 1, 1)
  fill(ctx, '#8b949e', px + w - 2, py + 6, 1, 1)

  // Sticky note
  fill(ctx, '#f4d35e', px + w - 9, py + 5, 2, 2)
  fill(ctx, '#d4b043', px + w - 9, py + 5, 2, 1)
}

/** CEO's bigger executive desk. */
function drawCeoDesk(ctx: CanvasRenderingContext2D, f: Furniture) {
  const px = f.col * TILE_SIZE
  const py = f.row * TILE_SIZE
  const w = f.w * TILE_SIZE

  // Shadow
  fill(ctx, 'rgba(0,0,0,0.4)', px - 1, py + 16, w + 2, 2)

  // Dark wood desk
  fill(ctx, '#4a3020', px, py + 2, w, 12)
  fill(ctx, '#5c3d28', px, py + 2, w, 2)
  fill(ctx, '#6b4a32', px + 1, py + 3, w - 2, 1)
  // Gold trim
  fill(ctx, '#d4af37', px, py + 1, w, 1)
  fill(ctx, '#b8912e', px, py + 14, w, 1)

  // Panel divisions (drawers)
  fill(ctx, '#2d1e10', px + 1, py + 8, w - 2, 1)
  fill(ctx, '#2d1e10', px + Math.floor(w / 2), py + 8, 1, 6)
  fill(ctx, '#d4af37', px + Math.floor(w / 4), py + 11, 1, 1)
  fill(ctx, '#d4af37', px + Math.floor((w * 3) / 4), py + 11, 1, 1)

  // Legs
  fill(ctx, '#2d1e10', px + 2, py + 14, 3, 2)
  fill(ctx, '#2d1e10', px + w - 5, py + 14, 3, 2)

  // Large dual monitor
  const mx = px + Math.floor(w / 2) - 7
  fill(ctx, 'rgba(0,0,0,0.25)', mx, py - 4, 14, 10)
  fill(ctx, '#1a1f28', mx, py - 5, 14, 9)
  fill(ctx, '#3d1a5c', mx + 1, py - 4, 6, 6)
  fill(ctx, '#5a2680', mx + 7, py - 4, 6, 6)
  // Chart lines on left monitor
  fill(ctx, '#f4d35e', mx + 2, py - 2, 1, 1)
  fill(ctx, '#f4d35e', mx + 3, py - 3, 1, 1)
  fill(ctx, '#f4d35e', mx + 4, py - 1, 1, 1)
  fill(ctx, '#f4d35e', mx + 5, py - 2, 1, 1)
  // Text lines on right
  fill(ctx, '#a78bfa', mx + 8, py - 3, 4, 1)
  fill(ctx, '#c8a5ff', mx + 8, py - 1, 3, 1)

  // Gold nameplate
  fill(ctx, '#d4af37', px + Math.floor(w / 2) - 4, py + 5, 8, 2)
  fill(ctx, '#1a1108', px + Math.floor(w / 2) - 3, py + 6, 6, 1)
}

/** Modern office sofa with distinct cushions + backrest. */
function drawSofa(ctx: CanvasRenderingContext2D, f: Furniture) {
  const px = f.col * TILE_SIZE
  const py = f.row * TILE_SIZE
  const w = f.w * TILE_SIZE

  // Shadow
  fill(ctx, 'rgba(0,0,0,0.3)', px - 1, py + 15, w + 2, 2)

  // Backrest
  fill(ctx, '#3d4f73', px, py + 1, w, 6)
  fill(ctx, '#5469a0', px, py + 1, w, 2)
  fill(ctx, '#6a80b8', px + 1, py + 2, w - 2, 1)
  // Side arms
  fill(ctx, '#2d3a55', px, py + 2, 1, 10)
  fill(ctx, '#2d3a55', px + w - 1, py + 2, 1, 10)

  // Seat cushions
  fill(ctx, '#4a5f87', px + 1, py + 7, w - 2, 5)
  fill(ctx, '#5f7aa7', px + 1, py + 7, w - 2, 1)
  // Cushion divisions
  for (let i = 1; i < f.w; i++) {
    fill(ctx, '#2d3a55', px + i * TILE_SIZE - 1, py + 7, 1, 5)
  }
  // Cushion buttons
  for (let i = 0; i < f.w; i++) {
    fill(ctx, '#6a80b8', px + i * TILE_SIZE + 7, py + 9, 2, 1)
  }

  // Base
  fill(ctx, '#1d2537', px, py + 12, w, 2)
  fill(ctx, '#2c3a4f', px + 1, py + 12, w - 2, 1)
}

/** Potted plant with layered leaves + pot. */
function drawPlant(ctx: CanvasRenderingContext2D, f: Furniture) {
  const px = f.col * TILE_SIZE
  const py = f.row * TILE_SIZE

  // Shadow
  fill(ctx, 'rgba(0,0,0,0.3)', px + 3, py + 14, 10, 2)

  // Pot (tapered)
  fill(ctx, '#8b5a2b', px + 4, py + 10, 8, 5)
  fill(ctx, '#a3753f', px + 4, py + 10, 8, 1)
  fill(ctx, '#5e3a15', px + 4, py + 14, 8, 1)
  fill(ctx, '#bb8a54', px + 5, py + 11, 1, 3)
  // Pot rim
  fill(ctx, '#5e3a15', px + 3, py + 10, 10, 1)

  // Leaves — layered
  // Dark base
  fill(ctx, '#1a5522', px + 3, py + 5, 10, 6)
  // Mid
  fill(ctx, '#2f8f3a', px + 4, py + 3, 8, 6)
  fill(ctx, '#2f8f3a', px + 2, py + 7, 12, 2)
  // Light highlights
  fill(ctx, '#56d364', px + 5, py + 2, 2, 2)
  fill(ctx, '#56d364', px + 9, py + 2, 2, 2)
  fill(ctx, '#56d364', px + 6, py + 4, 1, 1)
  fill(ctx, '#56d364', px + 10, py + 5, 1, 1)
  fill(ctx, '#56d364', px + 4, py + 6, 1, 1)
  // Stems
  fill(ctx, '#1a5522', px + 7, py + 9, 2, 2)
}

/** Whiteboard with markers. */
function drawWhiteboard(ctx: CanvasRenderingContext2D, f: Furniture) {
  const px = f.col * TILE_SIZE
  const py = f.row * TILE_SIZE
  const w = f.w * TILE_SIZE
  // Frame
  fill(ctx, '#3a4150', px, py, w, 14)
  fill(ctx, '#5a6170', px, py, w, 1)
  // Board
  fill(ctx, '#f6f8fa', px + 1, py + 1, w - 2, 10)
  fill(ctx, '#e6edf3', px + 1, py + 10, w - 2, 1)
  // Writing
  fill(ctx, '#58a6ff', px + 2, py + 3, 4, 1)
  fill(ctx, '#3fb950', px + 2, py + 5, 6, 1)
  fill(ctx, '#f85149', px + 2, py + 7, 3, 1)
  fill(ctx, '#a78bfa', px + 6, py + 7, 4, 1)
  // Marker tray
  fill(ctx, '#2d333b', px + 1, py + 11, w - 2, 2)
  fill(ctx, '#f85149', px + 2, py + 12, 2, 1)
  fill(ctx, '#3fb950', px + 5, py + 12, 2, 1)
  fill(ctx, '#58a6ff', px + 8, py + 12, 2, 1)
}

/** Vending machine with visible snack rows. */
function drawVending(ctx: CanvasRenderingContext2D, f: Furniture) {
  const px = f.col * TILE_SIZE
  const py = f.row * TILE_SIZE
  // Shadow
  fill(ctx, 'rgba(0,0,0,0.3)', px + 1, py + 15, 14, 1)
  // Body
  fill(ctx, '#b22222', px + 1, py, 14, 16)
  fill(ctx, '#e03a3a', px + 1, py, 14, 2)
  fill(ctx, '#7a1515', px + 14, py, 1, 16)
  // Glass front
  fill(ctx, '#2d333b', px + 3, py + 2, 10, 9)
  fill(ctx, '#1a1f28', px + 3, py + 2, 10, 1)
  // Snack slots (2 cols x 3 rows)
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 2; c++) {
      const sx = px + 4 + c * 4
      const sy = py + 3 + r * 2
      fill(ctx, '#f4d35e', sx, sy, 3, 1)
      fill(ctx, '#ee964b', sx, sy + 1, 3, 1)
    }
  }
  // Dispenser tray
  fill(ctx, '#1a1f28', px + 3, py + 12, 10, 2)
  // Buttons
  fill(ctx, '#56d364', px + 12, py + 4, 1, 1)
  fill(ctx, '#f85149', px + 12, py + 6, 1, 1)
  fill(ctx, '#58a6ff', px + 12, py + 8, 1, 1)
}

/** Water cooler with bottle. */
function drawCooler(ctx: CanvasRenderingContext2D, f: Furniture) {
  const px = f.col * TILE_SIZE
  const py = f.row * TILE_SIZE
  // Shadow
  fill(ctx, 'rgba(0,0,0,0.3)', px + 3, py + 15, 10, 1)
  // Water bottle
  fill(ctx, '#2d333b', px + 6, py, 4, 1)
  fill(ctx, '#58a6ff', px + 4, py + 1, 8, 6)
  fill(ctx, '#a5d6ff', px + 5, py + 2, 6, 4)
  fill(ctx, '#c2e5ff', px + 6, py + 2, 2, 2)
  // Body
  fill(ctx, '#8b949e', px + 3, py + 7, 10, 2)
  fill(ctx, '#6e7681', px + 3, py + 7, 10, 1)
  fill(ctx, '#484f58', px + 4, py + 9, 8, 6)
  fill(ctx, '#6e7681', px + 4, py + 9, 8, 1)
  // Taps
  fill(ctx, '#58a6ff', px + 5, py + 11, 1, 2)
  fill(ctx, '#f85149', px + 10, py + 11, 1, 2)
  // Cup holder
  fill(ctx, '#2d333b', px + 6, py + 13, 4, 2)
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
