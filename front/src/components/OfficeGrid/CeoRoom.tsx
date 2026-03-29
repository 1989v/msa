import { useAppStore, getSelectedAgent } from '@/store/useAppStore'
import { PixelSprite } from '@/components/Sprite/PixelSprite'
import { SpeechBubble } from '@/components/Sprite/SpeechBubble'
import type { Notification } from '@/types'
import styles from './CeoRoom.module.css'
import { useState } from 'react'

function QueuedAgent({ notification }: { notification: Notification }) {
  const agents = useAppStore((s) => s.agents)
  const selectAgent = useAppStore((s) => s.selectAgent)
  const togglePanel = useAppStore((s) => s.toggleNotificationPanel)
  const [hovered, setHovered] = useState(false)
  const agent = getSelectedAgent(agents, notification.agentId)

  if (!agent) return null

  const typeLabel: Record<string, string> = {
    approval: '결재 요청 드립니다!',
    completed: '완료 보고 드립니다!',
    blocked: '이슈 보고 드립니다!',
    report: '업무 보고 드립니다!',
  }

  return (
    <div
      className={`${styles.queuedAgent} ${notification.actionRequired ? styles.urgent : ''}`}
      onClick={() => {
        selectAgent(agent.id)
        togglePanel()
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={styles.agentSprite}>
        <SpeechBubble
          text={typeLabel[notification.type] ?? notification.title}
          visible={hovered}
        />
        <PixelSprite type={agent.spriteType} status="idle" size={28} />
      </div>
      <span className={styles.agentLabel}>{agent.name}</span>
      {notification.actionRequired && (
        <span className={styles.approvalIcon}>📋</span>
      )}
    </div>
  )
}

export function CeoRoom() {
  const notifications = useAppStore((s) => s.notifications)
  const unread = notifications.filter((n) => !n.read || n.actionRequired)

  if (unread.length === 0) return null

  // Sort: actionRequired first
  const sorted = [...unread].sort((a, b) => {
    if (a.actionRequired && !b.actionRequired) return -1
    if (!a.actionRequired && b.actionRequired) return 1
    return b.timestamp - a.timestamp
  })

  return (
    <div className={styles.room}>
      <div className={styles.roomHeader}>
        <span className={styles.roomIcon}>👔</span>
        <span className={styles.roomTitle}>CEO Office</span>
        <span className={styles.queueCount}>{unread.length}명 대기</span>
      </div>

      {/* CEO desk */}
      <div className={styles.ceoDeskArea}>
        <div className={styles.ceoDesk}>
          <svg viewBox="0 0 56 24" width={56} height={24} className={styles.ceoSvg}>
            <rect x="0" y="0" width="56" height="5" rx="2" fill="#6b4c3b" />
            <rect x="0" y="0" width="56" height="3" fill="#7d5a47" />
            <rect x="2" y="5" width="4" height="19" fill="#5c4033" />
            <rect x="50" y="5" width="4" height="19" fill="#5c4033" />
            <rect x="20" y="6" width="16" height="10" rx="1" fill="#2d333b" />
            <rect x="21" y="7" width="14" height="8" fill="#1a8cff" opacity="0.2" />
          </svg>
          <div className={styles.ceoChair}>
            <svg viewBox="0 0 24 16" width={24} height={16}>
              <rect x="2" y="0" width="20" height="4" rx="2" fill="#8b4513" />
              <rect x="4" y="4" width="4" height="12" fill="#6b3410" />
              <rect x="16" y="4" width="4" height="12" fill="#6b3410" />
              <rect x="3" y="10" width="18" height="4" rx="2" fill="#8b4513" />
              <rect x="8" y="14" width="8" height="2" rx="1" fill="#5a2d0c" />
            </svg>
          </div>
          <div className={styles.nameplate}>CEO</div>
        </div>
      </div>

      {/* Queue line */}
      <div className={styles.queueLine}>
        <div className={styles.queuePath} />
        {sorted.map((notif, i) => (
          <div
            key={notif.id}
            className={styles.queueSlot}
            style={{
              animationDelay: `${i * 0.15}s`,
            }}
          >
            <QueuedAgent notification={notif} />
          </div>
        ))}
      </div>
    </div>
  )
}
