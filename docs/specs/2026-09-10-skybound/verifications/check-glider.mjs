// Run against a project-owned CDP browser; never starts or stops a browser.
// node check-glider.mjs <CDP port> <viewer URL> [artifact label]
import { mkdir, writeFile } from 'node:fs/promises';

const [port, url, artifact = 't03a-3'] = process.argv.slice(2);
if (!/^[a-z0-9-]+$/.test(artifact)) throw new Error('Invalid artifact label');
if (!port || !url) throw new Error('Usage: node check-glider.mjs <CDP port> <viewer URL>');
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
  const get=()=>evaluate(`(()=>{const s=window.__SKYBOUND_TRAVERSAL__;return {snapshot:s.snapshot,sailVisible:s.sailVisible,gliding:s.gliding,gliderStats:s.gliderStats,animation:s.animation,characterPosition:s.characterPosition,paused:s.paused}})()`);
  await evaluate('window.__SKYBOUND_TRAVERSAL__.resetForTest()');
  check('Grounded sail hidden',!(await get()).sailVisible);
  await evaluate('window.__SKYBOUND_TRAVERSAL__.advanceForTest(.15,{jumpPressed:true})');
  check('First jump does not deploy',!(await get()).snapshot.gliding);
  await evaluate('window.__SKYBOUND_TRAVERSAL__.advanceForTest(1/120,{jumpPressed:true})');
  let s=await get();samples.push(s);
  check('Airborne press deploys visible sail',s.snapshot.gliding&&s.sailVisible&&s.gliding);
  check('Gliding pose stays supported',s.animation==='fall');
  const stamina=s.snapshot.stamina;
  await evaluate('window.__SKYBOUND_TRAVERSAL__.advanceForTest(.1)');
  s=await get();check('Gliding consumes shared stamina',s.snapshot.stamina<stamina);
  check('Root follows flight simulation',positionMatch(s));
  await evaluate('window.__SKYBOUND_TRAVERSAL__.pause()');
  check('Pause preserves deployed sail',(await get()).sailVisible);
  const shot=await send('Page.captureScreenshot',{format:'png'});
  await writeFile(new URL(`${artifact}-flight.png`,import.meta.url),Buffer.from(shot.data,'base64'));
  await evaluate('window.__SKYBOUND_TRAVERSAL__.advanceForTest(1/120,{jumpPressed:true})');
  check('Next press folds sail',!(await get()).sailVisible&&!(await get()).snapshot.gliding);
  await evaluate('window.__SKYBOUND_TRAVERSAL__.resetForTest();window.__SKYBOUND_TRAVERSAL__.advanceForTest(.15,{jumpPressed:true});window.__SKYBOUND_TRAVERSAL__.advanceForTest(1/120,{jumpPressed:true})');
  for(let i=0;i<8;i++){if((await get()).snapshot.grounded)break;await evaluate('window.__SKYBOUND_TRAVERSAL__.advanceForTest(.25)');}
  s=await get();check('Landing hides sail',s.snapshot.grounded&&!s.sailVisible&&!s.snapshot.gliding);
  await evaluate('window.__SKYBOUND_TRAVERSAL__.resetForTest();window.__SKYBOUND_TRAVERSAL__.resume()');
  const key=type=>send('Input.dispatchKeyEvent',{type,key:' ',code:'Space',windowsVirtualKeyCode:32});
  await key('keyDown');await key('keyUp');
  await evaluate(`new Promise(resolve=>{const t=Date.now();const poll=()=>{if(!window.__SKYBOUND_TRAVERSAL__.snapshot.grounded||Date.now()-t>3000)return resolve();setTimeout(poll,20)};poll()})`);
  await key('keyDown');await key('keyUp');
  await evaluate(`new Promise(resolve=>{const t=Date.now();const poll=()=>{if(window.__SKYBOUND_TRAVERSAL__.sailVisible||Date.now()-t>3000)return resolve();setTimeout(poll,20)};poll()})`);
  check('Actual Space redeploys airborne sail',(await get()).sailVisible);
  await evaluate('window.__SKYBOUND_TRAVERSAL__.resetForTest()');
  s=await get();check('Reset clears flight and restores stamina',!s.sailVisible&&!s.snapshot.gliding&&s.snapshot.stamina===100);
  check('No browser errors',errors.length===0);
  await writeFile(new URL(`${artifact}-browser.json`,import.meta.url),JSON.stringify({url,checks,samples,errors},null,2)+'\n');
  console.log(JSON.stringify({passed:checks.length,failed:0,errors}));
}finally{socket.close();}
