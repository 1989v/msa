/**
 * charting 모듈 — quant /api/v1/charts/* 매핑 + 모바일 우선 심볼 카탈로그.
 *
 * 백엔드 ingest 가 적재하는 market_code:
 *   - BITHUMB → CRYPTO (KRW pair)
 *   - YAHOO   → STOCK_US (yfinance)
 *   - FDR_KR  → STOCK_KR (FinanceDataReader)
 */

import { apiClient, unwrap } from '@/api/client';
import type { ApiResponse } from '@/types/api';

export type AssetClass = 'CRYPTO' | 'STOCK_KR' | 'STOCK_US';

export interface OhlcvBar {
  trade_date: string;
  bar_time?: string | null;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Symbol {
  id: number;
  ticker: string;
  name: string;
  /** UI 분류 — SymbolSearch 가 필터링에 사용. 'KR'/'US' 는 legacy 표기 (assetClass 가 우선) */
  market: 'CRYPTO' | 'STOCK_KR' | 'STOCK_US' | string;
  assetClass: AssetClass;
  active: boolean;
}

/** AssetClass → quant backend market_code 매핑. */
export function backendMarketOf(assetClass: AssetClass): string {
  switch (assetClass) {
    case 'CRYPTO':
      // Phase 1 ingest 는 yfinance 의 BTC-USD/ETH-USD pair → market=YAHOO 적재.
      // Bithumb 직접 ingest 미구현 (Phase 2 cross-exchange 김치프리미엄 대상).
      return 'YAHOO';
    case 'STOCK_KR':
      return 'FDR_KR';
    case 'STOCK_US':
      return 'YAHOO';
  }
}

/** 표시 ticker → backend asset_code 매핑. CRYPTO 는 yfinance USD pair 로 변환. */
export function backendAssetOf(ticker: string, assetClass: AssetClass): string {
  if (assetClass === 'CRYPTO') return `${ticker}-USD`;
  return ticker;
}

const POPULAR_SYMBOLS: Symbol[] = [
  // 코인 (BITHUMB KRW pair)
  { id: 1, ticker: 'BTC', name: '비트코인', market: 'CRYPTO', assetClass: 'CRYPTO', active: true },
  { id: 2, ticker: 'ETH', name: '이더리움', market: 'CRYPTO', assetClass: 'CRYPTO', active: true },
  { id: 3, ticker: 'XRP', name: '리플', market: 'CRYPTO', assetClass: 'CRYPTO', active: true },
  { id: 4, ticker: 'SOL', name: '솔라나', market: 'CRYPTO', assetClass: 'CRYPTO', active: true },
  { id: 5, ticker: 'ADA', name: '카르다노', market: 'CRYPTO', assetClass: 'CRYPTO', active: true },
  { id: 6, ticker: 'DOGE', name: '도지코인', market: 'CRYPTO', assetClass: 'CRYPTO', active: true },
  { id: 7, ticker: 'AVAX', name: '아발란체', market: 'CRYPTO', assetClass: 'CRYPTO', active: true },
  { id: 8, ticker: 'DOT', name: '폴카닷', market: 'CRYPTO', assetClass: 'CRYPTO', active: true },
  // 한국 주식 (FDR_KR)
  { id: 100, ticker: '005930', name: '삼성전자', market: 'STOCK_KR', assetClass: 'STOCK_KR', active: true },
  { id: 101, ticker: '000660', name: 'SK하이닉스', market: 'STOCK_KR', assetClass: 'STOCK_KR', active: true },
  { id: 102, ticker: '035420', name: 'NAVER', market: 'STOCK_KR', assetClass: 'STOCK_KR', active: true },
  { id: 103, ticker: '035720', name: '카카오', market: 'STOCK_KR', assetClass: 'STOCK_KR', active: true },
  { id: 104, ticker: '005380', name: '현대차', market: 'STOCK_KR', assetClass: 'STOCK_KR', active: true },
  { id: 105, ticker: '207940', name: '삼성바이오로직스', market: 'STOCK_KR', assetClass: 'STOCK_KR', active: true },
  // 미국 주식 (YAHOO)
  { id: 200, ticker: 'AAPL', name: 'Apple', market: 'STOCK_US', assetClass: 'STOCK_US', active: true },
  { id: 201, ticker: 'NVDA', name: 'NVIDIA', market: 'STOCK_US', assetClass: 'STOCK_US', active: true },
  { id: 202, ticker: 'TSLA', name: 'Tesla', market: 'STOCK_US', assetClass: 'STOCK_US', active: true },
  { id: 203, ticker: 'MSFT', name: 'Microsoft', market: 'STOCK_US', assetClass: 'STOCK_US', active: true },
  { id: 204, ticker: 'GOOGL', name: 'Alphabet', market: 'STOCK_US', assetClass: 'STOCK_US', active: true },
  { id: 205, ticker: 'META', name: 'Meta', market: 'STOCK_US', assetClass: 'STOCK_US', active: true },
];

/** 심볼 검색 — backend symbols API 미구현 → client-side filter (popular only). */
export async function fetchSymbols(): Promise<Symbol[]> {
  return POPULAR_SYMBOLS;
}

/** OHLCV 시계열 — quant /api/v1/charts/ohlcv 매핑. yfinance 의 stock 종목은 ts 가 daily(00:00). */
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
  return data.map((b) => {
    const [date, timepart] = (b.ts || '').split('T');
    return {
      trade_date: date,
      bar_time: timepart && !timepart.startsWith('00:00:00') ? timepart.slice(0, 8) : null,
      open: Number(b.open),
      high: Number(b.high),
      low: Number(b.low),
      close: Number(b.close),
      volume: Number(b.volume),
    };
  });
}
