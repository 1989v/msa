import unittest
from unittest.mock import patch
from src import cafe_stores as c

class CafeStoreTests(unittest.TestCase):
 def row(self,name='스타벅스',sid='real-1',code='I21201'):
  return dict(bizesId=sid,bizesNm=name,brchNm='강남점',indsSclsCd=code,lat='37.5',lon='127.0',signguCd='11680',rdnmAdr='서울',unknown={'preserve':True})
 def test_brand_aliases_and_collisions(self):
  for slug,(name,aliases) in c.BRANDS.items():
   for alias in aliases:
    with self.subTest(slug=slug,alias=alias): self.assertEqual((slug,'CONFIRMED'),c.mapping(self.row(alias+' 강남점')))
  for name in ('메가','컴포즈','메가마트','스타벅스인테리어','메가커피머신'):
   self.assertIsNone(c.mapping(self.row(name))[0])
  self.assertEqual(('starbucks','REVIEW'),c.mapping(self.row(code='OTHER')))
  self.assertEqual((None,'REVIEW'),c.mapping(self.row('스타벅스 투썸플레이스')))
  self.assertEqual(('starbucks','REVIEW'),c.mapping(self.row('스타벅스풍카페')))
  located=dict(self.row('메가엠지씨커피서대문경희궁'),brchNm='자이점')
  self.assertEqual(('mega','CONFIRMED'),c.mapping(located))
  self.assertEqual(('mega','REVIEW'),c.mapping(dict(located,brchNm=None)))
  self.assertEqual(('mega','REVIEW'),c.mapping(dict(located,bizesNm='메가커피바리스타학원',brchNm='본점')))
  self.assertEqual(('starbucks','REVIEW'),c.mapping(self.row('카페스타벅스풍')))
  self.assertEqual(('paulbassett','CONFIRMED'),c.mapping(dict(located,bizesNm='폴바셋구로G',brchNm='타워점')))
  self.assertEqual(('paulbassett','CONFIRMED'),c.mapping(self.row('엠즈씨드폴바셋MBC몰파크점')))
  self.assertEqual(('paulbassett','CONFIRMED'),c.mapping(self.row('폴바셋한국경제신문사점엠즈씨드')))
  self.assertEqual(('paulbassett','REVIEW'),c.mapping(dict(self.row('폴바셋GFC'),brchNm=None)))
  self.assertEqual('REVIEW',c.project(self.row('스타벅스 투썸플레이스'))['mappingStatus'])
 def test_raw_and_branch_preserved(self):
  raw=self.row(); p=c.project(raw)
  self.assertEqual(raw,p['raw']); self.assertEqual('강남점',p['branchName']);self.assertEqual('1168000000',p['areaCode'])
 def test_missing_key_normal_exit_no_write(self):
  with patch.dict('os.environ',{},clear=True): self.assertEqual(0,c.run(send=lambda *_: self.fail('must not publish')))
 def test_empty_partial_changed_and_budget_preserve_snapshot(self):
  for fetch in (lambda cat,page:(0,[]), lambda cat,page:(1001,[self.row()]),lambda cat,page:(2,[self.row(),self.row()])):
   self.assertEqual(1,c.run(fetch=fetch,send=lambda *_:self.fail('must not publish')))
  with self.assertRaises(RuntimeError): c.collect(lambda *_:(1,[self.row()]),budget=1)
 def test_complete_snapshot_only_one_write_and_unknown_date(self):
  calls=[]
  self.assertEqual(0,c.run(fetch=lambda cat,page:(1,[self.row(sid=cat)]),send=lambda path,body:calls.append(body)))
  self.assertEqual(1,len(calls));self.assertIsNone(calls[0]['sourceAsOf']);self.assertEqual(2,len(calls[0]['stores']))
 def test_normal_cli_uses_bundled_centers_without_areas_argument(self):
  calls=[]
  with patch.dict('os.environ',{'SOHO_API_KEY':'test-key'},clear=True), patch.object(c,'discover_categories',return_value=c.CATEGORIES), patch.object(c,'http_page',side_effect=lambda key,cat,page:(1,[self.row(sid=cat)])), patch.object(c.ranking_client,'_post',side_effect=lambda path,body:calls.append(body)):
   self.assertEqual(0,c.main([]))
  codes={a['code'] for a in calls[0]['areas']}
  self.assertEqual({'1100000000','1168000000'},codes)
 def test_verified_release_date_is_published_and_invalid_dates_do_not_write(self):
  calls=[]
  self.assertEqual(0,c.run(fetch=lambda cat,page:(1,[self.row(sid=cat)]),source_as_of='2026-10-01',send=lambda path,body:calls.append(body)))
  self.assertEqual('2026-10-01',calls[0]['sourceAsOf'])
  self.assertNotEqual(calls[0]['fetchedAt'][:10],calls[0]['sourceAsOf'])
  for source_date in ('2026-02-30','2099-01-01','not-a-date'):
   self.assertEqual(1,c.run(fetch=lambda cat,page:(1,[self.row(sid=cat)]),source_as_of=source_date,send=lambda *_:self.fail('invalid date must not publish')))
 def test_invalid_source_does_not_publish(self):
  with self.assertRaises(ValueError): c.project(self.row(sid='SAMPLE-1'))
  r=self.row();r['lat']='nan'
  with self.assertRaises(ValueError): c.project(r)

class OfficialAreaCentersTests(unittest.TestCase):
 def test_published_centers_codes_parents_and_multiple_provinces(self):
  import json
  from pathlib import Path
  areas=json.loads((Path(c.__file__).parent/'data'/'cafe_areas.json').read_text())
  by_code={row['code']:row for row in areas}
  self.assertGreater(len(areas),250)
  self.assertEqual('강남구',by_code['1168000000']['name'])
  self.assertEqual('제주시',by_code['5011000000']['name'])
  self.assertEqual('세종특별자치시',by_code['3611000000']['name'])
  self.assertEqual('5000000000',by_code['5011000000']['parentCode'])
  for row in areas:
   self.assertTrue(33<=row['latitude']<=39 and 124<=row['longitude']<=132)
   self.assertTrue(row['centerSource'].startswith('https://www.data.go.kr/'))
   if row['level']=='DISTRICT':
    self.assertTrue(row['code'].endswith('00000'));self.assertIn(row['parentCode'],by_code)
   else:self.assertTrue(row['code'].endswith('00000000'))
