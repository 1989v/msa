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
    }, 15000);
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
try {
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Emulation.setTouchEmulationEnabled',{enabled:false});
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url});await waitFor('window.__SKYBOUND_TRAVERSAL__?.ready');
 check('Standalone beta loads local character',await evaluate("window.__SKYBOUND_TRAVERSAL__.loadedFromGLB && document.documentElement.dataset.characterSrc==='./assets/naru-lod0.glb'"));
 await tap('#start');await waitFor('window.__SKYBOUND_TRAVERSAL__.manipulation.targetId');
 await key('KeyE','e');await key('KeyR','r');await aim();
 await waitFor('window.__SKYBOUND_TRAVERSAL__.manipulation.preview?.valid===true');
 check('Held prism does not complete puzzle',await evaluate('!!window.__SKYBOUND_TRAVERSAL__.manipulation.held && !window.__SKYBOUND_TRAVERSAL__.puzzle.complete'));
 await tap('#start');const paused=await get();await key('KeyE','e');check('Pause preserves carried prism',JSON.stringify((await get()).m)===JSON.stringify(paused.m));
 await tap('#start');await waitFor('!window.__SKYBOUND_TRAVERSAL__.manipulation.paused');await key('KeyE','e');
 await waitFor('window.__SKYBOUND_TRAVERSAL__.puzzle.complete');check('Keyboard and mouse solve first puzzle',!(await get()).m.held&&(await get()).m.locked);
 await key('KeyE','e');check('Completed prism cannot be grabbed',!(await get()).m.held);
 await tap('#reset');check('Reset clears completion',await evaluate('!window.__SKYBOUND_TRAVERSAL__.puzzle.complete&&!window.__SKYBOUND_TRAVERSAL__.manipulation.locked'));
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 await evaluate('window.scrollTo(0,0)');
 await tap('#start',true);await waitFor('window.__SKYBOUND_TRAVERSAL__.manipulation.targetId');
 await tap('#manipulate',true);await tap('#rotate-object',true);await aim(true);
 await tap('#manipulate',true);await waitFor('window.__SKYBOUND_TRAVERSAL__.puzzle.complete');
 check('390px touch controls solve puzzle',await evaluate('window.__SKYBOUND_TRAVERSAL__.puzzle.complete'));
 console.log(JSON.stringify(await evaluate("({width:innerWidth,scroll:document.documentElement.scrollWidth,buttons:['#manipulate','#rotate-object','#cancel-object','#touch-jump','#touch-sprint','#start','#reset'].map(s=>({s,rect:document.querySelector(s).getBoundingClientRect().toJSON()}))})")));
 check('Mobile buttons have 44px targets and no horizontal overflow',await evaluate("document.documentElement.scrollWidth<=innerWidth&&['#manipulate','#rotate-object','#cancel-object','#touch-jump','#touch-sprint','#start','#reset'].every(s=>{const r=document.querySelector(s).getBoundingClientRect();return r.width>=44&&r.height>=44})"));
 const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(new URL(`${artifact}-mobile.png`,import.meta.url),Buffer.from(shot.data,'base64'));
 await tap('#reset',true);check('Touch reset allows replay',await evaluate('!window.__SKYBOUND_TRAVERSAL__.puzzle.complete'));
 check('No browser errors',errors.length===0);
 console.log(JSON.stringify({passed:checks.length,failed:0}));
} catch(error) { console.log(JSON.stringify(await evaluate('({m:window.__SKYBOUND_TRAVERSAL__?.manipulation,c:window.__SKYBOUND_TRAVERSAL__?.camera,paused:window.__SKYBOUND_TRAVERSAL__?.paused})'))); throw error; } finally {await writeFile(new URL(`${artifact}-browser.json`,import.meta.url),JSON.stringify({url,checks,errors},null,2)+'\n');socket.close();}
