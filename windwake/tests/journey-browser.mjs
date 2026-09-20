import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {connect} from './cdp.mjs';

// Usage: node windwake/tests/journey-browser.mjs adventures|continuous|stress|all [url] [output]
// Tests stay local. Their static imports are rewritten to data URLs; runtime
// imports still resolve to the actual origin being tested, including production.
const root=fileURLToPath(new URL('../../',import.meta.url));
const mode=process.argv[2]||'adventures';
assert.ok(['adventures','continuous','stress','all'].includes(mode),'Expected adventures, continuous, stress or all');
const target=new URL(process.argv[3]||'http://127.0.0.1:8787/');
const output=resolve(process.argv[4]||new URL('../../docs/specs/2026-09-20-windwake-journeys/verifications/',import.meta.url).pathname);
const env={...process.env,CLAUDE_SCRATCHPAD:`/private/tmp/windwake-journey-browser-${process.pid}`};
const report={mode,url:target.href,startedAt:new Date().toISOString(),status:'running',adventures:[],continuous:null,stress:null,errors:[],
  cacheContract:'Retained CPU world cache <=96 is intentional reuse. Indoor generation delta must be zero; GPU world chunks must be zero and dungeon batch count one. Initial cache-empty assertion was corrected; initial-cache-assertion artifacts preserve that harness failure.'};
let c,profile,started=false;
await mkdir(output,{recursive:true});await mkdir(env.CLAUDE_SCRATCHPAD,{recursive:true});

const moduleCache=new Map();
async function browserModule(path){
  const absolute=resolve(root,'windwake/tests',path);if(moduleCache.has(absolute))return moduleCache.get(absolute);
  let code=await readFile(absolute,'utf8');
  const imports=[...code.matchAll(/\bfrom\s*(['"])(\.{1,2}\/[^'"]+)\1/g)];
  for(const match of imports){
    const dependency=resolve(dirname(absolute),match[2]);
    const url=dependency.startsWith(resolve(root,'windwake/tests')+'/')
      ?await browserModule(dependency):new URL(dependency.slice(resolve(root,'windwake').length+1),target).href;
    code=code.replace(match[0],`from ${JSON.stringify(url)}`);
  }
  code+=`\n//# sourceURL=windwake-qa/${absolute.split('/').at(-1)}\n`;
  const url=`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;moduleCache.set(absolute,url);return url;
}
const routes={frontier:await browserModule('frontier-routes.mjs'),dungeon:await browserModule('dungeon-routes.mjs'),town:await browserModule('town-routes.mjs')};
async function waitForGame(){
  for(let i=0;i<100;i++){
    try{if(await c.evaluate('!!window.WINDWAKE && document.getElementById("fatal").hidden'))return;}catch{}
    await c.sleep(100);
  }
  throw new Error('Game did not initialize within ten seconds');
}
async function inject(){
  await c.evaluate(`(async()=>{
    window.qaRoutes={frontier:await import(${JSON.stringify(routes.frontier)}),dungeon:await import(${JSON.stringify(routes.dungeon)}),town:await import(${JSON.stringify(routes.town)})};
    window.qaWorld=await import(${JSON.stringify(new URL('world.mjs',target).href)});
    window.qaDungeons=await import(${JSON.stringify(new URL('dungeons.mjs',target).href)});
    window.qaCheckpoints=[];window.qaVisuals={};
    window.qaDriver={state:()=>WINDWAKE.state(),step:(n,input)=>{
      const state=WINDWAKE.step(n,input,{render:false}),id=state.expedition.active?.id;
      if(id&&state.enemies.some(e=>e.type==='boss'&&e.dungeonId===id&&e.state==='telegraph')&&!qaVisuals[id+'-boss-telegraph'])qaVisuals[id+'-boss-telegraph']=WINDWAKE.snapshot();
      return state;
    },town:(a,p)=>WINDWAKE.town(a,p),learn:id=>WINDWAKE.learn(id),equip:(id,slot)=>WINDWAKE.equip(id,slot),travel:id=>WINDWAKE.travel(id),
    onCheckpoint:record=>{
      qaCheckpoints.push(record);
      if(record.dungeon&&(/-entered$|-high-terrace$|-runes-clue$|-weights-solved$|-optional-treasure$|-cleared$/.test(record.stage)))qaVisuals[record.stage]=WINDWAKE.snapshot();
    }};
  })()`);
}
async function screen(name){await c.screenshot(resolve(output,`${mode}-${name}.png`));}
function assertIndoor(metrics){
  assert.equal(metrics.renderer.residentChunks,0,'No world GPU chunks indoors');
  assert.equal(metrics.renderer.dungeonBuffers,1,'Exactly one authored dungeon GPU batch');
  assert.ok(metrics.world.cachedChunks<=96,'Retained overworld CPU cache is bounded indoors');
  assert.ok(metrics.renderer.residentBytes>0&&metrics.renderer.residentBytes<8*1024*1024,'Bounded dungeon geometry');
  assert.ok(metrics.actors<=64,'Actor cap holds indoors');
}
function assertOutdoor(metrics){
  assert.equal(metrics.renderer.dungeonBuffers,0,'Dungeon GPU batch disposed outdoors');
  assert.ok(metrics.renderer.residentChunks<=64&&metrics.world.cachedChunks<=96,'World residency remains bounded');
  assert.ok(metrics.renderer.residentBytes<32*1024*1024&&metrics.actors<=64,'World geometry and actors remain bounded');
}
async function assertBossTelegraph(stage){
  if(!stage.endsWith('-boss-telegraph'))return null;
  const actual=await c.evaluate(`(()=>{
    const s=WINDWAKE.state(),id=s.expedition.active?.id,e=s.enemies.find(e=>e.type==='boss'&&e.dungeonId===id&&e.state==='telegraph');
    return {id,pattern:e?.pattern,expectedName:qaDungeons.DUNGEONS.find(d=>d.id===id)?.name,
      visible:!document.getElementById('boss-bar').hidden,name:document.getElementById('boss-bar').firstElementChild.textContent,
      phase:document.getElementById('boss-phase').textContent};
  })()`);
  const tells={ring:/원형.*점프/,bolt:/파편.*옆으로/,slam:/내려찍기.*거리/,charge:/돌진.*옆으로/,sweep:/휩쓸기.*뒤로/,
    summon:/소환.*작은 적/,eruption:/분출.*원에서/,slow:/서리.*원에서/,leap:/도약.*착지/};
  assert.equal(actual.visible,true,'Telegraph snapshot displays the active boss bar');
  assert.ok(actual.expectedName&&actual.name.includes(actual.expectedName),'Dungeon boss name identifies its actual dungeon');
  assert.ok(tells[actual.pattern],`Known telegraph pattern expected: ${actual.pattern}`);
  assert.match(actual.phase,tells[actual.pattern],'Boss hint describes the actual attack and defensive response');
  return actual;
}
async function persistedReload(expected){
  // Open the real pause panel: its production handler writes localStorage.
  // Page.reload and the actual Continue button then exercise the normal loader.
  await c.evaluate('WINDWAKE.setManual(false)');await c.clickId('pause-button');
  assert.equal((await c.evaluate('WINDWAKE.ui()')).panel,'pause');
  await c.send('Page.reload',{ignoreCache:true});await waitForGame();
  assert.equal(await c.evaluate('document.getElementById("continue-button").hidden'),false,'A real durable save exists');
  await c.clickId('continue-button');await c.evaluate('WINDWAKE.setManual(true)');
  const actual=await c.evaluate('({journey:WINDWAKE.state().journey,expedition:WINDWAKE.state().expedition,mode:WINDWAKE.state().mode})');
  assert.deepEqual(actual.journey.allies,expected.journey.allies);assert.deepEqual(actual.journey.relics,expected.journey.relics);
  assert.deepEqual(actual.journey.quests,expected.journey.quests);assert.deepEqual(actual.expedition.progress,expected.expedition.progress);
  assert.equal(actual.expedition.active,null);assert.equal(actual.mode,'playing');await inject();return actual;
}
async function adventures(){
  const ids=await c.evaluate('qaWorld.TOWNS.map(t=>t.id)');
  for(const id of ids){
    await c.evaluate('WINDWAKE.reset();qaCheckpoints=[];qaVisuals={}');
    const result=await c.evaluate(`qaRoutes.town.runSettlementAdventure(qaDriver,${JSON.stringify(id)})`);
    assert.ok(result.allies.includes(id),'Natural quest return earns the alliance');
    const biome=id.replace('town-','');assert.equal(result.quests[`quest-${biome}-local`],2);assert.equal(result.quests[`quest-${biome}-regional`],2);
    const earned=await c.evaluate('WINDWAKE.save()'),checkpoints=await c.evaluate('qaCheckpoints');
    assert.ok(earned.journey.relics.includes(`relic-${biome}`));
    await c.evaluate('WINDWAKE.setManual(false);WINDWAKE.setManual(true);WINDWAKE.render()');await screen(`${id}-alliance`);
    const replay=[];
    // Snapshot restores below are visual replays only, after the uninterrupted
    // natural route has succeeded. They never contribute progression evidence.
    for(const stage of await c.evaluate('Object.keys(qaVisuals)')){
      await c.evaluate(`WINDWAKE.restore(qaVisuals[${JSON.stringify(stage)}]);WINDWAKE.setCamera({yaw:.6,pitch:.3,distance:9});WINDWAKE.render()`);
      await c.sleep(120);const metrics=await c.evaluate('WINDWAKE.metrics()');assertIndoor(metrics);
      const bossHUD=await assertBossTelegraph(stage);
      await screen(`${stage}-visual-replay`);replay.push({stage,metrics,bossHUD,visualReplay:true});
    }
    await c.evaluate(`WINDWAKE.load(${JSON.stringify(earned)});WINDWAKE.setManual(true)`);
    const reloaded=await persistedReload(earned);await screen(`${id}-continued`);
    report.adventures.push({id,result,checkpoints,visualReplays:replay,reloaded});
    await writeFile(resolve(output,`${mode}-report.json`),JSON.stringify(report,null,2));
    console.log('CHROME SETTLEMENT ADVENTURE PASS',id,JSON.stringify({frames:result.frame,distance:result.distance,falls:result.falls,allies:result.allies,relics:result.relics,visualReplays:replay.length}));
  }
}
async function continuous(){
  const ids=await c.evaluate('qaWorld.TOWNS.map(t=>t.id)'),records=[];
  await c.evaluate('WINDWAKE.reset();qaCheckpoints=[];qaVisuals={}');
  for(const [index,id] of ids.entries()){
    if(index)assert.equal(await c.evaluate('WINDWAKE.travel("home")'),true,'Discovered home return is a normal public travel action');
    const result=await c.evaluate(`qaRoutes.town.runSettlementAdventure(qaDriver,${JSON.stringify(id)},{freshStart:${index===0}})`);
    assert.equal(result.allies.length,index+1);assert.equal(result.relics.length,index+1);assert.equal(result.falls,0);
    records.push(result);await c.evaluate('WINDWAKE.render()');await screen(`continuous-${id}-alliance`);
    const completedHint=await c.evaluate('document.getElementById("quest-text").textContent');
    assert.ok(completedHint.includes('동맹 완료')&&!completedHint.includes('의뢰 받기'),'Allied town HUD guides the next activity, not a completed quest');
    console.log('CHROME CONTINUOUS TOWN PASS',id,JSON.stringify({frames:result.frame,distance:result.distance,allies:result.allies.length,relics:result.relics.length}));
  }
  const earned=await c.evaluate('WINDWAKE.save()'),checkpoints=await c.evaluate('qaCheckpoints');
  assert.equal(earned.journey.allies.length,8);assert.equal(earned.journey.relics.length,8);
  assert.equal(Object.values(earned.journey.quests).filter(n=>n===2).length,16);
  assert.equal(Object.values(earned.expedition.progress).filter(p=>p.claimed).length,4);
  // Replay only after all eight towns have succeeded in this same game.
  const replay=[];
  for(const stage of await c.evaluate('Object.keys(qaVisuals).filter(k=>k.endsWith("-high-terrace")||k.endsWith("-boss-telegraph")||k.endsWith("-cleared"))')){
    await c.evaluate(`WINDWAKE.restore(qaVisuals[${JSON.stringify(stage)}]);WINDWAKE.setCamera({yaw:.6,pitch:.3,distance:9});WINDWAKE.render()`);
    await c.sleep(120);const metrics=await c.evaluate('WINDWAKE.metrics()');assertIndoor(metrics);
    const bossHUD=await assertBossTelegraph(stage);
    await screen(`continuous-${stage}-visual-replay`);replay.push({stage,metrics,bossHUD,visualReplay:true});
  }
  await c.evaluate(`WINDWAKE.load(${JSON.stringify(earned)});WINDWAKE.setManual(true)`);
  const reloaded=await persistedReload(earned);await screen('continuous-all-eight-continued');
  report.continuous={records,checkpoints,visualReplays:replay,reloaded,earned:{time:earned.time,metrics:earned.metrics,journey:earned.journey,expedition:earned.expedition}};
}
async function stress(){
  await c.evaluate(`WINDWAKE.reset();qaCheckpoints=[];qaVisuals={};qaRoutes.frontier.runFrontierTrail(qaDriver,'route-sunfields');
    qaRoutes.frontier.frontierWalk(qaDriver,qaWorld.TOWNS.find(t=>t.id==='town-sunfields'),{combat:false});
    qaRoutes.frontier.frontierWalk(qaDriver,qaWorld.DUNGEON_ENTRANCES.find(d=>d.id==='dungeon-sunfields'),{combat:false})`);
  const samples=[];let indoorPerformance;
  for(let cycle=0;cycle<10;cycle++){
    await c.evaluate(`qaRoutes.frontier.frontierPress(qaDriver,'interact');WINDWAKE.render()`);
    assert.equal(await c.evaluate('WINDWAKE.state().expedition.active?.id'),'dungeon-sunfields');
    await c.sleep(100);const inside=await c.evaluate('WINDWAKE.metrics()');assertIndoor(inside);
    if(cycle===0||cycle===9)await screen(`transition-${cycle+1}-inside`);
    if(cycle===9){
      await c.evaluate('WINDWAKE.setManual(false);WINDWAKE.resetMetrics()');await c.sleep(4000);
      indoorPerformance=await c.evaluate('WINDWAKE.metrics()');assertIndoor(indoorPerformance);assert.ok(indoorPerformance.samples>=30,'Steady indoor frames sampled');
      assert.equal(indoorPerformance.world.generatedChunks,inside.world.generatedChunks,'No new world CPU chunks generated during indoor simulation/rendering');
      await c.evaluate('WINDWAKE.setManual(true)');
    }
    await c.evaluate(`qaRoutes.frontier.frontierPress(qaDriver,'interact');WINDWAKE.render()`);
    assert.equal(await c.evaluate('WINDWAKE.state().expedition.active'),null);await c.sleep(100);
    const outside=await c.evaluate('WINDWAKE.metrics()');assertOutdoor(outside);samples.push({cycle:cycle+1,inside,outside});
    if(cycle===0||cycle===9)await screen(`transition-${cycle+1}-outside`);
    if(cycle<9)await c.evaluate(`qaRoutes.frontier.frontierWalk(qaDriver,qaWorld.DUNGEON_ENTRANCES.find(d=>d.id==='dungeon-sunfields'),{combat:false})`);
  }
  assert.ok(samples.at(-1).outside.renderer.sceneTransitions-samples[0].inside.renderer.sceneTransitions>=19,'Each transition rebuilt the active scene');
  assert.ok(samples.at(-1).outside.renderer.disposedChunks>samples[0].outside.renderer.disposedChunks,'World GPU buffers were actually disposed');
  await c.evaluate('WINDWAKE.setManual(false);WINDWAKE.resetMetrics()');await c.sleep(4000);
  const outdoorPerformance=await c.evaluate('WINDWAKE.metrics()');assertOutdoor(outdoorPerformance);assert.ok(outdoorPerformance.samples>=30,'Steady outdoor frames sampled');
  report.stress={naturalApproach:true,cycles:10,samples,indoorPerformance,outdoorPerformance,final:await c.evaluate('({position:WINDWAKE.state().player,metrics:WINDWAKE.state().metrics,expedition:WINDWAKE.state().expedition})')};
  console.log('CHROME JOURNEY STRESS PASS',JSON.stringify({cycles:10,indoorFPS:indoorPerformance.fps,outdoorFPS:outdoorPerformance.fps,indoorFrameP95:indoorPerformance.frameP95,outdoorFrameP95:outdoorPerformance.frameP95,last:samples.at(-1)}));
}
try{
  // cdp-chrome.sh returns an existing listener for a matching hash. Pick an
  // unused port first so this harness cannot attach to another owner's browser.
  for(let candidate=0;candidate<100;candidate++){
    const name=`windwake-journeys-${process.pid}-${candidate}`,port=Number(execFileSync('scripts/cdp-chrome.sh',['port',name],{cwd:root,env,encoding:'utf8'}).trim());
    let occupied=false;try{await fetch(`http://127.0.0.1:${port}/json/version`,{signal:AbortSignal.timeout(300)});occupied=true;}catch{}
    if(!occupied){profile=name;break;}
  }
  assert.ok(profile,'No unused owned Chrome port available');
  const port=Number(execFileSync('scripts/cdp-chrome.sh',['start',profile,'--gl'],{cwd:root,env,encoding:'utf8'}).trim().split('\n').at(-1));started=true;
  c=await connect(port);await c.send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});await c.send('Emulation.setFocusEmulationEnabled',{enabled:true});
  await c.send('Page.navigate',{url:target.href});await waitForGame();await c.clickId('start-button');await c.evaluate('WINDWAKE.setManual(true)');await inject();
  if(mode==='adventures'||mode==='all')await adventures();
  if(mode==='continuous'||mode==='all')await continuous();
  if(mode==='stress'||mode==='all')await stress();
  report.errors=c.events.filter(e=>e.method==='Runtime.exceptionThrown'||e.method==='Runtime.consoleAPICalled'&&e.params.type==='error'||e.method==='Log.entryAdded'&&e.params.entry.level==='error'||e.method==='Network.loadingFailed'&&!e.params.canceled);
  assert.equal(report.errors.length,0,JSON.stringify(report.errors));report.status='passed';console.log('JOURNEY BROWSER PASS',mode);
}catch(error){
  report.status='failed';report.failure=error.stack||String(error);process.exitCode=1;
  if(c){try{await screen('failure');report.failureState=await c.evaluate('({state:WINDWAKE.state(),ui:WINDWAKE.ui(),metrics:WINDWAKE.metrics()})');}catch{}report.errors=c.events.filter(e=>e.method==='Runtime.exceptionThrown'||e.method==='Runtime.consoleAPICalled'&&e.params.type==='error'||e.method==='Log.entryAdded'&&e.params.entry.level==='error');}
  console.error('JOURNEY BROWSER FAIL',mode,report.failure);
}finally{
  c?.close();
  try{if(profile)execFileSync('scripts/cdp-chrome.sh',['stop',profile],{cwd:root,env,stdio:'pipe'});}
  catch(error){report.cleanupFailure=error.stack||String(error);report.status='failed';process.exitCode=1;console.error('OWNED CHROME CLEANUP FAILED',report.cleanupFailure);}
  report.finishedAt=new Date().toISOString();await writeFile(resolve(output,`${mode}-report.json`),JSON.stringify(report,null,2));
  await writeFile(resolve(output,`${mode}-errors.json`),JSON.stringify(report.errors,null,2));
}
