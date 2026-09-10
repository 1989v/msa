import { build } from '../../../../../../portal-fe/node_modules/esbuild/lib/main.js';
import { fileURLToPath } from 'node:url';

await build({
  entryPoints: [fileURLToPath(new URL('./probe.mjs', import.meta.url))],
  outfile: fileURLToPath(new URL('./probe.bundle.js', import.meta.url)),
  bundle: true, format: 'esm', platform: 'browser', target: 'es2022',
});
console.log('Built texture-check/probe.bundle.js');
