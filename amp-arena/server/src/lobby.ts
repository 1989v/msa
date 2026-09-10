// 로비: 세션 목록 + 방 목록. 방 밖 세션에게 방 목록 변화를 알린다.
import { MODES, MAPS, ROOM_NAME_MAX, type ClientMsg, type RoomSummary, type ServerMsg } from '@amp/shared';
import { Room } from './room.ts';
import type { Session } from './session.ts';

type CreateMsg = Extract<ClientMsg, { t: 'create' }>;

export class Lobby {
  readonly sessions = new Map<string, Session>();
  readonly rooms = new Map<string, Room>();
  private nextRoomNo = 1000;

  add(s: Session): void { this.sessions.set(s.sid, s); }
  remove(s: Session): void { this.sessions.delete(s.sid); this.broadcastRooms(); }

  list(): RoomSummary[] {
    return [...this.rooms.values()].map((r) => r.summary()).sort((a, b) => (a.phase === 'wait' ? 0 : 1) - (b.phase === 'wait' ? 0 : 1) || b.id.localeCompare(a.id));
  }

  create(s: Session, msg: CreateMsg): void {
    const name = typeof msg.name === 'string' && msg.name.trim() ? msg.name.replace(/[<>]/g, '').trim().slice(0, ROOM_NAME_MAX) : `${s.name}의 방`;
    const mode = msg.mode in MODES ? msg.mode : 'ffa_dm';
    const map = msg.map in MAPS ? msg.map : 'colosseum';
    const seconds = [120, 180, 300].includes(msg.seconds) ? msg.seconds : 180;
    const pass = typeof msg.pass === 'string' && msg.pass ? msg.pass.slice(0, 16) : '';
    const room = new Room(this, String(this.nextRoomNo++), name, s, mode, map, seconds, pass, msg.fillBots !== false);
    this.rooms.set(room.id, room);
    room.join(s);
    this.broadcastRooms();
  }

  join(s: Session, roomId: string, pass?: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return s.send({ t: 'err', msg: '방이 없습니다' });
    if (room.pass && room.pass !== pass) return s.send({ t: 'err', msg: '비밀번호가 다릅니다' });
    if (room.isFull()) return s.send({ t: 'err', msg: '방이 가득 찼습니다' });
    room.join(s);
    this.broadcastRooms();
  }

  removeRoom(room: Room): void {
    this.rooms.delete(room.id);
    this.broadcastRooms();
  }

  broadcastRooms(): void {
    const msg: ServerMsg = { t: 'rooms', rooms: this.list(), online: this.sessions.size };
    for (const s of this.sessions.values()) if (!s.room) s.send(msg);
  }

  broadcastLobby(msg: ServerMsg): void {
    for (const s of this.sessions.values()) if (!s.room) s.send(msg);
  }
}
