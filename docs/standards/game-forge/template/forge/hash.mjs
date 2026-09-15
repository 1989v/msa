// 소스 해시와 봉인. 게이트 리포트가 "지금 소스"를 본 것인지, 게이트 자체가 손대지지 않았는지를 판별한다.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const SKIP_DIRS = new Set(['.git', 'node_modules', 'verifications', '.claude']);

// 게임 런타임에 영향을 주는 파일만 — .md 는 문서라 제외 (progress.md 갱신이 재판정을 요구하면 안 된다)
export function listSourceFiles(root) {
  const out = [];
  (function walk(dir) {
    for (const name of fs.readdirSync(dir).sort()) {
      if (SKIP_DIRS.has(name) || name === '.seal' || name.startsWith('.DS_')) continue;
      const p = path.join(dir, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else if (!/\.md$/i.test(name)) out.push(p);
    }
  })(root);
  return out;
}

export function sourceHash(root) {
  const h = crypto.createHash('sha256');
  for (const f of listSourceFiles(root)) { h.update(path.relative(root, f)); h.update('\0'); h.update(fs.readFileSync(f)); h.update('\0'); }
  return h.digest('hex');
}

// 봉인 대상: 판정 도구 전부 + 문턱. 여기가 바뀌면 "게이트를 낮췄나" 를 사람이 볼 수 있어야 한다.
export function sealHash(root) {
  const h = crypto.createHash('sha256');
  const dir = path.join(root, 'forge');
  for (const name of fs.readdirSync(dir).sort()) if (/\.(mjs|json)$/.test(name)) { h.update(name); h.update(fs.readFileSync(path.join(dir, name))); }
  return h.digest('hex');
}

export function readSeal(root) { try { return fs.readFileSync(path.join(root, 'forge/.seal'), 'utf8').trim(); } catch { return null; } }
export function writeSeal(root) { const s = sealHash(root); fs.writeFileSync(path.join(root, 'forge/.seal'), s + '\n'); return s; }
