import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {connect} from './cdp.mjs';
const root=new URL('../../',import.meta.url).pathname;
const output=new URL('../../docs/specs/2026-09-19-windwake-frontiers/verifications/',import.meta.url).pathname;
const env={...process.env,CLAUDE_SCRATCHPAD:'/private/tmp/windwake-frontier-qa'};
await mkdir(output,{recursive:true});await mkdir(env.CLAUDE_SCRATCHPAD,{recursive:true});
const mode=process.argv[2]||'smoke',url=process.argv[3]||'http://127.0.0.1:8787/';let c;
try{
  const port=Number(execFileSync('scripts/cdp-chrome.sh',['start','windwake-frontier','--gl'],{cwd:root,env,encoding:'utf8'}).trim().split('\n').at(-1));
  c=await connect(port);await c.send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});await c.send('Emulation.setFocusEmulationEnabled',{enabled:true});await c.send('Page.navigate',{url});
  for(let i=0;i<100;i++){await c.sleep(100);if(await c.evaluate('!!window.WINDWAKE'))break;}
  assert.equal(await c.evaluate('!!window.WINDWAKE && document.getElementById("fatal").hidden'),true,'world loads');
  await c.screenshot(output+mode+'-title.png');await c.clickId('start-button');await c.sleep(200);
  if(mode==='smoke'){
    const before=await c.evaluate('WINDWAKE.state().player.z');await c.key('KeyW');await c.sleep(800);await c.tap('Space');await c.sleep(150);await c.key('KeyW','keyUp');
    const jumped=await c.evaluate('({p:WINDWAKE.state().player,m:WINDWAKE.state().metrics})');assert.ok(jumped.p.z>before+2&&jumped.m.jumps>0&&!jumped.p.grounded);await c.screenshot(output+'frontier-jump.png');await c.sleep(900);
    await c.clickId('skills-button');assert.equal((await c.evaluate('WINDWAKE.ui()')).panel,'skills');
    async function skillClick(id){const r=await c.evaluate(`(()=>{const b=document.querySelector('[data-skill="${id}"] button');const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,disabled:b.disabled}})()`);assert.equal(r.disabled,false);await c.click(r.x,r.y);}
    await skillClick('edge');await skillClick('sunbolt');assert.deepEqual(await c.evaluate('WINDWAKE.state().adventure.learned'),['edge','sunbolt']);await c.screenshot(output+'frontier-skilltree.png');await c.clickId('close-panel');
    await c.key('Digit1');await c.sleep(80);await c.key('Digit1','keyUp');assert.ok(await c.evaluate('WINDWAKE.state().player.abilityCooldowns.sunbolt>0'));
    await c.clickId('map-button');await c.screenshot(output+'frontier-atlas.png');
    const home=await c.evaluate(`(()=>{const b=[...document.querySelectorAll('#journal button')].find(b=>b.textContent.startsWith('⌂'));const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);await c.click(home.x,home.y);assert.ok(await c.evaluate('Math.hypot(WINDWAKE.state().player.x+34,WINDWAKE.state().player.z+86)<4'));
    await c.clickId('village-button');assert.equal((await c.evaluate('WINDWAKE.ui()')).panel,'village');await c.screenshot(output+'frontier-village-panel.png');
    const cell=await c.evaluate(`(()=>{const b=document.querySelector('.village-grid button[data-x="-26"][data-z="-86"]');const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,disabled:b.disabled}})()`);assert.equal(cell.disabled,false);await c.click(cell.x,cell.y);assert.equal(await c.evaluate('WINDWAKE.state().village.plots.length'),0,'preview spends nothing');await c.clickId('confirm-build');assert.equal(await c.evaluate('WINDWAKE.state().village.plots.length'),1);await c.screenshot(output+'frontier-first-plot.png');await c.clickId('close-panel');
    await c.key('KeyD');await c.sleep(1000);await c.key('KeyD','keyUp');await c.tap('KeyE');await c.sleep(80);await c.tap('KeyE');
    const planted=await c.evaluate('WINDWAKE.state().village.plots[0]');assert.equal(planted.crop,'turnip');assert.equal(planted.watered,true);await c.screenshot(output+'frontier-planted.png');
    await c.evaluate('WINDWAKE.setManual(true);WINDWAKE.step(2800,{}, {render:false});WINDWAKE.render();WINDWAKE.setManual(false)');await c.tap('KeyE');assert.ok(await c.evaluate('WINDWAKE.state().village.tasks.includes("harvest")'));
    await c.clickId('village-button');await c.screenshot(output+'frontier-harvest.png');await c.clickId('close-panel');
    await c.evaluate('WINDWAKE.resetMetrics()');await c.sleep(4000);
    const performance=await c.evaluate('WINDWAKE.metrics()');console.log('PERFORMANCE',performance);
    await c.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await c.send('Emulation.setTouchEmulationEnabled',{enabled:true});await c.sleep(300);await c.screenshot(output+'frontier-mobile.png');await c.clickId('skills-button');await c.screenshot(output+'frontier-mobile-skills.png');
    assert.equal(await c.evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true,'no horizontal page overflow');
    await writeFile(output+'smoke-report.json',JSON.stringify({jumped,planted,performance,ui:await c.evaluate('WINDWAKE.ui()')},null,2));
  }
  if(mode==='stress'){
    await c.evaluate('(async()=>{window.frontierWorld=await import("./world.mjs");WINDWAKE.setManual(true)})()');
    const sites=await c.evaluate('frontierWorld.WAYPOINTS.map(w=>({id:w.id,x:w.x,z:w.z}))'),samples=[];
    for(let circuit=0;circuit<3;circuit++)for(const site of sites){
      await c.evaluate(`WINDWAKE.teleport(${site.x},null,${site.z});WINDWAKE.setCamera({yaw:${circuit*.7},pitch:.3,distance:12})`);await c.sleep(280);
      await c.clickId('map-button');await c.sleep(80);await c.clickId('close-panel');
      const metrics=await c.evaluate('WINDWAKE.metrics()');samples.push({circuit,site:site.id,...metrics});
      assert.ok(metrics.renderer.residentChunks<=64);assert.ok(metrics.world.cachedChunks<=96);assert.ok(metrics.renderer.residentBytes<32*1024*1024);assert.ok(metrics.actors<=64);
      if(circuit===0)await c.screenshot(output+`biome-${site.id}.png`);
    }
    assert.ok(samples.at(-1).renderer.disposedChunks>100,'old GPU buffers actually disposed');
    await c.evaluate('WINDWAKE.reset();WINDWAKE.travel("home");WINDWAKE.setManual(false);WINDWAKE.resetMetrics()');await c.sleep(5000);
    const homePerformance=await c.evaluate('WINDWAKE.metrics()');
    await c.evaluate('WINDWAKE.setManual(true);var night=WINDWAKE.snapshot();night.village.clock=500;WINDWAKE.restore(night);WINDWAKE.setCamera({yaw:0,pitch:.3,distance:12})');await c.screenshot(output+'village-night-fixture.png');
    await writeFile(output+'stress-report.json',JSON.stringify({fixture:true,circuits:3,samples,homePerformance},null,2));console.log('STRESS',JSON.stringify({samples:samples.length,last:samples.at(-1),homePerformance}));
  }
  if(mode==='journeys'){
    await c.evaluate('(async()=>{window.routes=await import("./tests/frontier-routes.mjs");window.worldData=await import("./world.mjs");window.routeCheckpoints=[];window.driver={state:()=>WINDWAKE.state(),step:(n,i)=>WINDWAKE.step(n,i,{render:false}),village:(a,p)=>WINDWAKE.village(a,p),learn:id=>WINDWAKE.learn(id),equip:(id,slot)=>WINDWAKE.equip(id,slot),travel:id=>WINDWAKE.travel(id),onCheckpoint:r=>routeCheckpoints.push(r)}})()');
    const records=[];
    for(const id of await c.evaluate('worldData.TRAIL_ROUTES.map(r=>r.id)')){
      const result=await c.evaluate(`WINDWAKE.reset();routes.runFrontierTrail(driver,${JSON.stringify(id)})`);records.push(result);console.log('CHROME TRAIL',id,result.distance);await c.evaluate('WINDWAKE.render()');await c.sleep(300);await c.screenshot(output+`natural-${id}.png`);
    }
    records.push(await c.evaluate('WINDWAKE.reset();routes.runFrontierFarm(driver)'));await c.evaluate('WINDWAKE.render()');await c.sleep(300);await c.screenshot(output+'natural-farm.png');
    for(const id of await c.evaluate('worldData.BOSS_SITES.filter(b=>!b.final).map(b=>b.id)')){
      const result=await c.evaluate(`WINDWAKE.reset();routes.runFrontierBoss(driver,${JSON.stringify(id)})`);records.push(result);console.log('CHROME BOSS',id,result.hp);await c.evaluate('WINDWAKE.render()');await c.sleep(250);await c.screenshot(output+`natural-${id}.png`);
    }
    await writeFile(output+'natural-journeys-report.json',JSON.stringify({records,checkpoints:await c.evaluate('routeCheckpoints')},null,2));
  }
  if(mode==='adventure'){
    await c.evaluate('(async()=>{window.routes=await import("./tests/frontier-routes.mjs");window.routeCheckpoints=[];window.visualCheckpoints={};window.driver={state:()=>WINDWAKE.state(),step:(n,i)=>WINDWAKE.step(n,i,{render:false}),village:(a,p)=>WINDWAKE.village(a,p),learn:id=>WINDWAKE.learn(id),equip:(id,slot)=>WINDWAKE.equip(id,slot),travel:id=>WINDWAKE.travel(id),onCheckpoint:r=>{routeCheckpoints.push(r);if(["village-defenses-prepared","natural-first-dusk-warning","natural-two-wave-defense-complete","natural-village-level-three","natural-frontier-adventure-complete"].includes(r.stage))visualCheckpoints[r.stage]=WINDWAKE.snapshot()}}})()');
    const result=await c.evaluate('WINDWAKE.reset();routes.runFrontierAdventure(driver)');assert.equal(result.finalDefeated,true);assert.equal(result.raid,'won');assert.equal(result.villageLevel,3);
    const saved=await c.evaluate('WINDWAKE.save()');
    await c.evaluate('WINDWAKE.setManual(false)');assert.equal((await c.evaluate('WINDWAKE.ui()')).panel,'won');await c.sleep(300);await c.screenshot(output+'natural-frontier-ending.png');await c.clickId('return-game');
    assert.equal(await c.evaluate('WINDWAKE.state().mode'),'playing');
    // Saved snapshots below only replay visuals AFTER the one-state natural run passed.
    for(const stage of await c.evaluate('Object.keys(visualCheckpoints)')){await c.evaluate(`WINDWAKE.restore(visualCheckpoints[${JSON.stringify(stage)}]);WINDWAKE.setCamera({yaw:.6,pitch:.3,distance:14})`);await c.sleep(300);await c.screenshot(output+stage+'-visual-replay.png');}
    await c.evaluate(`WINDWAKE.load(${JSON.stringify(saved)});WINDWAKE.setManual(false)`);await c.tap('Escape');await c.send('Page.reload',{ignoreCache:true});
    for(let i=0;i<100;i++){await c.sleep(100);if(await c.evaluate('!!window.WINDWAKE'))break;}await c.clickId('continue-button');
    const reloaded=await c.evaluate('WINDWAKE.state()');assert.equal(reloaded.adventure.finalDefeated,true);assert.equal(reloaded.village.level,3);assert.equal(reloaded.village.raid.rewarded,true);assert.equal(reloaded.mode,'playing');
    await writeFile(output+'continuous-adventure-report.json',JSON.stringify({result,savedProgress:{adventure:saved.adventure,village:saved.village},reloaded:{finalDefeated:reloaded.adventure.finalDefeated,villageLevel:reloaded.village.level,raid:reloaded.village.raid.status,mode:reloaded.mode}},null,2));console.log('CHROME CONTINUOUS ADVENTURE',result);
  }
  const errors=c.events.filter(e=>e.method==='Runtime.exceptionThrown'||e.method==='Runtime.consoleAPICalled'&&e.params.type==='error'||e.method==='Log.entryAdded'&&e.params.entry.level==='error');
  await writeFile(output+mode+'-errors.json',JSON.stringify(errors,null,2));assert.equal(errors.length,0,JSON.stringify(errors));console.log('FRONTIER BROWSER PASS',mode);
}finally{c?.close();execFileSync('scripts/cdp-chrome.sh',['stop','windwake-frontier'],{cwd:root,env,stdio:'pipe'});}
