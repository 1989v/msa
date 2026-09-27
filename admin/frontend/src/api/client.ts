import axios from 'axios';
import { getDevAuthToken } from '@/lib/dev-auth';
import { refreshSession } from '@/lib/session';

export const LOGIN_PATH = '/login';

/**
 * axios 기본 타임아웃은 무한이다. 그대로 두면 느린 요청이 실패로도 바뀌지 않아
 * 화면이 "불러오는 중…" 에서 멈춘 것처럼 보이고, 전체 새로고침 말고는 복구 수단이 없다.
 *
 * 값의 근거 (2026-08-12 실측): 오리진은 130ms 안에 응답하고, 여기에 Cloudflare 구간이
 * 약 1초를 얹는다 — 국내 트래픽이 ICN 이 아니라 LAX 콜로로 라우팅되기 때문이다(존의
 * anycast 대역 문제로, 애플리케이션에서 고칠 수 없음). 정상 상한이 1.2초 남짓이므로
 * 5초면 콜드스타트까지 덮는다. 그보다 길게 잡으면 고장난 상태를 오래 붙들고 있게 된다.
 */
const REQUEST_TIMEOUT_MS = 5_000;

/** 콜드스타트는 대개 첫 요청만 느리다 — 조회는 한 번 더 시도해 본다. */
const RETRY_ONCE_METHODS = new Set(['get', 'head']);

export const apiClient = axios.create({
  baseURL: '',
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 운영은 HttpOnly 세션 쿠키가 같은 오리진 요청에 저절로 실린다(ADR-0101) — 헤더를 만들지 않는다.
// 헤더는 로컬 개발용 토큰에만 쓴다(게이트웨이는 헤더가 있으면 헤더를 먼저 본다).
apiClient.interceptors.request.use((config) => {
  const devToken = getDevAuthToken();
  if (devToken) {
    config.headers.Authorization = `Bearer ${devToken}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config as
      | (typeof error.config & { _retried?: boolean; _refreshed?: boolean })
      | undefined;

    // 액세스 토큰은 한 시간이라 먼저 한 번 재발급해 본다. 그래도 401 이면 로그인 화면으로 보낸다.
    if (error.response?.status === 401) {
      if (config && !config._refreshed) {
        config._refreshed = true;
        if (await refreshSession()) return apiClient(config);
      }
      if (window.location.pathname !== LOGIN_PATH) {
        window.location.href = LOGIN_PATH;
      }
      return Promise.reject(error);
    }

    // 타임아웃·네트워크 단절은 조회에 한해 한 번만 다시 시도한다. 쓰기는 재시도하지 않는다 —
    // 서버가 이미 처리했는데 응답만 못 받은 경우 중복 실행이 된다.
    const method = config?.method?.toLowerCase() ?? '';
    const transient = error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK';
    if (config && !config._retried && transient && RETRY_ONCE_METHODS.has(method)) {
      config._retried = true;
      return apiClient(config);
    }

    return Promise.reject(error);
  }
);

