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

/**
 * 방금 실패한 리프레시 토큰 — 같은 것으로는 잠시 다시 시도하지 않는다.
 *
 * 죽은 세션은 화면에 뜬 호출 수만큼 재발급을 시도한다. 하트·목록·상세가 각자 401 을
 * 받으므로 auth 로 가는 요청이 사용자 수가 아니라 **위젯 수**를 따라간다. 다시 로그인해
 * 토큰이 바뀌면 그 즉시 풀리므로, 창을 길게 잡아 정상 복구를 늦출 이유는 없다.
 */
const FAILURE_COOLDOWN_MS = 30_000;
let lastFailure: { token: string; at: number } | null = null;

export function refreshAccessToken(): Promise<boolean> {
  if (inFlight) return inFlight;

  const refreshToken = getRefreshToken();
  if (!refreshToken) return Promise.resolve(false);
  if (lastFailure?.token === refreshToken && Date.now() - lastFailure.at < FAILURE_COOLDOWN_MS) {
    return Promise.resolve(false);
  }

  inFlight = (async () => {
    try {
      // 인터셉터 루프 방지를 위해 인스턴스가 아닌 bare axios 사용
      const res = await axios.post<RefreshResponse>(`${BASE_URL}/api/auth/refresh`, { refreshToken });
      if (res.data.success && res.data.data) {
        updateTokens(res.data.data.accessToken, res.data.data.refreshToken);
        lastFailure = null;
        return true;
      }
      lastFailure = { token: refreshToken, at: Date.now() };
      return false;
    } catch {
      lastFailure = { token: refreshToken, at: Date.now() };
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
