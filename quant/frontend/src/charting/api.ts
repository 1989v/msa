/**
 * charting 모듈 — 옛 charting/frontend/src/api.ts 의 인터페이스를 quant API 와 연결.
 *
 * 백엔드: 옛 charting (Python) 은 별도 서비스였으나 ADR-0036 P2-T20 에서 quant
 * (Kotlin) 로 통합되어 hard remove. 따라서 OHLCV / similarity 등은 quant 의
 * /api/v1/charts/* 로 매핑.
 *
 * Symbol 자동완성은 quant 가 미보유 → ClickHouse 의 ohlcv 테이블에서 distinct
 * 추출하는 별도 엔드포인트 추가 검토 필요. 임시로 하드코딩된 popular 심볼 반환.
 */

import { apiClient, unwrap } from '@/api/client';
import type { ApiResponse } from '@/types/api';

export interface OhlcvBar {
  ts: string; // ISO timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Symbol {
  code: string;
  name: string;
  market: string; // 'BITHUMB' | 'UPBIT' | 'YAHOO' | 'FDR_KR'
  assetClass?: string;
}

const POPULAR_SYMBOLS: Symbol[] = [
  { code: 'BTC', name: '비트코인', market: 'BITHUMB' },
  { code: 'ETH', name: '이더리움', market: 'BITHUMB' },
  { code: 'XRP', name: '리플', market: 'BITHUMB' },
  { code: 'SOL', name: '솔라나', market: 'BITHUMB' },
  { code: 'ADA', name: '카르다노', market: 'BITHUMB' },
  { code: 'DOGE', name: '도지코인', market: 'BITHUMB' },
  { code: 'AVAX', name: '아발란체', market: 'BITHUMB' },
  { code: 'DOT', name: '폴카닷', market: 'BITHUMB' },
];

/** 심볼 검색 — quant backend 가 미지원이라 client-side filter (popular only). */
export async function fetchSymbols(query?: string): Promise<Symbol[]> {
  if (!query || !query.trim()) return POPULAR_SYMBOLS;
  const q = query.toLowerCase();
  return POPULAR_SYMBOLS.filter(
    (s) => s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q),
  );
}

/** OHLCV 시계열 조회 — quant /api/v1/charts/ohlcv 매핑. */
export async function fetchOhlcv(params: {
  asset: string;
  market: string;
  interval: string;
  from: string;
  to: string;
}): Promise<OhlcvBar[]> {
  const qs = new URLSearchParams(params).toString();
  const res = await apiClient.get<ApiResponse<Array<{
    ts: string;
    open: string | number;
    high: string | number;
    low: string | number;
    close: string | number;
    volume: string | number;
  }>>>(`/api/v1/charts/ohlcv?${qs}`);
  const data = unwrap(res);
  return data.map((b) => ({
    ts: b.ts,
    open: Number(b.open),
    high: Number(b.high),
    low: Number(b.low),
    close: Number(b.close),
    volume: Number(b.volume),
  }));
}
