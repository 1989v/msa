import { useAppStore, getAgentsBySession, getUnassignedToSession } from '@/store/useAppStore'
import { SessionArea } from './SessionArea'
import { AgentNode } from '@/components/OfficeGrid/AgentNode'
import styles from './SessionGrid.module.css'

const STATUS_ORDER: Record<string, number> = {
  active: 0,
  paused: 1,
  completed: 2,
}

export function SessionGrid() {
  const sessions = useAppStore((s) => s.sessions)
  const agents = useAppStore((s) => s.agents)
  const tasks = useAppStore((s) => s.tasks)
  const sessionFilters = useAppStore((s) => s.sessionFilters)

  const filtered = sessions
    .filter((s) => sessionFilters.has(s.id))
    .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9))

  const unassigned = getUnassignedToSession(agents, sessions)

  return (
    <div className={styles.container}>
      <div className={styles.sessionCards}>
        {filtered.map((session) => (
          <SessionArea
            key={session.id}
            session={session}
            agents={getAgentsBySession(agents, session)}
            tasks={tasks}
          />
        ))}
      </div>

      {unassigned.length > 0 && (
        <div className={styles.lobby}>
          <div className={styles.lobbyHeader}>
            <span className={styles.lobbyIcon}>☕</span>
            <span className={styles.lobbyTitle}>대기실 (미배정)</span>
            <span className={styles.lobbyCount}>{unassigned.length}명</span>
          </div>
          <div className={styles.lobbyAgents}>
            {unassigned.map((agent) => (
              <AgentNode key={agent.id} agent={agent} showDesk teamColor="#30363d" />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
