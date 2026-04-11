import { describe, it, expect } from 'vitest'
import { buildSnapshot, syncWorldWithStore } from './mapAgentState'
import { buildDefaultLayout } from '../layout/buildLayout'
import type { Agent, LiveSession, LiveSubagent, Notification, Session, Team } from '@/types'

function mkAgent(id: string, team: string, status: Agent['status'] = 'idle'): Agent {
  return {
    id,
    name: id.toUpperCase(),
    team,
    role: 'engineer',
    tools: [],
    status,
    spriteType: 'warrior',
    currentTaskIds: [],
  }
}

function mkTeam(id: string, color = '#58a6ff'): Team {
  return { id, name: id, color, agents: [], areaPosition: { x: 0, y: 0, w: 0, h: 0 } }
}

function mkSession(id: string, name: string, agentIds: string[]): Session {
  return {
    id,
    name,
    description: '',
    status: 'active',
    color: '#58a6ff',
    agentIds,
    taskIds: [],
    startedAt: 0,
  }
}

function mkLiveSession(sessionId: string, name: string, status?: string): LiveSession {
  return {
    sessionId,
    name,
    startedAt: '2026-04-11T00:00:00Z',
    active: status === 'active',
    status,
    subagentIds: [],
    taskIds: [],
  }
}

describe('buildSnapshot', () => {
  it('propagates liveSession waiting to matching static session agents', () => {
    const agents = [mkAgent('a1', 'alpha'), mkAgent('a2', 'alpha')]
    const sessions = [mkSession('s1', 'Feature X', ['a1', 'a2'])]
    const live = [mkLiveSession('live1', 'feature x', 'waiting')]

    const snap = buildSnapshot({
      agents,
      teams: [mkTeam('alpha')],
      sessions,
      liveSessions: live,
      liveSubagents: [],
      notifications: [],
    })

    expect(snap.waitingAgentIds.has('a1')).toBe(true)
    expect(snap.waitingAgentIds.has('a2')).toBe(true)
  })

  it('routes notification actionRequired to queuedAgentIds', () => {
    const agents = [mkAgent('a1', 'alpha')]
    const n: Notification = {
      id: 'n1',
      agentId: 'a1',
      type: 'approval',
      title: 't',
      message: 'm',
      timestamp: 0,
      read: false,
      actionRequired: true,
    }
    const snap = buildSnapshot({
      agents,
      teams: [mkTeam('alpha')],
      sessions: [],
      liveSessions: [],
      liveSubagents: [],
      notifications: [n],
    })
    expect(snap.queuedAgentIds.has('a1')).toBe(true)
  })

  it('maps subagent parent via sessionId and static session lead', () => {
    const sessions = [mkSession('s1', 'Build Feature', ['a1', 'a2'])]
    const live = [mkLiveSession('live-session-1', 'build feature', 'active')]
    const sub: LiveSubagent = {
      agentId: 'sub1',
      agentType: 'implementer',
      sessionId: 'live-session-1',
      active: true,
    }
    const snap = buildSnapshot({
      agents: [mkAgent('a1', 'alpha'), mkAgent('a2', 'alpha')],
      teams: [mkTeam('alpha')],
      sessions,
      liveSessions: live,
      liveSubagents: [sub],
      notifications: [],
    })
    expect(snap.subagentParentByAgentId.get('sub1')).toBe('a1')
  })
})

describe('syncWorldWithStore', () => {
  it('creates characters for agents on first sync', () => {
    const agents = [mkAgent('a1', 'alpha'), mkAgent('b1', 'beta')]
    const teams = [mkTeam('alpha'), mkTeam('beta')]
    const world = buildDefaultLayout(teams, agents)
    const snap = buildSnapshot({
      agents,
      teams,
      sessions: [],
      liveSessions: [],
      liveSubagents: [],
      notifications: [],
    })
    syncWorldWithStore(world, snap)
    expect(world.characters.size).toBe(2)
    expect(world.characters.get('a1')?.seatId).toBeTruthy()
    expect(world.characters.get('b1')?.seatId).toBeTruthy()
  })

  it('applies working status as desiredState=type', () => {
    const agents = [mkAgent('a1', 'alpha', 'working')]
    const teams = [mkTeam('alpha')]
    const world = buildDefaultLayout(teams, agents)
    const snap = buildSnapshot({
      agents,
      teams,
      sessions: [],
      liveSessions: [],
      liveSubagents: [],
      notifications: [],
    })
    syncWorldWithStore(world, snap)
    expect(world.characters.get('a1')?.desiredState).toBe('type')
  })

  it('removes characters whose agent is gone', () => {
    const teams = [mkTeam('alpha')]
    const world = buildDefaultLayout(teams, [mkAgent('a1', 'alpha')])
    syncWorldWithStore(
      world,
      buildSnapshot({
        agents: [mkAgent('a1', 'alpha')],
        teams,
        sessions: [],
        liveSessions: [],
        liveSubagents: [],
        notifications: [],
      }),
    )
    expect(world.characters.has('a1')).toBe(true)
    syncWorldWithStore(
      world,
      buildSnapshot({
        agents: [],
        teams,
        sessions: [],
        liveSessions: [],
        liveSubagents: [],
        notifications: [],
      }),
    )
    expect(world.characters.has('a1')).toBe(false)
  })
})
