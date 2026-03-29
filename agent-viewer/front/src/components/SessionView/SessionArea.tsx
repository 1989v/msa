import { useState } from 'react'
import type { Session, Agent, Task } from '@/types'
import { AgentNode } from '@/components/OfficeGrid/AgentNode'
import styles from './SessionArea.module.css'

interface Props {
  session: Session
  agents: Agent[]
  tasks: Task[]
}

const STATUS_LABEL: Record<string, string> = {
  active: '진행 중',
  paused: '일시 중지',
  completed: '완료',
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '방금'
  if (mins < 60) return `${mins}분 전`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}시간 전`
  return `${Math.floor(hours / 24)}일 전`
}

export function SessionArea({ session, agents, tasks }: Props) {
  const [hovered, setHovered] = useState(false)

  const sessionTasks = tasks.filter((t) => session.taskIds.includes(t.id))
  const workingCount = agents.filter((a) => a.status === 'working').length

  return (
    <div
      className={`${styles.area} ${styles[session.status]} ${hovered ? styles.hovered : ''}`}
      style={{ borderColor: hovered ? session.color : undefined }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Session header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={`${styles.statusDot} ${styles[session.status]}`} />
          <h3 className={styles.sessionName}>{session.name}</h3>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.statusLabel}>{STATUS_LABEL[session.status]}</span>
          <span className={styles.timeLabel}>{timeAgo(session.startedAt)}</span>
        </div>
      </div>

      {/* Description */}
      <p className={styles.description}>{session.description}</p>

      {/* Stats bar */}
      <div className={styles.statsBar}>
        <span className={styles.stat}>
          <span className={styles.statIcon}>👥</span> {agents.length}명
        </span>
        <span className={styles.stat}>
          <span className={styles.statIcon}>⚡</span> {workingCount}명 작업 중
        </span>
        {sessionTasks.length > 0 && (
          <span className={styles.stat}>
            <span className={styles.statIcon}>📋</span> {sessionTasks.length}개 태스크
          </span>
        )}
      </div>

      {/* Task progress */}
      {sessionTasks.length > 0 && (
        <div className={styles.taskProgress}>
          {sessionTasks.map((task) => (
            <div key={task.id} className={styles.taskRow}>
              <span className={`${styles.taskDot} ${styles[task.status]}`} />
              <span className={styles.taskName}>{task.name}</span>
              {task.progress != null && (
                <div className={styles.miniProgress}>
                  <div className={styles.miniProgressFill} style={{ width: `${task.progress}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Agent workspace floor */}
      <div className={styles.floor}>
        <div className={styles.agents}>
          {agents.map((agent) => (
            <AgentNode
              key={agent.id}
              agent={agent}
              showDesk
              teamColor={session.color}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
