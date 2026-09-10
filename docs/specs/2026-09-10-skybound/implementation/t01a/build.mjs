import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
const here = dirname(fileURLToPath(import.meta.url));
// Resolve from this repository's existing portal dependencies; no absolute user path or CDN.
const require = createRequire(resolve(here, '../../../../../portal-fe/package.json'));
export const threeRoot = dirname(require.resolve('three/package.json'.replace('/package.json','')));
const threeEntry = require.resolve('three');
export const dependencyRoot = resolve(dirname(threeEntry), '..');
export const THREE = await import(new URL(`file://${join(dependencyRoot, 'build/three.module.js')}`));
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { build } = require('esbuild');
  const { createShrine } = await import('./src/model.mjs');
  const { encodeGLB } = await import('./src/export-glb.mjs');
  const model = createShrine(THREE);
  const { buffer, stats } = encodeGLB(model);
  await mkdir(join(here,'assets'), {recursive:true});
  await writeFile(join(here,'assets/wind-shrine.glb'), buffer);
  await writeFile(join(here,'assets/model-stats.json'), JSON.stringify(stats,null,2)+'\n');
  await build({entryPoints:[join(here,'src/viewer.mjs')], outfile:join(here,'viewer.js'), bundle:true, format:'esm', minify:true, alias:{three:dependencyRoot}, target:'es2022'});
  console.log(JSON.stringify({export:'assets/wind-shrine.glb',...stats,build:'viewer.js'},null,2));
}
