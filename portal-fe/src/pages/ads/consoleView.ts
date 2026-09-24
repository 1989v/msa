import type { AdvertiserDashboard, Campaign, CreativeStatus } from '../../api/adsConsoleApi';

/** 콘솔 화면들이 함께 쓰는 판정 — 주소와 상태 표시. 그리는 조각은 consoleParts 에 있다. */

/** 콘솔 안의 주소. ads 호스트에서는 루트가 콘솔이고, 서브도메인이 없는 개발 환경은 `/ads` 가 대시보드다. */
export function consoleHref(path: '' | '/top-up' | '/reports' | '/campaigns/new' | `/campaigns/${number}`): string {
  const onAdsHost = window.location.hostname.split('.')[0] === 'ads';
  if (path === '') return onAdsHost ? '/' : '/ads';
  return path;
}

export type Tone = 'run' | 'pause' | 'pend' | 'rej';

/**
 * 캠페인 표시 상태. 「기간 밖」·「예산 소진」은 저장된 상태가 아니라 게재 자격에서 파생한다.
 * @param todaySpendMicros 오늘(KST) 지출 — 모르면 null
 */
export function campaignState(campaign: Campaign, todaySpendMicros: number | null): { tone: Tone; label: string } {
  switch (campaign.status) {
    case 'DRAFT':
      return { tone: 'pause', label: '초안' };
    case 'PAUSED':
      return { tone: 'pause', label: '일시정지' };
    case 'ENDED':
      return { tone: 'pause', label: '종료' };
    case 'ACTIVE':
      if (!campaign.inPeriod) return { tone: 'pend', label: '기간 밖' };
      if (todaySpendMicros != null && campaign.dailyBudgetMicros != null && todaySpendMicros >= campaign.dailyBudgetMicros) {
        return { tone: 'pend', label: '예산 소진' };
      }
      return { tone: 'run', label: '게재 중' };
  }
}

export const CREATIVE_STATE: Record<CreativeStatus, { tone: Tone; label: string }> = {
  PENDING: { tone: 'pend', label: '심사 중' },
  APPROVED: { tone: 'run', label: '승인' },
  REJECTED: { tone: 'rej', label: '반려' },
  ARCHIVED: { tone: 'pause', label: '보관' },
};


/** 오늘(KST) 더 충전할 수 있는 금액 — 하루 한도에서 오늘 충전 합계를 뺀 값. */
export function topUpHeadroomMicros(advertiser: AdvertiserDashboard): number {
  return Math.max(0, advertiser.dailyTopUpLimitMicros - advertiser.todayTopUpMicros);
}
