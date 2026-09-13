// 운영 릴레이의 공개 방 목록 실측 (2026-09-13). 브라우저 없이 WebSocket 으로 직접 묻는다 —
// 이 기능은 JVM 릴레이(GameRelayRegistry.listRooms)에 있으므로 게임 번들이 아니라 서버를 재야 한다.
// A 가 공개 방, B 가 비공개 방을 만들고 C 가 목록을 물어 **공개 방만** 오는지 본다.
// 사용: node tools/e2e-prod-rooms.mjs [wsUrl]
const url = process.argv[2] ?? 'wss://game.1989v.com/ws/games/arena';
const checks = {};
const open = (nick) => new Promise((res, rej) => {
  const ws = new WebSocket(url);
  const q = [];
  const waiters = [];
  ws.onmessage = (e) => { const m = JSON.parse(e.data); const w = waiters.shift(); if (w) w(m); else q.push(m); };
  ws.onerror = () => rej(new Error('연결 실패'));
  ws.onopen = () => res({
    ws, nick,
    send: (o) => ws.send(JSON.stringify(o)),
    next: (ms = 6000) => new Promise((r, j) => {
      if (q.length) return r(q.shift());
      const t = setTimeout(() => j(new Error(`${nick}: 응답 없음`)), ms);
      waiters.push((m) => { clearTimeout(t); r(m); });
    }),
  });
});
const peers = [];
try {
  const a = await open('공개'), b = await open('비공개'), c = await open('구경');
  peers.push(a, b, c);
  a.send({ t: 'join', room: null, nick: '공개방장', seats: 8, private: true, manualStart: true, listed: true });
  const aj = await a.next();
  b.send({ t: 'join', room: null, nick: '비공개방장', seats: 8, private: true, manualStart: true });
  await b.next();
  c.send({ t: 'join', room: null, nick: '구경꾼', seats: 8, private: true, manualStart: true });
  await c.next();
  c.send({ t: 'rooms' });
  let listed = await c.next();
  for (let i = 0; i < 5 && listed.t !== 'rooms'; i++) listed = await c.next();
  const codes = (listed.rooms ?? []).map((r) => r.code);
  console.log(`공개 방 코드 ${aj.room} · 목록 ${JSON.stringify(listed.rooms ?? [])}`);
  checks.opRecognised = listed.t === 'rooms';
  checks.publicListed = codes.includes(aj.room);
  checks.privateHidden = (listed.rooms ?? []).every((r) => r.host !== '비공개방장');
  const mine = (listed.rooms ?? []).find((r) => r.code === aj.room);
  checks.rowShape = !!mine && mine.n === 1 && mine.cap === 8 && mine.host === '공개방장';
  console.log(`checks ${JSON.stringify(checks)}`);
  process.exitCode = Object.values(checks).every(Boolean) ? 0 : 1;
} catch (e) {
  console.error('FAIL', e.message, JSON.stringify(checks));
  process.exitCode = 1;
} finally { for (const p of peers) { try { p.send({ t: 'leave' }); p.ws.close(); } catch { /* 무시 */ } } }
