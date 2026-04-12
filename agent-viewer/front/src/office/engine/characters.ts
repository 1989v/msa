import type { Character, World } from '../types'
import { CharState, Dir } from '../types'
import { TIMINGS, TILE_SIZE } from '../constants'
import { findPath } from './pathfinding'
import { findSeatTile } from './world'

function directionBetween(
  from: { col: number; row: number },
  to: { col: number; row: number },
): Character['dir'] {
  if (to.col > from.col) return Dir.RIGHT
  if (to.col < from.col) return Dir.LEFT
  if (to.row > from.row) return Dir.DOWN
  return Dir.UP
}

function pickRandomBreakTile(world: World): { col: number; row: number } | null {
  if (world.breakTiles.length === 0) return null
  return world.breakTiles[Math.floor(Math.random() * world.breakTiles.length)]
}

function pickQueueTile(world: World, taken: Set<string>): { col: number; row: number } | null {
  for (const t of world.ceoQueueTiles) {
    const key = `${t.col}:${t.row}`
    if (!taken.has(key)) return t
  }
  return null
}

/**
 * Find a free lounge spot for the character. A spot is "free" if no other
 * character has claimed it. Reserves greedily — caller uses the return value
 * immediately.
 */
function findFreeLoungeSpot(
  c: Character,
  world: World,
  claimed: Set<string>,
): { uid: string; col: number; row: number; facing: number } | null {
  // Already claimed by this character?
  if (c.loungeSpotId) {
    const own = world.loungeSpots.find((s) => s.uid === c.loungeSpotId)
    if (own) return { uid: own.uid, col: own.col, row: own.row, facing: own.facing }
  }
  // Pick first free spot — could randomize, but deterministic is easier
  for (const spot of world.loungeSpots) {
    if (claimed.has(spot.uid)) continue
    return { uid: spot.uid, col: spot.col, row: spot.row, facing: spot.facing }
  }
  return null
}

export function moveCharacterToward(
  c: Character,
  world: World,
  target: { col: number; row: number },
): boolean {
  if (c.tileCol === target.col && c.tileRow === target.row) {
    c.path = []
    return true
  }
  const path = findPath(world, { col: c.tileCol, row: c.tileRow }, target)
  if (path.length === 0) return false
  c.path = path
  c.moveProgress = 0
  c.state = CharState.WALK
  return true
}

export function tickCharacter(
  c: Character,
  dt: number,
  world: World,
  queueTaken: Set<string>,
  loungeClaimed: Set<string>,
): void {
  // Spawn effect
  if (c.spawnTimer < 1 && !c.despawning) {
    c.spawnTimer = Math.min(1, c.spawnTimer + dt / TIMINGS.spawnDuration)
  } else if (c.despawning) {
    c.spawnTimer = Math.max(0, c.spawnTimer - dt / TIMINGS.spawnDuration)
  }

  // Animation frame (supports 4-frame walk)
  c.frameTimer += dt
  let frameInterval: number = TIMINGS.idleFrame
  let frameCount = 2
  if (c.state === CharState.TYPE) {
    frameInterval = TIMINGS.typeFrame
  } else if (c.state === CharState.WALK || c.state === CharState.WANDER) {
    frameInterval = TIMINGS.walkFrame
    frameCount = 4
  } else if (c.state === CharState.REST) {
    frameInterval = TIMINGS.idleFrame * 1.4
  }
  if (c.frameTimer >= frameInterval) {
    c.frameTimer = 0
    c.frame = (c.frame + 1) % frameCount
  }

  // Dwell timer (used by WANDER state to pause before picking next tile)
  if (c.wanderDwellTimer > 0) c.wanderDwellTimer -= dt

  // Track claimed lounge spot across tick
  if (c.loungeSpotId) loungeClaimed.add(c.loungeSpotId)

  // Walking along path
  if ((c.state === CharState.WALK || c.state === CharState.WANDER) && c.path.length > 0) {
    c.moveProgress += c.moveSpeed * dt
    while (c.moveProgress >= 1 && c.path.length > 0) {
      const next = c.path.shift()!
      c.dir = directionBetween({ col: c.tileCol, row: c.tileRow }, next)
      c.tileCol = next.col
      c.tileRow = next.row
      c.moveProgress -= 1
    }
    const cx = c.tileCol * TILE_SIZE + TILE_SIZE / 2
    const cy = c.tileRow * TILE_SIZE + TILE_SIZE / 2
    if (c.path.length > 0) {
      const next = c.path[0]
      const nx = next.col * TILE_SIZE + TILE_SIZE / 2
      const ny = next.row * TILE_SIZE + TILE_SIZE / 2
      c.x = cx + (nx - cx) * c.moveProgress
      c.y = cy + (ny - cy) * c.moveProgress
      c.dir = directionBetween({ col: c.tileCol, row: c.tileRow }, next)
    } else {
      c.x = cx
      c.y = cy
      c.moveProgress = 0
      resolveArrival(c, world, queueTaken)
    }
    return
  }

  applyDesiredState(c, world, queueTaken, loungeClaimed)
}

function resolveArrival(c: Character, world: World, taken: Set<string>): void {
  switch (c.desiredState) {
    case 'type': {
      const seat = findSeatTile(world, c.seatId)
      if (seat && c.tileCol === seat.col && c.tileRow === seat.row) {
        c.state = CharState.TYPE
        c.dir = Dir.UP
      } else {
        c.state = CharState.IDLE
      }
      break
    }
    case 'waiting': {
      c.state = CharState.WAITING
      c.bubble = 'waiting'
      c.dir = Dir.UP
      break
    }
    case 'queued': {
      c.state = CharState.QUEUED
      c.bubble = 'permission'
      c.dir = Dir.UP
      break
    }
    default: {
      // idle — did we arrive at a lounge spot?
      if (c.loungeSpotId) {
        const spot = world.loungeSpots.find((s) => s.uid === c.loungeSpotId)
        if (spot && c.tileCol === spot.col && c.tileRow === spot.row) {
          c.state = CharState.REST
          c.dir = spot.facing as Character['dir']
          break
        }
      }
      // Arrived at a break tile → dwell before wandering again
      c.state = CharState.WANDER
      c.wanderDwellTimer = TIMINGS.wanderDwellMin + Math.random() * (TIMINGS.wanderDwellMax - TIMINGS.wanderDwellMin)
      break
    }
  }
  void taken
}

function releaseLoungeSpot(c: Character, loungeClaimed: Set<string>): void {
  if (c.loungeSpotId) {
    loungeClaimed.delete(c.loungeSpotId)
    c.loungeSpotId = null
  }
}

function applyDesiredState(
  c: Character,
  world: World,
  queueTaken: Set<string>,
  loungeClaimed: Set<string>,
): void {
  const seat = findSeatTile(world, c.seatId)

  if (c.desiredState !== 'waiting' && c.desiredState !== 'queued') {
    c.bubble = null
  }

  if (c.desiredState === 'type') {
    releaseLoungeSpot(c, loungeClaimed)
    if (seat && c.tileCol === seat.col && c.tileRow === seat.row) {
      c.state = CharState.TYPE
      c.dir = Dir.UP
      return
    }
    if (seat) moveCharacterToward(c, world, seat)
    return
  }

  if (c.desiredState === 'waiting') {
    releaseLoungeSpot(c, loungeClaimed)
    if (seat && (c.tileCol !== seat.col || c.tileRow !== seat.row)) {
      moveCharacterToward(c, world, seat)
    } else {
      c.state = CharState.WAITING
      c.bubble = 'waiting'
      c.dir = Dir.UP
    }
    return
  }

  if (c.desiredState === 'queued') {
    releaseLoungeSpot(c, loungeClaimed)
    const target = pickQueueTile(world, queueTaken)
    if (target) {
      queueTaken.add(`${target.col}:${target.row}`)
      if (c.tileCol !== target.col || c.tileRow !== target.row) {
        moveCharacterToward(c, world, target)
      } else {
        c.state = CharState.QUEUED
        c.bubble = 'permission'
        c.dir = Dir.DOWN
      }
    }
    return
  }

  // desiredState === 'idle' → rest at lounge spot if available, else wander in break zone
  if (c.state === CharState.REST) return

  // Try lounge spot first (if any exist)
  if (world.loungeSpots.length > 0) {
    if (!c.loungeSpotId) {
      const free = findFreeLoungeSpot(c, world, loungeClaimed)
      if (free) {
        c.loungeSpotId = free.uid
        loungeClaimed.add(free.uid)
      }
    }
    if (c.loungeSpotId) {
      const spot = world.loungeSpots.find((s) => s.uid === c.loungeSpotId)
      if (spot) {
        if (c.tileCol === spot.col && c.tileRow === spot.row) {
          c.state = CharState.REST
          c.dir = spot.facing as Character['dir']
        } else {
          moveCharacterToward(c, world, spot)
        }
        return
      }
    }
  }

  // Wander in break zone (never return to desk while idle)
  if (c.state === CharState.WANDER && c.path.length === 0) {
    if (c.wanderDwellTimer > 0) return // dwell timer decremented in tick via frameTimer
    const target = pickRandomBreakTile(world)
    if (target) moveCharacterToward(c, world, target)
    return
  }

  if (c.state !== CharState.WANDER) {
    const target = pickRandomBreakTile(world)
    if (target) {
      c.path = findPath(world, { col: c.tileCol, row: c.tileRow }, target)
      if (c.path.length > 0) {
        c.moveProgress = 0
        c.state = CharState.WANDER
        return
      }
    }
  }
}
