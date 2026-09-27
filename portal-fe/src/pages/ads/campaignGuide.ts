import type { BidType } from '../../api/adsConsoleApi';

/**
 * 캠페인 편집 화면의 설명 자료 — 지면이 페이지 어디에 놓이는지와, 입찰가·예산이 뜻하는 상한 계산.
 *
 * 지면의 **목록·최저가·요청 수**는 카탈로그(서버)가 원본이다. 여기 있는 건 페이지 배치를 그리는
 * 설명뿐이라 모르는 지면 키는 도식 없이 카탈로그 설명만으로 그린다.
 */

export interface PageBlock {
  label: string;
  /** 광고가 들어가는 자리 — 도식에는 고른 형태 이름으로 적힌다 */
  ad?: boolean;
  /** 도식 안 높이 — 본문처럼 긴 구역은 lg */
  size?: 'lg' | 'sm';
}

export interface PlacementGuide {
  where: string;
  blocks: PageBlock[];
}

/** 각 지면이 놓인 자리 — `BlogPostPage`·`AttractionPage`·`GamesPage` 의 AdSlot 위치와 같아야 한다 */
export const PLACEMENT_GUIDE: Record<string, PlacementGuide> = {
  'blog-post-end': {
    where: '글 본문과 좋아요·평점을 지나, 댓글 바로 위.',
    blocks: [{ label: '글 본문', size: 'lg' }, { label: '좋아요 · 평점' }, { label: '광고 카드', ad: true }, { label: '댓글' }],
  },
  'attraction-end': {
    where: '관광지 소개·지도·주변 목록을 다 본 뒤, 푸터 위.',
    blocks: [{ label: '소개 · 지도', size: 'lg' }, { label: '주변 관광지' }, { label: '광고 카드', ad: true }, { label: '푸터' }],
  },
  'game-hub-end': {
    where: '게임 카드 격자의 맨 아래, 푸터 위. 게임 화면 안에는 넣지 않습니다.',
    blocks: [{ label: '게임 카드 격자', size: 'lg' }, { label: '광고 카드', ad: true }, { label: '푸터' }],
  },
  'game-list-banner': {
    where: '게임 목록 제목 아래, 정렬·필터와 게임 카드 격자 위. 띠배너만 받습니다.',
    blocks: [{ label: '게임 목록 제목' }, { label: '띠배너', ad: true }, { label: '정렬 · 필터 · 게임 카드 격자', size: 'lg' }, { label: '푸터' }],
  },
};

export interface SpendEstimate {
  /** CPM 이면 하루 최대 가시 노출, CPC 면 하루 최대 클릭 */
  maxPerDay: number;
  /** 한 시간에 쓸 수 있는 최대 — 서버의 시간당 상한과 같은 식 */
  hourlyCapMicros: number;
  /** 총예산을 일예산 속도로 다 쓰는 데 걸리는 최소 일수. 총예산이 없으면 null */
  minDays: number | null;
}

/**
 * 입찰가·예산이 허락하는 **상한**. 경매에서 매번 이긴다고 가정한 값이라 실제 노출은 이보다 적다.
 * 시간당 상한은 서버와 같은 식이다: max(일예산 × 비율, 1회 과금액). CPM 의 1회 과금액은 입찰가 ÷ 1,000.
 */
export function estimateSpend(
  bidType: BidType,
  bidMicros: number | null,
  dailyMicros: number | null,
  totalMicros: number | null,
  hourlyCapPercent: number,
): SpendEstimate | null {
  if (!bidMicros || !dailyMicros) return null;
  // 서버 `Bid.chargeMicros` 와 같은 정수 나눗셈
  const chargeMicros = bidType === 'CPM' ? Math.floor(bidMicros / 1000) : bidMicros;
  if (chargeMicros <= 0) return null;
  return {
    maxPerDay: Math.floor(dailyMicros / chargeMicros),
    hourlyCapMicros: Math.max(Math.floor((dailyMicros * hourlyCapPercent) / 100), chargeMicros),
    minDays: totalMicros ? Math.ceil(totalMicros / dailyMicros) : null,
  };
}
