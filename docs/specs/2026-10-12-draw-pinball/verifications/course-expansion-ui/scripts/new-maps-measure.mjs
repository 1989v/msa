import { writeFileSync } from 'node:fs';
const [port, out] = process.argv.slice(2), origin='http://127.0.0.1:5186';
const tab=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();
const ws=new WebSocket(tab.webSocketDebuggerUrl);let id=0;const pending=new Map();
const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
ws.onmessage=async(e)=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}}else if(m.method==='Fetch.requestPaused'){const u=m.params.request.url;await send(/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(u)||u.startsWith('data:')?'Fetch.continueRequest':'Fetch.failRequest',{requestId:m.params.requestId,...(/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(u)||u.startsWith('data:')?{}:{errorReason:'BlockedByClient'})});}};
await new Promise(r=>ws.onopen=r);
const ev=async(expression)=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??JSON.stringify(r.exceptionDetails));return r.result?.value;};
const inner=(expr)=>ev(`document.querySelector('iframe').contentWindow.eval(${JSON.stringify(expr)})`);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const wait=async(expr,inside=false)=>{for(let i=0;i<80;i++){if(await(inside?inner(expr):ev(expr)))return;await sleep(100);}throw Error('not ready '+expr);};
const rect='r=>({left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height})';
async function click(expr,inside=false){const point=await ev(`(()=>{const f=document.querySelector('iframe');const d=${inside?'f.contentDocument':'document'};const e=${expr};e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();const p=${inside?'f.getBoundingClientRect()':'{left:0,top:0}'};return {x:r.left+p.left+r.width/2,y:r.top+p.top+r.height/2};})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});}
await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
const sizes=[[390,844,true],[390,844,true],[390,844,true]];
const names=['지그재그','범퍼 숲','시소'];
const report={fixture:'real local GameDetailPage and shipped iframe; catalogue/session API fixtures only, external requests blocked',viewports:[],naturalResult:null,replay:null};
for(const [index,[width,height,mobile]] of sizes.entries()){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});await send('Emulation.setTouchEmulationEnabled',{enabled:mobile});
  await send('Page.navigate',{url:origin+'/games/marble-race'});await wait(`!!document.querySelector('.game-play-btn')`);await click(`d.querySelector('.game-play-btn')`);
  await wait(`!!document.querySelector('iframe')?.contentWindow?.Setup?.visible()`);
  await inner(`(()=>{const e=document.querySelector('.mr-ta');e.value=Array.from({length:12},(_,i)=>String.fromCharCode(0xac00+i*28)+'나다라마바사아자차카타').join('\\n');e.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`);
  await click(`[...d.querySelectorAll('.mr-chip')].find(e=>e.querySelector('b').textContent===${JSON.stringify(names[index%3])})`,true);
  const titles=await inner(`[...document.querySelectorAll('.mr-course-preview')].map(e=>e.parentElement.querySelector('b').textContent)`);
  await click(`d.querySelector('.mr-go')`,true);await wait(`Game.state()?.phase==='racing'`,true);
  await inner(`(()=>{const old=Art.panel;Art.panel=function(...a){if(a[1]===20&&a[2]===20&&a[4]===118)window.__hud={x:a[1],y:a[2],w:a[3],h:a[4]};return old(...a)};return true;})()`);
  await sleep(100);
  const before=await inner(`({seed:Game.state().seed,t:Game.state().world.t})`);
  await inner(`document.activeElement.blur()`);
  for(const [key,code,vk,text]of[[' ','Space',32,' '],['r','KeyR',82,'r']]){await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:vk,text});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:vk});}
  const after=await inner(`({seed:Game.state().seed,t:Game.state().world.t})`);
  if(before.seed!==after.seed||after.t-before.t>1)throw Error('race keyboard reset/skipped');
  const layout=await ev(`(()=>{const f=document.querySelector('iframe'),w=f.contentWindow,d=f.contentDocument;const to=${rect};return{innerHeight,visualHeight:visualViewport.height,stage:to(document.querySelector('.game-stage').getBoundingClientRect()),frame:to(f.getBoundingClientRect()),canvas:to(d.querySelector('canvas').getBoundingClientRect()),menu:to(d.querySelector('.mr-watch').getBoundingClientRect()),toolbar:to(document.querySelector('.game-stage-bar').getBoundingClientRect()),hud:w.__hud,replayHidden:d.querySelector('.mr-replay').hidden,buttons:[...d.querySelectorAll('button')].filter(e=>!e.hidden).map(e=>e.textContent),course:w.Game.state().course.key};})()`);
  report.viewports.push({width,height,mobile,titles,noSkip:!layout.buttons.some(n=>n.includes('빨리')),keyboard:{before,after},...layout});
  let shot=await send('Page.captureScreenshot',{format:'png'});writeFileSync(`${out}/replay-race-${layout.course}-${width}x${height}.png`,Buffer.from(shot.data,'base64'));
  await click(`d.querySelector('summary')`,true);
  const opened=await inner(`(()=>{const r=document.querySelector('.mr-watch').getBoundingClientRect(),c=document.querySelector('canvas').getBoundingClientRect();return{right:r.right,bottom:r.bottom,minimapLeft:c.left+1000*c.width/1080,names:Game.state().entries.map(e=>e.name.length)};})()`);
  if(opened.right+7>opened.minimapLeft||!opened.names.every(n=>n===12))throw Error('opened menu overlap/longname');
  report.viewports.at(-1).opened=opened;
  await inner(`document.querySelector('.mr-watch').scrollTop=document.querySelector('.mr-watch').scrollHeight`);
  const action=await inner(`(()=>{const m=document.querySelector('.mr-watch').getBoundingClientRect(),r=[...document.querySelectorAll('button')].find(b=>b.textContent==='참가자 변경').getBoundingClientRect();return{bottom:r.bottom,menuBottom:m.bottom};})()`);
  if(action.bottom>action.menuBottom)throw Error('unreachable menu action');
  report.viewports.at(-1).action=action;
  shot=await send('Page.captureScreenshot',{format:'png'});writeFileSync(`${out}/replay-menu-${width}x${height}.png`,Buffer.from(shot.data,'base64'));
  await click(`d.querySelector('summary')`,true);
  if(index<sizes.length-1){await click(`d.querySelector('[aria-label="게임 닫기"]')`);await wait(`!document.querySelector('iframe')`);continue;}
  await click(`d.querySelector('[aria-label="게임 닫기"]')`);await wait(`!document.querySelector('iframe')`);
}
writeFileSync(`${out}/new-maps-measure.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));await send('Page.close');ws.close();
