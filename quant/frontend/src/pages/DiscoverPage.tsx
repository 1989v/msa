// pages/DiscoverPage.tsx — ADR-0042 PA 발견·트렌딩 화면.
//
// 토스 홈 (`/`) 벤치마크: 거래대금/상승/하락 ranking + 카테고리 + 글로벌 지수 마퀴.
// AI 분석은 제외 (사용자 결정).
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchRanking, fetchGlobalIndices, type RankingKind } from '@/api/discover'
import { RankingList } from '@/discover/components/RankingList'
import { IndicesMarquee } from '@/discover/components/IndicesMarquee'

const TABS: Array<{
  key: RankingKind
  label: string
  emphasize: 'turnover' | 'change' | 'volume'
}> = [
  { key: 'top-volume', label: '거래대금', emphasize: 'turnover' },
  { key: 'top-gainers', label: '급상승', emphasize: 'change' },
  { key: 'top-losers', label: '급하락', emphasize: 'change' },
]

const MARKETS: Array<{ key: string | undefined; label: string }> = [
  { key: undefined, label: '전체' },
  { key: 'YAHOO', label: '미국·코인' },
  { key: 'FDR_KR', label: '국내' },
]

export function DiscoverPage() {
  const [tab, setTab] = useState<RankingKind>('top-volume')
  const [marketFilter, setMarketFilter] = useState<string | undefined>(undefined)

  const rankingQ = useQuery({
    queryKey: ['discover-ranking', tab, marketFilter],
    queryFn: () => fetchRanking(tab, marketFilter, 30),
    staleTime: 1000 * 60 * 2, // 2분
  })

  const indicesQ = useQuery({
    queryKey: ['discover-global-indices'],
    queryFn: fetchGlobalIndices,
    staleTime: 1000 * 60 * 5,
  })

  const activeTab = TABS.find(t => t.key === tab)!

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: 'var(--ko-surface-0)',
        color: 'var(--ko-text-primary)',
      }}
    >
      {/* 글로벌 지수 마퀴 — sticky top */}
      <div className="sticky top-0 z-20">
        {indicesQ.data && <IndicesMarquee indices={indicesQ.data} />}
      </div>

      <header className="px-4 md:px-6 pt-5 pb-3">
        <h1
          className="text-2xl font-bold"
          style={{ color: 'var(--ko-text-primary)' }}
        >
          종목 발견
        </h1>
        <p
          className="text-sm mt-1"
          style={{ color: 'var(--ko-text-muted)' }}
        >
          거래대금 상위 / 급상승 / 급하락 랭킹
        </p>
      </header>

      {/* 시장 필터 */}
      <div className="px-4 md:px-6 mb-2 flex gap-2 overflow-x-auto scrollbar-hide">
        {MARKETS.map(m => {
          const active = m.key === marketFilter
          return (
            <button
              key={m.key ?? 'all'}
              type="button"
              onClick={() => setMarketFilter(m.key)}
              className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: active
                  ? 'color-mix(in oklch, var(--ko-accent-primary) 22%, transparent)'
                  : 'color-mix(in oklch, var(--ko-surface-2) 60%, transparent)',
                border: active
                  ? '1px solid color-mix(in oklch, var(--ko-accent-primary) 40%, transparent)'
                  : '1px solid var(--ko-border-subtle)',
                color: active
                  ? 'var(--ko-accent-primary-hover)'
                  : 'var(--ko-text-secondary)',
              }}
            >
              {m.label}
            </button>
          )
        })}
      </div>

      {/* 랭킹 탭 */}
      <div
        role="tablist"
        aria-label="랭킹 종류"
        className="px-4 md:px-6 mb-2 flex gap-1 overflow-x-auto scrollbar-hide"
      >
        {TABS.map(t => {
          const active = t.key === tab
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setTab(t.key)}
              className="shrink-0 px-4 py-2 text-sm font-medium rounded-lg transition-colors"
              style={{
                background: active
                  ? 'color-mix(in oklch, var(--ko-accent-primary) 22%, transparent)'
                  : 'transparent',
                border: active
                  ? '1px solid color-mix(in oklch, var(--ko-accent-primary) 40%, transparent)'
                  : '1px solid transparent',
                color: active
                  ? 'var(--ko-accent-primary-hover)'
                  : 'var(--ko-text-muted)',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {/* 랭킹 리스트 */}
      <section className="flex-1 px-4 md:px-6 pb-8">
        <div
          className="rounded-xl"
          style={{
            background: 'var(--ko-surface-1)',
            border: '1px solid var(--ko-border-subtle)',
          }}
        >
          {rankingQ.isError && (
            <p
              className="py-6 text-center text-sm"
              style={{ color: 'var(--ko-status-loss)' }}
            >
              랭킹 불러오기 실패
            </p>
          )}
          {!rankingQ.isError && (
            <RankingList
              rankings={rankingQ.data ?? []}
              emphasize={activeTab.emphasize}
              loading={rankingQ.isLoading}
            />
          )}
        </div>
      </section>
    </div>
  )
}
