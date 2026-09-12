// 매치 명단 — 방장이 점유 좌석과 대기실 선택으로 만든다. 순수 함수라 테스트가 곧바로 돈다.
// 관전 좌석(pick.spectate)은 명단에서 빠진다: 그 사람은 스냅샷만 받아 남을 따라 본다. 관전 좌석 번호에 봇을 넣지 않는다 —
// 좌석 번호 = 월드 플레이어 번호라 같은 번호에 사람과 봇이 겹치면 입력·ack 가 섞인다.
import { MODES, MAX_PLAYERS, makeRng, randomLoadout, type Pick, type RoomSettings, type RosterEntry } from '@amp/shared';

export const BOT_NAMES = ['봇-알파', '봇-브라보', '봇-찰리', '봇-델타', '봇-에코', '봇-폭스', '봇-골프', '봇-호텔'];

export interface SeatLike { name: string; pick: Pick | null }

export function buildRoster(occ: number[], seats: (SeatLike | null | undefined)[], settings: RoomSettings, seed: number): { roster: RosterEntry[]; spectators: number[] } {
  const teams = MODES[settings.mode].teams;
  const count = [0, 0];
  const roster: RosterEntry[] = [];
  const spectators: number[] = [];
  for (const seat of occ) {
    const s = seats[seat];
    const pick = s?.pick;
    if (pick?.spectate) { spectators.push(seat); continue; }
    const team = teams ? (pick && pick.team >= 0 ? pick.team : (count[0] <= count[1] ? 0 : 1)) : 0;
    count[team]++;
    roster.push({ id: seat, name: s?.name ?? `${seat + 1}번`, team, acc: pick?.acc ?? 'none', style: pick?.style ?? 'fighter', bot: false });
  }
  if (settings.fillBots) {
    const rng = makeRng(seed ^ 0x5bd1e995); // 봇 장비는 매치 시드로 무작위 — 게스트도 cfg 로 같은 값을 받는다
    for (let i = 0; i < MAX_PLAYERS; i++) {
      if (occ.includes(i)) continue;
      const team = teams ? (count[0] <= count[1] ? 0 : 1) : 0;
      count[team]++;
      const { style, acc } = randomLoadout(rng);
      roster.push({ id: i, name: BOT_NAMES[i], team, acc, style, bot: true });
    }
  }
  roster.sort((a, b) => a.id - b.id);
  return { roster, spectators };
}
