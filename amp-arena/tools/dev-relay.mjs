// 개발용 릴레이 — 게임 플랫폼 릴레이(`/ws/games/{slug}`, game/CLAUDE.md 「온라인 대전 릴레이」)를 로컬에서 흉내 낸다.
// 운영에는 배포되지 않는다. 상한(4096자 · 40 msg/s)을 **운영과 똑같이 끊어서** E2E 가 위반을 잡게 한다.
// 사용: PORT=8790 LOBBY_MS=30000 node tools/dev-relay.mjs   ·   GET /stats 로 최대 길이·초당 건수를 본다.
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT ?? 8790);
const LOBBY_MS = Number(process.env.LOBBY_MS ?? 30000);
const MAX_CHARS = 4096, MAX_PER_SEC = 40, MIN_SEATS = 2, MAX_SEATS = 20;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const rooms = new Map();   // key slug:code → room
const peers = new Set();
const stats = { conns: 0, maxChars: 0, maxPerSec: 0, closes: {}, messages: 0 };

const code6 = () => Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
const send = (peer, obj) => { if (peer.ws.readyState === peer.ws.OPEN) peer.ws.send(JSON.stringify(obj)); };
const error = (code) => ({ t: 'error', code });
const occupants = (room) => room.seats.filter(Boolean);
const hostOf = (room) => occupants(room).reduce((h, p) => (h === null || p.seat < h.seat ? p : h), null);

function newRoom(slug, seats, manualStart, priv) {
  const code = code6();
  const room = { key: `${slug}:${code}`, slug, code, seats: new Array(seats).fill(null), manualStart, private: priv, started: false, roundNo: 0, done: new Set(), createdMs: Date.now(), spectators: new Set() };
  rooms.set(room.key, room);
  return room;
}

function startRoom(room, cfg) {
  room.seed = Math.floor(Math.random() * 0x7fffffff);
  room.started = true;
  room.roundNo++;
  room.done.clear();
  const msg = { t: 'start', seed: room.seed, players: room.seats.map((p) => p?.nick ?? '') };
  if (room.manualStart) { msg.round = room.roundNo; if (cfg !== undefined) msg.cfg = cfg; }
  for (const p of occupants(room)) send(p, msg);
  for (const s of room.spectators) send(s, msg);
}

function leaveRoom(peer) {
  const room = peer.room;
  if (!room) return;
  if (peer.spectator) { room.spectators.delete(peer); peer.room = null; peer.spectator = false; if (!occupants(room).length && !room.spectators.size) rooms.delete(room.key); return; }
  const seat = peer.seat;
  if (room.seats[seat] === peer) room.seats[seat] = null;
  peer.room = null; peer.seat = -1;
  const remaining = occupants(room);
  const msg = room.seats.length === MIN_SEATS ? { t: 'opponentLeft' } : { t: 'left', seat };
  for (const p of remaining) send(p, msg);
  for (const s of room.spectators) send(s, msg);
  if (room.manualStart && room.started && remaining.length && remaining.every((p) => room.done.has(p.seat))) {
    room.started = false; room.done.clear();
    for (const p of remaining) send(p, { t: 'roundEnded', round: room.roundNo });
  }
  if (!remaining.length) { for (const s of room.spectators) { s.room = null; s.spectator = false; } rooms.delete(room.key); }
}

function join(peer, node) {
  if (peer.room) return send(peer, error('ALREADY_JOINED'));
  const requested = typeof node.room === 'string' && node.room ? node.room.toUpperCase() : null;
  peer.nick = String(node.nick ?? '').replace(/[\x00-\x1f<>]/g, '').trim().slice(0, 16) || `손님${peer.id}`;
  const seats = Math.min(MAX_SEATS, Math.max(MIN_SEATS, Number(node.seats) || MIN_SEATS));
  const priv = !!node.private, manualStart = !!node.manualStart, spectate = !!node.spectate;
  let room;
  if (priv && requested) { room = rooms.get(`${peer.slug}:${requested}`); if (!room) return send(peer, error('ROOM_NOT_FOUND')); }
  else if (priv) room = newRoom(peer.slug, seats, manualStart, true);
  else if (requested) room = rooms.get(`${peer.slug}:${requested}`) ?? newRoom(peer.slug, seats, false, false);
  else {
    room = [...rooms.values()].find((r) => r.slug === peer.slug && !r.private && !r.started && r.seats.some((s) => !s)) ?? newRoom(peer.slug, seats, false, false);
  }
  if (room.started && room.seats.length !== MIN_SEATS && !room.manualStart) return send(peer, error('ROOM_STARTED'));
  if (spectate) { room.spectators.add(peer); peer.room = room; peer.spectator = true; return send(peer, { t: 'joined', room: room.code, seat: -1, seats: room.seats.length }); }
  const free = room.seats.findIndex((s) => !s);
  if (free < 0) return send(peer, error('ROOM_FULL'));
  room.seats[free] = peer; peer.room = room; peer.seat = free;
  send(peer, { t: 'joined', room: room.code, seat: free, seats: room.seats.length, ...(room.manualStart ? { token: 'dev' } : {}) });
  const occ = occupants(room);
  if (room.seats.length !== MIN_SEATS) for (const p of occ) if (p !== peer) send(p, { t: 'seat', seat: free, nick: peer.nick });
  if (!room.manualStart && occ.length === room.seats.length) startRoom(room);
}

function move(peer, node) {
  const room = peer.room;
  if (!room) return send(peer, error('NOT_JOINED'));
  if (node.d === undefined) return send(peer, error('BAD_MESSAGE'));
  const out = { t: 'move', seat: peer.seat, d: node.d };
  if (Number.isInteger(node.to)) { const target = room.seats[node.to]; if (target && target !== peer) send(target, out); return; }
  for (const p of occupants(room)) if (p !== peer) send(p, out);
  for (const s of room.spectators) send(s, out);
}

function startCommand(peer, node) {
  const room = peer.room;
  if (!room || !room.manualStart) return send(peer, error('NOT_JOINED'));
  if (hostOf(room) !== peer) return send(peer, error('NOT_HOST'));
  if (room.started) return send(peer, error('ROUND_RUNNING'));
  startRoom(room, node.cfg);
}

function roundDone(peer) {
  const room = peer.room;
  if (!room || !room.manualStart || peer.spectator || !room.started) return;
  room.done.add(peer.seat);
  const occ = occupants(room);
  if (occ.every((p) => room.done.has(p.seat))) { room.started = false; room.done.clear(); for (const p of occ) send(p, { t: 'roundEnded', round: room.roundNo }); }
}

const server = createServer((req, res) => {
  if (req.url === '/stats') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ...stats, rooms: [...rooms.values()].map((r) => ({ code: r.code, seats: r.seats.map((p) => p?.nick ?? ''), started: r.started, manualStart: r.manualStart })) }));
    return;
  }
  res.writeHead(200, { 'content-type': 'text/plain' }); res.end('dev relay');
});
const wss = new WebSocketServer({ server, maxPayload: 64 * 1024 });
let nextId = 1;
wss.on('connection', (ws, req) => {
  const m = /^\/ws\/games\/([a-z0-9-]+)/.exec(req.url ?? '');
  if (!m) { ws.close(1008, 'BAD_PATH'); return; }
  const peer = { id: nextId++, ws, slug: m[1], nick: '', room: null, seat: -1, spectator: false, window: [] };
  peers.add(peer);
  stats.conns++;
  ws.on('message', (data) => {
    const raw = data.toString();
    stats.messages++;
    if (raw.length > stats.maxChars) stats.maxChars = raw.length;
    if (raw.length > MAX_CHARS) { stats.closes.TOO_LARGE = (stats.closes.TOO_LARGE ?? 0) + 1; send(peer, error('TOO_LARGE')); ws.close(1009, 'TOO_LARGE'); return; }
    const now = Date.now();
    while (peer.window.length && now - peer.window[0] >= 1000) peer.window.shift();
    peer.window.push(now);
    if (peer.window.length > stats.maxPerSec) stats.maxPerSec = peer.window.length;
    if (peer.window.length > MAX_PER_SEC) { stats.closes.RATE_LIMIT = (stats.closes.RATE_LIMIT ?? 0) + 1; send(peer, error('RATE_LIMIT')); ws.close(1008, 'RATE_LIMIT'); return; }
    let node;
    try { node = JSON.parse(raw); } catch { return send(peer, error('BAD_MESSAGE')); }
    switch (node?.t) {
      case 'join': join(peer, node); break;
      case 'move': move(peer, node); break;
      case 'start': startCommand(peer, node); break;
      case 'done': roundDone(peer); break;
      case 'leave': leaveRoom(peer); break;
      case 'ping': send(peer, { t: 'pong' }); break;
      default: send(peer, error('BAD_MESSAGE'));
    }
  });
  ws.on('close', () => { leaveRoom(peer); peers.delete(peer); });
  ws.on('error', () => { leaveRoom(peer); peers.delete(peer); });
});

// 다인 방 로비 마감 — 인원 무관 강제 시작 (운영 30초)
setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.seats.length === MIN_SEATS || room.manualStart || room.started) continue;
    if (now - room.createdMs >= LOBBY_MS && occupants(room).length) startRoom(room);
  }
}, 250);

server.listen(PORT, '127.0.0.1', () => console.log(`dev relay on ws://127.0.0.1:${PORT}/ws/games/<slug> · lobby ${LOBBY_MS}ms · stats http://127.0.0.1:${PORT}/stats`));
