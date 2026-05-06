import type { OhlcvBar } from '../api'
import { parseISO, getISOWeek, getISOWeekYear } from 'date-fns'

/** Group daily bars into weekly candles (ISO week, Mon-Fri) */
export function aggregateWeekly(bars: OhlcvBar[]): OhlcvBar[] {
  if (bars.length === 0) return []

  const groups = new Map<string, OhlcvBar[]>()
  for (const bar of bars) {
    const d = parseISO(bar.trade_date)
    const key = `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, '0')}`
    const group = groups.get(key)
    if (group) group.push(bar)
    else groups.set(key, [bar])
  }

  return Array.from(groups.values()).map(aggregateGroup)
}

/** Group daily bars into monthly candles */
export function aggregateMonthly(bars: OhlcvBar[]): OhlcvBar[] {
  if (bars.length === 0) return []

  const groups = new Map<string, OhlcvBar[]>()
  for (const bar of bars) {
    const key = bar.trade_date.slice(0, 7) // YYYY-MM
    const group = groups.get(key)
    if (group) group.push(bar)
    else groups.set(key, [bar])
  }

  return Array.from(groups.values()).map(aggregateGroup)
}

function aggregateGroup(group: OhlcvBar[]): OhlcvBar {
  return {
    trade_date: group[group.length - 1].trade_date,
    open: group[0].open,
    high: Math.max(...group.map(b => b.high)),
    low: Math.min(...group.map(b => b.low)),
    close: group[group.length - 1].close,
    volume: group.reduce((sum, b) => sum + b.volume, 0),
  }
}

/** Filter bars to those within the last N days from the most recent bar */
export function filterRecent(bars: OhlcvBar[], days: number): OhlcvBar[] {
  if (bars.length === 0) return []
  const latest = parseISO(bars[bars.length - 1].trade_date)
  const cutoff = new Date(latest.getTime() - days * 24 * 60 * 60 * 1000)
  return bars.filter(b => parseISO(b.trade_date) >= cutoff)
}
