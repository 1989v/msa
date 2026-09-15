#!/usr/bin/env node
// PostToolUse 린트 — 게임 파일을 고칠 때마다 돈다. F 는 실제 사고를 낸 것(막는다), W 는 알림.
// 규칙은 적게 두고 각각에 "왜" 를 단다. 규칙이 늘어나는 순서가 배운 순서다.
//
//   stdin: Claude Code 훅 JSON ({ tool_input: { file_path } })      직접: node forge/lint.mjs <file>
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
let file = process.argv[2];
if (!file) { try { file = JSON.parse(fs.readFileSync(0, 'utf8')).tool_input?.file_path; } catch {} }
if (!file) process.exit(0);
file = path.resolve(ROOT, file);
const rel = path.relative(ROOT, file);
if (rel.startsWith('..') || /^(forge|verifications|assets\/providers|\.claude)\//.test(rel) || !/\.(html|js|mjs|css)$/i.test(file) || !fs.existsSync(file)) process.exit(0);

const src = fs.readFileSync(file, 'utf8');
const F = [], W = [];
const lineOf = (re) => { const m = re.exec(src); return m ? src.slice(0, m.index).split('\n').length : 0; };

// F1 — 검증기가 멈추고 샌드박스 iframe 에선 조용히 죽는다 (실제: prompt() 가 랭킹 등록을 통째로 삼킴)
if (/(?<![\w.])(alert|prompt|confirm)\s*\(/.test(src)) F.push(`L${lineOf(/(?<![\w.])(alert|prompt|confirm)\s*\(/)} alert/prompt/confirm 금지 — 캔버스 안에서 직접 그려라`);
// F2 — 게임 UI 에 "N면" 표기 금지. 한국 통용은 "스테이지 N"
if (/\d+\s*면(?![적목역])/.test(src)) F.push(`L${lineOf(/\d+\s*면(?![적목역])/)} "N면" 표기 — "스테이지 N" 으로`);
if (/index\.html$/.test(file)) {
  // F3 — viewport 가 없으면 폰이 980px 데스크톱 폭으로 그려 전부 작아진다
  if (!/<meta[^>]+name=["']viewport["'][^>]+width=device-width/i.test(src)) F.push('viewport meta 없음 — <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">');
  // F4 — charset 없으면 한글 UI 가 깨진다
  if (!/<meta[^>]+charset/i.test(src)) F.push('<meta charset="utf-8"> 없음');
  // W — 터치 스크롤/줌 억제 없으면 스틱 조작 중 페이지가 튄다
  if (!/touch-action\s*:\s*none/.test(src)) W.push('touch-action: none 이 없다 — 캔버스에 지정하지 않으면 터치 조작 중 페이지가 스크롤된다');
}
// W1 — ctx.filter='blur()' 는 실측 33fps. 오프스크린에 미리 그려 캐시하라
if (/\.filter\s*=\s*['"`]/.test(src)) W.push(`L${lineOf(/\.filter\s*=\s*['"`]/)} canvas filter — 프레임당 쓰면 33fps 로 떨어진다(실측). 오프스크린 캐시로`);
// W2 — 방향키·스페이스가 페이지를 스크롤한다
if (/keydown/.test(src) && !/preventDefault/.test(src)) W.push('keydown 을 받는데 preventDefault 가 없다 — 방향키/스페이스가 페이지를 스크롤한다');
// W3 — 결정론: reset(seed) 계약은 시드 RNG 하나를 요구한다
const rnd = (src.match(/Math\.random\s*\(/g) || []).length;
if (rnd && !/rng|random/i.test(path.basename(file))) W.push(`Math.random ${rnd}회 — reset(seed) 결정론이 깨진다. 시드 RNG 하나로`);
// W4 — 게임 루프는 rAF + 고정 dt
if (/setInterval\s*\(/.test(src)) W.push(`L${lineOf(/setInterval\s*\(/)} setInterval — 게임 루프는 requestAnimationFrame + 고정 dt 누산기`);
// W5 — 폴더 전체에 터치 입력이 하나도 없으면 모바일 축은 통과할 수 없다
if (/\.(js|mjs|html)$/.test(file)) {
  const files = walk(ROOT).filter((f) => /\.(js|mjs|html)$/.test(f) && !/\/(forge|verifications|assets\/providers|\.claude)\//.test(f));
  if (!files.some((f) => /touchstart|pointerdown/.test(fs.readFileSync(f, 'utf8')))) W.push('게임 어디에도 touchstart/pointerdown 이 없다 — 모바일 축(MOBILE_TOUCH)은 통과할 수 없다');
}

function walk(dir, out = []) { for (const n of fs.readdirSync(dir)) { if (['.git', 'node_modules'].includes(n)) continue; const p = path.join(dir, n); fs.statSync(p).isDirectory() ? walk(p, out) : out.push(p); } return out; }

if (F.length) { console.error(`game-forge lint FAIL ${rel}\n` + F.map((m) => '  F ' + m).join('\n') + (W.length ? '\n' + W.map((m) => '  W ' + m).join('\n') : '')); process.exit(2); }
if (W.length) console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: `game-forge lint ${rel}: ` + W.map((m) => 'W ' + m).join(' | ') } }));
