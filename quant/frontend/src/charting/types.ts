/**
 * charting 모듈 — 24f6071^에서 추출한 컴포넌트들이 공유하던 타입.
 * 옛 App.tsx의 ChartType 등을 여기로 옮김.
 */

export type ChartType = 'candle' | 'line' | 'area' | 'heikinashi';

export type ChartTypeOption = {
  value: ChartType;
  label: string;
};

export const CHART_TYPES: ChartTypeOption[] = [
  { value: 'candle', label: '캔들' },
  { value: 'heikinashi', label: '헤이킨 아시' },
  { value: 'line', label: '라인' },
  { value: 'area', label: '영역' },
];

/**
 * Backend 호환 timeframe 키. 분봉(1m/5m/30m) 은 P3 SSE 와 함께 활성화.
 * 'mo' 는 '1mo' (1 month) — yfinance 호환.
 */
export type TimeframeKey = '1m' | '5m' | '30m' | '1d' | '1w' | '1mo' | '1y';

export interface TimeframeOption {
  key: TimeframeKey;
  label: string;
  disabled?: boolean;
  /** Tooltip when disabled. */
  disabledReason?: string;
}

export const TIMEFRAMES: TimeframeOption[] = [
  { key: '1m', label: '1분', disabled: true, disabledReason: 'Phase 3 (실시간 SSE) 와 함께 활성화' },
  { key: '5m', label: '5분', disabled: true, disabledReason: 'Phase 3 (실시간 SSE) 와 함께 활성화' },
  { key: '30m', label: '30분', disabled: true, disabledReason: 'Phase 3 (실시간 SSE) 와 함께 활성화' },
  { key: '1d', label: '일' },
  { key: '1w', label: '주' },
  { key: '1mo', label: '월' },
  { key: '1y', label: '년' },
];
