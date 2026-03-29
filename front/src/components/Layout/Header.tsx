import { useAppStore } from '@/store/useAppStore'
import { NotificationBell } from '@/components/Notification/NotificationBell'
import styles from './Header.module.css'

export function Header() {
  const agents = useAppStore((s) => s.agents)
  const tasks = useAppStore((s) => s.tasks)
  const refresh = useAppStore((s) => s.refresh)

  const activeTasks = tasks.filter((t) => t.status === 'in-progress').length
  const workingAgents = agents.filter((a) => a.status === 'working').length

  return (
    <header className={styles.header}>
      <h1 className={styles.title}>Agent Team Visualizer</h1>
      <div className={styles.stats}>
        <span className={styles.stat}>
          <span className={styles.statValue}>{agents.length}</span> Agents
        </span>
        <span className={styles.stat}>
          <span className={styles.statValue}>{workingAgents}</span> Working
        </span>
        <span className={styles.stat}>
          <span className={styles.statValue}>{activeTasks}</span> Active Tasks
        </span>
        <NotificationBell />
        <button className={styles.refreshBtn} onClick={refresh}>
          ↻ Refresh
        </button>
      </div>
    </header>
  )
}
