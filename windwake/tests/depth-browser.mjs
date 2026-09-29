import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {connect} from './cdp.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const target=new URL(process.argv[2]||'http://127.0.0.1:8791/');
const output=resolve(process.argv[3]||'docs/specs/2026-09-29-windwake-depth/verifications/local');
const env={...process.env,CLAUDE_SCRATCHPAD:`/private/tmp/windwake-depth-browser-${process.pid}`};
const report={url:target.href,status:'running',fixtures:'Caves start fresh with ordinary input. Expedition starts are explicitly positioned at existing waypoints. Visuals replay earned snapshots, with camera changes only.',errors:[]};
let c,profile;await mkdir(output,{recursive:true});await mkdir(env.CLAUDE_SCRATCHPAD,{recursive:true});
const cache=new Map();
async function browserModule(path){
  const absolute=resolve(root,'windwake/tests',path);if(cache.has(absolute))return cache.get(absolute);
  let code=await readFile(absolute,'utf8');
  for(const match of [...code.matchAll(/\bfrom\s*(['"])(\.{1,2}\/[^'"]+)\1/g)]){
    const dep=resolve(dirname(absolute),match[2]);const url=dep.startsWith(resolve(root,'windwake/tests')+'/')?await browserModule(dep):new URL(dep.slice(resolve(root,'windwake').length+1),target).href;
    code=code.replace(match[0],`from ${JSON.stringify(url)}`);
  }
  const url=`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;cache.set(absolute,url);return url;
}
const cave=await browserModule('cave-routes.mjs'),geography=await browserModule('geography-routes.mjs'),life=await browserModule('depth-life-route.mjs');
try{
  for(let n=0;n<100;n++){
    const name=`depth-${process.pid}-${n}`,port=Number(execFileSync('scripts/cdp-chrome.sh',['port',name],{cwd:root,env,encoding:'utf8'}).trim());
    let busy=false;try{await fetch(`http://127.0.0.1:${port}/json/version`,{signal:AbortSignal.timeout(200)});busy=true;}catch{}
    if(!busy){profile=name;break;}
  }
  assert.ok(profile);const port=Number(execFileSync('scripts/cdp-chrome.sh',['start',profile,'--gl'],{cwd:root,env,encoding:'utf8'}).trim().split('\n').at(-1));
  c=await connect(port);await c.send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});await c.send('Emulation.setFocusEmulationEnabled',{enabled:true});await c.send('Page.navigate',{url:target.href});
  for(let i=0;i<150;i++){await c.sleep(100);if(await c.evaluate('!!window.WINDWAKE'))break;}
  assert.ok(await c.evaluate('!!window.WINDWAKE&&document.getElementById("fatal").hidden'));
  await c.clickId('start-button');await c.key('KeyW');await c.sleep(650);await c.tap('Space');await c.sleep(120);await c.key('KeyW','keyUp');
  report.trustedMovement=await c.evaluate('({jumps:WINDWAKE.state().metrics.jumps,distance:WINDWAKE.state().metrics.distance,air:WINDWAKE.state().player.airState})');assert.ok(report.trustedMovement.jumps>0&&report.trustedMovement.distance>1);
  await c.screenshot(resolve(output,'trusted-jump.png'));
  await c.evaluate(`(async()=>{window.qaLife=await import(${JSON.stringify(life)});window.qaCaves=await import(${JSON.stringify(cave)});window.qaGeography=await import(${JSON.stringify(geography)});window.qaWorld=await import(new URL('world.mjs',location.href));window.qaVisuals={};window.qaDriver={state:()=>WINDWAKE.state(),step:(n,input)=>{const s=WINDWAKE.step(n,input,{render:false});const id=s.expedition.active?.id;if(id&&s.enemies.some(e=>e.type==='boss'&&e.state==='telegraph')&&!qaVisuals[id+'-tell'])qaVisuals[id+'-tell']=WINDWAKE.snapshot();if(!id&&s.player.y>90&&!qaVisuals.summit)qaVisuals.summit=WINDWAKE.snapshot();return s;},onCheckpoint:r=>{qaVisuals[r.stage]=WINDWAKE.snapshot();},town:(a,p)=>WINDWAKE.town(a,p),learn:id=>WINDWAKE.learn(id),equip:(id,slot)=>WINDWAKE.equip(id,slot),travel:id=>WINDWAKE.travel(id),village:(a,p)=>WINDWAKE.village(a,p),save:()=>WINDWAKE.save(),load:d=>WINDWAKE.load(d)};})()`);
  report.caves=[];
  for(const id of ['cave-canyon','cave-mistwood']){
    const result=await c.evaluate(`(()=>{WINDWAKE.reset();return qaCaves.runCaveRoute(qaDriver,${JSON.stringify(id)});})()`);report.caves.push(result);assert.equal(result.falls,0);assert.ok(result.progress.claimed);console.log('CHROME CAVE PASS',id);
  }
  report.life=await c.evaluate('(()=>{WINDWAKE.reset();return qaLife.runDepthLifeRoute(qaDriver);})()');console.log('CHROME CAVE TO CRAFT PASS');
  report.expeditions=[];
  for(const id of await c.evaluate('qaWorld.EXPEDITIONS.map(e=>e.id)')){
    report.expeditions.push(await c.evaluate(`(()=>{WINDWAKE.reset();const r=qaWorld.EXPEDITIONS.find(e=>e.id===${JSON.stringify(id)}),w=qaWorld.WAYPOINTS.find(w=>w.id===r.waypointId);WINDWAKE.teleport(w.x,w.y,w.z);WINDWAKE.step(1,{});return qaGeography.runExpedition(qaDriver,r.id);})()`));console.log('CHROME EXPEDITION PASS',id);
  }
  for(const key of await c.evaluate('Object.keys(qaVisuals)')){
    if(!/basin|gallery|tell|summit|cleared|side-cache|depth-life/.test(key))continue;
    await c.evaluate(`WINDWAKE.restore(qaVisuals[${JSON.stringify(key)}]);WINDWAKE.setCamera({yaw:-.7,pitch:.22,distance:8});for(let i=0;i<30;i++)WINDWAKE.render();`);
    await c.screenshot(resolve(output,`${key}.png`));
    assert.ok(await c.evaluate('WINDWAKE.metrics().renderer.cameraEye.every(Number.isFinite)'));
  }
  // Town layout and resident visuals use explicit presentation fixtures, not progression evidence.
  for(const id of ['town-alpine','town-canyon']){
    await c.evaluate(`WINDWAKE.reset();{const t=qaWorld.TOWNS.find(t=>t.id===${JSON.stringify(id)});WINDWAKE.teleport(t.x,t.y,t.z);WINDWAKE.setCamera({yaw:.6,pitch:.4,distance:16});for(let i=0;i<40;i++)WINDWAKE.render();}`);
    await c.screenshot(resolve(output,`${id}.png`));
  }
  await c.evaluate(`(()=>{
    WINDWAKE.reset();const s=WINDWAKE.snapshot(),v=qaWorld.VILLAGE;Object.assign(s.player,{x:v.x,y:qaWorld.heightAt(v.x,v.z),z:v.z});
    s.journey.quests['quest-coast-local']=2;s.journey.quests['quest-coast-regional']=2;s.adventure.waypoints.push('waypoint-coast');s.adventure.bosses.push('boss-coast');WINDWAKE.restore(s);
    for(const [type,dx,dz]of [['cottage',8,0],['kitchen',-8,0],['workshop',0,-8],['plot',0,8]]){WINDWAKE.teleport(v.x+dx-3.8,qaWorld.heightAt(v.x+dx-3.8,v.z+dz),v.z+dz);const r=WINDWAKE.village('build',{type,x:v.x+dx,z:v.z+dz});if(!r.ok)throw Error(r.reason);if(type==='plot'){WINDWAKE.teleport(v.x+dx,qaWorld.heightAt(v.x+dx,v.z+dz),v.z+dz);WINDWAKE.village('plant',{id:r.id,crop:'pumpkin'});}}
    WINDWAKE.teleport(v.x,qaWorld.heightAt(v.x,v.z),v.z);if(!WINDWAKE.village('invite',{id:'resident-coast'}).ok)throw Error('Fixture invitation failed');WINDWAKE.village('assign',{id:'resident-coast',job:'farmer'});
    WINDWAKE.setCamera({yaw:.6,pitch:.4,distance:16});for(let i=0;i<30;i++)WINDWAKE.render();
  })()`);await c.screenshot(resolve(output,'community-visual-fixture.png'));
  await c.evaluate('WINDWAKE.setManual(false)');await c.clickId('village-button');await c.sleep(100);await c.screenshot(resolve(output,'community-panel.png'));await c.tap('Escape');
  await c.evaluate('WINDWAKE.setManual(false)');await c.tap('KeyM');await c.sleep(100);await c.screenshot(resolve(output,'world-atlas.png'));
  report.metrics=await c.evaluate('WINDWAKE.metrics()');
  report.errors=c.events.filter(e=>e.method==='Runtime.exceptionThrown'||e.method==='Runtime.consoleAPICalled'&&e.params.type==='error'||e.method==='Log.entryAdded'&&e.params.entry.level==='error');assert.equal(report.errors.length,0,JSON.stringify(report.errors));report.status='passed';
  console.log('DEPTH CHROME PASS',JSON.stringify({caves:report.caves.length,expeditions:report.expeditions.length,errors:report.errors.length}));
}catch(error){report.status='failed';report.failure=String(error);throw error;}
finally{await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');c?.close();if(profile)execFileSync('scripts/cdp-chrome.sh',['stop',profile],{cwd:root,env,stdio:'pipe'});}
