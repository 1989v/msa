import { CafeSources } from './CafeSources';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCafeAreas, searchCafeNearby } from '../../api/rankingApi';
import type { CafeFilters, CafeLocation, CafeNearbyResult } from '../../api/rankingApi';
import { googleMapsDirectionsUrl } from '../place/googleMaps';
import { cafeMetric, metricNames } from './cafeView';

const CafeNearbyMap = lazy(() => import('./CafeNearbyMap'));

export default function CafeNearby({ filters, drinkName, close, initialSelection }: { filters: CafeFilters; drinkName?: string; close: () => void; initialSelection?: Record<string, string> }) {
  const [position, setPosition] = useState<CafeLocation | null>(null);
  const [message, setMessage] = useState('');
  const [locating, setLocating] = useState(false);
  const [province, setProvince] = useState('');
  const [radiusKm, setRadius] = useState(1);
  const [sort, setSort] = useState('distance');
  const [selected, setSelected] = useState<Record<string, string>>(initialSelection ?? {});
  const [page, setPage] = useState(0);
  const [map, setMap] = useState(false);
  const [result, setResult] = useState<CafeNearbyResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const alive = useRef(true);
  const locationGeneration = useRef(0);
  const requestAbort = useRef<AbortController | null>(null);
  const provinces = useQuery({ queryKey: ['cafe', 'areas'], queryFn: () => fetchCafeAreas(), staleTime: 300000 });
  const districts = useQuery({ queryKey: ['cafe', 'areas', province], queryFn: () => fetchCafeAreas(province), enabled: !!province, staleTime: 300000 });
  useEffect(() => { alive.current = true; return () => { alive.current = false; locationGeneration.current++; }; }, []);
  const clearPosition = () => { locationGeneration.current++; requestAbort.current?.abort(); setLocating(false); setPosition(null); setResult(null); setPending(false); setError(false); };
  const locate = () => {
    const generation = ++locationGeneration.current;
    if (!navigator.geolocation) { setMessage('이 환경에서는 위치를 사용할 수 없습니다. 지역을 선택해 주세요.'); return; }
    setLocating(true); setMessage('');
    navigator.geolocation.getCurrentPosition(value => {
      if (!alive.current || generation !== locationGeneration.current) return;
      setLocating(false); setPage(0); setPosition({ kind: 'CURRENT', lat: value.coords.latitude, lng: value.coords.longitude });
      if (value.coords.accuracy > 1000) setMessage('위치가 넓게 추정되었습니다. 지역 선택을 권합니다.');
    }, failure => {
      if (!alive.current || generation !== locationGeneration.current) return;
      setLocating(false); setMessage(failure.code === 1 ? '위치 권한이 거부되었습니다. 지역을 선택해 주세요.' : failure.code === 3 ? '위치 확인 시간이 초과되었습니다. 지역을 선택해 주세요.' : '위치를 확인하지 못했습니다. 지역을 선택해 주세요.');
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
  };
  useEffect(() => {
    const discard = () => { locationGeneration.current++; requestAbort.current?.abort(); setPosition(null); setResult(null); setPending(false); setError(false); };
    window.addEventListener('pagehide', discard);
    return () => window.removeEventListener('pagehide', discard);
  }, []);
  useEffect(() => {
    if (!position || (!filters.group && !filters.q && !drinkName)) return;
    const abort = new AbortController();
    requestAbort.current = abort;
    setPending(true); setError(false); setResult(null);
    void searchCafeNearby({ location: position, radiusKm, group: filters.group, q: filters.q, drinkName,
      brands: filters.brand ?? [], temperature: filters.temperature, caffeineStatus: filters.caffeineStatus ?? [], caffeine: filters.caffeine,
      maxSugar: filters.maxSugar, maxCaffeine: filters.maxCaffeine, basis: filters.basis ?? 'serving', sort, direction: filters.direction ?? 'asc',
      selectedDrinkKeys: Object.values(selected), page, size: 20,
    }, abort.signal).then(data => { if (!abort.signal.aborted) setResult(data); }).catch(() => { if (!abort.signal.aborted) setError(true); }).finally(() => { if (!abort.signal.aborted) setPending(false); });
    return () => abort.abort();
  }, [position, radiusKm, filters, drinkName, sort, selected, page]);
  const selectedArea = position?.kind === 'AREA' ? districts.data?.find(area => area.code === position.areaCode) : undefined;
  return <section className="cafe-nearby-panel" aria-labelledby="cafe-nearby-title">
    <header><h2 id="cafe-nearby-title">주변 카페에서 음료 찾기</h2><button type="button" onClick={() => { clearPosition(); close(); }}>전국 음료 비교로 돌아가기</button></header>
    <p>현재 위치는 한 번만 사용하며 저장하지 않습니다. 매장까지의 직선거리이며 도보시간이 아닙니다. 지도는 공개 매장 위치만 표시합니다. 매장별 판매 여부는 확인되지 않았습니다.</p>
    <button type="button" onClick={locate} disabled={locating}>{locating ? '위치 확인 중…' : '현재 위치 사용'}</button>{locating && <button type="button" onClick={clearPosition}>위치 요청 취소</button>}
    {message && <p role="status">{message}</p>}
    <fieldset><legend>지역 선택 · 선택 지역 중심 기준</legend>
      <label>시도<select value={province} onChange={event => { clearPosition(); setProvince(event.target.value); }}><option value="">시도 선택</option>{provinces.data?.map(area => <option key={area.code} value={area.code}>{area.name}</option>)}</select></label>
      <label>시군구<select disabled={!province} value={position?.kind === 'AREA' ? position.areaCode : ''} onChange={event => { clearPosition(); if (event.target.value) { setPage(0); setPosition({ kind: 'AREA', areaCode: event.target.value }); } }}><option value="">시군구 선택</option>{districts.data?.map(area => <option key={area.code} value={area.code}>{area.name}</option>)}</select></label>
      {(provinces.isError || districts.isError) && <p role="alert">지역 정보를 불러오지 못했습니다.</p>}{provinces.data?.length === 0 && <p>검증된 지역 중심점이 아직 없습니다. 현재 위치를 이용하거나 전국 음료를 비교해 주세요.</p>}
    </fieldset>
    {!filters.group && !filters.q && !drinkName ? <p>전국 비교에서 음료명 또는 유형을 선택한 뒤 주변을 검색해 주세요.</p> : <>
      <div className="cafe-controls"><label>반경<select value={radiusKm} onChange={event => { setRadius(Number(event.target.value)); setPage(0); }}>{[0.5, 1, 3].map(radius => <option key={radius} value={radius}>{radius}km</option>)}</select></label>
      <label>정렬<select value={sort} onChange={event => { setSort(event.target.value); setPage(0); }}><option value="distance">가까운 순</option><option value="sugar">당류</option><option value="caffeine">카페인</option><option value="kcal">열량</option></select></label>
      <button type="button" aria-pressed={map} onClick={() => setMap(value => !value)}>{map ? '목록 보기' : '지도 보기'}</button></div>
      <p className="cafe-note">{filters.basis === '100ml' ? '100ml당 농도' : '1회 제공량'} · 수치 정렬 {filters.direction === 'desc' ? '높은 순' : '낮은 순'} · 미확정·음료 선택 필요는 마지막</p>
      {pending && <p role="status">주변 매장 검색 중…</p>}{error && <p role="alert">주변 정보를 조회하지 못했습니다. <button onClick={() => setPosition(value => value ? { ...value } : null)}>다시 시도</button></p>}
      {result && <><p>{result.locationKind === 'AREA' ? `${result.areaLabel} · 선택 지역 중심 기준` : '현재 위치 기준'} · {result.totalStores ?? '상한 도달'}개 매장 · {result.matchedBrands}개 브랜드</p>
      {result.coverage.status !== 'SUPPORTED' && <p role="status">{({ STALE: '45일 넘게 지난 자료입니다.', LIMITED: '후보 상한에 도달해 일부 결과만 표시합니다.', UNSUPPORTED: '지원하지 않는 지역입니다.' } as Record<string,string>)[result.coverage.status]}</p>}
      <p className="cafe-note"><a href="https://www.data.go.kr/data/15012005/openapi.do" target="_blank" rel="noopener noreferrer">매장 출처: {result.storeSource} ↗</a></p>
      {result.locationKind === 'AREA' && selectedArea && <p className="cafe-note"><a href={selectedArea.centerSource} target="_blank" rel="noopener noreferrer">중심점 출처: 기상청 단기예보 지역대표 위경도</a> · 기준일 {selectedArea.sourceAsOf ?? '미제공'} · <a href="https://www.kogl.or.kr/info/licenseType1.do" target="_blank" rel="noopener noreferrer">공공누리 출처표시</a></p>}
      <p className="cafe-note">매장 원천 기준일 {result.storeSourceAsOf ?? '미제공'} · 수집일 {result.storeFetchedAt.slice(0,10)} · 전국 전량을 보장하지 않습니다.</p>
      {map && <Suspense fallback={<p>지도 불러오는 중…</p>}><CafeNearbyMap stores={result.items} basis={result.basis} /></Suspense>}
      {(result.nearbyStoresWithoutNutrition ?? 0) > 0 && <p role="status">매장은 있으나 비교할 영양 자료가 없습니다 ({result.nearbyStoresWithoutNutrition}개). 음료명·유형 조건을 바꾸거나 <button type="button" onClick={() => { clearPosition(); close(); }}>전국 음료 비교로 돌아가기</button>를 이용해 주세요.</p>}
      {!result.items.length && !result.nearbyStoresWithoutNutrition && <p>현재 조건에 맞는 매장이 없습니다. 반경이나 음료 조건을 바꿔 보세요.</p>}
      <ul className="cafe-nearby-list" aria-label="주변 매장">{result.items.map(store => <li key={store.storeKey}>
        <h3>{store.brandName} · {store.branchName ?? store.storeName}</h3><p>{store.address} · {store.distanceM}m</p>
        <label>{store.selectionRequired ? '음료 선택 필요' : '비교 음료'}<select value={store.selectedDrink?.drinkKey ?? ''} onChange={event => { setSelected(value => { const next = { ...value }; if (event.target.value) next[store.brandSlug] = event.target.value; else delete next[store.brandSlug]; return next; }); setPage(0); }}><option value="">선택해 주세요</option>{store.variants.map(drink => <option key={drink.drinkKey} value={drink.drinkKey}>{drink.menuName} · {drink.temperature ?? '온도 미표시'} · {drink.sizeLabel ?? '사이즈 미표시'} · {drink.caffeineStatus}</option>)}</select></label>
        {store.autoSelected && <p className="cafe-note">조건에 맞는 변형이 하나여서 자동 선택했습니다.</p>}
        {store.selectedDrink && <><p>{(['sugar', 'caffeine', 'kcal'] as const).map(metric => { const value = cafeMetric(store.selectedDrink!, metric, result.basis); return `${metricNames[metric]} ${value.amount}${value.unit ?? ''} ${value.status ?? ''}`; }).join(' · ')}</p><p className="cafe-note">브랜드 공식 기본 레시피 · 영양 확인일 {store.selectedDrink.checkedAt} </p><CafeSources drink={store.selectedDrink} /></>}
        <p className="cafe-note">매핑 {store.mappingStatus} · 매장 원천 기준일 {store.sourceAsOf ?? '미제공'} · 매장 메뉴 판매 미확인</p>
        <div className="cafe-store-links"><a href={googleMapsDirectionsUrl({ title: store.storeName, latitude: store.latitude, longitude: store.longitude })} target="_blank" rel="noopener noreferrer">구글맵 길찾기 ↗</a><a href={`https://map.naver.com/p/search/${encodeURIComponent(`${store.brandName} ${store.branchName ?? store.storeName}`)}`} target="_blank" rel="noopener noreferrer">네이버 지도에서 메뉴·가격 보기 ↗</a></div>
      </li>)}</ul>
      <nav className="cafe-pagination" aria-label="주변 매장 페이지"><button disabled={page === 0} onClick={() => setPage(value => value-1)}>이전</button><span>{page+1}페이지</span><button disabled={!result.hasNext} onClick={() => setPage(value => value+1)}>다음</button></nav></>}
    </>}
  </section>;
}
