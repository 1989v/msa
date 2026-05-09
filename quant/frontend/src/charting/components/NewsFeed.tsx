// charting/components/NewsFeed.tsx — ADR-0041 뉴스/공시 feed.
import { ExternalLink } from 'lucide-react'
import type { NewsItem } from '@/charting/hooks/useNews'

interface Props {
  items: NewsItem[]
  loading?: boolean
  error?: boolean
}

export function NewsFeed({ items, loading, error }: Props) {
  if (loading) {
    return (
      <p
        className="py-6 text-center text-sm"
        style={{ color: 'var(--ko-text-muted)' }}
      >
        뉴스 불러오는 중…
      </p>
    )
  }
  if (error) {
    return (
      <p
        className="py-6 text-center text-sm"
        style={{ color: 'var(--ko-text-muted)' }}
      >
        뉴스 불러오기 실패 (외부 source 응답 없음).
      </p>
    )
  }
  if (items.length === 0) {
    return (
      <p
        className="py-6 text-center text-sm"
        style={{ color: 'var(--ko-text-muted)' }}
      >
        뉴스가 없습니다.
      </p>
    )
  }

  return (
    <ul
      className="divide-y"
      style={{ borderColor: 'var(--ko-border-subtle)' }}
    >
      {items.map(item => (
        <li key={item.url}>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block py-3 px-2 transition-colors hover:brightness-110"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div
                  className="text-sm font-medium leading-snug"
                  style={{ color: 'var(--ko-text-primary)' }}
                >
                  {item.title}
                </div>
                {item.summary && (
                  <div
                    className="mt-1 text-xs leading-snug"
                    style={{
                      color: 'var(--ko-text-muted)',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical' as const,
                      overflow: 'hidden',
                    }}
                  >
                    {item.summary}
                  </div>
                )}
                <div
                  className="mt-1.5 text-[11px] flex items-center gap-1.5"
                  style={{ color: 'var(--ko-text-muted)' }}
                >
                  <span>{item.source}</span>
                  <span>·</span>
                  <span>{formatRelative(item.publishedAt)}</span>
                  {item.kind === 'DISCLOSURE' && (
                    <span
                      className="ml-1 px-1 rounded text-[10px]"
                      style={{
                        background:
                          'color-mix(in oklch, var(--ko-status-warning) 18%, transparent)',
                        color: 'var(--ko-status-warning)',
                      }}
                    >
                      공시
                    </span>
                  )}
                </div>
              </div>
              <ExternalLink
                className="w-3.5 h-3.5 shrink-0 mt-0.5"
                style={{ color: 'var(--ko-text-muted)' }}
                aria-hidden="true"
              />
            </div>
          </a>
        </li>
      ))}
    </ul>
  )
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return iso
  const diff = Date.now() - t
  const min = Math.floor(diff / 60_000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}일 전`
  return new Date(iso).toLocaleDateString('ko-KR')
}
