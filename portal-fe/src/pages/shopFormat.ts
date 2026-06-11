/** 쇼핑 페이지 공용 포매터 — 가격(₩) / 일시(YYYY.MM.DD HH:mm) */

export function formatWon(value: string | number): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) return `₩${value}`;
  return `₩${n.toLocaleString('ko-KR')}`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
