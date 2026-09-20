// Trusted input and UI checks in an owned Chrome profile; serve windwake locally.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {connect} from './cdp.mjs';
const root=new URL('../../',import.meta.url).pathname;
const output=new URL('../../docs/specs/2026-09-20-windwake-journeys/verifications/',import.meta.url).pathname;
const env={...process.env,CLAUDE_SCRATCHPAD:'/private/tmp/windwake-journey-ui-qa'};let c;
await mkdir(output,{recursive:true});await mkdir(env.CLAUDE_SCRATCHPAD,{recursive:true});
try{
  const port=Number(execFileSync('scripts/cdp-chrome.sh',['start','windwake-journey-ui','--gl'],{cwd:root,env,encoding:'utf8'}).trim().split('\n').at(-1));
  c=await connect(port);await c.send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});await c.send('Emulation.setFocusEmulationEnabled',{enabled:true});
  await c.send('Page.navigate',{url:'http://127.0.0.1:8787/'});
  for(let i=0;i<100;i++){await c.sleep(100);if(await c.evaluate('!!window.WINDWAKE'))break;}
  assert.equal(await c.evaluate('!!window.WINDWAKE&&document.getElementById("fatal").hidden'),true);await c.clickId('start-button');
  const z=await c.evaluate('WINDWAKE.state().player.z');await c.key('KeyW');await c.sleep(750);await c.tap('Space');await c.sleep(100);await c.key('KeyW','keyUp');
  const jumped=await c.evaluate('({player:WINDWAKE.state().player,metrics:WINDWAKE.state().metrics})');assert.ok(jumped.player.z>z+2&&jumped.metrics.jumps>0&&!jumped.player.grounded);await c.screenshot(output+'r2-trusted-jump.png');await c.sleep(1000);
  await c.evaluate(`(async()=>{window.routes=await import('./tests/town-routes.mjs');window.field=await import('./tests/frontier-routes.mjs');window.w=await import('./world.mjs');window.driver={state:()=>WINDWAKE.state(),step:(n,i)=>WINDWAKE.step(n,i,{render:false}),town:(a,p)=>WINDWAKE.town(a,p),learn:id=>WINDWAKE.learn(id),equip:(id,slot)=>WINDWAKE.equip(id,slot)};WINDWAKE.reset();routes.approachTown(driver,'sunfields');WINDWAKE.setManual(false)})()`);
  await c.tap('KeyE');assert.equal((await c.evaluate('WINDWAKE.ui()')).panel,'town');
  async function clickSelector(selector){const p=await c.evaluate(`(()=>{const b=document.querySelector(${JSON.stringify(selector)});if(!b)throw new Error('Missing button');b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,disabled:b.disabled}})()`);assert.equal(p.disabled,false);await c.click(p.x,p.y);}
  await clickSelector('[data-quest="quest-sunfields-local"] [data-action="accept"]');assert.equal(await c.evaluate('WINDWAKE.state().journey.quests["quest-sunfields-local"]'),1);await c.screenshot(output+'r2-town-quest.png');await c.clickId('close-panel');
  await c.evaluate(`(()=>{WINDWAKE.setManual(true);const t=w.TOWNS[0],b=w.BIOMES.find(b=>b.id===t.biomeId),wp=w.WAYPOINTS.find(p=>p.id===t.waypointId),resource=w.LANDMARKS.find(l=>l.id==='resource-sunfields');for(const p of [t,wp,b,resource])field.frontierWalk(driver,p,{combat:false});field.frontierPress(driver,'interact');for(const p of [b,wp,t,t.npcs.find(n=>n.role==='guide')])field.frontierWalk(driver,p,{combat:false});WINDWAKE.setManual(false)})()`);
  await c.tap('KeyE');await clickSelector('[data-quest="quest-sunfields-local"] [data-action="claim"]');assert.equal(await c.evaluate('WINDWAKE.state().journey.quests["quest-sunfields-local"]'),2);
  await clickSelector('[data-quest="quest-sunfields-regional"] [data-action="accept"]');await c.screenshot(output+'r2-town-reward.png');await c.clickId('close-panel');
  await c.evaluate(`(()=>{WINDWAKE.setManual(true);field.frontierWalk(driver,w.TOWNS[0],{combat:false});field.frontierWalk(driver,w.DUNGEON_ENTRANCES.find(d=>d.id==='dungeon-sunfields'),{combat:false});WINDWAKE.setManual(false)})()`);await c.tap('KeyE');
  assert.equal(await c.evaluate('WINDWAKE.state().expedition.active.id'),'dungeon-sunfields');await c.sleep(500);await c.screenshot(output+'r2-dungeon-entry.png');
  await c.key('KeyW');await c.sleep(2200);await c.key('KeyW','keyUp');await c.tap('Space');await c.sleep(150);assert.ok(await c.evaluate('WINDWAKE.state().player.z>0&&WINDWAKE.state().player.y>0'));await c.sleep(700);
  await c.clickId('map-button');await c.screenshot(output+'r2-dungeon-map.png');assert.equal(await c.evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await c.clickId('close-panel');
  await c.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await c.send('Emulation.setTouchEmulationEnabled',{enabled:true});await c.sleep(200);
  await c.clickId('relics-button');await c.screenshot(output+'r2-mobile-relics.png');assert.equal(await c.evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await c.clickId('close-panel');
  await c.clickId('map-button');await c.screenshot(output+'r2-mobile-dungeon-map.png');assert.equal(await c.evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await c.clickId('close-panel');
  await c.send('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:1,mobile:true});await c.sleep(200);await c.clickId('relics-button');await c.screenshot(output+'r2-mobile-landscape-relics.png');assert.equal(await c.evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await c.clickId('close-panel');
  await c.clickId('pause-button');const before=await c.evaluate('WINDWAKE.save()');await c.send('Page.reload',{ignoreCache:true});for(let i=0;i<100;i++){await c.sleep(100);if(await c.evaluate('!!window.WINDWAKE'))break;}await c.clickId('continue-button');
  const reloaded=await c.evaluate('WINDWAKE.state()');assert.equal(reloaded.journey.quests['quest-sunfields-local'],2);assert.equal(reloaded.journey.quests['quest-sunfields-regional'],1);assert.equal(reloaded.expedition.active.id,'dungeon-sunfields');
  const errors=c.events.filter(e=>e.method==='Runtime.exceptionThrown'||e.method==='Runtime.consoleAPICalled'&&e.params.type==='error'||e.method==='Log.entryAdded'&&e.params.entry.level==='error');assert.equal(errors.length,0,JSON.stringify(errors));
  await writeFile(output+'ui-report.json',JSON.stringify({trustedInput:true,jumped,questStates:reloaded.journey.quests,scene:reloaded.expedition.active.id,saveVersion:before.version,mobile:[[390,844],[844,390]],errors},null,2));console.log('JOURNEY UI BROWSER PASS: trusted movement, jump, NPC accept/report, dungeon entry, local map, mobile panels, reload; errors0');
}finally{c?.close();execFileSync('scripts/cdp-chrome.sh',['stop','windwake-journey-ui'],{cwd:root,env,stdio:'pipe'});}
