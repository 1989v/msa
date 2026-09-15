#!/usr/bin/env node
// SessionStart 훅 (startup · resume · compact) — 컨텍스트가 잘려도 목표·진행·게이트 상태를 다시 쥐게 한다.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const read = (f, n) => { try { const t = fs.readFileSync(path.join(ROOT, f), 'utf8'); const lines = t.trim().split('\n'); return n ? lines.slice(-n).join('\n') : t; } catch { return null; } };
if (!fs.existsSync(path.join(ROOT, 'BRIEF.md'))) process.exit(0);

const parts = [];
const brief = read('BRIEF.md'); if (brief) parts.push('## BRIEF.md (목표의 원본)\n' + brief.split('\n').slice(0, 25).join('\n'));
const progress = read('progress.md', 40); if (progress) parts.push('## progress.md (마지막 40줄)\n' + progress);
try {
  const r = JSON.parse(fs.readFileSync(path.join(ROOT, 'verifications/gate-report.json'), 'utf8'));
  const failed = r.axes.filter((a) => a.status !== 'PASS').map((a) => `${a.id}(${a.note || a.status})`);
  parts.push(`## 마지막 게이트: ${r.status}${r.partial ? ' (partial)' : ''} @ ${r.finishedAt}\n` + (failed.length ? '미달: ' + failed.join(', ') : '전 축 PASS'));
} catch { parts.push('## 마지막 게이트: 없음 — `node forge/gate.mjs` 를 아직 안 돌렸다'); }
const blocked = read('verifications/BLOCKED.md'); if (blocked) parts.push('## BLOCKED.md 가 있다\n' + blocked);
parts.push('시작 루틴: progress.md 의 "다음" 부터 잇는다. 완성의 정의는 CLAUDE.md, 계약은 forge/step-api.md. 사용자에게 묻지 않는다.');

console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: '# game-forge 복구\n' + parts.join('\n\n') } }));
