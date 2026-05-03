import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiClient, unwrap, toApiError } from '@/api/client'

interface IndicatorContent {
  id: string
  slug: string
  title: string
  category: string
  summary: string
  bodyMarkdown: string
  formulaTeX: string | null
  examples: Array<{
    label: string
    assetCode: string
    periodStart: string
    periodEnd: string
    description: string
  }>
}

/**
 * LearnDetailPage — /quant/learn/:slug (ADR-0033 Phase 1).
 *
 * Markdown 본문 + 수식 표시. KaTeX 통합은 Phase 1 후반 (현재는 raw text).
 */
export function LearnDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const q = useQuery({
    queryKey: ['learn-indicator', slug],
    enabled: !!slug,
    queryFn: async () => {
      const res = await apiClient.get<{ data: IndicatorContent }>(
        `/api/v1/learn/indicators/${slug}`
      )
      return unwrap(res)
    },
  })

  if (q.isLoading) return <div className="p-4">로딩...</div>
  if (q.isError)
    return (
      <div className="p-4 text-red-500 space-y-2">
        <div>에러: {toApiError(q.error).message}</div>
        <Link to="/learn" className="text-blue-500 underline">
          ← 카탈로그로
        </Link>
      </div>
    )
  if (!q.data) return <div className="p-4">콘텐츠를 찾을 수 없습니다.</div>

  const c = q.data
  return (
    <div className="p-4 space-y-4">
      <Link to="/learn" className="text-sm text-blue-500 underline">
        ← 카탈로그로
      </Link>
      <h1 className="text-2xl font-bold">{c.title}</h1>
      <div className="text-sm text-zinc-500">
        {c.category} · {c.summary}
      </div>

      <article className="prose prose-sm max-w-none whitespace-pre-wrap">
        {c.bodyMarkdown}
      </article>

      {c.formulaTeX && (
        <section>
          <h2 className="text-lg font-semibold">공식</h2>
          <pre className="bg-zinc-100 dark:bg-zinc-800 p-2 rounded text-sm">
            {c.formulaTeX}
          </pre>
        </section>
      )}

      {c.examples.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">예제</h2>
          <ul className="space-y-1 text-sm">
            {c.examples.map((ex, i) => (
              <li key={i}>
                <strong>{ex.label}</strong> — {ex.assetCode} ({ex.periodStart} ~ {ex.periodEnd}): {ex.description}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
