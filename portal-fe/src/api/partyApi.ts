import { gameHttp } from './gameApi';

/**
 * 파티 세션 API (ADR-0092).
 *
 * 두 갈래다 — **친구 그룹은 로그인 전용**(계정에 저장하겠다고 켠 사람만)이고,
 * **판 진행은 좌석 토큰이 신원**이라 로그인을 요구하지 않는다. 초대 링크로 들어온
 * 게스트가 참가자이기 때문이다.
 */

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface FriendGroup {
  id: number;
  name: string;
  aliases: string[];
}

export interface RosterList {
  /** 계정 저장을 켰는가. 꺼져 있으면 서버에 아무것도 없다 */
  optedIn: boolean;
  groups: FriendGroup[];
}

const ROSTERS = '/api/v1/games/party/rosters';

export async function fetchRosters(): Promise<RosterList> {
  const res = await gameHttp.get<ApiResponse<RosterList>>(ROSTERS);
  return res.data.data;
}

/**
 * 계정 저장 토글. **끄면 서버본을 응답으로 돌려준 뒤 지운다** — 화면이 그 값을 기기에
 * 내려받아야 최신본이 사라지지 않는다.
 */
export async function setRosterOptIn(enabled: boolean): Promise<RosterList> {
  const res = await gameHttp.put<ApiResponse<RosterList>>(`${ROSTERS}/opt-in`, { enabled });
  return res.data.data;
}

export async function saveFriendGroup(
  group: { id?: number; name: string; aliases: string[]; overwrite?: boolean },
): Promise<FriendGroup> {
  const body = { name: group.name, aliases: group.aliases, overwrite: group.overwrite ?? false };
  const res = group.id
    ? await gameHttp.put<ApiResponse<FriendGroup>>(`${ROSTERS}/${group.id}`, body)
    : await gameHttp.post<ApiResponse<FriendGroup>>(ROSTERS, body);
  return res.data.data;
}

export async function deleteFriendGroup(groupId: number): Promise<void> {
  await gameHttp.delete(`${ROSTERS}/${groupId}`);
}

/* ── 판 진행 — 좌석 토큰이 신원이다 ─────────────────────────────── */

export interface VoteView {
  open: boolean;
  candidates: string[];
  /** 아직 안 닫혔으면 비어 있다 — 중간 집계가 보이면 뒤에 낸 사람이 흐름을 읽는다 */
  tally: Record<string, number>;
  submitted: number;
  winner: string | null;
}

/** 좌석 신원 — 릴레이가 좌석을 줄 때 발급한 값이라 HTTP 로는 위조할 수 없다 */
export interface SeatAuth {
  room: string;
  seat: number;
  token: string;
}

const seatHeaders = (auth: SeatAuth) => ({
  headers: { 'X-Party-Seat': String(auth.seat), 'X-Party-Token': auth.token },
});

const roomPath = (auth: SeatAuth) => `/api/v1/games/party/rooms/${auth.room}`;

export async function openVote(auth: SeatAuth, candidates: string[]): Promise<VoteView> {
  const res = await gameHttp.post<ApiResponse<VoteView>>(
    `${roomPath(auth)}/votes`,
    { candidates },
    seatHeaders(auth),
  );
  return res.data.data;
}

export async function castBallot(auth: SeatAuth, choice: string): Promise<VoteView> {
  const res = await gameHttp.post<ApiResponse<VoteView>>(
    `${roomPath(auth)}/votes/ballots`,
    { choice },
    seatHeaders(auth),
  );
  return res.data.data;
}

export async function fetchVote(auth: SeatAuth): Promise<VoteView> {
  const res = await gameHttp.get<ApiResponse<VoteView>>(`${roomPath(auth)}/votes`, seatHeaders(auth));
  return res.data.data;
}
