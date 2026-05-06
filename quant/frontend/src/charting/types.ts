/**
 * charting 모듈 — 24f6071^에서 추출한 컴포넌트들이 공유하던 타입.
 * 옛 App.tsx의 ChartType 등을 여기로 옮김.
 */

export type ChartType = 'candle' | 'line' | 'area';

export type ChartTypeOption = {
  value: ChartType;
  label: string;
};

export const CHART_TYPES: ChartTypeOption[] = [
  { value: 'candle', label: '캔들' },
  { value: 'line', label: '라인' },
  { value: 'area', label: '영역' },
];
