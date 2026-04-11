import type { Agent, Team } from '@/types'
import { Dir, TileType } from '../types'
import type { Furniture, Seat, World } from '../types'
import { WORLD_COLS, WORLD_ROWS, CEO_ROWS, BREAK_ROWS, TILE_SIZE } from '../constants'
import { fillRect, setTile } from './tileMap'

let uidCounter = 0
function nextUid(prefix: string): string {
  uidCounter += 1
  return `${prefix}-${uidCounter}`
}

interface ZoneRect {
  x: number
  y: number
  w: number
  h: number
}

function computeTeamZones(teamCount: number, midY: number, midH: number): ZoneRect[] {
  const totalW = WORLD_COLS - 2
  const startX = 1

  const colsPerRow = teamCount <= 4 ? 2 : teamCount <= 9 ? 3 : 4
  const rowsCount = Math.ceil(teamCount / colsPerRow)
  const zoneW = Math.floor(totalW / colsPerRow)
  const zoneH = Math.floor(midH / rowsCount)

  const zones: ZoneRect[] = []
  for (let i = 0; i < teamCount; i++) {
    const gx = i % colsPerRow
    const gy = Math.floor(i / colsPerRow)
    zones.push({
      x: startX + gx * zoneW,
      y: midY + gy * zoneH,
      w: zoneW,
      h: zoneH,
    })
  }
  return zones
}

/**
 * Draw walls around the zone leaving a front-bottom doorway.
 * Inside becomes carpet; walls are team-tinted along the top.
 */
function partitionZone(world: World, zone: ZoneRect, team: Team): void {
  // Top + left + right walls; bottom has a doorway
  for (let c = zone.x; c < zone.x + zone.w; c++) {
    setTile(world, c, zone.y, TileType.WALL, team.color)
  }
  for (let r = zone.y; r < zone.y + zone.h; r++) {
    setTile(world, zone.x, r, TileType.WALL, team.color)
    setTile(world, zone.x + zone.w - 1, r, TileType.WALL, team.color)
  }
  // Bottom wall except a 2-tile doorway in the middle
  const doorStart = zone.x + Math.floor(zone.w / 2) - 1
  const doorEnd = doorStart + 2
  for (let c = zone.x; c < zone.x + zone.w; c++) {
    if (c >= doorStart && c < doorEnd) continue
    setTile(world, c, zone.y + zone.h - 1, TileType.WALL, team.color)
  }

  // Paint interior carpet
  for (let row = zone.y + 1; row < zone.y + zone.h - 1; row++) {
    for (let col = zone.x + 1; col < zone.x + zone.w - 1; col++) {
      const checker = (col + row) % 2 === 0
      setTile(world, col, row, checker ? TileType.CARPET_A : TileType.CARPET_B, team.color)
    }
  }
}

function placeDesksInZone(
  _world: World,
  zone: ZoneRect,
  team: Team,
  agentCount: number,
): { desks: Furniture[]; seats: Seat[] } {
  const desks: Furniture[] = []
  const seats: Seat[] = []

  // Interior usable area (inside the walls). Keep top row clear for
  // whiteboard and bottom row clear for doorway.
  const innerX = zone.x + 1
  const innerY = zone.y + 2
  const innerW = zone.w - 2
  const innerH = zone.h - 3

  if (innerW < 2 || innerH < 2) return { desks, seats }

  // Two columns of desks (2-wide each) along left and right
  const colXs = [innerX, innerX + innerW - 2]
  const deskRowStep = 2 // desk (1) + seat (1), no gap
  const rowsPerCol = Math.max(1, Math.floor(innerH / deskRowStep))

  let placed = 0
  for (let ri = 0; ri < rowsPerCol && placed < agentCount; ri++) {
    for (const cx of colXs) {
      if (placed >= agentCount) break
      const row = innerY + ri * deskRowStep
      if (row + 1 >= innerY + innerH) break
      const deskUid = nextUid('desk')
      desks.push({
        uid: deskUid,
        type: 'desk',
        col: cx,
        row,
        w: 2,
        h: 1,
        color: team.color,
        facing: Dir.DOWN,
      })
      const seatUid = nextUid('seat')
      seats.push({
        uid: seatUid,
        col: cx,
        row: row + 1,
        facing: Dir.UP,
        deskUid,
        teamId: team.id,
      })
      placed++
    }
  }

  // Team name plate placeholder (whiteboard on top wall)
  if (innerW >= 4) {
    desks.push({
      uid: nextUid('whiteboard'),
      type: 'whiteboard',
      col: zone.x + Math.floor(zone.w / 2) - 1,
      row: zone.y + 1,
      w: 2,
      h: 1,
      color: team.color,
    })
  }

  // Plant in a corner
  if (innerW >= 4) {
    desks.push({
      uid: nextUid('plant'),
      type: 'plant',
      col: zone.x + zone.w - 2,
      row: zone.y + zone.h - 3,
      w: 1,
      h: 1,
      color: team.color,
    })
  }

  return { desks, seats }
}

function buildLoungeArea(world: World, breakY: number): void {
  const cols = WORLD_COLS
  const breakBottom = WORLD_ROWS - 2

  // Left sofa group: two sofas facing each other with a coffee table between
  const g1cx = 6
  const g1cy = breakY + 3
  world.furniture.push({
    uid: nextUid('sofa'),
    type: 'sofa',
    col: g1cx - 1,
    row: g1cy - 2,
    w: 3,
    h: 1,
    facing: Dir.DOWN,
  })
  world.furniture.push({
    uid: nextUid('coffee-table'),
    type: 'coffeeTable',
    col: g1cx,
    row: g1cy,
    w: 1,
    h: 1,
  })
  world.furniture.push({
    uid: nextUid('sofa'),
    type: 'sofa',
    col: g1cx - 1,
    row: g1cy + 2,
    w: 3,
    h: 1,
    facing: Dir.UP,
  })

  // Right sofa group: mirror
  const g2cx = cols - 7
  const g2cy = breakY + 3
  world.furniture.push({
    uid: nextUid('sofa'),
    type: 'sofa',
    col: g2cx - 1,
    row: g2cy - 2,
    w: 3,
    h: 1,
    facing: Dir.DOWN,
  })
  world.furniture.push({
    uid: nextUid('coffee-table'),
    type: 'coffeeTable',
    col: g2cx,
    row: g2cy,
    w: 1,
    h: 1,
  })
  world.furniture.push({
    uid: nextUid('sofa'),
    type: 'sofa',
    col: g2cx - 1,
    row: g2cy + 2,
    w: 3,
    h: 1,
    facing: Dir.UP,
  })

  // Center: ping pong table
  const centerCol = Math.floor(cols / 2) - 2
  world.furniture.push({
    uid: nextUid('pingpong'),
    type: 'pingPong',
    col: centerCol,
    row: breakY + 3,
    w: 4,
    h: 2,
  })

  // Lounge chairs near center
  world.furniture.push({
    uid: nextUid('lounge-chair'),
    type: 'loungeChair',
    col: centerCol - 2,
    row: breakY + 2,
    w: 1,
    h: 1,
    facing: Dir.DOWN,
  })
  world.furniture.push({
    uid: nextUid('lounge-chair'),
    type: 'loungeChair',
    col: centerCol + 5,
    row: breakY + 2,
    w: 1,
    h: 1,
    facing: Dir.DOWN,
  })

  // Coffee machine + vending + water cooler on back wall
  world.furniture.push({
    uid: nextUid('coffee-machine'),
    type: 'coffeeMachine',
    col: 2,
    row: breakY + 1,
    w: 1,
    h: 1,
  })
  world.furniture.push({
    uid: nextUid('vending'),
    type: 'vendingMachine',
    col: 3,
    row: breakY + 1,
    w: 1,
    h: 1,
  })
  world.furniture.push({
    uid: nextUid('cooler'),
    type: 'cooler',
    col: cols - 4,
    row: breakY + 1,
    w: 1,
    h: 1,
  })

  // Bookshelves on outer walls
  world.furniture.push({
    uid: nextUid('bookshelf'),
    type: 'bookshelf',
    col: 2,
    row: breakBottom - 2,
    w: 2,
    h: 1,
  })
  world.furniture.push({
    uid: nextUid('bookshelf'),
    type: 'bookshelf',
    col: cols - 4,
    row: breakBottom - 2,
    w: 2,
    h: 1,
  })

  // Plants scattered around
  world.furniture.push({
    uid: nextUid('plant'),
    type: 'plant',
    col: 1,
    row: breakY + 1,
    w: 1,
    h: 1,
  })
  world.furniture.push({
    uid: nextUid('plant'),
    type: 'plant',
    col: cols - 2,
    row: breakY + 1,
    w: 1,
    h: 1,
  })
  world.furniture.push({
    uid: nextUid('plant'),
    type: 'plant',
    col: 1,
    row: breakBottom - 1,
    w: 1,
    h: 1,
  })
  world.furniture.push({
    uid: nextUid('plant'),
    type: 'plant',
    col: cols - 2,
    row: breakBottom - 1,
    w: 1,
    h: 1,
  })

  // Lounge spots: seat positions on each sofa cushion
  // Sofa facing DOWN (backrest at top, seat at bottom of sofa tile): character sits ON the sofa at its tile
  const addSofaSpots = (col: number, row: number, width: number, facing: number) => {
    for (let i = 0; i < width; i++) {
      world.loungeSpots.push({
        uid: nextUid('lspot'),
        col: col + i,
        row: row,
        facing: facing as 0 | 1 | 2 | 3,
        kind: 'sofa',
      })
    }
  }
  addSofaSpots(g1cx - 1, g1cy - 2, 3, Dir.DOWN)
  addSofaSpots(g1cx - 1, g1cy + 2, 3, Dir.UP)
  addSofaSpots(g2cx - 1, g2cy - 2, 3, Dir.DOWN)
  addSofaSpots(g2cx - 1, g2cy + 2, 3, Dir.UP)

  // Lounge chair spots
  world.loungeSpots.push({
    uid: nextUid('lspot'),
    col: centerCol - 2,
    row: breakY + 2,
    facing: Dir.DOWN,
    kind: 'chair',
  })
  world.loungeSpots.push({
    uid: nextUid('lspot'),
    col: centerCol + 5,
    row: breakY + 2,
    facing: Dir.DOWN,
    kind: 'chair',
  })
}

export function buildDefaultLayout(teams: Team[], agents: Agent[]): World {
  uidCounter = 0
  const world: World = {
    cols: WORLD_COLS,
    rows: WORLD_ROWS,
    tiles: new Array(WORLD_COLS * WORLD_ROWS).fill(TileType.VOID),
    tileTint: new Array(WORLD_COLS * WORLD_ROWS).fill(null),
    furniture: [],
    seats: [],
    loungeSpots: [],
    breakTiles: [],
    ceoQueueTiles: [],
    ceoDesk: null,
    characters: new Map(),
    teamZones: new Map(),
    time: 0,
  }

  // --- Outer walls ---
  for (let c = 0; c < WORLD_COLS; c++) {
    setTile(world, c, 0, TileType.WALL)
    setTile(world, c, WORLD_ROWS - 1, TileType.WALL)
  }
  for (let r = 0; r < WORLD_ROWS; r++) {
    setTile(world, 0, r, TileType.WALL)
    setTile(world, WORLD_COLS - 1, r, TileType.WALL)
  }

  // --- CEO zone (top) ---
  const ceoY = 1
  const ceoH = CEO_ROWS
  fillRect(world, 1, ceoY, WORLD_COLS - 2, ceoH, TileType.CEO)

  // --- Break zone (bottom) ---
  const breakY = WORLD_ROWS - 1 - BREAK_ROWS
  fillRect(world, 1, breakY, WORLD_COLS - 2, BREAK_ROWS, TileType.BREAK)

  // --- Middle = team area ---
  const midY = ceoY + ceoH + 1 // +1 for corridor separator
  const midH = breakY - midY - 1 // -1 for corridor separator below

  // Corridor between CEO and team area (floor)
  fillRect(world, 1, midY - 1, WORLD_COLS - 2, 1, TileType.FLOOR)
  // Corridor between team area and break
  fillRect(world, 1, breakY - 1, WORLD_COLS - 2, 1, TileType.FLOOR)

  // Team zones
  const activeTeams = teams.filter((t) => agents.some((a) => a.team === t.id))
  const zones = computeTeamZones(activeTeams.length, midY, midH)

  activeTeams.forEach((team, i) => {
    const zone = zones[i]
    if (!zone) return
    world.teamZones.set(team.id, { ...zone, color: team.color })
    partitionZone(world, zone, team)
    const teamAgents = agents.filter((a) => a.team === team.id)
    const { desks, seats } = placeDesksInZone(world, zone, team, teamAgents.length)
    world.furniture.push(...desks)
    world.seats.push(...seats)
  })

  // Fill remaining VOID in the main hall with FLOOR (walking corridors)
  for (let r = midY - 1; r < midY + midH + 1; r++) {
    for (let c = 1; c < WORLD_COLS - 1; c++) {
      const i = r * WORLD_COLS + c
      if (world.tiles[i] === TileType.VOID) {
        world.tiles[i] = TileType.FLOOR
      }
    }
  }

  // --- CEO furniture ---
  const ceoDeskCol = Math.floor(WORLD_COLS / 2) - 2
  const ceoDeskRow = ceoY + 1
  world.furniture.push({
    uid: nextUid('ceodesk'),
    type: 'ceoDesk',
    col: ceoDeskCol,
    row: ceoDeskRow,
    w: 4,
    h: 1,
    color: '#a78bfa',
    facing: Dir.DOWN,
  })
  world.ceoDesk = { col: ceoDeskCol + 1, row: ceoDeskRow + 1 }

  const queueRow = ceoY + ceoH - 1
  const queueStart = ceoDeskCol
  for (let i = 0; i < 8; i++) {
    world.ceoQueueTiles.push({ col: queueStart + i, row: queueRow })
  }

  // --- Lounge area ---
  buildLoungeArea(world, breakY)

  // Break tiles (walkable open floor in break zone, not where furniture sits)
  const furnitureBlocked = new Set<number>()
  for (const f of world.furniture) {
    if (f.row < breakY) continue
    for (let dy = 0; dy < f.h; dy++) {
      for (let dx = 0; dx < f.w; dx++) {
        furnitureBlocked.add((f.row + dy) * WORLD_COLS + (f.col + dx))
      }
    }
  }
  for (let r = breakY; r < WORLD_ROWS - 1; r++) {
    for (let c = 1; c < WORLD_COLS - 1; c++) {
      const k = r * WORLD_COLS + c
      if (world.tiles[k] === TileType.BREAK && !furnitureBlocked.has(k)) {
        world.breakTiles.push({ col: c, row: r })
      }
    }
  }

  return world
}

/** Pixel position of the center of a tile. */
export function tileCenterPx(col: number, row: number): { x: number; y: number } {
  return {
    x: col * TILE_SIZE + TILE_SIZE / 2,
    y: row * TILE_SIZE + TILE_SIZE / 2,
  }
}

export function assignSeats(world: World, agents: Agent[]): Map<string, string> {
  const byTeam = new Map<string, string[]>()
  for (const seat of world.seats) {
    const arr = byTeam.get(seat.teamId) ?? []
    arr.push(seat.uid)
    byTeam.set(seat.teamId, arr)
  }
  const mapping = new Map<string, string>()
  for (const agent of agents) {
    const pool = byTeam.get(agent.team)
    if (!pool || pool.length === 0) continue
    const seatUid = pool.shift()!
    mapping.set(agent.id, seatUid)
  }
  return mapping
}
