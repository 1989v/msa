import { useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '@/store/useAppStore'

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8090/ws/events'
const RECONNECT_DELAY = 3000

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setConnectionStatus = useAppStore((s) => s.setConnectionStatus)
  const handleWsEvent = useAppStore((s) => s.handleWsEvent)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setConnectionStatus('connecting')

    try {
      const ws = new WebSocket(WS_URL)

      ws.onopen = () => {
        setConnectionStatus('connected')
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          handleWsEvent(data)
        } catch {
          // ignore parse errors
        }
      }

      ws.onclose = () => {
        setConnectionStatus('disconnected')
        wsRef.current = null
        // Auto-reconnect
        reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY)
      }

      ws.onerror = () => {
        ws.close()
      }

      wsRef.current = ws
    } catch {
      setConnectionStatus('disconnected')
      reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY)
    }
  }, [setConnectionStatus, handleWsEvent])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])
}
