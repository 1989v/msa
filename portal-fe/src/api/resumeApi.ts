import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8089',
  timeout: 10_000,
});

export type ResumeDocumentKind = 'MAIN' | 'DETAIL';

export interface ResumeDocument {
  slug: string;
  title: string;
  bodyMarkdown: string;
  kind: ResumeDocumentKind;
  orderNo: number;
}

export interface ResumeDocumentSummary {
  slug: string;
  title: string;
  kind: ResumeDocumentKind;
  orderNo: number;
  published: boolean;
  updatedAt: string | null;
}

// ─── 구조화 영역 (ADR-0064) ──────────────────────────────────────────────────

export interface CareerSummary {
  totalMonths: number;
  years: number;
  months: number;
  yearsInField: number;
}

export interface ResumeCompany {
  name: string;
  startMonth: string;
  endMonth: string | null;
  ongoing: boolean;
  position: string | null;
  team: string | null;
  note: string | null;
  tenureYears: number;
  tenureRemainderMonths: number;
}

export interface ResumeCategoryItem {
  code: string;
  label: string;
  description: string | null;
}

/** 이력서는 게이트 뒤라 스니펫이 항상 전문이다 — 공개면의 잠금 개념이 없다 */
export interface ResumeCodeSnippet {
  id: number | null;
  title: string | null;
  language: string;
  filePath: string | null;
  lineStart: number | null;
  lineEnd: number | null;
  gitUrl: string | null;
  code: string;
  totalLines: number;
  orderNo: number;
}

export interface ResumeProject {
  title: string;
  companyName: string | null;
  categoryCode: string | null;
  startMonth: string | null;
  endMonth: string | null;
  ongoing: boolean;
  summary: string | null;
  /** 카드에서는 접혀 있고 인쇄에서는 펼쳐지는 상세 (마크다운) */
  bodyMarkdown: string | null;
  metrics: string[];
  skills: ResumeSkillRef[];
  snippets: ResumeCodeSnippet[];
  detailSlug: string | null;
  orderNo: number;
}

export interface ResumeSkillRef {
  id: number;
  name: string;
}

export interface ResumeSkillGroup {
  label: string;
  skills: ResumeSkillRef[];
  note: string | null;
}

export interface ResumeProfile {
  career: CareerSummary;
  companies: ResumeCompany[];
  categories: ResumeCategoryItem[];
  projects: ResumeProject[];
  skills: ResumeSkillGroup[];
}

export interface ResumeOverview {
  main: ResumeDocument | null;
  details: ResumeDocumentSummary[];
  profile: ResumeProfile;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: { code: string; message: string } | null;
}

/**
 * 공유 토큰. 채용 담당자는 `?k=<토큰>` 이 붙은 링크로 들어오는데, 상세로 넘어갈 때마다
 * 쿼리를 끌고 다니면 주소가 지저분해지고 링크 복사 시 토큰이 유출되기 쉽다.
 * 그래서 첫 진입에서 한 번만 읽어 세션에 담아 둔다 (탭을 닫으면 사라진다).
 */
const TOKEN_STORAGE_KEY = 'resume.token';

export function captureShareToken(search: string): void {
  const fromUrl = new URLSearchParams(search).get('k');
  if (fromUrl && fromUrl.trim().length > 0) {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, fromUrl.trim());
  }
}

export function shareToken(): string | null {
  return sessionStorage.getItem(TOKEN_STORAGE_KEY);
}

function tokenParams(): Record<string, string> {
  const token = shareToken();
  return token ? { token } : {};
}

/** 공개 여부만 반환 — 게이트가 걸려 있지 않다. 메인 포털의 진입점 노출 판단용. */
export async function fetchResumeStatus(): Promise<boolean> {
  const res = await api.get<ApiResponse<{ publiclyVisible: boolean }>>('/api/v1/resume/status');
  return res.data.data.publiclyVisible;
}

export async function fetchResumeOverview(): Promise<ResumeOverview> {
  const res = await api.get<ApiResponse<ResumeOverview>>('/api/v1/resume/overview', {
    params: tokenParams(),
  });
  return res.data.data;
}

export async function fetchResumeDocument(slug: string): Promise<ResumeDocument> {
  const res = await api.get<ApiResponse<ResumeDocument>>(`/api/v1/resume/documents/${slug}`, {
    params: tokenParams(),
  });
  return res.data.data;
}
