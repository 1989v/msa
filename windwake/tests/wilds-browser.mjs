import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {connect} from './cdp.mjs';

const root=new URL('../../',import.meta.url).pathname;
const url=process.argv[2]||'http://127.0.0.1:8789/';
const output=resolve(process.argv[3]||'docs/specs/2026-09-27-windwake-wilds/verifications/local');
const env={...process.env,CLAUDE_SCRATCHPAD:'/private/tmp/windwake-wilds-browser'};
let c,profile;const report={url,fixtures:'Combo/canopy capture uses explicit scene fixtures; terrain traversal starts at a known trail point, then uses ordinary movement. Full-world routes run separately.'};
await mkdir(output,{recursive:true});await mkdir(env.CLAUDE_SCRATCHPAD,{recursive:true});
try{
  for(let n=0;n<100;n++){
    const name=`wilds-${process.pid}-${n}`,port=Number(execFileSync('scripts/cdp-chrome.sh',['port',name],{cwd:root,env,encoding:'utf8'}).trim());
    let busy=false;try{await fetch(`http://127.0.0.1:${port}/json/version`,{signal:AbortSignal.timeout(200)});busy=true;}catch{}
    if(!busy){profile=name;break;}
  }
  assert.ok(profile);const port=Number(execFileSync('scripts/cdp-chrome.sh',['start',profile,'--gl'],{cwd:root,env,encoding:'utf8'}).trim().split('\n').at(-1));
  c=await connect(port);await c.send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});await c.send('Emulation.setFocusEmulationEnabled',{enabled:true});await c.send('Page.navigate',{url});
  for(let i=0;i<100;i++){await c.sleep(100);if(await c.evaluate('!!window.WINDWAKE'))break;}
  assert.ok(await c.evaluate('!!window.WINDWAKE&&document.getElementById("fatal").hidden'));
  report.environment=await c.evaluate(`(()=>{const gl=document.querySelector('canvas').getContext('webgl'),ext=gl.getExtension('WEBGL_debug_renderer_info');return {userAgent:navigator.userAgent,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};})()`);
  await c.clickId('start-button');await c.sleep(400);await c.key('KeyW');await c.sleep(650);await c.tap('Space');await c.sleep(100);await c.key('KeyW','keyUp');
  report.trustedMovement=await c.evaluate('({z:WINDWAKE.state().player.z,jumps:WINDWAKE.state().metrics.jumps,air:WINDWAKE.state().player.airState})');
  assert.ok(report.trustedMovement.z>-70&&report.trustedMovement.jumps>0);await c.screenshot(resolve(output,'trusted-jump.png'));
  await c.evaluate('WINDWAKE.reset();WINDWAKE.setManual(false)');await c.key('KeyJ');await c.sleep(2300);await c.key('KeyJ','keyUp');
  report.heldCombo=await c.evaluate('WINDWAKE.events().filter(e=>/^attack[123]$/.test(e.type)).map(e=>({type:e.type,frame:e.frame}))');
  assert.deepEqual(report.heldCombo.slice(0,3).map(e=>e.type),['attack1','attack2','attack3']);
  await c.sleep(1000);assert.ok(await c.evaluate('WINDWAKE.state().player.attackTimer<=0'));
  await c.evaluate(`(async()=>{window.qaWorld=await import(new URL('world.mjs',location.href));window.qaMelee=await import(new URL('melee.mjs',location.href));})()`);
  for(let combo=1;combo<=3;combo++){
    await c.evaluate(`WINDWAKE.reset();{let s=WINDWAKE.snapshot(),a=qaMelee.COMBO_STAGES[${combo-1}];Object.assign(s.player,{combo:${combo},attackElapsed:a.impact+.015,attackTimer:a.duration-a.impact,action:'attack',actionTime:a.duration-a.impact});WINDWAKE.restore(s);WINDWAKE.setCamera({yaw:-.7,pitch:.22,distance:5});}`);
    await c.screenshot(resolve(output,`combo-${combo}.png`));
  }
  // Actual shader output comparison with identical position/time/camera.
  report.foliage=await c.evaluate(`(()=>{
    WINDWAKE.reset();const tree=qaWorld.PROPS.find(p=>p.type==='pine')||qaWorld.PROPS.find(p=>p.type==='tree');
    if(!tree)throw Error('No authored tree');const s=WINDWAKE.snapshot();
    Object.assign(s.player,{x:tree.x+.9,z:tree.z+3,y:qaWorld.heightAt(tree.x+.9,tree.z+3),grounded:true});WINDWAKE.restore(s);
    WINDWAKE.setCamera({yaw:0,pitch:.48,distance:8,foliageFade:true});
    for(let i=0;i<60;i++)WINDWAKE.render();
    window.qaTree=tree;window.qaPixels=()=>{WINDWAKE.render();const source=document.querySelector('canvas'),canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;const ctx=canvas.getContext('2d');ctx.drawImage(source,0,0);return ctx.getImageData(0,0,canvas.width,canvas.height).data;};
    WINDWAKE.setCamera({foliageFade:false});const opaque=qaPixels();WINDWAKE.setCamera({foliageFade:true});const faded=qaPixels();
    let different=0;for(let i=0;i<opaque.length;i+=4)if(Math.abs(opaque[i]-faded[i])+Math.abs(opaque[i+1]-faded[i+1])+Math.abs(opaque[i+2]-faded[i+2])>20)different++;
    return {tree,changedPixels:different,metrics:WINDWAKE.metrics().renderer};
  })()`);
  assert.ok(report.foliage.changedPixels>100,'Intervening foliage changes actual framebuffer pixels');
  await c.evaluate('WINDWAKE.setCamera({foliageFade:false})');await c.screenshot(resolve(output,'canopy-opaque.png'));
  await c.evaluate('WINDWAKE.setCamera({foliageFade:true})');await c.screenshot(resolve(output,'canopy-visible.png'));
  const beforeOrbit=await c.evaluate('WINDWAKE.camera().yaw');
  await c.send('Input.dispatchMouseEvent',{type:'mousePressed',x:800,y:420,button:'right',buttons:2,clickCount:1});
  await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:990,y:440,button:'right',buttons:2});
  await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:990,y:440,button:'right',buttons:0,clickCount:1});
  report.trustedOrbit=await c.evaluate('WINDWAKE.camera().yaw');assert.ok(Math.abs(report.trustedOrbit-beforeOrbit)>.1);
  for(let i=0;i<24;i++)await c.evaluate(`WINDWAKE.setCamera({yaw:${i*Math.PI/12}});WINDWAKE.render()`);
  assert.ok(await c.evaluate('WINDWAKE.metrics().renderer.cameraEye.every(Number.isFinite)'));
  // Known clear 65m hillside, no enemy removals, grants, heals or coordinate
  // writes after the starting fixture. Movement remains the ordinary sim path.
  report.terrain=await c.evaluate(`(()=>{
    WINDWAKE.reset();WINDWAKE.teleport(-55,qaWorld.heightAt(-55,-585),-585);WINDWAKE.step(1,{});const start=WINDWAKE.state().player;
    let frames=0;while(WINDWAKE.state().player.x>-119.5&&frames++<1800)WINDWAKE.step(1,{moveX:-1,cameraYaw:0},{render:false});
    const top=WINDWAKE.state().player;WINDWAKE.setCamera({yaw:-1.2,pitch:.2,distance:12});WINDWAKE.render();window.qaTerrainTop=WINDWAKE.snapshot();
    if(top.hp<=0||top.y-start.y<15)throw Error('Hillside traversal failed '+JSON.stringify({start,top,frames}));
    while(WINDWAKE.state().player.x<-55.5&&frames++<3600)WINDWAKE.step(1,{moveX:1,cameraYaw:0},{render:false});
    const end=WINDWAKE.state().player;return {start,top,end,frames,metrics:WINDWAKE.state().metrics,actors:WINDWAKE.metrics().actors};
  })()`);
  assert.ok(report.terrain.top.y-report.terrain.start.y>=15);assert.ok(report.terrain.top.y-report.terrain.end.y>=15);assert.ok(report.terrain.end.hp>0);assert.equal(report.terrain.metrics.falls,0);
  await c.evaluate('WINDWAKE.restore(qaTerrainTop);WINDWAKE.setCamera({yaw:-1.3,pitch:.16,distance:13})');await c.screenshot(resolve(output,'terrain-ridge.png'));
  await c.evaluate('WINDWAKE.resetMetrics();WINDWAKE.setManual(false)');await c.sleep(2400);report.performance=await c.evaluate('WINDWAKE.metrics()');
  assert.ok(report.performance.actors<=64&&report.performance.renderer.residentChunks<=64&&report.performance.world.cachedChunks<=96);
  report.errors=c.events.filter(e=>e.method==='Runtime.exceptionThrown'||e.method==='Runtime.consoleAPICalled'&&e.params.type==='error'||e.method==='Log.entryAdded'&&e.params.entry.level==='error');
  assert.equal(report.errors.length,0,JSON.stringify(report.errors));report.status='passed';
  await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log('WILDS CHROME PASS',JSON.stringify({combo:report.heldCombo,foliagePixels:report.foliage.changedPixels,heightGain:report.terrain.top.y-report.terrain.start.y,fps:report.performance.fps,errors:report.errors.length}));
}catch(error){report.status='failed';report.failure=String(error);await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');throw error;}
finally{c?.close();if(profile)execFileSync('scripts/cdp-chrome.sh',['stop',profile],{cwd:root,env,stdio:'pipe'});}
