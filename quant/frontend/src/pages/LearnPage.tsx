import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiClient, unwrap, toApiError } from '@/api/client'
import type { ApiResponse } from '@/types/api'

interface IndicatorContent {
  id: string
  slug: string
  title: string
  category: string
  summary: string
  publishedAt: string | null
}

/**
 * LearnPage — /quant/learn (ADR-0033 Phase 1).
 *
 * 입문자 지표 학습 카탈로그. 카테고리별 그룹핑 + 슬러그 상세 링크.
 */
export function LearnPage() {
  const q = useQuery({
    queryKey: ['learn-indicators'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<IndicatorContent[]>>(
        '/api/v1/learn/indicators'
      )
      return unwrap(res)
    },
  })

  if (q.isLoading) return <div className="p-4">로딩...</div>
  if (q.isError)
    return (
      <div className="p-4 text-red-500">
        에러: {toApiError(q.error).message}
      </div>
    )

  const items = q.data ?? []
  const grouped = items.reduce<Record<string, IndicatorContent[]>>((acc, item) => {
    ;(acc[item.category] ??= []).push(item)
    return acc
  }, {})

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold">지표 학습</h1>
      <p className="text-sm text-zinc-500">
        주식·암호화폐 차트에서 자주 쓰이는 기술적 지표를 정의·공식·예제와 함께 학습합니다.
      </p>

      {Object.keys(grouped).length === 0 && (
        <p className="text-zinc-500">아직 게시된 지표 콘텐츠가 없습니다.</p>
      )}

      {Object.entries(grouped).map(([category, list]) => (
        <section key={category}>
          <h2 className="text-lg font-semibold mb-2">{category}</h2>
          <ul className="space-y-2">
            {list.map((item) => (
              <li key={item.id}>
                <Link
                  to={`/learn/${item.slug}`}
                  className="block p-3 rounded border hover:bg-zinc-50"
                >
                  <div className="font-medium">{item.title}</div>
                  <div className="text-sm text-zinc-500">{item.summary}</div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
