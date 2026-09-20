// Verify the exact packaged runtime through nginx/CDN, then play it in real Chrome.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {connect} from './cdp.mjs';

const url = new URL(process.argv[2] || 'https://game.1989v.com/games/windwake/index.html');
const base = new URL('./', url);
const output = process.argv[3] || '/private/tmp/windwake-deployed';
const root = fileURLToPath(new URL('../../', import.meta.url));
const env = {...process.env, CLAUDE_SCRATCHPAD: '/private/tmp/windwake-deploy-qa'};
await mkdir(output, {recursive: true});
await mkdir(env.CLAUDE_SCRATCHPAD, {recursive: true});
const metadataResponse = await fetch(new URL('build-metadata.json', base));
assert.equal(metadataResponse.status, 200);
const metadata = await metadataResponse.json();
assert.equal(metadata.game, 'windwake');
assert.deepEqual(Object.keys(metadata.files).sort(), ['index.html','style.css','main.mjs','world.mjs','sim.mjs','render.mjs','audio.mjs','input.mjs','combat.mjs','progression.mjs','village.mjs','frontier-ui.mjs','dungeons.mjs','settlements.mjs','relics.mjs','journey-ui.mjs'].sort());
const assets = [];
for (const [name, hash] of Object.entries(metadata.files)) {
  const localHash = createHash('sha256').update(await readFile(new URL('../'+name, import.meta.url))).digest('hex');
  assert.equal(hash, localHash, `${name} release metadata matches the checked source`);
  const response = await fetch(new URL(name, base));
  assert.equal(response.status, 200, name);
  const actual = createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');
  assert.equal(actual, hash, `${name} deployed bytes match release metadata`);
  if (name.endsWith('.mjs')) assert.match(response.headers.get('content-type'), /javascript/);
  assets.push({name, sha256: actual, contentType: response.headers.get('content-type')});
}
assert.equal((await fetch(new URL('missing.mjs', base))).status, 404);
let cdp;
try {
  const port = Number(execFileSync('scripts/cdp-chrome.sh', ['start', 'windwake-deploy', '--gl'], {
    cwd: root, env, encoding: 'utf8',
  }).trim().split('\n').at(-1));
  cdp = await connect(port);
  await cdp.send('Emulation.setDeviceMetricsOverride', {width:1280, height:800, deviceScaleFactor:1, mobile:false});
  await cdp.send('Emulation.setFocusEmulationEnabled', {enabled:true});
  await cdp.send('Page.navigate', {url:url.href});
  for (let i=0; i<100; i++) {
    await cdp.sleep(100);
    if (await cdp.evaluate('!!window.WINDWAKE')) break;
  }
  assert.equal(await cdp.evaluate('!!window.WINDWAKE && document.getElementById("fatal").hidden'), true);
  await cdp.screenshot(output+'/title.png');
  await cdp.clickId('start-button');
  const before = await cdp.evaluate('WINDWAKE.state().player.z');
  await cdp.key('KeyW'); await cdp.sleep(800); await cdp.tap('Space');
  await cdp.sleep(150); await cdp.key('KeyW', 'keyUp');
  const after = await cdp.evaluate('({z:WINDWAKE.state().player.z,jumps:WINDWAKE.state().metrics.jumps,grounded:WINDWAKE.state().player.grounded})');
  assert.ok(after.z > before+2 && after.jumps > 0 && !after.grounded, 'trusted movement and physical jump');
  await cdp.screenshot(output+'/jump.png');
  const source = await readFile(new URL('./routes.mjs', import.meta.url), 'utf8');
  const routes = source.slice(0, source.indexOf("if (typeof process !== 'undefined'"))
    .replace("import { WORLD, RUNES, LANDMARKS, PLATFORMS } from '../world.mjs';",
      `const { WORLD, RUNES, LANDMARKS, PLATFORMS } = await import(${JSON.stringify(new URL('world.mjs', base).href)});`)
    .replace(/^export /gm, '');
  await cdp.evaluate(`(async()=>{${routes}\nwindow.deployedRoutes={runJourney,checkpoint};})()`);
  const journey = await cdp.evaluate(`WINDWAKE.reset();deployedRoutes.runJourney({state:()=>WINDWAKE.state(),step:(n,i)=>WINDWAKE.step(n,i,{render:false})});WINDWAKE.render();deployedRoutes.checkpoint({state:()=>WINDWAKE.state()},'deployed-ending')`);
  assert.equal(journey.mode, 'won'); assert.equal(journey.sigils.length, 3);
  await cdp.evaluate('WINDWAKE.setManual(false)'); await cdp.sleep(200);
  await cdp.screenshot(output+'/ending.png');
  const frontierSource = await readFile(new URL('./frontier-routes.mjs', import.meta.url), 'utf8');
  const frontierRoutes = frontierSource.slice(0,frontierSource.indexOf("if(typeof process!=='undefined'"))
    .replace("import { WORLD, VILLAGE, TRAIL_ROUTES, WAYPOINTS, BOSS_SITES, RESOURCE_NODES } from '../world.mjs';",
      `const { WORLD, VILLAGE, TRAIL_ROUTES, WAYPOINTS, BOSS_SITES, RESOURCE_NODES } = await import(${JSON.stringify(new URL('world.mjs', base).href)});`)
    .replace(/^export /gm,'');
  await cdp.evaluate(`(async()=>{${frontierRoutes}\nwindow.deployedFrontier={runFrontierAdventure,frontierCheckpoint};})()`);
  const frontier = await cdp.evaluate('WINDWAKE.reset();deployedFrontier.runFrontierAdventure({state:()=>WINDWAKE.state(),step:(n,i)=>WINDWAKE.step(n,i,{render:false}),village:(a,p)=>WINDWAKE.village(a,p),learn:id=>WINDWAKE.learn(id),equip:(id,slot)=>WINDWAKE.equip(id,slot),travel:id=>WINDWAKE.travel(id)})');
  assert.equal(frontier.finalDefeated,true);assert.equal(frontier.villageLevel,3);assert.equal(frontier.raid,'won');
  await cdp.evaluate('WINDWAKE.setManual(false)');await cdp.sleep(250);await cdp.screenshot(output+'/frontier-ending.png');
  await cdp.clickId('return-game');await cdp.tap('Escape');await cdp.send('Page.reload',{ignoreCache:true});
  for(let i=0;i<100;i++){await cdp.sleep(100);if(await cdp.evaluate('!!window.WINDWAKE'))break;}
  await cdp.clickId('continue-button');const resumed=await cdp.evaluate('({mode:WINDWAKE.state().mode,final:WINDWAKE.state().adventure.finalDefeated,level:WINDWAKE.state().village.level,raidRewarded:WINDWAKE.state().village.raid.rewarded})');
  assert.deepEqual(resumed,{mode:'playing',final:true,level:3,raidRewarded:true});
  const errors = cdp.events.filter(e=>e.method==='Runtime.exceptionThrown'||e.method==='Runtime.consoleAPICalled'&&e.params.type==='error'||e.method==='Log.entryAdded'&&e.params.entry.level==='error');
  assert.equal(errors.length, 0, JSON.stringify(errors));
  const report = {url:url.href, sourceCommit:metadata.sourceCommit, assets, trustedInput:after, journey, frontier, resumed, errors};
  await writeFile(output+'/report.json', JSON.stringify(report,null,2)+'\n');
  console.log('DEPLOYED CHROME PASS', JSON.stringify(report));
} finally {
  cdp?.close();
  try {execFileSync('scripts/cdp-chrome.sh',['stop','windwake-deploy'],{cwd:root,env,stdio:'pipe'});} catch {}
}
