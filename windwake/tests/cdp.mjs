// Dependency-free Chrome DevTools driver for a separately owned test browser.
import {writeFile,mkdir} from 'node:fs/promises';
export async function connect(port=9488){
  const pages=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page=pages.find(p=>p.type==='page');if(!page)throw new Error('No Chrome page');
  const socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  let serial=0;const pending=new Map(),events=[];
  socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timeout);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}}else events.push(m);};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;const timeout=setTimeout(()=>{pending.delete(id);reject(new Error(`CDP timeout: ${method}`));},20000);pending.set(id,{resolve,reject,timeout});socket.send(JSON.stringify({id,method,params}));});
  await send('Runtime.enable');await send('Page.enable');await send('Log.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const key=async(code,type='keyDown')=>{const map={KeyW:['w',87],KeyA:['a',65],KeyS:['s',83],KeyD:['d',68],KeyJ:['j',74],KeyK:['k',75],KeyQ:['q',81],KeyE:['e',69],KeyF:['f',70],KeyH:['h',72],KeyM:['m',77],Space:[' ',32],Escape:['Escape',27],ShiftLeft:['Shift',16],ArrowRight:['ArrowRight',39]};const[k,v]=map[code]||[code,0];await send('Input.dispatchKeyEvent',{type,code,key:k,windowsVirtualKeyCode:v});};
  const tap=async code=>{await key(code);await sleep(45);await key(code,'keyUp');};
  const click=async(x,y)=>{await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});};
  const clickId=async id=>{const r=await evaluate(`(()=>{const r=document.getElementById(${JSON.stringify(id)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);await click(r.x,r.y);};
  const screenshot=async path=>{await mkdir(new URL('.',`file://${path}`).pathname,{recursive:true});const r=await send('Page.captureScreenshot',{format:'png'});await writeFile(path,Buffer.from(r.data,'base64'));};
  return {send,evaluate,key,tap,click,clickId,screenshot,sleep,events,close:()=>socket.close()};
}
