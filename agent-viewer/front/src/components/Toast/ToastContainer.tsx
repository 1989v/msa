import { useAppStore } from '@/store/useAppStore'
import styles from './ToastContainer.module.css'

export function ToastContainer() {
  const toasts = useAppStore((s) => s.toasts)
  const dismissToast = useAppStore((s) => s.dismissToast)

  if (toasts.length === 0) return null

  return (
    <div className={styles.container}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${styles.toast} ${styles[toast.type]}`}
          onClick={() => dismissToast(toast.id)}
        >
          <span className={styles.message}>{toast.message}</span>
        </div>
      ))}
    </div>
  )
}
