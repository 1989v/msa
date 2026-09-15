#!/usr/bin/env node
// 게이트 봉인. forge/*.mjs 와 thresholds.json 의 해시를 forge/.seal 에 적는다.
// 봉인이 깨진 채로는 Stop 훅이 세션 종료를 받지 않는다 — 게이트를 고쳤으면 왜 고쳤는지 남기고 다시 봉인한다.
//
//   node forge/seal.mjs --reason "적 종 하한 6→4: 벤치마크(퍼즐)에 적이 없다"
//
// 사유는 verifications/seal-log.md 에 누적된다. 사용자는 이 파일로 "게이트가 낮아졌는지" 를 본다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSeal, sealHash, writeSeal } from './hash.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const i = argv.indexOf('--reason');
const reason = i >= 0 ? argv[i + 1] : '';
const init = argv.includes('--init');

const prev = readSeal(ROOT);
const now = sealHash(ROOT);
if (prev === now) { console.log('seal: 변경 없음'); process.exit(0); }
if (!init && !reason) { console.error('seal: --reason "<왜 게이트/문턱을 바꿨나>" 가 필요하다'); process.exit(2); }

const T = JSON.parse(fs.readFileSync(path.join(ROOT, 'forge/thresholds.json'), 'utf8'));
const line = `- ${new Date().toISOString()} ${init ? '(초기 봉인)' : reason} — thresholds: ${JSON.stringify(Object.fromEntries(Object.entries(T).filter(([k]) => k !== '_')))}\n`;
fs.mkdirSync(path.join(ROOT, 'verifications'), { recursive: true });
const log = path.join(ROOT, 'verifications/seal-log.md');
if (!fs.existsSync(log)) fs.writeFileSync(log, '# seal-log — 게이트·문턱 변경 이력\n\n');
fs.appendFileSync(log, line);
writeSeal(ROOT);
console.log(`seal: 재봉인 ${now.slice(0, 12)} — verifications/seal-log.md 에 기록`);
