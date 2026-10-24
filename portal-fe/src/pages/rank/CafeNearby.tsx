import { CafeSources } from './CafeSources';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCafeAreas, fetchCafeDrinkNames, searchCafeNearby } from '../../api/rankingApi';
import type { CafeFilters, CafeLocation, CafeNearbyResult } from '../../api/rankingApi';
import { googleMapsDirectionsUrl } from '../place/googleMaps';
import { nearbyFingerprint, readNearbyBrands, saveNearbyBrands } from './cafeNearbyPreferences';
import { cafeMetric, metricNames } from './cafeView';
import { CafeBrandBadge } from './CafeArt';

const CafeNearbyMap = lazy(() => import('./CafeNearbyMap'));

export default function CafeNearby({ filters, drinkName, close, initialSelection }: { filters: CafeFilters; drinkName?: string; close: () => void; initialSelection?: Record<string, string> }) {
  const [chosenName, setChosenName] = useState('');
  const [drinkQuery, setDrinkQuery] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [composing, setComposing] = useState(false);
  const needsDrink = !drinkName && !filters.group && !filters.q;
  const activeDrinkName = drinkName ?? (chosenName || undefined);
  useEffect(() => { if (composing) return; const timer = setTimeout(() => setSuggestion(drinkQuery.trim()), 250); return () => clearTimeout(timer); }, [drinkQuery, composing]);
  const names = useQuery({ queryKey: ['cafe', 'names', suggestion], queryFn: () => fetchCafeDrinkNames(suggestion), enabled: needsDrink && !composing, staleTime: 300000 });
  const [position, setPosition] = useState<CafeLocation | null>(null);
  const [message, setMessage] = useState('');
  const [locating, setLocating] = useState(false);
  const [province, setProvince] = useState('');
  const [radiusKm, setRadius] = useState(1);
  const [sort, setSort] = useState('distance');
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc');
  const [storeBrands, setStoreBrands] = useState<string[]>([]);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [preferencesReady, setPreferencesReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setPreferencesReady(false); setFingerprint(null); setStoreBrands([]); setSort('distance'); setDirection('asc'); setPage(0);
    if (position) void nearbyFingerprint(position).then(key => { if (cancelled) return; setFingerprint(key); setStoreBrands(key ? readNearbyBrands(key) : []); setPreferencesReady(true); });
    return () => { cancelled = true; };
  }, [position]);
  const chooseBrands = (brands: string[]) => { setStoreBrands(brands); setPage(0); setSort('distance'); setDirection('asc'); if (fingerprint) saveNearbyBrands(fingerprint, brands); };
  const [selected, setSelected] = useState<Record<string, string>>(initialSelection ?? {});
  const [page, setPage] = useState(0);
  const [changingLocation, setChangingLocation] = useState(true);
  const [showMap, setShowMap] = useState(false);
  const [result, setResult] = useState<CafeNearbyResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const alive = useRef(true);
  const locationGeneration = useRef(0);
  const requestAbort = useRef<AbortController | null>(null);
  const provinces = useQuery({ queryKey: ['cafe', 'areas'], queryFn: () => fetchCafeAreas(), staleTime: 300000 });
  const districts = useQuery({ queryKey: ['cafe', 'areas', province], queryFn: () => fetchCafeAreas(province), enabled: !!province, staleTime: 300000 });
  useEffect(() => { alive.current = true; return () => { alive.current = false; locationGeneration.current++; }; }, []);
  const clearPosition = () => { locationGeneration.current++; requestAbort.current?.abort(); setLocating(false); setPreferencesReady(false); setPosition(null); setResult(null); setPending(false); setError(false); };
  const locate = () => {
    const generation = ++locationGeneration.current;
    if (!navigator.geolocation) { setMessage('이 환경에서는 위치를 사용할 수 없습니다. 지역을 선택해 주세요.'); return; }
    setLocating(true); setMessage('');
    navigator.geolocation.getCurrentPosition(value => {
      if (!alive.current || generation !== locationGeneration.current) return;
      setLocating(false); setChangingLocation(false); setPage(0); setPreferencesReady(false); setPosition({ kind: 'CURRENT', lat: value.coords.latitude, lng: value.coords.longitude });
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
    if (!position || !preferencesReady || (!filters.group && !filters.q && !activeDrinkName)) return;
    const abort = new AbortController();
    requestAbort.current = abort;
    setPending(true); setError(false); setResult(null);
    void searchCafeNearby({ location: position, radiusKm, group: Array.isArray(filters.group) ? undefined : filters.group, groups: Array.isArray(filters.group) ? filters.group : undefined, q: filters.q, drinkName: activeDrinkName,
      brands: filters.brand ?? [], temperature: filters.temperature, caffeineStatus: filters.caffeineStatus ?? [], caffeine: filters.caffeine,
      maxSugar: filters.maxSugar, maxCaffeine: filters.maxCaffeine, maxKcal: filters.maxKcal, sizeLabel: filters.sizeLabel, basis: filters.basis ?? 'serving', sort, direction, storeBrands,
      selectedDrinkKeys: Object.values(selected), page, size: 20,
    }, abort.signal).then(data => { if (!abort.signal.aborted) setResult(data); }).catch(() => { if (!abort.signal.aborted) setError(true); }).finally(() => { if (!abort.signal.aborted) setPending(false); });
    return () => abort.abort();
  }, [position, preferencesReady, radiusKm, filters, activeDrinkName, sort, direction, storeBrands, selected, page]);
  const selectedArea = position?.kind === 'AREA' ? districts.data?.find(area => area.code === position.areaCode) : undefined;
  const sortLabel = sort === 'distance' ? '가까운 순' : `${metricNames[sort as 'sugar' | 'caffeine' | 'kcal']} ${direction === 'asc' ? '낮은 순' : '높은 순'}`;
  const hasDrink = !!(filters.group || filters.q || activeDrinkName);
  return <section className="cafe-nearby-panel" aria-labelledby="cafe-nearby-title">
    <header><button type="button" onClick={() => { clearPosition(); close(); }}>전국 음료 비교로 돌아가기</button><p>{activeDrinkName ?? (Array.isArray(filters.group) ? filters.group.join(' · ') : filters.group) ?? filters.q ?? '음료 선택'} · 반경 {radiusKm === 0.5 ? '500m' : `${radiusKm}km`}</p></header>
    {needsDrink && <section aria-label="주변에서 찾을 음료"><label htmlFor="cafe-nearby-drink">주변에서 찾을 음료</label><input id="cafe-nearby-drink" type="search" placeholder="음료 이름 검색" value={drinkQuery} onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)} onChange={event => setDrinkQuery(event.target.value)} />{activeDrinkName && <p>선택한 음료: {activeDrinkName}</p>}<div className="cafe-variant-picker" role="group" aria-label="주변 검색 음료 선택">{names.data?.map(name => <button type="button" key={name.drinkName} aria-pressed={chosenName === name.drinkName} onClick={() => { setChosenName(name.drinkName); setSelected({}); setPage(0); }}>{name.drinkName} · {name.brandCount}개 브랜드</button>)}</div>{names.isError && <p role="alert">음료 이름을 불러오지 못했습니다. <button onClick={() => void names.refetch()}>다시 시도</button></p>}</section>}
    {changingLocation && <section className="cafe-nearby-location" aria-label="검색 위치 선택"><button type="button" onClick={locate} disabled={locating}>{locating ? '위치 확인 중…' : '현재 위치 사용'}</button>{locating && <button type="button" onClick={clearPosition}>위치 요청 취소</button>}
      <fieldset><legend>지역 선택 · 선택 지역 중심 기준</legend>
        <details className="cafe-choice"><summary>시도: {provinces.data?.find(area => area.code === province)?.name ?? '시도 선택'}</summary>{provinces.data?.map(area => <button type="button" key={area.code} aria-pressed={province === area.code} onClick={() => { clearPosition(); setProvince(area.code); }}>{area.name}</button>)}</details>
        <details className="cafe-choice"><summary>시군구: {selectedArea?.name ?? '시군구 선택'}</summary>{districts.data?.map(area => <button type="button" key={area.code} aria-pressed={position?.kind === 'AREA' && position.areaCode === area.code} onClick={() => { clearPosition(); setPage(0); setPreferencesReady(false); setPosition({ kind: 'AREA', areaCode: area.code }); setChangingLocation(false); }}>{area.name}</button>)}</details>
        {(provinces.isError || districts.isError) && <p role="alert">지역 정보를 불러오지 못했습니다.</p>}{provinces.data?.length === 0 && <p>검증된 지역 중심점이 아직 없습니다. 현재 위치를 이용하거나 전국 음료를 비교해 주세요.</p>}
      </fieldset>
    </section>}
    {message && <p role="status">{message}</p>}
    <div className="cafe-nearby-sheet"><h2 id="cafe-nearby-title">{result ? `매장 ${result.totalStores ?? '상한 도달'}곳 · 브랜드 ${result.matchedBrands}개` : '주변 카페에서 음료 찾기'}{result && <small> · {result.locationKind === 'AREA' ? `${result.areaLabel} 중심` : '현재 위치 기준'}</small>}</h2>
    {position && <div className="cafe-nearby-controls" role="group" aria-label="주변 검색 조건">
      <div className="cafe-radius" role="group" aria-label="반경">{[0.5, 1, 3].map(radius => <button type="button" key={radius} aria-pressed={radiusKm === radius} onClick={() => { setRadius(radius); setPage(0); }}>{radius === 0.5 ? '500m' : `${radius}km`}</button>)}</div>
      <details className="cafe-choice"><summary>정렬: {sortLabel}</summary><button type="button" aria-pressed={sort === 'distance'} onClick={() => { setSort('distance'); setDirection('asc'); setPage(0); }}>가까운 순</button>{(['sugar', 'caffeine', 'kcal'] as const).flatMap(metric => (['asc', 'desc'] as const).map(order => <button type="button" key={metric + order} aria-pressed={sort === metric && direction === order} onClick={() => { setSort(metric); setDirection(order); setPage(0); }}>{metricNames[metric]} {order === 'asc' ? '낮은 순' : '높은 순'}</button>))}</details>
      {result && <button type="button" aria-pressed={showMap} onClick={() => setShowMap(value => !value)}>{showMap ? '지도 닫기' : '지도 보기'}</button>}
      <button type="button" onClick={() => setChangingLocation(value => !value)}>위치 변경</button>
    </div>}
    {result && <div className="cafe-brand-tabs" role="group" aria-label="주변 카페 브랜드"><button type="button" aria-pressed={!storeBrands.length} onClick={() => chooseBrands([])}>전체 보기</button>{[...new Set([...(result.brandCounts ?? result.items.map(store => ({ brandSlug: store.brandSlug, brandName: store.brandName, count: 1 }))).map(brand => brand.brandSlug), ...storeBrands])].map(slug => { const brand = result.brandCounts?.find(brand => brand.brandSlug === slug); const store = result.items.find(store => store.brandSlug === slug); return <button type="button" key={slug} aria-pressed={storeBrands.includes(slug)} onClick={() => chooseBrands(storeBrands.includes(slug) ? storeBrands.filter(value => value !== slug) : [...storeBrands, slug])}>{brand?.brandName ?? store?.brandName ?? slug} {brand?.count ?? result.items.filter(store => store.brandSlug === slug).length}</button>; })}</div>}
    {result && showMap && <Suspense fallback={<p>지도 불러오는 중…</p>}><CafeNearbyMap stores={result.items} basis={result.basis} /></Suspense>}
    {result && storeBrands.length > 0 && !result.items.length && <p role="status">선택한 브랜드의 매장이 없습니다. <button type="button" onClick={() => chooseBrands([])}>전체 보기</button></p>}
    {!hasDrink ? <p>위에서 음료를 고르고 현재 위치 또는 지역을 선택해 주세요.</p> : <>
      {pending && <p role="status">주변 매장 검색 중…</p>}{error && <p role="alert">주변 정보를 조회하지 못했습니다. <button onClick={() => setPosition(value => value ? { ...value } : null)}>다시 시도</button></p>}
      {result && <>
      {result.coverage.status !== 'SUPPORTED' && <p role="status">{({ STALE: '45일 넘게 지난 자료입니다.', LIMITED: '후보 상한에 도달해 일부 결과만 표시합니다.', UNSUPPORTED: '지원하지 않는 지역입니다.' } as Record<string,string>)[result.coverage.status]}</p>}
      {(result.nearbyStoresWithoutNutrition ?? 0) > 0 && <p role="status">매장은 있으나 비교할 영양 자료가 없습니다 ({result.nearbyStoresWithoutNutrition}개). 음료명·유형 조건을 바꾸거나 전국 음료 비교를 이용해 주세요.</p>}
      {!result.items.length && !result.nearbyStoresWithoutNutrition && <p>현재 조건에 맞는 매장이 없습니다. 반경이나 음료 조건을 바꿔 보세요.</p>}
      <ol className="cafe-nearby-list" aria-label="주변 매장">{result.items.map(store => { const sugar = store.selectedDrink ? cafeMetric(store.selectedDrink, 'sugar', result.basis) : null; const displayName = store.displayName ?? [store.storeName, store.branchName].filter((value, index, values) => value && values.indexOf(value) === index).join(' · '); const picker = <div className="cafe-variant-picker" role="group" aria-label={store.selectionRequired ? '음료 선택 필요' : '비교 음료'}>{store.variants.map(drink => <button type="button" key={drink.drinkKey} aria-pressed={store.selectedDrink?.drinkKey === drink.drinkKey} onClick={() => { setSelected(value => ({ ...value, [store.brandSlug]: drink.drinkKey })); setPage(0); }}>{drink.menuName} · {drink.temperature ?? '온도 미표시'} · {drink.sizeLabel ?? '사이즈 미표시'}</button>)}</div>; return <li key={store.storeKey}>
        <div className="cafe-store-heading"><CafeBrandBadge slug={store.brandSlug} name={store.brandName} /><div><h3>{displayName}</h3><p>직선 {store.distanceM >= 1000 ? `${(store.distanceM / 1000).toFixed(1)}km` : `${store.distanceM}m`} · {store.address}</p></div><div className="cafe-store-sugar"><strong>{sugar?.amount ?? '선택 필요'}</strong><small>당류 {sugar?.unit ?? ''}{result.basis === '100ml' ? '/100ml' : ''}</small></div></div>
        {store.selectedDrink && <p className="cafe-meta">{store.selectedDrink.menuName} · {store.selectedDrink.temperature ?? '온도 미표시'} · {store.selectedDrink.sizeLabel ?? '사이즈 미표시'} · {(['caffeine', 'kcal'] as const).map(metric => { const value = cafeMetric(store.selectedDrink!, metric, result.basis); return `${metricNames[metric]} ${value.amount}${value.unit ?? ''} ${value.status ?? ''}`.trim(); }).join(' · ')}</p>}
        {(store.selectionRequired || !store.selectedDrink) && picker}
        {store.selectedDrink && <div className="cafe-store-more">{!store.selectionRequired && store.variants.length > 1 && <details className="cafe-store-options"><summary>다른 옵션 {store.variants.length - 1}개</summary>{picker}</details>}<details className="cafe-store-source"><summary>출처 · {store.selectedDrink.checkedAt}</summary><CafeSources drink={store.selectedDrink} /></details></div>}
        <div className="cafe-store-links"><a href={`https://map.naver.com/p/search/${encodeURIComponent(displayName)}`} target="_blank" rel="noopener noreferrer">네이버 메뉴·가격 ↗</a><a href={googleMapsDirectionsUrl({ title: displayName, latitude: store.latitude, longitude: store.longitude })} target="_blank" rel="noopener noreferrer">길찾기 ↗</a></div>
      </li>; })}</ol>
      <nav className="cafe-pagination" aria-label="주변 매장 페이지"><button disabled={page === 0} onClick={() => setPage(value => value-1)}>이전</button><span>{page+1}페이지</span><button disabled={!result.hasNext} onClick={() => setPage(value => value+1)}>다음</button></nav>
      <p className="cafe-note">수치는 브랜드 기본 레시피이며 매장 메뉴 판매 미확인 상태입니다. 매장까지 직선거리이고, 위치는 저장하지 않습니다. 수치 정렬에서 미확정·음료 선택 필요는 마지막입니다.</p>
      <p className="cafe-note">매장 자료 기준일 {result.storeSourceAsOf ?? '미제공'} · 수집일 {result.storeFetchedAt.slice(0,10)} · 전국 전량을 보장하지 않습니다. <a href="https://www.data.go.kr/data/15012005/openapi.do" target="_blank" rel="noopener noreferrer">매장 출처: {result.storeSource} ↗</a></p>
      {result.locationKind === 'AREA' && selectedArea && <p className="cafe-note"><a href={selectedArea.centerSource} target="_blank" rel="noopener noreferrer">중심점 출처: 기상청 단기예보 지역대표 위경도</a> · 기준일 {selectedArea.sourceAsOf ?? '미제공'} · <a href="https://www.kogl.or.kr/info/licenseType1.do" target="_blank" rel="noopener noreferrer">공공누리 출처표시</a></p>}
      </>}
    </>}
    </div>
  </section>;
}
