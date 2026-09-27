import type { AxiosRequestConfig } from 'axios';
import { gameHttp } from './gameApi';

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
  const response = await gameHttp.put<ProfileResponse>('/api/v1/games/profile/me', { nickname }, config);
  return unwrap(response.data, false)!;
}
