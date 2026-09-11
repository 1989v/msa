// Run against a project-owned CDP browser; never starts or stops a browser.
// node check-character.mjs <CDP port> <viewer URL> [artifact label]
import { mkdir, writeFile } from 'node:fs/promises';

const [port, url, artifact = 't02b-4b2'] = process.argv.slice(2);
if (!/^[a-z0-9-]+$/.test(artifact)) throw new Error('Invalid artifact label');
if (!port || !url) throw new Error('Usage: node check-character.mjs <CDP port> <viewer URL>');
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
  const initial=await snapshot();samples.push(initial);
  check('Spawn grounded on actual terrain',initial.snapshot.grounded&&Math.abs(initial.snapshot.position.y-initial.terrainHeight)<1e-5);
  check('Character starts at simulation feet',positionMatch(initial));
  for(const [name,input] of [['walk',{z:-1}],['run',{z:-1,sprint:true}]]){
    await evaluate('window.__SKYBOUND_TRAVERSAL__.resetForTest()');
    await evaluate(`(()=>{for(let i=0;i<4;i++)window.__SKYBOUND_TRAVERSAL__.advanceForTest(.25,${JSON.stringify(input)})})()`);
    const s=await snapshot();samples.push(s);
    check(`${name} changes world position`,s.snapshot.position.z<initial.snapshot.position.z-2);
    check(`${name} selects matching animation`,s.animation===name);
    check(`${name} root follows simulation`,positionMatch(s));
    check(`${name} remains grounded`,s.snapshot.grounded&&Math.abs(s.snapshot.position.y-s.terrainHeight)<1e-5);
  }
  await evaluate('window.__SKYBOUND_TRAVERSAL__.resetForTest()');
  const timeline=[];
  for(let batch=0;batch<6;batch++)timeline.push(...await evaluate(`(()=>{const s=window.__SKYBOUND_TRAVERSAL__,frames=[];for(let i=0;i<5;i++){s.advanceForTest(1/30,{jumpPressed:${batch}===0&&i===0});frames.push({snapshot:s.snapshot,animation:s.animation,characterPosition:s.characterPosition,terrainHeight:s.terrainHeight})}return frames})()`));
  samples.push(...timeline);
  check('Jump rises above terrain',timeline.some(s=>s.snapshot.position.y-s.terrainHeight>.8&&s.animation==='jump'));
  check('Descending selects fall',timeline.some(s=>!s.snapshot.grounded&&s.animation==='fall'));
  check('Ground contact selects land',timeline.some(s=>s.snapshot.grounded&&s.animation==='land'));
  check('Root follows entire jump trajectory',timeline.every(positionMatch));
  await evaluate(`(()=>{for(let i=0;i<4;i++)window.__SKYBOUND_TRAVERSAL__.advanceForTest(.25,{})})()`);
  check('Landing settles to idle',(await snapshot()).animation==='idle');
  const shot=await send('Page.captureScreenshot',{format:'png'});
  await writeFile(new URL(`${artifact}-world.png`,import.meta.url),Buffer.from(shot.data,'base64'));
  await evaluate('window.__SKYBOUND_TRAVERSAL__.resume()');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'w',code:'KeyW',windowsVirtualKeyCode:87});
  await evaluate(`new Promise(resolve=>{const began=Date.now(),z=window.__SKYBOUND_TRAVERSAL__.snapshot.position.z;const poll=()=>{if(window.__SKYBOUND_TRAVERSAL__.snapshot.position.z<z-.1 || Date.now()-began>3000)return resolve();setTimeout(poll,50)};poll()})`);
  const moving=await snapshot();
  console.log(JSON.stringify({keyboard:moving}));
  check('Diagnostic keyboard moves character',moving.snapshot.position.z<initial.snapshot.position.z-.1);
  await evaluate(`window.dispatchEvent(new Event('blur'))`);
  const paused=await snapshot();
  await evaluate('new Promise(r=>setTimeout(r,100))');
  check('Blur pauses simulation',(await snapshot()).snapshot.tick===paused.snapshot.tick&&paused.paused);
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'w',code:'KeyW',windowsVirtualKeyCode:87});
  check('No browser errors',errors.length===0);
  await writeFile(new URL(`${artifact}-browser.json`,import.meta.url),JSON.stringify({url,checks,samples,errors},null,2)+'\n');
  console.log(JSON.stringify({passed:checks.length,failed:0,errors}));
}finally{socket.close();}
