// Run against a project-owned CDP browser; never starts or stops a browser.
// node check-menus.mjs <CDP port> <viewer URL> [artifact label]
import { writeFile } from 'node:fs/promises';

const [port, url, artifact = 'beta-play'] = process.argv.slice(2);
if (!/^[a-z0-9-]+$/.test(artifact)) throw new Error('Invalid artifact label');
if (!port || !url) throw new Error('Usage: node check-menus.mjs <CDP port> <viewer URL>');
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
const ready = `new Promise((resolve,reject)=>{const t=Date.now();const poll=()=>{if(!window.__oldPage&&window.__SKYBOUND_TRAVERSAL__?.ready)return resolve();if(Date.now()-t>12000)return reject(new Error('boot timeout'));setTimeout(poll,50)};poll()})`;
async function check(name, expression) {
 const result=await evaluate(expression);checks.push({name,...result});console.log(name,JSON.stringify(result));if(!result.passed)throw new Error(name+' failed');
}
try {
 await send('Page.enable');await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url});await evaluate(ready);
 // Only the original first ending is a fixture. All expansion progress uses movement and visible device inputs.
 await evaluate(`(()=>{localStorage.setItem('skybound.progress.v1',JSON.stringify({version:1,worldVersion:1,progress:{journeyComplete:true,stoneRuinActive:true,watchRuinActive:true,windRuinActive:true,firstAerialLanding:true,secondAerialLanding:true}}));window.__oldPage=true})()`);
 await send('Page.reload');await evaluate(ready);
 await evaluate(`(()=>{const s=window.__SKYBOUND_TRAVERSAL__;if(s.error)throw new Error(s.error);s.pause();window.walkTo=(target)=>{for(let i=0;i<1000;i++){const p=s.snapshot.position,dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz);if(d<.2)return;const before={...p};s.advanceForTest(.1,{x:dx/d,z:dz/d,yaw:0});if(s.snapshot.grounded&&Math.hypot(s.snapshot.position.x-before.x,s.snapshot.position.z-before.z)<.01)s.advanceForTest(.05,{x:dx/d,z:dz/d,yaw:0,jumpPressed:true});}throw new Error('Walk blocked '+JSON.stringify(s.snapshot.position));};const select=document.querySelector('#navigation-target');select.value='high-archive';select.dispatchEvent(new Event('change'));window.walkTo({...s.navigation.target});})()`);
 for(let leg=0;leg<7;leg++){
  await check('western flight leg '+(leg+1),`(()=>{const s=window.__SKYBOUND_TRAVERSAL__,target={...s.navigation.target},source={...s.snapshot.position};for(let i=0;i<40;i++)s.advanceForTest(.1,{});s.advanceForTest(.15,{jumpPressed:true});s.advanceForTest(.01,{jumpPressed:true});for(let i=0;i<160&&s.snapshot.position.y<source.y+25;i++)s.advanceForTest(.05,{});for(let i=0;i<220;i++){const p=s.snapshot.position,dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz);if(d<.25)break;s.advanceForTest(.05,{x:dx/d,z:dz/d,yaw:0});}const reserve=s.snapshot.stamina;if(s.snapshot.gliding)s.advanceForTest(.01,{jumpPressed:true});for(let i=0;i<220&&!s.snapshot.grounded;i++)s.advanceForTest(.05,{});const p=s.snapshot.position;return{target,position:p,reserve,grounded:s.snapshot.grounded,respawns:s.snapshot.respawns,passed:s.snapshot.grounded&&reserve>0&&Math.hypot(p.x-target.x,p.z-target.z)<.4&&Math.abs(p.y-target.y)<.6&&s.snapshot.respawns===0};})()`);
  if(leg===3){
   for(let station=0;station<3;station++)await check('harbor station '+(station+1),`(()=>{const s=window.__SKYBOUND_TRAVERSAL__;window.walkTo({x:${-75+station*3},z:-71.7});for(let i=0;i<${station+1};i++){s.resume();document.querySelector('#activate-ruin').click();s.pause();}return{harbor:s.harbor,passed:s.harbor.aligned===${station+1}};})()`);
   await evaluate(`window.walkTo({x:-65,z:-67})`);
  }
 }
 await evaluate(`(()=>{const s=window.__SKYBOUND_TRAVERSAL__;window.flyTo=(target)=>{for(let i=0;i<120;i++){const p=s.snapshot.position,dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz);if(d<.2)return;s.advanceForTest(.05,{x:dx/d,z:dz/d,yaw:0});}throw new Error('Flight blocked');};s.advanceForTest(.15,{jumpPressed:true});s.advanceForTest(.01,{jumpPressed:true});})()`);
 for(let index=0;index<3;index++){
  const ring=[{x:-44,y:27,z:-126},{x:-51,y:31,z:-123},{x:-48,y:35,z:-130}][index];
  await check('archive altitude '+(index+1),`(()=>{const s=window.__SKYBOUND_TRAVERSAL__,ring=${JSON.stringify(ring)};window.flyTo({x:-48,z:-126});for(let i=0;i<180&&s.snapshot.position.y<ring.y+.15;i++)s.advanceForTest(.05,{});window.flyTo(ring);for(let i=0;i<180&&s.archive.count===${index};i++)s.advanceForTest(.05,{});return{archive:s.archive,stamina:s.snapshot.stamina,position:s.snapshot.position,passed:s.archive.count===${index+1}&&s.snapshot.respawns===0&&s.snapshot.stamina>0};})()`);
 }
 await check('record second ending and save',`(()=>{const s=window.__SKYBOUND_TRAVERSAL__;window.flyTo({x:-48,z:-126});if(s.snapshot.gliding)s.advanceForTest(.01,{jumpPressed:true});for(let i=0;i<180&&!s.snapshot.grounded;i++)s.advanceForTest(.05,{});s.resume();document.querySelector('#activate-ruin').click();const saved=JSON.parse(localStorage.getItem('skybound.progress.v1'));return{archive:s.archive,saved:saved.progress,passed:s.snapshot.progress.archiveComplete===true&&saved.progress.archiveComplete===true&&!document.querySelector('#ending-panel').hidden&&document.querySelector('#ending-title').textContent.includes('두 번째')&&document.activeElement.id==='continue-exploring'&&s.paused};})()`);
 const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(new URL('./expansion-ending.png',import.meta.url),Buffer.from(shot.data,'base64'));
 await check('continue expansion exploration',`(()=>{document.querySelector('#continue-exploring').click();const s=window.__SKYBOUND_TRAVERSAL__;const passed=!s.paused&&document.querySelector('#ending-panel').hidden;s.pause();window.__oldPage=true;return{passed};})()`);
 await send('Page.reload');await evaluate(ready);
 await check('reload completed expansion at safe origin',`(()=>{const s=window.__SKYBOUND_TRAVERSAL__;return{progress:s.snapshot.progress,harbor:s.harbor,archive:s.archive,position:s.snapshot.position,passed:s.snapshot.progress.archiveComplete===true&&s.harbor.complete&&s.archive.complete&&Math.hypot(s.snapshot.position.x,s.snapshot.position.z-35)<1};})()`);
 if(errors.length)throw new Error('Browser errors: '+JSON.stringify(errors));
}finally{await writeFile(new URL('./expansion-play.json',import.meta.url),JSON.stringify({url,checks,errors},null,2)+'\n');socket.close();}
