// Run against a project-owned CDP browser; never starts or stops a browser.
// node check-touch.mjs <CDP port> <viewer URL> [artifact label]
import { mkdir, writeFile } from 'node:fs/promises';

const [port, url, artifact = 't02c-2'] = process.argv.slice(2);
if (!/^[a-z0-9-]+$/.test(artifact)) throw new Error('Invalid artifact label');
if (!port || !url) throw new Error('Usage: node check-touch.mjs <CDP port> <viewer URL>');
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
try {
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  await send('Page.navigate',{url});
  await evaluate(`new Promise((resolve,reject)=>{const start=Date.now();const poll=()=>{const s=window.__SKYBOUND_TRAVERSAL__;if(s?.error)return reject(new Error(s.error));if(s?.ready)return resolve();if(Date.now()-start>12000)return reject(new Error('Load timeout'));setTimeout(poll,100)};poll()})`);
  const get=()=>evaluate(`(()=>{const s=window.__SKYBOUND_TRAVERSAL__;return {touch:s.touch,camera:s.camera,snapshot:s.snapshot,paused:s.paused}})()`);
  const rect=selector=>evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,width:r.width,height:r.height}})()`);
  const touch=(type,points)=>send('Input.dispatchTouchEvent',{type,touchPoints:points.map(p=>({id:p.id,x:p.x,y:p.y,radiusX:3,radiusY:3,force:1}))});
  const move=await rect('#touch-move'),canvas=await rect('canvas');
  check('Portrait controls fit viewport',await evaluate(`document.documentElement.scrollWidth<=innerWidth&&document.querySelector('#touch-move').getBoundingClientRect().width>=44`));
  await touch('touchStart',[{id:1,...move}]);
  await touch('touchMove',[{id:1,...move,y:move.y-30}]);
  check('Paused movement touch ignored',(await get()).touch.z===0);
  await touch('touchEnd',[]);
  await evaluate('window.__SKYBOUND_TRAVERSAL__.resume()');
  const before=await get();
  const a={id:1,...move},b={id:2,x:canvas.x+canvas.width*.25,y:canvas.y-40};
  await touch('touchStart',[a]);
  await touch('touchMove',[{...a,y:a.y-35}]);
  await touch('touchStart',[{...a,y:a.y-35},b]);
  await touch('touchMove',[{...a,y:a.y-35},{...b,x:b.x-35,y:b.y+15}]);
  await evaluate(`new Promise(resolve=>{const t=Date.now();const poll=()=>{const s=window.__SKYBOUND_TRAVERSAL__;if((s.snapshot.position.z<34.9&&Math.abs(s.camera.yaw)>.05)||Date.now()-t>3000)return resolve();setTimeout(poll,50)};poll()})`);
  let current=await get();samples.push(current);console.log(JSON.stringify({before,current,move,canvas}));
  check('Two touches move and turn together',current.touch.z<-.1&&current.touch.moveId!==null&&current.touch.lookId!==null&&Math.abs(current.camera.yaw-before.camera.yaw)>.05&&current.snapshot.position.z<before.snapshot.position.z-.1);
  await touch('touchEnd',[{...b,x:b.x-35,y:b.y+15}]);
  current=await get();console.log(JSON.stringify({afterLift:current}));
  check('Lifting look preserves movement',current.touch.lookId===null&&current.touch.moveId!==null&&current.touch.z<-.1);
  await touch('touchCancel',[]);
  current=await get();
  check('Touch cancellation releases movement',current.touch.moveId===null&&current.touch.z===0&&current.touch.x===0);
  await evaluate('window.__SKYBOUND_TRAVERSAL__.resetForTest();window.__SKYBOUND_TRAVERSAL__.resume()');
  const sprint=await rect('#touch-sprint'),jump=await rect('#touch-jump');
  check('Action targets at least 44px',[sprint,jump].every(r=>r.width>=44&&r.height>=44));
  await touch('touchStart',[{id:3,...sprint}]);
  check('Sprint hold activates',(await get()).touch.sprint);
  await touch('touchEnd',[]);
  check('Sprint release clears',!(await get()).touch.sprint);
  await touch('touchStart',[{id:4,...jump}]);
  await evaluate(`new Promise(resolve=>{const t=Date.now();const poll=()=>{if(!window.__SKYBOUND_TRAVERSAL__.snapshot.grounded||Date.now()-t>3000)return resolve();setTimeout(poll,30)};poll()})`);
  check('Jump touch starts airborne movement',!(await get()).snapshot.grounded);
  await evaluate("window.dispatchEvent(new Event('blur'))");
  current=await get();
  check('Blur pauses and clears all touch owners',current.paused&&['moveId','lookId','sprintId','jumpId'].every(k=>current.touch[k]===null)&&!current.touch.sprint&&current.touch.z===0);
  await touch('touchEnd',[]);
  await evaluate('window.__SKYBOUND_TRAVERSAL__.resetForTest()');
  for(const [label,width,height] of [['portrait',390,844],['landscape',844,390]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
    await evaluate('new Promise(r=>setTimeout(r,200))');
    check(`${label} horizontal overflow absent`,await evaluate('document.documentElement.scrollWidth<=innerWidth'));
    check(`${label} touch controls visible`,await evaluate(`['#touch-move','#touch-sprint','#touch-jump'].every(id=>{const r=document.querySelector(id).getBoundingClientRect();return r.width>=44&&r.height>=44&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})`));
    const shot=await send('Page.captureScreenshot',{format:'png'});
    await writeFile(new URL(`${artifact}-${label}.png`,import.meta.url),Buffer.from(shot.data,'base64'));
  }
  check('No browser errors',errors.length===0);
  await writeFile(new URL(`${artifact}-browser.json`,import.meta.url),JSON.stringify({url,checks,samples,errors},null,2)+'\n');
  console.log(JSON.stringify({passed:checks.length,failed:0,errors}));
} finally { await send('Emulation.setTouchEmulationEnabled',{enabled:false});socket.close(); }
