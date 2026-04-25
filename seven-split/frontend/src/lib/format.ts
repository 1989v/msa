/**
 * 숫자/날짜/PnL 포매터.
 * - BigDecimal 은 백엔드에서 string 으로 직렬화 — string 그대로 받아 포매팅
 * - 한글 천단위 콤마 + tabular-nums 보장
 */

const KRW_FORMATTER = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 0,
})

const NUMBER_FORMATTER = new Intl.NumberFormat('ko-KR', {
  maximumFractionDigits: 4,
})

const PERCENT_FORMATTER = new Intl.NumberFormat('ko-KR', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const DATETIME_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

const DATE_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** 정수/실수를 KRW 통화로 (BigDecimal string 포함) */
export function formatKrw(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-'
  const num = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(num)) return '-'
  return KRW_FORMATTER.format(num)
}

/** 일반 숫자 (천단위 콤마) */
export function formatNumber(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-'
  const num = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(num)) return '-'
  return NUMBER_FORMATTER.format(num)
}

/** 백엔드 percentValue: -3.0 (=-3%) → "-3.00%" */
export function formatPercent(value: string | number | null | undefined, fractionDigits = 2): string {
  if (value === null || value === undefined || value === '') return '-'
  const num = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(num)) return '-'
  // value 는 이미 % 단위 (예: -3.0) — 100 으로 나누지 않음
  return `${num.toFixed(fractionDigits)}%`
}

/** ratio (예: 0.0532) → "+5.32%" */
export function formatRatioAsPercent(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-'
  const num = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(num)) return '-'
  const sign = num > 0 ? '+' : ''
  return `${sign}${PERCENT_FORMATTER.format(num)}`
}

/** PnL 의 부호별 색상 클래스 (한국 관습: 양수=빨강, 음수=파랑) */
export function pnlColorClass(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'text-pnl-neutral'
  const num = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(num) || num === 0) return 'text-pnl-neutral'
  return num > 0 ? 'text-pnl-up' : 'text-pnl-down'
}

/** PnL 부호 prefix ('+' / '-' / '') */
export function pnlSign(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return ''
  const num = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(num) || num === 0) return ''
  return num > 0 ? '+' : ''
}

/** ISO-8601 → "2026-04-24 18:30" */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '-'
  return DATETIME_FORMATTER.format(date)
}

/** ISO-8601 → "2026-04-24" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '-'
  return DATE_FORMATTER.format(date)
}

/** 두 ISO 사이 일수 (정수) */
export function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso).getTime()
  const b = new Date(toIso).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return Math.max(0, Math.round((b - a) / (1000 * 60 * 60 * 24)))
}

/** 거래쌍 표시: BTC_KRW → "BTC/KRW" */
export function formatSymbol(symbol: string): string {
  return symbol.replace('_', '/')
}
