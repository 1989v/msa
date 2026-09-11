// Run against a project-owned CDP browser; never starts or stops a browser.
// node check-controls.mjs <CDP port> <viewer URL> [artifact label]
import { mkdir, writeFile } from 'node:fs/promises';

const [port, url, artifact = 't02c-1'] = process.argv.slice(2);
if (!/^[a-z0-9-]+$/.test(artifact)) throw new Error('Invalid artifact label');
if (!port || !url) throw new Error('Usage: node check-controls.mjs <CDP port> <viewer URL>');
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




const checks=[],samples=[];
function check(name,passed){console.log(`${passed?"PASS":"FAIL"}: ${name}`);checks.push({name,passed});if(!passed)throw new Error(name);}
async function snapshot(){return evaluate(`(()=>{const s=window.__SKYBOUND_TRAVERSAL__;return {snapshot:s.snapshot,animation:s.animation,characterPosition:s.characterPosition,terrainHeight:s.terrainHeight,paused:s.paused}})()`);}
function positionMatch(s){return ['x','y','z'].every(k=>Math.abs(s.snapshot.position[k]-s.characterPosition[k])<1e-5);}
try{
  check('Fixture HTTP200',(await fetch(url)).ok);
  await send('Page.enable');await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  const nav=await send('Page.navigate',{url});if(nav.errorText)throw new Error(nav.errorText);
  await evaluate(`new Promise((resolve,reject)=>{const start=Date.now();const poll=()=>{const s=window.__SKYBOUND_TRAVERSAL__;if(s?.error)return reject(new Error(s.error));if(s?.ready)return resolve();if(Date.now()-start>12000)return reject(new Error('Load timeout'));setTimeout(poll,100)};poll()})`);
  await evaluate('window.__SKYBOUND_TRAVERSAL__.resetForTest()');
  const cam=()=>evaluate('window.__SKYBOUND_TRAVERSAL__.camera');
  const point=await evaluate(`(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  const mouse=(type,extra={})=>send('Input.dispatchMouseEvent',{type,...point,button:'right',buttons:2,...extra});
  await mouse('mousePressed',{clickCount:1});
  check('Right press captures drag',(await cam()).dragging);
  await mouse('mouseMoved',{x:point.x+150,y:point.y+50});
  let c=await cam();
  check('Actual mouse drag rotates yaw and pitch',Math.abs(c.yaw+.75)<.02&&Math.abs(c.pitch-.49)<.02);
  await mouse('mouseReleased',{buttons:0,clickCount:1});
  check('Release clears drag',!(await cam()).dragging);
  for(const [delta,distance] of [[2000,8],[-2000,3]]){
    await send('Input.dispatchMouseEvent',{type:'mouseWheel',...point,deltaX:0,deltaY:delta});
    await evaluate('new Promise(r=>setTimeout(r,100))');
    check(`Wheel clamps distance to ${distance}`,Math.abs((await cam()).distance-distance)<1e-6);
  }
  await evaluate('window.__SKYBOUND_TRAVERSAL__.setCameraForTest({yaw:Math.PI/2})');
  const before=await snapshot();
  await evaluate('window.__SKYBOUND_TRAVERSAL__.resume()');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'w',code:'KeyW',windowsVirtualKeyCode:87});
  await evaluate(`new Promise(resolve=>{const start=Date.now(),x=window.__SKYBOUND_TRAVERSAL__.snapshot.position.x;const poll=()=>{if(window.__SKYBOUND_TRAVERSAL__.snapshot.position.x<x-.1||Date.now()-start>3000)return resolve();setTimeout(poll,50)};poll()})`);
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'w',code:'KeyW',windowsVirtualKeyCode:87});
  await evaluate('window.__SKYBOUND_TRAVERSAL__.pause()');
  const after=await snapshot();samples.push(before,after);
  check('Actual W follows rotated camera',after.snapshot.position.x<before.snapshot.position.x-.1&&Math.abs(after.snapshot.position.z-before.snapshot.position.z)<.01);
  await mouse('mousePressed',{clickCount:1});
  await evaluate("window.dispatchEvent(new Event('blur'))");
  check('Blur cancels camera drag',!(await cam()).dragging&&(await snapshot()).paused);
  await mouse('mouseReleased',{buttons:0,clickCount:1});
  await mouse('mousePressed',{clickCount:1});
  await evaluate(`document.querySelector('canvas').dispatchEvent(new PointerEvent('pointercancel',{pointerId:1}))`);
  check('Pointer cancellation clears drag',!(await cam()).dragging);
  await mouse('mouseReleased',{buttons:0,clickCount:1});
  await evaluate('window.__SKYBOUND_TRAVERSAL__.resetForTest()');
  c=await cam();
  check('Reset restores camera',c.yaw===0&&c.pitch===.29&&c.distance===5.2&&!c.dragging);
  const shot=await send('Page.captureScreenshot',{format:'png'});
  await writeFile(new URL(`${artifact}-world.png`,import.meta.url),Buffer.from(shot.data,'base64'));
  check('No browser errors',errors.length===0);
  await writeFile(new URL(`${artifact}-browser.json`,import.meta.url),JSON.stringify({url,checks,samples,errors},null,2)+'\n');
  console.log(JSON.stringify({passed:checks.length,failed:0,errors}));
}finally{socket.close();}
