import type { PlaceLang } from '../../api/placeApi';

/** 발표 시각 `yyyy-MM-ddTHH:mm` → 「10월 2일 17:00」 · 「Oct 2, 17:00」. */
export function issuedAt(at: string, lang: PlaceLang): string {
  const [date, time] = at.split('T');
  const [, m, d] = date.split('-').map(Number);
  const hm = (time ?? '').slice(0, 5);
  if (lang === 'ko') return `${m}월 ${d}일 ${hm}`;
  const month = new Date(Date.UTC(2000, m - 1, 1)).toLocaleDateString('en', { month: 'short', timeZone: 'UTC' });
  return `${month} ${d}, ${hm}`;
}
