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

export const fetchDisplayServices = async (): Promise<DisplayService[]> => {
  const res = await api.get<ApiResponse<DisplayService[]>>('/api/v1/display/services');
  return res.data.data;
};

export const fetchPortfolioTimeline = async (): Promise<PortfolioTimeline> => {
  const res = await api.get<ApiResponse<PortfolioTimeline>>('/api/v1/portfolio/timeline');
  return res.data.data;
};
