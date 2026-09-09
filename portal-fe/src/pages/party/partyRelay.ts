/**
 * 파티 방 연결 (ADR-0092) — 게임의 공용 릴레이 클라이언트와 같은 프로토콜을 쓴다.
 *
 * FE 가 자기 구현을 갖는 이유는 파티 **화면**이 게임 iframe 밖에 있기 때문이다.
 * 프로토콜이 갈리지 않게 메시지 모양을 여기 한 곳에 적어 둔다 —
 * 게임 쪽 원본은 `public/games/lib/relay.js` 다.
 */
export interface PartySeat {
  seat: number;
  nick: string;
}

export interface PartyState {
  /** 방 코드 — 초대 링크와 QR 이 이 값을 담는다 */
  room: string | null;
  /** 내 좌석. 관전자는 -1 */
  seat: number;
  seats: number;
  /** 좌석 토큰 — 투표·채점·해시 제출이 이 값을 쓴다. 관전자는 빈 문자열 */
  token: string;
  round: number;
  players: string[];
  /** 방이 사라졌다 — 릴레이는 in-memory 단일 노드라 재배포에 방이 없어진다 */
  lost: boolean;
  error: string | null;
}

export const EMPTY_STATE: PartyState = {
  room: null,
  seat: -1,
  seats: 0,
  token: '',
  round: 0,
  players: [],
  lost: false,
  error: null,
};

/** 릴레이 오류 코드 → 사람이 읽는 문장. 막다른 길을 만들지 않으려면 복귀 안내가 함께 가야 한다 */
export const ERROR_TEXT: Record<string, string> = {
  ROOM_NOT_FOUND: '그 방이 없습니다. 코드를 다시 확인하거나 새 방을 여세요.',
  ROOM_FULL: '자리가 다 찼습니다. 관전으로 들어갈 수 있습니다.',
  ROOM_LIMIT: '지금은 방을 더 열 수 없습니다. 잠시 뒤 다시 시도하세요.',
  ROOM_STARTED: '판이 진행 중입니다. 끝나면 자동으로 들어갑니다.',
  NOT_HOST: '방장만 시작할 수 있습니다.',
  ROUND_RUNNING: '이미 판이 돌고 있습니다.',
  BAD_ROOM: '방 코드 형식이 올바르지 않습니다.',
};

export function errorText(code: string): string {
  return ERROR_TEXT[code] ?? '연결에 문제가 있습니다. 새 방을 열어 다시 초대하세요.';
}

/**
 * 릴레이 메시지를 상태에 접는다.
 *
 * 순수 함수로 둔 이유는 **소켓 없이 검사할 수 있게** 하기 위해서다 — 화면 검사가
 * WebSocket 을 흉내 내기 시작하면 그 흉내가 판정 근거가 된다.
 */
export function reduce(state: PartyState, msg: Record<string, unknown>): PartyState {
  switch (msg.t) {
    case 'joined':
      return {
        ...state,
        room: String(msg.room ?? ''),
        seat: typeof msg.seat === 'number' ? msg.seat : -1,
        seats: Number(msg.seats ?? 0),
        token: String(msg.token ?? ''),
        lost: false,
        error: null,
      };
    case 'start':
      return {
        ...state,
        round: Number(msg.round ?? state.round),
        players: Array.isArray(msg.players) ? (msg.players as string[]) : state.players,
        token: msg.token ? String(msg.token) : state.token,
        error: null,
      };
    case 'error':
      return { ...state, error: errorText(String(msg.code ?? '')) };
    default:
      return state;
  }
}

/** 관전자인가 — 좌석이 없으면 표도 채점도 해시도 못 낸다 */
export const isSpectator = (s: PartyState) => s.seat < 0;

/** 방장인가 — 좌석 0. 승계 후에는 남은 좌석 중 가장 낮은 번호가 잇는다 */
export const isHost = (s: PartyState, occupied: number[]) =>
  s.seat >= 0 && s.seat === Math.min(...occupied, s.seat);

/** 초대 링크 — 별칭을 싣지 않는다. 웹서버 접근 로그에 남는다 */
export function inviteLink(room: string, origin = window.location.origin): string {
  return `${origin}/party/${room}`;
}
