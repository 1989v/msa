// 연습 모드: 월드 전체를 클라에서 돌린다 (봇 포함). 서버 없이 같은 시뮬 코드.
import { World, botInput, newBotMemory, randomLoadout, type Input, type WorldEvent, type RankEntry, type RosterEntry, type AccessoryId, type StyleId, type MapId, type ModeId, type BotMemory, type Stats, type Skin } from '@amp/shared';
import { type MatchSource, type RenderPlayer, renderFromPlayer } from '../game/match.ts';

const BOT_NAMES = ['봇-알파', '봇-브라보', '봇-찰리', '봇-델타', '봇-에코', '봇-폭스', '봇-골프'];

export interface LocalOptions { name: string; acc: AccessoryId; style: StyleId; mapId: MapId; modeId: ModeId; seconds: number; bots: number; stats?: Partial<Stats>; skin?: Skin; emblem?: string }

export class LocalSource implements MatchSource {
  readonly world: World;
  readonly myId = 0;
  readonly roster: RosterEntry[] = [];
  readonly online = false;
  ended: { ranking: RankEntry[]; score: [number, number] } | null = null;
  rtt: number | null = null;
  private mems: (BotMemory | null)[] = [];
  private events: WorldEvent[] = [];

  constructor(o: LocalOptions) {
    this.world = new World({ mapId: o.mapId, modeId: o.modeId, seconds: o.seconds, seed: (Math.random() * 0xffffffff) >>> 0 });
    const me = this.world.addPlayer(0, o.name, 0, o.acc, false, o.style, o.stats);
    this.roster.push({ id: 0, name: me.name, team: me.team, acc: o.acc, style: o.style, bot: false, stats: o.stats, skin: o.skin, emblem: o.emblem });
    const n = Math.max(1, Math.min(7, o.bots));
    for (let i = 1; i <= n; i++) {
      const { style, acc } = randomLoadout(this.world.rng); // 봇 직업·악세서리 무작위 (직업 규칙 안에서)
      const team = this.world.teams ? i % 2 : 0;
      const p = this.world.addPlayer(i, BOT_NAMES[i - 1], team, acc, true, style);
      this.mems[i] = newBotMemory(this.world.rng);
      this.roster.push({ id: i, name: p.name, team: p.team, acc, style, bot: true });
    }
  }

  tick(input: Input): void {
    if (this.ended) return;
    const inputs: (Input | undefined)[] = [];
    inputs[0] = input;
    for (let i = 1; i < 8; i++) {
      const p = this.world.players[i];
      if (p && this.mems[i]) inputs[i] = botInput(this.world, p, this.mems[i]!);
    }
    const ev = this.world.step(inputs);
    for (const e of ev) {
      this.events.push(e);
      if (e.t === 'end') this.ended = { ranking: e.ranking, score: [this.world.score[0], this.world.score[1]] };
    }
  }

  renderPlayers(): RenderPlayer[] {
    const out: RenderPlayer[] = [];
    for (const p of this.world.players) if (p) out.push(renderFromPlayer(p));
    return out;
  }

  drainEvents(): WorldEvent[] { const e = this.events; this.events = []; return e; }
  dispose(): void {}
}
