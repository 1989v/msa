// Minimal deployment smoke check on a project-owned isolated CDP profile.
import {writeFile} from 'node:fs/promises';
const [port,url]=process.argv.slice(2);
if(!port||!url)throw new Error('Usage: node check-public-release.mjs <CDP port> <public URL>');
const pages=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page=pages.find(page=>page.type==='page');
if(!page)throw new Error('No page in isolated browser');
const socket=new WebSocket(page.webSocketDebuggerUrl),pending=new Map(),errors=[],checks=[];
await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
let sequence=0;
socket.addEventListener('message',({data})=>{
 const message=JSON.parse(data),request=pending.get(message.id);
 if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails);
 if(message.method==='Runtime.consoleAPICalled'&&message.params.type==='error')errors.push(message.params.args.map(arg=>arg.value??arg.description));
 if(!request)return;
 clearTimeout(request.timer);pending.delete(message.id);
 if(message.error)request.reject(new Error(JSON.stringify(message.error)));else request.resolve(message.result);
});
function send(method,params={}){return new Promise((resolve,reject)=>{
 const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(new Error(`CDP timeout: ${method}`));},30000);
 pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));
});}
async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));return result.result.value;}
try{
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
 await send('Emulation.setDeviceMetricsOverride',{width:960,height:640,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url});
 await evaluate(`new Promise((resolve,reject)=>{const t=Date.now();const poll=()=>{if(window.__SKYBOUND_TRAVERSAL__?.ready)return resolve();if(Date.now()-t>20000)return reject(new Error('public boot timeout'));setTimeout(poll,50)};poll()})`);
 const boot=await evaluate(`(()=>{const s=window.__SKYBOUND_TRAVERSAL__,c=document.querySelector('#viewer').getBoundingClientRect();return{title:document.title,error:s.error,passed:!s.error&&s.ready&&s.loadedFromGLB&&s.paused&&!document.querySelector('#pause-panel').hidden&&!!document.querySelector('#reload-game')&&!document.querySelector('#start').disabled&&c.width===innerWidth&&c.height===innerHeight};})()`);
 checks.push({name:'public package boots with original GLB and new shell',...boot});if(!boot.passed)throw new Error('Public boot failed');
 const play=await evaluate(`(async()=>{const s=window.__SKYBOUND_TRAVERSAL__,tick=s.snapshot.tick;document.querySelector('#start').click();await new Promise(r=>setTimeout(r,700));const result={ticks:s.snapshot.tick-tick,passed:!s.error&&!s.paused&&s.snapshot.tick>tick&&document.querySelector('#pause-panel').hidden&&!document.querySelector('.game-stage').inert};document.querySelector('#open-pause').click();result.passed=result.passed&&s.paused&&!document.querySelector('#pause-panel').hidden&&document.activeElement.id==='start';return result;})()`);
 checks.push({name:'public renderer advances and menu returns to pause',...play});
 const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(new URL('./public-release.png',import.meta.url),Buffer.from(shot.data,'base64'));
 if(errors.length||checks.some(check=>!check.passed))throw new Error('Public release smoke failed');
}finally{
 await writeFile(new URL('./public-release.json',import.meta.url),JSON.stringify({url,checkedAt:new Date().toISOString(),checks,errors},null,2)+'\n');
 socket.close();console.log(JSON.stringify({checks,errors}));
}
