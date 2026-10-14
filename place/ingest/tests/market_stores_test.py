"""Offline source ingestion contracts; never calls a real provider/place/Redis."""
import csv
import io
import json
import zipfile
from pathlib import Path
from unittest.mock import Mock, patch

import pytest

from src import market_stores as ms, place_client

FIXTURE = json.loads((Path(__file__).parent/'fixtures/market-stores.json').read_text())


def test_gwangmyeong_six_roads_measured_radius_population():
    for name, values in FIXTURE['roads'].items():
        density = {name:(values['count'],values['share'])}
        assert ms.membership(FIXTURE['center'],FIXTURE['center'],300,name,density) == values['expected']


def test_density_is_computed_from_real_multirow_samples_and_deduplicates_merchants():
    samples = FIXTURE['densitySample']
    candidates = [(s['onnuri'],s['sangga']) for s in samples]
    population = [s['sangga'] for s in samples]
    densities = ms.road_density(candidates+candidates,population,FIXTURE['center'],300)
    assert densities['오리로964번길'] == (11,1.0)
    assert ms.membership(ms.coords(population[0]),FIXTURE['center'],300,'오리로964번길',densities) == 'IN'
    # Missing coordinates cannot add numerator or denominator; far away stores cannot inflate density.
    far = {**population[0],'상가업소번호':'far','위도':'33.2'}
    assert ms.road_density(candidates,population+[far],FIXTURE['center'],300) == densities


def test_unknown_radius_and_both_density_thresholds():
    center = FIXTURE['center']
    assert ms.membership(None,center,300,'r',{'r':(100,1)}) == 'UNKNOWN'
    assert ms.membership(center,None,300,'r',{'r':(100,1)}) == 'UNKNOWN'
    assert ms.membership((33,126),center,300,'r',{'r':(100,1)}) == 'OUT'
    assert ms.membership(center,center,300,'r',{'r':(10,1)}) == 'OUT'
    assert ms.membership(center,center,300,'r',{'r':(11,.29)}) == 'OUT'
    assert ms.membership(center,center,150,'r',{'r':(11,.30)}) == 'IN'


def test_match_order_same_dong_and_common_parcel_spatial_evidence(tmp_path):
    index = ms.SanggaIndex(tmp_path/'index.db')
    base = FIXTURE['samples'][0]['sangga']
    merchant = FIXTURE['samples'][0]['onnuri']
    # Use an exact, stable parcel address in the merchant for this isolated match-order contract.
    merchant = {**merchant,'점포명':base['상호명'],'주소':base['지번주소']}
    index.add(base)
    assert index.match(merchant) == base
    other = {**base,'상가업소번호':'other','상호명':'다른 임차인','층정보':'8'}
    index.add(other)
    assert index.match(merchant) == base  # exact parcel + name wins
    spatial = index.match({**merchant,'점포명':'미등록 임차인'})
    assert spatial['parcelCandidates'] == [base,other]
    assert not ms.sangga_row(spatial)['상가업소번호']
    assert '층정보' not in ms.sangga_row(spatial)
    assert ms.coords(ms.sangga_row(spatial)) == ms.coords(base)
    assert index.match({**merchant,'주소':'서울 중구 남창동 49'}) is None
    index.close()


def test_bulk_stream_filters_legal_dong_and_preserves_every_column(tmp_path):
    base = FIXTURE['samples'][0]['sangga']
    other = {**base,'상가업소번호':'excluded','지번주소':'서울 중구 남창동 49'}
    text = io.StringIO(); writer = csv.DictWriter(text,fieldnames=list(base));writer.writeheader();writer.writerows([base,other])
    path = tmp_path/'province.zip'
    with zipfile.ZipFile(path,'w') as z:
        z.writestr('경기.csv',text.getvalue().encode('utf-8-sig'))
    index = ms.SanggaIndex(tmp_path/'index.db')
    dong = ms.parcel(base['지번주소'])[0]
    assert ms.load_bulk(path,index,{dong}) == 1
    assert list(index.dong_rows({dong})) == [base]
    assert list(index.dong_rows({'서울중구남창동'})) == []
    index.close()


def test_onnuri_bom_header_and_raw_fields(tmp_path):
    row = FIXTURE['samples'][0]['onnuri'];path = tmp_path/'onnuri.csv'
    with path.open('w',encoding='utf-8-sig',newline='') as f:
        writer = csv.DictWriter(f,fieldnames=row);writer.writeheader();writer.writerow(row)
    assert list(ms.read_csv(path,['시장명','점포명','취급품목','주소'])) == [row]


def test_identify_requires_same_locality_and_preserves_standard_raw():
    standard = {'시장명':'광명시장','소재지지번주소':'경기도 광명시 광명동 158-100','시장유형':'건물형','점포수':'0042','위도':'37.48','경도':'126.85','그외원천':'보존'}
    attraction = {'contentId':'123','lang':'ko','status':'ACTIVE','title':'광명시장','address':'경기 광명시 광명동 1','latitude':37.4,'longitude':126.8}
    market = ms.identify([attraction],[standard])[0]
    assert market['marketInfoMatched'] and market['marketType'] == 'BUILDING'
    assert json.loads(market['sourceRaw']) == standard
    assert market['storeCountRaw'] == '0042'
    assert not ms.identify([{**attraction,'address':'서울 중구 남창동 49'}],[standard])[0]['marketInfoMatched']


def test_prepare_preserves_originals_unknown_and_building_floor_hierarchy(tmp_path):
    s = FIXTURE['samples'][0]['sangga']; o = FIXTURE['samples'][0]['onnuri']
    o = {**o,'점포명':s['상호명'],'주소':s['지번주소']}
    s = {**s,'건물명':'본관','동정보':'A','층정보':'2'}
    index = ms.SanggaIndex(tmp_path/'index.db');index.add(s)
    market = {'attractionContentId':'123','name':'광명시장','marketType':'BUILDING','latitude':37.48,'longitude':126.85}
    command = ms.prepare(market,[o],index,[s])
    assert len(command['stores']) == 1
    row = command['stores'][0]['row']
    assert json.loads(row['onnuriRaw']) == o and json.loads(row['sanggaRaw']) == s
    floor = next(z for z in command['zones'] if z['row']['kind']=='FLOOR')
    assert floor['parentKey'] in {z['row']['sourceKey'] for z in command['zones']}
    missing = {**o,'점포명':'x','주소':'없는동 1'}
    assert ms.prepare(market,[missing],index,[])['stores'][0]['row']['membership']['status'] == 'UNKNOWN'
    index.close()


def test_raw_service_key_pagination_and_polygon_operations():
    urls=[]
    def fetch(url):
        urls.append(url)
        page = 2 if 'pageNo=2' in url else 1
        return 200,json.dumps({'header':{'resultCode':'00'},'body':{'items':[{'bizesId':str(page),'bizesNm':'가게'}],'totalCount':1001}})
    ledger=Mock();ledger.try_acquire.return_value=True
    api=ms.StoreApi('key%2Bencoded%3D',fetch=fetch,ledger=ledger)
    market={'latitude':37.48,'longitude':126.85,'marketType':'STREET'}
    assert len(api.stores(market,[])) == 2
    assert all('serviceKey=key%2Bencoded%3D&' in u for u in urls)
    assert 'storeListInRadius' in urls[0] and 'radius=300' in urls[0]
    api.stores(market,['POLYGON((0 0,1 0,1 1,0 0))'])
    assert 'storeListInPolygon' in urls[-1]
    assert '&key=POLYGON' in urls[-1] and '&polygon=' not in urls[-1]
    assert api.calls == 4 and ledger.try_acquire.call_count == 4


def test_api_failures_are_counted_and_budget_is_hard():
    ledger=Mock();ledger.try_acquire.return_value=True
    api=ms.StoreApi('x',fetch=lambda _: (500,'failed'),ledger=ledger)
    with pytest.raises(ms.datagokr.DataGoKrError):api.page('storeListInRadius',{})
    assert (api.calls,api.failures)==(1,1)
    api.calls=ms.DAILY_API_BUDGET
    with pytest.raises(ms.datagokr.BudgetExhausted):api.page('storeListInRadius',{})
    assert api.calls == ms.DAILY_API_BUDGET


def test_preflight_failure_ratios():
    ms.check_failures(100,5,100,5)
    with pytest.raises(ValueError):ms.check_failures(100,6,100,0)
    with pytest.raises(ValueError):ms.check_failures(100,0,100,6)
    with pytest.raises(ValueError):ms.check_failures(0,0,0,0)


def test_run_market_failure_prevents_all_writes(tmp_path):
    o=FIXTURE['samples'][0]['onnuri']
    market={'attractionContentId':'123','name':'광명시장','marketType':'STREET','latitude':37.48,'longitude':126.85}
    with patch.object(ms,'download',return_value=tmp_path/'file'), \
         patch.object(ms,'read_csv',side_effect=[[{'시장명':'광명시장'}],[o]]), \
         patch.object(ms,'identify',return_value=[market]), \
         patch.object(ms,'load_bulk',return_value=1), \
         patch.object(place_client,'fetch_market_attractions',return_value=[]), \
         patch.object(place_client,'market_state',side_effect=RuntimeError('unavailable')), \
         patch.object(place_client,'put_market') as write:
        with pytest.raises(ValueError):ms.run('standard','onnuri','bulk','key')
        write.assert_not_called()


def test_client_request_shape():
    with patch.object(place_client,'_request',return_value={'data':{'marketId':1}}) as req:
        assert place_client.put_market({'market':{},'zones':[],'stores':[]}) == {'marketId':1}
        assert req.call_args.args[:2] == ('PUT','/internal/markets')


def test_legal_dong_parser_does_not_truncate_city_or_gu_names():
    assert ms.parcel('경기도 구리시 수택동 1') == ('경기구리시수택동','1')
    assert ms.parcel('서울 동대문구 장안동 12-3') == ('서울동대문구장안동','12-3')
    assert ms.parcel('서울 종로구 종로5가 395') == ('서울종로구종로5가','395')
    assert ms.parcel('강원특별자치도 평창군 봉평면 창동리 123') == ('강원평창군봉평면창동리','123')
    assert ms.parcel('서울 동대문구 장안동 1')[0] != ms.parcel('서울 동대문구 답십리동 1')[0]


def test_duplicate_standard_source_keys_fail_preflight():
    attraction = {'contentId':'1','lang':'ko','status':'ACTIVE','title':'시장','address':'경기 광명시 광명동 1'}
    standard = {'시장명':'시장','소재지지번주소':'경기 광명시 광명동 1'}
    with pytest.raises(ValueError,match='Duplicate standardized market'):
        ms.identify([attraction,{**attraction,'contentId':'2'}],[standard])
