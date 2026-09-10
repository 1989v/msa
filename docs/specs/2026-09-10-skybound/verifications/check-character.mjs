// Run against a project-owned CDP browser; never starts or stops a browser.
// node check-character.mjs <CDP port> <viewer URL> [artifact label]
import { mkdir, writeFile } from 'node:fs/promises';

const [port, url] = process.argv.slice(2);
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

const snapshots = [];
const checks = [];
function check(name, passed, details = {}) {
  console.log(`${passed ? "PASS" : "FAIL"}: ${name}`);
  checks.push({name, passed, ...details});
  if (!passed) throw new Error(name);
}
async function settle() {
  await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
}
async function state() {
  return evaluate(`(() => {
    const { glbBase64, atlasBase64, ...rest } = window.__SKYBOUND_CHARACTER__;
    return {...rest, overflow: document.documentElement.scrollWidth > innerWidth};
  })()`);
}
try {
  check('Fixture is served', (await fetch(url)).ok);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {width:1280,height:900,deviceScaleFactor:1,mobile:false});
  const navigation = await send('Page.navigate', {url});
  if (navigation.errorText) throw new Error(navigation.errorText);
  await evaluate(`new Promise((resolve,reject) => {
    const start=Date.now();
    const poll=() => {
      const s=window.__SKYBOUND_CHARACTER__;
      if(s?.error) return reject(new Error(s.error));
      if(s?.ready) return resolve(true);
      if(Date.now()-start>12000) return reject(new Error('Character load timeout'));
      setTimeout(poll,100);
    };poll();
  })`);
  const initial = await state();
  check('Actual GLB character loaded', initial.ready && initial.loadedFromGLB, {stats:initial.stats});
  // Keep CDP messages bounded; large binary strings can stall the transport.
  async function readBase64(expression) {
    const length=await evaluate(`${expression}.length`);
    let result='';
    for(let offset=0;offset<length;offset+=32768) result+=await evaluate(`${expression}.slice(${offset},${offset+32768})`);
    return result;
  }
  const artifacts={glbBase64:[]};
  for(let lod=0;lod<2;lod++) artifacts.glbBase64.push(await readBase64(`window.__SKYBOUND_CHARACTER__.glbBase64[${lod}]`));
  artifacts.atlasBase64=await readBase64('window.__SKYBOUND_CHARACTER__.atlasBase64');
  check('Two exported LOD files and atlas available', artifacts.glbBase64?.length === 2 && !!artifacts.atlasBase64);
  const directory=new URL('../implementation/t02b/character/assets/',import.meta.url);
  await mkdir(directory,{recursive:true});
  for(let i=0;i<2;i++) await writeFile(new URL(`naru-lod${i}.glb`,directory),Buffer.from(artifacts.glbBase64[i],'base64'));
  await writeFile(new URL('naru-atlas.png',directory),Buffer.from(artifacts.atlasBase64,'base64'));
  for(const [view,width,height] of [['front',1280,900],['back',1280,900],['side',1280,900],['threequarter',1280,900],['front',390,844]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    const clicked=await evaluate(`(() => {const b=document.querySelector('[data-view="${view}"]');if(!b)return false;b.click();return true})()`);
    check(`View button ${view} ${width}`,clicked);
    await settle();
    const current=await state();
    check(`No overflow ${view} ${width}`,!current.overflow);
    const b=current.renderedBounds;
    check(`Model contained ${view} ${width}`, b && b.left>=0 && b.right<=b.canvasWidth && b.top>=0 && b.bottom<=b.canvasHeight);
    check(`View selected ${view} ${width}`,current.view===view);
    const screenshot=await send('Page.captureScreenshot',{format:'png'});
    const label=width===390?'portrait':view;
    await writeFile(new URL(`t02b-3-${label}.png`,import.meta.url),Buffer.from(screenshot.data,'base64'));
    snapshots.push({label,width,height,...current});
  }
  await evaluate(`(() => {const s=document.querySelector('#lod');s.value='1';s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await settle();
  check('Lower LOD is selected and rendered',(await state()).lod===1);
  await evaluate(`document.querySelector('#pose').click()`);
  await settle();
  check('Rig inspection pose responds',(await state()).pose===true);
  const posed=await send('Page.captureScreenshot',{format:'png'});
  await writeFile(new URL('t02b-3-lod1-pose.png',import.meta.url),Buffer.from(posed.data,'base64'));
  await evaluate(`document.querySelector('#pose').click()`);
  await settle();
  check('Rest pose can be restored',(await state()).pose===false);
  check('No browser errors',errors.length===0);
  const report={url,checks,errors,snapshots};
  await writeFile(new URL('t02b-3-browser.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:checks.length,failed:0,stats:initial.stats.map(({parts,...rest})=>rest),errors},null,2));
} finally {socket.close();}
