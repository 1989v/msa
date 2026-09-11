// 권위 시뮬을 워커에서 돌린다 — 탭이 뒤로 가면 메인 스레드 타이머는 초당 1회로 묶이지만 워커 타이머는 그대로다.
// 방장이 다른 탭을 보는 동안에도 나머지 일곱 명의 판이 멈추지 않아야 한다.
import { DT, type HostMsg } from '@amp/shared';
import { Authority, type AuthorityInit } from './authority.ts';

export type WorkerIn =
  | { t: 'init'; init: AuthorityInit }
  | { t: 'in'; seat: number; inputs: unknown[] }
  | { t: 'left'; seat: number }
  | { t: 'stop' };
export type WorkerOut =
  | { t: 'out'; m: HostMsg }
  | { t: 'stats'; stats: Authority['stats'] };

const ctx = self as unknown as Worker;
let auth: Authority | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let acc = 0;
let last = 0;

const post = (m: WorkerOut): void => ctx.postMessage(m);

function stop(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  auth = null;
}

function loop(): void {
  const a = auth;
  if (!a) return;
  const now = performance.now();
  acc += (now - last) / 1000;
  last = now;
  if (acc > DT * 6) acc = DT * 6; // 정지 후 폭주 방지
  while (acc >= DT) {
    acc -= DT;
    const t0 = performance.now();
    a.tick();
    const dt = performance.now() - t0;
    if (dt > a.stats.tickMax) a.stats.tickMax = dt;
    if (dt > 4) a.stats.over4ms++;
    if (a.ended) { post({ t: 'stats', stats: a.stats }); stop(); return; }
  }
  timer = setTimeout(loop, Math.max(0, (DT - acc) * 1000 - 1));
}

ctx.onmessage = (ev: MessageEvent<WorkerIn>) => {
  const m = ev.data;
  switch (m.t) {
    case 'init':
      stop();
      auth = new Authority(m.init, (out) => post({ t: 'out', m: out }));
      acc = 0;
      last = performance.now();
      loop();
      break;
    case 'in': auth?.input(m.seat, m.inputs); break;
    case 'left': auth?.left(m.seat); break;
    case 'stop': stop(); break;
  }
};
