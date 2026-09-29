import test from 'node:test';
import {runNodeDepthLifeRoute} from './depth-life-route.mjs';
test('fresh ordinary cave → home → harvest → craft → consume → two reloads preserves earned unlock and effect',async t=>{t.diagnostic(JSON.stringify(await runNodeDepthLifeRoute()));});
