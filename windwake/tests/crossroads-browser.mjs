import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {connect} from './cdp.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const target=new URL(process.argv[2]||'http://127.0.0.1:8791/');
const output=resolve(process.argv[3]||'docs/specs/2026-09-30-windwake-crossroads/verifications/local');
const env={...process.env,CLAUDE_SCRATCHPAD:`/private/tmp/windwake-crossroads-browser-${process.pid}`};
const report={url:target.href,status:'running',fixtures:'All four corridor roundtrips, both ruin clears and combined journey start from fresh unmodified games. Checkpoint images restore earned snapshots; only camera changes. Timer expiry/retry is separately labeled presentation fixture replaying an earned active timer with normal simulation steps and positioning at its start node for retry.',errors:[]};
let c,profile;await mkdir(output,{recursive:true});await mkdir(env.CLAUDE_SCRATCHPAD,{recursive:true});
const cache=new Map();
async function browserModule(path){
  const absolute=resolve(root,'windwake/tests',path);if(cache.has(absolute))return cache.get(absolute);
  let code=await readFile(absolute,'utf8');
  for(const match of [...code.matchAll(/\bfrom\s*(['"])(\.{1,2}\/[^'"]+)\1/g)]){
    const dep=resolve(dirname(absolute),match[2]),url=dep.startsWith(resolve(root,'windwake/tests')+'/')?await browserModule(dep):new URL(dep.slice(resolve(root,'windwake').length+1),target).href;
    code=code.replace(match[0],`from ${JSON.stringify(url)}`);
  }
  const url=`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;cache.set(absolute,url);return url;
}
const modules=Object.fromEntries(await Promise.all([['ruins','ruin-routes.mjs'],['corridors','corridor-routes.mjs'],['combined','crossroads-routes.mjs'],['cacheCombat','corridor-combat-routes.mjs']].map(async([name,path])=>[name,await browserModule(path)])));
try{
  for(let n=0;n<100;n++){
    const name=`crossroads-${process.pid}-${n}`,port=Number(execFileSync('scripts/cdp-chrome.sh',['port',name],{cwd:root,env,encoding:'utf8'}).trim());
    let busy=false;try{await fetch(`http://127.0.0.1:${port}/json/version`,{signal:AbortSignal.timeout(200)});busy=true;}catch{}
    if(!busy){profile=name;break;}
  }
  assert.ok(profile);const port=Number(execFileSync('scripts/cdp-chrome.sh',['start',profile,'--gl'],{cwd:root,env,encoding:'utf8'}).trim().split('\n').at(-1));
  c=await connect(port);await c.send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});await c.send('Emulation.setFocusEmulationEnabled',{enabled:true});await c.send('Page.navigate',{url:target.href});
  for(let i=0;i<150;i++){await c.sleep(100);if(await c.evaluate('!!window.WINDWAKE'))break;}
  assert.ok(await c.evaluate('!!window.WINDWAKE&&document.getElementById("fatal").hidden'));
  await c.clickId('start-button');await c.key('KeyW');await c.sleep(650);await c.tap('Space');await c.sleep(120);await c.key('KeyW','keyUp');
  const cameraBefore=await c.evaluate('WINDWAKE.camera()');
  await c.send('Input.dispatchMouseEvent',{type:'mousePressed',x:650,y:400,button:'right',buttons:2,clickCount:1});await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:710,y:425,button:'right',buttons:2});await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:710,y:425,button:'right',buttons:0,clickCount:1});
  report.trustedInput=await c.evaluate('({jumps:WINDWAKE.state().metrics.jumps,distance:WINDWAKE.state().metrics.distance,camera:WINDWAKE.camera()})');assert.ok(report.trustedInput.jumps>0&&report.trustedInput.distance>1);assert.notEqual(report.trustedInput.camera.yaw,cameraBefore.yaw);
  await c.evaluate('WINDWAKE.setManual(true)');await c.screenshot(resolve(output,'trusted-jump-mouse.png'));
  await c.evaluate(`(async()=>{window.qaRuins=await import(${JSON.stringify(modules.ruins)});window.qaCorridors=await import(${JSON.stringify(modules.corridors)});window.qaCacheCombat=await import(${JSON.stringify(modules.cacheCombat)});window.qaCombined=await import(${JSON.stringify(modules.combined)});window.qaWorld=await import(new URL('world.mjs',location.href));window.qaDungeon=await import(new URL('dungeons.mjs',location.href));window.qaVisuals={};window.qaDriver={state:()=>WINDWAKE.state(),step:(n,input)=>{const s=WINDWAKE.step(n,input,{render:false}),id=s.expedition.active?.id;if(id&&s.enemies.some(e=>e.type==='boss'&&e.state==='telegraph')&&!qaVisuals[id+'-tell'])qaVisuals[id+'-tell']=WINDWAKE.snapshot();if(!id){for(const route of qaWorld.CORRIDORS){const mid=route.points[2];if(Math.hypot(s.player.x-mid.x,s.player.z-mid.z)<5&&!qaVisuals[route.id+'-ridge'])qaVisuals[route.id+'-ridge']=WINDWAKE.snapshot();}}if(id==='dungeon-tide'&&Object.keys(s.expedition.active.timedCircuits||{}).length&&!qaVisuals['dungeon-tide-timer'])qaVisuals['dungeon-tide-timer']=WINDWAKE.snapshot();return s;},onCheckpoint:r=>{if(/crossroads|dungeon-(tide|canopy)/.test(r.stage))qaVisuals[r.stage]=WINDWAKE.snapshot();},town:(a,p)=>WINDWAKE.town(a,p),learn:id=>WINDWAKE.learn(id),equip:(id,slot)=>WINDWAKE.equip(id,slot),equipRelic:(id,slot)=>WINDWAKE.equipRelic(id,slot),save:()=>WINDWAKE.save(),load:d=>WINDWAKE.load(d)};})()`);
  report.corridors=[];
  for(const id of await c.evaluate('qaWorld.CORRIDORS.map(c=>c.id)')){
    const result=await c.evaluate(`(()=>{WINDWAKE.reset();const forward=qaCorridors.runCorridor(qaDriver,${JSON.stringify(id)},{freshStart:true});qaVisuals[${JSON.stringify(id+'-arrival')}]=WINDWAKE.snapshot();const reverse=qaCorridors.runCorridor(qaDriver,${JSON.stringify(id)},{reverse:true});return{forward,reverse};})()`);assert.equal(result.forward.falls,0);assert.equal(result.reverse.falls,0);report.corridors.push(result);console.log('CHROME CORRIDOR ROUNDTRIP PASS',id);
  }
  report.cacheCombat=[];
  for(const id of await c.evaluate('qaWorld.CORRIDORS.map(c=>c.id)')){
    report.cacheCombat.push(await c.evaluate(`(()=>{WINDWAKE.reset();return qaCacheCombat.runCorridorCache(qaDriver,${JSON.stringify(id)});})()`));console.log('CHROME GUARDED CACHE PASS',id);
  }
  report.ruins=[];
  for(const id of ['dungeon-tide','dungeon-canopy']){
    const result=await c.evaluate(`(()=>{WINDWAKE.reset();const returned=qaRuins.runRuinRoute(qaDriver,${JSON.stringify(id)});return{returned,proof:WINDWAKE.state().expedition.progress[${JSON.stringify(id)}]};})()`);assert.equal(result.returned.falls,0);assert.ok(result.proof.claimed);assert.equal(result.proof.opened.length,2);report.ruins.push(result);console.log('CHROME FRESH RUIN PASS',id);
  }
  report.combined=await c.evaluate('(()=>{WINDWAKE.reset();return qaCombined.runCrossroadsRoute(qaDriver);})()');assert.equal(report.combined.finish.falls,0);console.log('CHROME FRESH COMBINED PASS');
  for(const key of await c.evaluate('Object.keys(qaVisuals)')){
    if(!/ridge|arrival|entry|upper|crown|tell|cleared|timer|equipped-return|reloaded/.test(key))continue;
    await c.evaluate(`WINDWAKE.restore(qaVisuals[${JSON.stringify(key)}]);WINDWAKE.setCamera({yaw:-.7,pitch:.28,distance:10});for(let i=0;i<20;i++)WINDWAKE.render();`);await c.screenshot(resolve(output,`${key}.png`));assert.ok(await c.evaluate('WINDWAKE.metrics().renderer.cameraEye.every(Number.isFinite)'));
  }
  // Explicit timer feedback fixture; accepted fresh clear proof above is independent.
  report.timerFixture=await c.evaluate(`(()=>{WINDWAKE.restore(qaVisuals['dungeon-tide-timer']);const s=WINDWAKE.state(),d=qaDungeon.DUNGEONS.find(d=>d.id==='dungeon-tide'),q=d.puzzles[0],timer=s.expedition.active.timedCircuits[q.id];if(!timer)throw Error('Missing earned timer');WINDWAKE.step(timer.deadline-s.frame,{}, {render:false});const expired=WINDWAKE.state(),expiryToast=expired.toast;if(expired.expedition.active.timedCircuits[q.id])throw Error('Timer failed to expire');WINDWAKE.render();qaVisuals['timer-expired-fixture']=WINDWAKE.snapshot();const node=d.landmarks.find(l=>l.puzzleId===q.id&&l.index===0);WINDWAKE.teleport(node.x,node.y,node.z);WINDWAKE.step(1,{});WINDWAKE.step(1,{interact:true});const retried=WINDWAKE.state();if(!retried.expedition.active.timedCircuits[q.id])throw Error('Free retry failed');return{label:'timer presentation fixture',expiryToast,retried:!!retried.expedition.active.timedCircuits[q.id],remaining:qaDungeon.dungeonObjective(retried)};})()`);
  await c.screenshot(resolve(output,'timer-retry-fixture.png'));await c.evaluate("WINDWAKE.restore(qaVisuals['timer-expired-fixture']);WINDWAKE.render()");await c.screenshot(resolve(output,'timer-expired-fixture.png'));
  await c.evaluate("WINDWAKE.restore(qaVisuals['dungeon-canopy-cleared']);WINDWAKE.setManual(false)");await c.tap('KeyM');await c.sleep(100);await c.screenshot(resolve(output,'canopy-altitude-map.png'));await c.tap('Escape');
  await c.evaluate("WINDWAKE.restore(qaVisuals['crossroads-equipped-return']);WINDWAKE.setManual(false)");await c.clickId('relics-button');await c.sleep(100);await c.screenshot(resolve(output,'earned-canopy-relic-panel.png'));await c.tap('Escape');await c.clickId('map-button');await c.sleep(100);await c.screenshot(resolve(output,'crossroads-atlas-journal.png'));
  report.metrics=await c.evaluate('WINDWAKE.metrics()');assert.ok(report.metrics.actors<=64);assert.ok(report.metrics.renderer.cameraEye.every(Number.isFinite));
  report.errors=c.events.filter(e=>e.method==='Runtime.exceptionThrown'||e.method==='Runtime.consoleAPICalled'&&e.params.type==='error'||e.method==='Log.entryAdded'&&e.params.entry.level==='error');assert.equal(report.errors.length,0,JSON.stringify(report.errors));report.status='passed';
  console.log('CROSSROADS CHROME PASS',JSON.stringify({corridors:report.corridors.length,ruins:report.ruins.length,errors:report.errors.length}));
}catch(error){report.status='failed';report.failure=String(error);throw error;}
finally{await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');c?.close();if(profile)execFileSync('scripts/cdp-chrome.sh',['stop',profile],{cwd:root,env,stdio:'pipe'});}
