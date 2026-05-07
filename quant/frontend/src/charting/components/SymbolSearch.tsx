import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchSymbols, type AssetClass, type Symbol } from '../api'
import { Search, Bitcoin, TrendingUp, DollarSign } from 'lucide-react'

interface Props {
  onSelect: (symbol: Symbol) => void
  selectedTicker: string
}

type Tab = 'ALL' | AssetClass

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'ALL', label: '전체' },
  { key: 'CRYPTO', label: '코인' },
  { key: 'STOCK_KR', label: '국내주식' },
  { key: 'STOCK_US', label: '미국주식' },
]

const iconFor = (a: AssetClass) =>
  a === 'CRYPTO' ? Bitcoin : a === 'STOCK_KR' ? TrendingUp : DollarSign

export function SymbolSearch({ onSelect, selectedTicker }: Props) {
  const [tab, setTab] = useState<Tab>('ALL')
  const [query, setQuery] = useState('')

  const { data: symbols = [], isLoading } = useQuery({
    queryKey: ['symbols'],
    queryFn: fetchSymbols,
  })

  const filtered = symbols.filter((s) => {
    const matchTab = tab === 'ALL' || s.assetClass === tab
    const q = query.trim().toLowerCase()
    const matchQuery = !q || s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    return matchTab && matchQuery
  })

  return (
    <div className="space-y-3">
      {/* 자산군 탭 — 가로 스크롤 (모바일) */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              tab === t.key
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'bg-slate-800/40 text-slate-400 border border-slate-700/50 hover:bg-slate-700/50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 검색 입력 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          inputMode="search"
          enterKeyHint="search"
          placeholder="종목명·티커 검색..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-10 pr-3 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        />
      </div>

      {/* 종목 그리드 — 모바일 1col / sm 2col / lg 3col */}
      {isLoading ? (
        <p className="text-sm text-slate-500">Loading symbols…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-6">검색 결과가 없습니다</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[320px] overflow-y-auto pr-1">
          {filtered.map((s) => {
            const Icon = iconFor(s.assetClass)
            const selected = selectedTicker === s.ticker
            return (
              <button
                key={`${s.assetClass}-${s.ticker}`}
                onClick={() => onSelect(s)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all duration-200 active:scale-[0.98] ${
                  selected
                    ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 ring-1 ring-emerald-500/30'
                    : 'bg-slate-800/40 border border-slate-700/50 text-slate-300 hover:bg-slate-700/50 hover:border-slate-600'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0 opacity-80" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">{s.name}</p>
                  <p className="text-[11px] text-slate-500 truncate">{s.ticker}</p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
