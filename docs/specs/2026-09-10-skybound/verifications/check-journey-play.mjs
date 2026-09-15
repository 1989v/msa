// Run against a project-owned CDP browser; never starts or stops a browser.
// node check-beta.mjs <CDP port> <viewer URL> [artifact label]
import { mkdir, writeFile } from 'node:fs/promises';

const [port, url, artifact = 'beta-play'] = process.argv.slice(2);
if (!/^[a-z0-9-]+$/.test(artifact)) throw new Error('Invalid artifact label');
if (!port || !url) throw new Error('Usage: node check-beta.mjs <CDP port> <viewer URL>');
const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = pages.find((entry) => entry.type === 'page');
if (!page) throw new Error('No page in isolated browser');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let sequence = 0;
const pending = new Map();
const errors = [];
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
    errors.push(message.params.args.map((arg) => arg.value || arg.description));
  }
  if (!message.id) return;
  const request = pending.get(message.id);
  if (!request) return;
  clearTimeout(request.timer);
  pending.delete(message.id);
  if (message.error) request.reject(new Error(JSON.stringify(message.error)));
  else request.resolve(message.result);
});
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP timeout: ${method}`));
    }, 45000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}




const checks=[];
function check(name,passed){checks.push({name,passed});console.log(`${passed?'PASS':'FAIL'}: ${name}`);if(!passed)throw new Error(name);}
const get=()=>evaluate('({m:window.__SKYBOUND_TRAVERSAL__.manipulation,p:window.__SKYBOUND_TRAVERSAL__.snapshot.position})');
async function key(code,key){await send('Input.dispatchKeyEvent',{type:'keyDown',code,key});await send('Input.dispatchKeyEvent',{type:'keyUp',code,key});}
async function waitFor(condition){await evaluate(`new Promise((resolve,reject)=>{const start=Date.now();const poll=()=>{if(${condition})return resolve();if(Date.now()-start>8000)return reject(new Error('Condition timeout'));setTimeout(poll,50)};poll()})`);}
async function tap(selector,touch=false){
 const at=await evaluate(`(()=>{const e=document.querySelector('${selector}');e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
 if(touch){await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...at,id:7}]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
 else{await send('Input.dispatchMouseEvent',{type:'mousePressed',...at,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...at,button:'left',clickCount:1});}
}
async function aim(touch=false){
 const p=await evaluate(`(()=>{const r=document.querySelector('#viewer').getBoundingClientRect();return {x:r.x+r.width*.52,y:r.y+r.height*.55}})()`);
 if(touch){await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:8}]});await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x+135,y:p.y+24.75,id:8}]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
 else{await send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'right',buttons:2,clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x+135,y:p.y+24.75,button:'right',buttons:2});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x+135,y:p.y+24.75,button:'right',buttons:0,clickCount:1});}
}
socket.addEventListener('message', ({data}) => { const event = JSON.parse(data); if(event.method === 'Page.javascriptDialogOpening' && event.params.type === 'confirm' && event.params.message.includes('현재 퍼즐을 초기화')) void send('Page.handleJavaScriptDialog',{accept:true}); });
try {
 await send('Page.enable');await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url});await waitFor('window.__SKYBOUND_TRAVERSAL__?.ready');
 await tap('#reset');await tap('#start');await waitFor('window.__SKYBOUND_TRAVERSAL__.manipulation.targetId');
 await key('KeyE','e');await key('KeyR','r');await aim();await key('KeyE','e');await waitFor('window.__SKYBOUND_TRAVERSAL__.puzzle.complete');
 check('stone ruin solved through original controls',await evaluate('window.__SKYBOUND_TRAVERSAL__.snapshot.progress.stoneRuinActive'));
 await evaluate(`(()=>{const s=window.__SKYBOUND_TRAVERSAL__;s.pause();s.setCameraForTest({yaw:0});window.__journeyWalk=(x,z)=>{for(let i=0;i<500;i++){const p=s.snapshot.position,dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz);if(d<.25)return;const before={...p};s.advanceForTest(.05,{x:dx/d,z:dz/d,yaw:0});if(s.snapshot.grounded&&Math.hypot(s.snapshot.position.x-before.x,s.snapshot.position.z-before.z)<.01)s.advanceForTest(.05,{x:dx/d,z:dz/d,yaw:0,jumpPressed:true});}throw new Error('Route blocked at '+JSON.stringify(s.snapshot.position));};window.__journeyWalk(3.8,35);window.__journeyWalk(3.8,34);})()`);
 const fight=await evaluate(`(()=>{const s=window.__SKYBOUND_TRAVERSAL__,rounds=[];for(let i=0;i<1400&&!s.combat.defeated;i++){const p=s.snapshot.position,t=s.combat.target,dx=t.x-p.x,dz=t.z-p.z,d=Math.hypot(dx,dz)||1;const g=s.guardian;if(s.attack.active){s.advanceForTest(.05,{});continue;}if(g.phase==='windup'){const locked=g.locked;if(Math.hypot(p.x-locked.x,p.z-locked.z)<1.05){s.advanceForTest(.05,{x:dz/d,z:-dx/d,yaw:0});}else s.advanceForTest(.05,{});continue;}if(d>1.5){s.advanceForTest(.05,{x:dx/d,z:dz/d,yaw:0});continue;}if(g.phase==='recovery'&&g.remaining>.9){s.advanceForTest(.01,{x:dx/d,z:dz/d,yaw:0});s.resume();document.querySelector('#attack').click();s.pause();rounds.push({hp:s.combat.hp,player:s.health.hp});}s.advanceForTest(.05,{});}return{defeated:s.combat.defeated,rounds};})()`);
 check('avoid warnings and defeat sentinel through attack actions',fight.defeated);
 await evaluate(`window.__journeyWalk(5.8,32);window.__SKYBOUND_TRAVERSAL__.resume();document.querySelector('#activate-ruin').click();window.__SKYBOUND_TRAVERSAL__.pause()`);
 check('watch device activates after combat',await evaluate('window.__SKYBOUND_TRAVERSAL__.snapshot.progress.watchRuinActive'));
 const flight=await evaluate(`(()=>{const s=window.__SKYBOUND_TRAVERSAL__;window.__journeyWalk(0,30);s.advanceForTest(.15,{jumpPressed:true});s.advanceForTest(.05,{jumpPressed:true});for(let i=0;i<90&&s.snapshot.position.y<s.platform.topY+4;i++)s.advanceForTest(.05,{});for(let i=0;i<80&&s.snapshot.position.x<8;i++)s.advanceForTest(.05,{x:1,yaw:0});for(let i=0;i<180&&!s.snapshot.grounded;i++)s.advanceForTest(.05,{});const first={...s.snapshot.progress};s.advanceForTest(.15,{jumpPressed:true});s.advanceForTest(.05,{jumpPressed:true});for(let i=0;i<80&&s.snapshot.position.x<14;i++)s.advanceForTest(.05,{x:1,yaw:0});for(let i=0;i<180&&!s.snapshot.grounded;i++)s.advanceForTest(.05,{});s.resume();document.querySelector('#activate-ruin').click();s.pause();return{first,progress:s.snapshot.progress,position:s.snapshot.position,platform:s.platform};})()`);
 check('flight visits both landing pads and activates wind altar',flight.first.firstAerialLanding&&flight.progress.windRuinActive);
 const ending=await evaluate(`(()=>{const s=window.__SKYBOUND_TRAVERSAL__;window.__journeyWalk(0,24);for(let i=0;i<200&&!s.snapshot.grounded;i++)s.advanceForTest(.05,{});s.advanceForTest(.15,{jumpPressed:true});s.advanceForTest(.05,{jumpPressed:true});const floor=s.snapshot.checkpoint.y;for(let i=0;i<120&&s.snapshot.position.y<floor+17;i++)s.advanceForTest(.05,{});for(let i=0;i<80&&s.snapshot.position.x<8;i++)s.advanceForTest(.05,{x:1,yaw:0});for(let i=0;i<200&&!s.snapshot.grounded;i++)s.advanceForTest(.05,{});return{progress:s.snapshot.progress,position:s.snapshot.position,endingVisible:!document.querySelector('#ending-panel').hidden,save:s.save};})()`);
 check('gate flight reaches ending without setting quest flags',ending.progress.journeyComplete&&ending.endingVisible);
 await evaluate(`document.querySelector('#explore-undiscovered').click()`);
 check('ending continues exploration with an undiscovered destination',await evaluate(`!window.__SKYBOUND_TRAVERSAL__.paused&&!window.__SKYBOUND_TRAVERSAL__.snapshot.progress.discoveries.includes(window.__SKYBOUND_TRAVERSAL__.navigation.chosen)`));
 await evaluate(`window.__SKYBOUND_TRAVERSAL__.pause()`);
 await send('Page.reload');await waitFor('window.__SKYBOUND_TRAVERSAL__?.ready');
 check('completed journey reloads safely with saved progress',await evaluate(`window.__SKYBOUND_TRAVERSAL__.snapshot.progress.journeyComplete&&window.__SKYBOUND_TRAVERSAL__.snapshot.position.x===0&&window.__SKYBOUND_TRAVERSAL__.snapshot.position.z===35`));
 check('no browser errors',errors.length===0);console.log(JSON.stringify({checks,fight,flight,ending}));
} catch(error){console.log(JSON.stringify(await evaluate(`({snapshot:window.__SKYBOUND_TRAVERSAL__?.snapshot,combat:window.__SKYBOUND_TRAVERSAL__?.combat,guardian:window.__SKYBOUND_TRAVERSAL__?.guardian,platform:window.__SKYBOUND_TRAVERSAL__?.platform})`)));throw error;}
finally{await writeFile(new URL('./journey-play.json',import.meta.url),JSON.stringify({url,checks,errors},null,2)+'\n');socket.close();}
