import axios from 'axios';
import { getAccessToken } from '../auth/auth';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8089',
  timeout: 10_000,
});

// 스니펫 전문은 로그인 사용자에게 열린다 — Bearer 를 실어야 게이트웨이가 X-User-Id 를
// 주입한다. 401 강제 이동은 하지 않는다: 포트폴리오는 익명이 기본이다.
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** 공개면의 코드 스니펫 — 익명에게는 미리보기만 오고 `code` 는 응답에 없다 */
export interface PortfolioSnippet {
  id: number;
  title: string | null;
  language: string;
  filePath: string | null;
  lineStart: number | null;
  lineEnd: number | null;
  gitUrl: string | null;
  /** 상단 8줄 — 전문이 그보다 짧으면 전문 그대로 */
  previewCode: string;
  totalLines: number;
  locked: boolean;
  /** 잠금 해제(로그인 또는 광고 시청) 시에만 실린다 */
  code: string | null;
}

/** `/portfolio` 공개 아카이브 — 이력서와 같은 데이터를 회사명 없이 내보낸다 */
export interface PortfolioProject {
  title: string;
  categoryCode: string | null;
  summary: string | null;
  /** 공개용 서술 — 게이트 뒤 본문과 다른 글이다 */
  body: string | null;
  metrics: string[];
  tags: string[];
  snippets: PortfolioSnippet[];
  orderNo: number;
}

export interface PortfolioCategory {
  code: string;
  label: string;
  description: string | null;
}

export interface PortfolioProjects {
  projects: PortfolioProject[];
  categories: PortfolioCategory[];
}

/**
 * @param unlockToken 광고 시청 보상 토큰(`unlockSnippets` 발급) — 있으면 스니펫 전문이 온다.
 * 로그인 상태라면 토큰 없이도 서버가 열어준다.
 */
export async function fetchPortfolioProjects(
  unlockToken?: string | null,
): Promise<PortfolioProjects> {
  const { data } = await api.get<ApiResponse<PortfolioProjects>>('/api/v1/portfolio/projects', {
    params: unlockToken ? { unlock: unlockToken } : undefined,
  });
  return data.data;
}

export interface SnippetUnlock {
  token: string;
  /** 초 단위 */
  expiresIn: number;
}

/** 광고(하우스 인터스티셜) 시청 완료 보상 — 스니펫 잠금 해제 토큰 발급 */
export async function unlockSnippets(): Promise<SnippetUnlock> {
  const { data } = await api.post<ApiResponse<SnippetUnlock>>('/api/v1/portfolio/snippet-unlock');
  return data.data;
}

export interface PortfolioCardSummary {
  id: number;
  title: string;
  summary: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  role: string | null;
  impact: number;
  tags: string[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PortfolioCardDetail extends PortfolioCardSummary {
  body: string;
  visibility: 'PUBLIC' | 'PRIVATE';
  keywords: string[];
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: { code: string; message: string } | null;
}

export type PortfolioSort = 'time' | 'impact';

export async function listPortfolioCards(params: {
  sort?: PortfolioSort;
  stack?: string[];
  q?: string;
  page?: number;
  size?: number;
}): Promise<PageResponse<PortfolioCardSummary>> {
  const { sort = 'time', stack = [], q, page = 0, size = 50 } = params;
  const response = await api.get<ApiResponse<PageResponse<PortfolioCardSummary>>>(
    '/api/v1/portfolio/cards',
    {
      params: {
        sort,
        stack: stack.length > 0 ? stack.join(',') : undefined,
        q: q && q.trim().length > 0 ? q : undefined,
        page,
        size,
      },
    },
  );
  return response.data.data;
}

export async function getPortfolioCard(id: number): Promise<PortfolioCardDetail> {
  const response = await api.get<ApiResponse<PortfolioCardDetail>>(
    `/api/v1/portfolio/cards/${id}`,
  );
  return response.data.data;
}
