import { useAppStore } from '@/store/useAppStore'
import { NotificationBell } from '@/components/Notification/NotificationBell'
import styles from './Header.module.css'

const STATUS_LABEL: Record<string, string> = {
  connected: 'Live',
  connecting: 'Connecting...',
  disconnected: 'Offline',
}

export function Header() {
  const agents = useAppStore((s) => s.agents)
  const tasks = useAppStore((s) => s.tasks)
  const refresh = useAppStore((s) => s.refresh)
  const connectionStatus = useAppStore((s) => s.connectionStatus)
  const liveSubagents = useAppStore((s) => s.liveSubagents)

  const activeTasks = tasks.filter((t) => t.status === 'in-progress').length
  const workingAgents = agents.filter((a) => a.status === 'working').length
  const liveCount = Array.from(liveSubagents.values()).filter((s) => s.active).length

  return (
    <header className={styles.header}>
      <div className={styles.titleArea}>
        <h1 className={styles.title}>Agent Team Visualizer</h1>
        <span className={`${styles.connectionDot} ${styles[connectionStatus]}`} />
        <span className={styles.connectionLabel}>{STATUS_LABEL[connectionStatus]}</span>
      </div>
      <div className={styles.stats}>
        <span className={styles.stat}>
          <span className={styles.statValue}>{agents.length}</span> Agents
        </span>
        <span className={styles.stat}>
          <span className={styles.statValue}>{workingAgents}</span> Working
        </span>
        <span className={styles.stat}>
          <span className={styles.statValue}>{activeTasks}</span> Tasks
        </span>
        {liveCount > 0 && (
          <span className={styles.stat}>
            <span className={styles.liveValue}>{liveCount}</span> Live
          </span>
        )}
        <NotificationBell />
        <button className={styles.refreshBtn} onClick={refresh}>
          ↻ Refresh
        </button>
      </div>
    </header>
  )
}
