// Run against a project-owned CDP browser; never starts or stops a browser.
// node check-viewer.mjs <CDP port> <viewer URL> [artifact label]
import { writeFile } from 'node:fs/promises';

const [port, url, artifact = 't01a', mode = 'all'] = process.argv.slice(2);
if (!port || !url) throw new Error('Usage: node check-viewer.mjs <CDP port> <viewer URL>');
if (!/^[a-z0-9-]+$/.test(artifact)) throw new Error('Invalid artifact label');
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
const assert=(value,label)=>{if(!value)throw new Error(label);checks.push(label);};
const wait=ms=>evaluate(`new Promise(r=>setTimeout(r,${ms}))`);
const state=()=>evaluate('JSON.parse(JSON.stringify(window.__SKYBOUND_VIEWER__))');
const ready=()=>evaluate(`new Promise((resolve,reject)=>{const end=Date.now()+12000;function poll(){if(window.__SKYBOUND_VIEWER__?.ready)return resolve();if(Date.now()>end)return reject(new Error('ready timeout'));setTimeout(poll,100);}poll();})`);
let injection;
try{
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url});await ready();const initial=await state();
 await send('Input.dispatchMouseEvent',{type:'mouseWheel',x:640,y:450,deltaX:0,deltaY:10000});await wait(300);let q=await state();
 assert(q.camera.distance<=260.001&&q.camera.distance>=60,'zoom-out stays within bounds');
 await send('Input.dispatchMouseEvent',{type:'mouseWheel',x:640,y:450,deltaX:0,deltaY:-10000});await wait(300);q=await state();
 assert(q.camera.distance>=59.999&&q.camera.distance<=260,'zoom-in stays within bounds');
 await send('Input.dispatchMouseEvent',{type:'mousePressed',x:640,y:400,button:'left',clickCount:1});
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:1200,y:850,button:'left',buttons:1});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:1200,y:850,button:'left',clickCount:1});await wait(400);q=await state();
 assert(q.camera.polar>=.199&&q.camera.polar<=1.421&&q.camera.azimuth>=-.901&&q.camera.azimuth<=1.201,'drag respects orbit limits');
 await evaluate("document.querySelector('#reset').click()");await wait(150);q=await state();
 assert(q.camera.position.every((v,i)=>Math.abs(v-initial.camera.position[i])<.0001),'reset returns original camera');
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await wait(250);let a=await state();await wait(250);q=await state();
 assert(q.reducedMotion&&q.waterTime===a.waterTime,'reduced motion freezes water animation');
 await evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))");a=await state();await wait(250);q=await state();
 assert(!q.running&&q.frames===a.frames,'synthetic visibility event stops render loop');
 await evaluate("delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))");await wait(250);q=await state();
 assert(q.running&&q.frames>a.frames,'visibility handler resumes loop');
 await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:3,mobile:true});await wait(300);q=await state();
 assert(q.pixelRatio===1.5&&q.viewport.bufferWidth===585,'touch DPR capped at 1.5');
 await evaluate("window.__lostExtension=document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context');window.__lostExtension.loseContext()");await wait(350);q=await state();
 assert(q.contextLost&&!q.ready&&!q.running&&await evaluate("!document.querySelector('#retry').hidden"),'actual WebGL loss stops loop and exposes retry');
 await evaluate('window.__lostExtension.restoreContext()');await ready();q=await state();
 assert(!q.contextLost&&q.ready&&q.running,'actual WebGL restoration resumes rendering');
 assert(errors.length===0,'no unexpected runtime errors before failure injection');
 injection=await send('Page.addScriptToEvaluateOnNewDocument',{source:"const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:original.call(this,type,...args)}"});
 await send('Page.reload',{ignoreCache:true});await wait(1600);q=await state();
 assert(!q.ready&&q.error&&await evaluate("!document.querySelector('#retry').hidden"),'WebGL initialization failure has actionable retry');
 await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:injection.identifier});injection=null;
 await send('Page.reload',{ignoreCache:true});await ready();
 const result={checks,pass:checks.length,fail:0,note:'Software WebGL. Visibility event is synthetic; not a real-device performance benchmark.'};
 await writeFile(new URL('t01c-behavior.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}finally{if(injection)await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:injection.identifier});socket.close();}
