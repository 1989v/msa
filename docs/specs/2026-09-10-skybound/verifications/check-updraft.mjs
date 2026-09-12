// Run against a project-owned CDP browser; never starts or stops a browser.
// node check-updraft.mjs <CDP port> <viewer URL> [artifact label]
import { mkdir, writeFile } from 'node:fs/promises';

const [port, url, artifact = 't03b-1'] = process.argv.slice(2);
if (!/^[a-z0-9-]+$/.test(artifact)) throw new Error('Invalid artifact label');
if (!port || !url) throw new Error('Usage: node check-updraft.mjs <CDP port> <viewer URL>');
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
  const get=()=>evaluate(`(()=>{const s=window.__SKYBOUND_TRAVERSAL__;return {snapshot:s.snapshot,updraft:s.updraft,sailVisible:s.sailVisible,gripErrors:s.gripErrors,paused:s.paused}})()`);
  const advance=input=>evaluate(`window.__SKYBOUND_TRAVERSAL__.advanceForTest(.25,${JSON.stringify(input)})`);
  await evaluate('window.__SKYBOUND_TRAVERSAL__.resetForTest()');
  let initial=await get();const v=initial.updraft.volume;
  check('Spawn starts outside wind',!initial.updraft.inside);
  for(let i=0;i<16;i++){
    const s=await get(),dx=v.x-s.snapshot.position.x,dz=v.z-s.snapshot.position.z,d=Math.hypot(dx,dz);
    if(d<.5)break;
    await advance({x:dx/Math.max(d,1.5),z:dz/Math.max(d,1.5),sprint:true});
  }
  let inside=await get();samples.push(inside);
  check('Can walk into marked wind',inside.updraft.inside&&inside.snapshot.grounded);
  check('Folded sail gets no lift',!inside.updraft.active&&inside.snapshot.velocity.y===0);
  await evaluate('window.__SKYBOUND_TRAVERSAL__.advanceForTest(.15,{jumpPressed:true});window.__SKYBOUND_TRAVERSAL__.advanceForTest(1/120,{jumpPressed:true})');
  const opened=await get();
  check('Deploy activates wind',opened.updraft.active&&opened.snapshot.gliding&&opened.snapshot.windSpeed===v.speed);
  for(let i=0;i<4;i++)await advance({});
  const lifted=await get();samples.push(lifted);
  check('Wind produces actual ascent',lifted.snapshot.position.y>opened.snapshot.position.y+1&&lifted.snapshot.velocity.y>0);
  check('Wind restores shared stamina',lifted.snapshot.stamina>opened.snapshot.stamina);
  check('Hands remain attached while rising',lifted.gripErrors.left<.03&&lifted.gripErrors.right<.03);
  const shot=await send('Page.captureScreenshot',{format:'png'});
  await writeFile(new URL(`${artifact}-wind.png`,import.meta.url),Buffer.from(shot.data,'base64'));
  for(let i=0;i<8;i++){if(!(await get()).updraft.inside)break;await advance({x:1});}
  const exited=await get();check('Leaving cylinder disables wind',!exited.updraft.inside&&!exited.updraft.active&&exited.snapshot.windSpeed===0);
  for(let i=0;i<4;i++)await advance({});
  const falling=await get();samples.push(falling);
  check('Outside wind descends and spends stamina',falling.snapshot.gliding&&falling.snapshot.velocity.y<0&&falling.snapshot.stamina<exited.snapshot.stamina);
  await evaluate('window.__SKYBOUND_TRAVERSAL__.resetForTest()');
  check('Reset restores outside checkpoint',!(await get()).updraft.inside&&!(await get()).sailVisible);
  check('No browser errors',errors.length===0);
  await writeFile(new URL(`${artifact}-browser.json`,import.meta.url),JSON.stringify({url,checks,samples,errors},null,2)+'\n');
  console.log(JSON.stringify({passed:checks.length,failed:0,errors}));
}finally{socket.close();}
