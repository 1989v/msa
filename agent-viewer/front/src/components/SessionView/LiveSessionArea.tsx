import type { LiveSession, LiveSubagent } from '@/types'
import { PixelSprite } from '@/components/Sprite/PixelSprite'
import { useAppStore } from '@/store/useAppStore'
import styles from './LiveSessionArea.module.css'

const TYPE_SPRITE: Record<string, string> = {
  implementer: 'warrior', tester: 'archer', Explore: 'archer',
  Plan: 'strategist', 'general-purpose': 'warrior', 'code-reviewer': 'sentinel',
  'spec-writer': 'mage', 'spec-shaper': 'mage', 'spec-initializer': 'scholar',
  'tasks-list-creator': 'strategist', verifier: 'sentinel',
  'scaffolding-agent': 'architect', 'debug-agent': 'healer', 'analyzer-agent': 'scholar',
}

// Tool → default sprite for scanned sessions (no subagent data)
const TOOL_SPRITE: Record<string, string> = {
  'Claude Code': 'warrior',
  'Codex': 'mage',
  'OpenCode': 'architect',
  'Gemini': 'scholar',
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '방금'
  if (mins < 60) return `${mins}분 전`
  const hours = Math.floor(mins / 60)
  return `${hours}시간 전`
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return `${n}`
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

  // Determine sprite and speech for the main session character
  const spriteType = TOOL_SPRITE[session.tool ?? ''] ?? 'warrior'
  const statusAnim = session.status === 'active' ? 'working' : session.status === 'waiting' ? 'thinking' : 'idle'
  const speechText = session.lastAssistantMessage?.slice(0, 80)

  return (
    <div
      className={`${styles.area} ${session.active ? styles.active : styles.ended}`}
    >
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          {session.tool ? (
            <span className={styles.toolTag} style={{ color: session.toolColor, borderColor: session.toolColor }}>
              {session.tool}
            </span>
          ) : (
            <span className={styles.liveDot} />
          )}
          <h3 className={styles.sessionName}>
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

      {/* Stats bar */}
      <div className={styles.statsBar}>
        {subagents.length > 0 && (
          <span className={styles.stat}>👥 {subagents.length} ({activeCount} active)</span>
        )}
        {session.costCents != null && session.costCents > 0 && (
          <span className={styles.stat}>💰 ${(session.costCents / 100).toFixed(2)}</span>
        )}
        {session.totalInputTokens != null && (
          <span className={styles.stat}>
            📊 {formatTokens(session.totalInputTokens + (session.totalOutputTokens ?? 0))}
          </span>
        )}
        {session.model && (
          <span className={styles.stat}>🤖 {session.model}</span>
        )}
        {sessionTasks.length > 0 && (
          <span className={styles.stat}>📋 {sessionTasks.length} tasks</span>
        )}
      </div>

      {/* Office floor with character */}
      <div className={styles.officeFloor}>
        <div className={styles.characterArea}>
          {/* Main session character with speech bubble */}
          <div className={styles.mainCharacter}>
            {speechText && (
              <div className={styles.speechBubble}>
                <span className={styles.speechText}>{speechText}</span>
                <div className={styles.speechTail} />
              </div>
            )}
            <PixelSprite type={spriteType} status={statusAnim} size={48} />
            <span className={styles.charLabel}>{session.tool ?? 'Agent'}</span>
          </div>

          {/* Subagent characters */}
          {subagents.length > 0 && (
            <div className={styles.subagentRow}>
              {subagents.map((sub) => (
                <div key={sub.agentId} className={`${styles.subagentChar} ${sub.active ? '' : styles.subDone}`}>
                  <PixelSprite
                    type={TYPE_SPRITE[sub.agentType] ?? 'warrior'}
                    status={sub.active ? 'working' : 'idle'}
                    size={32}
                  />
                  <span className={styles.subLabel}>{sub.agentType}</span>
                  {sub.active && <span className={styles.activeGlow}>⚡</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* User message at bottom */}
        {session.lastUserMessage && (
          <div className={styles.userMessage}>
            <span className={styles.userIcon}>👤</span>
            <span className={styles.userText}>{session.lastUserMessage}</span>
          </div>
        )}
      </div>
    </div>
  )
}
