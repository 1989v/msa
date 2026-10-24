"""Nationwide SOHO public-store batch. Never called by nearby requests.

Official contract: https://www.data.go.kr/data/15012005/openapi.do
All raw fields remain in raw; mapping is a separately versioned projection.
No fixture fallback and no partial write, including an exhausted call budget.
"""
from __future__ import annotations
import argparse
from datetime import date, datetime, timezone
import json
import math
import os
from pathlib import Path
import re
import unicodedata
from urllib.parse import urlencode, quote, unquote
from urllib.request import urlopen
from src import ranking_client

RULE_VERSION = 'cafe-alias-v3'
BASE = 'https://apis.data.go.kr/B553077/api/open/sdsc2'
# Nationwide category pagination includes bakery/donut stores. Official KSIC retail classes.
CATEGORIES = ('I21201', 'I21001')  # coffee shops / bakeries (2023 classification)
BRANDS = {
 'starbucks': ('스타벅스', ('스타벅스', 'starbucks')),
 'twosome': ('투썸플레이스', ('투썸플레이스', 'atwosomeplace', 'twosomeplace')),
 'ediya': ('이디야', ('이디야커피', '이디야', 'ediya')),
 'mega': ('메가MGC커피', ('메가mgc커피', '메가엠지씨커피', '메가커피', 'megacoffee', 'megamgccoffee')),
 'compose': ('컴포즈커피', ('컴포즈커피', 'composecoffee')),
 'paik': ('빽다방', ('빽다방', 'paikdabang')),
 'theventi': ('더벤티', ('더벤티', 'theventi')),
 'dunkin': ('던킨', ('던킨도너츠', '던킨', 'dunkindonuts', 'dunkin')),
 'parisbaguette': ('파리바게뜨', ('파리바게뜨', '파리바게트', 'parisbaguette')),
 'gongcha': ('공차', ('공차', 'gongcha')),
 'paulbassett': ('폴바셋', ('폴바셋', '바리스타폴바셋', 'paulbassett')),
 'hollys': ('할리스', ('할리스커피', '할리스', 'hollyscoffee', 'hollys')),
 'pascucci': ('파스쿠찌', ('카페파스쿠찌', '파스쿠찌', 'caffepascucci', 'pascucci')),
 'uzi': ('우지커피', ('우지커피', 'oozycoffee')),
 'mammoth': ('매머드커피', ('매머드커피', 'mammothcoffee')),
 'mammothexpress': ('매머드익스프레스', ('매머드익스프레스', 'mammothexpress')),
 'coffeebean': ('커피빈', ('커피빈', 'coffeebean')),
 'dalkomm': ('달콤커피', ('달콤커피', 'dalkommcoffee', 'dalkomm')),
 'coffeebanhada': ('커피에반하다', ('커피에반하다', 'coffeebanhada')),
 'yogerpresso': ('요거프레소', ('요거프레소', 'yogerpresso')),
 'coffeebay': ('커피베이', ('커피베이', 'coffeebay')),
}
# Explicit collisions, affiliates and businesses that are not the target brand.
EXCLUDE = ('스타벅스인테리어', '메가커피머신', '메가커피아카데미', '이디야커피랩교육', '파리바게뜨물류', '던킨물류')
# Operating-company names registered next to the trade name (엠즈씨드폴바셋MBC몰파크점).
OPERATORS = ('엠즈씨드',)

def normalize(value):
 return re.sub(r'[\s·._()\-]', '', unicodedata.normalize('NFKC', str(value or '')).casefold())

def mapping(row, categories=CATEGORIES):
 name = normalize(row.get('bizesNm'))
 if any(normalize(value) in name for value in EXCLUDE): return None, 'UNMAPPED'
 for operator in OPERATORS: name = name.replace(normalize(operator), '')
 mentions = [slug for slug, (_, aliases) in BRANDS.items() if any(normalize(alias) in name for alias in aliases)]
 if len(mentions) != 1: return None, 'REVIEW' if mentions else 'UNMAPPED'
 slug = mentions[0]
 aliases = [normalize(alias) for alias in BRANDS[slug][1] if name.startswith(normalize(alias))]
 if not aliases: return slug, 'REVIEW'  # corporate prefix / uncertain trade-name form
 alias = max(aliases, key=len)
 suffix = name[len(alias):]
 branch = normalize(row.get('brchNm'))
 suspicious = any(word in suffix for word in ('풍카페','스타일','컨셉','머신','인테리어','물류','학원','아카데미','교육','유통','용품'))
 # 상가정보는 상호에 지역명을 붙이고 지점명을 따로 두는 일이 흔하다(메가엠지씨커피서대문경희궁 / 자이점).
 located = branch.endswith('점') and re.fullmatch(r'[가-힣0-9a-z]{1,12}', suffix) is not None
 approved_suffix = not suffix or suffix == branch or suffix.endswith(('점','dt','d/t')) or located
 code = str(row.get('indsSclsCd') or '')
 return slug, 'CONFIRMED' if code in categories and approved_suffix and not suspicious else 'REVIEW'

def project(row, categories=CATEGORIES):
 slug, status = mapping(row, categories)
 if slug is None and status != 'REVIEW': return None
 lat, lng = float(row['lat']), float(row['lon'])
 if not (math.isfinite(lat) and math.isfinite(lng) and 33 <= lat <= 39 and 124 <= lng <= 132):
  raise ValueError('Source store coordinates invalid')
 sid = str(row.get('bizesId') or '')
 if not sid or sid.startswith('SAMPLE'): raise ValueError('Source store key invalid')
 district = str(row.get('signguCd') or '')
 return dict(storeKey=sid, brandSlug=slug, brandName=BRANDS[slug][0] if slug else None, storeName=row.get('bizesNm') or '',
  branchName=row.get('brchNm') or None, address=row.get('rdnmAdr') or row.get('lnoAdr') or '',
  latitude=lat, longitude=lng, areaCode=district+'00000' if len(district)==5 else None,
  mappingStatus=status, raw=dict(row))

def http_page(key, category, page):
 # Accept either portal encoding or decoding key exactly once. Never log URL/key/error body.
 params = urlencode(dict(divId='indsSclsCd', key=category, numOfRows=1000, pageNo=page, type='json'))
 url = f'{BASE}/storeListInUpjong?serviceKey={quote(unquote(key), safe="")}&{params}'
 try:
  with urlopen(url, timeout=45) as response: payload = json.load(response)
 except Exception:
  raise RuntimeError('SOHO transport/auth/quota failure; no snapshot published') from None
 envelope = payload.get('response', payload)
 header = envelope.get('header', {})
 if str(header.get('resultCode', '')) not in ('00', '0', '0000'):
  raise RuntimeError('SOHO response rejected; no snapshot published')
 body = envelope.get('body', {})
 raw = body.get('items', [])
 if isinstance(raw, dict): raw = raw.get('item', [])
 if isinstance(raw, dict): raw = [raw]
 return int(body['totalCount']), raw or []

def discover_categories(key):
 params = urlencode(dict(indsLclsCd='I2',type='json'))
 url = f'{BASE}/smallUpjongList?serviceKey={quote(unquote(key), safe="")}&{params}'
 try:
  with urlopen(url,timeout=45) as response: payload=json.load(response)
  envelope=payload.get('response',payload)
  if str(envelope.get('header',{}).get('resultCode','')) not in ('00','0','0000'): raise ValueError()
  rows=envelope['body']['items']
  if isinstance(rows,dict): rows=rows.get('item',[])
  if isinstance(rows,dict): rows=[rows]
  coffee=[str(r['indsSclsCd']) for r in rows if re.search('커피|카페',str(r.get('indsSclsNm','')))]
  bakery=[str(r['indsSclsCd']) for r in rows if re.search('제과|빵|도넛|베이커',str(r.get('indsSclsNm','')))]
  if not coffee or not bakery: raise ValueError()
  return tuple(sorted(set(coffee+bakery)))
 except Exception: raise RuntimeError('SOHO taxonomy unavailable; no snapshot published') from None

def collect(fetch, budget=1000, categories=CATEGORIES):
 calls = 0; records = {}; totals = 0
 for category in categories:
  page = 1; expected = None; category_rows = set()
  while True:
   calls += 1
   if calls > budget: raise RuntimeError('SOHO batch call budget exhausted; no snapshot published')
   total, rows = fetch(category, page)
   if total <= 0 or (expected is not None and total != expected): raise ValueError('Empty or changing source count')
   expected = total
   expected_size = min(1000, total - (page-1)*1000)
   if len(rows) != expected_size: raise ValueError('Incomplete source page')
   for row in rows:
    sid = str(row.get('bizesId') or '')
    if not sid or sid in category_rows: raise ValueError('Missing or duplicate source key')
    category_rows.add(sid)
    projected = project(row, categories)
    if projected is not None: records[sid] = projected
   if page*1000 >= total: break
   page += 1
  if len(category_rows) != expected: raise ValueError('Source total mismatch')
  totals += expected
 projected = list(records.values())
 if not projected: raise ValueError('No target stores; preserving previous snapshot')
 return projected, totals

def run(fetch=None, send=None, areas=None, source_as_of=None):
 key = os.environ.get('SOHO_API_KEY') or os.environ.get('DATA_GO_KR_KEY')
 if not key and fetch is None:
  print('[RANKING] Cafe stores not enabled: SOHO_API_KEY required; apply https://www.data.go.kr/data/15012005/openapi.do')
  return 0
 try:
  # SOHO storeListInUpjong exposes no dataset-as-of field in its published schema.
  # Accept the operator's verified source release date explicitly; never use fetchedAt
  # or the area's unrelated center-source date as a substitute.
  source_date = date.fromisoformat(source_as_of) if source_as_of else None
  if source_date and source_date > datetime.now(timezone.utc).date():
   raise ValueError('Future source date')
  categories = CATEGORIES if fetch else discover_categories(key)
  stores, total = collect(fetch or (lambda category,page: http_page(key,category,page)), budget=999, categories=categories)
  if areas is None:
   areas = json.loads((Path(__file__).parent / 'data' / 'cafe_areas.json').read_text())
  # Only show regions whose code actually occurs in this SOHO snapshot. Source vintages may differ.
  covered = {store['areaCode'] for store in stores}
  districts = [a for a in areas if a['level'] == 'DISTRICT' and a['code'] in covered]
  parents = {a['parentCode'] for a in districts}
  areas = [a for a in areas if a['level'] == 'PROVINCE' and a['code'] in parents] + districts
  now = datetime.now(timezone.utc).isoformat()
  snapshot = dict(version=now.replace(':','-').replace('+','-'), complete=True, sourceAsOf=source_date.isoformat() if source_date else None,
   fetchedAt=now, mappingRuleVersion=RULE_VERSION, sourceTotal=total, receivedTotal=total,
   stores=stores, areas=areas or [])
  (send or ranking_client._post)('/internal/ranking/cafe/stores/bulk', snapshot)
 except Exception:
  # urllib exceptions can include authentication URL: keep exception details out of batch logs.
  print('[RANKING] Cafe store batch rejected; previous complete snapshot retained')
  return 1
 print(f'[RANKING] Cafe store snapshot published: {len(stores)} candidates, {total} source rows')
 return 0

def main(argv=None):
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--areas', type=Path, help='Reviewed official legal-area codes and center-source manifest, never inferred store centroid')
 parser.add_argument('--source-as-of', help='Verified SOHO dataset release date (YYYY-MM-DD), never the collection date')
 args=parser.parse_args(argv)
 return run(areas=json.loads(args.areas.read_text()) if args.areas else None, source_as_of=args.source_as_of or os.environ.get('SOHO_SOURCE_AS_OF'))

if __name__ == '__main__':
 raise SystemExit(main())
