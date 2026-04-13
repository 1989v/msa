import { apiClient } from './client';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
const KAKAO_CLIENT_ID = import.meta.env.VITE_KAKAO_CLIENT_ID ?? '';

export const OAUTH_REDIRECT_URI = window.location.origin + '/admin/oauth/callback';

export function getGoogleOAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: OAUTH_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    state: 'google',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function getKakaoOAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: KAKAO_CLIENT_ID,
    redirect_uri: OAUTH_REDIRECT_URI,
    response_type: 'code',
    state: 'kakao',
  });
  return `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  memberId: number;
  isNewMember: boolean;
}

export async function loginWithOAuth(provider: string, authCode: string): Promise<LoginResult> {
  const { data } = await apiClient.post<{ data: LoginResult }>(`/api/auth/login/${provider}`, {
    authCode,
    redirectUri: OAUTH_REDIRECT_URI,
  });
  return data.data;
}
