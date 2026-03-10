import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchSymbols } from '../api'

interface Props {
  onSelect: (ticker: string) => void
  selectedTicker: string
}

export function SymbolSearch({ onSelect, selectedTicker }: Props) {
  const [market, setMarket] = useState<'ALL' | 'US' | 'KR'>('ALL')

  const { data: symbols = [], isLoading } = useQuery({
    queryKey: ['symbols'],
    queryFn: fetchSymbols,
  })

  const filtered = symbols.filter((s) => market === 'ALL' || s.market === market)

  return (
    <div style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>
      <div style={{ marginBottom: '8px' }}>
        {(['ALL', 'US', 'KR'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMarket(m)}
            style={{
              marginRight: '6px',
              padding: '4px 12px',
              background: market === m ? '#2563eb' : '#f3f4f6',
              color: market === m ? '#fff' : '#374151',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {m}
          </button>
        ))}
      </div>
      {isLoading ? (
        <p>Loading symbols…</p>
      ) : (
        <select
          value={selectedTicker}
          onChange={(e) => onSelect(e.target.value)}
          style={{ width: '100%', padding: '8px', fontSize: '14px' }}
        >
          <option value="">— Select a symbol —</option>
          {filtered.map((s) => (
            <option key={s.ticker} value={s.ticker}>
              {s.ticker} — {s.name}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
