// Run against a project-owned CDP browser; never starts or stops a browser.
// node check-character.mjs <CDP port> <viewer URL> [artifact label]
import { mkdir, writeFile } from 'node:fs/promises';

const [port, url, artifact = 't02b-4b1'] = process.argv.slice(2);
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
function check(name,passed){checks.push({name,passed});if(!passed)throw new Error(name);}
try {
  await send('Page.enable');await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  const nav=await send('Page.navigate',{url});if(nav.errorText)throw new Error(nav.errorText);
  await evaluate(`new Promise((resolve,reject)=>{const start=Date.now();const poll=()=>{const s=window.__SKYBOUND_CHARACTER__;if(s?.error)return reject(new Error(s.error));if(s?.ready)return resolve();if(Date.now()-start>12000)return reject(new Error('Load timeout'));setTimeout(poll,100)};poll()})`);
  const clips=await evaluate('window.__SKYBOUND_CHARACTER__.stats.map(s=>s.clips)');
  check('Both GLBs retain ground and aerial clips',clips.every(c=>['walk','run','jump','fall','land'].every(n=>c.includes(n))));
  for(const lod of [0,1])for(const name of ['jump','fall','land']){
    const result=await evaluate(`(()=>{const s=window.__SKYBOUND_CHARACTER__;s.setLOD(${lod});s.setMotion('${name}');const duration=s.getMotionSnapshot().duration;const frames=[];for(let i=0;i<=12;i++){s.setMotion('${name}',{time:duration*i/12});frames.push(s.getMotionSnapshot())}return frames})()`);
    samples.push({lod,name,frames:result});
    check(`${name} LOD${lod} root remains at origin`,result.every(s=>s.rootPosition.every(v=>Math.abs(v)<1e-7)));
    check(`${name} LOD${lod} soles stay above ground`,result.every(s=>s.soles.every(f=>f.min[1]>=-.004)));
    if(name==='land')check(`Land LOD${lod} ends at bind hip`,Math.abs(result.at(-1).joints.hips.position[1]-.87)<1e-5);
  }
  for(const name of ['jump','fall','land']){
    await evaluate(`(()=>{const s=window.__SKYBOUND_CHARACTER__;s.setLOD(0);s.setView('side');const select=document.querySelector('#motion');select.value='${name}';select.dispatchEvent(new Event('change'));const duration=s.getMotionSnapshot().duration;s.setMotion('${name}',{time:duration*.5});s.renderNow()})()`);
    check(`${name} UI selection works`,await evaluate(`window.__SKYBOUND_CHARACTER__.motion==='${name}'`));
    const shot=await send('Page.captureScreenshot',{format:'png'});
    await writeFile(new URL(`${artifact}-${name}.png`,import.meta.url),Buffer.from(shot.data,'base64'));
  }
  for(const name of ['jump','land']){
    const ended=await evaluate(`(async()=>{const s=window.__SKYBOUND_CHARACTER__;s.setMotion('${name}');const duration=s.getMotionSnapshot().duration;s.setMotion('${name}',{time:duration-.04,play:true});await new Promise(r=>setTimeout(r,300));return {completed:s.motionCompleted,animated:s.animated,time:s.motionTime,duration}})()`);
    check(`${name} one-shot clamps and stops`,ended.completed&&!ended.animated&&Math.abs(ended.time-ended.duration)<1e-6);
    const replay=await evaluate(`(()=>{document.querySelector('#animate').click();const s=window.__SKYBOUND_CHARACTER__;return s.animated&&!s.motionCompleted&&s.motionTime<.05})()`);
    check(`${name} can replay after completion`,replay);
  }
  await evaluate(`document.querySelector('#reset').click()`);
  check('Reset returns to idle',await evaluate(`window.__SKYBOUND_CHARACTER__.motion==='idle' && !window.__SKYBOUND_CHARACTER__.animated`));
  check('No browser errors',errors.length===0);
  await writeFile(new URL(`${artifact}-aerial-browser.json`,import.meta.url),JSON.stringify({url,checks,samples,errors},null,2)+'\n');
  console.log(JSON.stringify({passed:checks.length,failed:0,errors}));
}finally{socket.close();}
