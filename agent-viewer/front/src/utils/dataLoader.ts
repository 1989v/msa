import type { AppData } from '@/types'
import staticData from '@/data/agents.json'

export function loadAppData(): AppData {
  const source = import.meta.env.VITE_DATA_SOURCE ?? 'static'

  if (source === 'static') {
    const data = staticData as AppData
    const now = Date.now()
    // Convert relative timestamps (negative offsets) to absolute
    data.notifications = data.notifications.map((n) => ({
      ...n,
      timestamp: n.timestamp <= 0 ? now + n.timestamp : n.timestamp,
    }))
    data.sessions = data.sessions.map((s) => ({
      ...s,
      startedAt: s.startedAt <= 0 ? now + s.startedAt : s.startedAt,
    }))
    return data
  }

  return staticData as AppData
}
