/**
 * 액세스 토큰 재발급 — **앱 전체가 이 하나를 공유한다.**
 *
 * 액세스 토큰은 1시간이고 토큰 쿠키는 30일 산다(`auth.ts`). `isLoggedIn()` 은 쿠키
 * 존재만 보므로, 재발급이 없는 API 모듈은 로그인 한 시간 뒤부터 **화면은 로그인 상태인데
 * 호출만 전부 401** 이 된다 (2026-08-29 찜 목록이 이 상태였다).
 */
import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { getRefreshToken, updateTokens } from './auth';

// VITE_API_URL 이 빈 문자열이면 same-origin relative path (운영 / K8s ingress 경유).
const BASE_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8089';

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

interface RefreshResponse {
  success: boolean;
  data: { accessToken: string; refreshToken: string } | null;
  error: { code: string; message: string } | null;
}

/**
 * 진행 중인 재발급 — 모듈이 아니라 **앱에 하나**다.
 *
 * 서버는 재발급 때 리프레시 토큰을 회전시키고 옛 것을 즉시 폐기한다(auth 의 refresh).
 * API 모듈마다 가드를 따로 두면 같은 화면의 동시 401 이 두 번의 재발급으로 갈리고,
 * 뒤늦은 쪽이 이미 폐기된 토큰을 보내 실패한다 — 성공한 재발급이 로그아웃으로 뒤집힌다
 * (상품 상세에는 하트가 함께 있어 shop 호출과 찜 호출이 같이 401 이 된다).
 */
let inFlight: Promise<boolean> | null = null;

export function refreshAccessToken(): Promise<boolean> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;
    try {
      // 인터셉터 루프 방지를 위해 인스턴스가 아닌 bare axios 사용
      const res = await axios.post<RefreshResponse>(`${BASE_URL}/api/auth/refresh`, { refreshToken });
      if (res.data.success && res.data.data) {
        updateTokens(res.data.data.accessToken, res.data.data.refreshToken);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/**
 * 401 을 만나면 한 번 재발급하고 그 요청을 재시도한다.
 *
 * 재발급이 실패해도 **세션을 지우지 않고 그대로 거절한다** — 네트워크 오류도 실패로
 * 오므로 여기서 로그아웃시키면 잠깐 끊긴 것이 멀쩡한 세션을 날린다. 로그인 화면으로
 * 보낼지는 그 화면의 정책이라 호출 측 인터셉터가 정한다.
 */
export function attachRefreshRetry(instance: AxiosInstance): void {
  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const config = error.config as RetriableConfig | undefined;
      if (error.response?.status === 401 && config && !config._retry) {
        config._retry = true;
        if (await refreshAccessToken()) return instance(config);
      }
      return Promise.reject(error);
    },
  );
}
