// 게임 플랫폼 기록 연동 (2026-09-12). 판이 끝나면 내 결과를 `POST /api/v1/games/arena/scores` 로 보낸다.
// 플레이 세션(`/sessions`)은 카탈로그 상세 페이지(IFRAME 호스트)가 열고 닫으므로 게임은 손대지 않는다 — 여기서 또 열면 두 번 센다.
// 보드는 둘: `online`(사람과 붙은 판) · `practice`(봇 연습). 한 보드에 섞으면 봇 연습 점수가 순위를 덮는다.
// 로그인 토큰은 `.1989v.com` 쿠키(`portal_access_token`, games/lib/auth.js 와 같은 자리)에서 읽어 Bearer 로 싣는다 — 있으면 회원 기록으로 묶인다.
import type { RankEntry } from '@amp/shared';

export const SLUG = 'arena';
export type ScoreBoard = 'online' | 'practice';

export interface ScoreRequest { nickname: string; score: number; detail: string; board: ScoreBoard }
export interface ScoreResult { applied: boolean; rank: number }

/** 한 판의 점수: KO 100 · 준 데미지 1 · 승리 50. 닉네임당 최고 기록 한 줄이 남는다 */
export function matchScore(me: RankEntry): number {
  return me.kos * 100 + Math.max(0, Math.round(me.dmg)) + (me.win ? 50 : 0);
}

export function buildScoreRequest(me: RankEntry, board: ScoreBoard, mapName: string, modeName: string, players: number): ScoreRequest {
  return {
    nickname: me.name,
    score: matchScore(me),
    detail: `${me.rank}위/${players}명 · ${me.kos}KO · ${me.dmg}dmg · ${mapName} ${modeName}`,
    board,
  };
}

/** 플랫폼 위에서 도는가 — 카탈로그가 게임을 `/games/arena/` 에 둔다. 개발 서버(`/`)에서는 보내지 않는다 */
export function onPlatform(): boolean {
  return location.pathname.startsWith('/games/');
}

export function authToken(): string | null {
  const prefix = 'portal_access_token=';
  const hit = document.cookie.split('; ').find((c) => c.startsWith(prefix));
  return hit ? decodeURIComponent(hit.slice(prefix.length)) : null;
}

/** 다른 게임들이 쓰는 플랫폼 닉네임(`game_nickname`) — 처음 오는 사람의 빈칸을 채운다 */
export function platformNickname(): string | null {
  try { return localStorage.getItem('game_nickname'); } catch { return null; }
}

export async function submitScore(req: ScoreRequest): Promise<ScoreResult | null> {
  if (!onPlatform() || !(req.score > 0)) return null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = authToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const r = await fetch(`/api/v1/games/${SLUG}/scores`, { method: 'POST', headers, body: JSON.stringify(req) });
    const b = (await r.json()) as { success?: boolean; data?: ScoreResult };
    if (!r.ok || !b || b.success === false || !b.data) return null;
    return b.data;
  } catch {
    return null;
  }
}

export function scoreNote(board: ScoreBoard, score: number, r: ScoreResult | null): string {
  const label = board === 'online' ? '온라인' : '연습';
  if (!r) return `${label} 기록 ${score}점 · 순위표에 못 올렸습니다`;
  return r.applied ? `${label} 순위표 ${r.rank}위 · ${score}점 (새 기록)` : `${label} 순위표 ${r.rank}위 · ${score}점 (최고 기록 유지)`;
}
