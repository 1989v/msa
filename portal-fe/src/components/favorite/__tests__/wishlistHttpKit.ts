import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { wishlistHttp } from '../../../api/wishlistApi';

/** 한 요청에 대한 답 — `status` 가 400 이상이면 axios 가 던지는 오류로, `'network'` 면 응답 없는 오류로 바꾼다 */
export type Reply = { status: number; data?: unknown } | 'network';
export type Handler = (method: string, url: string, body: unknown) => Reply | undefined;

/**
 * 찜 API 의 실제 클라이언트에 어댑터만 바꿔 끼운다 — 404 를 가르는 판단이 API 모듈 안에 있어서,
 * 모듈을 통째로 목으로 바꾸면 그 판단을 건너뛴 채 초록이 된다.
 *
 * @returns 보낸 요청 목록(`GET /api/v1/...`)과 원복 함수
 */
export function installWishlistHttp(handler: Handler) {
  const original = wishlistHttp.defaults.adapter;
  const calls: string[] = [];
  wishlistHttp.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    const method = (config.method ?? 'get').toUpperCase();
    const url = config.url ?? '';
    calls.push(`${method} ${url}`);
    const body = typeof config.data === 'string' && config.data ? JSON.parse(config.data) : config.data;
    const reply = handler(method, url, body) ?? { status: 404, data: null };
    if (reply === 'network') throw new AxiosError('Network Error', 'ERR_NETWORK', config);
    const response = {
      status: reply.status,
      statusText: String(reply.status),
      headers: {},
      config,
      data:
        reply.status < 400
          ? { success: true, data: reply.data ?? null, error: null }
          : { success: false, data: null, error: { code: 'E', message: 'error' } },
    } as AxiosResponse;
    if (reply.status >= 400) {
      throw new AxiosError('failed', reply.status >= 500 ? 'ERR_BAD_RESPONSE' : 'ERR_BAD_REQUEST', config, null, response);
    }
    return response;
  };
  return {
    calls,
    restore: () => {
      wishlistHttp.defaults.adapter = original;
    },
  };
}

/** 토큰은 HttpOnly 라 JS 가 못 본다 — 로그인 여부는 표시 쿠키로 본다 (ADR-0101) */
export function setSession(memberId: string | null) {
  document.cookie = memberId ? `portal_user_id=${memberId}; Path=/` : 'portal_user_id=; Path=/; Max-Age=0';
}
