import { useAppStore, getAgentsByTeam } from '@/store/useAppStore'
import { TeamArea } from './TeamArea'
import { CeoRoom } from './CeoRoom'
import { TaskGrid } from '@/components/TaskView/TaskGrid'
import { SessionGrid } from '@/components/SessionView/SessionGrid'
import styles from './OfficeGrid.module.css'

export function OfficeGrid() {
  const viewMode = useAppStore((s) => s.viewMode)
  const teams = useAppStore((s) => s.teams)
  const agents = useAppStore((s) => s.agents)
  const teamFilters = useAppStore((s) => s.teamFilters)

  if (viewMode === 'session') {
    return (
      <div className={styles.grid}>
        <div className={styles.office}>
          <CeoRoom />
          <SessionGrid />
        </div>
      </div>
    )
  }

  if (viewMode === 'task') {
    return <TaskGrid />
  }

  // Team (org chart) view
  const filteredTeams = teams.filter((t) => teamFilters.has(t.id))
  return (
    <div className={styles.grid}>
      <div className={styles.office}>
        <CeoRoom />
        <div className={styles.gridInner}>
          {filteredTeams.map((team) => (
            <TeamArea
              key={team.id}
              team={team}
              agents={getAgentsByTeam(agents, team.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
