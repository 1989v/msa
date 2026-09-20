import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {connect} from './cdp.mjs';
const root=new URL('../../',import.meta.url).pathname;
const url=process.argv[2]||'http://127.0.0.1:8787/';
const output=resolve(process.argv[3]||'docs/specs/2026-09-20-windwake-basic-attacks/verifications/local');
const env={...process.env,CLAUDE_SCRATCHPAD:`/private/tmp/windwake-basic-${process.pid}`};let c,profile;
await mkdir(output,{recursive:true});await mkdir(env.CLAUDE_SCRATCHPAD,{recursive:true});
try{
  for(let candidate=0;candidate<100;candidate++){
    const name=`windwake-basic-${process.pid}-${candidate}`,port=Number(execFileSync('scripts/cdp-chrome.sh',['port',name],{cwd:root,env,encoding:'utf8'}).trim());
    let occupied=false;try{await fetch(`http://127.0.0.1:${port}/json/version`,{signal:AbortSignal.timeout(300)});occupied=true;}catch{}
    if(!occupied){profile=name;break;}
  }
  assert.ok(profile,'No unused Chrome test port');
  const port=Number(execFileSync('scripts/cdp-chrome.sh',['start',profile,'--gl'],{cwd:root,env,encoding:'utf8'}).trim().split('\n').at(-1));
  c=await connect(port);await c.send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});await c.send('Emulation.setFocusEmulationEnabled',{enabled:true});await c.send('Page.navigate',{url});
  for(let i=0;i<100;i++){await c.sleep(100);if(await c.evaluate('!!window.WINDWAKE'))break;}
  assert.equal(await c.evaluate('!!window.WINDWAKE&&document.getElementById("fatal").hidden'),true);await c.clickId('start-button');await c.sleep(1100);
  // Deliberate fixtures isolate interruption; full natural adventures are separate.
  await c.evaluate(`window.basicFixture=(combo=0)=>{
    WINDWAKE.reset();let s=WINDWAKE.snapshot();s.enemies=[];WINDWAKE.restore(s);
    const p=s.player,spawn=WINDWAKE.spawnEnemy('stalker',p.x,p.z+2,p.y);s=WINDWAKE.snapshot();
    Object.assign(s.enemies[0],{state:'telegraph',timer:1.2,pattern:'slam',yaw:Math.PI,hp:300,maxHp:300});
    if(combo)Object.assign(s.player,{combo,attackTimer:.3,attackElapsed:[0,.10,.12,.18][combo],attackHit:false,comboWindow:.8});
    WINDWAKE.restore(s);return spawn.id;
  }`);
  const comboImpacts=[];
  for(const combo of [1,2,3]){
    const result=await c.evaluate(`basicFixture(${combo});WINDWAKE.step(1,{});({enemy:WINDWAKE.state().enemies[0],ui:WINDWAKE.ui(),events:WINDWAKE.events()})`);
    assert.equal(result.enemy.state,'telegraph');assert.equal(result.enemy.hp,300-[0,16,21,38][combo]);assert.equal(result.enemy.vx,0);assert.equal(result.enemy.vz,0);assert.equal(result.ui.hitStop,0);assert.equal(result.events.find(e=>e.type==='hit').hitStop,false);comboImpacts.push(result);
  }
  const pulsePause=await c.evaluate('basicFixture();WINDWAKE.step(1,{skill:true});({enemy:WINDWAKE.state().enemies[0],ui:WINDWAKE.ui()})');
  assert.equal(pulsePause.enemy.state,'hit');assert.equal(pulsePause.ui.hitStop,.035);
  await c.evaluate('basicFixture();WINDWAKE.setCamera({yaw:.15,pitch:.32,distance:7});WINDWAKE.setManual(false)');
  await c.tap('KeyJ');
  for(let i=0;i<20;i++){if(await c.evaluate('WINDWAKE.state().metrics.hits>0'))break;await c.sleep(25);}
  const hit=await c.evaluate('({enemy:WINDWAKE.state().enemies[0],player:WINDWAKE.state().player,ui:WINDWAKE.ui()})');
  assert.equal(hit.enemy.hp,284);assert.equal(hit.enemy.state,'telegraph');assert.equal(hit.ui.hitStop,0);await c.screenshot(resolve(output,'basic-hit-enemy-continues.png'));
  await c.sleep(1300);const retaliated=await c.evaluate('({enemy:WINDWAKE.state().enemies[0],player:WINDWAKE.state().player})');assert.ok(retaliated.player.hp<hit.player.hp,'Real keyboard basic hit cannot cancel the incoming counterattack');
  await c.tap('KeyQ');await c.sleep(110);const skill=await c.evaluate('({enemy:WINDWAKE.state().enemies[0],player:WINDWAKE.state().player})');assert.equal(skill.enemy.state,'hit');assert.ok(skill.enemy.timer>.5);await c.screenshot(resolve(output,'skill-staggers.png'));
  const errors=c.events.filter(e=>e.method==='Runtime.exceptionThrown'||e.method==='Runtime.consoleAPICalled'&&e.params.type==='error'||e.method==='Log.entryAdded'&&e.params.entry.level==='error');assert.equal(errors.length,0,JSON.stringify(errors));
  await writeFile(resolve(output,'report.json'),JSON.stringify({url,controlledFixtures:true,comboImpacts,pulsePause,hit,retaliated,skill,errors},null,2));console.log('BASIC ATTACK CHROME PASS: combos keep AI/velocity, no basic hit-stop, trusted J enemy retaliates, Q staggers; errors0');
}finally{c?.close();if(profile)execFileSync('scripts/cdp-chrome.sh',['stop',profile],{cwd:root,env,stdio:'pipe'});}
