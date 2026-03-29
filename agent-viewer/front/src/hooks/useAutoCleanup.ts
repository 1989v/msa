import { useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'

const CLEANUP_INTERVAL = 60_000 // check every minute
const STALE_THRESHOLD = 30 * 60_000 // 30 minutes

export function useAutoCleanup() {
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      useAppStore.setState((state) => {
        const liveSessions = new Map(state.liveSessions)
        let changed = false

        for (const [id, session] of liveSessions) {
          if (!session.active) {
            const startTime = new Date(session.startedAt).getTime()
            if (now - startTime > STALE_THRESHOLD) {
              liveSessions.delete(id)
              changed = true
            }
          }
        }

        return changed ? { liveSessions } : {}
      })
    }, CLEANUP_INTERVAL)

    return () => clearInterval(interval)
  }, [])
}
