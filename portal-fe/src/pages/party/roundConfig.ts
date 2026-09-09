import type { PartyMode } from '../games/party';

/**
 * 판 구성 (ADR-0092 SR-3) — 시작 전에 정하는 것.
 *
 * **그룹과 판 참가자는 다른 것이다.** 오늘 안 온 사람은 토글로 이번 판에서만 빼고 그룹은
 * 그대로 둔다. 그 둘을 한 개념으로 묶으면 매번 명부를 다시 적게 되어 기능의 동기가 사라진다.
 *
 * **판 설정은 저장되지 않는다.** 다음 판은 기본값에서 시작한다 — 지난 판의 비율이 남아 있으면
 * 누가 언제 그걸 올렸는지 아무도 기억하지 못한 채 결과가 기운다.
 */
export interface RosterEntry {
  alias: string;
  /** 이번 판에 참가하는가. 끄는 것이 그룹을 바꾸지 않는다 */
  included: boolean;
  /** 사람별 비율 — 1 이 기본. 올린 만큼 당첨 확률이 오른다 */
  weight: number;
}

export interface RoundConfig {
  entries: RosterEntry[];
  mode: PartyMode;
  /** 걸리는 인원 수 */
  pick: number;
}

export const MAX_WEIGHT = 9;
export const MIN_PLAYERS = 2;

/** 그룹에서 판을 연다 — 전원이 체크된 기본값이다 */
export function fromGroup(aliases: string[]): RoundConfig {
  return {
    entries: aliases.map((alias) => ({ alias, included: true, weight: 1 })),
    mode: 'last',
    pick: 1,
  };
}

/**
 * 이번 판에서만 빼고 넣는다.
 *
 * **새 객체를 돌려준다** — 원본을 제자리에서 고치면 그룹을 들고 있는 쪽이 같은 배열을
 * 가리키고 있을 때 그룹까지 바뀐다. 이 스펙에서 가장 오해하기 쉬운 지점이라 자료구조로 막는다.
 */
export function toggle(config: RoundConfig, index: number): RoundConfig {
  return {
    ...config,
    entries: config.entries.map((e, i) => (i === index ? { ...e, included: !e.included } : e)),
  };
}

export function setWeight(config: RoundConfig, index: number, weight: number): RoundConfig {
  const clamped = Math.max(1, Math.min(MAX_WEIGHT, Math.floor(weight) || 1));
  return {
    ...config,
    entries: config.entries.map((e, i) => (i === index ? { ...e, weight: clamped } : e)),
  };
}

export function setMode(config: RoundConfig, mode: PartyMode): RoundConfig {
  // `order` 에서는 걸리는 인원 수가 뜻이 없다 — 화면이 그 조합을 만들지 않는다
  return { ...config, mode, pick: mode === 'order' ? 1 : config.pick };
}

export function setPick(config: RoundConfig, pick: number): RoundConfig {
  if (config.mode === 'order') return config;
  const max = Math.max(1, players(config).length - 1);
  return { ...config, pick: Math.max(1, Math.min(max, Math.floor(pick) || 1)) };
}

/** 이번 판에 실제로 참가하는 사람 */
export function players(config: RoundConfig): RosterEntry[] {
  return config.entries.filter((e) => e.included);
}

/** 시작할 수 있는가 — 둘 미만이면 정할 것이 없다 */
export function canStart(config: RoundConfig): boolean {
  return players(config).length >= MIN_PLAYERS;
}

/**
 * 명부 규약으로 넘길 모양 (ADR-0092 SR-8).
 *
 * 걸리는 인원은 참가자 수보다 작아야 한다 — 전원이 걸리면 정하는 것이 없다.
 * 규약 쪽에서도 같은 상한을 걸지만, 화면이 먼저 막아야 사용자가 왜 잘렸는지 안다.
 */
export function toHandoff(config: RoundConfig, room?: string) {
  const list = players(config);
  return {
    names: list.map((e) => e.alias),
    mode: config.mode,
    pick: config.mode === 'order' ? 1 : Math.min(config.pick, Math.max(1, list.length - 1)),
    weights: list.map((e) => e.weight),
    room,
  };
}
