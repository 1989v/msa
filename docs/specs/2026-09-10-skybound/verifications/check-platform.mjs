// Run against a project-owned CDP browser; never starts or stops a browser.
// node check-platform.mjs <CDP port> <viewer URL> [artifact label]
import { mkdir, writeFile } from 'node:fs/promises';

const [port, url, artifact = 't03b-2a'] = process.argv.slice(2);
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




const checks=[],samples=[];
function check(name,passed){console.log(`${passed?"PASS":"FAIL"}: ${name}`);checks.push({name,passed});if(!passed)throw new Error(name);}
async function snapshot(){return evaluate(`(()=>{const s=window.__SKYBOUND_TRAVERSAL__;return {snapshot:s.snapshot,animation:s.animation,characterPosition:s.characterPosition,terrainHeight:s.terrainHeight,paused:s.paused}})()`);}
function positionMatch(s){return ['x','y','z'].every(k=>Math.abs(s.snapshot.position[k]-s.characterPosition[k])<1e-5);}
try{
  await send('Page.enable');await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url});
  await evaluate(`new Promise((resolve,reject)=>{const start=Date.now();const poll=()=>{const s=window.__SKYBOUND_TRAVERSAL__;if(s?.error)return reject(new Error(s.error));if(s?.ready)return resolve();if(Date.now()-start>12000)return reject(new Error('Load timeout'));setTimeout(poll,100)};poll()})`);
  const get=()=>evaluate(`(()=>{const s=window.__SKYBOUND_TRAVERSAL__;return {snapshot:s.snapshot,platform:s.platform,updraft:s.updraft,sailVisible:s.sailVisible,characterPosition:s.characterPosition}})()`);
  const advance=(input={})=>evaluate(`window.__SKYBOUND_TRAVERSAL__.advanceForTest(.25,${JSON.stringify(input)})`);
  async function moveTo(x,z,max=30){for(let i=0;i<max;i++){const s=await get(),dx=x-s.snapshot.position.x,dz=z-s.snapshot.position.z,d=Math.hypot(dx,dz);if(d<.1)return;await advance({x:dx/Math.max(d,.8),z:dz/Math.max(d,.8)});}throw new Error('Target not reached');}
  await evaluate('window.__SKYBOUND_TRAVERSAL__.resetForTest()');
  const first=await get(),pad=first.platform,wind=first.updraft.volume;
  check('Starts with basic stamina and no platform completion',first.snapshot.stamina===100&&!pad.everLanded);
  await moveTo(pad.center.x,pad.center.z);
  const below=await get();samples.push(below);
  check('Can walk beneath platform on meadow',below.snapshot.grounded&&below.snapshot.position.y<pad.topY-1&&!below.platform.landed&&!below.platform.everLanded);
  await evaluate('window.__SKYBOUND_TRAVERSAL__.resetForTest()');
  await moveTo(wind.x,wind.z);
  await evaluate('window.__SKYBOUND_TRAVERSAL__.advanceForTest(.15,{jumpPressed:true});window.__SKYBOUND_TRAVERSAL__.advanceForTest(1/120,{jumpPressed:true})');
  for(let i=0;i<20;i++){if((await get()).snapshot.position.y>=pad.topY+4)break;await advance();}
  check('Wind reaches launch altitude',(await get()).snapshot.position.y>=pad.topY+4);
  await moveTo(pad.center.x,pad.center.z);
  for(let i=0;i<24;i++){if((await get()).platform.landed)break;await advance();}
  const landed=await get();samples.push(landed);
  check('Basic capability reaches platform',landed.platform.landed&&landed.snapshot.grounded&&Math.abs(landed.snapshot.position.y-pad.topY)<1e-5);
  check('Landing retains stamina and avoids respawn',landed.snapshot.stamina>0&&landed.snapshot.respawns===0);
  check('Landing closes sail and records route flag',!landed.sailVisible&&landed.platform.everLanded);
  check('Rendered feet match platform top',Math.abs(landed.characterPosition.y-pad.topY)<1e-5);
  const shot=await send('Page.captureScreenshot',{format:'png'});
  await writeFile(new URL(`${artifact}-landing.png`,import.meta.url),Buffer.from(shot.data,'base64'));
  for(let i=0;i<12;i++){await advance({x:1});if(!(await get()).snapshot.grounded)break;}
  const off=await get();check('Stepping off platform falls',!off.snapshot.grounded&&!off.platform.landed&&off.platform.everLanded);
  await evaluate('window.__SKYBOUND_TRAVERSAL__.resetForTest()');
  const reset=await get();check('Reset allows another attempt',!reset.platform.everLanded&&reset.snapshot.stamina===100&&reset.snapshot.grounded);
  check('No browser errors',errors.length===0);
  await writeFile(new URL(`${artifact}-browser.json`,import.meta.url),JSON.stringify({url,checks,samples,errors},null,2)+'\n');
  console.log(JSON.stringify({passed:checks.length,failed:0,errors}));
}finally{socket.close();}
