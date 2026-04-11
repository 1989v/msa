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
  // All available cols for teams (padded by 1 for walls)
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
      x: startX + gx * zoneW + 1,
      y: midY + gy * zoneH + 1,
      w: zoneW - 2,
      h: zoneH - 2,
    })
  }
  return zones
}

function placeDesksInZone(
  _world: World,
  zone: ZoneRect,
  team: Team,
  agentCount: number
): { desks: Furniture[]; seats: Seat[] } {
  const desks: Furniture[] = []
  const seats: Seat[] = []

  // Each desk unit is 2 tiles wide and takes 3 tiles vertically: desk top row
  // + seat row below. We lay out two columns of desks along the zone.
  const deskCount = agentCount
  const perCol = Math.ceil(deskCount / 2)
  const desksStartX = zone.x + 1
  const desksStartY = zone.y + 1
  const colGap = Math.max(2, Math.floor((zone.w - 4) / 2))

  let placed = 0
  for (let c = 0; c < 2 && placed < deskCount; c++) {
    for (let r = 0; r < perCol && placed < deskCount; r++) {
      const col = desksStartX + c * colGap
      const row = desksStartY + r * 3
      if (row + 1 >= zone.y + zone.h) break

      const deskUid = nextUid('desk')
      const desk: Furniture = {
        uid: deskUid,
        type: 'desk',
        col,
        row,
        w: 2,
        h: 1,
        color: team.color,
        facing: Dir.DOWN,
      }
      desks.push(desk)

      const seatUid = nextUid('seat')
      const seat: Seat = {
        uid: seatUid,
        col: col,
        row: row + 1,
        facing: Dir.UP,
        deskUid,
        teamId: team.id,
      }
      seats.push(seat)
      placed++
    }
  }

  // Add a plant in the zone corner if there's room
  if (zone.w >= 4 && zone.h >= 4) {
    desks.push({
      uid: nextUid('plant'),
      type: 'plant',
      col: zone.x + zone.w - 1,
      row: zone.y,
      w: 1,
      h: 1,
      color: team.color,
    })
  }

  return { desks, seats }
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
    breakTiles: [],
    ceoQueueTiles: [],
    ceoDesk: null,
    characters: new Map(),
    teamZones: new Map(),
  }

  // --- Floors ---
  // Outer wall border
  for (let c = 0; c < WORLD_COLS; c++) {
    setTile(world, c, 0, TileType.WALL)
    setTile(world, c, WORLD_ROWS - 1, TileType.WALL)
  }
  for (let r = 0; r < WORLD_ROWS; r++) {
    setTile(world, 0, r, TileType.WALL)
    setTile(world, WORLD_COLS - 1, r, TileType.WALL)
  }

  // CEO zone (top)
  const ceoY = 1
  const ceoH = CEO_ROWS
  fillRect(world, 1, ceoY, WORLD_COLS - 2, ceoH, TileType.CEO)

  // Break zone (bottom)
  const breakY = WORLD_ROWS - 1 - BREAK_ROWS
  fillRect(world, 1, breakY, WORLD_COLS - 2, BREAK_ROWS, TileType.BREAK)

  // Middle = team area
  const midY = ceoY + ceoH
  const midH = breakY - midY

  // --- Team zones ---
  const activeTeams = teams.filter((t) => agents.some((a) => a.team === t.id))
  const zones = computeTeamZones(activeTeams.length, midY, midH)

  activeTeams.forEach((team, i) => {
    const zone = zones[i]
    if (!zone) return
    world.teamZones.set(team.id, { ...zone, color: team.color })

    // Fill zone floor with team carpet
    for (let row = zone.y; row < zone.y + zone.h; row++) {
      for (let col = zone.x; col < zone.x + zone.w; col++) {
        const checker = (col + row) % 2 === 0 ? TileType.CARPET_A : TileType.CARPET_B
        setTile(world, col, row, checker, team.color)
      }
    }

    // Plain floor gap between zones (for walking lanes) — handled by leaving
    // non-zone tiles as VOID and filling them with FLOOR below.

    const teamAgents = agents.filter((a) => a.team === team.id)
    const { desks, seats } = placeDesksInZone(world, zone, team, teamAgents.length)
    world.furniture.push(...desks)
    world.seats.push(...seats)
  })

  // Fill any remaining VOID inside the main hall with FLOOR (walking lanes)
  for (let r = midY; r < midY + midH; r++) {
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

  // CEO queue path: horizontal line in front of CEO desk
  const queueRow = ceoY + ceoH - 1
  const queueStart = ceoDeskCol
  for (let i = 0; i < 8; i++) {
    world.ceoQueueTiles.push({ col: queueStart + i, row: queueRow })
  }

  // --- Break zone furniture ---
  // Sofas
  world.furniture.push({
    uid: nextUid('sofa'),
    type: 'sofa',
    col: 4,
    row: breakY + 1,
    w: 3,
    h: 1,
    facing: Dir.DOWN,
  })
  world.furniture.push({
    uid: nextUid('sofa'),
    type: 'sofa',
    col: WORLD_COLS - 7,
    row: breakY + 1,
    w: 3,
    h: 1,
    facing: Dir.DOWN,
  })

  // Vending machine
  world.furniture.push({
    uid: nextUid('vending'),
    type: 'vendingMachine',
    col: Math.floor(WORLD_COLS / 2) - 1,
    row: breakY + 1,
    w: 1,
    h: 1,
  })

  // Water cooler
  world.furniture.push({
    uid: nextUid('cooler'),
    type: 'cooler',
    col: Math.floor(WORLD_COLS / 2) + 1,
    row: breakY + 1,
    w: 1,
    h: 1,
  })

  // Plants in corners of break zone
  world.furniture.push({
    uid: nextUid('plant'),
    type: 'plant',
    col: 2,
    row: breakY + 2,
    w: 1,
    h: 1,
  })
  world.furniture.push({
    uid: nextUid('plant'),
    type: 'plant',
    col: WORLD_COLS - 3,
    row: breakY + 2,
    w: 1,
    h: 1,
  })

  // Break tiles available for wandering — pick walkable tiles in the break
  // zone that are not directly on top of furniture.
  const breakFurnitureBlocked = new Set<number>()
  for (const f of world.furniture) {
    if (f.row >= breakY) {
      for (let dy = 0; dy < f.h; dy++) {
        for (let dx = 0; dx < f.w; dx++) {
          breakFurnitureBlocked.add((f.row + dy) * WORLD_COLS + (f.col + dx))
        }
      }
    }
  }
  for (let r = breakY + 2; r < WORLD_ROWS - 1; r++) {
    for (let c = 2; c < WORLD_COLS - 2; c++) {
      const k = r * WORLD_COLS + c
      if (world.tiles[k] === TileType.BREAK && !breakFurnitureBlocked.has(k)) {
        world.breakTiles.push({ col: c, row: r })
      }
    }
  }

  // Also let the lower row in front of sofas be a valid wander target
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
  // group seats by teamId
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
