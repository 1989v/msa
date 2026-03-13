// charting/frontend/src/App.tsx
import { useEffect, useState, useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { SymbolSearch } from './components/SymbolSearch'
import { IndicatorToggle, type Indicators } from './components/IndicatorToggle'
import { PatternSelector } from './components/PatternSelector'
import { PatternChart } from './components/PatternChart'
import { PatternInfoBar } from './components/PatternInfoBar'
import { fetchOhlcv, syncTicker } from './api'
import { PATTERNS } from './lib/patterns'
import { matchPatterns, type PatternMatch } from './lib/patternMatcher'

const DEFAULT_INDICATORS: Indicators = {
  ma5: true, ma20: true, ma60: false,
  bb: false, volume: true, rsi: false, macd: false,
}

export default function App() {
  const [ticker, setTicker] = useState('')
  const [indicators, setIndicators] = useState<Indicators>(DEFAULT_INDICATORS)
  const [patternMatches, setPatternMatches] = useState<PatternMatch[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<string>('')
  const queryClient = useQueryClient()

  const { data: ohlcv = [], isLoading } = useQuery({
    queryKey: ['ohlcv', ticker],
    queryFn: () => fetchOhlcv(ticker),
    enabled: !!ticker,
  })

  // Auto-sync on ticker change (TTL-based, backend decides freshness)
  useEffect(() => {
    if (!ticker) return
    let cancelled = false
    setSyncing(true)
    setSyncStatus('동기화 확인 중…')
    syncTicker(ticker)
      .then((res) => {
        if (cancelled) return
        if (res.synced) {
          setSyncStatus(`${res.bars_ingested}건 동기화 완료`)
          queryClient.invalidateQueries({ queryKey: ['ohlcv', ticker] })
        } else {
          setSyncStatus('최신 상태')
        }
      })
      .catch(() => { if (!cancelled) setSyncStatus('동기화 실패') })
      .finally(() => { if (!cancelled) setSyncing(false) })
    return () => { cancelled = true }
  }, [ticker])

  const handleForceSync = useCallback(() => {
    if (!ticker || syncing) return
    setSyncing(true)
    setSyncStatus('강제 동기화 중…')
    syncTicker(ticker, true)
      .then((res) => {
        if (res.synced) {
          setSyncStatus(`${res.bars_ingested}건 동기화 완료`)
          queryClient.invalidateQueries({ queryKey: ['ohlcv', ticker] })
        } else {
          setSyncStatus('변경 없음')
        }
      })
      .catch(() => setSyncStatus('동기화 실패'))
      .finally(() => setSyncing(false))
  }, [ticker, syncing, queryClient])

  // Auto-compute pattern matches when OHLCV data loads
  useEffect(() => {
    if (ohlcv.length >= 60) {
      const closes = ohlcv.map(b => Number(b.close))
      const matches = matchPatterns(closes, PATTERNS)
      setPatternMatches(matches)
      // Auto-select top match
      setSelectedIds(new Set(matches[0] ? [matches[0].pattern.id] : []))
    } else {
      setPatternMatches([])
      setSelectedIds(new Set())
    }
  }, [ohlcv])

  const handleTogglePattern = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectedMatches = useMemo(
    () => patternMatches.filter(m => selectedIds.has(m.pattern.id)),
    [patternMatches, selectedIds],
  )

  const selectedPatterns = useMemo(
    () => selectedMatches.map(m => m.pattern),
    [selectedMatches],
  )

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <header style={{ background: 'linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)', color: '#fff', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
        <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.5px' }}>Chart Pattern Analysis</span>
        {ticker && <span style={{ fontSize: 13, background: 'rgba(255,255,255,0.15)', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>{ticker}</span>}
        {isLoading && <span style={{ fontSize: 12, opacity: 0.7 }}>로딩 중…</span>}
        {ticker && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {syncStatus && <span style={{ fontSize: 11, opacity: 0.8 }}>{syncStatus}</span>}
            <button
              onClick={handleForceSync}
              disabled={syncing}
              style={{
                fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)',
                color: '#fff', cursor: syncing ? 'not-allowed' : 'pointer', opacity: syncing ? 0.5 : 1,
              }}
            >
              {syncing ? '동기화 중…' : '동기화'}
            </button>
          </div>
        )}
      </header>

      {/* Symbol Search */}
      <SymbolSearch onSelect={setTicker} selectedTicker={ticker} />

      {/* Pattern Selector (multi-select) */}
      <PatternSelector
        matches={patternMatches}
        selectedIds={selectedIds}
        onToggle={handleTogglePattern}
      />

      {/* Indicator Toggles */}
      <IndicatorToggle value={indicators} onChange={setIndicators} />

      {/* Main Chart */}
      <div style={{ paddingTop: 12 }}>
        <PatternChart
          ohlcv={ohlcv}
          patterns={selectedPatterns}
          indicators={indicators}
        />
      </div>

      {/* Pattern Info (all selected) */}
      <PatternInfoBar matches={selectedMatches} />
    </div>
  )
}
