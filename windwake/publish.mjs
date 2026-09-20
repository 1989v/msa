// Copy only the standalone runtime into the existing games distribution checkout.
import {readFile, writeFile, mkdir, copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const source = new URL('./', import.meta.url);
const target = new URL('../portal-fe/public/games/windwake/', source);
const files = ['index.html', 'style.css', 'main.mjs', 'world.mjs', 'sim.mjs', 'render.mjs', 'audio.mjs', 'input.mjs', 'combat.mjs', 'progression.mjs', 'village.mjs', 'frontier-ui.mjs', 'dungeons.mjs', 'settlements.mjs', 'relics.mjs', 'journey-ui.mjs'];
const sourceCommit = execFileSync('git', ['log', '-1', '--format=%H', '--', ...files], {
  cwd: fileURLToPath(source), encoding: 'utf8',
}).trim();
const hashes = {};
await mkdir(target, {recursive: true});
for (const file of files) {
  const data = await readFile(new URL(file, source));
  hashes[file] = createHash('sha256').update(data).digest('hex');
  await copyFile(new URL(file, source), new URL(file, target));
}
await writeFile(new URL('build-metadata.json', target), JSON.stringify({game: 'windwake', sourceCommit, files: hashes}, null, 2) + '\n');
console.log(`Published ${files.length} runtime files from ${sourceCommit} to ${fileURLToPath(target)}`);
