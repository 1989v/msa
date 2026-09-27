import type { AxiosRequestConfig } from 'axios';
import { gameHttp } from './gameApi';
import { getUserId } from '../auth/auth';
import { refreshAccessToken } from '../auth/refresh';

export interface GamePlayerProfile { playerId: string; nickname: string }
interface ProfileResponse { success: boolean; data: GamePlayerProfile | null; error?: { message?: string } }

function unwrap(body: ProfileResponse, allowNull: boolean): GamePlayerProfile | null {
  if (!body || !body.success || body.data === undefined || (!allowNull && !body.data) ||
      (body.data != null && (typeof body.data.playerId !== 'string' || typeof body.data.nickname !== 'string'))) {
    throw new Error(body?.error?.message ?? '게임 프로필을 불러오지 못했습니다.');
  }
  return body.data;
}
export async function fetchGameProfile(): Promise<GamePlayerProfile | null> {
  const response = await gameHttp.get<ProfileResponse>('/api/v1/games/profile/me', { withCredentials: true });
  return unwrap(response.data, true);
}
export async function updateGameProfile(nickname: string): Promise<GamePlayerProfile> {
  // A delayed 401 must not replay this mutation with a newly signed-in account.
  // attachRefreshRetry treats _retry as terminal. The server owns HttpOnly
  // session cookies; require an explicit new save after a failed PUT.
  const config: AxiosRequestConfig & { _retry: true } = { withCredentials: true, _retry: true };
  const member = getUserId();
  let sessionChanged = false;
  const changed = () => { sessionChanged = true; };
  const storageChanged = (event: StorageEvent) => { if (event.key === 'portal_auth_revision') changed(); };
  window.addEventListener('portal-auth-changed', changed);
  window.addEventListener('storage', storageChanged);
  try {
    const response = await gameHttp.put<ProfileResponse>('/api/v1/games/profile/me', { nickname }, config);
    return unwrap(response.data, false)!;
  } catch (error) {
    if ((error as { response?: { status?: number } })?.response?.status === 401 &&
        member != null && member === getUserId() && !sessionChanged) {
      const refreshed = await refreshAccessToken();
      if (member !== getUserId() || sessionChanged) throw new Error('계정이 변경되었습니다. 다시 시도해 주세요.');
      if (refreshed) throw new Error('로그인 세션을 갱신했습니다. 다시 저장해 주세요.');
    }
    throw error;
  } finally {
    window.removeEventListener('portal-auth-changed', changed);
    window.removeEventListener('storage', storageChanged);
  }
}
