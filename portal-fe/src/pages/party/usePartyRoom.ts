import { useCallback, useEffect, useRef, useState } from 'react';
import { EMPTY_STATE, errorText, reduce, type PartyState } from './partyRelay';

/**
 * 파티 방 소켓 (ADR-0092) — 게임 쪽 `public/games/lib/relay.js` 와 같은 프로토콜.
 *
 * **자리 배정은 릴레이가 하고 이름은 사람이 고른다.** 릴레이는 좌석 번호까지만 알고,
 * 「그 자리에 누가 앉았는가」는 방장이 명부를 뿌리고 각자 고르는 것으로 정해진다 —
 * 서버에 별칭을 올리지 않기 위해서다(방침 §6, 별칭은 기기에만).
 */

/** 프록시 유휴 타임아웃과 서버 60초 ping 요구를 함께 넘는다 — relay.js 와 같은 값 */
const PING_MS = 25_000;

const SLUG = 'party';

/** 방장이 뿌리는 명부와, 각 좌석이 고른 이름 */
export interface RoomRoster {
  names: string[];
  /** 좌석 → 고른 이름 */
  taken: Record<number, string>;
}

export interface PartyRoom extends PartyState {
  connected: boolean;
  roster: RoomRoster;
  /** 방에 들어와 있는 좌석 번호 */
  occupied: number[];
  /** 방장이 판을 열며 실어 보낸 설정 — 참가자는 이걸로 어느 게임인지 안다 */
  cfg: Record<string, unknown> | null;
}

const EMPTY_ROOM: PartyRoom = {
  ...EMPTY_STATE,
  connected: false,
  roster: { names: [], taken: {} },
  occupied: [],
  cfg: null,
};

function socketUrl(): string {
  const scheme = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
  return `${scheme}${window.location.host}/ws/games/${SLUG}`;
}

export interface PartyRoomApi {
  room: PartyRoom;
  /** 방을 연다 — 코드는 서버가 발급한다 */
  host: (seats: number) => void;
  /** 초대 코드로 들어간다 */
  join: (code: string, spectate?: boolean) => void;
  /** 방장이 명부를 뿌린다 */
  shareRoster: (names: string[]) => void;
  /** 참가자가 이름을 고른다 */
  claimName: (name: string) => void;
  /** 방장이 판을 연다 — 시드는 서버가 그 순간 뽑는다 */
  startRound: (cfg: Record<string, unknown>) => void;
  leave: () => void;
}

export function usePartyRoom(): PartyRoomApi {
  const [room, setRoom] = useState<PartyRoom>(EMPTY_ROOM);
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<number>(0);
  /* 방장이 들고 있는 배정본. 상태로만 두면 메시지 핸들러가 옛 값을 붙잡는다 */
  const rosterRef = useRef<RoomRoster>({ names: [], taken: {} });
  const seatRef = useRef<number>(-1);

  const send = useCallback((obj: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  }, []);

  const teardown = useCallback(() => {
    window.clearInterval(timerRef.current);
    const old = wsRef.current;
    wsRef.current = null;
    if (old) {
      old.onclose = null;
      old.onmessage = null;
      old.onerror = null;
      try {
        old.close();
      } catch {
        // 이미 닫힌 소켓
      }
    }
  }, []);

  const publishRoster = useCallback(() => {
    send({ t: 'move', d: { roster: rosterRef.current.names, taken: rosterRef.current.taken } });
  }, [send]);

  const open = useCallback(
    (joinArgs: Record<string, unknown>) => {
      teardown();
      rosterRef.current = { names: rosterRef.current.names, taken: {} };
      seatRef.current = -1;
      setRoom({ ...EMPTY_ROOM, roster: rosterRef.current });

      let ws: WebSocket;
      try {
        ws = new WebSocket(socketUrl());
      } catch {
        setRoom((s) => ({ ...s, error: '이 브라우저에서는 방을 열 수 없습니다.' }));
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        send(joinArgs);
        timerRef.current = window.setInterval(() => send({ t: 'ping' }), PING_MS);
      };

      ws.onmessage = (ev) => {
        if (wsRef.current !== ws) return;
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(ev.data as string) as Record<string, unknown>;
        } catch {
          return;
        }

        if (msg.t === 'ping') {
          send({ t: 'pong' });
          return;
        }

        /* 배정본은 ref 에 먼저 쓴다 — 상태 업데이터 안에서 고치면 React 가 그 함수를
           두 번 부를 때 좌석 배정이 두 번 반영되고, 거기서 소켓까지 보내면 방송도 두 번 나간다.
           보내기는 setRoom 밖에서 한 번만 한다. */
        const seat = Number(msg.seat);
        let republish = false;

        switch (msg.t) {
          case 'joined':
            seatRef.current = typeof msg.seat === 'number' ? msg.seat : -1;
            break;
          case 'seat':
            // 새로 들어온 사람에게도 명부가 보여야 이름을 고를 수 있다
            republish = seatRef.current === 0;
            break;
          case 'left':
            if (seatRef.current === 0 && rosterRef.current.taken[seat] !== undefined) {
              const taken = { ...rosterRef.current.taken };
              delete taken[seat];
              rosterRef.current = { ...rosterRef.current, taken };
              republish = true;
            }
            break;
          case 'move': {
            const d = (msg.d ?? {}) as Record<string, unknown>;
            if (Array.isArray(d.roster)) {
              // 방장이 뿌린 명부 — 참가자 화면이 이것으로 이름 목록을 그린다
              rosterRef.current = {
                names: d.roster as string[],
                taken: (d.taken ?? {}) as Record<number, string>,
              };
            } else if (typeof d.claim === 'string' && seatRef.current === 0) {
              rosterRef.current = {
                ...rosterRef.current,
                taken: { ...rosterRef.current.taken, [seat]: d.claim },
              };
              republish = true;
            }
            break;
          }
          default:
            break;
        }

        setRoom((prev) => {
          const next: PartyRoom = { ...prev, ...(reduce(prev, msg) as PartyRoom), connected: true };
          next.roster = rosterRef.current;
          switch (msg.t) {
            case 'start':
              next.cfg = (msg.cfg ?? null) as Record<string, unknown> | null;
              break;
            case 'joined':
              next.occupied = next.seat >= 0 ? [next.seat] : [];
              break;
            case 'seat':
              next.occupied = prev.occupied.includes(seat) ? prev.occupied : [...prev.occupied, seat];
              break;
            case 'left':
              next.occupied = prev.occupied.filter((s) => s !== seat);
              break;
            default:
              break;
          }
          return next;
        });

        if (republish) publishRoster();
      };

      ws.onclose = () => {
        if (wsRef.current !== ws) return;
        window.clearInterval(timerRef.current);
        wsRef.current = null;
        // 릴레이는 단일 노드 in-memory 라 재배포에 방이 사라진다 — 조용히 두면 영영 기다린다
        setRoom((s) => ({ ...s, connected: false, lost: true }));
      };
    },
    [publishRoster, send, teardown],
  );

  useEffect(() => teardown, [teardown]);

  return {
    room,
    host: useCallback(
      (seats: number) => open({ t: 'join', room: null, nick: '', seats, private: true, manualStart: true }),
      [open],
    ),
    join: useCallback(
      (code: string, spectate = false) =>
        open({ t: 'join', room: code, nick: '', private: true, ...(spectate ? { spectate: true } : {}) }),
      [open],
    ),
    shareRoster: useCallback(
      (names: string[]) => {
        rosterRef.current = { ...rosterRef.current, names };
        setRoom((s) => ({ ...s, roster: rosterRef.current }));
        publishRoster();
      },
      [publishRoster],
    ),
    claimName: useCallback(
      (name: string) => {
        send({ t: 'move', d: { claim: name }, to: 0 });
        // 내 화면에도 바로 반영한다 — 방장의 되돌아오는 방송을 기다리면 눌러도 반응이 없다
        setRoom((s) => ({
          ...s,
          roster: { ...s.roster, taken: { ...s.roster.taken, [s.seat]: name } },
        }));
      },
      [send],
    ),
    startRound: useCallback((cfg: Record<string, unknown>) => send({ t: 'start', cfg }), [send]),
    leave: useCallback(() => {
      send({ t: 'leave' });
      teardown();
      setRoom(EMPTY_ROOM);
    }, [send, teardown]),
  };
}

export { errorText };
