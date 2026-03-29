import type { LiveSession, LiveSubagent } from '@/types'
import { PixelSprite } from '@/components/Sprite/PixelSprite'
import { useAppStore } from '@/store/useAppStore'
import styles from './LiveSessionArea.module.css'

// Map agent types to sprite types
const TYPE_SPRITE: Record<string, string> = {
  implementer: 'warrior',
  tester: 'archer',
  Explore: 'archer',
  Plan: 'strategist',
  'general-purpose': 'warrior',
  'code-reviewer': 'sentinel',
  'spec-writer': 'mage',
  'spec-shaper': 'mage',
  'spec-initializer': 'scholar',
  'tasks-list-creator': 'strategist',
  verifier: 'sentinel',
  'scaffolding-agent': 'architect',
  'debug-agent': 'healer',
  'analyzer-agent': 'scholar',
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '방금'
  if (mins < 60) return `${mins}분 전`
  const hours = Math.floor(mins / 60)
  return `${hours}시간 전`
}

interface Props {
  session: LiveSession
  subagents: LiveSubagent[]
}

export function LiveSessionArea({ session, subagents }: Props) {
  const liveTasks = useAppStore((s) => s.liveTasks)
  const sessionTasks = Array.from(liveTasks.values()).filter(
    (t) => t.sessionId === session.sessionId
  )
  const activeCount = subagents.filter((s) => s.active).length

  return (
    <div className={`${styles.area} ${session.active ? styles.active : styles.ended}`}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.liveDot} />
          <span className={styles.liveTag}>LIVE</span>
          <h3 className={styles.sessionId}>
            {session.name ?? `Session ${session.sessionId.slice(0, 8)}`}
          </h3>
        </div>
        <span className={styles.time}>{timeAgo(session.startedAt)}</span>
      </div>

      <div className={styles.statsBar}>
        <span className={styles.stat}>
          👥 {subagents.length}명 ({activeCount} active)
        </span>
        {sessionTasks.length > 0 && (
          <span className={styles.stat}>
            📋 {sessionTasks.length} tasks
          </span>
        )}
      </div>

      {sessionTasks.length > 0 && (
        <div className={styles.taskList}>
          {sessionTasks.map((task) => (
            <div key={task.taskId} className={styles.taskRow}>
              <span className={`${styles.taskDot} ${task.completed ? styles.done : styles.active}`} />
              <span className={styles.taskName}>{task.subject ?? task.taskId}</span>
            </div>
          ))}
        </div>
      )}

      <div className={styles.floor}>
        <div className={styles.agents}>
          {subagents.map((sub) => (
            <div key={sub.agentId} className={`${styles.agentSlot} ${sub.active ? styles.agentActive : styles.agentDone}`}>
              <div className={styles.spriteWrap}>
                <PixelSprite
                  type={TYPE_SPRITE[sub.agentType] ?? 'warrior'}
                  status={sub.active ? 'working' : 'idle'}
                  size={32}
                />
              </div>
              <span className={styles.agentType}>{sub.agentType}</span>
              {sub.active && <span className={styles.activeBadge}>working</span>}
              {!sub.active && sub.lastMessage && (
                <span className={styles.doneBadge} title={sub.lastMessage}>done</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
