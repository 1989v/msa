import axios from 'axios';
import { BYPASS_AUTH } from '@/lib/auth-bypass';

const TOKEN_KEY = 'admin_token';

export const apiClient = axios.create({
  baseURL: '',
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
    if (error.response?.status === 401) {
      // ⚠️ TEMPORARY: BYPASS_AUTH 모드에서는 401 → /login redirect 가
      // dashboard ↔ login 무한 루프를 만든다 (LoginPage 가 BYPASS 감지하면
      // 다시 / 로 navigate 해서 또 401). BYPASS 면 단순 reject.
      if (!BYPASS_AUTH) {
        localStorage.removeItem(TOKEN_KEY);
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export { TOKEN_KEY };
