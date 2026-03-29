import { useAppStore, getSelectedAgent } from '@/store/useAppStore'
import { PixelSprite } from '@/components/Sprite/PixelSprite'
import type { Notification } from '@/types'
import styles from './NotificationPanel.module.css'

const TYPE_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  approval: { icon: '📋', label: '결재 대기', color: 'var(--accent-red)' },
  completed: { icon: '✅', label: '완료 보고', color: 'var(--accent-green)' },
  blocked: { icon: '🚫', label: '이슈 보고', color: 'var(--accent-yellow)' },
  report: { icon: '📝', label: '업무 보고', color: 'var(--accent-blue)' },
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

function NotificationItem({ notification }: { notification: Notification }) {
  const agents = useAppStore((s) => s.agents)
  const markRead = useAppStore((s) => s.markNotificationRead)
  const approve = useAppStore((s) => s.approveNotification)
  const dismiss = useAppStore((s) => s.dismissNotification)
  const selectAgent = useAppStore((s) => s.selectAgent)

  const agent = getSelectedAgent(agents, notification.agentId)
  const config = TYPE_CONFIG[notification.type] ?? TYPE_CONFIG.report

  return (
    <div
      className={`${styles.item} ${notification.read ? styles.read : ''} ${notification.actionRequired ? styles.urgent : ''}`}
      onClick={() => {
        markRead(notification.id)
        selectAgent(notification.agentId)
      }}
    >
      <div className={styles.itemHeader}>
        <div className={styles.agentAvatar}>
          {agent && (
            <PixelSprite type={agent.spriteType} status={agent.status} size={28} />
          )}
        </div>
        <div className={styles.itemMeta}>
          <span className={styles.agentName}>{agent?.name ?? 'Unknown'}</span>
          <span className={styles.typeBadge} style={{ color: config.color, borderColor: config.color }}>
            {config.icon} {config.label}
          </span>
        </div>
        <span className={styles.time}>{timeAgo(notification.timestamp)}</span>
      </div>

      <h4 className={styles.itemTitle}>{notification.title}</h4>
      <p className={styles.itemMessage}>{notification.message}</p>

      {notification.actionRequired && !notification.title.startsWith('[승인됨]') && (
        <div className={styles.actions}>
          <button
            className={styles.approveBtn}
            onClick={(e) => { e.stopPropagation(); approve(notification.id) }}
          >
            ✓ 승인
          </button>
          <button
            className={styles.deferBtn}
            onClick={(e) => { e.stopPropagation(); markRead(notification.id) }}
          >
            보류
          </button>
          <button
            className={styles.dismissBtn}
            onClick={(e) => { e.stopPropagation(); dismiss(notification.id) }}
          >
            무시
          </button>
        </div>
      )}
    </div>
  )
}

export function NotificationPanel() {
  const notifications = useAppStore((s) => s.notifications)
  const showPanel = useAppStore((s) => s.showNotificationPanel)

  if (!showPanel) return null

  const sorted = [...notifications].sort((a, b) => {
    if (a.actionRequired && !a.read && !(b.actionRequired && !b.read)) return -1
    if (b.actionRequired && !b.read && !(a.actionRequired && !a.read)) return 1
    return b.timestamp - a.timestamp
  })

  const pendingApprovals = notifications.filter((n) => n.actionRequired && !n.read).length

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          🏢 CEO 데스크
        </h2>
        {pendingApprovals > 0 && (
          <span className={styles.pendingBadge}>
            {pendingApprovals}건 결재 대기
          </span>
        )}
      </div>

      <div className={styles.list}>
        {sorted.map((n) => (
          <NotificationItem key={n.id} notification={n} />
        ))}
        {sorted.length === 0 && (
          <div className={styles.empty}>
            모든 보고가 처리되었습니다 ☕
          </div>
        )}
      </div>
    </div>
  )
}
