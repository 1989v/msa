import { useAppStore } from '@/store/useAppStore'
import type { ViewMode } from '@/types'
import styles from './Sidebar.module.css'

const VIEW_MODES: { mode: ViewMode; label: string; key: string }[] = [
  { mode: 'session', label: 'Sessions', key: '1' },
  { mode: 'team', label: 'Org Chart', key: '2' },
  { mode: 'task', label: 'Tasks', key: '3' },
  { mode: 'office', label: 'Office', key: '4' },
]

export function Sidebar() {
  const viewMode = useAppStore((s) => s.viewMode)
  const setViewMode = useAppStore((s) => s.setViewMode)
  const teams = useAppStore((s) => s.teams)
  const tasks = useAppStore((s) => s.tasks)
  const teamFilters = useAppStore((s) => s.teamFilters)
  const taskFilters = useAppStore((s) => s.taskFilters)
  const toggleTeamFilter = useAppStore((s) => s.toggleTeamFilter)
  const toggleTaskFilter = useAppStore((s) => s.toggleTaskFilter)
  const setAllTeamFilters = useAppStore((s) => s.setAllTeamFilters)
  const setAllTaskFilters = useAppStore((s) => s.setAllTaskFilters)
  const connectionStatus = useAppStore((s) => s.connectionStatus)
  const liveSessions = useAppStore((s) => s.liveSessions)
  const liveSubagents = useAppStore((s) => s.liveSubagents)

  const isConnected = connectionStatus === 'connected'

  const liveSessionList = Array.from(liveSessions.values())
    .sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1
      return 0
    })

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
            {viewMode === 'session'
              ? 'Sessions'
              : viewMode === 'team'
                ? 'Teams'
                : viewMode === 'office'
                  ? 'Office'
                  : 'Tasks'}
          </h3>
          {(viewMode === 'team' || viewMode === 'office') && (
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

        {/* Session list — live sessions when connected, static when offline */}
        {viewMode === 'session' && (
          <>
            {liveSessionList.map((session) => {
              const subCount = session.subagentIds.length
              const activeCount = session.subagentIds
                .map((id) => liveSubagents.get(id))
                .filter((s) => s?.active).length
              return (
                <div key={session.sessionId} className={styles.filterItem}>
                  {session.toolColor ? (
                    <span className={styles.colorDot} style={{ backgroundColor: session.toolColor }} />
                  ) : (
                    <span className={styles.sessionIcon}>{session.active ? '🟢' : '⚪'}</span>
                  )}
                  <span className={styles.filterLabel}>
                    {session.name ?? session.sessionId.slice(0, 12)}
                  </span>
                  {subCount > 0 && (
                    <span className={styles.filterCount}>{activeCount}/{subCount}</span>
                  )}
                </div>
              )
            })}

            {liveSessionList.length === 0 && (
              <div className={styles.emptyFilter}>
                {isConnected ? '세션 감지 대기 중...' : '백엔드 미연결'}
              </div>
            )}
          </>
        )}

        {(viewMode === 'team' || viewMode === 'office') && teams.map((team) => (
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
