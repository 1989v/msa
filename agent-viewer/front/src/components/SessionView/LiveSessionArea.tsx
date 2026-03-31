import { useState } from 'react'
import type { LiveSession, LiveSubagent } from '@/types'
import { PixelSprite } from '@/components/Sprite/PixelSprite'
import { Desk } from '@/components/OfficeGrid/Desk'
import { ConversationModal } from '@/components/Modal/ConversationModal'
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
  const [showModal, setShowModal] = useState(false)

  const spriteType = TOOL_SPRITE[session.tool ?? ''] ?? 'warrior'
  const isWorking = session.status === 'active'
  const isWaiting = session.status === 'waiting'
  const statusAnim = isWorking ? 'working' : isWaiting ? 'thinking' : 'idle'
  const toolColor = session.toolColor ?? 'var(--accent-blue)'

  return (
    <>
      <div className={`${styles.card} ${styles[`status_${session.status ?? 'completed'}`]}`}>
        {/* Header */}
        <div className={styles.header}>
          {session.tool && (
            <span className={styles.toolDot} style={{ backgroundColor: toolColor }} />
          )}
          <span className={styles.name}>{session.name ?? session.sessionId.slice(0, 8)}</span>
          <span className={styles.time}>{timeAgo(session.startedAt)}</span>
        </div>

        {/* Office floor */}
        <div className={styles.deskArea}>
          {/* Main character */}
          <div className={styles.deskUnit}>
            {session.lastAssistantMessage && (
              <div className={`${styles.comicBubble} ${isWorking ? styles.bubbleWorking : styles.bubbleTalking}`}>
                <div className={styles.comicText}>
                  {isWorking ? '💬 ' : isWaiting ? '🙋 ' : '✅ '}
                  {session.lastAssistantMessage.slice(0, isWorking ? 50 : 80)}
                </div>
                <div className={styles.comicTail} />
              </div>
            )}
            <div className={`${styles.characterWrap} ${!isWorking ? styles.standing : ''}`}>
              <PixelSprite type={spriteType} status={statusAnim} size={40} />
            </div>
            {isWorking && <Desk teamColor={toolColor} />}
            {!isWorking && <span className={styles.statusLabel}>{isWaiting ? '💭 입력 대기' : '✨ 완료'}</span>}
          </div>

          {/* Subagents */}
          {subagents.map((sub) => (
            <div key={sub.agentId} className={`${styles.deskUnit} ${sub.active ? '' : styles.done}`}>
              {sub.lastMessage && !sub.active && (
                <div className={`${styles.comicBubble} ${styles.bubbleSmall}`}>
                  <div className={styles.comicText}>✅ {sub.lastMessage.slice(0, 30)}</div>
                  <div className={styles.comicTail} />
                </div>
              )}
              <div className={`${styles.characterWrap} ${!sub.active ? styles.standing : ''}`}>
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

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.stats}>
            {session.costCents != null && session.costCents > 0 && (
              <span className={styles.stat}>💰${(session.costCents / 100).toFixed(2)}</span>
            )}
            {session.totalInputTokens != null && (
              <span className={styles.stat}>
                📊{formatTokens(session.totalInputTokens + (session.totalOutputTokens ?? 0))}
              </span>
            )}
            {session.model && (
              <span className={styles.statMuted}>{session.model}</span>
            )}
          </div>
          {(session.lastUserMessage || session.lastAssistantMessage) && (
            <button className={styles.chatBtn} onClick={() => setShowModal(true)}>
              💬 대화 보기
            </button>
          )}
        </div>
      </div>

      {/* Conversation modal */}
      {showModal && (
        <ConversationModal session={session} onClose={() => setShowModal(false)} />
      )}
    </>
  )
}
