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

/** quant 백엔드의 자산 카탈로그 row. AssetCatalogController 응답 schema 와 정합. */
interface CatalogItem {
  id: string;
  assetCode: string;
  assetClass: AssetClass;
  source: string;
  displayName: string;
  active: boolean;
  sortOrder: number;
}

/** Last-resort fallback (catalog API 5xx / 네트워크 실패 시). 운영 시 catalog 가 source-of-truth. */
const FALLBACK_SYMBOLS: Symbol[] = [
  { id: 1, ticker: 'BTC', name: '비트코인', market: 'CRYPTO', assetClass: 'CRYPTO', active: true },
  { id: 2, ticker: 'ETH', name: '이더리움', market: 'CRYPTO', assetClass: 'CRYPTO', active: true },
  { id: 100, ticker: '005930', name: '삼성전자', market: 'STOCK_KR', assetClass: 'STOCK_KR', active: true },
  { id: 200, ticker: 'AAPL', name: 'Apple', market: 'STOCK_US', assetClass: 'STOCK_US', active: true },
];

/** assetCode → 표시 ticker. CRYPTO 'BTC-USD' → 'BTC'. */
function tickerOf(item: CatalogItem): string {
  if (item.assetClass === 'CRYPTO') return item.assetCode.split('-')[0];
  return item.assetCode;
}

let _catalogCache: { ts: number; data: Symbol[] } | null = null;
const CATALOG_TTL_MS = 60_000;

/**
 * 심볼 카탈로그 — `/api/v1/quant/assets?activeOnly=true` 동적 fetch.
 * 백엔드 자산 카탈로그 (DB) 가 source-of-truth. 60s in-memory cache.
 * API 실패 시 FALLBACK_SYMBOLS (4 종) 로 degrade.
 */
export async function fetchSymbols(): Promise<Symbol[]> {
  const now = Date.now();
  if (_catalogCache && now - _catalogCache.ts < CATALOG_TTL_MS) {
    return _catalogCache.data;
  }
  try {
    const res = await apiClient.get<ApiResponse<CatalogItem[]>>(
      '/api/v1/quant/assets?activeOnly=true'
    );
    const items = unwrap(res.data);
    const symbols: Symbol[] = items
      .filter((it) => it.active)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map<Symbol>((it, idx) => ({
        id: idx + 1,
        ticker: tickerOf(it),
        name: it.displayName,
        market: it.assetClass,
        assetClass: it.assetClass,
        active: it.active,
      }));
    _catalogCache = { ts: now, data: symbols };
    return symbols;
  } catch (err) {
    console.warn('[quant] asset catalog fetch failed, using fallback:', err);
    return FALLBACK_SYMBOLS;
  }
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
