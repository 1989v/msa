const REDIRECT_URI = window.location.origin + '/admin/oauth/callback';

export function getGoogleOAuthUrl(): string {
  const params = new URLSearchParams({
    redirect_uri: REDIRECT_URI,
  });
  return `/oauth2/authorization/google?${params.toString()}`;
}

export function getKakaoOAuthUrl(): string {
  const params = new URLSearchParams({
    redirect_uri: REDIRECT_URI,
  });
  return `/oauth2/authorization/kakao?${params.toString()}`;
}
