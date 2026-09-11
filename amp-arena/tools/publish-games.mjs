// 빌드 산출물을 games 레포(1989v/games)에 커밋한다 — git 없이 GitHub Git Data API 로 (blob → tree → commit → ref).
// 워크트리 세션은 다른 레포의 git 명령을 못 쓰므로 API 로 간다. 토큰은 GH_TOKEN (gh auth token -u 1989v).
// 사용: GH_TOKEN=... node tools/publish-games.mjs --dir client/dist-games --dest arena [--prune] [--file thumbs/shots/arena.jpg=/path/to.jpg] --message "..."
// --prune: dest 아래에서 이번 산출물에 없는 파일(옛 해시 번들)을 함께 지운다. 게시 산출물의 파일명이 해시라 매번 바뀌기 때문.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const repo = opt('--repo', '1989v/games');
const branch = opt('--branch', 'main');
const dir = opt('--dir', 'client/dist-games');
const dest = opt('--dest', 'arena');
const message = opt('--message', `publish ${dest}`);
const extras = args.flatMap((a, i) => (a === '--file' ? [args[i + 1]] : []));
const token = process.env.GH_TOKEN;
if (!token) { console.error('GH_TOKEN 이 없다'); process.exit(2); }

const api = async (method, path, body) => {
  const res = await fetch(`https://api.github.com${path}`, {
    method, headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'content-type': 'application/json', 'x-github-api-version': '2022-11-28' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`);
  return res.json();
};

const walk = (root) => readdirSync(root).flatMap((n) => { const p = join(root, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk(dir).map((p) => ({ path: `${dest}/${relative(dir, p).split('\\').join('/')}`, local: p }));
for (const e of extras) { const [remote, local] = e.split('='); files.push({ path: remote, local }); }

const prune = args.includes('--prune'); // dest 아래에서 이번 산출물에 없는 파일(옛 해시 번들)을 지운다

const ref = await api('GET', `/repos/${repo}/git/ref/heads/${branch}`);
const baseSha = ref.object.sha;
const baseCommit = await api('GET', `/repos/${repo}/git/commits/${baseSha}`);
const tree = [];
if (prune) {
  const full = await api('GET', `/repos/${repo}/git/trees/${baseCommit.tree.sha}?recursive=1`);
  const keep = new Set(files.map((f) => f.path));
  for (const e of full.tree) {
    if (e.type === 'blob' && e.path.startsWith(`${dest}/`) && !keep.has(e.path)) { tree.push({ path: e.path, mode: '100644', type: 'blob', sha: null }); console.log(`  rm   ${e.path}`); }
  }
}
let bytes = 0;
for (const f of files) {
  const buf = readFileSync(f.local);
  bytes += buf.length;
  const blob = await api('POST', `/repos/${repo}/git/blobs`, { content: buf.toString('base64'), encoding: 'base64' });
  tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
  console.log(`  blob ${f.path} (${buf.length} bytes)`);
}
const newTree = await api('POST', `/repos/${repo}/git/trees`, { base_tree: baseCommit.tree.sha, tree });
const author = { name: 'kgd', email: '1989v@naver.com' };
const commit = await api('POST', `/repos/${repo}/git/commits`, { message, tree: newTree.sha, parents: [baseSha], author, committer: author });
await api('PATCH', `/repos/${repo}/git/refs/heads/${branch}`, { sha: commit.sha, force: false });
console.log(`${repo}@${branch}: ${baseSha.slice(0, 8)} → ${commit.sha} (${files.length} files, ${bytes} bytes)`);
console.log(commit.sha);
