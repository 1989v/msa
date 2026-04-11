export type Direction = 0 | 1 | 2 | 3 // DOWN, LEFT, RIGHT, UP

export const Dir = {
  DOWN: 0,
  LEFT: 1,
  RIGHT: 2,
  UP: 3,
} as const

export const TileType = {
  VOID: 0,
  FLOOR: 1,
  CARPET_A: 2,
  CARPET_B: 3,
  WALL: 4,
  BREAK: 5,
  CEO: 6,
} as const
export type TileType = (typeof TileType)[keyof typeof TileType]

export interface TileCell {
  type: TileType
  teamTint?: string // team color for carpet overlay
}

export interface Seat {
  uid: string
  col: number
  row: number
  facing: Direction
  deskUid: string
  teamId: string
}

export type FurnitureType =
  | 'desk'
  | 'sofa'
  | 'sofaH' // horizontal (side-facing) sofa
  | 'plant'
  | 'whiteboard'
  | 'vendingMachine'
  | 'ceoDesk'
  | 'cooler'
  | 'coffeeTable'
  | 'loungeChair'
  | 'bookshelf'
  | 'coffeeMachine'
  | 'pingPong'

export interface Furniture {
  uid: string
  type: FurnitureType
  col: number
  row: number
  w: number
  h: number
  color?: string
  facing?: Direction
}

export const CharState = {
  IDLE: 'idle',
  TYPE: 'type',
  READ: 'read',
  WALK: 'walk',
  WANDER: 'wander',
  REST: 'rest',
  WAITING: 'waiting',
  QUEUED: 'queued',
} as const
export type CharState = (typeof CharState)[keyof typeof CharState]

export type DesiredState = 'idle' | 'type' | 'waiting' | 'queued'

export interface LoungeSpot {
  uid: string
  col: number
  row: number
  facing: Direction
  /** Type of seating — affects rest pose */
  kind: 'sofa' | 'chair'
}

export interface Character {
  agentId: string
  spriteType: string
  teamId: string
  teamColor: string

  // position (logical pixel, NOT render scale)
  x: number
  y: number
  tileCol: number
  tileRow: number

  // movement
  state: CharState
  desiredState: DesiredState
  dir: Direction
  path: Array<{ col: number; row: number }>
  moveProgress: number
  moveSpeed: number

  // animation
  frame: number
  frameTimer: number
  wanderTimer: number
  wanderTarget: { col: number; row: number } | null
  wanderDwellTimer: number

  // assignment
  seatId: string | null
  loungeSpotId: string | null

  // visual overlays
  bubble: 'waiting' | 'permission' | null
  isSubagent: boolean
  parentAgentId: string | null
  spawnTimer: number // counts up from 0 to spawnDuration
  despawning: boolean

  // metadata
  name: string
  role: string
}

export interface World {
  cols: number
  rows: number
  tiles: TileType[]
  tileTint: Array<string | null>
  furniture: Furniture[]
  seats: Seat[]
  loungeSpots: LoungeSpot[]
  breakTiles: Array<{ col: number; row: number }>
  ceoQueueTiles: Array<{ col: number; row: number }>
  ceoDesk: { col: number; row: number } | null
  characters: Map<string, Character>
  teamZones: Map<string, { x: number; y: number; w: number; h: number; color: string }>
  /** UTC seconds since world creation — rendered by animated furniture */
  time: number
}

export interface StoreSnapshot {
  agents: Array<{
    id: string
    name: string
    team: string
    role: string
    spriteType: string
    status: string
  }>
  teams: Array<{ id: string; name: string; color: string }>
  liveSubagents: Array<{
    agentId: string
    agentType: string
    sessionId: string
    active: boolean
  }>
  waitingAgentIds: Set<string>
  queuedAgentIds: Set<string>
  typingAgentIds: Set<string>
  subagentParentByAgentId: Map<string, string>
}
