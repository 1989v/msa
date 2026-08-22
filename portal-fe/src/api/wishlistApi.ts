import axios from 'axios';
import { getAccessToken } from '../auth/auth';

// VITE_API_URL 이 빈 문자열이면 same-origin relative path (운영 / K8s ingress 경유).
const BASE_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8089';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: { code: string; message: string } | null;
}

/**
 * 찜하기 클라이언트 (ADR-0074). shell/apiClient 를 쓰지 않는 이유는 그쪽 401 처리가
 * apex `/login` 으로 강제 이동하기 때문이다 — 하트는 게임·블로그·place 화면 어디에나
 * 있고, 토큰 만료가 화면 이탈이 되면 안 된다. 401 은 버튼이 스스로 처리한다.
 */
const api = axios.create({ baseURL: BASE_URL, timeout: 10_000 });

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export type FavoriteTargetType = 'PRODUCT' | 'GAME' | 'ATTRACTION' | 'BLOG_POST';

export interface FavoriteItem {
  id: number;
  targetType: FavoriteTargetType;
  targetKey: string;
  createdAt: string;
}

export interface FavoritePage {
  items: FavoriteItem[];
  totalCount: number;
}

export async function addFavorite(type: FavoriteTargetType, targetKey: string): Promise<FavoriteItem> {
  const res = await api.put<ApiResponse<FavoriteItem>>(
    `/api/v1/wishlist/${type}/${encodeURIComponent(targetKey)}`,
  );
  return res.data.data;
}

export async function removeFavorite(type: FavoriteTargetType, targetKey: string): Promise<void> {
  await api.delete(`/api/v1/wishlist/${type}/${encodeURIComponent(targetKey)}`);
}

export async function fetchFavorites(params: {
  type?: FavoriteTargetType;
  page?: number;
  size?: number;
}): Promise<FavoritePage> {
  const search = new URLSearchParams();
  if (params.type) search.set('type', params.type);
  search.set('page', String(params.page ?? 0));
  search.set('size', String(params.size ?? 50));
  const res = await api.get<ApiResponse<FavoritePage>>(`/api/v1/wishlist?${search}`);
  return res.data.data;
}

/** 목록 화면의 "찜됨" 하이드레이션 — 타입 하나의 내 찜 키만 싸게 받는다 */
export async function fetchFavoriteKeys(type: FavoriteTargetType): Promise<string[]> {
  const res = await api.get<ApiResponse<{ keys: string[] }>>(`/api/v1/wishlist/keys?type=${type}`);
  return res.data.data.keys;
}
