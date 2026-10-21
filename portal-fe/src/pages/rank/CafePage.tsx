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
const popularTypes = ['라떼', '티', '스무디·프라페', '콜드브루'];
const recentKey = 'cafe-recent-searches';
function readRecent(): string[] { try { const value: unknown = JSON.parse(localStorage.getItem(recentKey) ?? '[]'); return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 8) : []; } catch { return []; } }
function Highlight({ text, query }: { text: string; query: string }) {
  const index = query ? text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase()) : -1;
  return index < 0 ? <>{text}</> : <>{text.slice(0, index)}<mark>{text.slice(index, index + query.length)}</mark>{text.slice(index + query.length)}</>;
}
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
    <input id="cafe-search" type="search" autoFocus value={value} placeholder="어떤 음료를 찾으세요?" onChange={event => onChange(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault(); }} />
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
      <fieldset><legend>온도</legend>{['', 'HOT', 'ICE'].map(value => <button type="button" key={value} aria-pressed={(draft.temperature ?? '') === value} onClick={() => change({ temperature: value || undefined })}>{value || '전체'}</button>)}</fieldset>
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [recent, setRecent] = useState(readRecent);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const remember = (value: string) => { if (!value) return; setRecent(previous => { const next = [value, ...previous.filter(item => item !== value)].slice(0, 8); try { localStorage.setItem(recentKey, JSON.stringify(next)); } catch { /* Private mode can disable storage. */ } return next; }); };
  const removeRecent = (value: string) => { const next = recent.filter(item => item !== value); setRecent(next); try { localStorage.setItem(recentKey, JSON.stringify(next)); } catch { /* optional history */ } };
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
  useEffect(() => { setNearbyOpen(false); setSearchOpen(false); }, [identity]);
  useEffect(() => { setSelected({}); }, [drinkName]);
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
  const unsortedRows = drinkName ? comparison.data?.map(brand => brand.variants.find(variant => variant.drinkKey === selected[brand.brandSlug]) ?? brand.representative) ?? [] : drinks.data?.content ?? [];
  const result = drinkName ? comparison : drinks;
  const [suggestion, setSuggestion] = useState('');
  const [composing, setComposing] = useState(false);
  useEffect(() => { if (composing) return; const timer = setTimeout(() => setSuggestion(search.trim()), 250); return () => clearTimeout(timer); }, [search, composing]);
  const names = useQuery({ queryKey: ['cafe', 'names', suggestion], queryFn: () => fetchCafeDrinkNames(suggestion), enabled: (!drinkKey || searchOpen) && !composing, staleTime: 300000 });
  const basis = filters.basis ?? 'serving';
  const activeMetric: CafeMetric = filters.sort === 'caffeine' || filters.sort === 'kcal' ? filters.sort : 'sugar';
  const rows = drinkName ? [...unsortedRows].sort((a, b) => { const x = cafeMetricValue(a, activeMetric, basis), y = cafeMetricValue(b, activeMetric, basis); return x == null ? (y == null ? a.brandSlug.localeCompare(b.brandSlug) : 1) : y == null ? -1 : (x - y) * (filters.direction === 'desc' ? -1 : 1) || a.brandSlug.localeCompare(b.brandSlug); }) : unsortedRows;
  const range = (metric: CafeMetric) => { const values = rows.map(row => cafeMetricValue(row, metric, basis)).filter((value): value is number => value != null); return values.length ? `${Math.min(...values).toLocaleString(undefined, { maximumFractionDigits: 1 })}~${Math.max(...values).toLocaleString(undefined, { maximumFractionDigits: 1 })}${metric === 'sugar' ? 'g' : 'mg'}` : '미공개'; };
  const openNearby = () => { setNearbyOpen(true); onNearbyOpen?.(); };
  const submitSearch = () => { if (composing) return; remember(search.trim()); if (drinkName || drinkKey) navigate(`/cafe?${writeCafeFilters({ ...filters, q: search.trim() || undefined, page: 0 })}`); else update({ q: search.trim() || undefined }); setSearchOpen(false); };
  const openSearch = () => { setSearchOpen(true); setSearch(''); };
  const popularNames = useQuery({ queryKey: ['cafe', 'names', ''], queryFn: () => fetchCafeDrinkNames(''), enabled: landing, staleTime: 300000 });
  const popular = [...(popularNames.data ?? [])].sort((a, b) => b.brandCount - a.brandCount || b.rowCount - a.rowCount || a.drinkName.localeCompare(b.drinkName)).slice(0, 4);
  const categoryRows = groups.data?.filter(group => !search.trim() || group.group.includes(search.trim())) ?? [];
  const withVolume = rows.filter(drink => drink.cupVolumeMl !== null && drink.cupVolumeMl > 0).length;
  const sort = filters.sort === 'sugarPer100ml' ? 'sugar' : filters.sort ?? 'sugar';
  const filterCount = (filters.brand?.length ?? 0) + (filters.caffeineStatus?.length ?? 0) + Number(!!filters.caffeine) + Number(filters.maxSugar !== undefined) + Number(filters.maxCaffeine !== undefined);
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo;
  const nearbyFilters = useMemo(() => drinkKey ? { ...filters, basis: detailBasis } : filters, [drinkKey, filters, detailBasis]);
  const back = () => returnTo ? navigate(-1) : navigate('/cafe');
  return <main className={`cafe-page ${landing ? 'cafe-landing' : ''}`}>
    {!nearbyOpen && !searchOpen && <header className="cafe-header"><div className="cafe-top"><Link to={landing ? '/' : '/cafe'}>{landing ? '1989v 랭킹 · 카페' : '‹ 음료 탐색'}</Link><ThemeToggle /></div>
      {!drinkKey && <>{drinkName && <span className="cafe-brand">{rows[0]?.drinkGroup ?? '음료'} 유형</span>}<h1>{landing ? <>오늘 마실 음료,<br />당류부터 보고 고르기</> : drinkName ?? (filters.group === '기타' ? '기타·유형 미분류' : filters.group ?? '카페 음료 비교')}</h1>{drinkName && <p className="cafe-range">{rows.length}개 브랜드 · 당류 <b>{range('sugar')}</b> · 카페인 <b>{range('caffeine')}</b></p>}</>}
    </header>}
    {nearbyOpen ? <CafeNearby filters={nearbyFilters} drinkName={drinkName ?? (drinkKey ? detail.data?.drinkName ?? detail.data?.menuName : undefined)} initialSelection={drinkKey && detail.data ? { [detail.data.brandSlug]: drinkKey } : drinkName ? Object.fromEntries(rows.map(row => [row.brandSlug, row.drinkKey])) : selected} close={() => setNearbyOpen(false)} /> : searchOpen ? <section className="cafe-search-screen" aria-label="음료 검색">
      <button type="button" onClick={() => setSearchOpen(false)}>‹ 검색 닫기</button>
      <div onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)}><Search value={search} onChange={setSearch} onSubmit={submitSearch} /></div>
      <nav className="cafe-names" aria-label="음료명 자동완성">{names.data?.map(name => <Link key={name.drinkName} onClick={() => remember(name.drinkName)} to={`/cafe/drink/${encodeURIComponent(name.drinkName)}`}><span><Highlight text={name.drinkName} query={search.trim()} /></span><small>{name.brandCount}개 브랜드</small></Link>)}</nav>
      {names.isError && <p role="alert">음료 이름을 불러오지 못했습니다. <button onClick={() => void names.refetch()}>다시 시도</button></p>}
      <h2>유형</h2><nav className="cafe-category-rows" aria-label="전체 유형">{categoryRows.map(group => <Link key={group.group} to={`/cafe?${writeCafeFilters({ group: group.group })}`}><span>{group.group === '기타' ? '기타·유형 미분류' : group.group} 유형 전체</span><small>{group.count}개 메뉴 ›</small></Link>)}</nav>
      <h2>최근 검색</h2><div className="cafe-recent">{recent.map(value => <span key={value}><button onClick={() => { remember(value); navigate(`/cafe?${writeCafeFilters({ q: value })}`); }}>{value}</button><button aria-label={`${value} 최근 검색 삭제`} onClick={() => removeRecent(value)}>×</button></span>)}</div>
      <p className="cafe-note">같은 음료는 한 줄로 모읍니다. 사이즈·온도·디카페인은 음료 페이지에서 고릅니다.</p>
    </section> : <>
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
      {landing && canNearby && <button type="button" className="cafe-nearby-hero" onClick={openNearby} aria-label="주변 카페에서 음료 찾기"><span className="cafe-map-preview" aria-hidden="true"><i>가</i><i>나</i><i>다</i><em /></span><span className="cafe-nearby-copy"><span><strong>내 주변 카페에서 찾기</strong><small>반경 1km 매장의 같은 음료를 한 번에 비교</small></span><b>위치 사용</b></span></button>}
      <button type="button" className="cafe-search-launch" onClick={openSearch}>⌕　음료 이름 검색 (바닐라라떼, 콜드브루…)</button>
      {landing ? <>
        <section className="cafe-popular"><div className="cafe-section-heading"><h2>많이 찾는 음료</h2><small>브랜드 수 기준</small></div><nav aria-label="많이 찾는 음료">{popular.map(name => <Link key={name.drinkName} to={`/cafe/drink/${encodeURIComponent(name.drinkName)}`}>{name.drinkName} <small>{name.brandCount}</small></Link>)}</nav></section>
        <section aria-label="영양 조건 바로가기"><h2>조건으로 찾기</h2><div className="cafe-quick">{[['공식 0mg', '카페인 없는 음료', { caffeineStatus: ['ZERO'] }], ['디카페인', '브랜드별 디카페인', { caffeineStatus: ['DECAF'] }], ['≤10g', '당류 적은 음료', { maxSugar: 10 }]].map(([label, caption, patch]) => <Link key={String(label)} to={`/cafe?${writeCafeFilters(patch as CafeFilters)}`}><strong>{String(label)}</strong><small>{String(caption)}</small></Link>)}</div></section>
        <section className="cafe-types" aria-labelledby="cafe-types-title"><div className="cafe-section-heading"><h2 id="cafe-types-title">유형별 둘러보기</h2><button type="button" onClick={openSearch}>전체 {groups.data?.length ?? 0}개</button></div>
          {groups.isPending ? <p role="status" className="kh-skeleton">유형 불러오는 중…</p> : groups.isError ? <p role="alert">유형을 불러오지 못했습니다. <button onClick={() => void groups.refetch()}>다시 시도</button></p> : !groups.data?.length ? <p>유형 정보가 없습니다. 메뉴명으로 검색할 수 있습니다.</p> : <nav className="cafe-category-rows" aria-label="유형별 둘러보기">{[...groups.data].sort((a, b) => { const x = popularTypes.indexOf(a.group), y = popularTypes.indexOf(b.group); return (x < 0 ? 99 : x) - (y < 0 ? 99 : y) || b.count - a.count; }).slice(0, 4).map(group => <Link key={group.group} to={`/cafe?${writeCafeFilters({ group: group.group })}`}><span>{group.group === '기타' ? '기타·유형 미분류' : group.group}</span><small>{group.count}개 ›</small></Link>)}</nav>}
        </section>
        <p className="cafe-note">{brands.data?.length ?? 0}개 브랜드 공식 영양정보 기준{brands.data?.length ? ` · 확인일 ${[...new Set(brands.data.map(brand => brand.checkedAt))].sort().join(' · ')}` : ''}. 매장·시즌에 따라 다를 수 있습니다.</p>
        <p className="cafe-note">디카페인은 0mg와 다릅니다. 미공개는 0이 아닙니다.</p>
        <details className="cafe-sources"><summary>공식 영양정보 · 출처 안내</summary>{brands.isPending ? <p>출처 확인 중…</p> : brands.isError ? <p>출처 정보를 불러오지 못했습니다. <button onClick={() => void brands.refetch()}>다시 시도</button></p> : brands.data?.map(brand => <p key={brand.brandSlug}>{brand.brandName} · <time>{brand.checkedAt}</time> {brand.sourceUrls.map(url => <a key={url} href={url} target="_blank" rel="noopener noreferrer">공식 원문 ↗ </a>)}</p>)}<p>매장 판매·가격 정보는 제공하지 않습니다.</p></details>
      </> : <>
        <div className="cafe-controls"><details className="cafe-choice"><summary>유형: {filters.group ?? '전체'}</summary><button onClick={() => update({ group: undefined })}>전체 유형</button>{groups.data?.map(group => <button key={group.group} aria-pressed={filters.group === group.group} onClick={() => update({ group: group.group })}>{group.group === '기타' ? '기타·유형 미분류' : group.group}</button>)}</details><details className="cafe-choice"><summary>온도: {filters.temperature ?? '전체'}</summary>{['', 'HOT', 'ICE'].map(value => <button key={value} aria-pressed={(filters.temperature ?? '') === value} onClick={() => update({ temperature: value || undefined })}>{value || '전체'}</button>)}</details><button type="button" onClick={() => setSheet(true)}>필터 {filterCount}</button></div>
        {groups.isError && <p className="cafe-note">유형 정보 조회 실패 <button onClick={() => void groups.refetch()}>유형 다시 시도</button></p>}{brands.isError && <p className="cafe-note">브랜드 정보 조회 실패 <button onClick={() => void brands.refetch()}>브랜드 다시 시도</button></p>}
        <div className="cafe-sort-bar"><div role="tablist" aria-label="정렬 기준">{metrics.map(metric => <button key={metric} type="button" role="tab" aria-selected={sort === metric} onClick={() => update({ sort: metric })}>{metricNames[metric]}</button>)}</div><div className="cafe-sort-options"><button type="button" onClick={() => update({ direction: filters.direction === 'desc' ? 'asc' : 'desc' })}>{metricNames[activeMetric]} {filters.direction === 'desc' ? '높은 순 ↓' : '낮은 순 ↑'}</button><Basis value={basis} onChange={value => update({ basis: value, sort })} /></div></div>
        {(filters.caffeine || (filters.caffeineStatus?.length ?? 0) > 0 || filters.maxSugar !== undefined || filters.maxCaffeine !== undefined) && <p className="cafe-note">{filters.caffeine === 'none' ? '공식 0·디카페인 포함 · ' : filters.caffeine ? `${filters.caffeine === 'zero' ? '공식 0mg' : '디카페인'} · ` : ''}{filters.caffeineStatus?.map(status => statusNames[status]).join(' · ')}{filters.maxSugar !== undefined && ` · 1회량 당류 ${filters.maxSugar}g 이하`}{filters.maxCaffeine !== undefined && ` · 1회량 카페인 ${filters.maxCaffeine}mg 이하`}</p>}
        {result.isPending ? <div aria-busy="true" role="status" className="cafe-loading">{[1, 2, 3].map(row => <div className="kh-skeleton" key={row}>음료 비교 자료 불러오는 중…</div>)}</div> : result.isError ? <p role="alert">음료를 불러오지 못했습니다. <button onClick={() => void result.refetch()}>다시 시도</button></p> : <>
          <p className="cafe-summary" role="status">{drinkName ? `${rows.length}브랜드 ·` : `전체 ${drinks.data?.totalElements ?? 0}행 ·`} {rows.length ? `${(filters.page ?? 0) * (filters.size ?? 20) + 1}–${(filters.page ?? 0) * (filters.size ?? 20) + rows.length}` : '0'}행 표시 <small>메뉴명 기반 유형 · 브랜드별 제공량 다름{basis === '100ml' ? ' · 100ml당 농도' : ''}</small></p>
          {filters.group === '기타' && <p className="cafe-note">서로 같은 메뉴를 뜻하지 않음 · 원문 분류는 상세에서 확인하세요.</p>}
          {basis === '100ml' && rows.length > 0 && <div className="cafe-note"><p>현재 페이지: 산출 가능 {withVolume}행 · 산출 불가 {rows.length - withVolume}행 (공개 용량 기준)</p>{withVolume === 0 && <p>공개 용량이 없어 100ml 비교 불가 <button type="button" onClick={() => update({ basis: 'serving', sort })}>1회 제공량으로 돌아가기</button></p>}</div>}
          {!rows.length ? <div className="cafe-empty"><p>조건에 맞는 음료가 없습니다.</p><button onClick={() => setSheet(true)}>조건 변경</button><button onClick={() => setParams(writeCafeFilters(defaultFilters))}>조건 초기화</button></div> : <>
            {drinkName && <p className="cafe-note">브랜드별 공개 기본 판을 표시합니다. 최저 수치가 아닙니다. 선택한 온도·사이즈·카페인 상태를 확인하세요.</p>}
            <ol className="cafe-cards" aria-label="음료 비교">{rows.map((drink, index) => {
              const number = cafeMetricValue(drink, activeMetric, basis);
              const maximum = Math.max(1, ...rows.map(row => cafeMetricValue(row, activeMetric, basis)).filter((value): value is number => value != null));
              const variants = comparison.data?.find(brand => brand.brandSlug === drink.brandSlug)?.variants ?? [];
              return <li className="cafe-card" key={drink.brandSlug + drink.drinkKey}>
                <div className="cafe-card-heading"><span className="cafe-rank" aria-label={`순위 ${number == null ? '미정' : index + 1}`}>{number == null ? '–' : index + 1}</span><span className="cafe-initial" aria-hidden="true">{drink.brandName.slice(0, 1)}</span><div className="cafe-card-identity"><strong>{drink.brandName}</strong><Link id={`drink-${drink.drinkKey}`} to={`/cafe/drinks/${drink.drinkKey}?basis=${basis}`} state={{ returnTo: identity }} onClick={() => positions.set(identity, { scroll: window.scrollY, focus: `drink-${drink.drinkKey}` })}>{drink.menuName}</Link><small>{metadata(drink)} · {statusNames[drink.caffeineStatus]}</small></div><section className="cafe-primary-metric"><h2>{metricNames[activeMetric]}</h2><Metric drink={drink} metric={activeMetric} basis={basis} /><span className="cafe-bar" aria-hidden="true"><i style={{ width: `${number != null ? Math.max(0, Math.min(100, number / maximum * 100)) : 0}%` }} /></span></section></div>
                <div className="cafe-secondary-metrics">{metrics.filter(metric => metric !== activeMetric).map(metric => <section key={metric}><h2>{metricNames[metric]}</h2><Metric drink={drink} metric={metric} basis={basis} /></section>)}<Link to={`/cafe/drinks/${drink.drinkKey}?basis=${basis}`} state={{ returnTo: identity }}>상세 ›</Link></div>
                {drinkName && <div className="cafe-variant-picker" role="group" aria-label={`${drink.brandName} 공개 판 전체 ${variants.length}개`}>{variants.map(variant => <button type="button" key={variant.drinkKey} aria-pressed={drink.drinkKey === variant.drinkKey} onClick={() => setSelected(previous => ({ ...previous, [drink.brandSlug]: variant.drinkKey }))}>{metadata(variant)} · {statusNames[variant.caffeineStatus]}</button>)}</div>}
              </li>;
            })}</ol>

          </>}
          {!drinkName && rows.length > 0 && <nav aria-label="결과 페이지" className="cafe-pagination"><button disabled={!filters.page} onClick={() => setParams(writeCafeFilters({ ...filters, page: (filters.page ?? 0) - 1 }))}>이전</button><span>{(filters.page ?? 0) + 1} 페이지</span><button disabled={((filters.page ?? 0) + 1) * (filters.size ?? 20) >= ((drinkName ? rows.length : drinks.data?.totalElements) ?? 0)} onClick={() => setParams(writeCafeFilters({ ...filters, page: (filters.page ?? 0) + 1 }))}>다음</button></nav>}
        </>}
        {sheet && <FilterSheet filters={filters} brands={brands.data ?? []} close={() => setSheet(false)} apply={draft => { update(draft); setSheet(false); }} />}
      </>}
    </>}
    </>}
    {canNearby && !nearbyOpen && !searchOpen && !landing && <button className="cafe-nearby-cta" type="button" aria-label="주변 카페에서 음료 찾기" disabled={!!drinkKey && !detail.data} onClick={openNearby}>내 주변 매장에서 {drinkName ?? detail.data?.drinkName ?? detail.data?.menuName ?? filters.group ?? filters.q ?? '음료'} 찾기</button>}
    <Footer />
  </main>;
}
