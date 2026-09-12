// 방장 승계 때 게스트가 아직 반영 안 된 입력을 새 방장에게 다시 보낸다.
// 옛 방장이 마지막 스냅샷 뒤에 받은 입력은 새 방장이 모른다 — 다시 보내지 않으면 그 사이 입력(공격·점프)이 사라진다.
// 새 방장의 큐 상한(30)·입력 메시지 상한(16개)에 맞춰 최근 것만 16개씩 나눈다.
import type { Input } from '@amp/shared';

export const RESEND_MAX = 32;
export const RESEND_CHUNK = 16;

/** ack 뒤의 입력 중 최근 RESEND_MAX 개를 RESEND_CHUNK 개씩 묶는다 (오래된 것부터) */
export function resendChunks(pending: Input[], ack: number): Input[][] {
  const fresh = pending.filter((i) => i.seq > ack).slice(-RESEND_MAX);
  const out: Input[][] = [];
  for (let i = 0; i < fresh.length; i += RESEND_CHUNK) out.push(fresh.slice(i, i + RESEND_CHUNK));
  return out;
}
