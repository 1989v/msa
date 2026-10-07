# 측정 시각(KST): 2026-10-08T04:17:27.363589+09:00 | 도구: Python 3.14.6 | 표본: 재시도 HTML 2건·API 3건 | 명령: python3 docs/research/2026-10-07-tourism-growth/evidence/stage1/s1-6-retry.py

from pathlib import Path
import json,sys
BASE=Path(__file__).parent
scope={'__file__':str(BASE/'s1-6-measure.py')}
exec((BASE/'s1-6-measure.py').read_text().split("index_url='https://place.1989v.com/sitemap.xml'")[0],scope)
d=json.loads((BASE/'s1-6-measurement.jsonl').read_text().split('\n',1)[1]);updated=[]
for old in d['rows']:
 row=dict(old)
 for field,url in [('html',row['url']),('api_raw',row['api_url'])]:
  if row.get(field):continue
  for attempt in range(3):
   body=scope['get'](url)
   if body:row[field]=body;break
  print('retry',row['id'],field,bool(row.get(field)),flush=True)
 if row!=old:updated.append(row)
meta={'start':scope['requests'][0]['time'],'end':scope['now'](),'command':'python3 '+str(Path(__file__)),'python':sys.version,'requests':scope['requests']}
with (BASE/'s1-6-retry.jsonl').open('x') as f:
 f.write('# 측정 시각(KST): '+meta['start']+' ~ '+meta['end']+' | 도구: Python '+sys.version.split()[0]+', urllib | 표본: 실패한 상세 HTML 2건·API 3건(동일 id 재시도) | 명령: '+meta['command']+'\n')
 f.write(json.dumps(dict(metadata=meta,updated_rows=updated),ensure_ascii=False)+'\n')
print('retry requests',len(scope['requests']))
