import type { Task, Agent } from '@/types'
import { AgentNode } from '@/components/OfficeGrid/AgentNode'
import styles from './TaskCard.module.css'

interface Props {
  task: Task
  agents: Agent[]
}

const MAX_VISIBLE = 6

export function TaskCard({ task, agents }: Props) {
  const visible = agents.slice(0, MAX_VISIBLE)
  const overflow = agents.length - MAX_VISIBLE

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={`${styles.statusDot} ${styles[task.status]}`} />
        <h3 className={styles.title}>{task.name}</h3>
      </div>

      {task.description && (
        <p className={styles.description}>{task.description}</p>
      )}

      {task.progress != null && (
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${task.progress}%` }}
          />
          <span className={styles.progressText}>{task.progress}%</span>
        </div>
      )}

      <div className={styles.agents}>
        {visible.map((agent) => (
          <AgentNode key={agent.id} agent={agent} compact />
        ))}
        {overflow > 0 && (
          <span className={styles.overflow}>+{overflow}</span>
        )}
      </div>
    </div>
  )
}
