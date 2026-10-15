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
    attraction = {'contentId':'123','lang':'ko','status':'ACTIVE','lclsSystm2':'SH06','title':'광명시장','address':'경기 광명시 광명동 1','latitude':37.4,'longitude':126.8}
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
         patch.object(ms,'load_good_prices',return_value=[good_price_row()]), \
         patch.object(place_client,'fetch_market_attractions',return_value=[]), \
         patch.object(place_client,'market_state',side_effect=RuntimeError('unavailable')), \
         patch.object(place_client,'put_market') as write:
        with pytest.raises(ValueError):ms.run('standard','onnuri','bulk','key',good_price_url='good')
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
    attraction = {'contentId':'1','lang':'ko','status':'ACTIVE','lclsSystm2':'SH06','title':'시장','address':'경기 광명시 광명동 1'}
    standard = {'시장명':'시장','소재지지번주소':'경기 광명시 광명동 1'}
    with pytest.raises(ValueError,match='Duplicate standardized market'):
        ms.identify([attraction,{**attraction,'contentId':'2'}],[standard])


def test_standard_api_mapping_all_pages_raw_key_and_unknown_fields():
    urls = []
    original = {'mrktNm':'광명시장','mrktType':'건물형','rdnmadr':'경기 광명시 광명로 1',
                'lnmadr':'경기 광명시 광명동 1','latitude':'37.48','longitude':'126.85',
                'storNumber':'0042','mrktEstblCycle':'상설','pblicToiletYn':'Y','unknown':{'keep':True}}
    def fetch(url):
        urls.append(url)
        row = original if len(urls) == 1 else {**original, 'mrktNm':'다른시장'}
        return 200, json.dumps({'response':{'header':{'resultCode':'00'},
            'body':{'items':[row], 'totalCount':1001}}})
    rows = ms.fetch_standards('key%2Bencoded%3D', fetch=fetch)
    assert len(rows) == 2 and rows[1]['시장명'] == '다른시장'
    assert all(u.startswith(ms.STANDARD_API_URL+'?serviceKey=key%2Bencoded%3D&') for u in urls)
    assert 'type=json' in urls[0] and 'numOfRows=1000' in urls[0] and 'pageNo=2' in urls[1]
    assert all(rows[0][field] == value for field, value in original.items())
    assert rows[0]['점포수'] == '0042' and rows[0]['개설주기'] == '상설'
    attraction = {'contentId':'1','lang':'ko','status':'ACTIVE','lclsSystm2':'SH06','title':'광명시장',
                  'address':'경기 광명시 광명동 1','latitude':37.4,'longitude':126.8}
    market = ms.identify([attraction],rows)[0]
    assert market['marketInfoMatched'] and market['latitude'] == 37.48
    assert json.loads(market['sourceRaw'])['unknown'] == {'keep':True}


@pytest.mark.parametrize('response', [
    json.dumps({'response':{'header':{'resultCode':'30','resultMsg':'SERVICE_KEY_IS_NOT_REGISTERED_ERROR'}}}),
    '<OpenAPI_ServiceResponse><cmmMsgHeader><returnReasonCode>30</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>',
])
def test_standard_api_error_30_aborts_before_place_writes(response, tmp_path):
    with patch.object(ms.datagokr,'_http_get',return_value=(200,response)), \
         patch.object(place_client,'put_market') as write, patch.object(ms,'download') as download:
        with pytest.raises(ms.datagokr.DataGoKrError):
            ms.run(None,'onnuri','bulk','key',standard_source='api',good_price_url='good')
        write.assert_not_called()
        download.assert_not_called()


def test_standard_file_mode_retains_csv_path(tmp_path):
    path = tmp_path/'standard.csv'
    path.write_text('시장명,새로운필드\n광명시장,보존\n',encoding='utf-8-sig')
    with patch.object(ms,'download',return_value=path) as download, patch.object(ms,'fetch_standards') as api:
        assert ms.load_standards('file','csv-url','key',tmp_path) == [{'시장명':'광명시장','새로운필드':'보존'}]
        assert download.call_args.args[0] == 'csv-url'
        api.assert_not_called()


def test_off_run_uses_attraction_and_reports_source_without_standard_download(tmp_path):
    o = FIXTURE['samples'][0]['onnuri']
    attraction = {'contentId':'1','lang':'ko','status':'ACTIVE','lclsSystm2':'SH06','title':o['시장명'],
                  'latitude':37.4,'longitude':126.8}
    api = Mock(calls=0,failures=0); api.stores.return_value = []
    with patch.object(ms,'download',return_value=tmp_path/'file') as download, \
         patch.object(ms,'read_csv',return_value=[o]), patch.object(ms,'load_bulk',return_value=1), \
         patch.object(ms,'load_good_prices',return_value=[good_price_row()]), \
         patch.object(ms,'fetch_standards') as standard_api, patch.object(ms,'StoreApi',return_value=api), \
         patch.object(place_client,'fetch_market_attractions',return_value=[attraction]), \
         patch.object(place_client,'market_state',return_value=None), patch.object(place_client,'put_market') as write:
        summary = ms.run(None,'onnuri','bulk','key',standard_source='off',good_price_url='good')
        assert summary['standardSource'] == 'off' and summary['markets'] == 1
        assert summary['goodPriceRows'] == 1
        assert summary['goodPriceMatched'] == {'NAME':0,'ROAD':0}
        assert summary['goodPriceAmbiguous'] == 0
        market = write.call_args.args[0]['market']
        assert market['name'] == attraction['title'] and market['latitude'] == attraction['latitude']
        assert market['longitude'] == attraction['longitude'] and market['marketInfoMatched'] is False
        assert [c.args[0] for c in download.call_args_list] == ['onnuri','bulk']
        standard_api.assert_not_called()


def test_empty_onnuri_still_fails_when_standard_source_off(tmp_path):
    with patch.object(ms,'download',return_value=tmp_path/'file'), patch.object(ms,'read_csv',return_value=[]), \
         patch.object(place_client,'put_market') as write:
        with pytest.raises(ValueError,match='Empty market source'):
            ms.run(None,'onnuri','bulk','key',standard_source='off',good_price_url='good')
        write.assert_not_called()


def test_invalid_standard_source_fails(tmp_path):
    with pytest.raises(ValueError,match='MARKET_STANDARD_SOURCE'):
        ms.load_standards('invalid',None,'key',tmp_path)


def test_market_attraction_requires_market_class_not_title():
    base = {'contentId':'1','lang':'ko','status':'ACTIVE','source':'TOURAPI'}
    assert place_client.is_market_attraction({**base,'title':'광장시장','lclsSystm2':'SH06'})
    assert place_client.is_market_attraction({**base,'title':'정선5일장','cat3':'A04010100'})
    assert not place_client.is_market_attraction({**base,'title':'MLB 명동점','lclsSystm2':'SH04'})
    assert not place_client.is_market_attraction({**base,'title':'다이소 제주동문시장점','lclsSystm2':'SH04'})
    assert not place_client.is_market_attraction({**base,'title':'시장 골목 여행기','lclsSystm2':'C0114'})
    assert not place_client.is_market_attraction({**base,'title':'광장시장','lclsSystm2':'SH06','source':'GOCAMPING'})
    attraction = {**base,'title':'다이소 제주동문시장점','lclsSystm2':'SH04','address':'제주 제주시 일도1동'}
    with pytest.raises(ValueError):
        ms.identify([attraction],[])


GOOD_PRICE_CSV = """시도,시군,업종,업소명,연락처,주소,메뉴1,가격1,메뉴2,가격2,메뉴3,가격3,메뉴4,가격4
서울특별시,마포구,한식,행복식당,,서울특별시 마포구 망원로8길 29,칼국수,5000,,,,,,
"""


def good_price_row(**changes):
    return {**next(csv.DictReader(io.StringIO(GOOD_PRICE_CSV))), **changes}


def good_price_store(name='행복식당', address='서울 마포구 망원로8길 29', **changes):
    return {'row': {'name': name, 'roadAddress': address, 'jibunAddress': None, **changes}}


def attach_prices(tmp_path, commands, rows=None):
    paths = []
    for i, stores in enumerate(commands):
        path = tmp_path/f'command-{i}.json'
        path.write_text(ms.raw({'stores': stores}))
        paths.append(path)
    summary = ms.attach_good_prices(paths, rows or [good_price_row()])
    return [json.loads(p.read_text())['stores'] for p in paths], summary


@pytest.mark.parametrize('encoding', ['utf-8-sig', 'cp949'])
def test_good_price_csv_encoding_and_original_empty_columns(tmp_path, encoding):
    path = tmp_path/'source.csv'
    path.write_bytes(GOOD_PRICE_CSV.encode(encoding))
    with patch.object(ms,'download',return_value=path) as download:
        rows = ms.load_good_prices('good-url', tmp_path)
    download.assert_called_once_with('good-url', ms.FILE_MAX_BYTES, tmp_path/'good-price.csv')
    assert rows == [good_price_row()]
    assert len(rows[0]) == 14 and rows[0]['연락처'] == '' and rows[0]['가격4'] == ''


def test_good_price_name_normalization_locality_and_raw(tmp_path):
    commands, summary = attach_prices(tmp_path, [[good_price_store('행복 식당!!')]])
    row = commands[0][0]['row']
    assert row['goodPriceMatchedBy'] == 'NAME'
    assert json.loads(row['goodPriceRaw']) == good_price_row()
    assert row['goodPriceKey'] == ms.key('서울특별시', '마포구', '행복식당', '서울특별시 마포구 망원로8길 29')
    assert summary == {'goodPriceRows':1, 'goodPriceMatched':{'NAME':1,'ROAD':0}, 'goodPriceAmbiguous':0}
    assert ms.good_price_name('Happy-식당 12!') == 'happy식당12'
    assert ms.good_price_locality('부산광역시 중구 중앙대로 1') == ms.good_price_locality('부산 중구 중앙대로 1')


@pytest.mark.parametrize('name', ['행복식당 본점', '행복'])
def test_good_price_road_containment_and_jibun_fallback(tmp_path, name):
    commands, summary = attach_prices(tmp_path, [[good_price_store(name, None, jibunAddress='서울 마포구 망원로8길 29')]])
    assert commands[0][0]['row']['goodPriceMatchedBy'] == 'ROAD'
    assert summary['goodPriceMatched'] == {'NAME':0,'ROAD':1}


@pytest.mark.parametrize('name,address', [
    ('행복', '서울 마포구 망원로8길 290'),
    ('행복', '서울 마포구 망원로8길 29-1'),
    ('행복식당', '서울 중구 망원로8길 29'),
    ('행', '서울 마포구 망원로8길 29'),
    ('다른식당', '서울 마포구 망원로8길 29'),
    ('!!!', '서울 마포구 망원로8길 29'),
])
def test_good_price_nonmatches_explicitly_clear_all_fields(tmp_path, name, address):
    commands, _ = attach_prices(tmp_path, [[good_price_store(name, address,
        goodPriceKey='old',goodPriceRaw='old',goodPriceMatchedBy='NAME')]])
    assert all(commands[0][0]['row'][field] is None for field in ('goodPriceKey','goodPriceRaw','goodPriceMatchedBy'))


def test_good_price_prefers_road_address_locality(tmp_path):
    commands, _ = attach_prices(tmp_path, [[good_price_store(address='서울 중구 다른로 1',
        jibunAddress='서울 마포구 망원로8길 29')]])
    assert commands[0][0]['row']['goodPriceKey'] is None


@pytest.mark.parametrize('name,rows', [
    ('행복식당', [good_price_row(), good_price_row(연락처='02-000-0000')]),
    ('행복', [good_price_row(), good_price_row(업소명='행복분식')]),
])
def test_good_price_ambiguous_candidates_are_not_attached(tmp_path, name, rows):
    commands, summary = attach_prices(tmp_path, [[good_price_store(name)]], rows)
    assert commands[0][0]['row']['goodPriceKey'] is None
    assert summary['goodPriceAmbiguous'] == 1
    assert summary['goodPriceMatched'] == {'NAME':0,'ROAD':0}


def test_good_price_global_name_precedence_and_unique_attachment(tmp_path):
    commands, summary = attach_prices(tmp_path, [
        [good_price_store('행복식당 본점')], [good_price_store()], [good_price_store()]])
    assert [c[0]['row']['goodPriceMatchedBy'] for c in commands] == [None, 'NAME', None]
    assert summary['goodPriceMatched'] == {'NAME':1,'ROAD':0}
    commands, summary = attach_prices(tmp_path, [
        [good_price_store('행복식당 본점')], [good_price_store('행복')]])
    assert [c[0]['row']['goodPriceMatchedBy'] for c in commands] == ['ROAD', None]
    assert summary['goodPriceMatched'] == {'NAME':0,'ROAD':1}


def test_good_price_contested_shop_goes_to_the_row_whose_category_agrees(tmp_path):
    butcher, kitchen = good_price_store(categoryMajor='소매'), good_price_store(categoryMajor='음식')
    commands, summary = attach_prices(tmp_path, [[butcher, kitchen]])
    assert [s['row']['goodPriceMatchedBy'] for s in commands[0]] == [None, 'NAME']
    assert summary['goodPriceMatched'] == {'NAME':1,'ROAD':0}
    salon = good_price_row(업종='미용업')
    commands, _ = attach_prices(tmp_path, [[good_price_store(categoryMajor='음식'),
                                            good_price_store(categoryMajor='수리·개인')]], [salon])
    assert [s['row']['goodPriceMatchedBy'] for s in commands[0]] == [None, 'NAME']
    commands, _ = attach_prices(tmp_path, [[good_price_store(categoryMajor='음식'), good_price_store()]])
    assert [s['row']['goodPriceMatchedBy'] for s in commands[0]] == ['NAME', None]


def test_prepare_unmatched_good_price_fields_are_null(tmp_path):
    index = ms.SanggaIndex(tmp_path/'index.db')
    try:
        command = ms.prepare({'attractionContentId':'1','name':'시장','marketType':'STREET'},
            [{'시장명':'시장','점포명':'상점','주소':'서울 마포구 망원동 1','취급품목':''}],index,[])
        assert all(command['stores'][0]['row'][field] is None
                   for field in ('goodPriceKey','goodPriceRaw','goodPriceMatchedBy'))
    finally:
        index.close()


def test_missing_good_price_url_fails_before_any_writes():
    with patch.object(place_client,'put_market') as write, patch.object(ms,'download') as download:
        with pytest.raises(ValueError,match='MARKET_GOOD_PRICE_FILE_URL'):
            ms.run(None,'onnuri','bulk','key',standard_source='off')
        write.assert_not_called()
        download.assert_not_called()


@pytest.mark.parametrize('failure', ['empty', 'download', 'header'])
def test_good_price_source_failure_aborts_before_writes(tmp_path, failure):
    path = tmp_path/'source.csv'
    path.write_text(','.join(ms.GOOD_PRICE_COLUMNS)+'\n' if failure == 'empty' else 'wrong\nvalue\n')
    def download(url, *args):
        if url == 'good' and failure == 'download':
            raise OSError('download failed')
        return path
    original_read = ms.read_csv
    def read_csv(path, required, **kwargs):
        if required == ['시장명','점포명','취급품목','주소']:
            return [FIXTURE['samples'][0]['onnuri']]
        return original_read(path, required, **kwargs)
    with patch.object(ms,'download',side_effect=download), patch.object(ms,'read_csv',side_effect=read_csv), \
         patch.object(place_client,'put_market') as write, patch.object(place_client,'fetch_market_attractions') as fetch:
        with pytest.raises((ValueError, OSError)):
            ms.run(None,'onnuri','bulk','key',standard_source='off',good_price_url='good')
        write.assert_not_called()
        fetch.assert_not_called()


def test_good_price_namesake_attaches_only_at_the_same_address(tmp_path):
    rows = [good_price_row(주소='서울 마포구 광정로 70'), good_price_row()]
    commands, summary = attach_prices(tmp_path, [[good_price_store()]], rows)
    assert ms.json.loads(commands[0][0]['row']['goodPriceRaw'])['주소'] == good_price_row()['주소']
    assert summary['goodPriceAmbiguous'] == 0


def test_good_price_branch_at_another_road_is_not_attached(tmp_path):
    commands, summary = attach_prices(tmp_path, [[good_price_store(address='서울 마포구 광정로 70')]])
    assert commands[0][0]['row']['goodPriceKey'] is None
    assert summary['goodPriceMatched'] == {'NAME':0,'ROAD':0}


def test_good_price_road_key_ignores_spacing_before_beongil():
    assert ms.good_price_road('대전 동구 중앙로 200번길 27') == ms.good_price_road('대전광역시 동구 중앙로200번길 27(중동)')


def test_good_price_lot_number_address_needs_the_same_dong(tmp_path):
    other = attach_prices(tmp_path, [[good_price_store(address='서울 마포구 합정동 1-2')]],
        [good_price_row(주소='서울특별시 마포구 망원로8길 29 (망원동)')])[0]
    same = attach_prices(tmp_path, [[good_price_store(address='서울 마포구 망원동 414-26')]],
        [good_price_row(주소='서울특별시 마포구 망원로8길 29 (망원동)')])[0]
    assert other[0][0]['row']['goodPriceKey'] is None
    assert same[0][0]['row']['goodPriceMatchedBy'] == 'NAME'


def test_good_price_exact_address_row_wins_over_lot_number_duplicate(tmp_path):
    rows = [good_price_row(주소='서울특별시 마포구 망원로8길 29 (망원동)')]
    commands, _ = attach_prices(tmp_path, [
        [good_price_store(address='서울 마포구 망원동 414-26')], [good_price_store()]], rows)
    assert [c[0]['row']['goodPriceMatchedBy'] for c in commands] == [None, 'NAME']
