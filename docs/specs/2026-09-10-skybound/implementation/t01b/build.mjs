import {createRequire} from 'node:module';
import {dirname, resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile,writeFile} from 'node:fs/promises';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../../portal-fe/package.json'));
export const dependencyRoot=resolve(dirname(require.resolve('three')),'..');
export const THREE=await import(new URL(`file://${join(dependencyRoot,'build/three.module.js')}`));
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {version}=JSON.parse(await readFile(join(dependencyRoot,'package.json')));
 const esbuild=require('esbuild');
 if(version!=='0.183.2'||esbuild.version!=='0.27.7')throw new Error('Expected existing Three.js 0.183.2 / esbuild 0.27.7');
 // Keep vendor shader strings escaped, preserving their bytes without multiline whitespace in the bundle.
 await esbuild.build({entryPoints:[join(here,'src/viewer.mjs')],outfile:join(here,'viewer.js'),bundle:true,format:'esm',minify:true,alias:{three:dependencyRoot},target:'es2022',supported:{'template-literal':false}});
 const {createWorld}=await import('./src/world.mjs');const {root,stats}=createWorld(THREE);
 await writeFile(join(here,'scene-stats.json'),JSON.stringify(stats,null,2)+'\n');
 console.log(JSON.stringify({build:'viewer.js',three:version,esbuild:esbuild.version,...stats},null,2));
}
