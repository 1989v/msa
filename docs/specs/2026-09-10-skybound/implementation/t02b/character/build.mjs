import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(here, '../../../../../../portal-fe/package.json'));
const { build } = require('esbuild');
const threeRoot = resolve(dirname(require.resolve('three')), '..');
await build({
  entryPoints: [resolve(here, 'src/viewer.mjs')],
  outfile: resolve(here, 'viewer.bundle.js'),
  bundle: true, format: 'esm', platform: 'browser', target: 'es2022',
  alias: { three: threeRoot },
});
console.log('Built character/viewer.bundle.js');
