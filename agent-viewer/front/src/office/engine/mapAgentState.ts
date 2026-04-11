import type { LiveSession, LiveSubagent, Notification, Agent, Session, Team } from '@/types'
import type { StoreSnapshot, World } from '../types'
import { createCharacter, findSeatTile } from './world'

function normalizeName(s: string | undefined): string {
  return (s ?? '').toLowerCase().replace(/\s+/g, '').replace(/[—\-_.]+/g, '')
}

/** Build a StoreSnapshot from raw store data. */
export function buildSnapshot(params: {
  agents: Agent[]
  teams: Team[]
  sessions: Session[]
  liveSessions: LiveSession[]
  liveSubagents: LiveSubagent[]
  notifications: Notification[]
}): StoreSnapshot {
  const { agents, teams, sessions, liveSessions, liveSubagents, notifications } = params

  const waitingAgentIds = new Set<string>()
  const typingAgentIds = new Set<string>()

  // Match live sessions to static sessions by normalized name and propagate status
  // to the static session's agentIds.
  if (liveSessions.length > 0) {
    const staticByNorm = new Map<string, Session>()
    for (const s of sessions) {
      staticByNorm.set(normalizeName(s.name), s)
    }
    for (const live of liveSessions) {
      const norm = normalizeName(live.name)
      const match = staticByNorm.get(norm)
      const targets = match
        ? match.agentIds
        : // Fallback: fuzzy contains
          sessions.find((s) => {
            const sn = normalizeName(s.name)
            return norm.length > 3 && (sn.includes(norm) || norm.includes(sn))
          })?.agentIds
      if (!targets) continue

      if (live.status === 'waiting') {
        for (const id of targets) waitingAgentIds.add(id)
      } else if (live.status === 'active' || live.active) {
        for (const id of targets) typingAgentIds.add(id)
      }
    }
  }

  const queuedAgentIds = new Set<string>()
  for (const n of notifications) {
    if (n.actionRequired && !n.read) {
      queuedAgentIds.add(n.agentId)
    }
  }

  // Fall back to static agent.status — won't override live-derived state.
  for (const a of agents) {
    if (a.status === 'thinking' && !typingAgentIds.has(a.id) && !queuedAgentIds.has(a.id)) {
      waitingAgentIds.add(a.id)
    }
  }

  // Resolve sub-agent parent per sessionId by matching liveSession name to
  // static session agentIds (take the first agentId as the lead).
  const subagentParentByAgentId = new Map<string, string>()
  const leadByLiveSessionId = new Map<string, string>()
  if (liveSessions.length > 0) {
    const staticByNorm = new Map<string, Session>()
    for (const s of sessions) staticByNorm.set(normalizeName(s.name), s)
    for (const live of liveSessions) {
      const match = staticByNorm.get(normalizeName(live.name))
      const lead = match?.agentIds[0]
      if (lead) leadByLiveSessionId.set(live.sessionId, lead)
    }
  }
  for (const sub of liveSubagents) {
    if (!sub.active) continue
    const lead = leadByLiveSessionId.get(sub.sessionId)
    if (lead) subagentParentByAgentId.set(sub.agentId, lead)
  }

  return {
    agents: agents.map((a) => ({
      id: a.id,
      name: a.name,
      team: a.team,
      role: a.role,
      spriteType: a.spriteType,
      status: a.status,
    })),
    teams: teams.map((t) => ({ id: t.id, name: t.name, color: t.color })),
    liveSubagents: liveSubagents.map((s) => ({
      agentId: s.agentId,
      agentType: s.agentType,
      sessionId: s.sessionId,
      active: s.active,
    })),
    waitingAgentIds,
    queuedAgentIds,
    typingAgentIds,
    subagentParentByAgentId,
  }
}

const SUBAGENT_SPRITE_MAP: Record<string, string> = {
  implementer: 'warrior',
  tester: 'archer',
  Explore: 'archer',
  Plan: 'strategist',
  'general-purpose': 'warrior',
  'code-reviewer': 'sentinel',
  'spec-writer': 'mage',
  'spec-shaper': 'mage',
  'spec-initializer': 'scholar',
  'tasks-list-creator': 'strategist',
  verifier: 'sentinel',
  'scaffolding-agent': 'architect',
  'debug-agent': 'healer',
  'analyzer-agent': 'scholar',
}

export function syncWorldWithStore(world: World, snapshot: StoreSnapshot): void {
  // Ensure seats are assigned for new agents
  const agentsNeedingSeats = snapshot.agents.filter((a) => !world.characters.has(a.id))
  if (agentsNeedingSeats.length > 0) {
    // Build pool of unused seats by team (skip seats already claimed by live characters)
    const occupied = new Set<string>()
    for (const c of world.characters.values()) {
      if (c.seatId) occupied.add(c.seatId)
    }
    const poolByTeam = new Map<string, string[]>()
    for (const seat of world.seats) {
      if (occupied.has(seat.uid)) continue
      const arr = poolByTeam.get(seat.teamId) ?? []
      arr.push(seat.uid)
      poolByTeam.set(seat.teamId, arr)
    }
    const seatMap = new Map<string, string>()
    for (const a of agentsNeedingSeats) {
      const pool = poolByTeam.get(a.team)
      if (!pool || pool.length === 0) continue
      seatMap.set(a.id, pool.shift()!)
    }
    for (const a of agentsNeedingSeats) {
      const seatId = seatMap.get(a.id) ?? null
      const team = snapshot.teams.find((t) => t.id === a.team)
      const seatTile = findSeatTile(world, seatId) ?? { col: 2, row: 2 }
      world.characters.set(
        a.id,
        createCharacter({
          agentId: a.id,
          spriteType: a.spriteType,
          teamId: a.team,
          teamColor: team?.color ?? '#58a6ff',
          name: a.name,
          role: a.role,
          col: seatTile.col,
          row: seatTile.row,
          seatId,
        }),
      )
    }
  }

  // Remove characters whose agent is gone
  const liveAgentIds = new Set(snapshot.agents.map((a) => a.id))
  const liveSubIds = new Set(snapshot.liveSubagents.filter((s) => s.active).map((s) => s.agentId))
  for (const [id, char] of world.characters) {
    if (char.isSubagent) {
      if (!liveSubIds.has(id) && !char.despawning) {
        char.despawning = true
      }
      if (char.despawning && char.spawnTimer <= 0) {
        world.characters.delete(id)
      }
      continue
    }
    if (!liveAgentIds.has(id)) {
      world.characters.delete(id)
    }
  }

  // Set desiredState per agent
  for (const a of snapshot.agents) {
    const c = world.characters.get(a.id)
    if (!c) continue
    if (snapshot.queuedAgentIds.has(a.id)) {
      c.desiredState = 'queued'
    } else if (snapshot.waitingAgentIds.has(a.id)) {
      c.desiredState = 'waiting'
    } else if (snapshot.typingAgentIds.has(a.id) || a.status === 'working') {
      c.desiredState = 'type'
    } else {
      c.desiredState = 'idle'
    }
  }

  // Handle subagent spawns — resolve parent via sessionId mapping first;
  // fall back to any currently-typing agent; else a default position.
  for (const sub of snapshot.liveSubagents) {
    if (!sub.active) continue
    if (world.characters.has(sub.agentId)) continue

    const parentId = snapshot.subagentParentByAgentId.get(sub.agentId)
    const parentChar =
      (parentId ? world.characters.get(parentId) : undefined) ??
      [...world.characters.values()].find((c) => !c.isSubagent && c.desiredState === 'type')

    const col = parentChar ? Math.min(world.cols - 2, parentChar.tileCol + 1) : 2
    const row = parentChar ? parentChar.tileRow : 2

    world.characters.set(
      sub.agentId,
      createCharacter({
        agentId: sub.agentId,
        spriteType: SUBAGENT_SPRITE_MAP[sub.agentType] ?? 'warrior',
        teamId: parentChar?.teamId ?? 'subagents',
        teamColor: parentChar?.teamColor ?? '#a78bfa',
        name: sub.agentType,
        role: sub.agentType,
        col,
        row,
        seatId: null,
        isSubagent: true,
        parentAgentId: parentChar?.agentId ?? null,
      }),
    )
  }
}
