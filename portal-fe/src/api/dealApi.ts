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

/**
 * 링크의 수익 유형 (ADR-0069).
 *
 * `AFFILIATE` 만 공정위 고지 대상이다. 전부 뭉뚱그려 고지하면 수수료를 받지 않는 링크까지
 * 광고로 읽혀, 고지의 목적과 반대로 간다.
 */
export type RevenueType = 'AFFILIATE' | 'PLAIN';

export interface DealCategory {
  code: string;
  label: string;
  tagline: string | null;
}

export interface DealOffer {
  slug: string;
  merchant: string;
  title: string;
  benefit: string;
  summary: string | null;
  revenueType: RevenueType;
  /** 서버가 판정한 고지 대상 여부 — 배지와 rel 속성의 기준 */
  disclosureRequired: boolean;
  validUntil: string | null;
}

export interface DealSection {
  category: DealCategory;
  offers: DealOffer[];
}

/**
 * 허브 한 화면분을 한 번에 받는다. 카테고리마다 따로 부르면 첫 화면이 계단식으로 채워지는데,
 * 유입이 SNS 공유라 첫 화면 완성 속도가 곧 이탈률이다.
 */
export const fetchDealSections = async (): Promise<DealSection[]> => {
  const res = await api.get<ApiResponse<DealSection[]>>('/api/v1/deal/sections');
  return res.data.data;
};
