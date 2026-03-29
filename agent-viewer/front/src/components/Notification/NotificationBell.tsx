import { useAppStore } from '@/store/useAppStore'
import styles from './NotificationBell.module.css'

export function NotificationBell() {
  const notifications = useAppStore((s) => s.notifications)
  const togglePanel = useAppStore((s) => s.toggleNotificationPanel)

  const unreadCount = notifications.filter((n) => !n.read).length
  const actionCount = notifications.filter((n) => n.actionRequired && !n.read).length

  return (
    <button className={styles.bell} onClick={togglePanel}>
      <span className={styles.icon}>🔔</span>
      {unreadCount > 0 && (
        <span className={`${styles.badge} ${actionCount > 0 ? styles.urgent : ''}`}>
          {unreadCount}
        </span>
      )}
      {actionCount > 0 && (
        <span className={styles.pulse} />
      )}
    </button>
  )
}
