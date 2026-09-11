// Run against a project-owned CDP browser; never starts or stops a browser.
// node check-character.mjs <CDP port> <viewer URL> [artifact label]
import { mkdir, writeFile } from 'node:fs/promises';

const [port, url, artifact = 't02b-4a'] = process.argv.slice(2);
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
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  const nav=await send('Page.navigate',{url}); if(nav.errorText)throw new Error(nav.errorText);
  await evaluate(`new Promise((resolve,reject)=>{const start=Date.now();const poll=()=>{const s=window.__SKYBOUND_CHARACTER__;if(s?.error)return reject(new Error(s.error));if(s?.ready)return resolve();if(Date.now()-start>12000)return reject(new Error('Load timeout'));setTimeout(poll,100)};poll()})`);
  const clips=await evaluate('window.__SKYBOUND_CHARACTER__.stats.map(s=>s.clips)');
  check('Both loaded GLBs retain walk/run clips',clips.every(c=>c.includes('walk')&&c.includes('run')));
  for(const lod of [0,1]) for(const motion of ['walk','run']) {
    const result=await evaluate(`(()=>{const s=window.__SKYBOUND_CHARACTER__;s.setLOD(${lod});s.setMotion('${motion}');const duration=s.getMotionSnapshot().duration;const samples=[];for(let i=0;i<24;i++){s.setMotion('${motion}',{time:duration*(i+.37)/24});samples.push(s.getMotionSnapshot())}return samples})()`);
    samples.push({lod,motion,frames:result});
    check(`${motion} LOD${lod} soles avoid penetration`,result.every(s=>s.soles.every(f=>f.min[1]>=-.004)));
    check(`${motion} LOD${lod} support contact maintained`,result.every(s=>Math.min(...s.soles.map(f=>f.min[1]))<.025));
    check(`${motion} LOD${lod} root stays in place`,result.every(s=>s.rootPosition.every(v=>Math.abs(v)<1e-7)));
    check(`${motion} LOD${lod} has alternating raised foot`,result.some(s=>s.soles[0].min[1]>.055)&&result.some(s=>s.soles[1].min[1]>.055));
  }
  for(const motion of ['walk','run']) {
    await evaluate(`(()=>{const s=window.__SKYBOUND_CHARACTER__;s.setLOD(0);s.setView('side');s.setMotion('${motion}',{time:${motion==='walk'?.28:.17}});s.renderNow()})()`);
    const shot=await send('Page.captureScreenshot',{format:'png'});
    await writeFile(new URL(`${artifact}-${motion}.png`,import.meta.url),Buffer.from(shot.data,'base64'));
  }
  const playing=await evaluate(`(async()=>{const s=window.__SKYBOUND_CHARACTER__;document.querySelector('#motion').value='walk';document.querySelector('#motion').dispatchEvent(new Event('change'));document.querySelector('#animate').click();const t=s.motionTime;await new Promise(r=>setTimeout(r,250));return {animated:s.animated,moved:s.motionTime!==t,motion:s.motion}})()`);
  check('UI selection and live playback advance',playing.animated&&playing.moved&&playing.motion==='walk');
  const stopped=await evaluate(`(()=>{document.querySelector('#animate').click();const s=window.__SKYBOUND_CHARACTER__;return {animated:s.animated,hips:s.getMotionSnapshot().joints.hips.position}})()`);
  check('Stop restores rest hip height',!stopped.animated&&Math.abs(stopped.hips[1]-.87)<1e-6);
  await evaluate(`document.querySelector('#reset').click()`);
  check('Reset restores idle selection',await evaluate(`window.__SKYBOUND_CHARACTER__.motion==='idle' && document.querySelector('#motion').value==='idle'`));
  check('No browser errors',errors.length===0);
  await writeFile(new URL(`${artifact}-motion-browser.json`,import.meta.url),JSON.stringify({url,checks,samples,errors},null,2)+'\n');
  console.log(JSON.stringify({passed:checks.length,failed:0,errors}));
} finally {socket.close();}
