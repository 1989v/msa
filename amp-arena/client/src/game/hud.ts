// HUD (DOM) — 시안 인게임 화면의 배치 그대로.
import { ACCESSORIES, MODES, MOVES, COUNTDOWN_TICKS, TICK_RATE, type Player, type RankEntry, type RosterEntry, type ModeId } from '@amp/shared';
import { icon, ACC_ICON } from '../ui/icons.ts';

export interface PlateView { id: number; x: number; y: number; visible: boolean }
export interface HudView {
  me: Player | undefined;
  players: Player[];
  myId: number;
  phase: 'countdown' | 'play' | 'ended';
  phaseT: number;
  timeLeft: number;
  score: [number, number];
  teams: boolean;
  plates: PlateView[];
  rtt: number | null;
  modeId: ModeId;
  mapName: string;
}

const teamName = (t: number) => (t === 0 ? '레드' : '블루');
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));

export class Hud {
  readonly el: HTMLElement;
  private plate: HTMLElement; private hpBar: HTMLElement; private hpText: HTMLElement; private guardBar: HTMLElement; private accLine: HTMLElement;
  private timerT: HTMLElement; private scoreL: HTMLElement; private scoreR: HTMLElement; private modeChip: HTMLElement;
  private roster: HTMLElement; private rosterRows = new Map<number, { row: HTMLElement; bar: HTMLElement; ko: HTMLElement }>();
  private skill: HTMLElement; private skillRing: SVGCircleElement; private skillState: HTMLElement; private skillName: HTMLElement; private ammoLine: HTMLElement;
  private feed: HTMLElement; private feedLines: string[] = [];
  private hints: HTMLElement;
  private plates = new Map<number, { el: HTMLElement; n: HTMLElement; hp: HTMLElement }>();
  private platesLayer: HTMLElement; private dmgLayer: HTMLElement;
  private combo: HTMLElement; private center: HTMLElement; private netinfo: HTMLElement;
  private rosterInfo: RosterEntry[] = [];
  private lastSec = -1; private frame = 0; private comboHideAt = 0;
  private overlay: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.innerHTML = `
      <div class="plates"></div>
      <div class="dmgs"></div>
      <div class="plate">
        <div class="row"><div class="name display">-</div><span class="chip team"></span><span class="num muted hp-text"></span></div>
        <div class="bar" style="height:18px"><i class="hp"></i></div>
        <div class="row"><span class="muted" style="font-size:11px">가드</span><div class="bar" style="flex:1;height:8px"><i class="guard" style="background:var(--cyan)"></i></div></div>
        <div class="row acc-line"></div>
      </div>
      <div class="timer"><div class="box"><div class="row"><span class="display" style="font-size:22px;color:var(--red)">레드</span><span class="display num s sl">0</span></div><span class="display num t">3:00</span><div class="row"><span class="display num s sr">0</span><span class="display" style="font-size:22px;color:var(--blue)">블루</span></div></div><span class="chip mode"></span></div>
      <div class="roster"><div class="r" style="font-size:10px;color:var(--dim);height:16px"><i style="visibility:hidden"></i><span>이름</span><span>HP</span><span>KO</span></div></div>
      <div class="netinfo"></div>
      <div class="skill"><div class="ring"><svg viewBox="0 0 64 64" width="64" height="64"><circle cx="32" cy="32" r="27" style="fill:var(--bg2);stroke:var(--line2);stroke-width:4px"></circle><circle class="cd" cx="32" cy="32" r="27" style="fill:none;stroke:var(--green);stroke-width:4px;stroke-dasharray:170 170;transform:rotate(-90deg);transform-origin:32px 32px"></circle></svg><div class="icon" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"></div><span class="key">V</span></div><div class="col" style="gap:4px"><b class="skill-name">-</b><span class="chip green skill-state">준비됨</span><span class="muted ammo" style="font-size:11px"></span></div></div>
      <div class="feed"></div>
      <div class="hints">${[['Z', '공격'], ['X', '점프'], ['C', '가드'], ['V', '기술'], ['Shift', '대시'], ['Q E', '카메라']].map(([k, l]) => `<span class="row" style="gap:5px"><span class="key">${k}</span><span>${l}</span></span>`).join('')}</div>
      <div class="combo display"></div>
      <div class="center display"></div>`;
    container.appendChild(this.el);
    const q = <T extends HTMLElement>(s: string) => this.el.querySelector(s) as T;
    this.platesLayer = q('.plates'); this.dmgLayer = q('.dmgs');
    this.plate = q('.plate'); this.hpBar = q('.hp'); this.hpText = q('.hp-text'); this.guardBar = q('.guard'); this.accLine = q('.acc-line');
    this.timerT = q('.timer .t'); this.scoreL = q('.sl'); this.scoreR = q('.sr'); this.modeChip = q('.mode');
    this.roster = q('.roster'); this.skill = q('.skill'); this.skillRing = this.el.querySelector('.cd') as SVGCircleElement;
    this.skillState = q('.skill-state'); this.skillName = q('.skill-name'); this.ammoLine = q('.ammo');
    this.feed = q('.feed'); this.hints = q('.hints'); this.combo = q('.combo'); this.center = q('.center'); this.netinfo = q('.netinfo');
    this.feed.style.display = 'none';
    setTimeout(() => this.hints.classList.add('off'), 30000);
  }

  setRoster(roster: RosterEntry[], myId: number, teams: boolean): void {
    this.rosterInfo = roster;
    for (const r of this.rosterRows.values()) r.row.remove();
    this.rosterRows.clear();
    const sorted = [...roster].sort((a, b) => a.team - b.team || a.id - b.id);
    for (const r of sorted) {
      const row = document.createElement('div');
      row.className = 'r' + (r.id === myId ? ' me' : '');
      row.innerHTML = `<i style="background:${teams ? (r.team === 0 ? 'var(--red)' : 'var(--blue)') : 'var(--line2)'}"></i><span style="white-space:nowrap;overflow:hidden">${esc(r.name)}</span><div class="bar"><i></i></div><span class="num" style="text-align:right;font-weight:800">0</span>`;
      this.roster.appendChild(row);
      this.rosterRows.set(r.id, { row, bar: row.querySelector('.bar > i') as HTMLElement, ko: row.querySelector('.num') as HTMLElement });
    }
    const me = roster.find((r) => r.id === myId);
    if (me) {
      (this.plate.querySelector('.name') as HTMLElement).textContent = me.name;
      const chip = this.plate.querySelector('.team') as HTMLElement;
      chip.textContent = teams ? teamName(me.team) : '';
      chip.className = 'chip team ' + (teams ? (me.team === 0 ? 'red' : 'blue') : '');
      chip.style.display = teams ? '' : 'none';
      const acc = ACCESSORIES[me.acc];
      this.accLine.innerHTML = `${icon(ACC_ICON[me.acc], 18, 'var(--amp)')}<b>${acc.name}</b><span class="chip" style="font-size:11px">${MOVES[acc.special].id === 'uppercut' ? '어퍼컷' : acc.name + ' 기술'}</span>`;
      (this.skill.querySelector('.icon') as HTMLElement).innerHTML = icon(ACC_ICON[me.acc], 30, 'var(--amp)', 2.2);
      this.skillName.textContent = skillName(me.acc);
    }
    (this.timerT.parentElement!.querySelectorAll('.row') as NodeListOf<HTMLElement>).forEach((e) => { e.style.display = teams ? '' : 'none'; });
  }

  update(v: HudView): void {
    this.frame++;
    const me = v.me;
    if (me) {
      const pct = (me.hp / me.maxHp) * 100;
      this.hpBar.style.width = `${pct}%`;
      this.hpBar.style.background = pct > 50 ? 'var(--green)' : pct > 25 ? 'var(--amp)' : 'var(--red)';
      this.hpText.textContent = `HP ${me.hp} / ${me.maxHp}`;
      this.guardBar.style.width = `${me.guard}%`;
      const acc = ACCESSORIES[me.acc];
      const cdMax = Math.max(1, Math.round(acc.specialCooldownSec * TICK_RATE));
      const ready = me.cooldown <= 0;
      this.skillRing.style.strokeDasharray = `${170 * (1 - Math.min(1, me.cooldown / cdMax))} 170`;
      this.skillRing.style.stroke = ready ? 'var(--green)' : 'var(--amp)';
      this.skillState.textContent = ready ? '준비됨' : `${(me.cooldown / TICK_RATE).toFixed(1)}초`;
      this.skillState.className = 'chip skill-state ' + (ready ? 'green' : '');
      if (acc.ammo > 0) this.ammoLine.textContent = me.reload > 0 ? `재장전 ${(me.reload / TICK_RATE).toFixed(1)}초` : `탄창 ${me.ammo} / ${acc.ammo}`;
      else if (acc.airDashes > 0) this.ammoLine.textContent = `공중 대시 ${me.airDashes} / ${acc.airDashes}`;
      else this.ammoLine.textContent = '';
    }
    const sec = Math.max(0, Math.ceil(v.timeLeft / TICK_RATE));
    if (sec !== this.lastSec) {
      this.lastSec = sec;
      this.timerT.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
      this.timerT.classList.toggle('urgent', sec <= 5);
      this.modeChip.textContent = `${MODES[v.modeId].name} · ${v.mapName}`;
    }
    this.scoreL.textContent = String(v.score[0]); this.scoreR.textContent = String(v.score[1]);
    if (this.frame % 6 === 0) {
      for (const p of v.players) {
        const r = this.rosterRows.get(p.id);
        if (!r) continue;
        const pct = (p.hp / p.maxHp) * 100;
        r.bar.style.width = `${pct}%`;
        r.bar.style.background = pct > 50 ? 'var(--green)' : pct > 25 ? 'var(--amp)' : 'var(--red)';
        r.ko.textContent = String(p.kos);
        r.row.classList.toggle('dead', !p.alive || p.state === 'dead');
      }
      this.netinfo.textContent = v.rtt !== null ? `RTT ${Math.round(v.rtt)}ms` : '';
    }
    // 명찰
    const seen = new Set<number>();
    for (const pl of v.plates) {
      const p = v.players.find((x) => x.id === pl.id);
      if (!p) continue;
      seen.add(pl.id);
      let n = this.plates.get(pl.id);
      if (!n) {
        const el = document.createElement('div');
        el.className = 'nameplate' + (v.teams ? (p.team === 0 ? ' red' : ' blue') : '');
        el.innerHTML = `<span class="n${pl.id === v.myId ? ' me' : ''}"></span><div class="hp"><i></i></div>`;
        this.platesLayer.appendChild(el);
        n = { el, n: el.querySelector('.n') as HTMLElement, hp: el.querySelector('.hp > i') as HTMLElement };
        n.n.textContent = p.name;
        this.plates.set(pl.id, n);
      }
      const hidden = !pl.visible || p.state === 'dead';
      n.el.style.display = hidden ? 'none' : '';
      if (!hidden) {
        n.el.style.transform = `translate(${pl.x.toFixed(0)}px, ${pl.y.toFixed(0)}px) translateY(-100%)`;
        const pct = (p.hp / p.maxHp) * 100;
        n.hp.style.width = `${pct}%`;
        n.hp.style.background = pct > 50 ? 'var(--green)' : pct > 25 ? 'var(--amp)' : 'var(--red)';
      }
    }
    for (const [id, n] of this.plates) if (!seen.has(id)) n.el.style.display = 'none';
    // 카운트다운
    if (v.phase === 'countdown') {
      const left = Math.ceil((COUNTDOWN_TICKS - v.phaseT) / TICK_RATE);
      this.showCenter(left > 0 ? String(left) : 'GO!', v.teams ? '팀 데스매치' : MODES[v.modeId].name);
    } else if (v.phase === 'play' && v.phaseT < 45) {
      this.showCenter('GO!', '');
    } else if (v.phase === 'play' && me && me.state === 'dead') {
      if (MODES[v.modeId].respawn && me.alive) {
        const left = Math.max(0, Math.ceil((60 + 180 - me.t) / TICK_RATE));
        this.showCenter('KO', `리스폰까지 ${left}초`, true);
      } else {
        this.showCenter('탈락', '관전 중 · 매치가 끝나면 결과가 나옵니다', true);
      }
    } else if (v.phase === 'play' && this.center.dataset.sticky !== '1') {
      this.hideCenter();
    } else if (v.phase === 'play' && me && me.state !== 'dead' && this.center.dataset.sticky === '1') {
      this.hideCenter();
    }
    if (this.comboHideAt && performance.now() > this.comboHideAt) { this.combo.classList.remove('on'); this.comboHideAt = 0; }
  }

  pushFeed(html: string): void {
    this.feedLines.push(html);
    if (this.feedLines.length > 4) this.feedLines.shift();
    this.feed.style.display = '';
    this.feed.innerHTML = this.feedLines.map((l) => `<div>${l}</div>`).join('');
  }

  showDamage(x: number, y: number, text: string, kind: 'hit' | 'guard' | 'ko' = 'hit'): void {
    const d = document.createElement('div');
    d.className = `dmg ${kind}`;
    d.textContent = text;
    d.style.left = `${x.toFixed(0)}px`; d.style.top = `${y.toFixed(0)}px`;
    this.dmgLayer.appendChild(d);
    setTimeout(() => d.remove(), 850);
  }

  showCombo(n: number): void {
    this.combo.textContent = `COMBO ${n}`;
    this.combo.classList.add('on');
    this.comboHideAt = performance.now() + 1200;
  }

  showCenter(text: string, small: string, sticky = false): void {
    this.center.innerHTML = `${esc(text)}${small ? `<small>${esc(small)}</small>` : ''}`;
    this.center.style.display = '';
    this.center.dataset.sticky = sticky ? '1' : '0';
  }

  hideCenter(): void { this.center.style.display = 'none'; this.center.dataset.sticky = '0'; }

  showResult(ranking: RankEntry[], score: [number, number], teams: boolean, myId: number, buttons: { label: string; primary?: boolean; onClick: () => void }[]): void {
    this.overlay?.remove();
    const o = document.createElement('div');
    o.className = 'result';
    const winTeam = teams ? (score[0] === score[1] ? -1 : score[0] > score[1] ? 0 : 1) : -1;
    const headline = teams ? (winTeam < 0 ? '무승부' : `${teamName(winTeam)} 팀 승리`) : `${esc(ranking[0]?.name ?? '')} 승리`;
    o.innerHTML = `
      <div class="row" style="gap:20px"><div class="headline display ${winTeam === 0 ? 'red' : winTeam === 1 ? 'blue' : ''}">${headline}</div>${teams ? `<div class="headline display num">${score[0]} : ${score[1]}</div>` : ''}</div>
      <div class="panel" style="padding:10px"><table><thead><tr><th>순위</th>${teams ? '<th>팀</th>' : ''}<th>닉네임</th><th>KO</th><th>데스</th><th>준 데미지</th><th>결과</th></tr></thead><tbody>
      ${ranking.map((r) => `<tr class="${r.id === myId ? 'me' : ''}"><td class="rank">${r.rank}</td>${teams ? `<td><span class="chip ${r.team === 0 ? 'red' : 'blue'}">${teamName(r.team)}</span></td>` : ''}<td style="font-weight:800;${r.id === myId ? 'color:var(--amp)' : ''}">${esc(r.name)}${r.rank === 1 ? ' <span style="color:var(--amp);font-size:11px">MVP</span>' : ''}</td><td class="num">${r.kos}</td><td class="num muted">${r.deaths}</td><td class="num muted">${r.dmg}</td><td style="font-weight:800;color:${r.win ? 'var(--green)' : 'var(--dim)'}">${r.win ? '승리' : '패배'}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="row btns"></div>`;
    const btns = o.querySelector('.btns') as HTMLElement;
    for (const b of buttons) {
      const el = document.createElement('button');
      el.className = 'btn' + (b.primary ? ' primary' : ' ghost');
      el.textContent = b.label;
      el.onclick = b.onClick;
      btns.appendChild(el);
    }
    this.el.appendChild(o);
    this.overlay = o;
    this.hideCenter();
  }

  dispose(): void { this.el.remove(); }
}

function skillName(acc: string): string {
  return { none: '어퍼컷', greatsword: '내려찍기', spear: '돌진 찌르기', pistols: '백롤 난사', shield: '실드 차지', rocket: '로켓 펀치' }[acc] ?? '기술';
}
