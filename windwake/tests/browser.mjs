import {execFileSync} from 'node:child_process';
import {writeFile,mkdir} from 'node:fs/promises';
import {connect} from './cdp.mjs';
import assert from 'node:assert/strict';
const env={...process.env,CLAUDE_SCRATCHPAD:'/private/tmp/windwake-qa'};
const root=new URL('../../',import.meta.url).pathname;
const output=new URL('../../docs/specs/2026-09-18-windwake/verifications/',import.meta.url).pathname;
await mkdir(output,{recursive:true});
let cdp;
try{
  const port=Number(execFileSync('scripts/cdp-chrome.sh',['start','windwake','--gl'],{cwd:root,env,encoding:'utf8'}).trim().split('\n').at(-1));
  cdp=await connect(port);
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
  await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:true});
  await cdp.send('Page.navigate',{url:'http://127.0.0.1:8787/'});
  for(let i=0;i<80;i++){await cdp.sleep(100);if(await cdp.evaluate('!!window.WINDWAKE'))break;}
  console.log('READY',await cdp.evaluate('({ui:WINDWAKE.ui(),metrics:WINDWAKE.metrics(),fatal:!document.getElementById("fatal").hidden})'));
  await cdp.screenshot(output+'title-r1.png');
  await cdp.clickId('start-button');await cdp.sleep(300);
  console.log('START',await cdp.evaluate('({frame:WINDWAKE.state().frame,ui:WINDWAKE.ui(),hidden:document.hidden,focus:document.hasFocus()})'));
  await cdp.evaluate('window.__rafCount=0;requestAnimationFrame(function f(){window.__rafCount++;requestAnimationFrame(f)})');
  await cdp.key('KeyW');await cdp.sleep(900);await cdp.tap('Space');await cdp.sleep(250);
  console.log('JUMP',await cdp.evaluate('({frame:WINDWAKE.state().frame,ui:WINDWAKE.ui(),input:WINDWAKE.input(),hidden:document.hidden,raf:window.__rafCount,p:WINDWAKE.state().player,metrics:WINDWAKE.metrics()})'));
  await cdp.screenshot(output+'jump-r1.png');
  await cdp.key('KeyW','keyUp');await cdp.sleep(700);
  await cdp.screenshot(output+'play-r1.png');
  console.log('ERRORS',cdp.events.filter(e=>e.method==='Runtime.exceptionThrown'||e.method==='Runtime.consoleAPICalled'||e.method==='Log.entryAdded'&&e.params.entry.level==='error'));
  console.log('END',await cdp.evaluate('({p:WINDWAKE.state().player,metrics:WINDWAKE.metrics()})'));
  if(process.argv.includes('input')){
    await cdp.key('KeyW');await cdp.sleep(2600);await cdp.key('KeyW','keyUp');
    await cdp.tap('KeyJ');await cdp.sleep(120);await cdp.tap('KeyJ');await cdp.sleep(280);await cdp.tap('KeyJ');await cdp.sleep(650);
    await cdp.tap('KeyQ');await cdp.sleep(200);await cdp.tap('KeyK');await cdp.sleep(350);await cdp.tap('KeyF');
    await cdp.screenshot(output+'combat-r2.png');
    const combat=await cdp.evaluate('({frame:WINDWAKE.state().frame,metrics:WINDWAKE.state().metrics,events:WINDWAKE.events().map(e=>e.type),hp:WINDWAKE.state().player.hp})');
    assert.ok(combat.metrics.hits>0,'actual inputs hit an enemy');assert.ok(combat.metrics.dodges>0,'actual dodge');assert.ok(combat.metrics.combos>0,'actual third combo strike');assert.ok(combat.events.includes('pulse'),'actual pulse');console.log('TRUSTED_COMBAT',combat);
    const c0=await cdp.evaluate('WINDWAKE.camera()');
    await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x:650,y:450,button:'right',clickCount:1});
    await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:800,y:470,button:'right',buttons:2});
    await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:800,y:470,button:'right',clickCount:1});
    const c1=await cdp.evaluate('WINDWAKE.camera()');assert.ok(Math.abs(c1.yaw-c0.yaw)>.5,'mouse camera orbit');
    await cdp.tap('KeyM');const paused=await cdp.evaluate('({ui:WINDWAKE.ui(),frame:WINDWAKE.state().frame})');await cdp.sleep(200);assert.equal(await cdp.evaluate('WINDWAKE.state().frame'),paused.frame);assert.equal(paused.ui.panel,'map');await cdp.screenshot(output+'atlas-r2.png');await cdp.tap('Escape');
    await cdp.key('KeyW');await cdp.sleep(100);await cdp.tap('Escape');assert.equal((await cdp.evaluate('WINDWAKE.input()')).keys.length,0);await cdp.key('KeyW','keyUp');await cdp.tap('Escape');await cdp.sleep(300);
    console.log('PAUSE_CLEAR',await cdp.evaluate('({ui:WINDWAKE.ui(),input:WINDWAKE.input(),p:WINDWAKE.state().player})'));
    await cdp.key('KeyW');await cdp.sleep(100);
    await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:false});
    const backgroundTab=await cdp.send('Target.createTarget',{url:'about:blank',background:false});
    await cdp.sleep(300);
    const backgroundState=await cdp.evaluate('({hidden:document.hidden,focused:document.hasFocus(),ui:WINDWAKE.ui(),input:WINDWAKE.input(),frame:WINDWAKE.state().frame})');
    await cdp.sleep(150);assert.equal(await cdp.evaluate('WINDWAKE.state().frame'),backgroundState.frame,'background pauses simulation');assert.equal(backgroundState.ui.panel,'pause');assert.equal(backgroundState.input.keys.length,0);
    await cdp.send('Target.closeTarget',{targetId:backgroundTab.targetId});await cdp.send('Page.bringToFront');await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:true});await cdp.key('KeyW','keyUp');await cdp.tap('Escape');console.log('BACKGROUND_PASS',backgroundState);
    await cdp.evaluate('WINDWAKE.reset();WINDWAKE.setManual(false)');
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:1,mobile:true});await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});await cdp.sleep(100);
    assert.equal(await cdp.evaluate('matchMedia("(pointer: coarse)").matches'),true);
    const r=await cdp.evaluate('(()=>{const r=document.getElementById("joystick").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');
    const z0=await cdp.evaluate('WINDWAKE.state().player.z');
    const point={id:1,x:r.x,y:r.y,radiusX:8,radiusY:8,force:1};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});point.y-=32;await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point]});await cdp.sleep(650);
    const z1=await cdp.evaluate('WINDWAKE.state().player.z');assert.ok(z1-z0>1,'trusted joystick moves player');
    const jumpPoint=await cdp.evaluate('(()=>{const r=document.querySelector("[data-action=jump]").getBoundingClientRect();return {id:2,x:r.x+r.width/2,y:r.y+r.height/2,radiusX:8,radiusY:8,force:1}})()');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point,jumpPoint]});await cdp.sleep(150);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[point]});await cdp.sleep(50);
    assert.ok((await cdp.evaluate('WINDWAKE.state().metrics')).jumps>0,'trusted touch jump');await cdp.screenshot(output+'touch-r2.png');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.deepEqual((await cdp.evaluate('WINDWAKE.input()')).axes,{x:0,z:0});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:3,x:600,y:170}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point,id:3,x:680,y:185}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.ok((await cdp.evaluate('WINDWAKE.camera()')).yaw>.4);
    const attackPoint=await cdp.evaluate('(()=>{const r=document.querySelector("[data-action=attack]").getBoundingClientRect();return {id:4,x:r.x+r.width/2,y:r.y+r.height/2,radiusX:8,radiusY:8,force:1}})()');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[attackPoint]});await cdp.sleep(80);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.ok((await cdp.evaluate('WINDWAKE.state().player')).combo>0);
    console.log('TOUCH_PASS',await cdp.evaluate('({ui:WINDWAKE.ui(),input:WINDWAKE.input(),metrics:WINDWAKE.state().metrics,camera:WINDWAKE.camera()})'));
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await cdp.sleep(150);await cdp.screenshot(output+'portrait-r2.png');
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:false});await cdp.sleep(500);await cdp.evaluate('WINDWAKE.resetMetrics()');await cdp.sleep(6000);
    console.log('PERFORMANCE',await cdp.evaluate('WINDWAKE.metrics()'));
    assert.equal(cdp.events.filter(e=>e.method==='Runtime.exceptionThrown').length,0,'no uncaught browser errors');
    const runtimeErrors=cdp.events.filter(e=>e.method==='Runtime.exceptionThrown'||e.method==='Runtime.consoleAPICalled'&&e.params.type==='error'||e.method==='Log.entryAdded'&&e.params.entry.level==='error');assert.equal(runtimeErrors.length,0);
    const requests=cdp.events.filter(e=>e.method==='Network.requestWillBeSent').map(e=>e.params.request.url);assert.ok(requests.every(url=>url.startsWith('http://127.0.0.1:8787/')||url.startsWith('data:')),'no external assets');
    await writeFile(output+'input-report.json',JSON.stringify({combat,cameraBefore:c0,cameraAfter:c1,paused,backgroundState,touchMovement:z1-z0,performance:await cdp.evaluate('WINDWAKE.metrics()'),errors:runtimeErrors,requests:[...new Set(requests)]},null,2));
    console.log('BROWSER INPUT PASS');
  }
  if(process.argv.includes('routes')){
    await cdp.evaluate('(async()=>{window.routes=await import("/tests/routes.mjs");window.routeCheckpoints=[];window.driver={state:()=>WINDWAKE.state(),step:(n,i)=>WINDWAKE.step(n,i,{render:false}),onCheckpoint:c=>routeCheckpoints.push(c)}})()');
    const first=[];
    for(const shrine of ['quarry','forest','ruins']){
      const result=await cdp.evaluate(`WINDWAKE.reset();routes.runFirstShrine(driver,${JSON.stringify(shrine)});WINDWAKE.render();routes.checkpoint(driver,'browser-first-${shrine}')`);
      first.push(result);console.log('FIRST_SHRINE',result);await cdp.sleep(500);await cdp.screenshot(output+`first-${shrine}-r3.png`);
    }
    await cdp.evaluate('WINDWAKE.reset();window.routeCheckpoints=[];routes.runFirstShrine(driver,"quarry");WINDWAKE.render()');
    await cdp.sleep(500);await cdp.screenshot(output+'journey-quarry-r3.png');
    await cdp.evaluate('routes.waypoints(driver,[[-51,-6],[-51,9],[-30,16],[-25,24]]);routes.fight(driver,{radius:12});routes.press(driver,"interact");routes.waypoints(driver,[[-29,38],[-44,43]]);routes.fight(driver,{radius:13});routes.solveForest(driver);WINDWAKE.render()');
    await cdp.sleep(500);await cdp.screenshot(output+'journey-forest-r3.png');
    await cdp.evaluate('routes.waypoints(driver,[[-25,24],[-10,14],[17,1],[29,6]]);routes.fight(driver,{radius:12});routes.press(driver,"interact");routes.navigate(driver,30.8,7.8,{combat:false});routes.solveRuins(driver);WINDWAKE.render()');
    await cdp.sleep(500);await cdp.screenshot(output+'journey-ruins-r3.png');
    await cdp.evaluate('routes.ascendSummit(driver);WINDWAKE.render()');
    await cdp.sleep(500);await cdp.screenshot(output+'journey-summit-r3.png');
    const result=await cdp.evaluate('routes.defeatGuardian(driver);WINDWAKE.render();routes.checkpoint(driver,"browser-journey-complete")');
    assert.equal(result.mode,'won');assert.deepEqual(result.sigils,['quarry','forest','ruins']);
    await cdp.evaluate('WINDWAKE.setManual(false)');await cdp.screenshot(output+'ending-r3.png');assert.equal((await cdp.evaluate('WINDWAKE.ui()')).panel,'won');
    await cdp.clickId('return-game');assert.equal((await cdp.evaluate('WINDWAKE.state()')).mode,'playing');
    await cdp.tap('Escape');const before=await cdp.evaluate('WINDWAKE.save()');
    await cdp.send('Page.reload',{ignoreCache:true});for(let i=0;i<80;i++){await cdp.sleep(100);if(await cdp.evaluate('!!window.WINDWAKE'))break;}
    await cdp.clickId('continue-button');const restored=await cdp.evaluate('WINDWAKE.state()');assert.equal(restored.progress.bossDefeated,true);assert.deepEqual(restored.progress.sigils,before.progress.sigils);assert.equal(restored.mode,'playing');
    const exceptions=cdp.events.filter(e=>e.method==='Runtime.exceptionThrown');assert.equal(exceptions.length,0);
    await writeFile(output+'routes-report.json',JSON.stringify({first,journey:result,restored:{sigils:restored.progress.sigils,bossDefeated:restored.progress.bossDefeated,mode:restored.mode},errors:exceptions},null,2));
    console.log('BROWSER ROUTES PASS',result);
  }
  if(process.argv.includes('optional')){
    await cdp.evaluate('(async()=>{window.routes=await import("/tests/routes.mjs");window.routeCheckpoints=[];window.driver={state:()=>WINDWAKE.state(),step:(n,i)=>WINDWAKE.step(n,i,{render:false}),onCheckpoint:c=>routeCheckpoints.push(c)};WINDWAKE.reset()})()');
    const result=await cdp.evaluate('routes.runOptionalCaches(driver);WINDWAKE.render();({last:routes.checkpoint(driver,"browser-optional-complete"),chests:WINDWAKE.state().progress.chests,checkpoints:routeCheckpoints})');
    assert.equal(result.chests.length,3);assert.equal(result.last.falls,1);assert.equal(result.last.hp,85);
    await cdp.sleep(500);await cdp.screenshot(output+'lake-recovery-r4.png');
    await writeFile(output+'optional-report.json',JSON.stringify(result,null,2));console.log('BROWSER OPTIONAL PASS',result.last);
  }
}finally{
  cdp?.close();
  try{execFileSync('scripts/cdp-chrome.sh',['stop','windwake'],{cwd:root,env,stdio:'pipe'});}catch{}
}
