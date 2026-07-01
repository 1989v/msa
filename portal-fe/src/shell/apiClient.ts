/**
 * 통합 셸 공유 axios 클라이언트 (ADR-0058 R3 FE 통합).
 *
 * 흡수될 sub-app(admin/quant/gifticon/agent-viewer)들이 각자 axios 인스턴스를 만드는 대신
 * 이 클라이언트를 import 해서 쓴다 — 인증 인터셉터(Bearer 주입 + 401 처리)를 셸이 일원화.
 * baseURL 은 VITE_API_URL(기본: 상대경로 '' → ingress 가 /api 를 게이트웨이로 프록시).
 */
import axios from 'axios';
import { getAccessToken, logout } from '../auth/auth';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      logout();
      if (!window.location.pathname.startsWith('/shop/login')) {
        window.location.href = '/shop/login';
      }
    }
    return Promise.reject(error);
  },
);
