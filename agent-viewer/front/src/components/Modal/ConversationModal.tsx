import type { LiveSession } from '@/types'
import { PixelSprite } from '@/components/Sprite/PixelSprite'
import styles from './ConversationModal.module.css'

const TOOL_SPRITE: Record<string, string> = {
  'Claude Code': 'warrior', 'Codex': 'mage', 'OpenCode': 'architect', 'Gemini': 'scholar',
}

interface Props {
  session: LiveSession
  onClose: () => void
}

export function ConversationModal({ session, onClose }: Props) {
  const spriteType = TOOL_SPRITE[session.tool ?? ''] ?? 'warrior'

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Modal header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <PixelSprite type={spriteType} status="idle" size={32} />
            <div>
              <h2 className={styles.title}>{session.name ?? session.sessionId.slice(0, 12)}</h2>
              <span className={styles.subtitle}>
                {session.tool && <span style={{ color: session.toolColor }}>{session.tool}</span>}
                {session.model && <> · {session.model}</>}
              </span>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Conversation area */}
        <div className={styles.conversation}>
          {session.lastUserMessage && (
            <div className={styles.msgBlock}>
              <div className={styles.msgAvatar}>👤</div>
              <div className={styles.msgBubbleUser}>
                <span className={styles.msgRole}>User</span>
                <p className={styles.msgContent}>{session.lastUserMessage}</p>
              </div>
            </div>
          )}

          {session.lastAssistantMessage && (
            <div className={`${styles.msgBlock} ${styles.msgBlockBot}`}>
              <div className={styles.msgAvatar}>
                <PixelSprite type={spriteType} status="idle" size={24} />
              </div>
              <div className={styles.msgBubbleBot}>
                <span className={styles.msgRole}>Assistant</span>
                <p className={styles.msgContent}>{session.lastAssistantMessage}</p>
              </div>
            </div>
          )}

          {!session.lastUserMessage && !session.lastAssistantMessage && (
            <div className={styles.emptyMsg}>대화 내용이 없습니다</div>
          )}
        </div>

        {/* Footer stats */}
        <div className={styles.footer}>
          {session.costCents != null && session.costCents > 0 && (
            <span className={styles.footerStat}>💰 ${(session.costCents / 100).toFixed(2)}</span>
          )}
          {session.totalInputTokens != null && (
            <span className={styles.footerStat}>
              📊 Input {((session.totalInputTokens) / 1000).toFixed(0)}K · Output {((session.totalOutputTokens ?? 0) / 1000).toFixed(0)}K
            </span>
          )}
          {session.cacheReadTokens != null && session.cacheReadTokens > 0 && (
            <span className={styles.footerStat}>
              📦 Cache {((session.cacheReadTokens) / 1000).toFixed(0)}K
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
