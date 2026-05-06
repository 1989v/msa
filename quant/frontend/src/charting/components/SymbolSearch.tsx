import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchSymbols, type Symbol } from '../api'
import { Search, TrendingUp } from 'lucide-react'

interface Props {
  onSelect: (symbol: Symbol) => void
  selectedTicker: string
}

export function SymbolSearch({ onSelect, selectedTicker }: Props) {
  const [market, setMarket] = useState<'ALL' | 'US' | 'KR'>('ALL')
  const [query, setQuery] = useState('')

  const { data: symbols = [], isLoading } = useQuery({
    queryKey: ['symbols'],
    queryFn: fetchSymbols,
  })

  const filtered = symbols.filter((s) => {
    const matchMarket = market === 'ALL' || s.market === market
    const matchQuery = !query || s.ticker.toLowerCase().includes(query.toLowerCase()) || s.name.toLowerCase().includes(query.toLowerCase())
    return matchMarket && matchQuery
  })

  return (
    <div className="space-y-3">
      {/* Market filter pills */}
      <div className="flex gap-1.5">
        {(['ALL', 'US', 'KR'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMarket(m)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              market === m
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-slate-800/40 text-slate-400 border border-slate-700/50 hover:bg-slate-700/50'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="종목 검색..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-10 pr-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
        />
      </div>

      {/* Symbol grid */}
      {isLoading ? (
        <p className="text-sm text-slate-500">Loading symbols…</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 max-h-[280px] overflow-y-auto pr-1">
          {filtered.map((s) => (
            <button
              key={s.ticker}
              onClick={() => onSelect(s)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-all duration-200 ${
                selectedTicker === s.ticker
                  ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400'
                  : 'bg-slate-800/40 border border-slate-700/50 text-slate-300 hover:bg-slate-700/50 hover:border-slate-600'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">
                  {s.market === 'KR' ? `${s.name}` : s.ticker}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {s.market === 'KR' ? s.ticker.replace('.KS', '').replace('.KQ', '') : s.name}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
