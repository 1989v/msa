#!/usr/bin/env node
// Stop 훅 — 세션을 끝내려 할 때 "완성의 정의"를 대조한다. 미달이면 사유와 함께 막고 에이전트는 계속 일한다.
// 순서: BLOCKED.md(정당한 중단) → 봉인 → 게이트 리포트(존재·전체 실행·최신 소스·PASS) → 스크린샷 눈검사 → 막힘 감지기
//
// 막힘 감지기: 같은 소스 해시에서 3번 연속 막히면 멈춤을 허용한다. 품질 상한이 아니라 무한 루프 방지다 —
// 소스를 한 글자라도 고치면 카운터는 0 이 된다.
import fs from 'node:fs';
import path from 'node:path';
import { sourceHash, sealHash, readSeal, listSourceFiles } from './hash.mjs';

const input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
const ROOT = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const VER = path.join(ROOT, 'verifications');
const STATE = path.join(VER, '.stop-state.json');

if (!fs.existsSync(path.join(ROOT, 'forge/gate.mjs')) || !fs.existsSync(path.join(ROOT, 'BRIEF.md'))) process.exit(0);

const hash = sourceHash(ROOT);
const allow = (msg) => { if (msg) console.log(JSON.stringify({ systemMessage: `game-forge: ${msg}` })); saveState(0); process.exit(0); };
function saveState(count) { fs.mkdirSync(VER, { recursive: true }); fs.writeFileSync(STATE, JSON.stringify({ hash, count })); }
function block(reason) {
  let st = {}; try { st = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch {}
  const count = st.hash === hash ? (st.count || 0) + 1 : 1;
  if (count >= 3) { console.log(JSON.stringify({ systemMessage: `game-forge: 같은 소스에서 3번 막혀 멈춤을 허용했다 (마지막 사유: ${reason.split('\n')[0]})` })); saveState(0); process.exit(0); }
  saveState(count);
  console.log(JSON.stringify({ decision: 'block', reason: `[game-forge 완성 게이트 ${count}/3] ${reason}` }));
  process.exit(0);
}

// 1. 정당한 중단 — 사용자 없이는 못 나가는 것을 BLOCKED.md 에 적었고, 그 뒤로 소스를 안 건드렸다
const blockedMd = path.join(VER, 'BLOCKED.md');
if (fs.existsSync(blockedMd)) {
  const latestSrc = Math.max(0, ...listSourceFiles(ROOT).map((f) => fs.statSync(f).mtimeMs));
  if (fs.statSync(blockedMd).mtimeMs >= latestSrc) allow('BLOCKED.md 로 중단 허용 — ' + fs.readFileSync(blockedMd, 'utf8').split('\n').find((l) => l.trim()) );
  block('verifications/BLOCKED.md 가 소스보다 오래됐다. 아직 막혀 있으면 내용을 갱신하고, 풀렸으면 파일을 지우고 게이트를 돌려라.');
}

// 2. 봉인 — 게이트·문턱을 고쳤으면 사유를 남기고 재봉인해야 한다
if (readSeal(ROOT) !== sealHash(ROOT)) block('forge/*.mjs 또는 forge/thresholds.json 이 봉인과 다르다. 게이트를 낮추지 말고 게임을 고쳐라. 정말 바꿔야 하면 `node forge/seal.mjs --reason "<사유>"` 로 남기고 재봉인한 뒤 게이트를 다시 돌려라.');

// 3. 게이트 리포트
const reportFile = path.join(VER, 'gate-report.json');
if (!fs.existsSync(reportFile)) block('완성 판정이 없다. `node forge/gate.mjs` 를 돌려 verifications/gate-report.md 를 만들고, 빨간 축을 고쳐라.');
const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
if (report.partial) block('마지막 게이트가 부분 실행(--only)이다. 전체 `node forge/gate.mjs` 를 돌려라.');
if (report.sourceHash !== hash) block('게이트가 본 소스와 지금 소스가 다르다 — 옛 산출물을 재고 확인했다고 말하지 않는다. `node forge/gate.mjs` 를 다시 돌려라.');
if (report.status !== 'PASS') {
  const failed = report.axes.filter((a) => a.status !== 'PASS');
  block(`게이트 ${report.status}: ${failed.length}개 축 미달.\n` + failed.slice(0, 8).map((a) => `  - ${a.id}: ${a.note || ''} ${JSON.stringify(a.measured)} (문턱 ${JSON.stringify(a.threshold)})`).join('\n') + '\n고치고 `node forge/gate.mjs` 를 다시 돌려라. 문턱을 낮추는 것은 답이 아니다.');
}

// 4. 스크린샷 눈검사 — 수치가 전부 초록이어도 "있어야 할 것이 없음" 은 그림으로만 보인다
const review = path.join(VER, 'visual-review.md');
const shots = report.screenshots || [];
if (!fs.existsSync(review) || fs.statSync(review).mtimeMs < new Date(report.finishedAt).getTime()) {
  block(`게이트가 만든 스크린샷 ${shots.length}장을 Read 로 직접 보고 verifications/visual-review.md 를 (게이트 실행 이후에) 써라 — 한 장에 한 줄, 파일명과 보이는 것·결함. 결함이 있으면 고치고 게이트부터 다시.`);
}
const text = fs.readFileSync(review, 'utf8');
const unmentioned = shots.filter((s) => !text.includes(s));
if (unmentioned.length) block(`visual-review.md 에 언급되지 않은 스크린샷 ${unmentioned.length}장: ${unmentioned.slice(0, 10).join(', ')}. 전부 보고 한 줄씩 적어라.`);

allow(`완성 게이트 PASS (${report.axes.length}축) + 눈검사 ${shots.length}장 — 멈춤 허용`);
