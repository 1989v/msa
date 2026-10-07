# 측정 시각(KST): 2026-10-08T04:13:58.566663+09:00 | 도구: Python 3.14.6, stdlib HTMLParser/urllib | 표본: 상세 30개·허브 1개 | 명령: python3 docs/research/2026-10-07-tourism-growth/evidence/stage1/s1-6-measure.py

import urllib.request, urllib.error, xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
from datetime import datetime, timezone, timedelta
import json, re, random, time, sys, hashlib, subprocess
BASE=Path(__file__).parent
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
PATTERNS={x:re.compile(p) for x,p in [('&rsquo;',r'&rsquo;'),('&nbsp;',r'&nbsp;'),('&amp;',r'&amp;'),('&lt;',r'&lt;'),('&gt;',r'&gt;'),('<br',r'<br'),('&#숫자;',r'&#\d+;')]}
SEED=20261007
last=0;requests=[]
def now(): return datetime.now(timezone(timedelta(hours=9))).isoformat()
def get(url):
 global last
 assert url.startswith(('https://place.1989v.com/','https://api.1989v.com/'))
 time.sleep(max(0,.3-(time.monotonic()-last)));last=time.monotonic()
 t=now()
 try:
  with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':UA}),timeout=30) as r:
   body=r.read().decode('utf-8');status=r.status;final=r.url;headers=dict(r.headers)
  requests.append(dict(url=url,time=t,status=status,final_url=final,sha256=hashlib.sha256(body.encode()).hexdigest(),headers=headers))
  return body
 except Exception as e:
  requests.append(dict(url=url,time=t,error=str(e)));return None
def count(t):return {k:len(p.findall(t)) for k,p in PATTERNS.items()}
class Node:
 def __init__(self,tag,attrs,parent):
  self.tag=tag;self.attrs=dict(attrs);self.parent=parent;self.children=[]
 def text(self):return ''.join(c if isinstance(c,str) else c.text() for c in self.children)
 def selector(self):
  if self.tag=='document':return ''
  if 'id' in self.attrs:return '#'+self.attrs['id']
  siblings=[c for c in self.parent.children if isinstance(c,Node) and c.tag==self.tag]
  label=self.tag+':nth-of-type('+str(siblings.index(self)+1)+')'
  return (self.parent.selector()+' > '+label).lstrip(' >')
class Parser(HTMLParser):
 def __init__(self):
  super().__init__(convert_charrefs=True);self.root=Node('document',[],None);self.stack=[self.root];self.nodes=[]
 def handle_starttag(self,tag,attrs):
  n=Node(tag,attrs,self.stack[-1]);self.stack[-1].children.append(n);self.nodes.append(n)
  if tag not in {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}:self.stack.append(n)
 def handle_startendtag(self,tag,attrs):self.handle_starttag(tag,attrs);self.handle_endtag(tag)
 def handle_endtag(self,tag):
  for i in range(len(self.stack)-1,0,-1):
   if self.stack[i].tag==tag:self.stack=self.stack[:i];break
 def handle_data(self,data):self.stack[-1].children.append(data)
 def observations(self):
  out=[]
  for n in self.nodes:
   ancestors=[];p=n
   while p:ancestors.append(p);p=p.parent
   if not any(p.tag=='body' for p in ancestors) or any(p.tag in {'script','style','template','noscript'} or 'hidden' in p.attrs or p.attrs.get('aria-hidden')=='true' for p in ancestors):continue
   for child in n.children:
    if not isinstance(child,str):continue
    counts=count(child)
    if sum(counts.values()):
     section='개요/상단 본문'
     heading=''
     for prev in self.nodes[:self.nodes.index(n)]:
      if prev.tag=='h2':heading=prev.text()
     if heading:section=heading
     if n.tag=='dd':section='이용안내/'+heading
     if any('place-card' in p.attrs.get('class','') for p in ancestors):section='카드'
     examples=[]
     for name,pat in PATTERNS.items():
      for m in pat.finditer(child):examples.append(dict(pattern=name,excerpt=child[max(0,m.start()-55):min(len(child),m.end()+95)]))
     out.append(dict(selector=n.selector(),section=section,text=child,counts=counts,examples=examples))
  return out
fields=['title','titleLocal','address','tel','overview','useTime','restDate','useFee','parking','parkingFee','infoCenter']
def api_observations(data):
 out=[]
 def scan(path,value):
  if isinstance(value,str):
   c=count(value)
   if sum(c.values()):out.append(dict(field=path,text=value,counts=c))
  elif isinstance(value,dict):
   for k,v in value.items():scan(path+'.'+k,v)
  elif isinstance(value,list):
   for i,v in enumerate(value):scan(path+'['+str(i)+']',v)
 for k in fields:scan(k,data.get(k))
 raw=data.get('introRaw')
 if raw:
  try:scan('introRaw',json.loads(raw) if isinstance(raw,str) else raw)
  except ValueError:scan('introRaw[JSON파싱실패]',raw)
 return out
def totals(obs):return {k:sum(o['counts'][k] for o in obs) for k in PATTERNS}
index_url='https://place.1989v.com/sitemap.xml'
index=get(index_url);sources=[];urls=[]
for loc in ET.fromstring(index).findall('.//{*}loc'):
 body=get(loc.text)
 if not body:continue
 allurls=[x.text for x in ET.fromstring(body).findall('.//{*}loc')]
 en=[u for u in allurls if re.fullmatch(r'https://place\.1989v\.com/en/attractions/\d+',u)]
 sources.append(dict(url=loc.text,total=len(allurls),en=len(en),sha256=hashlib.sha256(body.encode()).hexdigest()))
 urls.extend(en)
urls=list(dict.fromkeys(urls));rng=random.Random(SEED);samples=[]
for b in range(30):
 lo=b*len(urls)//30;hi=(b+1)*len(urls)//30
 i=0 if b==0 else len(urls)-1 if b==29 else rng.randrange(lo,hi)
 samples.append(dict(bin=b+1,index=i+1,url=urls[i],id=urls[i].rsplit('/',1)[1]))
rows=[]
for s in samples:
 html=get(s['url']);apiurl='https://api.1989v.com/api/search/attractions/'+s['id'];apiraw=get(apiurl)
 row=dict(s,api_url=apiurl,html=html,api_raw=apiraw)
 if html:
  p=Parser();p.feed(html);p.close();row['ui_hits']=p.observations();row['ui_counts']=totals(row['ui_hits'])
  row['h1']=[n.text() for n in p.nodes if n.tag=='h1'];row['script_src']=[n.attrs.get('src') for n in p.nodes if n.tag=='script' and 'src' in n.attrs]
 if apiraw:
  a=json.loads(apiraw);d=a.get('data',{});row['api_success']=a.get('success');row['api_lang']=d.get('lang');row['api_id']=d.get('id');row['api_hits']=api_observations(d);row['api_counts']=totals(row['api_hits']);row['overview_counts']=count(d.get('overview') or '')
 rows.append(row);print(s['bin'],s['id'],'UI',sum(row.get('ui_counts',{}).values()),'API',sum(row.get('api_counts',{}).values()),flush=True)
hub=get('https://place.1989v.com/en');p=Parser();p.feed(hub or '');p.close()
result=dict(metadata=dict(start=requests[0]['time'],end=now(),python=sys.version,seed=SEED,command='python3 '+str(Path(__file__)),ua=UA,request_interval_seconds=.3,request_count=len(requests),origin_main=subprocess.check_output(['git','rev-parse','origin/main'],text=True).strip(),api_fields=fields+['introRaw.*']),sitemaps=sources,population=urls,samples=samples,rows=rows,requests=requests,hub=dict(html=hub,hits=p.observations(),cards=sum('place-card' in n.attrs.get('class','').split() for n in p.nodes),not_closed_today='Not closed today' in (hub or ''),script_src=[n.attrs.get('src') for n in p.nodes if n.tag=='script' and 'src' in n.attrs]))
path=BASE/'s1-6-measurement.jsonl'
with path.open('x') as f:
 f.write('# 측정 시각(KST): '+result['metadata']['start']+' ~ '+result['metadata']['end']+' | 도구: Python '+sys.version.split()[0]+', stdlib HTMLParser/urllib | 표본: 상세 30개·허브 1개 | 명령: '+result['metadata']['command']+'\n')
 f.write(json.dumps(result,ensure_ascii=False)+'\n')
print('saved',path,'requests',len(requests))
