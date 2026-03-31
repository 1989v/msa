import type { LiveSession, LiveSubagent } from '@/types'
import { PixelSprite } from '@/components/Sprite/PixelSprite'
import { useAppStore } from '@/store/useAppStore'
import styles from './LiveSessionArea.module.css'

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

const ROLE_CATEGORY: Record<string, string> = {
  warrior: 'Development',
  archer: 'QA / Review',
  sentinel: 'QA / Review',
  mage: 'Planning',
  strategist: 'Planning',
  scholar: 'Research',
  healer: 'Support',
  architect: 'Support',
  rogue: 'Support',
  merchant: 'Support',
}

const CATEGORY_ICON: Record<string, string> = {
  Planning: '📐',
  Development: '⚒️',
  'QA / Review': '🔍',
  Research: '🔬',
  Support: '🛠️',
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '방금'
  if (mins < 60) return `${mins}분 전`
  const hours = Math.floor(mins / 60)
  return `${hours}시간 전`
}

function groupByRole(subagents: LiveSubagent[]): { category: string; icon: string; subs: LiveSubagent[] }[] {
  const map = new Map<string, LiveSubagent[]>()
  for (const sub of subagents) {
    const sprite = TYPE_SPRITE[sub.agentType] ?? 'warrior'
    const cat = ROLE_CATEGORY[sprite] ?? 'General'
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(sub)
  }
  return Array.from(map.entries()).map(([category, subs]) => ({
    category,
    icon: CATEGORY_ICON[category] ?? '💼',
    subs,
  }))
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
  const roleGroups = groupByRole(subagents)

  return (
    <div className={`${styles.area} ${session.active ? styles.active : styles.ended}`}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.liveDot} />
          {session.tool ? (
            <span className={styles.toolTag} style={{ color: session.toolColor, borderColor: session.toolColor }}>
              {session.tool}
            </span>
          ) : (
            <span className={styles.liveTag}>LIVE</span>
          )}
          <h3 className={styles.sessionId}>
            {session.name ?? `Session ${session.sessionId.slice(0, 8)}`}
          </h3>
        </div>
        <div className={styles.headerRight}>
          {session.status && (
            <span className={`${styles.statusBadge} ${styles[`status_${session.status}`]}`}>
              {session.status === 'active' ? '작업 중' : session.status === 'waiting' ? '입력 대기' : '완료'}
            </span>
          )}
          <span className={styles.time}>{timeAgo(session.startedAt)}</span>
        </div>
      </div>

      {/* Last conversation messages */}
      {(session.lastUserMessage || session.lastAssistantMessage) && (
        <div className={styles.conversation}>
          {session.lastUserMessage && (
            <div className={styles.msgRow}>
              <span className={styles.msgRole}>User</span>
              <span className={styles.msgText}>{session.lastUserMessage}</span>
            </div>
          )}
          {session.lastAssistantMessage && (
            <div className={styles.msgRow}>
              <span className={styles.msgRoleBot}>Bot</span>
              <span className={styles.msgText}>{session.lastAssistantMessage}</span>
            </div>
          )}
        </div>
      )}

      <div className={styles.statsBar}>
        {subagents.length > 0 && (
          <span className={styles.stat}>👥 {subagents.length}명 ({activeCount} active)</span>
        )}
        {session.costCents != null && session.costCents > 0 && (
          <span className={styles.stat}>💰 ${(session.costCents / 100).toFixed(2)}</span>
        )}
        {session.totalInputTokens != null && (
          <span className={styles.stat}>
            📊 {((session.totalInputTokens + (session.totalOutputTokens ?? 0)) / 1000).toFixed(0)}K tokens
          </span>
        )}
        {session.model && (
          <span className={styles.stat}>🤖 {session.model}</span>
        )}
        {sessionTasks.length > 0 && (
          <span className={styles.stat}>📋 {sessionTasks.length} tasks</span>
        )}
      </div>

      {sessionTasks.length > 0 && (
        <div className={styles.taskList}>
          {sessionTasks.map((task) => (
            <div key={task.taskId} className={styles.taskRow}>
              <span className={`${styles.taskDot} ${task.completed ? styles.done : styles.taskActive}`} />
              <span className={styles.taskName}>{task.subject ?? task.taskId}</span>
            </div>
          ))}
        </div>
      )}

      {/* Office floor with role-based desk rows */}
      <div className={styles.officeFloor}>
        <div className={styles.wall}>
          <span className={styles.wallItem}>🖥️</span>
          <span className={styles.wallItem}>📊</span>
        </div>

        <div className={styles.deskArea}>
          {roleGroups.map((group) => (
            <div key={group.category} className={styles.deskRow}>
              <div className={styles.rowLabel}>
                <span className={styles.rowIcon}>{group.icon}</span>
                <span className={styles.rowName}>{group.category}</span>
              </div>
              <div className={styles.rowDesks}>
                {group.subs.map((sub) => (
                  <div key={sub.agentId} className={`${styles.deskUnit} ${sub.active ? '' : styles.deskDone}`}>
                    <div className={styles.spriteWrap}>
                      <PixelSprite
                        type={TYPE_SPRITE[sub.agentType] ?? 'warrior'}
                        status={sub.active ? 'working' : 'done'}
                        size={32}
                      />
                    </div>
                    <span className={styles.agentType}>{sub.agentType}</span>
                    {sub.active && <span className={styles.activeBadge}>⚡</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.amenities}>
          <span className={styles.amenity}>🪴</span>
          <span className={styles.amenity}>🚰</span>
        </div>
      </div>
    </div>
  )
}
