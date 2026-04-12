import { describe, it, expect } from 'vitest'
import { buildDefaultLayout } from './buildLayout'
import type { Agent, Team } from '@/types'

function makeTeams(): Team[] {
  return [
    { id: 'alpha', name: 'Alpha', color: '#58a6ff', agents: [], areaPosition: { x: 0, y: 0, w: 0, h: 0 } },
    { id: 'beta', name: 'Beta', color: '#3fb950', agents: [], areaPosition: { x: 0, y: 0, w: 0, h: 0 } },
    { id: 'gamma', name: 'Gamma', color: '#f85149', agents: [], areaPosition: { x: 0, y: 0, w: 0, h: 0 } },
  ]
}

function makeAgents(): Agent[] {
  const base: Omit<Agent, 'id' | 'team' | 'name'> = {
    role: 'engineer',
    tools: [],
    status: 'idle',
    spriteType: 'warrior',
    currentTaskIds: [],
  }
  return [
    { id: 'a1', team: 'alpha', name: 'A1', ...base },
    { id: 'a2', team: 'alpha', name: 'A2', ...base },
    { id: 'b1', team: 'beta', name: 'B1', ...base },
    { id: 'g1', team: 'gamma', name: 'G1', ...base },
    { id: 'g2', team: 'gamma', name: 'G2', ...base },
    { id: 'g3', team: 'gamma', name: 'G3', ...base },
  ]
}

describe('buildDefaultLayout', () => {
  it('creates a world with enough seats for all agents', () => {
    const teams = makeTeams()
    const agents = makeAgents()
    const world = buildDefaultLayout(teams, agents)
    expect(world.seats.length).toBeGreaterThanOrEqual(agents.length)
  })

  it('assigns team-specific seats', () => {
    const teams = makeTeams()
    const agents = makeAgents()
    const world = buildDefaultLayout(teams, agents)
    const perTeam = new Map<string, number>()
    for (const seat of world.seats) {
      perTeam.set(seat.teamId, (perTeam.get(seat.teamId) ?? 0) + 1)
    }
    expect(perTeam.get('alpha')).toBeGreaterThanOrEqual(2)
    expect(perTeam.get('beta')).toBeGreaterThanOrEqual(1)
    expect(perTeam.get('gamma')).toBeGreaterThanOrEqual(3)
  })

  it('places CEO desk and break zone', () => {
    const world = buildDefaultLayout(makeTeams(), makeAgents())
    expect(world.ceoDesk).not.toBeNull()
    expect(world.ceoQueueTiles.length).toBeGreaterThan(0)
    expect(world.breakTiles.length).toBeGreaterThan(0)
  })

  it('leaves the main hall walkable', () => {
    const world = buildDefaultLayout(makeTeams(), makeAgents())
    // Pick the center tile — should not be VOID
    const mid = Math.floor(world.rows / 2) * world.cols + Math.floor(world.cols / 2)
    expect(world.tiles[mid]).not.toBe(0) // TileType.VOID === 0
  })

  it('has break tiles for agent wandering', () => {
    const world = buildDefaultLayout(makeTeams(), makeAgents())
    expect(world.breakTiles.length).toBeGreaterThan(10)
    for (const t of world.breakTiles) {
      expect(t.col).toBeGreaterThan(0)
      expect(t.col).toBeLessThan(world.cols - 1)
    }
  })

  it('paints every team zone tile as carpet (open floor plan)', () => {
    const world = buildDefaultLayout(makeTeams(), makeAgents())
    for (const zone of world.teamZones.values()) {
      for (let row = zone.y; row < zone.y + zone.h; row++) {
        for (let col = zone.x; col < zone.x + zone.w; col++) {
          const t = world.tiles[row * world.cols + col]
          // CARPET_A = 2, CARPET_B = 3
          expect(t === 2 || t === 3).toBe(true)
        }
      }
    }
  })
})
