import { useEffect, useState, useRef } from 'react'
import type { LiveSession } from '@/types'
import { PixelSprite } from '@/components/Sprite/PixelSprite'
import styles from './ConversationModal.module.css'

const TOOL_SPRITE: Record<string, string> = {
  'Claude Code': 'warrior', 'Codex': 'mage', 'OpenCode': 'architect', 'Gemini': 'scholar',
}

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8090'

interface Message {
  role: string
  content: string
  timestamp?: string
  model?: string
  input_tokens?: number
  output_tokens?: number
}

interface Props {
  session: LiveSession
  onClose: () => void
}

export function ConversationModal({ session, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const spriteType = TOOL_SPRITE[session.tool ?? ''] ?? 'warrior'

  useEffect(() => {
    const path = session.cwd ?? session.name ?? ''
    fetch(`${API_BASE}/api/conversation?projectPath=${encodeURIComponent(path)}`)
      .then((r) => r.json())
      .then((data: Message[]) => {
        setMessages(data)
        setLoading(false)
        // Scroll to bottom
        setTimeout(() => {
          scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
        }, 100)
      })
      .catch(() => {
        // Fallback to last messages
        const fallback: Message[] = []
        if (session.lastUserMessage) fallback.push({ role: 'user', content: session.lastUserMessage })
        if (session.lastAssistantMessage) fallback.push({ role: 'assistant', content: session.lastAssistantMessage })
        setMessages(fallback)
        setLoading(false)
      })
  }, [session])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <PixelSprite type={spriteType} status="idle" size={32} />
            <div>
              <h2 className={styles.title}>{session.name ?? session.sessionId.slice(0, 12)}</h2>
              <span className={styles.subtitle}>
                {session.tool && <span style={{ color: session.toolColor }}>{session.tool}</span>}
                {session.model && <> · {session.model}</>}
                {messages.length > 0 && <> · {messages.length}개 메시지</>}
              </span>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Conversation */}
        <div className={styles.conversation} ref={scrollRef}>
          {loading && (
            <div className={styles.loading}>
              <PixelSprite type={spriteType} status="working" size={32} />
              <span>대화 내역 불러오는 중...</span>
            </div>
          )}

          {!loading && messages.length === 0 && (
            <div className={styles.empty}>대화 내역이 없습니다</div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`${styles.msgBlock} ${msg.role === 'assistant' ? styles.msgBot : ''}`}>
              <div className={styles.msgAvatar}>
                {msg.role === 'user' ? (
                  <span className={styles.avatarEmoji}>👤</span>
                ) : (
                  <PixelSprite type={spriteType} status="idle" size={24} />
                )}
              </div>
              <div className={msg.role === 'user' ? styles.bubbleUser : styles.bubbleBot}>
                <div className={styles.bubbleHeader}>
                  <span className={styles.msgRole}>{msg.role === 'user' ? 'User' : 'Assistant'}</span>
                  {msg.timestamp && (
                    <span className={styles.msgTime}>
                      {new Date(msg.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <p className={styles.msgContent}>{msg.content}</p>
                {msg.role === 'assistant' && (msg.input_tokens || msg.output_tokens) && (
                  <span className={styles.tokenInfo}>
                    in:{msg.input_tokens} out:{msg.output_tokens}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          {session.costCents != null && session.costCents > 0 && (
            <span className={styles.footerStat}>💰 ${(session.costCents / 100).toFixed(2)}</span>
          )}
          {session.totalInputTokens != null && (
            <span className={styles.footerStat}>
              📊 In {((session.totalInputTokens) / 1000).toFixed(0)}K · Out {((session.totalOutputTokens ?? 0) / 1000).toFixed(0)}K
            </span>
          )}
          <span className={styles.footerStat}>
            💬 {messages.length}개 메시지
          </span>
        </div>
      </div>
    </div>
  )
}
