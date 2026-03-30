import { useAppStore } from '@/store/useAppStore'
import { LiveSessionArea } from './LiveSessionArea'
import styles from './SessionGrid.module.css'

export function SessionGrid() {
  const liveSessions = useAppStore((s) => s.liveSessions)
  const liveSubagents = useAppStore((s) => s.liveSubagents)
  const connectionStatus = useAppStore((s) => s.connectionStatus)

  const liveSessionList = Array.from(liveSessions.values())
    .sort((a, b) => {
      // active first, then by time
      if (a.active !== b.active) return a.active ? -1 : 1
      return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    })

  return (
    <div className={styles.container}>
      {liveSessionList.length > 0 && (
        <div className={styles.sessionCards}>
          {liveSessionList.map((session) => (
            <LiveSessionArea
              key={session.sessionId}
              session={session}
              subagents={session.subagentIds
                .map((id) => liveSubagents.get(id))
                .filter((s) => s != null)}
            />
          ))}
        </div>
      )}

      {liveSessionList.length === 0 && (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>🏢</span>
          {connectionStatus === 'connected' ? (
            <>
              <p>활성 세션 없음</p>
              <p className={styles.emptyHint}>AI 코딩 도구를 시작하면 자동으로 감지됩니다</p>
            </>
          ) : connectionStatus === 'connecting' ? (
            <>
              <p>백엔드 연결 중...</p>
              <p className={styles.emptyHint}>agent-viewer 백엔드가 실행 중인지 확인하세요</p>
            </>
          ) : (
            <>
              <p>백엔드 미연결</p>
              <p className={styles.emptyHint}>
                ./gradlew :agent-viewer:api:bootRun 으로 백엔드를 시작하세요
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
