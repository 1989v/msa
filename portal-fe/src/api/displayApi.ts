import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8089',
  timeout: 10_000,
});

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: { code: string; message: string } | null;
}

/** OPEN 진입 가능 / PREOPEN 오픈 예정(딤드). HOLD 는 서버가 걸러서 여기로 오지 않는다 (ADR-0066). */
export type DisplayStatus = 'OPEN' | 'PREOPEN';

export interface DisplayService {
  code: string;
  label: string;
  tagline: string | null;
  href: string | null;
  status: DisplayStatus;
  orderNo: number;
}

export interface TimelineCompany {
  name: string;
  startMonth: string;
  endMonth: string | null;
  ongoing: boolean;
  position: string | null;
  team: string | null;
}

export interface TimelineProject {
  title: string;
  categoryCode: string | null;
  startMonth: string | null;
  endMonth: string | null;
  ongoing: boolean;
  summary: string | null;
  metrics: string[];
  tags: string[];
}

export interface TimelineCategory {
  code: string;
  label: string;
}

export interface PortfolioTimeline {
  career: { totalMonths: number; years: number; months: number; yearsInField: number };
  companies: TimelineCompany[];
  projects: TimelineProject[];
  categories: TimelineCategory[];
}

/**
 * 게이트웨이는 업스트림이 죽어 있으면 200 에 **빈 바디**를 내려보낼 수 있다
 * (2026-08-21 code-dictionary CrashLoop 때 실측). 빈 payload 를 성공으로 넘기면
 * 화면이 failed 도 loaded 도 아닌 "불러오는 중…" 에 영원히 갇힌다 — 여기서 던져
 * 호출부의 catch(실패 상태)로 보낸다.
 */
function unwrap<T>(body: ApiResponse<T> | '' | null | undefined): T {
  if (!body || !body.success || body.data == null) {
    throw new Error('empty or unsuccessful display API response');
  }
  return body.data;
}

export const fetchDisplayServices = async (): Promise<DisplayService[]> => {
  const res = await api.get<ApiResponse<DisplayService[]>>('/api/v1/display/services');
  return unwrap(res.data);
};

export const fetchPortfolioTimeline = async (): Promise<PortfolioTimeline> => {
  const res = await api.get<ApiResponse<PortfolioTimeline>>('/api/v1/portfolio/timeline');
  return unwrap(res.data);
};

/** 메인에 전시하는 공개 오픈소스 저장소. active 만 내려온다 (서버가 거른다). */
export interface OpenSourceItem {
  slug: string;
  name: string;
  tagline: string;
  repoUrl: string;
  language: string;
  orderNo: number;
}

export const fetchOpenSourceItems = async (): Promise<OpenSourceItem[]> => {
  const res = await api.get<ApiResponse<OpenSourceItem[]>>('/api/v1/display/open-source');
  return unwrap(res.data);
};
