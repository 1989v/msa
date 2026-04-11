import { describe, it, expect } from 'vitest'
import { findPath } from './pathfinding'
import { TileType, type World } from '../types'

function makeWorld(cols: number, rows: number): World {
  return {
    cols,
    rows,
    tiles: new Array(cols * rows).fill(TileType.FLOOR),
    tileTint: new Array(cols * rows).fill(null),
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
}

describe('findPath', () => {
  it('returns empty array when from === to', () => {
    const world = makeWorld(5, 5)
    expect(findPath(world, { col: 2, row: 2 }, { col: 2, row: 2 })).toEqual([])
  })

  it('finds straight horizontal path', () => {
    const world = makeWorld(5, 1)
    const path = findPath(world, { col: 0, row: 0 }, { col: 4, row: 0 })
    expect(path.length).toBe(4)
    expect(path[path.length - 1]).toEqual({ col: 4, row: 0 })
  })

  it('routes around walls', () => {
    const world = makeWorld(5, 5)
    // Vertical wall at col=2, row=0..3 (leaving row 4 open)
    for (let r = 0; r < 4; r++) {
      world.tiles[r * 5 + 2] = TileType.WALL
    }
    const path = findPath(world, { col: 0, row: 0 }, { col: 4, row: 0 })
    expect(path.length).toBeGreaterThan(4) // must detour
    expect(path[path.length - 1]).toEqual({ col: 4, row: 0 })
  })

  it('returns empty when unreachable', () => {
    const world = makeWorld(5, 5)
    // Surround target with walls
    const t = { col: 4, row: 4 }
    world.tiles[(t.row - 1) * 5 + t.col] = TileType.WALL
    world.tiles[t.row * 5 + (t.col - 1)] = TileType.WALL
    const path = findPath(world, { col: 0, row: 0 }, t)
    expect(path).toEqual([])
  })

  it('treats desk furniture as obstacle', () => {
    const world = makeWorld(5, 3)
    world.furniture.push({
      uid: 'd1',
      type: 'desk',
      col: 2,
      row: 0,
      w: 1,
      h: 2,
    })
    const path = findPath(world, { col: 0, row: 0 }, { col: 4, row: 0 })
    // Must route through row 2 to avoid desk blocking col 2 in rows 0-1
    const passesThroughDesk = path.some((p) => p.col === 2 && p.row < 2)
    expect(passesThroughDesk).toBe(false)
  })
})
