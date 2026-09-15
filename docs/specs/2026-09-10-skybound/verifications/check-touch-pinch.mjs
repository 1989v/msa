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
try {
  await send('Page.enable');await send('Runtime.enable');await send('Page.navigate',{url});
  await evaluate(`new Promise((resolve,reject)=>{const t=Date.now();const poll=()=>{if(window.__SKYBOUND_TRAVERSAL__?.ready)return resolve();if(Date.now()-t>12000)return reject(new Error('boot timeout'));setTimeout(poll,50)};poll()})`);
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await evaluate(`(()=>{const s=window.__SKYBOUND_TRAVERSAL__;s.resetForTest();s.setCameraForTest({yaw:-.8,distance:5,pitch:.29});})()`);
  const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(new URL('./sentinel-model.png',import.meta.url),Buffer.from(shot.data,'base64'));
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  await evaluate(`window.__SKYBOUND_TRAVERSAL__.resetForTest();window.__SKYBOUND_TRAVERSAL__.resume();window.scrollTo(0,0)`);
  const r=await evaluate(`(()=>{const r=document.querySelector('#viewer').getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}})()`);
  const a={x:r.x+r.w*.55,y:r.y+r.h*.56,id:1},b={x:r.x+r.w*.78,y:r.y+r.h*.56,id:2};
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a,b]});
  await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[a,{...b,x:r.x+r.w*.93}]});
  const camera=await evaluate(`window.__SKYBOUND_TRAVERSAL__.camera`);
  checks.push({name:'two real touch pointers zoom without rotating camera',passed:camera.distance<6&&camera.distance>=3&&Math.abs(camera.yaw)<.001,camera});
  await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const owners=await evaluate(`window.__SKYBOUND_TRAVERSAL__.touch`);
  checks.push({name:'pinch release frees both pointers',passed:owners.lookId===null&&owners.pinchId===null,owners});
  console.log(JSON.stringify({checks,errors:errors.length}));if(errors.length||checks.some(c=>!c.passed))throw new Error('Touch pinch failed');
}finally{await writeFile(new URL('./touch-pinch.json',import.meta.url),JSON.stringify({url,checks,errors},null,2)+'\n');socket.close();}
