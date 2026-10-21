import { CafeSources } from './CafeSources';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchCafeComparison, fetchCafeDrinkNames, fetchCafeBrands, fetchCafeDrink, fetchCafeDrinks, fetchCafeGroups } from '../../api/rankingApi';
import type { CafeBrand, CafeDrink, CafeFilters, CaffeineStatus } from '../../api/rankingApi';
import ThemeToggle from '../../components/ThemeToggle';
import Footer from '../../components/Footer';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import { useSeo } from '../../seo/useSeo';
import { cafeMeta } from '../../seo/copy.mjs';
import { cafeMetric, cafeMetricValue, metricNames, volumeLabel, volumeExplanation } from './cafeView';
import type { CafeMetric } from './cafeView';
import { readCafeFilters, writeCafeFilters } from './cafeUrl';
import CafeNearby from './CafeNearby';
import { fetchCafeNearbyCapability } from '../../api/rankingApi';
import './CafePage.css';

const metrics: CafeMetric[] = ['sugar', 'caffeine', 'kcal'];
const statusNames: Record<CaffeineStatus, string> = { ZERO: '공식 0mg', DECAF: '디카페인', DISCLOSED: '수치 공개', UNDISCLOSED: '미공개' };
const popularTypes = ['바닐라라떼', '아메리카노', '라떼', '콜드브루', '말차·녹차라떼', '티'];
const positions = new Map<string, { scroll: number; focus: string }>();
const defaultFilters: CafeFilters = { sort: 'sugar', basis: 'serving', page: 0, size: 20 };
const metadata = (drink: CafeDrink) => `${drink.temperature ?? '온도 미표시'} · ${drink.sizeLabel ? '' : '사이즈 미표시 · '}${volumeLabel(drink)}`;

function Basis({ value, onChange }: { value: 'serving' | '100ml'; onChange: (value: 'serving' | '100ml') => void }) {
  return <div className="cafe-basis" role="group" aria-label="영양정보 기준">{(['serving', '100ml'] as const).map(basis => <button type="button" key={basis} aria-pressed={value === basis} onClick={() => onChange(basis)}>{basis === 'serving' ? '1회 제공량' : '100ml당'}</button>)}</div>;
}
function Metric({ drink, metric, basis }: { drink: CafeDrink; metric: CafeMetric; basis: 'serving' | '100ml' }) {
  const value = cafeMetric(drink, metric, basis);
  return <span className="cafe-metric" aria-label={`${metricNames[metric]} ${value.amount} ${value.unit ?? ''}${basis === '100ml' ? ' / 100ml' : ''} ${value.status ?? ''}`}>
    <span className={value.unit ? 'cafe-number' : 'cafe-value-state'}>{value.amount}</span>{value.unit && <small>{value.unit}</small>}{value.status && <small className="cafe-caffeine-state">{value.status}</small>}
  </span>;
}
function Search({ value, onChange, onSubmit }: { value: string; onChange: (value: string) => void; onSubmit: () => void }) {
  return <form className="cafe-search" role="search" onSubmit={event => { event.preventDefault(); onSubmit(); }}>
    <label className="cafe-sr-only" htmlFor="cafe-search">메뉴 검색</label>
    <input id="cafe-search" type="search" value={value} placeholder="어떤 음료를 찾으세요?" onChange={event => onChange(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault(); }} />
    <button type="submit">검색</button>
  </form>;
}
function FilterSheet({ filters, brands, close, apply }: { filters: CafeFilters; brands: CafeBrand[]; close: () => void; apply: (draft: CafeFilters) => void }) {
  const [draft, setDraft] = useState(filters);
  const panel = useRef<HTMLDivElement>(null);
  const change = (patch: Partial<CafeFilters>) => setDraft(previous => ({ ...previous, ...patch }));
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <div className="cafe-sheet-backdrop"><div className="cafe-sheet" ref={panel} role="dialog" aria-modal="true" aria-labelledby="cafe-filter-title" onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key !== 'Tab') return;
    const items = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, [tabindex="0"]') ?? []);
    const first = items[0], last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }}>
    <header><h2 id="cafe-filter-title">필터</h2><button type="button" onClick={close}>닫기</button></header>
    <div className="cafe-sheet-body">
      <label>온도<select value={draft.temperature ?? ''} onChange={event => change({ temperature: event.target.value || undefined })}><option value="">전체</option><option value="HOT">HOT</option><option value="ICE">ICE</option></select></label>
      <fieldset><legend>브랜드</legend><button type="button" onClick={() => change({ brand: [] })}>전체 해제</button>{brands.map(brand => <label key={brand.brandSlug}><input type="checkbox" checked={draft.brand?.includes(brand.brandSlug) ?? false} onChange={event => change({ brand: event.target.checked ? [...(draft.brand ?? []), brand.brandSlug] : draft.brand?.filter(value => value !== brand.brandSlug) })} />{brand.brandName}</label>)}</fieldset>
      <fieldset><legend>카페인 상태</legend>{(Object.keys(statusNames) as CaffeineStatus[]).map(status => <label key={status}><input type="checkbox" checked={draft.caffeineStatus?.includes(status) ?? false} onChange={event => change({ caffeine: undefined, caffeineStatus: event.target.checked ? [...(draft.caffeineStatus ?? []), status] : draft.caffeineStatus?.filter(value => value !== status) })} />{statusNames[status]}</label>)}<p>디카페인에도 카페인이 남을 수 있습니다.</p></fieldset>
      <fieldset><legend>1회 제공량 기준 상한</legend>{(['maxSugar', 'maxCaffeine'] as const).map(key => <label key={key}>{key === 'maxSugar' ? '당류 (g)' : '카페인 (mg)'}<input type="number" min="0" max={key === 'maxSugar' ? 1000 : 10000} value={draft[key] ?? ''} onChange={event => change({ [key]: event.target.value === '' ? undefined : Number(event.target.value) })} /></label>)}<p>미공개·수치 미확정은 상한 검색에서 제외됩니다.</p></fieldset>
    </div>
    <footer><button type="button" onClick={() => setDraft({ ...draft, temperature: undefined, brand: [], caffeine: undefined, caffeineStatus: [], maxSugar: undefined, maxCaffeine: undefined })}>초기화</button><button type="button" onClick={close}>취소</button><button type="button" className="kh-button" onClick={() => apply(draft)}>적용</button></footer>
  </div></div>;
}

export default function CafePage({ nearbyEnabled, onNearbyOpen }: { nearbyEnabled?: boolean; onNearbyOpen?: () => void } = {}) {
  useHeritageSurface();
  const [params, setParams] = useSearchParams();
  const { drinkKey, drinkName } = useParams();
  const [nearbyOpen, setNearbyOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const filters = useMemo(() => readCafeFilters(params), [params]);
  const capability = useQuery({ queryKey: ['cafe', 'capability'], queryFn: fetchCafeNearbyCapability, retry: false, staleTime: 60000 });
  const canNearby = nearbyEnabled ?? capability.data?.nearbyEnabled ?? false;
  const landing = !drinkName && !drinkKey && !location.search;
  const [search, setSearch] = useState(filters.q ?? '');
  const [sheet, setSheet] = useState(false);
  const [detailBasis, setDetailBasis] = useState<'serving' | '100ml'>(filters.basis ?? 'serving');
  useEffect(() => { setDetailBasis(readCafeFilters(new URLSearchParams(location.search)).basis ?? 'serving'); }, [drinkKey, location.search]);
  const identity = location.pathname + location.search;
  useEffect(() => { setNearbyOpen(false); }, [identity]);
  useSeo(cafeMeta({ detail: !!drinkKey || !!drinkName, drinkKey, drinkName, filtered: !!location.search }));
  useEffect(() => { setSearch(readCafeFilters(new URLSearchParams(location.search)).q ?? ''); setSheet(false); }, [location.search]);
  const brands = useQuery({ queryKey: ['cafe', 'brands'], queryFn: fetchCafeBrands, staleTime: 300000 });
  const groups = useQuery({ queryKey: ['cafe', 'groups'], queryFn: fetchCafeGroups, staleTime: 300000 });
  const drinks = useQuery({ queryKey: ['cafe', 'drinks', filters], queryFn: () => fetchCafeDrinks(filters), enabled: !landing && !drinkKey && !drinkName, staleTime: 300000, refetchOnWindowFocus: false });
  const comparison = useQuery({ queryKey: ['cafe', 'comparison', drinkName, filters], queryFn: () => fetchCafeComparison(drinkName!, filters), enabled: !!drinkName, retry: false });
  const detail = useQuery({ queryKey: ['cafe', 'drink', drinkKey], queryFn: () => fetchCafeDrink(drinkKey!), enabled: !!drinkKey, retry: false });
  useEffect(() => {
    if (drinkKey || (drinkName ? comparison.isPending : drinks.isPending)) return;
    const saved = positions.get(identity);
    if (!saved) return;
    const frame = requestAnimationFrame(() => { document.getElementById(saved.focus)?.focus({ preventScroll: true }); window.scrollTo(0, saved.scroll); });
    return () => cancelAnimationFrame(frame);
  }, [identity, drinkKey, drinkName, drinks.isPending, comparison.isPending]);
  const update = (patch: Partial<CafeFilters>) => { positions.delete(identity); setParams(writeCafeFilters({ ...filters, ...patch, page: 0 })); };
  const rows = drinkName ? comparison.data?.map(brand => brand.representative) ?? [] : drinks.data?.content ?? [];
  const result = drinkName ? comparison : drinks;
  const [suggestion, setSuggestion] = useState('');
  const [composing, setComposing] = useState(false);
  useEffect(() => { if (composing) return; const timer = setTimeout(() => setSuggestion(search.trim()), 250); return () => clearTimeout(timer); }, [search, composing]);
  const names = useQuery({ queryKey: ['cafe', 'names', suggestion], queryFn: () => fetchCafeDrinkNames(suggestion), enabled: !drinkKey && !composing, staleTime: 300000 });
  const basis = filters.basis ?? 'serving';
  const withVolume = rows.filter(drink => drink.cupVolumeMl !== null && drink.cupVolumeMl > 0).length;
  const sort = filters.sort === 'sugarPer100ml' ? 'sugar' : filters.sort ?? 'sugar';
  const filterCount = (filters.brand?.length ?? 0) + (filters.caffeineStatus?.length ?? 0) + Number(!!filters.caffeine) + Number(filters.maxSugar !== undefined) + Number(filters.maxCaffeine !== undefined);
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo;
  const nearbyFilters = useMemo(() => drinkKey ? { ...filters, basis: detailBasis } : filters, [drinkKey, filters, detailBasis]);
  const back = () => returnTo ? navigate(-1) : navigate('/cafe');
  return <main className={`cafe-page ${landing ? 'cafe-landing' : ''}`}>
    {canNearby && <section className="cafe-nearby" aria-label="주변 카페"><button type="button" disabled={!!drinkKey && !detail.data} onClick={() => { setNearbyOpen(true); onNearbyOpen?.(); }}>주변 카페에서 음료 찾기</button>{nearbyOpen && <CafeNearby filters={nearbyFilters} drinkName={drinkName ?? (drinkKey ? detail.data?.drinkName ?? detail.data?.menuName : undefined)} initialSelection={drinkKey && detail.data ? { [detail.data.brandSlug]: drinkKey } : undefined} close={() => setNearbyOpen(false)} />}</section>}
    <header className="cafe-header"><div className="cafe-top"><Link to={landing ? '/' : '/cafe'}>{landing ? '랭킹' : '‹ 음료 탐색'}</Link><ThemeToggle /></div>
      {!drinkKey && <><h1>{landing ? <>카페 음료<br />비교</> : drinkName ?? (filters.group === '기타' ? '기타·유형 미분류' : filters.group ?? '카페 음료 비교')}</h1>{landing && <p>공식 기본 레시피의 당류·카페인·열량을 확인하세요.</p>}</>}
    </header>
    {drinkKey ? <section className="cafe-detail" aria-label="음료 상세">
      <button type="button" onClick={back}>‹ {returnTo ? '비교로 돌아가기' : '음료 탐색'}</button>
      {detail.isPending ? <p role="status">음료 정보를 불러오는 중…</p> : detail.isError ? <div role="alert"><h1>{(detail.error as { response?: { status?: number } }).response?.status === 404 ? '이 음료를 찾을 수 없습니다' : '음료 정보를 불러오지 못했습니다'}</h1><p>메뉴가 변경되었을 수 있습니다.</p><Link to="/cafe">다시 검색</Link><button onClick={() => void detail.refetch()}>다시 시도</button></div> : detail.data && <>
        <p className="cafe-brand">{detail.data.brandName}</p><h1>{detail.data.menuName}</h1><p className="cafe-meta">{metadata(detail.data)}</p><p className="cafe-note">카페인: {statusNames[detail.data.caffeineStatus]}</p>
        <Basis value={detailBasis} onChange={setDetailBasis} /><p className="cafe-note">{detailBasis === 'serving' ? '공식 1회 제공량 기준' : '100ml당 농도 · 실제 한 잔 섭취량과 다릅니다'}</p>
        <div className="cafe-detail-metrics">{metrics.map(metric => <section key={metric}><h2>{metricNames[metric]}</h2><Metric drink={detail.data!} metric={metric} basis={detailBasis} /></section>)}</div>
        <dl className="cafe-facts"><div><dt>제공량 원문</dt><dd>{detail.data.servingBasis ?? '미표시'}{detail.data.volumeSource === 'BRAND_SIZE_TABLE' && <p>{volumeExplanation}</p>}</dd></div><div><dt>가격</dt><dd>{detail.data.priceKrw == null ? '공식 미공개 · 가격 정보 미제공' : `${detail.data.priceKrw.toLocaleString()}원`}{detail.data.priceNote && <p>{detail.data.priceNote}</p>}</dd></div><div><dt>유형</dt><dd>{detail.data.drinkGroup === '기타' ? '기타·유형 미분류' : detail.data.drinkGroup} · 메뉴명 기반 유형{detail.data.sourceCategory && <p>원문 분류: {detail.data.sourceCategory}</p>}</dd></div><div><dt>영양 확인일</dt><dd><time>{detail.data.checkedAt}</time></dd></div></dl>
        <details><summary>추가 영양성분</summary><dl className="cafe-facts">{[['나트륨', detail.data.sodiumMg, 'mg'], ['탄수화물', detail.data.carbsG, 'g'], ['지방', detail.data.fatG, 'g'], ['포화지방', detail.data.satFatG, 'g'], ['단백질', detail.data.proteinG, 'g']].map(([name, value, unit]) => <div key={String(name)}><dt>{name}</dt><dd>{value == null ? '미공개' : `${value} ${unit}`}</dd></div>)}</dl>{detail.data.allergens && <p>알레르기: {detail.data.allergens}</p>}{detail.data.notes && <p>{detail.data.notes}</p>}</details>
        <CafeSources drink={detail.data} /><p className="cafe-note">브랜드 기본 레시피 기준입니다. 샷·시럽 등 변경 사항과 매장별 판매 여부는 반영하지 않습니다. 의료 상담을 대신하지 않습니다.</p>
      </>}
    </section> : <>
      <div onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)}><Search value={search} onChange={setSearch} onSubmit={() => drinkName ? navigate(`/cafe?${writeCafeFilters({ ...filters, q: search.trim() || undefined, page: 0 })}`) : update({ q: search.trim() || undefined })} /></div>
      {names.data && <nav className="cafe-names" aria-label="음료명 자동완성">{names.data.map(name => <Link key={name.drinkName} to={`/cafe/drink/${encodeURIComponent(name.drinkName)}?${writeCafeFilters({ ...filters, q: undefined, group: undefined, page: 0 })}`}>{name.drinkName}<small>{name.brandCount}브랜드 · {name.rowCount}행</small></Link>)}</nav>}
      {landing ? <>
        <section className="cafe-types" aria-labelledby="cafe-types-title"><h2 id="cafe-types-title">유형으로 비교</h2>
          {groups.isPending ? <p role="status" className="kh-skeleton">유형 불러오는 중…</p> : groups.isError ? <p role="alert">유형을 불러오지 못했습니다. <button onClick={() => void groups.refetch()}>다시 시도</button></p> : !groups.data?.length ? <p>유형 정보가 없습니다. 메뉴명으로 검색할 수 있습니다.</p> : <div className="cafe-type-grid">{popularTypes.map(group => <Link key={group} to={`/cafe?${writeCafeFilters({ group })}`}><span>{group}</span><small>{groups.data.find(value => value.group === group)?.count ?? 0}행</small></Link>)}</div>}
          <label className="cafe-all-types">전체 유형<select value="" onChange={event => update({ group: event.target.value || undefined })}><option value="">유형 선택</option>{groups.data?.map(group => <option key={group.group} value={group.group}>{group.group === '기타' ? '기타·유형 미분류' : group.group} ({group.count}행)</option>)}</select></label>
        </section>
        <section className="cafe-quick" aria-label="영양 조건 바로가기">{[['공식 0mg', { caffeineStatus: ['ZERO'] }], ['디카페인', { caffeineStatus: ['DECAF'] }], ['당류 10g 이하', { maxSugar: 10 }]].map(([label, patch]) => <Link key={String(label)} to={`/cafe?${writeCafeFilters(patch as CafeFilters)}`}><span>{String(label)}</span><span aria-hidden="true">↗</span></Link>)}</section>
        <p className="cafe-note">디카페인은 0mg와 다릅니다. 미공개는 0이 아닙니다.</p>
        <details className="cafe-sources"><summary>공식 영양정보 · 출처 안내</summary>{brands.isPending ? <p>출처 확인 중…</p> : brands.isError ? <p>출처 정보를 불러오지 못했습니다. <button onClick={() => void brands.refetch()}>다시 시도</button></p> : brands.data?.map(brand => <p key={brand.brandSlug}>{brand.brandName} · <time>{brand.checkedAt}</time> {brand.sourceUrls.map(url => <a key={url} href={url} target="_blank" rel="noopener noreferrer">공식 원문 ↗ </a>)}</p>)}<p>매장 판매·가격 정보는 제공하지 않습니다.</p></details>
      </> : <>
        <div className="cafe-controls"><label>유형<select aria-label="유형" value={filters.group ?? ''} onChange={event => update({ group: event.target.value || undefined })}><option value="">전체 유형</option>{groups.data?.map(group => <option key={group.group} value={group.group}>{group.group === '기타' ? '기타·유형 미분류' : group.group}</option>)}</select></label><label>온도<select aria-label="온도" value={filters.temperature ?? ''} onChange={event => update({ temperature: event.target.value || undefined })}><option value="">전체</option><option value="HOT">HOT</option><option value="ICE">ICE</option></select></label><button type="button" onClick={() => setSheet(true)}>필터 {filterCount}</button></div>
        {groups.isError && <p className="cafe-note">유형 정보 조회 실패 <button onClick={() => void groups.refetch()}>유형 다시 시도</button></p>}{brands.isError && <p className="cafe-note">브랜드 정보 조회 실패 <button onClick={() => void brands.refetch()}>브랜드 다시 시도</button></p>}
        <div className="cafe-sort-bar"><Basis value={basis} onChange={value => update({ basis: value, sort })} /><div role="group" aria-label="정렬">{metrics.map(metric => <button key={metric} type="button" aria-pressed={sort === metric} onClick={() => update({ sort: metric, direction: sort === metric && filters.direction !== 'desc' ? 'desc' : 'asc' })}>{metricNames[metric]} {sort === metric && filters.direction === 'desc' ? '높은 순 ↓' : '낮은 순 ↑'}</button>)}</div></div>
        {(filters.caffeine || (filters.caffeineStatus?.length ?? 0) > 0 || filters.maxSugar !== undefined || filters.maxCaffeine !== undefined) && <p className="cafe-note">{filters.caffeine === 'none' ? '공식 0·디카페인 포함 · ' : filters.caffeine ? `${filters.caffeine === 'zero' ? '공식 0mg' : '디카페인'} · ` : ''}{filters.caffeineStatus?.map(status => statusNames[status]).join(' · ')}{filters.maxSugar !== undefined && ` · 1회량 당류 ${filters.maxSugar}g 이하`}{filters.maxCaffeine !== undefined && ` · 1회량 카페인 ${filters.maxCaffeine}mg 이하`}</p>}
        {result.isPending ? <div aria-busy="true" role="status" className="cafe-loading">{[1, 2, 3].map(row => <div className="kh-skeleton" key={row}>음료 비교 자료 불러오는 중…</div>)}</div> : result.isError ? <p role="alert">음료를 불러오지 못했습니다. <button onClick={() => void result.refetch()}>다시 시도</button></p> : <>
          <p className="cafe-summary" role="status">{drinkName ? `${rows.length}브랜드 ·` : `전체 ${drinks.data?.totalElements ?? 0}행 ·`} {rows.length ? `${(filters.page ?? 0) * (filters.size ?? 20) + 1}–${(filters.page ?? 0) * (filters.size ?? 20) + rows.length}` : '0'}행 표시 <small>메뉴명 기반 유형 · 브랜드별 제공량 다름{basis === '100ml' ? ' · 100ml당 농도' : ''}</small></p>
          {filters.group === '기타' && <p className="cafe-note">서로 같은 메뉴를 뜻하지 않음 · 원문 분류는 상세에서 확인하세요.</p>}
          {basis === '100ml' && rows.length > 0 && <div className="cafe-note"><p>현재 페이지: 산출 가능 {withVolume}행 · 산출 불가 {rows.length - withVolume}행 (공개 용량 기준)</p>{withVolume === 0 && <p>공개 용량이 없어 100ml 비교 불가 <button type="button" onClick={() => update({ basis: 'serving', sort })}>1회 제공량으로 돌아가기</button></p>}</div>}
          {!rows.length ? <div className="cafe-empty"><p>조건에 맞는 음료가 없습니다.</p><button onClick={() => setSheet(true)}>조건 변경</button><button onClick={() => setParams(writeCafeFilters(defaultFilters))}>조건 초기화</button></div> : <>
            {drinkName && <p className="cafe-note">브랜드별 공개 기본 판을 표시합니다. 최저 수치가 아닙니다. 선택한 온도·사이즈·카페인 상태를 확인하세요.</p>}
            <ul className="cafe-cards" aria-label="음료 비교">{rows.map(drink => <li className="cafe-card" key={drink.drinkKey}>
              <span className="cafe-brand">{drink.brandName}</span><Link id={`drink-${drink.drinkKey}`} to={`/cafe/drinks/${drink.drinkKey}?basis=${basis}`} state={{ returnTo: identity }} onClick={() => positions.set(identity, { scroll: window.scrollY, focus: `drink-${drink.drinkKey}` })}>{drink.menuName}</Link>
              <p className="cafe-meta">{metadata(drink)} · {statusNames[drink.caffeineStatus]}</p><small>{basis === 'serving' ? '공식 1회 제공량' : '100ml당 농도 · 한 잔 섭취량과 다름'}</small>
              <div className="cafe-card-metrics">{metrics.map(metric => { const number = cafeMetricValue(drink, metric, basis); const maximum = Math.max(1, ...rows.map(row => cafeMetricValue(row, metric, basis)).filter((value): value is number => value != null)); return <section key={metric} className={sort === metric ? 'cafe-sorted' : ''}><h2>{metricNames[metric]}</h2><Metric drink={drink} metric={metric} basis={basis} /><span className="cafe-bar" aria-hidden="true"><i style={{ width: `${number != null ? Math.max(0, Math.min(100, number / maximum * 100)) : 0}%` }} /></span></section>; })}</div>
              {drinkName && <details><summary>공개 판 전체 {comparison.data?.find(brand => brand.brandSlug === drink.brandSlug)?.variants.length ?? 0}개</summary><ul className="cafe-variants">{comparison.data?.find(brand => brand.brandSlug === drink.brandSlug)?.variants.map(variant => <li key={variant.drinkKey}><Link to={`/cafe/drinks/${variant.drinkKey}?basis=${basis}`} state={{ returnTo: identity }}>{variant.menuName} · {metadata(variant)} · {statusNames[variant.caffeineStatus]}</Link></li>)}</ul></details>}
            </li>)}</ul>
          </>}
          {!drinkName && rows.length > 0 && <nav aria-label="결과 페이지" className="cafe-pagination"><button disabled={!filters.page} onClick={() => setParams(writeCafeFilters({ ...filters, page: (filters.page ?? 0) - 1 }))}>이전</button><span>{(filters.page ?? 0) + 1} 페이지</span><button disabled={((filters.page ?? 0) + 1) * (filters.size ?? 20) >= ((drinkName ? rows.length : drinks.data?.totalElements) ?? 0)} onClick={() => setParams(writeCafeFilters({ ...filters, page: (filters.page ?? 0) + 1 }))}>다음</button></nav>}
        </>}
        {sheet && <FilterSheet filters={filters} brands={brands.data ?? []} close={() => setSheet(false)} apply={draft => { update(draft); setSheet(false); }} />}
      </>}
    </>}
    <Footer />
  </main>;
}
