import { useAppStore, getAgentsByTask, getUnassignedAgents } from '@/store/useAppStore'
import { TaskCard } from './TaskCard'
import { AgentNode } from '@/components/OfficeGrid/AgentNode'
import styles from './TaskGrid.module.css'

const STATUS_ORDER: Record<string, number> = {
  'in-progress': 0,
  'pending': 1,
  'completed': 2,
}

export function TaskGrid() {
  const tasks = useAppStore((s) => s.tasks)
  const agents = useAppStore((s) => s.agents)
  const taskFilters = useAppStore((s) => s.taskFilters)

  const filteredTasks = tasks
    .filter((t) => taskFilters.has(t.id))
    .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9))

  const unassigned = getUnassignedAgents(agents)

  return (
    <div className={styles.container}>
      <div className={styles.taskCards}>
        {filteredTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            agents={getAgentsByTask(agents, task.id)}
          />
        ))}
      </div>

      {unassigned.length > 0 && (
        <div className={styles.lobby}>
          <div className={styles.lobbyHeader}>
            <span className={styles.lobbyIcon}>🏢</span>
            <span className={styles.lobbyTitle}>Lobby</span>
            <span className={styles.lobbyCount}>{unassigned.length} idle</span>
          </div>
          <div className={styles.lobbyAgents}>
            {unassigned.map((agent) => (
              <AgentNode key={agent.id} agent={agent} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
