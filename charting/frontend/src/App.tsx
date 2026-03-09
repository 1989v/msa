// charting/frontend/src/App.tsx
import React, { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SymbolSearch } from './components/SymbolSearch'
import { IndicatorToggle, type Indicators } from './components/IndicatorToggle'
import { PatternSelector } from './components/PatternSelector'
import { PatternChart } from './components/PatternChart'
import { PatternInfoBar } from './components/PatternInfoBar'
import { fetchOhlcv } from './api'
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
  const [selectedPatternId, setSelectedPatternId] = useState<string>('')

  const { data: ohlcv = [], isLoading } = useQuery({
    queryKey: ['ohlcv', ticker],
    queryFn: () => fetchOhlcv(ticker),
    enabled: !!ticker,
  })

  // Auto-compute pattern matches when OHLCV data loads
  useEffect(() => {
    if (ohlcv.length >= 60) {
      const closes = ohlcv.map(b => Number(b.close))
      const matches = matchPatterns(closes, PATTERNS)
      setPatternMatches(matches)
      setSelectedPatternId(matches[0]?.pattern.id ?? '')
    } else {
      setPatternMatches([])
      setSelectedPatternId('')
    }
  }, [ohlcv])

  const selectedMatch = patternMatches.find(m => m.pattern.id === selectedPatternId) ?? null
  const selectedPattern = selectedMatch?.pattern ?? null

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <header style={{ background: 'linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)', color: '#fff', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
        <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.5px' }}>📊 Chart Pattern Analysis</span>
        {ticker && <span style={{ fontSize: 13, background: 'rgba(255,255,255,0.15)', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>{ticker}</span>}
        {isLoading && <span style={{ fontSize: 12, opacity: 0.7 }}>로딩 중…</span>}
      </header>

      {/* Symbol Search */}
      <SymbolSearch onSelect={setTicker} selectedTicker={ticker} />

      {/* Pattern Selector (only when data is ready) */}
      <PatternSelector
        matches={patternMatches}
        selectedId={selectedPatternId}
        onChange={setSelectedPatternId}
      />

      {/* Indicator Toggles */}
      <IndicatorToggle value={indicators} onChange={setIndicators} />

      {/* Main Chart */}
      <div style={{ paddingTop: 12 }}>
        <PatternChart
          ohlcv={ohlcv}
          pattern={selectedPattern}
          indicators={indicators}
        />
      </div>

      {/* Pattern Info */}
      <PatternInfoBar match={selectedMatch} />
    </div>
  )
}
