// 화면 흐름: 타이틀 → (연습 매치) | (온라인 → 대기실 → 매치 → 결과 → 대기실(코드 방) / 온라인(빠른 대전))
import { ACCESSORIES, STYLES, STYLE_IDS, MODES, MODE_IDS, MAPS, MAP_IDS, allowedAccessory, NICK_MAX, type AccessoryId, type StyleId, type MapId, type ModeId, type RoomSettings, type RankEntry } from '@amp/shared';
import { Online, lobbyCloseSec } from './net/online.ts';
import type { GuestSource } from './net/guestsource.ts';
import { LocalSource } from './local/localsource.ts';
import { Match, type MatchOptions } from './game/match.ts';
import { icon, boltLogo, ACC_ICON } from './ui/icons.ts';
import { isEmbedded, enterFullscreen } from './ui/fullscreen.ts';
import { onPlatform, submitScore, buildScoreRequest, scoreNote, platformNickname, type ScoreBoard } from './platform/score.ts';
import { type Progress, loadProgress, saveProgress, applyMatch } from './platform/progress.ts';
import { pullProgress, pushProgress } from './platform/save.ts';
import { progressPanelHtml, openStatsModal, openShopModal } from './ui/progressui.ts';
import { openEmblemModal } from './ui/emblemui.ts';
import { setEmblem } from './platform/progress.ts';

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
const SECONDS_OPTS: [string, string][] = [['120', '2분'], ['180', '3분'], ['300', '5분']];

export class App {
  private root: HTMLElement;
  private nick: string;
  private spectate = false; // 관전으로 참가 — 명단에서 빠지고 남을 따라 본다
  private progress: Progress = loadProgress(); // 경험치·골드·스탯 분배·스킨 (로컬 원본, 플랫폼 세이브로 기기 간 이어하기)
  private acc: AccessoryId = 'none';
  private style: StyleId = 'fighter';
  private team = -1;
  private settings: RoomSettings = { map: 'colosseum', mode: 'ffa_dm', seconds: 180, fillBots: true };
  private online: Online | null = null;
  private match: Match | null = null;
  private screen: HTMLElement | null = null;
  private view: 'title' | 'lobby' | 'room' | 'match' = 'title';
  private countdownTimer: ReturnType<typeof setInterval> | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.nick = localStorage.getItem('amp.nick') ?? platformNickname()?.slice(0, NICK_MAX) ?? ''; // 다른 게임에서 쓰던 플랫폼 닉네임을 빈칸에 미리 채운다
    this.acc = (localStorage.getItem('amp.acc') as AccessoryId) ?? 'none';
    if (!(this.acc in ACCESSORIES)) this.acc = 'none';
    this.style = (localStorage.getItem('amp.style') as StyleId) ?? 'fighter';
    if (!(this.style in STYLES)) this.style = 'fighter';
    this.acc = allowedAccessory(this.style, this.acc);
    this.showTitle();
    void this.syncProgress();
  }

  /** 서버본이 이 기기보다 앞서 있으면(다른 기기에서 놀았다) 받아서 쓴다 */
  private async syncProgress(): Promise<void> {
    const server = await pullProgress(this.progress);
    if (!server) return;
    this.progress = server;
    saveProgress(server);
    if (this.view === 'title') this.renderProgressRow();
  }

  /** 진행이 바뀌면 저장·서버 동기화·대기실 선택 갱신·타이틀 줄 다시 그리기 */
  private setProgress(p: Progress): void {
    this.progress = p;
    saveProgress(p);
    pushProgress(p);
    this.online?.setPick({ stats: p.alloc, skin: p.skin, emblem: p.emblem });
    this.renderProgressRow();
  }

  private renderProgressRow(): void {
    const host = this.screen?.querySelector('.progress-host') as HTMLElement | null;
    if (!host) return;
    host.innerHTML = progressPanelHtml(this.progress);
    (host.querySelector('.stats-btn') as HTMLButtonElement).onclick = () => openStatsModal(this.root, () => this.progress, this.style, (p) => this.setProgress(p));
    (host.querySelector('.shop-btn') as HTMLButtonElement).onclick = () => openShopModal(this.root, () => this.progress, (p) => this.setProgress(p), (m) => this.toast(m));
    (host.querySelector('.emblem-btn') as HTMLButtonElement).onclick = () => openEmblemModal(this.root, () => this.progress, (grid) => this.setProgress(setEmblem(this.progress, grid)));
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
    this.stopCountdown();
    const el = this.mount(`
      <div class="title-bg"></div>
      <div class="col" style="position:relative;align-items:center;gap:14px;width:100%">
        ${boltLogo(96).replace('font-size:96px', 'font-size:clamp(56px, 9vw, 120px)')}
        <div class="tagline">8인 실시간 대전 액션 · 브라우저에서 바로</div>
        <div class="panel title-form col">
          <span class="label">닉네임</span>
          <input class="field nick" maxlength="10" placeholder="2~10자, 이 세션에서만 사용" value="${esc(this.nick)}">
          <span class="label">스타일</span>
          <div class="styles"></div>
          <div class="style-desc muted" style="font-size:12px;min-height:34px"></div>
          <span class="label">악세서리</span>
          <div class="accs"></div>
          <div class="acc-desc muted" style="font-size:12px;min-height:34px"></div>
          <span class="label">진행 · 레벨마다 스탯 포인트, 골드로 색 조합</span>
          <div class="progress-host"></div>
          <span class="label">연습 설정</span>
          <div class="row">
            <select class="field map" style="flex:1;height:38px">${MAP_IDS.map((m) => `<option value="${m}">${MAPS[m].name}</option>`).join('')}</select>
            <select class="field mode" style="flex:1;height:38px">${MODE_IDS.map((m) => `<option value="${m}" ${m === 'ffa_dm' ? 'selected' : ''}>${MODES[m].name}</option>`).join('')}</select>
            <select class="field bots" style="width:100px;height:38px"><option value="3">봇 3</option><option value="5">봇 5</option><option value="7" selected>봇 7</option></select>
            <select class="field secs" style="width:90px;height:38px"><option value="120">2분</option><option value="180" selected>3분</option><option value="300">5분</option></select>
          </div>
          <div class="row">
            <button class="btn primary practice" style="flex:1">연습 · 봇과 대전</button>
            <button class="btn go-lobby" style="flex:1">온라인 대전</button>
          </div>
        </div>
      </div>
      <span class="chip version">P1 · 2026-09</span>
      <div class="hints"><span class="row" style="gap:6px">${icon('keyboard', 20, 'var(--muted)')}Z 약공 · X 강공 · Space 점프(공중에서도 Z·X) · C 가드 · V 기술 · F 줍기</span><span class="row" style="gap:6px">${icon('gamepad', 20, 'var(--muted)')}게임패드</span><span>우클릭 드래그 카메라${isEmbedded() ? ' · 시작하면 전체화면' : ''}</span></div>`);
    this.renderAccPicker(el.querySelector('.accs') as HTMLElement, el.querySelector('.acc-desc') as HTMLElement, (a) => { this.acc = a; localStorage.setItem('amp.acc', a); });
    this.renderStylePicker(el.querySelector('.styles') as HTMLElement, el.querySelector('.style-desc') as HTMLElement, (st, acc) => { this.style = st; localStorage.setItem('amp.style', st); localStorage.setItem('amp.acc', acc); });
    const nickEl = el.querySelector('.nick') as HTMLInputElement;
    const readNick = () => { const n = nickEl.value.trim(); if (n.length < 2) { this.toast('닉네임은 2자 이상'); nickEl.focus(); return null; } this.nick = n; localStorage.setItem('amp.nick', n); return n; };
    (el.querySelector('.practice') as HTMLButtonElement).onclick = () => {
      if (!readNick()) return;
      if (isEmbedded()) void enterFullscreen(); // 카탈로그 IFRAME 안이면 무대가 좁다 — 버튼 제스처 안에서 전체화면으로
      this.startPractice({
        mapId: (el.querySelector('.map') as HTMLSelectElement).value as MapId,
        modeId: (el.querySelector('.mode') as HTMLSelectElement).value as ModeId,
        bots: Number((el.querySelector('.bots') as HTMLSelectElement).value),
        seconds: Number((el.querySelector('.secs') as HTMLSelectElement).value),
      });
    };
    (el.querySelector('.go-lobby') as HTMLButtonElement).onclick = () => { if (readNick()) { if (isEmbedded()) void enterFullscreen(); void this.connectOnline(); } };
    nickEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') (el.querySelector('.practice') as HTMLButtonElement).click(); });
    this.renderProgressRow();
  }

  /** 악세서리 선택지는 직업이 정한다 — 직업을 바꾸면 못 드는 악세서리는 맨손으로 돌아간다 */
  private renderAccPicker(container: HTMLElement, desc: HTMLElement, onPick: (a: AccessoryId) => void, enabled = true): void {
    const draw = () => {
      const ids = STYLES[this.style].accessories;
      container.innerHTML = ids.map((a) => `<button class="acc ${a === this.acc ? 'on' : ''}" data-acc="${a}" ${enabled ? '' : 'disabled'}>${icon(ACC_ICON[a], 28, a === this.acc ? '#1a1f3a' : 'var(--amp)', 2.2)}<span>${ACCESSORIES[a].name}</span></button>`).join('');
      desc.textContent = ACC_DESC[this.acc];
      container.querySelectorAll<HTMLButtonElement>('.acc').forEach((b) => { b.onclick = () => { this.acc = b.dataset.acc as AccessoryId; onPick(this.acc); draw(); }; });
    };
    this.accDraw = draw;
    draw();
  }

  private accDraw: (() => void) | null = null;

  private renderStylePicker(container: HTMLElement, desc: HTMLElement, onPick: (s: StyleId, acc: AccessoryId) => void, enabled = true): void {
    const draw = () => {
      container.innerHTML = STYLE_IDS.map((st) => `<button class="acc stylebtn ${st === this.style ? 'on' : ''}" data-style="${st}" ${enabled ? '' : 'disabled'}><span class="swatch" style="background:${STYLES[st].look.hairColor}"></span><span>${STYLES[st].name}</span></button>`).join('');
      desc.textContent = `${STYLES[this.style].desc} 악세서리: ${STYLES[this.style].accessories.filter((a) => a !== 'none').map((a) => ACCESSORIES[a].name).join('·')}`;
      container.querySelectorAll<HTMLButtonElement>('.stylebtn').forEach((b) => {
        b.onclick = () => {
          this.style = b.dataset.style as StyleId;
          this.acc = allowedAccessory(this.style, this.acc);
          onPick(this.style, this.acc);
          draw();
          this.accDraw?.();
        };
      });
    };
    draw();
  }

  private startPractice(o: { mapId: MapId; modeId: ModeId; bots: number; seconds: number }): void {
    const src = new LocalSource({ name: this.nick, acc: this.acc, style: this.style, mapId: o.mapId, modeId: o.modeId, seconds: o.seconds, bots: o.bots, stats: this.progress.alloc, skin: this.progress.skin, emblem: this.progress.emblem });
    this.runMatch(src, { onExit: () => this.showTitle(), onAgain: () => this.startPractice(o), exitLabel: '타이틀로', onResult: (me, ranking) => this.finishMatch(me, ranking, 'practice', o.mapId, o.modeId) });
  }

  /** 판 결과를 플랫폼 순위표에 올린다 (플랫폼 위에서만 · 점수 0 은 보내지 않는다) */
  private async submitResult(me: RankEntry, ranking: RankEntry[], board: ScoreBoard, mapId: MapId, modeId: ModeId): Promise<string | null> {
    if (!onPlatform()) return null;
    const req = buildScoreRequest(me, board, MAPS[mapId].name, MODES[modeId].name, ranking.length);
    if (!(req.score > 0)) return null;
    const r = await submitScore(req);
    return scoreNote(board, req.score, r);
  }

  /** 판이 끝났다: 진행(경험치·골드) 반영 + 순위표 제출 → 결과 화면 한 줄 */
  private async finishMatch(me: RankEntry, ranking: RankEntry[], board: ScoreBoard, mapId: MapId, modeId: ModeId): Promise<string | null> {
    const r = applyMatch(this.progress, me, board === 'online');
    this.setProgress(r.p);
    const reward = `+${r.rewards.xp} XP · +${r.rewards.gold} 골드${r.to > r.from ? ` · Lv ${r.to} 달성!` : ''}`;
    const score = await this.submitResult(me, ranking, board, mapId, modeId);
    return [score, reward].filter(Boolean).join(' · ');
  }

  private runMatch(src: LocalSource | GuestSource, opts: MatchOptions): void {
    this.disposeMatch();
    this.stopCountdown();
    this.screen?.remove();
    this.screen = null;
    this.view = 'match';
    this.match = new Match(this.root, src, opts);
  }

  private disposeMatch(): void {
    if (this.match) { this.match.dispose(); this.match = null; }
  }

  private stopCountdown(): void {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    this.countdownTimer = null;
  }

  // ---------------- 온라인 ----------------
  private async connectOnline(): Promise<void> {
    if (this.online?.connected) { this.showLobby(); return; }
    const online = new Online(this.nick, { acc: this.acc, style: this.style, team: this.team, spectate: this.spectate, stats: this.progress.alloc, skin: this.progress.skin, emblem: this.progress.emblem }, this.settings, {
      onState: () => { if (this.view === 'room') this.showRoom(); },
      onMatch: (src) => this.onMatch(src),
      onRoundEnd: () => { this.disposeMatch(); this.showRoom(); },
      onToast: (m) => this.toast(m),
      onChat: (from, text) => this.match?.chatLine(from, text),
      onDisconnect: () => { this.online = null; if (this.view !== 'title') this.showTitle(); },
    });
    this.online = online;
    try { await online.connect(); } catch (e) { this.toast((e as Error).message); this.online = null; return; }
    this.showLobby();
  }

  private onMatch(src: GuestSource): void {
    const online = this.online;
    if (!online) return;
    const party = online.state.party;
    this.runMatch(src, {
      exitLabel: party ? '대기실로' : '로비로',
      onResult: (me, ranking) => this.finishMatch(me, ranking, 'online', src.world.cfg.mapId, src.world.cfg.modeId),
      chat: (t) => online.chat(t),
      onExit: () => {
        // 코드 방: done → roundEnded 가 오면 대기실. 빠른 대전: 방을 나가 로비로
        online.finishRound();
        if (!party) { this.disposeMatch(); this.showLobby(); }
        else { this.disposeMatch(); this.showRoom(); }
      },
    });
  }

  private topbar(mid: string, right: string): string {
    return `<div class="topbar"><div class="row" style="gap:18px">${boltLogo(30)}${mid}</div><div class="row">${right}</div></div>`;
  }

  private settingsForm(cls: string, s: RoomSettings, enabled: boolean): string {
    const sel = (c: string, opts: [string, string][], cur: string) => `<select class="field ${c}" style="height:38px;font-size:13px" ${enabled ? '' : 'disabled'}>${opts.map(([v, l]) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    return `<div class="${cls} col" style="gap:6px">
      <div class="kv"><span class="muted">모드</span>${sel('rmode', MODE_IDS.map((m) => [m, MODES[m].name]), s.mode)}</div>
      <div class="kv"><span class="muted">맵</span>${sel('rmap', MAP_IDS.map((m) => [m, MAPS[m].name]), s.map)}</div>
      <div class="kv"><span class="muted">시간</span>${sel('rsec', SECONDS_OPTS, String(s.seconds))}</div>
      <div class="kv"><span class="muted">빈 자리</span>${sel('rbots', [['1', '봇으로 채움'], ['0', '비워 둠']], s.fillBots ? '1' : '0')}</div>
    </div>`;
  }

  private readSettings(el: HTMLElement): RoomSettings {
    return {
      mode: (el.querySelector('.rmode') as HTMLSelectElement).value as ModeId,
      map: (el.querySelector('.rmap') as HTMLSelectElement).value as MapId,
      seconds: Number((el.querySelector('.rsec') as HTMLSelectElement).value),
      fillBots: (el.querySelector('.rbots') as HTMLSelectElement).value === '1',
    };
  }

  showLobby(): void {
    this.view = 'lobby';
    this.stopCountdown();
    const el = this.mount(`
      ${this.topbar(`<span class="chip amp">온라인 대전</span>`, `<span class="chip amp">${esc(this.nick)}</span>`)}
      <div class="lobby" style="grid-template-columns:240px minmax(0, 1fr)">
        <div class="panel me col" style="align-content:start">
          <div style="display:flex;justify-content:center">${avatar(SLOT_COLORS[0], 96)}</div>
          <div class="display" style="font-size:24px;text-align:center">${esc(this.nick)}</div>
          <div class="row" style="justify-content:center;flex-wrap:wrap;gap:6px"><span class="chip">${STYLES[this.style].name}</span><span class="chip">${ACCESSORIES[this.acc].name}</span></div>
          <span class="label">매치 설정 · 내가 방장일 때 적용</span>
          ${this.settingsForm('settings-form', this.settings, true)}
          <label class="row" style="gap:8px;font-size:13px;cursor:pointer"><input type="checkbox" class="spectate" ${this.spectate ? 'checked' : ''}> 관전으로 참가 — 싸우지 않고 본다 ([ ] 로 대상 전환)</label>
          <button class="btn ghost back">${icon('door', 18)}타이틀로</button>
        </div>
        <div class="center">
          <div class="panel col" style="gap:14px">
            <div class="row" style="justify-content:space-between;align-items:start;gap:12px;flex-wrap:wrap">
              <div class="col" style="gap:4px;flex:1;min-width:220px"><span class="display" style="font-size:20px">빠른 대전</span><span class="muted" style="font-size:13px">8인 자동 매칭. 사람이 다 모이거나 30초가 지나면 시작하고, 빈 자리는 봇이 채웁니다.</span></div>
              <button class="btn primary bigbtn quick" style="min-width:180px">${icon('bolt', 22, '#1a1f3a', 2.4)}빠른 대전</button>
            </div>
          </div>
          <div class="panel col" style="gap:14px">
            <div class="row" style="justify-content:space-between;align-items:start;gap:12px;flex-wrap:wrap">
              <div class="col" style="gap:4px;flex:1;min-width:220px"><span class="display" style="font-size:20px">친구와 · 코드 방</span><span class="muted" style="font-size:13px">방을 만들면 6자리 코드가 나옵니다. 코드를 받은 사람이 들어오면 방장이 시작합니다.</span></div>
              <button class="btn create" style="min-width:180px">${icon('plus', 18, 'var(--ink)', 2.4)}방 만들기</button>
            </div>
            <div class="row" style="gap:8px;flex-wrap:wrap">
              <input class="field code-in" maxlength="6" placeholder="방 코드 6자리" style="flex:1;min-width:160px;height:42px;text-transform:uppercase;letter-spacing:3px;font-weight:800">
              <button class="btn join-code" style="height:42px">코드로 입장</button>
            </div>
          </div>
          <div class="panel muted" style="font-size:12px;line-height:1.6">방장(가장 먼저 들어온 사람)의 화면이 판정을 맡고, 방장이 나가면 다음 사람이 이어받습니다. 방장의 입력에도 게스트 평균만큼 지연을 넣어 조건을 맞춥니다.</div>
        </div>
      </div>`);
    const online = this.online!;
    const applySettings = () => { this.settings = this.readSettings(el); online.setSettings(this.settings); };
    for (const c of ['.rmode', '.rmap', '.rsec', '.rbots']) (el.querySelector(c) as HTMLSelectElement).onchange = applySettings;
    const busy = (b: HTMLButtonElement, on: boolean) => { b.disabled = on; };
    (el.querySelector('.spectate') as HTMLInputElement).onchange = (e) => { this.spectate = (e.target as HTMLInputElement).checked; online.setPick({ spectate: this.spectate }); };
    (el.querySelector('.quick') as HTMLButtonElement).onclick = async (ev) => {
      const b = ev.currentTarget as HTMLButtonElement; busy(b, true); applySettings();
      const ok = await online.quick(); busy(b, false);
      if (ok) this.showRoom();
    };
    (el.querySelector('.create') as HTMLButtonElement).onclick = async (ev) => {
      const b = ev.currentTarget as HTMLButtonElement; busy(b, true); applySettings();
      const ok = await online.create(); busy(b, false);
      if (ok) this.showRoom();
    };
    const codeIn = el.querySelector('.code-in') as HTMLInputElement;
    const joinCode = async () => {
      const code = codeIn.value.trim().toUpperCase();
      if (code.length !== 6) { this.toast('코드는 6자리입니다'); return; }
      applySettings();
      const ok = await online.joinCode(code);
      if (ok) this.showRoom();
    };
    (el.querySelector('.join-code') as HTMLButtonElement).onclick = joinCode;
    codeIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') void joinCode(); });
    (el.querySelector('.back') as HTMLButtonElement).onclick = () => { online.close(); this.online = null; this.showTitle(); };
  }

  showRoom(): void {
    const online = this.online;
    if (!online || !online.inRoom) { this.showLobby(); return; }
    const st = online.state;
    this.view = 'room';
    const host = st.host;
    const hostSettings = st.seats[host]?.settings ?? this.settings;
    const teams = MODES[hostSettings.mode].teams;
    const isHost = online.isHost;
    const chatInput = (this.screen?.querySelector('.chat-in') as HTMLInputElement | null)?.value ?? '';
    const slots = st.seats.map((s, i) => {
      if (!s) return `<div class="slot empty">${icon('plus', 26, 'var(--dim)')}<span style="font-size:12px;font-weight:700">빈 자리${hostSettings.fillBots ? ' · 봇으로 채움' : ''}</span></div>`;
      const me = i === st.mySeat;
      const pick = s.pick;
      const team = teams ? (pick && pick.team >= 0 ? pick.team : -1) : -1;
      const status = (i === host ? '<span class="chip amp">방장</span>' : '') + (pick?.spectate ? '<span class="chip">관전</span>' : i === host ? '' : '<span class="chip green">참가</span>');
      return `<div class="slot ${team === 0 ? 'red' : team === 1 ? 'blue' : ''}">
        <span class="tag" style="color:${team === 0 ? 'var(--red)' : team === 1 ? 'var(--blue)' : 'var(--dim)'}">${team === 0 ? '레드' : team === 1 ? '블루' : teams ? '자동' : '슬롯'} ${i + 1}</span>
        ${i === host ? `<span class="crown">${icon('crown', 18, 'var(--amp)', 2.4)}</span>` : ''}
        ${avatar(SLOT_COLORS[i], 84)}
        <div style="font-size:14px;font-weight:800;${me ? 'color:var(--amp)' : ''}">${esc(s.name)}</div>
        <div class="row" style="gap:6px">${status}<span class="chip" style="font-size:11px">${pick ? `${STYLES[pick.style].name} · ${ACCESSORIES[pick.acc].name}` : '선택 중'}</span></div>
      </div>`;
    }).join('');
    const count = st.seats.filter((s) => s).length;
    const head = st.party
      ? `<span style="font-size:16px;font-weight:800">코드 방</span><span class="chip amp code" style="letter-spacing:3px;font-size:15px">${esc(st.code)}</span><button class="btn ghost copy" style="height:30px;font-size:12px">코드 복사</button>`
      : `<span style="font-size:16px;font-weight:800">빠른 대전</span><span class="chip countdown">${st.started ? '시작 중' : `${lobbyCloseSec(st.joinedAt)}초 뒤 자동 시작`}</span>`;
    const el = this.mount(`
      ${this.topbar(`${head}<span class="chip">${MODES[hostSettings.mode].name} · ${MAPS[hostSettings.map].name} · ${hostSettings.seconds / 60}분</span>`,
        `<span class="chip">${count} / 8</span><button class="btn ghost leave" style="height:34px;font-size:13px">${icon('door', 16)}나가기</button>`)}
      <div class="room">
        <div class="top">
          <div class="slots">${slots}</div>
          <div class="side">
            <div class="panel settings col" style="gap:6px">
              <div class="row" style="justify-content:space-between"><span class="label">매치 설정</span><span class="chip" style="font-size:11px">${isHost ? '방장 · 내가 정한다' : '방장이 정한다'}</span></div>
              ${this.settingsForm('settings-form', isHost ? this.settings : hostSettings, isHost)}
            </div>
            <div class="panel col">
              <div class="row" style="justify-content:space-between"><span class="label">스타일 · 악세서리</span><span class="chip" style="font-size:11px">매치 중 교체 불가</span></div>
              <div class="styles"></div>
              <div class="style-desc muted" style="font-size:12px;min-height:30px"></div>
              <div class="accs"></div>
              <div class="acc-desc muted" style="font-size:12px;min-height:30px"></div>
            </div>
          </div>
        </div>
        <div class="bottom">
          <div class="panel chat"><div class="log"></div><div class="row"><input class="field chat-in" style="flex:1;height:36px;font-size:13px" maxlength="120" placeholder="대기실 대화 · Enter" value="${esc(chatInput)}"><button class="btn chat-send" style="height:36px;font-size:13px">보내기</button></div></div>
          <button class="btn team" ${teams ? '' : 'disabled'}>${icon('refresh', 18)}팀 바꾸기</button>
          ${st.party
            ? (isHost
              ? `<button class="btn primary bigbtn start" ${st.started ? 'disabled' : ''}>${icon('bolt', 22, '#1a1f3a', 2.4)}게임 시작 · ${count}명${hostSettings.fillBots && count < 8 ? ' + 봇' : ''}</button>`
              : `<button class="btn bigbtn" disabled>방장이 시작하면 들어갑니다</button>`)
            : `<button class="btn bigbtn" disabled>${st.started ? '매치 준비 중' : '자동 시작 대기'}</button>`}
        </div>
      </div>`);
    this.renderAccPicker(el.querySelector('.accs') as HTMLElement, el.querySelector('.acc-desc') as HTMLElement, (a) => { localStorage.setItem('amp.acc', a); online.setPick({ acc: a }); }, !st.started);
    this.renderStylePicker(el.querySelector('.styles') as HTMLElement, el.querySelector('.style-desc') as HTMLElement, (s, acc) => { localStorage.setItem('amp.style', s); localStorage.setItem('amp.acc', acc); online.setPick({ style: s, acc }); }, !st.started);
    (el.querySelector('.leave') as HTMLButtonElement).onclick = () => { online.leave(); this.showLobby(); };
    (el.querySelector('.team') as HTMLButtonElement).onclick = () => { this.team = this.team === 0 ? 1 : 0; online.setPick({ team: this.team }); };
    const start = el.querySelector('.start') as HTMLButtonElement | null;
    if (start) start.onclick = () => { this.settings = this.readSettings(el); online.setSettings(this.settings); online.start(); };
    const copy = el.querySelector('.copy') as HTMLButtonElement | null;
    if (copy) copy.onclick = () => { void navigator.clipboard?.writeText(st.code).then(() => this.toast('코드를 복사했습니다'), () => this.toast(st.code)); };
    if (isHost) for (const c of ['.rmode', '.rmap', '.rsec', '.rbots']) (el.querySelector(c) as HTMLSelectElement).onchange = () => { this.settings = this.readSettings(el); online.setSettings(this.settings); };
    // 채팅
    const log = el.querySelector('.chat .log') as HTMLElement;
    log.innerHTML = st.chat.map((c) => `<div class="${c.system ? 'sys' : ''}"><b>${esc(c.from)}</b><span class="muted"> : </span>${esc(c.text)}</div>`).join('');
    log.scrollTop = log.scrollHeight;
    const input = el.querySelector('.chat-in') as HTMLInputElement;
    const go = () => { const t = input.value.trim(); if (!t) return; input.value = ''; online.chat(t); };
    (el.querySelector('.chat-send') as HTMLButtonElement).onclick = go;
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    // 빠른 대전 자동 시작 카운트다운
    this.stopCountdown();
    if (!st.party && !st.started) {
      this.countdownTimer = setInterval(() => {
        const c = this.screen?.querySelector('.countdown');
        if (c && this.view === 'room') c.textContent = `${lobbyCloseSec(st.joinedAt)}초 뒤 자동 시작`;
      }, 1000);
    }
  }
}
