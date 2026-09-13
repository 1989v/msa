// Run against a project-owned CDP browser; never starts or stops a browser.
// node check-platform.mjs <CDP port> <viewer URL> [artifact label]
import { mkdir, writeFile } from 'node:fs/promises';

const [port, url, artifact = 't04a-2a'] = process.argv.slice(2);
if (!/^[a-z0-9-]+$/.test(artifact)) throw new Error('Invalid artifact label');
if (!port || !url) throw new Error('Usage: node check-platform.mjs <CDP port> <viewer URL>');
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
try {
 await send('Page.enable');await send('Runtime.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url});await waitFor('window.__SKYBOUND_TRAVERSAL__?.ready');
 await evaluate('window.__SKYBOUND_TRAVERSAL__.resume()');
 await waitFor('window.__SKYBOUND_TRAVERSAL__.manipulation.targetId');
 const original=await get();await key('KeyE','e');
 check('E grabs aimed prism',!!(await get()).m.held);
 check('Carry does not commit placement',JSON.stringify((await get()).m.objects)===JSON.stringify(original.m.objects));
 await key('KeyR','r');check('R rotates 90 degrees',(await get()).m.held.yaw===90);
 const before=await get();
 await send('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyW',key:'w'});await key('Space',' ');
 await evaluate('new Promise(r=>setTimeout(r,350))');await send('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyW',key:'w'});
 check('Carry locks movement and jump',JSON.stringify((await get()).p)===JSON.stringify(before.p));
 await evaluate('window.__SKYBOUND_TRAVERSAL__.pause()');const paused=await get();await key('KeyE','e');
 check('Pause freezes held pose',JSON.stringify((await get()).m)===JSON.stringify(paused.m));
 await evaluate('window.__SKYBOUND_TRAVERSAL__.resume()');await waitFor('!window.__SKYBOUND_TRAVERSAL__.manipulation.paused');
 await key('KeyE','e');const dropped=await get();check('E commits rotated placement',!dropped.m.held&&dropped.m.objects[0].yaw===90);
 await evaluate('window.__SKYBOUND_TRAVERSAL__.resetForTest();window.__SKYBOUND_TRAVERSAL__.resume()');await waitFor('window.__SKYBOUND_TRAVERSAL__.manipulation.targetId');
 await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 const button=await evaluate("(()=>{const r=document.querySelector('#manipulate').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()");
 await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...button,id:1}]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await waitFor('window.__SKYBOUND_TRAVERSAL__.manipulation.held');check('Touch button grabs prism',!!(await get()).m.held);
 await evaluate('window.__SKYBOUND_TRAVERSAL__.setCameraForTest({pitch:1.15})');
 await waitFor('window.__SKYBOUND_TRAVERSAL__.manipulation.preview?.valid===false');await key('KeyE','e');
 check('Overlapping preview rejects drop',!!(await get()).m.held&&(await get()).m.preview.valid===false);
 await evaluate("document.querySelector('#cancel-object').click()");check('Cancel restores committed pose',!(await get()).m.held&&JSON.stringify((await get()).m.objects)===JSON.stringify(original.m.objects));
 await evaluate('window.__SKYBOUND_TRAVERSAL__.resetForTest()');check('Reset restores player and prism',JSON.stringify((await get()).p)===JSON.stringify(original.p)&&!(await get()).m.held);
 check('No browser errors',errors.length===0);
 const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(new URL(`${artifact}.png`,import.meta.url),Buffer.from(shot.data,'base64'));
 console.log(JSON.stringify({passed:checks.length,failed:0}));
} finally {await writeFile(new URL(`${artifact}-browser.json`,import.meta.url),JSON.stringify({url,checks,errors},null,2)+'\n');socket.close();}
