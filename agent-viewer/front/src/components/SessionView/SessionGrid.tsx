import { useAppStore, getAgentsBySession, getUnassignedToSession } from '@/store/useAppStore'
import { SessionArea } from './SessionArea'
import { LiveSessionArea } from './LiveSessionArea'
import { AgentNode } from '@/components/OfficeGrid/AgentNode'
import styles from './SessionGrid.module.css'

export function SessionGrid() {
  const sessions = useAppStore((s) => s.sessions)
  const agents = useAppStore((s) => s.agents)
  const tasks = useAppStore((s) => s.tasks)
  const sessionFilters = useAppStore((s) => s.sessionFilters)
  const liveSessions = useAppStore((s) => s.liveSessions)
  const liveSubagents = useAppStore((s) => s.liveSubagents)
  const connectionStatus = useAppStore((s) => s.connectionStatus)
  const isConnected = connectionStatus === 'connected'

  const liveSessionList = Array.from(liveSessions.values())
    .sort((a, b) => (a.active === b.active ? 0 : a.active ? -1 : 1))

  // Static sessions only show when backend is not connected (demo/offline mode)
  const staticSessions = isConnected ? [] : sessions
    .filter((s) => sessionFilters.has(s.id))
    .sort((a, b) => {
      const order: Record<string, number> = { active: 0, paused: 1, completed: 2 }
      return (order[a.status] ?? 9) - (order[b.status] ?? 9)
    })

  const unassigned = isConnected ? [] : getUnassignedToSession(agents, sessions)

  const hasAnySessions = liveSessionList.length > 0 || staticSessions.length > 0

  return (
    <div className={styles.container}>
      {/* All sessions — unified list */}
      {hasAnySessions && (
        <div className={styles.sessionCards}>
          {/* Real sessions from backend */}
          {liveSessionList.map((session) => (
            <LiveSessionArea
              key={session.sessionId}
              session={session}
              subagents={session.subagentIds
                .map((id) => liveSubagents.get(id))
                .filter((s) => s != null)}
            />
          ))}

          {/* Fallback: demo sessions shown when backend offline */}
          {staticSessions.length > 0 && (
            <div className={styles.demoBanner}>
              <span className={styles.demoDot} />
              DEMO MODE — 백엔드 미연결 (샘플 데이터)
            </div>
          )}
          {staticSessions.map((session) => (
            <SessionArea
              key={session.id}
              session={session}
              agents={getAgentsBySession(agents, session)}
              tasks={tasks}
            />
          ))}
        </div>
      )}

      {!hasAnySessions && (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>🏢</span>
          <p>활성 세션 없음</p>
          <p className={styles.emptyHint}>Claude Code 세션을 시작하면 여기에 표시됩니다</p>
        </div>
      )}

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
