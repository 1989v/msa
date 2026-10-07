# 측정 준비 시각(KST): 2026-10-08T04:13:23.421384+09:00 | 도구: Python 3.14.6 urllib.request | 표본: en 300 + ko 300 예정 | 명령: python3 docs/research/2026-10-07-tourism-growth/evidence/stage1/s1-8-collect.py
import urllib.request,urllib.parse,xml.etree.ElementTree as ET,json,random,re,time,threading,concurrent.futures,hashlib,sys,math,unicodedata,datetime
from pathlib import Path
BASE=Path(__file__).parent
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
KST=datetime.timezone(datetime.timedelta(hours=9))
started=datetime.datetime.now(KST).isoformat();lock=threading.Lock();last=0;logs=[];count=0
SEED=20261007
fields=['id','contentId','lang','title','titleLocal','address','latitude','longitude','category','contentTypeId','googlePlaceId','overview','status','samePlace']
def fetch(url,xml=False):
 global last,count
 with lock:
  time.sleep(max(0,.27-(time.monotonic()-last)));last=time.monotonic();count+=1
  if count>1850:raise RuntimeError('request budget exceeded')
  seq=count
 t=datetime.datetime.now(KST).isoformat()
 try:
  with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':UA}),timeout=25) as r:
   b=r.read();entry={'sequence':seq,'time_kst':t,'url':url,'status':r.status,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'cache_control':r.headers.get('Cache-Control')}
  obj=ET.fromstring(b) if xml else json.loads(b)
  with lock:logs.append(entry)
  return obj
 except Exception as e:
  with lock:logs.append({'sequence':seq,'time_kst':t,'url':url,'error':str(e)})
  return None

def cut(d):
 if not isinstance(d,dict):return None
 return {**{k:d.get(k) for k in fields},'_googlePlaceId_field_present':'googlePlaceId' in d,'_response_keys':sorted(d)}
root=fetch('https://place.1989v.com/sitemap.xml',True);maps=[];pool={'ko':set(),'en':set()}
for loc in root.findall('.//{*}loc'):
 u=loc.text;doc=fetch(u,True);urls=[x.text for x in doc.findall('.//{*}loc')];detail=[]
 for x in urls:
  m=re.fullmatch(r'https://place\.1989v\.com/(en/)?attractions/(\d+)',x)
  if m:pool['en' if m[1] else 'ko'].add(x);detail.append(x)
 maps.append({'url':u,'loc_count':len(urls),'detail_count':len(detail),'sha256':next(x['sha256'] for x in logs if x['url']==u)})
selected={lang:random.Random(SEED).sample(sorted(urls),300) for lang,urls in pool.items()}
print('population', {k:len(v) for k,v in pool.items()},flush=True)
def detail(u):
 d=fetch('https://api.1989v.com/api/search/attractions/'+u.rsplit('/',1)[1]);return {'page_url':u,'document':cut(d.get('data')) if d else None}
samples={}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
 for lang in ['en','ko']:
  samples[lang]=list(ex.map(detail,selected[lang]));print('sample complete',lang,len(samples[lang]),flush=True)
def search(row):
 d=row['document'];title=d.get('titleLocal') if d else None
 out={'en_url':row['page_url'],'en':d,'query':title,'q_candidates':[],'keyword_candidates':[]}
 if not title or not title.strip():out['skipped']='titleLocal blank';return out
 for param in ['q','keyword']:
  u='https://api.1989v.com/api/search/attractions?'+urllib.parse.urlencode({'lang':'ko',param:title,'size':5});res=fetch(u)
  data=res.get('data',{}) if res else {};out[param+'_url']=u;out[param+'_totalElements']=data.get('totalElements');out[param+'_candidates']=[cut(x) for x in data.get('attractions',[])];out[param+'_success']=res.get('success') if res else False
 return out
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:pairs=list(ex.map(search,samples['en']))
def norm(s):return re.sub(r'\s+','',unicodedata.normalize('NFKC',s or '')).casefold()
def distance(a,b):
 try:
  lat1,lon1,lat2,lon2=map(math.radians,[float(a['latitude']),float(a['longitude']),float(b['latitude']),float(b['longitude'])]);h=math.sin((lat2-lat1)/2)**2+math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2;return 6371008.8*2*math.asin(min(1,math.sqrt(h)))
 except (KeyError,TypeError,ValueError):return None
for p in pairs:
 for param in ['q','keyword']:
  for c in p[param+'_candidates']:
   d=p['en'];dist=distance(d,c);c['page_url']='https://place.1989v.com/attractions/'+str(c['id']);c['distance_m']=dist;c['matches']={'place_id':bool(d.get('googlePlaceId')) and d.get('googlePlaceId')==c.get('googlePlaceId'),'within_50m':dist is not None and dist<=50,'title':bool(norm(d.get('titleLocal'))) and norm(d.get('titleLocal'))==norm(c.get('title')),'category':bool(d.get('category')) and d.get('category')==c.get('category')};c['pair_candidate']=any(c['matches'][k] for k in ['place_id','within_50m','title']);c['strict_candidate']=all(c['matches'][k] for k in ['place_id','within_50m','title','category'])
obj={'_measurement':{'time_kst':started,'finished_kst':datetime.datetime.now(KST).isoformat(),'tool':'Python '+sys.version.split()[0]+' urllib.request stdlib','sample_size':{'en':300,'ko':300},'command':'python3 docs/research/2026-10-07-tourism-growth/evidence/stage1/s1-8-collect.py','seed':SEED,'requests_this_command':count,'requests_before_command':11,'request_interval_seconds':.27,'user_agent':UA},'sitemaps':maps,'population_size':{k:len(v) for k,v in pool.items()},'population_urls':{k:sorted(v) for k,v in pool.items()},'samples':samples,'pairs':pairs,'request_log':sorted(logs,key=lambda x:x['sequence'])}
p=BASE/'s1-8-place-id-pairs-raw.json'
with p.open('x') as f:
 f.write('{"_measurement":'+json.dumps(obj.pop('_measurement'),ensure_ascii=False)+',\n');f.write(json.dumps(obj,ensure_ascii=False,indent=2)[1:])
print('saved',p,'requests',count,flush=True)
