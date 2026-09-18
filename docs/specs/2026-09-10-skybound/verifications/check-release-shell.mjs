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
const s='window.__SKYBOUND_TRAVERSAL__';
async function check(name,expression){const result=await evaluate(expression);checks.push({name,...result});console.log(name,JSON.stringify(result));if(!result.passed)throw new Error(name);}
async function shot(name){const data=await send('Page.captureScreenshot',{format:'png'});await writeFile(new URL('./'+name+'.png',import.meta.url),Buffer.from(data.data,'base64'));}
try {
 await send('Page.enable');await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url});
 await evaluate(`new Promise((resolve,reject)=>{const t=Date.now();const poll=()=>{if(${s}?.ready)return resolve();if(Date.now()-t>12000)return reject(new Error('boot timeout'));setTimeout(poll,50)};poll()})`);
 await check('boot has focused start menu and full viewport scene',`(()=>{const v=document.querySelector('#viewer').getBoundingClientRect();return{error:${s}.error,passed:!${s}.error&&${s}.paused&&!document.querySelector('#pause-panel').hidden&&document.activeElement.id==='start'&&document.querySelector('.game-stage').inert&&v.width===innerWidth&&v.height===innerHeight&&document.documentElement.scrollHeight===innerHeight};})()`);
 await shot('release-start');
 await evaluate(`document.querySelector('#start').click()`);
 await check('start enters unobstructed gameplay',`({passed:!${s}.paused&&document.querySelector('#pause-panel').hidden&&!document.querySelector('.game-stage').inert&&document.activeElement.id==='viewer'})`);
 await shot('release-play');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});
 await check('Escape restores focused pause menu',`({passed:${s}.paused&&!document.querySelector('#pause-panel').hidden&&document.activeElement.id==='start'})`);
 await evaluate(`document.querySelector('#open-map').click();document.querySelector('#close-map').click()`);
 await evaluate(`new Promise(r=>setTimeout(r,100))`);
 await check('map opened from pause returns to paused menu',`({passed:${s}.paused&&!document.querySelector('#pause-panel').hidden&&!document.querySelector('#map-dialog').open})`);
 await evaluate(`document.querySelector('#start').click();document.querySelector('[data-open="open-map"]').click()`);
 await evaluate(`document.querySelector('#close-map').click()`);
 await evaluate(`new Promise(r=>setTimeout(r,100))`);
 await check('quick map returns to gameplay',`({paused:${s}.paused,error:${s}.error,hidden:document.querySelector('#pause-panel').hidden,modal:document.querySelector('#map-dialog').open,passed:!${s}.paused&&document.querySelector('#pause-panel').hidden})`);
 for(const [label,width,height] of [['portrait',390,844],['landscape',667,375]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:3});
  await evaluate(`new Promise(r=>setTimeout(r,150))`);
  await check(label+' touch layout',`(()=>{const rect=id=>document.querySelector(id).getBoundingClientRect(),a=rect('#touch-move'),b=rect('.touch-actions'),v=rect('.player-vitals'),m=rect('.play-menu'),c=rect('.carry-controls');const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;return{canvas:rect('#viewer').height,passed:!overlap(a,b)&&!overlap(v,m)&&!overlap(c,a)&&!overlap(c,b)&&document.documentElement.scrollWidth===innerWidth&&rect('#viewer').height===innerHeight};})()`);
  await shot('release-'+label);
 }
 if(errors.length)throw new Error(JSON.stringify(errors));
}finally{await writeFile(new URL('./release-shell.json',import.meta.url),JSON.stringify({url,checks,errors},null,2)+'\n');socket.close();}
