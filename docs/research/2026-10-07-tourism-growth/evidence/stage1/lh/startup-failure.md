측정 시도 KST: 2026-10-08T04:35:23+09:00 | 도구: Node22.22.3/npm10.9.8/Lighthouse13.5.0/Chrome154.0.8037.98 | 표본: 완료0/계획15(페이지별0/5) | 명령: bash lh/run.sh (Chrome headless + node lh/measure.mjs)

# Headless 시작 실패 증거

Chrome 버전조회 출력: `Google Chrome 154.0.8037.98`. npm 설치 출력: `added 113 packages in 6s`. 아래는 실패한 실행의 원본 출력과 재현 스크립트다. 재실행하지 않았다.

```text
curl: (7) Failed to connect to 127.0.0.1 port 9337 after 0 ms: Couldn't connect to server
docs/research/2026-10-07-tourism-growth/evidence/stage1/lh/run.sh: line 14: 92580 Abort trap: 6           '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' --headless=new --no-first-run --no-default-browser-check --disable-background-networking --disable-component-update --disable-sync --disable-default-apps --remote-debugging-port=9337 --user-data-dir="$PROFILE" about:blank > "$ROOT/chrome.log" 2>&1
curl: (7) Failed to connect to 127.0.0.1 port 9337 after 0 ms: Couldn't connect to server
curl: (7) Failed to connect to 127.0.0.1 port 9337 after 0 ms: Couldn't connect to server
curl: (7) Failed to connect to 127.0.0.1 port 9337 after 0 ms: Couldn't connect to server
curl: (7) Failed to connect to 127.0.0.1 port 9337 after 0 ms: Couldn't connect to server
curl: (7) Failed to connect to 127.0.0.1 port 9337 after 0 ms: Couldn't connect to server
curl: (7) Failed to connect to 127.0.0.1 port 9337 after 0 ms: Couldn't connect to server
curl: (7) Failed to connect to 127.0.0.1 port 9337 after 0 ms: Couldn't connect to server
curl: (7) Failed to connect to 127.0.0.1 port 9337 after 0 ms: Couldn't connect to server
curl: (7) Failed to connect to 127.0.0.1 port 9337 after 0 ms: Couldn't connect to server
curl: (7) Failed to connect to 127.0.0.1 port 9337 after 0 ms: Couldn't connect to server
curl: (7) Failed to connect to 127.0.0.1 port 9337 after 0 ms: Couldn't connect to server
curl: (7) Failed to connect to 127.0.0.1 port 9337 after 0 ms: Couldn't connect to server
curl: (7) Failed to connect to 127.0.0.1 port 9337 after 0 ms: Couldn't connect to server
curl: (7) Failed to connect to 127.0.0.1 port 9337 after 0 ms: Couldn't connect to server
curl: (7) Failed to connect to 127.0.0.1 port 9337 after 0 ms: Couldn't connect to server
curl: (7) Failed to connect to 127.0.0.1 port 9337 after 0 ms: Couldn't connect to server
curl: (7) Failed to connect to 127.0.0.1 port 9337 after 0 ms: Couldn't connect to server
curl: (7) Failed to connect to 127.0.0.1 port 9337 after 0 ms: Couldn't connect to server
curl: (7) Failed to connect to 127.0.0.1 port 9337 after 0 ms: Couldn't connect to server
curl: (7) Failed to connect to 127.0.0.1 port 9337 after 0 ms: Couldn't connect to server
curl: (7) Failed to connect to 127.0.0.1 port 9337 after 0 ms: Couldn't connect to server
curl: (7) Failed to connect to 127.0.0.1 port 9337 after 0 ms: Couldn't connect to server
curl: (7) Failed to connect to 127.0.0.1 port 9337 after 0 ms: Couldn't connect to server
curl: (7) Failed to connect to 127.0.0.1 port 9337 after 0 ms: Couldn't connect to server
curl: (7) Failed to connect to 127.0.0.1 port 9337 after 0 ms: Couldn't connect to server
curl: (7) Failed to connect to 127.0.0.1 port 9337 after 0 ms: Couldn't connect to server
curl: (7) Failed to connect to 127.0.0.1 port 9337 after 0 ms: Couldn't connect to server
curl: (7) Failed to connect to 127.0.0.1 port 9337 after 0 ms: Couldn't connect to server
curl: (7) Failed to connect to 127.0.0.1 port 9337 after 0 ms: Couldn't connect to server
node:internal/deps/undici/undici:14976
      Error.captureStackTrace(err);
            ^

TypeError: fetch failed
    at node:internal/deps/undici/undici:14976:13
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async file:///Users/gideok-kwon/IdeaProjects/msa/docs/research/2026-10-07-tourism-growth/evidence/stage1/lh/measure.mjs:6:22 {
  [cause]: Error: connect ECONNREFUSED 127.0.0.1:9337
      at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1637:16) {
    errno: -61,
    code: 'ECONNREFUSED',
    syscall: 'connect',
    address: '127.0.0.1',
    port: 9337
  }
}

Node.js v22.22.3
sysmon request failed with error: sysmond service not found
pgrep: Cannot get process list

```

```bash
#!/bin/bash
set -eu
ROOT="$(cd "$(dirname "$0")" && pwd)"
PROFILE="$ROOT/profile"
CHROME_PID=''
cleanup() {
 if [ -n "$CHROME_PID" ]; then kill "$CHROME_PID" 2>/dev/null || true; wait "$CHROME_PID" 2>/dev/null || true; fi
 node -e 'require("fs").rmSync(process.argv[1],{recursive:true,force:true})' "$PROFILE"
 pgrep -fl 'Google Chrome.*headless' || true
}
trap cleanup EXIT INT TERM
'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' --headless=new --no-first-run --no-default-browser-check --disable-background-networking --disable-component-update --disable-sync --disable-default-apps --remote-debugging-port=9337 --user-data-dir="$PROFILE" about:blank > "$ROOT/chrome.log" 2>&1 &
CHROME_PID=$!
for i in {1..30}; do if curl -fsS http://127.0.0.1:9337/json/version > /dev/null; then break; fi; sleep 1; done
node "$ROOT/measure.mjs"

```

```javascript
import fs from 'node:fs/promises';
import path from 'node:path';
import lighthouse from './tooling/node_modules/lighthouse/core/index.js';
const root=path.dirname(new URL(import.meta.url).pathname);
const port=Number(process.env.LH_PORT||9337);
const browser=await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
const ws=new WebSocket(browser.webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let id=0, chain=Promise.resolve(), last=0, total=0, current='setup';
const pending=new Map(), sessions=new Set(), requests=[], blocked=[], runs=[];
function send(method,params={},sessionId){ return new Promise((resolve,reject)=>{ const n=++id; pending.set(n,{resolve,reject}); ws.send(JSON.stringify({id:n,method,params,...(sessionId?{sessionId}:{})})); }); }
ws.addEventListener('message',async event=>{
 const m=JSON.parse(event.data);
 if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}return;}
 if(m.method==='Target.attachedToTarget'){
  const s=m.params.sessionId;sessions.add(s);
  try {await send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]},s); await send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true},s); await send('Runtime.runIfWaitingForDebugger',{},s);} catch(e){ console.error('attach',e.message); }
 }
 if(m.method==='Fetch.requestPaused'){
  const {requestId,request}=m.params; const s=m.sessionId;
  chain=chain.then(async()=>{
   let u;try{u=new URL(request.url);}catch{}
   if(!u || !['https:','http:'].includes(u.protocol)){await send('Fetch.continueRequest',{requestId},s);return;}
   if(u.protocol!=='https:' || !['place.1989v.com','api.1989v.com'].includes(u.hostname) || total>=2000){
    blocked.push({run:current,url:request.url,reason:total>=2000?'request-budget':'host-policy'}); await send('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'},s);return;
   }
   await new Promise(r=>setTimeout(r,Math.max(0,250-(Date.now()-last))));
   last=Date.now();total++;requests.push({run:current,url:request.url,time:new Date().toISOString(),ordinal:total});
   await send('Fetch.continueRequest',{requestId},s);
  }).catch(e=>console.error('request',e.message));
 }
});
await send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true});
const ua=browser['User-Agent'].replace('HeadlessChrome','Chrome');
console.log('UA',ua);
const urls={detail:'https://place.1989v.com/attractions/1',hub:'https://place.1989v.com/',region:'https://place.1989v.com/regions/11'};
try{
 for(const [page,url] of Object.entries(urls))for(let i=1;i<=5;i++){
  current=`${page}-run${i}`; const start=total,beforeBlocked=blocked.length;const measuredKST=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',dateStyle:'short',timeStyle:'medium'}).format(new Date())+' KST';
  console.log('START',current,measuredKST);
  const command=`lighthouse ${url} --only-categories=performance --form-factor=mobile --screenEmulation.mobile=true --throttling-method=simulate --output=json --quiet --port=${port} --disable-full-page-screenshot --emulated-user-agent=${ua}`;
  const result=await lighthouse(url,{port,onlyCategories:['performance'],formFactor:'mobile',screenEmulation:{mobile:true,width:412,height:823,deviceScaleFactor:1.75,disabled:false},throttlingMethod:'simulate',emulatedUserAgent:ua,disableFullPageScreenshot:true,logLevel:'error'});
  if(!result?.lhr)throw Error('No LHR');
  const meta={measuredKST,tool:'Lighthouse',toolVersion:result.lhr.lighthouseVersion,node:process.version,npm:'10.9.8',chrome:browser.Browser,sampleSize:15,pageSampleSize:5,command,requestPolicy:'CDP Fetch Request interception, >=250ms between allowed requests; allow only HTTPS place.1989v.com/api.1989v.com; global <=2000',requestCount:total-start,blockedCount:blocked.length-beforeBlocked,rawBodyPreserved:true};
  await fs.writeFile(path.join(root,`${current}.json`),'{"_measurement":'+JSON.stringify(meta)+',\n'+JSON.stringify(result.lhr,null,2).slice(2));
  runs.push({run:current,...meta});
  console.log('DONE',current,'requests',total-start,'blocked',blocked.length-beforeBlocked,'score',result.lhr.categories.performance.score);
  await fs.writeFile(path.join(root,'request-log.json'),JSON.stringify({metadata:{measuredKST,toolVersion:result.lhr.lighthouseVersion,sampleSize:runs.length,command:'node lh/measure.mjs'},total,requests,blocked,runs},null,2));
  if(total>=2000)throw Error('Request budget reached');
  await new Promise(r=>setTimeout(r,10000));
 }
}finally{await chain;ws.close();}

```
