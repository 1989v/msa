import type { StewardStatus, StewardAction } from '@/api/stewards';
export const STATUS_LABEL: Record<StewardStatus, string> = { PENDING: '승인 대기', ACTIVE: '승인됨', REJECTED: '반려됨', SUSPENDED: '정지됨' };
export const ACTION_LABEL: Record<StewardAction, string> = { APPROVE: '승인', REJECT: '반려', SUSPEND: '정지', RESTORE: '복구' };
export function stewardActions(status: StewardStatus): StewardAction[] { return status === 'PENDING' ? ['APPROVE', 'REJECT'] : status === 'ACTIVE' ? ['SUSPEND'] : status === 'SUSPENDED' ? ['RESTORE'] : []; }
export interface StewardConfirmation { id: number; action: StewardAction }
export function stewardConfirmation(event: { type: 'ask'; id: number; action: StewardAction } | { type: 'cancel' | 'complete' }): StewardConfirmation | null { return event.type === 'ask' ? { id: event.id, action: event.action } : null; }
