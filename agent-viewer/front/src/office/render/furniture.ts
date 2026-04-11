import { TILE_SIZE } from '../constants'
import { CharState } from '../types'
import type { Furniture, World } from '../types'

function fill(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
}

interface DrawContext {
  time: number
  activeSeatKeys: Set<string>
}

/** Desk with monitor, keyboard, mouse, coffee mug, sticky notes. */
function drawDesk(ctx: CanvasRenderingContext2D, f: Furniture, dctx: DrawContext) {
  const px = f.col * TILE_SIZE
  const py = f.row * TILE_SIZE
  const w = f.w * TILE_SIZE
  const h = TILE_SIZE
  const accent = f.color ?? '#58a6ff'

  // Active if there's a TYPE character at the seat row (f.row+1) under either tile
  const seatKeyL = `${f.col}:${f.row + 1}`
  const active = dctx.activeSeatKeys.has(seatKeyL)

  // Drop shadow
  fill(ctx, 'rgba(0,0,0,0.35)', px - 1, py + h + 1, w + 2, 2)

  // Desktop (wood grain)
  fill(ctx, '#6b4c32', px, py + 2, w, 8)
  fill(ctx, '#7d5a3c', px, py + 2, w, 1)
  fill(ctx, '#8a6748', px + 1, py + 3, w - 2, 1)
  for (let gx = px + 3; gx < px + w - 2; gx += 4) {
    fill(ctx, '#5a3f2a', gx, py + 5, 1, 1)
    fill(ctx, '#5a3f2a', gx + 2, py + 7, 1, 1)
  }
  fill(ctx, accent, px, py + 1, w, 1)
  fill(ctx, accent, px, py + 2, 1, 8)
  fill(ctx, accent, px + w - 1, py + 2, 1, 8)

  // Legs
  fill(ctx, '#3a2817', px + 1, py + 10, 2, 5)
  fill(ctx, '#2d1e10', px + 1, py + 14, 2, 1)
  fill(ctx, '#3a2817', px + w - 3, py + 10, 2, 5)
  fill(ctx, '#2d1e10', px + w - 3, py + 14, 2, 1)

  // Monitor
  const mx = px + Math.floor(w / 2) - 5
  const my = py - 2
  fill(ctx, 'rgba(0,0,0,0.25)', mx, my + 1, 10, 8)
  fill(ctx, '#1a1f28', mx, my, 10, 8)
  fill(ctx, '#2d333b', mx, my, 10, 1)

  if (active) {
    // Animated scrolling code lines
    fill(ctx, '#0d2438', mx + 1, my + 1, 8, 6)
    const t = dctx.time
    const scroll = Math.floor(t * 6) % 6
    const lines = [
      { col: '#58a6ff', w: 5 },
      { col: '#3fb950', w: 3, w2: 2, col2: '#d29922', gap: 4 },
      { col: '#a78bfa', w: 4 },
      { col: '#58a6ff', w: 6 },
      { col: '#ff7b72', w: 2, w2: 3, col2: '#79c0ff', gap: 3 },
      { col: '#3fb950', w: 5 },
    ]
    for (let i = 0; i < 5; i++) {
      const lineIdx = (i + scroll) % lines.length
      const line = lines[lineIdx]
      const ly = my + 1 + i
      fill(ctx, line.col, mx + 2, ly, Math.min(line.w, 7 - 0), 1)
      if (line.w2 && line.col2 && line.gap) {
        fill(ctx, line.col2, mx + 2 + line.gap, ly, line.w2, 1)
      }
    }
    // Cursor blink
    if (Math.floor(t * 2) % 2 === 0) {
      fill(ctx, '#ffffff', mx + 7, my + 5, 1, 1)
    }
    // Screen glow under active monitor
    fill(ctx, 'rgba(88,166,255,0.25)', mx + 1, my + 6, 8, 2)
    fill(ctx, 'rgba(88,166,255,0.15)', mx - 1, my - 1, 12, 1)
  } else {
    // Dim idle screen
    fill(ctx, '#0a1522', mx + 1, my + 1, 8, 6)
    fill(ctx, '#1a3048', mx + 2, my + 3, 4, 1)
    fill(ctx, '#1a3048', mx + 2, my + 5, 3, 1)
  }
  // Stand
  fill(ctx, '#484f58', mx + 4, my + 8, 2, 1)
  fill(ctx, '#2d333b', mx + 3, my + 9, 4, 1)

  // Keyboard
  fill(ctx, '#2d333b', px + 2, py + 4, 6, 2)
  fill(ctx, '#484f58', px + 2, py + 4, 6, 1)
  for (let kx = 0; kx < 3; kx++) {
    fill(ctx, '#6e7681', px + 3 + kx * 2, py + 5, 1, 1)
  }

  // Coffee mug
  fill(ctx, '#e6edf3', px + w - 5, py + 5, 3, 3)
  fill(ctx, '#484f58', px + w - 5, py + 5, 3, 1)
  fill(ctx, '#6a3d1c', px + w - 4, py + 6, 1, 1)
  fill(ctx, '#8b949e', px + w - 2, py + 6, 1, 1)

  // Sticky note
  fill(ctx, '#f4d35e', px + w - 9, py + 5, 2, 2)
  fill(ctx, '#d4b043', px + w - 9, py + 5, 2, 1)
}

function drawCeoDesk(ctx: CanvasRenderingContext2D, f: Furniture, dctx: DrawContext) {
  const px = f.col * TILE_SIZE
  const py = f.row * TILE_SIZE
  const w = f.w * TILE_SIZE

  fill(ctx, 'rgba(0,0,0,0.4)', px - 1, py + 16, w + 2, 2)

  fill(ctx, '#4a3020', px, py + 2, w, 12)
  fill(ctx, '#5c3d28', px, py + 2, w, 2)
  fill(ctx, '#6b4a32', px + 1, py + 3, w - 2, 1)
  fill(ctx, '#d4af37', px, py + 1, w, 1)
  fill(ctx, '#b8912e', px, py + 14, w, 1)

  fill(ctx, '#2d1e10', px + 1, py + 8, w - 2, 1)
  fill(ctx, '#2d1e10', px + Math.floor(w / 2), py + 8, 1, 6)
  fill(ctx, '#d4af37', px + Math.floor(w / 4), py + 11, 1, 1)
  fill(ctx, '#d4af37', px + Math.floor((w * 3) / 4), py + 11, 1, 1)

  fill(ctx, '#2d1e10', px + 2, py + 14, 3, 2)
  fill(ctx, '#2d1e10', px + w - 5, py + 14, 3, 2)

  // Dual monitor
  const mx = px + Math.floor(w / 2) - 7
  fill(ctx, 'rgba(0,0,0,0.25)', mx, py - 4, 14, 10)
  fill(ctx, '#1a1f28', mx, py - 5, 14, 9)
  fill(ctx, '#3d1a5c', mx + 1, py - 4, 6, 6)
  fill(ctx, '#5a2680', mx + 7, py - 4, 6, 6)
  // Animated chart bars on left
  const t = dctx.time
  for (let i = 0; i < 5; i++) {
    const h = 2 + Math.floor(Math.sin(t * 2 + i) * 2 + 2)
    fill(ctx, '#f4d35e', mx + 2 + i, py + 2 - h, 1, h)
  }
  // Text lines right
  fill(ctx, '#a78bfa', mx + 8, py - 3, 4, 1)
  fill(ctx, '#c8a5ff', mx + 8, py - 1, 3, 1)

  // Nameplate
  fill(ctx, '#d4af37', px + Math.floor(w / 2) - 4, py + 5, 8, 2)
  fill(ctx, '#1a1108', px + Math.floor(w / 2) - 3, py + 6, 6, 1)
}

function drawSofa(ctx: CanvasRenderingContext2D, f: Furniture) {
  const px = f.col * TILE_SIZE
  const py = f.row * TILE_SIZE
  const w = f.w * TILE_SIZE

  fill(ctx, 'rgba(0,0,0,0.3)', px - 1, py + 15, w + 2, 2)

  // Backrest
  fill(ctx, '#3d4f73', px, py + 1, w, 6)
  fill(ctx, '#5469a0', px, py + 1, w, 2)
  fill(ctx, '#6a80b8', px + 1, py + 2, w - 2, 1)
  // Arms
  fill(ctx, '#2d3a55', px, py + 2, 1, 10)
  fill(ctx, '#2d3a55', px + w - 1, py + 2, 1, 10)
  // Seat cushions
  fill(ctx, '#4a5f87', px + 1, py + 7, w - 2, 5)
  fill(ctx, '#5f7aa7', px + 1, py + 7, w - 2, 1)
  for (let i = 1; i < f.w; i++) {
    fill(ctx, '#2d3a55', px + i * TILE_SIZE - 1, py + 7, 1, 5)
  }
  for (let i = 0; i < f.w; i++) {
    fill(ctx, '#6a80b8', px + i * TILE_SIZE + 7, py + 9, 2, 1)
  }
  fill(ctx, '#1d2537', px, py + 12, w, 2)
  fill(ctx, '#2c3a4f', px + 1, py + 12, w - 2, 1)
}

function drawPlant(ctx: CanvasRenderingContext2D, f: Furniture) {
  const px = f.col * TILE_SIZE
  const py = f.row * TILE_SIZE
  fill(ctx, 'rgba(0,0,0,0.3)', px + 3, py + 14, 10, 2)
  fill(ctx, '#8b5a2b', px + 4, py + 10, 8, 5)
  fill(ctx, '#a3753f', px + 4, py + 10, 8, 1)
  fill(ctx, '#5e3a15', px + 4, py + 14, 8, 1)
  fill(ctx, '#bb8a54', px + 5, py + 11, 1, 3)
  fill(ctx, '#5e3a15', px + 3, py + 10, 10, 1)
  fill(ctx, '#1a5522', px + 3, py + 5, 10, 6)
  fill(ctx, '#2f8f3a', px + 4, py + 3, 8, 6)
  fill(ctx, '#2f8f3a', px + 2, py + 7, 12, 2)
  fill(ctx, '#56d364', px + 5, py + 2, 2, 2)
  fill(ctx, '#56d364', px + 9, py + 2, 2, 2)
  fill(ctx, '#56d364', px + 6, py + 4, 1, 1)
  fill(ctx, '#56d364', px + 10, py + 5, 1, 1)
  fill(ctx, '#56d364', px + 4, py + 6, 1, 1)
  fill(ctx, '#1a5522', px + 7, py + 9, 2, 2)
}

function drawWhiteboard(ctx: CanvasRenderingContext2D, f: Furniture) {
  const px = f.col * TILE_SIZE
  const py = f.row * TILE_SIZE
  const w = f.w * TILE_SIZE
  fill(ctx, '#3a4150', px, py, w, 14)
  fill(ctx, '#5a6170', px, py, w, 1)
  fill(ctx, '#f6f8fa', px + 1, py + 1, w - 2, 10)
  fill(ctx, '#e6edf3', px + 1, py + 10, w - 2, 1)
  fill(ctx, '#58a6ff', px + 2, py + 3, 4, 1)
  fill(ctx, '#3fb950', px + 2, py + 5, 6, 1)
  fill(ctx, '#f85149', px + 2, py + 7, 3, 1)
  fill(ctx, '#a78bfa', px + 6, py + 7, 4, 1)
  fill(ctx, '#2d333b', px + 1, py + 11, w - 2, 2)
  fill(ctx, '#f85149', px + 2, py + 12, 2, 1)
  fill(ctx, '#3fb950', px + 5, py + 12, 2, 1)
  fill(ctx, '#58a6ff', px + 8, py + 12, 2, 1)
}

function drawVending(ctx: CanvasRenderingContext2D, f: Furniture) {
  const px = f.col * TILE_SIZE
  const py = f.row * TILE_SIZE
  fill(ctx, 'rgba(0,0,0,0.3)', px + 1, py + 15, 14, 1)
  fill(ctx, '#b22222', px + 1, py, 14, 16)
  fill(ctx, '#e03a3a', px + 1, py, 14, 2)
  fill(ctx, '#7a1515', px + 14, py, 1, 16)
  fill(ctx, '#2d333b', px + 3, py + 2, 10, 9)
  fill(ctx, '#1a1f28', px + 3, py + 2, 10, 1)
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 2; c++) {
      const sx = px + 4 + c * 4
      const sy = py + 3 + r * 2
      fill(ctx, '#f4d35e', sx, sy, 3, 1)
      fill(ctx, '#ee964b', sx, sy + 1, 3, 1)
    }
  }
  fill(ctx, '#1a1f28', px + 3, py + 12, 10, 2)
  fill(ctx, '#56d364', px + 12, py + 4, 1, 1)
  fill(ctx, '#f85149', px + 12, py + 6, 1, 1)
  fill(ctx, '#58a6ff', px + 12, py + 8, 1, 1)
}

function drawCooler(ctx: CanvasRenderingContext2D, f: Furniture) {
  const px = f.col * TILE_SIZE
  const py = f.row * TILE_SIZE
  fill(ctx, 'rgba(0,0,0,0.3)', px + 3, py + 15, 10, 1)
  fill(ctx, '#2d333b', px + 6, py, 4, 1)
  fill(ctx, '#58a6ff', px + 4, py + 1, 8, 6)
  fill(ctx, '#a5d6ff', px + 5, py + 2, 6, 4)
  fill(ctx, '#c2e5ff', px + 6, py + 2, 2, 2)
  fill(ctx, '#8b949e', px + 3, py + 7, 10, 2)
  fill(ctx, '#6e7681', px + 3, py + 7, 10, 1)
  fill(ctx, '#484f58', px + 4, py + 9, 8, 6)
  fill(ctx, '#6e7681', px + 4, py + 9, 8, 1)
  fill(ctx, '#58a6ff', px + 5, py + 11, 1, 2)
  fill(ctx, '#f85149', px + 10, py + 11, 1, 2)
  fill(ctx, '#2d333b', px + 6, py + 13, 4, 2)
}

function drawCoffeeTable(ctx: CanvasRenderingContext2D, f: Furniture) {
  const px = f.col * TILE_SIZE
  const py = f.row * TILE_SIZE
  fill(ctx, 'rgba(0,0,0,0.3)', px + 1, py + 13, 14, 2)
  // Table top
  fill(ctx, '#6b4c32', px + 2, py + 6, 12, 4)
  fill(ctx, '#8a6748', px + 2, py + 6, 12, 1)
  fill(ctx, '#5a3f2a', px + 2, py + 9, 12, 1)
  // Legs
  fill(ctx, '#3a2817', px + 3, py + 10, 2, 4)
  fill(ctx, '#3a2817', px + 11, py + 10, 2, 4)
  // Items on table
  fill(ctx, '#f6f8fa', px + 4, py + 4, 3, 3)  // mug
  fill(ctx, '#6a3d1c', px + 5, py + 5, 1, 1)
  fill(ctx, '#c4424a', px + 9, py + 4, 3, 3)  // phone / book
  fill(ctx, '#e6edf3', px + 9, py + 4, 3, 1)
}

function drawLoungeChair(ctx: CanvasRenderingContext2D, f: Furniture) {
  const px = f.col * TILE_SIZE
  const py = f.row * TILE_SIZE
  fill(ctx, 'rgba(0,0,0,0.3)', px + 1, py + 14, 14, 2)
  // Backrest curve
  fill(ctx, '#8a4a1c', px + 3, py + 2, 10, 5)
  fill(ctx, '#a35a2a', px + 3, py + 2, 10, 2)
  fill(ctx, '#5a2f0e', px + 2, py + 3, 1, 4)
  fill(ctx, '#5a2f0e', px + 13, py + 3, 1, 4)
  // Seat
  fill(ctx, '#c07040', px + 2, py + 7, 12, 5)
  fill(ctx, '#d88b4e', px + 3, py + 7, 10, 1)
  // Legs
  fill(ctx, '#2d1e10', px + 3, py + 12, 2, 3)
  fill(ctx, '#2d1e10', px + 11, py + 12, 2, 3)
}

function drawBookshelf(ctx: CanvasRenderingContext2D, f: Furniture) {
  const px = f.col * TILE_SIZE
  const py = f.row * TILE_SIZE
  const w = f.w * TILE_SIZE
  fill(ctx, 'rgba(0,0,0,0.35)', px, py + 15, w, 1)
  // Frame
  fill(ctx, '#4a3020', px, py, w, 16)
  fill(ctx, '#6b4a32', px, py, w, 1)
  fill(ctx, '#3a2817', px, py + 15, w, 1)
  // Shelves with books
  for (let shelf = 0; shelf < 3; shelf++) {
    const sy = py + 2 + shelf * 5
    // Shelf board
    fill(ctx, '#3a2817', px + 1, sy + 4, w - 2, 1)
    // Books
    const colors = ['#58a6ff', '#3fb950', '#f85149', '#a78bfa', '#d29922', '#f0883e']
    for (let b = 0; b < Math.floor((w - 4) / 2); b++) {
      const col = colors[(shelf * 3 + b) % colors.length]
      fill(ctx, col, px + 2 + b * 2, sy, 1, 4)
      fill(ctx, '#ffffff', px + 2 + b * 2, sy, 1, 1)
    }
  }
}

function drawCoffeeMachine(ctx: CanvasRenderingContext2D, f: Furniture) {
  const px = f.col * TILE_SIZE
  const py = f.row * TILE_SIZE
  fill(ctx, 'rgba(0,0,0,0.3)', px + 1, py + 15, 14, 1)
  // Base
  fill(ctx, '#2d333b', px + 2, py + 3, 12, 13)
  fill(ctx, '#484f58', px + 2, py + 3, 12, 2)
  // Water tank
  fill(ctx, '#58a6ff', px + 3, py + 4, 3, 4)
  fill(ctx, '#a5d6ff', px + 3, py + 4, 3, 1)
  // Display
  fill(ctx, '#1a1f28', px + 7, py + 5, 6, 3)
  fill(ctx, '#3fb950', px + 8, py + 6, 4, 1)
  // Dispenser
  fill(ctx, '#6e7681', px + 6, py + 9, 4, 2)
  fill(ctx, '#2d1e10', px + 7, py + 11, 2, 2)
  // Drip tray
  fill(ctx, '#6e7681', px + 4, py + 13, 8, 2)
}

function drawPingPong(ctx: CanvasRenderingContext2D, f: Furniture) {
  const px = f.col * TILE_SIZE
  const py = f.row * TILE_SIZE
  const w = f.w * TILE_SIZE
  const h = f.h * TILE_SIZE
  fill(ctx, 'rgba(0,0,0,0.3)', px + 1, py + h - 1, w - 2, 2)
  // Table
  fill(ctx, '#1e7a3f', px, py + 3, w, h - 6)
  fill(ctx, '#26a04f', px, py + 3, w, 2)
  // Net
  fill(ctx, '#ffffff', px + Math.floor(w / 2) - 1, py + 3, 2, h - 6)
  // White lines
  fill(ctx, '#ffffff', px, py + 3, w, 1)
  fill(ctx, '#ffffff', px, py + h - 4, w, 1)
  // Legs
  fill(ctx, '#2d1e10', px + 2, py + h - 3, 2, 3)
  fill(ctx, '#2d1e10', px + w - 4, py + h - 3, 2, 3)
}

function buildActiveSeatKeys(world: World): Set<string> {
  const keys = new Set<string>()
  for (const c of world.characters.values()) {
    if (c.state !== CharState.TYPE) continue
    if (!c.seatId) continue
    const seat = world.seats.find((s) => s.uid === c.seatId)
    if (seat) keys.add(`${seat.col}:${seat.row}`)
  }
  return keys
}

export function drawFurniture(ctx: CanvasRenderingContext2D, world: World): void {
  const dctx: DrawContext = {
    time: world.time,
    activeSeatKeys: buildActiveSeatKeys(world),
  }
  const sorted = [...world.furniture].sort((a, b) => (a.row + a.h) - (b.row + b.h))
  for (const f of sorted) {
    switch (f.type) {
      case 'desk':
        drawDesk(ctx, f, dctx)
        break
      case 'ceoDesk':
        drawCeoDesk(ctx, f, dctx)
        break
      case 'sofa':
      case 'sofaH':
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
      case 'coffeeTable':
        drawCoffeeTable(ctx, f)
        break
      case 'loungeChair':
        drawLoungeChair(ctx, f)
        break
      case 'bookshelf':
        drawBookshelf(ctx, f)
        break
      case 'coffeeMachine':
        drawCoffeeMachine(ctx, f)
        break
      case 'pingPong':
        drawPingPong(ctx, f)
        break
    }
  }
}
