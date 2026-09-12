// 진행 서버 동기화 — 플랫폼 세이브 API (`GET/PUT /api/v1/games/arena/save`, games/lib/platform.js 와 같은 계약).
// 회원은 Bearer 로, 게스트는 서버가 준 12자리 이어하기 코드로 식별한다. 로컬이 원본이고 서버는 기기 간 이어하기용:
// 서버 version 이 이 기기가 마지막으로 맞춘 version 보다 앞서면 서버본을 받는다(다른 기기가 더 놀았다).
import { onPlatform, authToken, SLUG } from './score.ts';
import { PROGRESS_KEY, sanitizeProgress, type Progress } from './progress.ts';

const VER_KEY = 'amp.progress.ver';
const CODE_KEY = 'amp.progress.code';
const DEVICE_KEY = 'kgd_device_id';

function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(DEVICE_KEY, id); }
    return id;
  } catch { return 'no-storage'; }
}
const localVer = (): number => { try { return Number(localStorage.getItem(VER_KEY)) || 0; } catch { return 0; } };
const localCode = (): string | null => { try { return localStorage.getItem(CODE_KEY); } catch { return null; } };
function remember(version: number, code: string | null | undefined): void {
  try { localStorage.setItem(VER_KEY, String(version)); if (code) localStorage.setItem(CODE_KEY, code); } catch { /* 없어도 다음에 다시 받는다 */ }
}

interface SaveState { data: Record<string, unknown> | null; version: number; code?: string | null }
async function api(path: string, init: RequestInit): Promise<SaveState | null> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-Device-Id': deviceId() };
  const token = authToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const r = await fetch(`/api/v1/games/${SLUG}${path}`, { ...init, headers });
    const b = (await r.json()) as { success?: boolean; data?: SaveState };
    if (!r.ok || !b || b.success === false || !b.data) return null;
    return b.data;
  } catch { return null; }
}

/** 서버본이 이 기기보다 앞서 있으면 그 진행을 돌려준다 (없으면 null). 식별 수단이 없으면(게스트 첫 방문) 조용히 넘어간다 */
export async function pullProgress(local: Progress): Promise<Progress | null> {
  if (!onPlatform()) return null;
  const code = localCode();
  if (!authToken() && !code) return null;
  const s = await api(`/save${code ? `?code=${encodeURIComponent(code)}` : ''}`, { method: 'GET' });
  if (!s) return null;
  remember(s.version, s.code);
  const raw = s.data?.[PROGRESS_KEY];
  if (typeof raw !== 'string') return null;
  const server = sanitizeProgress(JSON.parse(raw));
  const localEmpty = local.matches === 0 && local.xp === 0 && local.gold === 0;
  return localEmpty || s.version > localVer() ? server : null;
}

let timer: ReturnType<typeof setTimeout> | null = null;
/** 저장은 600ms 뒤에 한 번 — 연속 조작을 한 번의 PUT 으로. 실패해도 로컬은 이미 저장돼 있다 */
export function pushProgress(p: Progress): void {
  if (!onPlatform()) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void api('/save', { method: 'PUT', body: JSON.stringify({ data: { [PROGRESS_KEY]: JSON.stringify(p) }, version: localVer(), code: localCode() }) })
      .then((s) => { if (s) remember(s.version, s.code); });
  }, 600);
}
