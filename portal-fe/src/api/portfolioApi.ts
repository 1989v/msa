import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8089',
  timeout: 10_000,
});

/** `/portfolio` 공개 아카이브 — 이력서와 같은 데이터를 회사명 없이 내보낸다 */
export interface PortfolioProject {
  title: string;
  categoryCode: string | null;
  summary: string | null;
  metrics: string[];
  tags: string[];
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

export async function fetchPortfolioProjects(): Promise<PortfolioProjects> {
  const { data } = await api.get<ApiResponse<PortfolioProjects>>('/api/v1/portfolio/projects');
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
