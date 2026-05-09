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

    const onOpen = () => {
      setState(s => ({ ...s, connected: true, error: null }))
    }
    const onTick = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as PriceTickPayload
        setState(s => ({ ...s, tick: data, connected: true, error: null }))
      } catch {
        /* ignore malformed */
      }
    }
    const onError = () => {
      setState(s => ({ ...s, connected: false, error: 'sse disconnected' }))
      // EventSource 자체 자동 reconnect — 추가 처리 불필요
    }

    es.addEventListener('open', onOpen)
    es.addEventListener('tick', onTick as EventListener)
    es.addEventListener('error', onError)

    return () => {
      es.removeEventListener('open', onOpen)
      es.removeEventListener('tick', onTick as EventListener)
      es.removeEventListener('error', onError)
      es.close()
      if (sourceRef.current === es) sourceRef.current = null
    }
  }, [asset, market])

  return state
}
