// charting/frontend/src/lib/patterns.ts

export type Signal = 'bullish' | 'bearish' | 'neutral'

export interface PatternPoint {
  x: number  // 0..1 (normalized time: 0=window start, 1=window end)
  y: number  // 0..1 (normalized price: 0=window low, 1=window high)
}

export interface PatternDefinition {
  id: string
  name: string
  nameEn: string
  signal: Signal
  color: string
  description: string
  prediction: string
  accuracy: number
  keyPoints: string[]
  curve: PatternPoint[]       // x: 0.0 → 1.0
  projection: PatternPoint[]  // x: 1.0 → ~1.33  (20 future days / 60 window days)
}

export const PATTERNS: PatternDefinition[] = [
  {
    id: 'elliott_impulse',
    name: 'Elliott Wave 5파동',
    nameEn: 'Elliott Impulse Wave',
    signal: 'neutral',
    color: '#8b5cf6',
    description: '5파동 상승 임펄스 완성 단계. 패턴 완성 후 ABC 3파동 조정이 예상됩니다.',
    prediction: 'ABC 조정 파동 진입 예상',
    accuracy: 65,
    keyPoints: ['Wave 1 초기 상승', 'Wave 2 조정 (38-62%)', 'Wave 3 최강 상승 (1.618×)', 'Wave 4 완만한 조정', 'Wave 5 마지막 상승', '→ ABC 조정 시작'],
    curve: [
      { x: 0.00, y: 0.30 }, { x: 0.13, y: 0.58 }, { x: 0.22, y: 0.44 },
      { x: 0.42, y: 0.88 }, { x: 0.55, y: 0.65 }, { x: 0.72, y: 0.83 },
      { x: 0.82, y: 0.78 }, { x: 1.00, y: 0.72 },
    ],
    projection: [
      { x: 1.00, y: 0.72 }, { x: 1.05, y: 0.62 }, { x: 1.12, y: 0.50 },
      { x: 1.17, y: 0.55 }, { x: 1.25, y: 0.44 }, { x: 1.33, y: 0.38 },
    ],
  },
  {
    id: 'head_shoulders',
    name: '헤드 앤 숄더',
    nameEn: 'Head & Shoulders',
    signal: 'bearish',
    color: '#ef4444',
    description: '상승 추세 종료 후 나타나는 하락반전 패턴. 목선(Neckline) 이탈 시 강한 하락이 예상됩니다.',
    prediction: '하락 반전 가능성 높음',
    accuracy: 83,
    keyPoints: ['왼쪽 어깨 (Left Shoulder)', '목선 (Neckline)', '헤드 (최고점)', '목선 재터치', '오른쪽 어깨 (Left < Right)', '→ 목선 이탈 하락'],
    curve: [
      { x: 0.00, y: 0.42 }, { x: 0.17, y: 0.70 }, { x: 0.27, y: 0.55 },
      { x: 0.45, y: 0.92 }, { x: 0.60, y: 0.55 }, { x: 0.74, y: 0.68 },
      { x: 0.85, y: 0.57 }, { x: 1.00, y: 0.54 },
    ],
    projection: [
      { x: 1.00, y: 0.54 }, { x: 1.07, y: 0.44 }, { x: 1.14, y: 0.32 },
      { x: 1.22, y: 0.22 }, { x: 1.33, y: 0.18 },
    ],
  },
  {
    id: 'inverse_head_shoulders',
    name: '역 헤드 앤 숄더',
    nameEn: 'Inverse H&S',
    signal: 'bullish',
    color: '#10b981',
    description: '하락 추세 종료 후 나타나는 상승반전 패턴. 목선 돌파 시 강한 상승이 예상됩니다.',
    prediction: '상승 반전 가능성 높음',
    accuracy: 81,
    keyPoints: ['왼쪽 어깨 (바닥)', '목선', '헤드 (최저점)', '목선 재터치', '오른쪽 어깨', '→ 목선 돌파 상승'],
    curve: [
      { x: 0.00, y: 0.58 }, { x: 0.17, y: 0.30 }, { x: 0.27, y: 0.45 },
      { x: 0.45, y: 0.08 }, { x: 0.60, y: 0.45 }, { x: 0.74, y: 0.32 },
      { x: 0.85, y: 0.43 }, { x: 1.00, y: 0.46 },
    ],
    projection: [
      { x: 1.00, y: 0.46 }, { x: 1.08, y: 0.58 }, { x: 1.15, y: 0.68 },
      { x: 1.22, y: 0.78 }, { x: 1.33, y: 0.85 },
    ],
  },
  {
    id: 'double_top',
    name: '이중 천장',
    nameEn: 'Double Top',
    signal: 'bearish',
    color: '#f97316',
    description: '저항선에서 두 번 고점을 형성하는 하락반전(M자형) 패턴. 목선 이탈 후 하락 가속.',
    prediction: '하락 전환 신호',
    accuracy: 75,
    keyPoints: ['1차 고점 형성', '목선까지 하락', '2차 고점 (1차보다 낮음)', '목선 재터치', '→ 목선 이탈 하락'],
    curve: [
      { x: 0.00, y: 0.30 }, { x: 0.22, y: 0.82 }, { x: 0.35, y: 0.58 },
      { x: 0.50, y: 0.52 }, { x: 0.62, y: 0.78 }, { x: 0.73, y: 0.65 },
      { x: 0.85, y: 0.55 }, { x: 1.00, y: 0.53 },
    ],
    projection: [
      { x: 1.00, y: 0.53 }, { x: 1.07, y: 0.42 }, { x: 1.14, y: 0.30 },
      { x: 1.22, y: 0.22 }, { x: 1.33, y: 0.18 },
    ],
  },
  {
    id: 'double_bottom',
    name: '이중 바닥',
    nameEn: 'Double Bottom',
    signal: 'bullish',
    color: '#3b82f6',
    description: '지지선에서 두 번 저점을 형성하는 상승반전(W자형) 패턴. 목선 돌파 후 강한 상승.',
    prediction: '상승 전환 신호',
    accuracy: 78,
    keyPoints: ['1차 저점 형성', '목선까지 반등', '2차 저점 (1차와 유사)', '목선 재터치', '→ 목선 돌파 상승'],
    curve: [
      { x: 0.00, y: 0.72 }, { x: 0.18, y: 0.25 }, { x: 0.30, y: 0.42 },
      { x: 0.42, y: 0.55 }, { x: 0.50, y: 0.48 }, { x: 0.65, y: 0.22 },
      { x: 0.78, y: 0.40 }, { x: 0.88, y: 0.55 }, { x: 1.00, y: 0.60 },
    ],
    projection: [
      { x: 1.00, y: 0.60 }, { x: 1.07, y: 0.70 }, { x: 1.15, y: 0.80 },
      { x: 1.23, y: 0.88 }, { x: 1.33, y: 0.95 },
    ],
  },
  {
    id: 'cup_handle',
    name: '컵 앤 핸들',
    nameEn: 'Cup & Handle',
    signal: 'bullish',
    color: '#06b6d4',
    description: 'U자형 컵 + 소폭 하락(핸들) 후 이전 고점 돌파하는 상승지속 패턴.',
    prediction: '강한 상승 돌파 예상',
    accuracy: 79,
    keyPoints: ['왼쪽 림 (고점)', 'U자형 컵 바닥', '오른쪽 림 (이전 고점 근접)', '핸들 소폭 하락', '→ 림 돌파 상승'],
    curve: [
      { x: 0.00, y: 0.80 }, { x: 0.10, y: 0.70 }, { x: 0.20, y: 0.55 },
      { x: 0.32, y: 0.38 }, { x: 0.45, y: 0.28 }, { x: 0.58, y: 0.35 },
      { x: 0.70, y: 0.52 }, { x: 0.80, y: 0.72 }, { x: 0.87, y: 0.65 },
      { x: 0.92, y: 0.60 }, { x: 0.96, y: 0.65 }, { x: 1.00, y: 0.70 },
    ],
    projection: [
      { x: 1.00, y: 0.70 }, { x: 1.08, y: 0.82 }, { x: 1.16, y: 0.92 },
      { x: 1.25, y: 1.00 }, { x: 1.33, y: 1.06 },
    ],
  },
  {
    id: 'ascending_triangle',
    name: '상승 삼각형',
    nameEn: 'Ascending Triangle',
    signal: 'bullish',
    color: '#84cc16',
    description: '수평 저항선 + 상승하는 지지선. 매번 저점이 높아지며 돌파 시 강한 상승.',
    prediction: '상방 돌파 가능성',
    accuracy: 72,
    keyPoints: ['수평 저항선 (여러 번 터치)', '상승하는 저점들', '거래량 감소 중 수렴', '→ 저항선 돌파 상승'],
    curve: [
      { x: 0.00, y: 0.45 }, { x: 0.08, y: 0.80 }, { x: 0.16, y: 0.58 },
      { x: 0.25, y: 0.82 }, { x: 0.33, y: 0.63 }, { x: 0.42, y: 0.83 },
      { x: 0.50, y: 0.67 }, { x: 0.60, y: 0.84 }, { x: 0.68, y: 0.71 },
      { x: 0.78, y: 0.85 }, { x: 0.86, y: 0.74 }, { x: 1.00, y: 0.83 },
    ],
    projection: [
      { x: 1.00, y: 0.83 }, { x: 1.07, y: 0.92 }, { x: 1.15, y: 1.00 },
      { x: 1.25, y: 1.08 }, { x: 1.33, y: 1.12 },
    ],
  },
  {
    id: 'descending_triangle',
    name: '하락 삼각형',
    nameEn: 'Descending Triangle',
    signal: 'bearish',
    color: '#dc2626',
    description: '수평 지지선 + 하락하는 저항선. 매번 고점이 낮아지며 이탈 시 강한 하락.',
    prediction: '하방 돌파 가능성',
    accuracy: 70,
    keyPoints: ['수평 지지선 (여러 번 터치)', '하락하는 고점들', '수렴 후 지지선 이탈', '→ 지지선 이탈 하락'],
    curve: [
      { x: 0.00, y: 0.82 }, { x: 0.08, y: 0.30 }, { x: 0.16, y: 0.62 },
      { x: 0.25, y: 0.30 }, { x: 0.33, y: 0.55 }, { x: 0.42, y: 0.28 },
      { x: 0.50, y: 0.48 }, { x: 0.60, y: 0.27 }, { x: 0.68, y: 0.42 },
      { x: 0.78, y: 0.25 }, { x: 0.88, y: 0.38 }, { x: 1.00, y: 0.24 },
    ],
    projection: [
      { x: 1.00, y: 0.24 }, { x: 1.08, y: 0.16 }, { x: 1.16, y: 0.08 },
      { x: 1.25, y: 0.04 }, { x: 1.33, y: 0.06 },
    ],
  },
  {
    id: 'bull_flag',
    name: '상승 깃발',
    nameEn: 'Bull Flag',
    signal: 'bullish',
    color: '#22c55e',
    description: '급등(폴) 후 완만한 하락채널(깃발). 상승 추세의 일시적 조정 후 동일 폭 추가 상승.',
    prediction: '상승 추세 지속 예상',
    accuracy: 71,
    keyPoints: ['폴 (급격한 상승)', '깃발 (완만한 하락채널)', '채널 내 거래량 감소', '→ 채널 상단 이탈, 폴 높이만큼 상승'],
    curve: [
      { x: 0.00, y: 0.10 }, { x: 0.05, y: 0.20 }, { x: 0.12, y: 0.52 },
      { x: 0.20, y: 0.80 }, { x: 0.28, y: 0.74 }, { x: 0.35, y: 0.68 },
      { x: 0.42, y: 0.62 }, { x: 0.50, y: 0.56 }, { x: 0.58, y: 0.50 },
      { x: 0.65, y: 0.44 }, { x: 0.73, y: 0.40 }, { x: 0.80, y: 0.36 },
      { x: 0.88, y: 0.33 }, { x: 1.00, y: 0.30 },
    ],
    projection: [
      { x: 1.00, y: 0.30 }, { x: 1.07, y: 0.45 }, { x: 1.14, y: 0.62 },
      { x: 1.22, y: 0.78 }, { x: 1.33, y: 0.90 },
    ],
  },
  {
    id: 'bear_flag',
    name: '하락 깃발',
    nameEn: 'Bear Flag',
    signal: 'bearish',
    color: '#f43f5e',
    description: '급락(폴) 후 완만한 상승채널(깃발). 하락 추세의 일시적 반등 후 동일 폭 추가 하락.',
    prediction: '하락 추세 지속 예상',
    accuracy: 69,
    keyPoints: ['폴 (급격한 하락)', '깃발 (완만한 상승채널)', '채널 내 거래량 감소', '→ 채널 하단 이탈, 폴 높이만큼 하락'],
    curve: [
      { x: 0.00, y: 0.90 }, { x: 0.07, y: 0.78 }, { x: 0.14, y: 0.55 },
      { x: 0.22, y: 0.28 }, { x: 0.30, y: 0.35 }, { x: 0.38, y: 0.42 },
      { x: 0.46, y: 0.48 }, { x: 0.54, y: 0.52 }, { x: 0.62, y: 0.55 },
      { x: 0.70, y: 0.58 }, { x: 0.78, y: 0.60 }, { x: 0.85, y: 0.62 },
      { x: 0.92, y: 0.63 }, { x: 1.00, y: 0.63 },
    ],
    projection: [
      { x: 1.00, y: 0.63 }, { x: 1.07, y: 0.52 }, { x: 1.14, y: 0.38 },
      { x: 1.22, y: 0.25 }, { x: 1.33, y: 0.15 },
    ],
  },
]
