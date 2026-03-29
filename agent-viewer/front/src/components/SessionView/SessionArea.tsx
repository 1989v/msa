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

// Group agents by role category for desk arrangement
const ROLE_GROUPS: Record<string, { label: string; icon: string; types: string[] }> = {
  planners: { label: 'Planning', icon: '📐', types: ['mage', 'strategist', 'scholar'] },
  builders: { label: 'Development', icon: '⚒️', types: ['warrior'] },
  reviewers: { label: 'QA / Review', icon: '🔍', types: ['archer', 'sentinel'] },
  support: { label: 'Support', icon: '🛠️', types: ['healer', 'architect', 'rogue', 'merchant'] },
}

function groupAgentsByRole(agents: Agent[]): { label: string; icon: string; agents: Agent[] }[] {
  const groups: { label: string; icon: string; agents: Agent[] }[] = []

  for (const [, group] of Object.entries(ROLE_GROUPS)) {
    const matched = agents.filter((a) => group.types.includes(a.spriteType))
    if (matched.length > 0) {
      groups.push({ label: group.label, icon: group.icon, agents: matched })
    }
  }

  // Remaining agents not matched
  const allMatched = groups.flatMap((g) => g.agents.map((a) => a.id))
  const unmatched = agents.filter((a) => !allMatched.includes(a.id))
  if (unmatched.length > 0) {
    groups.push({ label: 'General', icon: '💼', agents: unmatched })
  }

  return groups
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
  const roleGroups = groupAgentsByRole(agents)

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

      <p className={styles.description}>{session.description}</p>

      {/* Stats bar */}
      <div className={styles.statsBar}>
        <span className={styles.stat}>👥 {agents.length}명</span>
        <span className={styles.stat}>⚡ {workingCount}명 작업 중</span>
        {sessionTasks.length > 0 && (
          <span className={styles.stat}>📋 {sessionTasks.length}개 태스크</span>
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

      {/* Office floor — role-based desk arrangement */}
      <div className={styles.officeFloor}>
        {/* Wall decoration */}
        <div className={styles.wall}>
          <span className={styles.wallItem}>🖼️</span>
          <span className={styles.wallItem}>📊</span>
          <span className={styles.wallItem}>🗓️</span>
        </div>

        {/* Desk rows grouped by role */}
        <div className={styles.deskArea}>
          {roleGroups.map((group) => (
            <div key={group.label} className={styles.deskRow}>
              <div className={styles.rowLabel}>
                <span className={styles.rowIcon}>{group.icon}</span>
                <span className={styles.rowName}>{group.label}</span>
              </div>
              <div className={styles.rowDesks}>
                {/* Top row - facing down */}
                <div className={styles.deskLine}>
                  {group.agents.slice(0, Math.ceil(group.agents.length / 2)).map((agent) => (
                    <AgentNode
                      key={agent.id}
                      agent={agent}
                      showDesk
                      teamColor={session.color}
                    />
                  ))}
                </div>
                {/* Aisle divider */}
                {group.agents.length > 1 && <div className={styles.aisle} />}
                {/* Bottom row - facing up */}
                {group.agents.length > 1 && (
                  <div className={styles.deskLine}>
                    {group.agents.slice(Math.ceil(group.agents.length / 2)).map((agent) => (
                      <AgentNode
                        key={agent.id}
                        agent={agent}
                        showDesk
                        teamColor={session.color}
                      />
                    ))}
                  </div>
                )}
              </div>
              {/* Partition wall between groups */}
              <div className={styles.partition} />
            </div>
          ))}
        </div>

        {/* Office amenities corner */}
        <div className={styles.amenities}>
          <span className={styles.amenity} title="정수기">🚰</span>
          <span className={styles.amenity} title="화분">🪴</span>
          <span className={styles.amenity} title="프린터">🖨️</span>
        </div>
      </div>
    </div>
  )
}
