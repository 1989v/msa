/**
 * 통합 셸 공유 axios 클라이언트 (ADR-0058 R3 FE 통합).
 *
 * 흡수될 sub-app(admin/quant/gifticon/agent-viewer)들이 각자 axios 인스턴스를 만드는 대신
 * 이 클라이언트를 import 해서 쓴다 — 401 처리를 셸이 일원화. 인증은 세션 쿠키가 싣는다(ADR-0101).
 * baseURL 은 VITE_API_URL(기본: 상대경로 '' → ingress 가 /api 를 게이트웨이로 프록시).
 */
import axios from 'axios';
import { clearLocalSession } from '../auth/auth';
import { buildLoginHref } from '../auth/auth';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      clearLocalSession();
      if (window.location.pathname !== '/login') {
        window.location.href = buildLoginHref();
      }
    }
    return Promise.reject(error);
  },
);
