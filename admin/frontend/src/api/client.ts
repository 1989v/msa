import axios from 'axios';

const TOKEN_KEY = 'admin_token';
const LOGIN_PATH = '/login';

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

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // 만료·위조·역할 박탈 등 서버가 거부한 토큰은 즉시 버리고 로그인으로 되돌린다.
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      if (window.location.pathname !== LOGIN_PATH) {
        window.location.href = LOGIN_PATH;
      }
      return Promise.reject(error);
    }

    // 타임아웃·네트워크 단절은 조회에 한해 한 번만 다시 시도한다. 쓰기는 재시도하지 않는다 —
    // 서버가 이미 처리했는데 응답만 못 받은 경우 중복 실행이 된다.
    const config = error.config as (typeof error.config & { _retried?: boolean }) | undefined;
    const method = config?.method?.toLowerCase() ?? '';
    const transient = error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK';
    if (config && !config._retried && transient && RETRY_ONCE_METHODS.has(method)) {
      config._retried = true;
      return apiClient(config);
    }

    return Promise.reject(error);
  }
);

export { TOKEN_KEY };
