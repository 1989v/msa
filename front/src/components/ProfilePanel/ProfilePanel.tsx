import { useAppStore, getSelectedAgent, getTeamById } from '@/store/useAppStore'
import { PixelSprite } from '@/components/Sprite/PixelSprite'
import styles from './ProfilePanel.module.css'

export function ProfilePanel() {
  const agents = useAppStore((s) => s.agents)
  const teams = useAppStore((s) => s.teams)
  const tasks = useAppStore((s) => s.tasks)
  const selectedAgentId = useAppStore((s) => s.selectedAgentId)

  const agent = getSelectedAgent(agents, selectedAgentId)

  if (!agent) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>👤</div>
        <p>Select an agent to view profile</p>
      </div>
    )
  }

  const team = getTeamById(teams, agent.team)
  const agentTasks = tasks.filter((t) => agent.currentTaskIds.includes(t.id))

  return (
    <div className={styles.profile}>
      <div className={styles.spritePreview}>
        <PixelSprite type={agent.spriteType} status={agent.status} size={96} />
      </div>

      <h2 className={styles.name}>{agent.name}</h2>

      <div className={styles.field}>
        <span className={styles.label}>Team</span>
        <span className={styles.teamBadge} style={{ borderColor: team?.color, color: team?.color }}>
          {team?.name}
        </span>
      </div>

      <div className={styles.field}>
        <span className={styles.label}>Role</span>
        <span className={styles.value}>{agent.role}</span>
      </div>

      <div className={styles.field}>
        <span className={styles.label}>Status</span>
        <span className={`${styles.statusBadge} ${styles[agent.status]}`}>
          {agent.status}
        </span>
      </div>

      <div className={styles.field}>
        <span className={styles.label}>Tools</span>
        <div className={styles.tags}>
          {agent.tools.map((tool) => (
            <span key={tool} className={styles.tag}>{tool}</span>
          ))}
        </div>
      </div>

      {agentTasks.length > 0 && (
        <div className={styles.field}>
          <span className={styles.label}>Tasks</span>
          <div className={styles.taskList}>
            {agentTasks.map((task) => (
              <div key={task.id} className={styles.taskItem}>
                <span className={`${styles.taskDot} ${styles[task.status]}`} />
                {task.name}
                {task.progress != null && (
                  <span className={styles.progress}>{task.progress}%</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
