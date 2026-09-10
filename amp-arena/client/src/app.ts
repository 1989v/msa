// 화면 흐름: 타이틀 → (연습 매치) | (로비 → 대기실 → 온라인 매치 → 결과 → 대기실)
import { ACCESSORIES, ACCESSORY_IDS, MODES, MODE_IDS, MAPS, type RoomState, type RoomSummary, type AccessoryId, type MapId, type ModeId, type ServerMsg } from '@amp/shared';
import { NetClient } from './net/client.ts';
import { NetSource } from './net/netsource.ts';
import { LocalSource } from './local/localsource.ts';
import { Match } from './game/match.ts';
import { icon, boltLogo, ACC_ICON } from './ui/icons.ts';

const MAP_IDS: MapId[] = ['colosseum', 'skydock'];
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const ACC_DESC: Record<AccessoryId, string> = {
  none: '잽 · 스트레이트 · 돌려차기 3단. 기술 V: 어퍼컷(띄움). 잡기 가능.',
  greatsword: '2단 대각 베기(넓은 호). 기술 V: 내려찍기 충격파. 이동 −10%, 잡기 불가.',
  spear: '3단 찌르기, 리치 2.2m. 기술 V: 6m 돌진 찌르기(관통).',
  pistols: '탄환 12발, 사거리 14m, 재장전 1.5초. 기술 V: 뒤로 구르며 부채꼴 6발.',
  shield: '방패 밀치기(넉백). 기술 V: 가드 유지 돌진. 가드 크러시 면역.',
  rocket: '펀치 리치 +0.4m. 기술 V: 로켓 펀치 발사(10m). 공중 대시 1회.',
};

function avatar(color: string, size = 84): string {
  return `<svg class="avatar" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">
    <ellipse cx="50" cy="94" rx="24" ry="5" fill="rgba(0,0,0,0.3)"></ellipse>
    <rect x="34" y="52" width="32" height="30" rx="6" fill="${color}" stroke="#1a1f3a" stroke-width="3"></rect>
    <rect x="36" y="80" width="11" height="12" rx="3" fill="#2f3a6e" stroke="#1a1f3a" stroke-width="3"></rect><rect x="53" y="80" width="11" height="12" rx="3" fill="#2f3a6e" stroke="#1a1f3a" stroke-width="3"></rect>
    <path d="M40 20 L36 8 L46 16 L50 4 L54 16 L64 8 L60 20 Z" fill="#2b2f4a" stroke="#1a1f3a" stroke-width="3"></path>
    <circle cx="50" cy="34" r="24" fill="#f6cfa6" stroke="#1a1f3a" stroke-width="3"></circle>
    <path d="M27 28 Q50 18 73 28" fill="none" stroke="#ffb020" stroke-width="7" stroke-linecap="round"></path>
    <circle cx="42" cy="36" r="4" fill="#1a1f3a"></circle><circle cx="58" cy="36" r="4" fill="#1a1f3a"></circle>
    <path d="M45 45 Q50 49 55 45" fill="none" stroke="#1a1f3a" stroke-width="2.5" stroke-linecap="round"></path>
  </svg>`;
}

const SLOT_COLORS = ['#ff6a2a', '#4488ff', '#4ade80', '#ffb020', '#a78bfa', '#33d1ff', '#f472b6', '#f5f2ea'];

export class App {
  private root: HTMLElement;
  private nick: string;
  private acc: AccessoryId = 'none';
  private net: NetClient | null = null;
  private sid = '';
  private match: Match | null = null;
  private room: RoomState | null = null;
  private rooms: RoomSummary[] = [];
  private online = 0;
  private chat: { from: string; text: string; system?: boolean }[] = [];
  private screen: HTMLElement | null = null;
  private view: 'title' | 'lobby' | 'room' | 'match' = 'title';
  private creating = false;
  private matchEnded = false;

  constructor(root: HTMLElement) {
    this.root = root;
    this.nick = localStorage.getItem('amp.nick') ?? '';
    this.acc = (localStorage.getItem('amp.acc') as AccessoryId) ?? 'none';
    if (!(this.acc in ACCESSORIES)) this.acc = 'none';
    this.showTitle();
  }

  private mount(html: string): HTMLElement {
    this.screen?.remove();
    const el = document.createElement('div');
    el.className = 'screen';
    el.innerHTML = html;
    this.root.appendChild(el);
    this.screen = el;
    return el;
  }

  private toast(msg: string): void {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    this.root.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }

  // ---------------- 타이틀 ----------------
  showTitle(): void {
    this.view = 'title';
    this.disposeMatch();
    const el = this.mount(`
      <div class="title-bg"></div>
      <div class="col" style="position:relative;align-items:center;gap:14px;width:100%">
        ${boltLogo(96).replace('font-size:96px', 'font-size:clamp(56px, 9vw, 120px)')}
        <div class="tagline">8인 실시간 대전 액션 · 브라우저에서 바로</div>
        <div class="panel title-form col">
          <span class="label">닉네임</span>
          <input class="field nick" maxlength="10" placeholder="2~10자, 이 세션에서만 사용" value="${esc(this.nick)}">
          <span class="label">악세서리</span>
          <div class="accs"></div>
          <div class="acc-desc muted" style="font-size:12px;min-height:34px"></div>
          <span class="label">연습 설정</span>
          <div class="row">
            <select class="field map" style="flex:1;height:38px">${MAP_IDS.map((m) => `<option value="${m}">${MAPS[m].name}</option>`).join('')}</select>
            <select class="field mode" style="flex:1;height:38px">${MODE_IDS.map((m) => `<option value="${m}" ${m === 'ffa_dm' ? 'selected' : ''}>${MODES[m].name}</option>`).join('')}</select>
            <select class="field bots" style="width:100px;height:38px"><option value="3">봇 3</option><option value="5">봇 5</option><option value="7" selected>봇 7</option></select>
            <select class="field secs" style="width:90px;height:38px"><option value="120">2분</option><option value="180" selected>3분</option><option value="300">5분</option></select>
          </div>
          <div class="row">
            <button class="btn primary practice" style="flex:1">연습 · 봇과 대전</button>
            <button class="btn go-lobby" style="flex:1">온라인 로비</button>
          </div>
        </div>
      </div>
      <span class="chip version">P1 · 2026-09</span>
      <div class="hints"><span class="row" style="gap:6px">${icon('keyboard', 20, 'var(--muted)')}키보드</span><span class="row" style="gap:6px">${icon('gamepad', 20, 'var(--muted)')}게임패드</span><span>우클릭 드래그 카메라</span></div>`);
    this.renderAccPicker(el.querySelector('.accs') as HTMLElement, el.querySelector('.acc-desc') as HTMLElement, (a) => { this.acc = a; localStorage.setItem('amp.acc', a); });
    const nickEl = el.querySelector('.nick') as HTMLInputElement;
    const readNick = () => { const n = nickEl.value.trim(); if (n.length < 2) { this.toast('닉네임은 2자 이상'); nickEl.focus(); return null; } this.nick = n; localStorage.setItem('amp.nick', n); return n; };
    (el.querySelector('.practice') as HTMLButtonElement).onclick = () => {
      if (!readNick()) return;
      this.startPractice({
        mapId: (el.querySelector('.map') as HTMLSelectElement).value as MapId,
        modeId: (el.querySelector('.mode') as HTMLSelectElement).value as ModeId,
        bots: Number((el.querySelector('.bots') as HTMLSelectElement).value),
        seconds: Number((el.querySelector('.secs') as HTMLSelectElement).value),
      });
    };
    (el.querySelector('.go-lobby') as HTMLButtonElement).onclick = () => { if (readNick()) this.connectOnline(); };
    nickEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') (el.querySelector('.practice') as HTMLButtonElement).click(); });
  }

  private renderAccPicker(container: HTMLElement, desc: HTMLElement, onPick: (a: AccessoryId) => void, enabled = true): void {
    const draw = () => {
      container.innerHTML = ACCESSORY_IDS.map((a) => `<button class="acc ${a === this.acc ? 'on' : ''}" data-acc="${a}" ${enabled ? '' : 'disabled'}>${icon(ACC_ICON[a], 28, a === this.acc ? '#1a1f3a' : 'var(--amp)', 2.2)}<span>${ACCESSORIES[a].name}</span></button>`).join('');
      desc.textContent = ACC_DESC[this.acc];
      container.querySelectorAll<HTMLButtonElement>('.acc').forEach((b) => { b.onclick = () => { this.acc = b.dataset.acc as AccessoryId; onPick(this.acc); draw(); }; });
    };
    draw();
  }

  private startPractice(o: { mapId: MapId; modeId: ModeId; bots: number; seconds: number }): void {
    const src = new LocalSource({ name: this.nick, acc: this.acc, mapId: o.mapId, modeId: o.modeId, seconds: o.seconds, bots: o.bots });
    this.runMatch(src, { onExit: () => this.showTitle(), onAgain: () => this.startPractice(o) });
  }

  private runMatch(src: LocalSource | NetSource, opts: { onExit: () => void; onAgain?: () => void }): void {
    this.disposeMatch();
    this.screen?.remove();
    this.screen = null;
    this.view = 'match';
    this.matchEnded = false;
    this.match = new Match(this.root, src, opts);
  }

  private disposeMatch(): void {
    if (this.match) { this.match.dispose(); this.match = null; }
  }

  // ---------------- 온라인 ----------------
  private async connectOnline(): Promise<void> {
    if (this.net?.connected) { this.showLobby(); return; }
    const net = new NetClient();
    this.net = net;
    try { await net.connect(); } catch (e) { this.toast((e as Error).message); this.net = null; return; }
    net.onClose = () => { if (this.view !== 'title') { this.toast('서버 연결이 끊겼습니다'); this.net = null; this.showTitle(); } };
    net.on('welcome', (m) => { this.sid = m.sid; this.nick = m.name; });
    net.on('rooms', (m) => { this.rooms = m.rooms; this.online = m.online; if (this.view === 'lobby') this.showLobby(); });
    net.on('room', (m) => this.onRoom(m.room));
    net.on('left', () => { this.room = null; this.chat = []; this.disposeMatch(); this.showLobby(); net.send({ t: 'list' }); });
    net.on('chat', (m) => { this.chat.push(m); if (this.chat.length > 40) this.chat.shift(); this.refreshChat(); });
    net.on('err', (m) => this.toast(m.msg));
    net.on('start', (m) => this.onStart(m));
    net.send({ t: 'hello', name: this.nick });
    this.chat = [];
    this.showLobby();
  }

  private onRoom(room: RoomState): void {
    const prev = this.room;
    this.room = room;
    if (this.view === 'match') {
      // 결과 화면이 끝나 방이 대기 상태로 돌아오면 대기실로
      if (room.phase === 'wait' && prev && prev.phase !== 'wait') { this.disposeMatch(); this.showRoom(); }
      return;
    }
    this.showRoom();
  }

  private onStart(m: Extract<ServerMsg, { t: 'start' }>): void {
    if (!this.net) return;
    const src = new NetSource(this.net, m);
    this.runMatch(src, { onExit: () => { this.disposeMatch(); this.showRoom(); } });
  }

  private topbar(mid: string, right: string): string {
    return `<div class="topbar"><div class="row" style="gap:18px">${boltLogo(30)}${mid}</div><div class="row">${right}</div></div>`;
  }

  private chatPanel(placeholder: string): string {
    return `<div class="panel chat"><div class="log"></div><div class="row"><input class="field chat-in" style="flex:1;height:36px;font-size:13px" maxlength="120" placeholder="${placeholder}"><button class="btn chat-send" style="height:36px;font-size:13px">보내기</button></div></div>`;
  }

  private wireChat(el: HTMLElement): void {
    const input = el.querySelector('.chat-in') as HTMLInputElement | null;
    const send = el.querySelector('.chat-send') as HTMLButtonElement | null;
    if (!input || !send) return;
    const go = () => { const t = input.value.trim(); if (!t) return; this.net?.send({ t: 'chat', text: t }); input.value = ''; };
    send.onclick = go;
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    this.refreshChat();
  }

  private refreshChat(): void {
    const log = this.screen?.querySelector('.chat .log') as HTMLElement | null;
    if (!log) return;
    log.innerHTML = this.chat.map((c) => `<div class="${c.system ? 'sys' : ''}"><b>${esc(c.from)}</b><span class="muted"> : </span>${esc(c.text)}</div>`).join('');
    log.scrollTop = log.scrollHeight;
  }

  showLobby(): void {
    this.view = 'lobby';
    const wait = this.rooms.filter((r) => r.phase === 'wait').length;
    const rows = this.rooms.map((r) => `<div class="room-row" data-id="${r.id}" data-locked="${r.locked ? 1 : 0}">
        <span class="num muted">#${r.id}</span>
        <span class="row" style="gap:6px;font-weight:700">${r.locked ? icon('lock', 14, 'var(--amp)') : ''}${esc(r.name)}</span>
        <span class="muted" style="font-size:12px">${MODES[r.mode].name}</span>
        <span class="muted" style="font-size:12px">${MAPS[r.map].name}</span>
        <span class="num" style="font-weight:700">${r.count} / ${r.max}</span>
        <span class="chip ${r.phase === 'wait' ? 'green' : 'red'}" style="font-size:11px">${r.phase === 'wait' ? '대기중' : '게임중'}</span>
      </div>`).join('');
    const el = this.mount(`
      ${this.topbar(`<span class="chip amp">자유 1</span>`, `<span class="chip">접속 ${this.online}</span><span class="chip amp">${esc(this.nick)}</span>`)}
      <div class="lobby" style="grid-template-columns:240px minmax(0, 1fr)">
        <div class="panel me col" style="align-content:start">
          <div style="display:flex;justify-content:center">${avatar(SLOT_COLORS[0], 96)}</div>
          <div class="display" style="font-size:24px;text-align:center">${esc(this.nick)}</div>
          <div class="row" style="justify-content:center"><span class="chip">${ACCESSORIES[this.acc].name} 선호</span></div>
          <button class="btn primary create">${icon('plus', 18, '#1a1f3a', 2.4)}방 만들기</button>
          <button class="btn refresh">${icon('refresh', 18)}새로고침</button>
          <button class="btn ghost back">${icon('door', 18)}타이틀로</button>
          <div class="create-form col" style="display:none">
            <span class="label">새 방</span>
            <input class="field rname" maxlength="24" placeholder="방 이름" value="${esc(this.nick)}의 방" style="height:38px;font-size:13px">
            <select class="field rmode" style="height:38px;font-size:13px">${MODE_IDS.map((m) => `<option value="${m}" ${m === 'team_dm' ? 'selected' : ''}>${MODES[m].name}</option>`).join('')}</select>
            <select class="field rmap" style="height:38px;font-size:13px">${MAP_IDS.map((m) => `<option value="${m}">${MAPS[m].name}</option>`).join('')}</select>
            <select class="field rsec" style="height:38px;font-size:13px"><option value="120">2분</option><option value="180" selected>3분</option><option value="300">5분</option></select>
            <input class="field rpass" maxlength="16" placeholder="비밀번호 (선택)" style="height:38px;font-size:13px">
            <label class="row" style="font-size:13px"><input type="checkbox" class="rbots" checked> 빈 자리는 봇으로 채움</label>
            <button class="btn primary rgo">만들기</button>
          </div>
        </div>
        <div class="center">
          <div class="panel col" style="flex:1;min-height:0">
            <div class="row" style="justify-content:space-between"><span class="label">방 목록 · 자유 1 채널</span><div class="row" style="gap:6px"><span class="chip" style="color:var(--green)">대기중 ${wait}</span><span class="chip" style="color:var(--red)">게임중 ${this.rooms.length - wait}</span></div></div>
            <div class="room-row head"><span>번호</span><span>방 이름</span><span>모드</span><span>맵</span><span>인원</span><span>상태</span></div>
            <div class="rooms">${rows || `<div class="muted" style="padding:24px;text-align:center">방이 없습니다. 첫 방을 만들어 보세요.</div>`}</div>
          </div>
          ${this.chatPanel('채널 대화 · Enter')}
        </div>
      </div>`);
    const form = el.querySelector('.create-form') as HTMLElement;
    (el.querySelector('.create') as HTMLButtonElement).onclick = () => { this.creating = !this.creating; form.style.display = this.creating ? '' : 'none'; };
    if (this.creating) form.style.display = '';
    (el.querySelector('.rgo') as HTMLButtonElement).onclick = () => {
      this.net?.send({
        t: 'create', name: (el.querySelector('.rname') as HTMLInputElement).value, mode: (el.querySelector('.rmode') as HTMLSelectElement).value as ModeId,
        map: (el.querySelector('.rmap') as HTMLSelectElement).value as MapId, seconds: Number((el.querySelector('.rsec') as HTMLSelectElement).value),
        pass: (el.querySelector('.rpass') as HTMLInputElement).value || undefined, fillBots: (el.querySelector('.rbots') as HTMLInputElement).checked,
      });
      this.creating = false;
    };
    (el.querySelector('.refresh') as HTMLButtonElement).onclick = () => this.net?.send({ t: 'list' });
    (el.querySelector('.back') as HTMLButtonElement).onclick = () => { this.net?.close(); this.net = null; this.showTitle(); };
    el.querySelectorAll<HTMLElement>('.room-row[data-id]').forEach((row) => {
      row.onclick = () => {
        const pass = row.dataset.locked === '1' ? window.prompt('비밀번호') ?? '' : undefined;
        this.net?.send({ t: 'join', roomId: row.dataset.id!, pass });
      };
    });
    this.wireChat(el);
  }

  showRoom(): void {
    const room = this.room;
    if (!room) { this.showLobby(); return; }
    this.view = 'room';
    const isHost = room.host === this.sid;
    const teams = MODES[room.mode].teams;
    const mySlot = room.slots.find((s) => s && s.sid === this.sid);
    const slots = room.slots.map((s, i) => {
      if (!s) return `<div class="slot empty">${icon('plus', 26, 'var(--dim)')}<span style="font-size:12px;font-weight:700">빈 자리${room.fillBots ? ' · 봇으로 채움' : ''}</span></div>`;
      const me = s.sid === this.sid;
      const status = s.sid === room.host ? '<span class="chip amp">방장</span>' : s.bot ? '<span class="chip">봇</span>' : s.ready ? '<span class="chip green">준비</span>' : '<span class="chip">대기</span>';
      return `<div class="slot ${teams ? (s.team === 0 ? 'red' : 'blue') : ''}">
        <span class="tag" style="color:${teams ? (s.team === 0 ? 'var(--red)' : 'var(--blue)') : 'var(--dim)'}">${teams ? (s.team === 0 ? '레드' : '블루') : '슬롯'} ${i + 1}</span>
        ${s.sid === room.host ? `<span class="crown">${icon('crown', 18, 'var(--amp)', 2.4)}</span>` : ''}
        ${avatar(SLOT_COLORS[i], 84)}
        <div style="font-size:14px;font-weight:800;${me ? 'color:var(--amp)' : ''}">${esc(s.name)}</div>
        <div class="row" style="gap:6px">${status}<span class="chip" style="font-size:11px">${ACCESSORIES[s.acc].name}</span></div>
      </div>`;
    }).join('');
    const sel = (cls: string, opts: [string, string][], cur: string) => `<select class="field ${cls}" ${isHost ? '' : 'disabled'}>${opts.map(([v, l]) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    const humans = room.slots.filter((s) => s && !s.bot);
    const readyCount = humans.filter((s) => s!.ready || s!.sid === room.host).length;
    const el = this.mount(`
      ${this.topbar(`<span style="font-size:16px;font-weight:800">${esc(room.name)}</span><span class="num muted">#${room.id}</span><span class="chip">${MODES[room.mode].name} · ${MAPS[room.map].name} · ${room.seconds / 60}분</span>`,
        `${teams ? `<span class="chip">레드 ${room.slots.filter((s) => s && s.team === 0).length} : ${room.slots.filter((s) => s && s.team === 1).length} 블루</span>` : ''}<button class="btn ghost leave" style="height:34px;font-size:13px">${icon('door', 16)}나가기</button>`)}
      <div class="room">
        <div class="top">
          <div class="slots">${slots}</div>
          <div class="side">
            <div class="panel settings col" style="gap:6px">
              <div class="row" style="justify-content:space-between"><span class="label">매치 설정</span><span class="chip" style="font-size:11px">${isHost ? '방장' : '방장만 변경'}</span></div>
              <div class="kv"><span class="muted">모드</span>${sel('smode', MODE_IDS.map((m) => [m, MODES[m].name]), room.mode)}</div>
              <div class="kv"><span class="muted">맵</span>${sel('smap', MAP_IDS.map((m) => [m, MAPS[m].name]), room.map)}</div>
              <div class="kv"><span class="muted">시간</span>${sel('ssec', [['120', '2분'], ['180', '3분'], ['300', '5분']], String(room.seconds))}</div>
              <div class="kv"><span class="muted">빈 자리</span>${sel('sbots', [['1', '봇으로 채움'], ['0', '비워 둠']], room.fillBots ? '1' : '0')}</div>
              <div class="kv"><span class="muted">비밀번호</span><b>${room.locked ? '있음' : '없음'}</b></div>
            </div>
            <div class="panel col">
              <div class="row" style="justify-content:space-between"><span class="label">악세서리</span><span class="chip" style="font-size:11px">매치 중 교체 불가</span></div>
              <div class="accs"></div>
              <div class="acc-desc muted" style="font-size:12px;min-height:34px"></div>
            </div>
          </div>
        </div>
        <div class="bottom">
          ${this.chatPanel('대기실 대화 · Enter')}
          <button class="btn team" ${teams ? '' : 'disabled'}>${icon('refresh', 18)}팀 바꾸기</button>
          ${isHost
            ? `<button class="btn primary bigbtn start" ${room.phase !== 'wait' ? 'disabled' : ''}>${icon('bolt', 22, '#1a1f3a', 2.4)}게임 시작 · ${readyCount}/${humans.length} 준비</button>`
            : `<button class="btn ${mySlot?.ready ? '' : 'primary'} bigbtn ready" ${room.phase !== 'wait' ? 'disabled' : ''}>${mySlot?.ready ? '준비 취소' : '준비'}</button>`}
        </div>
      </div>`);
    this.renderAccPicker(el.querySelector('.accs') as HTMLElement, el.querySelector('.acc-desc') as HTMLElement, (a) => { localStorage.setItem('amp.acc', a); this.net?.send({ t: 'acc', acc: a }); }, room.phase === 'wait');
    if (mySlot && mySlot.acc !== this.acc && room.phase === 'wait') this.net?.send({ t: 'acc', acc: this.acc });
    (el.querySelector('.leave') as HTMLButtonElement).onclick = () => this.net?.send({ t: 'leave' });
    (el.querySelector('.team') as HTMLButtonElement).onclick = () => { if (mySlot) this.net?.send({ t: 'team', team: mySlot.team === 0 ? 1 : 0 }); };
    const start = el.querySelector('.start') as HTMLButtonElement | null;
    if (start) start.onclick = () => this.net?.send({ t: 'start' });
    const ready = el.querySelector('.ready') as HTMLButtonElement | null;
    if (ready) ready.onclick = () => this.net?.send({ t: 'ready', ready: !mySlot?.ready });
    if (isHost) {
      const sendSettings = () => this.net?.send({
        t: 'settings', mode: (el.querySelector('.smode') as HTMLSelectElement).value as ModeId, map: (el.querySelector('.smap') as HTMLSelectElement).value as MapId,
        seconds: Number((el.querySelector('.ssec') as HTMLSelectElement).value), fillBots: (el.querySelector('.sbots') as HTMLSelectElement).value === '1',
      });
      for (const c of ['.smode', '.smap', '.ssec', '.sbots']) (el.querySelector(c) as HTMLSelectElement).onchange = sendSettings;
    }
    this.wireChat(el);
  }
}
