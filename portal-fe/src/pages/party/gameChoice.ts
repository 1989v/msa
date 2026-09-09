/**
 * 게임 선정 (ADR-0092 SR-5) — 갈래가 셋이다.
 *
 *   [게임 픽]  → 명부 규약을 구현한 게임 전체에서 방장이 하나 고른다
 *   [랜덤]     → 비참여형 중 무작위. 방장 클릭 한 번으로 바로 시작
 *   [참여형]   → 참여형 목록 → [랜덤] 또는 [하나 픽](익명 투표)
 *
 * **익명 투표는 `[참여형] → [하나 픽]` 에서만 뜬다.** 나머지 갈래는 방장이 정한다.
 */
export interface PartyGame {
  slug: string;
  title: string;
  /** 카탈로그 태그 — 능력 신호가 여기 들어 있다 */
  tags: string[];
}

export const ROSTER_READY = 'roster-ready';
export const INTERACTIVE = 'interactive-party';
export const INPUT_DECIDES = 'input-decides';

/** `[게임 픽]` 의 대상 — 명부를 읽는 게임만. 나머지는 명부를 무시하고 사용자는 이유를 모른다 */
export const pickable = (g: PartyGame) => g.tags.includes(ROSTER_READY);

/** `[랜덤]` 의 대상 — 비참여형만. 지켜보려던 사람이 갑자기 조작을 요구받으면 안 된다 */
export const inRandomPool = (g: PartyGame) => pickable(g) && !g.tags.includes(INTERACTIVE);

/** 참여형 목록 */
export const isInteractive = (g: PartyGame) => pickable(g) && g.tags.includes(INTERACTIVE);

/** 입력을 중계해야 하는가 — 안 하면 기기마다 다른 판이 된다 */
export const needsInputRelay = (g: PartyGame) => g.tags.includes(INPUT_DECIDES);

/**
 * 새 필드를 안 읽는 게임은 목록에서 **조절 불가로 표시**한다.
 * 조용히 무시하면 사용자가 설정이 먹은 줄 안다.
 */
export const supportsRoundOptions = (g: PartyGame) => g.tags.includes(ROSTER_READY);

export type Branch = 'pick' | 'random' | 'interactive';

/** 갈래별로 화면에 낼 목록 */
export function candidates(games: PartyGame[], branch: Branch): PartyGame[] {
  if (branch === 'pick') return games.filter(pickable);
  if (branch === 'random') return games.filter(inRandomPool);
  return games.filter(isInteractive);
}

/** `[랜덤]` — 목록이 비면 고를 것이 없다는 뜻이라 null 이다(자리가 멈추지 않게 화면이 안내한다) */
export function randomFrom(games: PartyGame[], rand: () => number = Math.random): PartyGame | null {
  if (games.length === 0) return null;
  return games[Math.floor(rand() * games.length)] ?? null;
}

/** 투표가 뜨는 자리 — 참여형에서 하나 픽할 때만이다 */
export const votingApplies = (branch: Branch, mode: 'random' | 'pick') =>
  branch === 'interactive' && mode === 'pick';
