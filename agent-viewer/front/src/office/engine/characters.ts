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

/**
 * Advance character state by `dt` seconds. Uses `c.desiredState` that the
 * store sync sets externally.
 */
export function tickCharacter(c: Character, dt: number, world: World, taken: Set<string>): void {
  // Spawn effect
  if (c.spawnTimer < 1 && !c.despawning) {
    c.spawnTimer = Math.min(1, c.spawnTimer + dt / TIMINGS.spawnDuration)
  } else if (c.despawning) {
    c.spawnTimer = Math.max(0, c.spawnTimer - dt / TIMINGS.spawnDuration)
  }

  // Animation frame
  c.frameTimer += dt
  let frameInterval: number = TIMINGS.idleFrame
  if (c.state === CharState.TYPE) frameInterval = TIMINGS.typeFrame
  else if (c.state === CharState.WALK || c.state === CharState.WANDER) frameInterval = TIMINGS.walkFrame
  if (c.frameTimer >= frameInterval) {
    c.frameTimer = 0
    c.frame = (c.frame + 1) % 2
  }

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
    // Interpolate pixel position
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
      // Reached destination — resolve state
      resolveArrival(c, world, taken)
    }
    return
  }

  // Not walking — decide based on desiredState
  applyDesiredState(c, world, taken, dt)
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
      // idle — check if we're at seat or break tile
      const seat = findSeatTile(world, c.seatId)
      if (seat && c.tileCol === seat.col && c.tileRow === seat.row) {
        c.state = CharState.IDLE
        c.dir = Dir.UP
        c.wanderTimer = TIMINGS.wanderMinDelay + Math.random() * (TIMINGS.wanderMaxDelay - TIMINGS.wanderMinDelay)
      } else {
        c.state = CharState.WANDER
        c.wanderDwellTimer = TIMINGS.wanderDwellMin + Math.random() * (TIMINGS.wanderDwellMax - TIMINGS.wanderDwellMin)
      }
      break
    }
  }
  void taken
}

function applyDesiredState(c: Character, world: World, taken: Set<string>, dt: number): void {
  const seat = findSeatTile(world, c.seatId)

  // Always leave WAITING/QUEUED bubble off if state changed
  if (c.desiredState !== 'waiting' && c.desiredState !== 'queued') {
    c.bubble = null
  }

  if (c.desiredState === 'type') {
    if (seat && c.tileCol === seat.col && c.tileRow === seat.row) {
      c.state = CharState.TYPE
      c.dir = Dir.UP
      return
    }
    if (seat) {
      moveCharacterToward(c, world, seat)
    }
    return
  }

  if (c.desiredState === 'waiting') {
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
    const target = pickQueueTile(world, taken)
    if (target) {
      const key = `${target.col}:${target.row}`
      taken.add(key)
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

  // desiredState === 'idle'
  if (c.state === CharState.WAITING || c.state === CharState.QUEUED) {
    c.bubble = null
    c.state = CharState.IDLE
  }

  if (c.state === CharState.IDLE) {
    if (seat && (c.tileCol !== seat.col || c.tileRow !== seat.row)) {
      moveCharacterToward(c, world, seat)
      return
    }
    c.wanderTimer -= dt
    if (c.wanderTimer <= 0) {
      c.wanderTimer = TIMINGS.wanderMinDelay + Math.random() * (TIMINGS.wanderMaxDelay - TIMINGS.wanderMinDelay)
      if (Math.random() < TIMINGS.wanderChance) {
        const target = pickRandomBreakTile(world)
        if (target) {
          const path = findPath(world, { col: c.tileCol, row: c.tileRow }, target)
          if (path.length > 0) {
            c.path = path
            c.moveProgress = 0
            c.state = CharState.WANDER
            c.wanderTarget = target
          }
        }
      }
    }
    return
  }

  if (c.state === CharState.WANDER) {
    if (c.path.length === 0) {
      if (c.wanderDwellTimer > 0) {
        c.wanderDwellTimer -= dt
        return
      }
      // Pick next target — 50% chance to go back to seat
      if (Math.random() < 0.5 && seat) {
        moveCharacterToward(c, world, seat)
      } else {
        const target = pickRandomBreakTile(world)
        if (target) moveCharacterToward(c, world, target)
      }
    }
    return
  }

  // TYPE but desired idle → sit idle
  if (c.state === CharState.TYPE) {
    c.state = CharState.IDLE
    c.wanderTimer = TIMINGS.wanderMinDelay
  }
}
