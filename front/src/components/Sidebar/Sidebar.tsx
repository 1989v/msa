import { useAppStore } from '@/store/useAppStore'
import type { ViewMode } from '@/types'
import styles from './Sidebar.module.css'

const VIEW_MODES: { mode: ViewMode; label: string; key: string }[] = [
  { mode: 'session', label: 'Sessions', key: '1' },
  { mode: 'team', label: 'Org Chart', key: '2' },
  { mode: 'task', label: 'Tasks', key: '3' },
]

export function Sidebar() {
  const viewMode = useAppStore((s) => s.viewMode)
  const setViewMode = useAppStore((s) => s.setViewMode)
  const sessions = useAppStore((s) => s.sessions)
  const teams = useAppStore((s) => s.teams)
  const tasks = useAppStore((s) => s.tasks)
  const teamFilters = useAppStore((s) => s.teamFilters)
  const taskFilters = useAppStore((s) => s.taskFilters)
  const sessionFilters = useAppStore((s) => s.sessionFilters)
  const toggleTeamFilter = useAppStore((s) => s.toggleTeamFilter)
  const toggleTaskFilter = useAppStore((s) => s.toggleTaskFilter)
  const setAllTeamFilters = useAppStore((s) => s.setAllTeamFilters)
  const setAllTaskFilters = useAppStore((s) => s.setAllTaskFilters)

  const toggleSessionFilter = (id: string) => {
    useAppStore.setState((state) => {
      const next = new Set(state.sessionFilters)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return { sessionFilters: next }
    })
  }

  const statusIcon: Record<string, string> = {
    active: '🟢',
    paused: '🟡',
    completed: '⚪',
  }

  return (
    <div className={styles.sidebar}>
      {/* View mode toggle */}
      <div className={styles.viewToggle}>
        {VIEW_MODES.map(({ mode, label }) => (
          <button
            key={mode}
            className={`${styles.toggleBtn} ${viewMode === mode ? styles.active : ''}`}
            onClick={() => setViewMode(mode)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>
            {viewMode === 'session' ? 'Sessions' : viewMode === 'team' ? 'Teams' : 'Tasks'}
          </h3>
          {viewMode === 'team' && (
            <button
              className={styles.toggleAllBtn}
              onClick={() => setAllTeamFilters(teamFilters.size === 0)}
            >
              {teamFilters.size === 0 ? 'All' : 'None'}
            </button>
          )}
          {viewMode === 'task' && (
            <button
              className={styles.toggleAllBtn}
              onClick={() => setAllTaskFilters(taskFilters.size === 0)}
            >
              {taskFilters.size === 0 ? 'All' : 'None'}
            </button>
          )}
        </div>

        {viewMode === 'session' && sessions.map((session) => (
          <label key={session.id} className={styles.filterItem}>
            <input
              type="checkbox"
              checked={sessionFilters.has(session.id)}
              onChange={() => toggleSessionFilter(session.id)}
            />
            <span className={styles.sessionIcon}>{statusIcon[session.status]}</span>
            <span className={styles.filterLabel}>{session.name}</span>
            <span className={styles.filterCount}>{session.agentIds.length}</span>
          </label>
        ))}

        {viewMode === 'team' && teams.map((team) => (
          <label key={team.id} className={styles.filterItem}>
            <input
              type="checkbox"
              checked={teamFilters.has(team.id)}
              onChange={() => toggleTeamFilter(team.id)}
            />
            <span className={styles.colorDot} style={{ backgroundColor: team.color }} />
            <span className={styles.filterLabel}>{team.name}</span>
            <span className={styles.filterCount}>{team.agents.length}</span>
          </label>
        ))}

        {viewMode === 'task' && tasks.map((task) => (
          <label key={task.id} className={styles.filterItem}>
            <input
              type="checkbox"
              checked={taskFilters.has(task.id)}
              onChange={() => toggleTaskFilter(task.id)}
            />
            <span className={`${styles.statusDot} ${styles[task.status]}`} />
            <span className={styles.filterLabel}>{task.name}</span>
          </label>
        ))}
      </div>

      <div className={styles.shortcuts}>
        <h3 className={styles.sectionTitle}>Shortcuts</h3>
        {VIEW_MODES.map(({ key, label }) => (
          <div key={key} className={styles.shortcutItem}>
            <kbd>{key}</kbd> {label}
          </div>
        ))}
        <div className={styles.shortcutItem}>
          <kbd>Esc</kbd> Deselect
        </div>
      </div>
    </div>
  )
}
