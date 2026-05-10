// charting/hooks/usePriceStream.ts
//
// 실시간 가격 SSE 구독 — TG-14.
// 백엔드: GET /api/v1/charts/stream/{asset}/{market}
// Events: hello (connection ack), tick (price), :heartbeat
//
// EventSource 자동 reconnect 사용. last-id 기반 복구는 후속 PR.
import { useEffect, useRef, useState } from 'react'

export interface PriceTickPayload {
  asset: string
  market: string
  /** 가격 — 백엔드는 plain string. 호출자가 parseFloat. */
  price: string
  volume?: string | null
  /** ISO-8601. */
  ts: string
}

interface State {
  tick: PriceTickPayload | null
  connected: boolean
  error: string | null
}

/** SSE tick → React state update 최소 간격 (ms). Bithumb 호가가 sub-second 로
 *  들어와 매번 setState 시 시각적 jitter — 300ms throttle 로 안정화. */
const TICK_THROTTLE_MS = 300

export function usePriceStream(
  asset: string | null | undefined,
  market: string | null | undefined,
): State {
  const [state, setState] = useState<State>({
    tick: null,
    connected: false,
    error: null,
  })
  const sourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!asset || !market) {
      sourceRef.current?.close()
      sourceRef.current = null
      setState({ tick: null, connected: false, error: null })
      return
    }

    const url = `/api/v1/charts/stream/${encodeURIComponent(asset)}/${encodeURIComponent(market)}`
    const es = new EventSource(url)
    sourceRef.current = es

    let lastCommitAt = 0
    let pendingTick: PriceTickPayload | null = null
    let pendingTimer: number | null = null

    const commit = () => {
      if (pendingTick) {
        const data = pendingTick
        pendingTick = null
        lastCommitAt = Date.now()
        setState(s => ({ ...s, tick: data, connected: true, error: null }))
      }
      pendingTimer = null
    }

    const onOpen = () => {
      setState(s => ({ ...s, connected: true, error: null }))
    }
    const onTick = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as PriceTickPayload
        pendingTick = data
        const elapsed = Date.now() - lastCommitAt
        if (elapsed >= TICK_THROTTLE_MS) {
          if (pendingTimer != null) {
            window.clearTimeout(pendingTimer)
            pendingTimer = null
          }
          commit()
        } else if (pendingTimer == null) {
          pendingTimer = window.setTimeout(commit, TICK_THROTTLE_MS - elapsed)
        }
      } catch {
        /* ignore malformed */
      }
    }
    const onError = () => {
      setState(s => ({ ...s, connected: false, error: 'sse disconnected' }))
    }

    es.addEventListener('open', onOpen)
    es.addEventListener('tick', onTick as EventListener)
    es.addEventListener('error', onError)

    return () => {
      if (pendingTimer != null) window.clearTimeout(pendingTimer)
      es.removeEventListener('open', onOpen)
      es.removeEventListener('tick', onTick as EventListener)
      es.removeEventListener('error', onError)
      es.close()
      if (sourceRef.current === es) sourceRef.current = null
    }
  }, [asset, market])

  return state
}
