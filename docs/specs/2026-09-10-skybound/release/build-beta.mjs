import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative } from 'node:path';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../../..');
const traversal = resolve(here, '../implementation/t02b/traversal');
const dist = resolve(here, 'dist');
const require = createRequire(resolve(repo, 'portal-fe/package.json'));
const esbuild = require('esbuild');
const threeRoot = resolve(dirname(require.resolve('three')), '..');
const esbuildRoot = dirname(require.resolve('esbuild/package.json'));
const sha256 = data => createHash('sha256').update(data).digest('hex');
function replaceOnce(text, from, to) {
  if (text.split(from).length !== 2) throw new Error(`Beta template contract changed: ${from}`);
  return text.replace(from, to);
}

let html = await readFile(resolve(traversal, 'index.html'), 'utf8');
html = replaceOnce(html, 'data-theme="light"', 'data-theme="light" data-beta="true" data-character-src="./assets/naru-lod0.glb"');
html = replaceOnce(html, '<title>나루 · 이동 연결 진단</title>', '<title>바람의 유적 · 개발 베타</title>');
html = replaceOnce(html, '<h1>나루의 첫걸음</h1><p>이동 연결 진단</p>', '<h1>바람의 유적 · 개발 베타</h1><p>나루와 함께 바람을 따라</p>');
html = replaceOnce(html, '</header>', '</header><p class="note">초원을 둘러보고, 금빛 원의 상승기류로 두 착지대에 도달해 보세요. 프리즘은 회전해서 오른쪽 받침의 긴 방향에 맞춰 놓아 주세요.</p>');
html = replaceOnce(html, '지형과 캐릭터를 읽고 있습니다…', '바람의 유적을 준비하고 있어요…');
const note = /<p class="note">앞쪽 금빛 원[\s\S]*?<\/p>/;
if (!note.test(html)) throw new Error('Beta development note template changed');
html = html.replace(note, '<p class="note">개발 중인 짧은 체험판입니다. 프리즘 운반 중에는 이동과 점프가 잠깐 멈춥니다. 진행은 저장되지 않으며 새로고침하면 처음부터 시작합니다. ‘출발점으로’는 물체와 목표도 모두 초기화합니다. <a href="./THIRD-PARTY-NOTICES.txt">오픈소스 안내</a></p>');

const bundle = await esbuild.build({
  absWorkingDir: repo, entryPoints: [resolve(traversal, 'src/viewer.mjs')],
  outfile: resolve(dist, 'viewer.bundle.js'), bundle: true, write: false, metafile: true,
  sourcemap: false, minify: true, legalComments: 'inline', charset: 'utf8',
  format: 'esm', platform: 'browser', target: 'es2022', alias: { three: threeRoot },
});
const threePackage = JSON.parse(await readFile(resolve(threeRoot, 'package.json'), 'utf8'));
const notices = `THIRD-PARTY NOTICES\n\nThree.js ${threePackage.version} — included in the browser bundle.\n\n${await readFile(resolve(threeRoot, 'LICENSE'), 'utf8')}\n\nesbuild ${esbuild.version} — build tool only; its executable is not distributed.\n\n${await readFile(resolve(esbuildRoot, 'LICENSE.md'), 'utf8')}`;
const assets = new Map([
  ['index.html', Buffer.from(html)],
  ['assets/naru-lod0.glb', await readFile(resolve(traversal, '../character/assets/naru-lod0.glb'))],
  ['THIRD-PARTY-NOTICES.txt', Buffer.from(notices)],
]);
for (const output of bundle.outputFiles) {
  const name = relative(dist, output.path);
  if (!['viewer.bundle.js', 'viewer.bundle.css'].includes(name)) throw new Error(`Unexpected public bundle output: ${name}`);
  assets.set(name, output.contents);
}
const metadata = {
  name: '바람의 유적 · 개발 베타', formatVersion: 1,
  generatedAt: new Date().toISOString(), dependencies: { three: threePackage.version, esbuild: esbuild.version },
  files: Object.fromEntries([...assets].map(([name, data]) => [name, { bytes: data.byteLength, sha256: sha256(data) }])),
  note: 'Hashes cover all public payload files; build-metadata.json excludes itself. No gameplay save or deployment is included.',
};
// Only this builder-owned ignored directory is replaced, after all inputs compile.
await rm(dist, { recursive: true, force: true });
for (const [name, data] of assets) {
  const path = resolve(dist, name); await mkdir(dirname(path), { recursive: true }); await writeFile(path, data);
}
await writeFile(resolve(dist, 'build-metadata.json'), JSON.stringify(metadata, null, 2) + '\n');
console.log(`Built ${relative(repo, dist)}/index.html (${assets.size} payload files; metadata added)`);
