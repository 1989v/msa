import { useState } from 'react'
import type { LiveSession, LiveSubagent } from '@/types'
import { PixelSprite } from '@/components/Sprite/PixelSprite'
import { Desk } from '@/components/OfficeGrid/Desk'
import { useAppStore } from '@/store/useAppStore'
import styles from './LiveSessionArea.module.css'

const TOOL_SPRITE: Record<string, string> = {
  'Claude Code': 'warrior', 'Codex': 'mage', 'OpenCode': 'architect', 'Gemini': 'scholar',
}
const TYPE_SPRITE: Record<string, string> = {
  implementer: 'warrior', tester: 'archer', Explore: 'archer', Plan: 'strategist',
  'general-purpose': 'warrior', 'code-reviewer': 'sentinel', 'spec-writer': 'mage',
  'spec-shaper': 'mage', 'spec-initializer': 'scholar', 'tasks-list-creator': 'strategist',
  verifier: 'sentinel', 'scaffolding-agent': 'architect', 'debug-agent': 'healer',
  'analyzer-agent': 'scholar',
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return `${n}`
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
  const [expanded, setExpanded] = useState(false)
  const liveTasks = useAppStore((s) => s.liveTasks)
  const sessionTasks = Array.from(liveTasks.values()).filter(
    (t) => t.sessionId === session.sessionId
  )

  const spriteType = TOOL_SPRITE[session.tool ?? ''] ?? 'warrior'
  const isWorking = session.status === 'active'
  const isWaiting = session.status === 'waiting'
  const statusAnim = isWorking ? 'working' : isWaiting ? 'thinking' : 'idle'
  const toolColor = session.toolColor ?? 'var(--accent-blue)'

  return (
    <div className={`${styles.card} ${styles[`status_${session.status ?? 'completed'}`]}`}>
      {/* Header bar */}
      <div className={styles.header}>
        {session.tool && (
          <span className={styles.toolDot} style={{ backgroundColor: toolColor }} />
        )}
        <span className={styles.name}>{session.name ?? session.sessionId.slice(0, 8)}</span>
        <span className={styles.time}>{timeAgo(session.startedAt)}</span>
      </div>

      {/* Office desk area — characters at desks */}
      <div className={styles.deskArea}>
        {/* Main character — at desk when working, standing when waiting/done */}
        <div className={styles.deskUnit}>
          <div className={`${styles.characterWrap} ${!isWorking ? styles.standing : ''}`}>
            {!isWorking && session.lastAssistantMessage && (
              <div className={styles.bubble}>
                <span className={styles.bubbleText}>
                  {isWaiting ? '🙋 ' : '✅ '}{session.lastAssistantMessage.slice(0, 60)}
                </span>
                <div className={styles.bubbleTail} />
              </div>
            )}
            <PixelSprite type={spriteType} status={statusAnim} size={36} />
          </div>
          {isWorking && <Desk teamColor={toolColor} />}
          {!isWorking && <span className={styles.deskLabel}>{isWaiting ? '입력 대기' : '완료'}</span>}
        </div>

        {/* Subagent characters — at desk when active, standing when done */}
        {subagents.map((sub) => (
          <div key={sub.agentId} className={`${styles.deskUnit} ${sub.active ? '' : styles.done}`}>
            <div className={`${styles.characterWrap} ${!sub.active ? styles.standing : ''}`}>
              {!sub.active && sub.lastMessage && (
                <div className={styles.bubble}>
                  <span className={styles.bubbleText}>✅ {sub.lastMessage.slice(0, 40)}</span>
                  <div className={styles.bubbleTail} />
                </div>
              )}
              <PixelSprite
                type={TYPE_SPRITE[sub.agentType] ?? 'warrior'}
                status={sub.active ? 'working' : 'idle'}
                size={28}
              />
            </div>
            {sub.active && <Desk teamColor={toolColor} />}
            <span className={styles.deskLabel}>{sub.agentType.split(':').pop()}</span>
          </div>
        ))}
      </div>

      {/* Footer stats */}
      <div className={styles.footer}>
        <div className={styles.stats}>
          {session.costCents != null && session.costCents > 0 && (
            <span className={styles.stat}>💰${(session.costCents / 100).toFixed(2)}</span>
          )}
          {session.totalInputTokens != null && (
            <span className={styles.stat}>
              {formatTokens(session.totalInputTokens + (session.totalOutputTokens ?? 0))}
            </span>
          )}
          {session.model && (
            <span className={styles.statMuted}>{session.model}</span>
          )}
        </div>
        {(session.lastUserMessage || session.lastAssistantMessage) && (
          <button className={styles.expandBtn} onClick={() => setExpanded(!expanded)}>
            {expanded ? '접기 ▲' : '대화 보기 ▼'}
          </button>
        )}
      </div>

      {/* Expanded conversation */}
      {expanded && (
        <div className={styles.conversation}>
          {session.lastUserMessage && (
            <div className={styles.msgRow}>
              <span className={styles.msgUser}>👤 User</span>
              <p className={styles.msgText}>{session.lastUserMessage}</p>
            </div>
          )}
          {session.lastAssistantMessage && (
            <div className={styles.msgRow}>
              <span className={styles.msgBot}>🤖 Bot</span>
              <p className={styles.msgText}>{session.lastAssistantMessage}</p>
            </div>
          )}
          {sessionTasks.length > 0 && (
            <div className={styles.taskSection}>
              {sessionTasks.map((t) => (
                <div key={t.taskId} className={styles.taskRow}>
                  <span className={t.completed ? styles.taskDone : styles.taskActive}>
                    {t.completed ? '✅' : '⏳'}
                  </span>
                  <span>{t.subject ?? t.taskId}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
