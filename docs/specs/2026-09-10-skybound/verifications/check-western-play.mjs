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
try {
 await send('Page.enable');await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url});
 await evaluate(`new Promise((resolve,reject)=>{const t=Date.now();const poll=()=>{if(window.__SKYBOUND_TRAVERSAL__?.ready)return resolve();if(Date.now()-t>12000)return reject(new Error('boot timeout'));setTimeout(poll,50)};poll()})`);
 await evaluate(`(()=>{const s=window.__SKYBOUND_TRAVERSAL__;if(s.error)throw new Error(s.error);s.resetForTest({journeyComplete:true,stoneRuinActive:true,watchRuinActive:true,windRuinActive:true,firstAerialLanding:true,secondAerialLanding:true});const select=document.querySelector('#navigation-target');select.value='high-archive';select.dispatchEvent(new Event('change'));const target={...s.navigation.target};for(let i=0;i<1000;i++){const p=s.snapshot.position,dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz);if(d<.25)break;const before={...p};s.advanceForTest(.1,{x:dx/d,z:dz/d,yaw:0});if(s.snapshot.grounded&&Math.hypot(s.snapshot.position.x-before.x,s.snapshot.position.z-before.z)<.01)s.advanceForTest(.05,{x:dx/d,z:dz/d,yaw:0,jumpPressed:true});}if(Math.hypot(s.snapshot.position.x-target.x,s.snapshot.position.z-target.z)>.5)throw new Error('North launch blocked');})()`);
 for(let leg=0;leg<7;leg++){
  const result=await evaluate(`(()=>{const s=window.__SKYBOUND_TRAVERSAL__,target={...s.navigation.target},source={...s.snapshot.position};for(let i=0;i<40;i++)s.advanceForTest(.1,{});s.advanceForTest(.15,{jumpPressed:true});s.advanceForTest(.01,{jumpPressed:true});for(let i=0;i<160&&s.snapshot.position.y<source.y+25;i++)s.advanceForTest(.05,{});for(let i=0;i<220;i++){const p=s.snapshot.position,dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz);if(d<.25)break;s.advanceForTest(.05,{x:dx/d,z:dz/d,yaw:0});}const reserve=s.snapshot.stamina;if(s.snapshot.gliding)s.advanceForTest(.01,{jumpPressed:true});for(let i=0;i<220&&!s.snapshot.grounded;i++)s.advanceForTest(.05,{});const p=s.snapshot.position;return{target,position:p,reserve,grounded:s.snapshot.grounded,respawns:s.snapshot.respawns,passed:s.snapshot.grounded&&reserve>0&&Math.hypot(p.x-target.x,p.z-target.z)<.4&&Math.abs(p.y-target.y)<.4&&s.snapshot.respawns===0};})()`);
  checks.push({name:'western flight leg '+(leg+1),...result});if(!result.passed)throw new Error('Flight leg '+(leg+1)+' failed');
 }
 await evaluate(`document.querySelector('#open-map').click()`);
 const map=await evaluate(`({area:document.querySelector('#map-area').value,rows:document.querySelectorAll('#map-locations li').length,discoveries:window.__SKYBOUND_TRAVERSAL__.snapshot.progress.discoveries})`);
 checks.push({name:'expanded map and both regions discovered',passed:map.area==='western'&&map.discoveries.includes('west-harbor')&&map.discoveries.includes('high-archive')&&map.rows===map.discoveries.length,...map});
 const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(new URL('./western-map.png',import.meta.url),Buffer.from(shot.data,'base64'));
 console.log(JSON.stringify({checks,errors:errors.length}));if(errors.length||checks.some(c=>!c.passed))throw new Error('Western passage failed');
}finally{await writeFile(new URL('./western-play.json',import.meta.url),JSON.stringify({url,checks,errors},null,2)+'\n');socket.close();}
