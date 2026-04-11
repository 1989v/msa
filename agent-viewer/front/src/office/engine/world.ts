import type { Character, World } from '../types'
import { CharState, Dir } from '../types'
import { TILE_SIZE } from '../constants'
import { tileCenterPx } from '../layout/buildLayout'

export function setCharacterTile(c: Character, col: number, row: number): void {
  c.tileCol = col
  c.tileRow = row
  const p = tileCenterPx(col, row)
  c.x = p.x
  c.y = p.y
}

export function createCharacter(params: {
  agentId: string
  spriteType: string
  teamId: string
  teamColor: string
  name: string
  role: string
  col: number
  row: number
  seatId: string | null
  isSubagent?: boolean
  parentAgentId?: string | null
}): Character {
  const c: Character = {
    agentId: params.agentId,
    spriteType: params.spriteType,
    teamId: params.teamId,
    teamColor: params.teamColor,
    x: 0,
    y: 0,
    tileCol: params.col,
    tileRow: params.row,
    state: CharState.IDLE,
    desiredState: 'idle',
    dir: Dir.UP,
    path: [],
    moveProgress: 0,
    moveSpeed: 3.2,
    frame: 0,
    frameTimer: 0,
    wanderTimer: 5 + Math.random() * 10,
    wanderTarget: null,
    wanderDwellTimer: 0,
    seatId: params.seatId,
    bubble: null,
    isSubagent: params.isSubagent ?? false,
    parentAgentId: params.parentAgentId ?? null,
    spawnTimer: params.isSubagent ? 0 : 1,
    despawning: false,
    name: params.name,
    role: params.role,
  }
  setCharacterTile(c, params.col, params.row)
  return c
}

export function findSeatTile(world: World, seatId: string | null): { col: number; row: number } | null {
  if (!seatId) return null
  const seat = world.seats.find((s) => s.uid === seatId)
  if (!seat) return null
  return { col: seat.col, row: seat.row }
}

// Keep imports alive
void TILE_SIZE
