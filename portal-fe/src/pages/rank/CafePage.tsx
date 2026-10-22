import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { fetchCafeComparison, fetchCafeDrinkNames, fetchCafeBrands, fetchCafeDrink, fetchCafeDrinks, fetchCafeGroups, fetchCafeNearbyCapability } from '../../api/rankingApi';
import type { CafeDrink, CafeFilters } from '../../api/rankingApi';
import ThemeToggle from '../../components/ThemeToggle';
import { AppInstallButton } from '../../components/shell/AppInstall';
import Footer from '../../components/Footer';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import { useSeo } from '../../seo/useSeo';
import { cafeMeta } from '../../seo/copy.mjs';
import { cafeMetric, cafeMetricValue, metricNames, metricUnits, volumeLabel, volumeExplanation, type CafeMetric } from './cafeView';
import { readCafeFilters, writeCafeFilters } from './cafeUrl';
import CafeNearby from './CafeNearby';
import { CafeSources } from './CafeSources';
import { CafeCup, CafeBrandBadge, CafeIcon } from './CafeArt';
import CafePopover from './CafePopover';
import CafeFilter from './CafeFilter';
import CafeCategoryChips from './CafeCategoryChips';
import './CafePage.css';

const metrics: CafeMetric[] = ['sugar', 'caffeine', 'kcal'];
const recentKey = 'cafe-recent-searches';
const positions = new Map<string, { scroll: number; focus: string }>();
function readRecent(): string[] { try { const value: unknown = JSON.parse(localStorage.getItem(recentKey) ?? '[]'); return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 8) : []; } catch { return []; } }
function saveRecent(values: string[]) { try { localStorage.setItem(recentKey, JSON.stringify(values)); } catch { /* Optional history in private mode. */ } }
const variantLabel = (drink: CafeDrink) => [drink.temperature, drink.sizeLabel?.replace(/\([^)]*\)/g, '').trim(), drink.cupVolumeMl != null && Number.isFinite(drink.cupVolumeMl) && drink.cupVolumeMl > 0 ? `${drink.cupVolumeMl}ml` : undefined, drink.caffeineStatus === 'DECAF' ? '디카페인' : undefined].filter(Boolean).join(' · ') || '기본 · 용량 미표시';
function Highlight({ text, query }: { text: string; query: string }) { const index = query ? text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase()) : -1; return index < 0 ? <>{text}</> : <>{text.slice(0, index)}<mark>{text.slice(index, index + query.length)}</mark>{text.slice(index + query.length)}</>; }
function Metric({ drink, metric, basis = 'serving' }: { drink: CafeDrink; metric: CafeMetric; basis?: 'serving' | '100ml' }) {
  const value = cafeMetric(drink, metric, basis);
  return <span className="cafe-metric" aria-label={`${metricNames[metric]} ${value.amount}${value.unit ?? ''}${basis === '100ml' ? ' / 100ml' : ''} ${value.status ?? ''}`}><b>{value.amount}</b>{value.unit && <small>{value.unit}</small>}{value.status && <small className="cafe-caffeine-state">{value.status}</small>}</span>;
}
function MetricCells({ drink, basis = 'serving', muted = false }: { drink: CafeDrink; basis?: 'serving' | '100ml'; muted?: boolean }) {
  return <div className={`cafe-metric-cells ${muted ? 'cafe-metric-cells--muted' : ''}`}>{metrics.map(metric => <section className={`cafe-metric-cell cafe-metric-cell--${metric}`} key={metric}><h2>{metricNames[metric]}</h2><Metric drink={drink} metric={metric} basis={basis} /></section>)}</div>;
}
function Basis({ value, onChange }: { value: 'serving' | '100ml'; onChange: (value: 'serving' | '100ml') => void }) {
  return <div className="cafe-basis" role="group" aria-label="영양정보 기준">{(['serving', '100ml'] as const).map(basis => <button key={basis} aria-pressed={value === basis} onClick={() => onChange(basis)}>{basis === 'serving' ? '1회 제공량 기준' : '100ml당 기준'}</button>)}</div>;
}
/** Returns every tied minimum using source values, excluding missing/nonfinite data. */
export function cafeMinimumRows(rows: CafeDrink[], metric: CafeMetric, basis: 'serving' | '100ml'): CafeDrink[] {
  const values = rows.map(row => cafeMetricValue(row, metric, basis)).filter((value): value is number => value != null);
  if (!values.length) return [];
  const min = Math.min(...values);
  return rows.filter(row => cafeMetricValue(row, metric, basis) === min).sort((a, b) => a.brandSlug.localeCompare(b.brandSlug) || a.drinkKey.localeCompare(b.drinkKey));
}

export default function CafePage({ nearbyEnabled, onNearbyOpen }: { nearbyEnabled?: boolean; onNearbyOpen?: () => void } = {}) {
  useHeritageSurface();
  const location = useLocation();
  const navigate = useNavigate();
  const { drinkKey, drinkName } = useParams();
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => readCafeFilters(params), [params]);
  const pathname = location.pathname.replace(/\/+$/, '');
  const filterPage = pathname === '/cafe/filter';
  const conditionResults = pathname === '/cafe/results';
  const searchPage = pathname === '/cafe/search';
  const landing = !drinkKey && !drinkName && !filterPage && !conditionResults && !searchPage && !location.search;
  const isList = !landing && !drinkKey && !drinkName && !filterPage;
  const [nearbyOpen, setNearbyOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState(filters.q ?? '');
  const [composing, setComposing] = useState(false);
  const composingRef = useRef(false);
  const [suggestion, setSuggestion] = useState('');
  const [recent, setRecent] = useState(readRecent);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [detailBasis, setDetailBasis] = useState<'serving' | '100ml'>(filters.basis ?? 'serving');
  const [detailTab, setDetailTab] = useState('nutrition');
  const [shareMessage, setShareMessage] = useState('');
  const identity = location.pathname + location.search;
  useEffect(() => { setNearbyOpen(false); setSearchOpen(false); setShareMessage(''); setSearch(readCafeFilters(new URLSearchParams(location.search)).q ?? ''); }, [identity, location.search]);
  useEffect(() => { setSelected({}); }, [drinkName]);
  useEffect(() => { setDetailBasis(readCafeFilters(new URLSearchParams(location.search)).basis ?? 'serving'); setDetailTab('nutrition'); }, [drinkKey, location.search]);
  useEffect(() => { if (composing) return; const timer = setTimeout(() => setSuggestion(search.trim()), 250); return () => clearTimeout(timer); }, [search, composing]);
  useSeo(cafeMeta({ detail: !!drinkKey || !!drinkName, drinkKey, drinkName, filtered: !!location.search || filterPage || searchPage || conditionResults }));
  const capability = useQuery({ queryKey: ['cafe', 'capability'], queryFn: fetchCafeNearbyCapability, retry: false, staleTime: 60000 });
  const canNearby = nearbyEnabled ?? capability.data?.nearbyEnabled ?? false;
  const brands = useQuery({ queryKey: ['cafe', 'brands'], queryFn: fetchCafeBrands, staleTime: 300000 });
  const groups = useQuery({ queryKey: ['cafe', 'groups'], queryFn: fetchCafeGroups, staleTime: 300000 });
  const drinks = useQuery({ queryKey: ['cafe', 'drinks', filters], queryFn: () => fetchCafeDrinks(filters), enabled: isList && !searchOpen, staleTime: 300000, refetchOnWindowFocus: false });
  const detail = useQuery({ queryKey: ['cafe', 'drink', drinkKey], queryFn: () => fetchCafeDrink(drinkKey!), enabled: !!drinkKey, retry: false });
  const comparison = useQuery({ queryKey: ['cafe', 'comparison', drinkName], queryFn: () => fetchCafeComparison(drinkName!, {}), enabled: !!drinkName, retry: false });
  // Compare returns all same-name variants; detail choices never depend on one paginated search.
  const detailVariants = useQuery({ queryKey: ['cafe', 'variants', detail.data?.drinkName], queryFn: () => fetchCafeComparison(detail.data!.drinkName!, {}), enabled: !!drinkKey && !!detail.data?.drinkName, retry: false });
  const names = useQuery({ queryKey: ['cafe', 'names', suggestion], queryFn: () => fetchCafeDrinkNames(suggestion), enabled: (landing || searchOpen || searchPage) && !composing, staleTime: 300000 });
  const popularNames = useQuery({ queryKey: ['cafe', 'names', ''], queryFn: () => fetchCafeDrinkNames(''), enabled: landing, staleTime: 300000 });
  const countFilters = { ...filters, brand: [], page: 0, size: 1 };
  const allCount = useQuery({ queryKey: ['cafe', 'total', countFilters], queryFn: () => fetchCafeDrinks(countFilters), enabled: isList && !conditionResults && !searchOpen, staleTime: 300000 });
  const brandCounts = useQueries({ queries: (brands.data ?? []).map(brand => ({ queryKey: ['cafe', 'brand-count', brand.brandSlug, countFilters], queryFn: () => fetchCafeDrinks({ ...countFilters, brand: [brand.brandSlug] }), enabled: isList && !conditionResults && !searchOpen, staleTime: 300000 })) });
  const basis = filters.basis ?? 'serving';
  const rows = (comparison.data ?? []).map(brand => brand.variants.find(variant => variant.drinkKey === selected[brand.brandSlug]) ?? brand.representative);
  const popular = [...(popularNames.data ?? [])].sort((a, b) => b.brandCount - a.brandCount || b.rowCount - a.rowCount || a.drinkName.localeCompare(b.drinkName)).slice(0, 4);
  const update = (patch: Partial<CafeFilters>) => setParams(writeCafeFilters({ ...filters, ...patch, page: 0 }));
  const goResults = (patch: CafeFilters) => navigate(`/cafe/results?${writeCafeFilters(patch)}`);
  const openSearch = () => { setSearchOpen(true); setSearch(''); };
  const remember = (value: string) => { if (!value) return; const next = [value, ...recent.filter(item => item !== value)].slice(0, 8); setRecent(next); saveRecent(next); };
  const submitSearch = () => { if (composingRef.current) return; remember(search.trim()); navigate(`/cafe/search?${writeCafeFilters({ q: search.trim() || undefined })}`); setSearchOpen(false); };
  const openNearby = () => { setNearbyOpen(true); onNearbyOpen?.(); };
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo;
  useEffect(() => {
    if (!isList || drinks.isPending) return;
    const saved = positions.get(identity); if (!saved) return;
    const frame = requestAnimationFrame(() => { document.getElementById(saved.focus)?.focus({ preventScroll: true }); window.scrollTo(0, saved.scroll); });
    return () => cancelAnimationFrame(frame);
  }, [identity, isList, drinks.isPending]);
  async function share() {
    const data = { title: drinkName ? `${drinkName} 카페별 비교` : detail.data?.menuName ?? '카페 음료 비교', url: window.location.href };
    try { if (navigator.share) { await navigator.share(data); setShareMessage('공유했습니다.'); } else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(data.url); setShareMessage('링크를 복사했습니다.'); } else setShareMessage('이 브라우저에서는 주소창의 링크를 복사해 주세요.'); }
    catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setShareMessage('공유하지 못했습니다. 주소창의 링크를 복사해 주세요.'); }
  }
  const searchForm = <form className="cafe-search" role="search" onSubmit={event => { event.preventDefault(); submitSearch(); }}>
    <CafeIcon kind="search" /><label htmlFor="cafe-search" className="cafe-sr-only">메뉴 검색</label>
    <input id="cafe-search" type="search" value={search} placeholder="마시고 싶은 음료를 검색해보세요" onChange={event => setSearch(event.target.value)} onCompositionStart={() => { composingRef.current = true; setComposing(true); }} onCompositionEnd={() => { composingRef.current = false; setComposing(false); }} onKeyDown={event => { if (event.key === 'Enter' && (event.nativeEvent.isComposing || composingRef.current)) event.preventDefault(); }} />
    <button type="submit" aria-label="검색 실행"><CafeIcon kind="search" /></button>
  </form>;
  const nearby = canNearby && <button className="cafe-nearby-hero" onClick={openNearby} aria-label="주변 카페에서 음료 찾기"><span className="cafe-nearby-pin" aria-hidden="true">⌖</span><span><strong>내 주변 카페에서 찾기</strong><small>주변 매장의 같은 음료를 비교해 보세요</small></span><span aria-hidden="true">›</span></button>;
  const suggestions = <section className="cafe-search-screen" aria-label="음료 검색"><button onClick={() => setSearchOpen(false)}>‹ 검색 닫기</button>{searchForm}<nav className="cafe-names" aria-label="음료명 자동완성">{names.data?.map(name => <Link key={name.drinkName} onClick={() => { remember(name.drinkName); setSearchOpen(false); }} to={`/cafe/drink/${encodeURIComponent(name.drinkName)}`}><span><Highlight text={name.drinkName} query={search.trim()} /></span><small>{name.brandCount}개 브랜드</small></Link>)}</nav>{names.isError && <p role="alert">음료 이름을 불러오지 못했습니다. <button onClick={() => void names.refetch()}>다시 시도</button></p>}<h2>최근 검색</h2><div className="cafe-recent">{recent.map(value => <span key={value}><button onClick={() => { setSearch(value); remember(value); setSearchOpen(false); navigate(`/cafe/search?${writeCafeFilters({ q: value })}`); }}>{value}</button><button aria-label={`${value} 최근 검색 삭제`} onClick={() => { const next = recent.filter(item => item !== value); setRecent(next); saveRecent(next); }}>×</button></span>)}</div><h2>유형별 둘러보기</h2><CafeCategoryChips label="전체 유형" /></section>;
  const toolbar = (title: string, back = '/cafe', sharing = false) => <header className="cafe-toolbar"><Link to={back} className="cafe-icon-button" aria-label="뒤로"><CafeIcon kind="back" /></Link><h1>{title}</h1>{sharing && <button className="cafe-icon-button" aria-label="공유" onClick={() => void share()}><CafeIcon kind="share" /></button>}</header>;
  const listControls = <div className="cafe-controls"><Link to={`/cafe/filter?${writeCafeFilters(filters)}`} className="cafe-icon-button" aria-label="필터"><CafeIcon kind="filter" /></Link>{conditionResults ? <CafePopover label={brands.data?.find(brand => filters.brand?.includes(brand.brandSlug))?.brandName ?? '전체 카페'}>{close => <>{[{ brandSlug: '', brandName: '전체 카페' }, ...(brands.data ?? [])].map(brand => <button key={brand.brandSlug} aria-pressed={(filters.brand?.[0] ?? '') === brand.brandSlug} onClick={() => { update({ brand: brand.brandSlug ? [brand.brandSlug] : [] }); close(); }}>{brand.brandName}</button>)}</>}</CafePopover> : null}<CafePopover label={filters.temperature ?? 'ICE/HOT'}>{close => <>{['', 'ICE', 'HOT'].map(value => <button key={value} aria-pressed={(filters.temperature ?? '') === value} onClick={() => { update({ temperature: value || undefined }); close(); }}>{value || '전체 온도'}</button>)}</>}</CafePopover>{!conditionResults && <CafePopover label={filters.sizeLabel ?? '사이즈'}>{close => <>{['', ...(drinks.data?.sizeLabels ?? [])].map(value => <button key={value} aria-pressed={(filters.sizeLabel ?? '') === value} onClick={() => { update({ sizeLabel: value || undefined }); close(); }}>{value || '전체 사이즈'}</button>)}{!drinks.data?.sizeLabels && <p>사이즈 정보를 확인 중입니다.</p>}</>}</CafePopover>}<CafePopover label="정렬">{close => <>{metrics.flatMap(metric => (['asc', 'desc'] as const).map(direction => <button key={metric + direction} aria-pressed={filters.sort === metric && filters.direction === direction} onClick={() => { update({ sort: metric, direction }); close(); }}>{metricNames[metric]} {direction === 'asc' ? '낮은 순' : '높은 순'}</button>))}<button onClick={() => { update({ basis: basis === 'serving' ? '100ml' : 'serving' }); close(); }}>{basis === 'serving' ? '100ml당' : '1회 제공량'} 기준으로</button></>}</CafePopover></div>;
  return <main className={`cafe-page ${landing ? 'cafe-landing' : ''} ${drinkName ? 'cafe-drink-page' : ''} ${conditionResults ? 'cafe-condition-results' : ''}`}>
    {nearbyOpen ? <CafeNearby filters={drinkKey ? { ...filters, basis: detailBasis } : filters} drinkName={drinkName ?? (drinkKey ? detail.data?.drinkName ?? detail.data?.menuName : undefined)} initialSelection={drinkKey && detail.data ? { [detail.data.brandSlug]: drinkKey } : drinkName ? Object.fromEntries(rows.map(row => [row.brandSlug, row.drinkKey])) : selected} close={() => setNearbyOpen(false)} /> : searchOpen ? suggestions : filterPage ? <CafeFilter filters={filters} /> : landing ? <>
      <header className="cafe-home-header"><span className="cafe-title-icon"><CafeIcon kind="cup" /></span><div><h1>카페 음료 비교</h1><p>내게 맞는 음료를 쉽게 찾아보세요!</p></div><AppInstallButton /><ThemeToggle /></header>
      <button className="cafe-search-launch" aria-label="음료 이름 검색" onClick={openSearch}><CafeIcon kind="search" />마시고 싶은 음료를 검색해보세요</button>
      <CafeCategoryChips />
      <section className="cafe-banner"><h2>당류, 카페인, 칼로리<br />한눈에 비교해 보세요!</h2><CafeCup name="고구마라떼" /></section>
      {nearby}
      <section className="cafe-popular"><div className="cafe-section-heading"><h2>인기 검색 음료</h2><Link to="/cafe/search">더보기 ›</Link></div><nav aria-label="많이 찾는 음료">{popular.map(name => <Link key={name.drinkName} to={`/cafe/drink/${encodeURIComponent(name.drinkName)}`}><span className="cafe-popular-art"><CafeCup name={name.drinkName} /></span><strong>{name.drinkName}</strong><small>{name.brandCount}개 브랜드</small></Link>)}</nav>{popularNames.isPending && <p role="status">인기 음료를 불러오는 중…</p>}{popularNames.isError && <p role="alert">인기 음료를 불러오지 못했습니다. <button onClick={() => void popularNames.refetch()}>다시 시도</button></p>}</section>
      <section><div className="cafe-section-heading"><h2>조건별로 찾아보기</h2><Link to="/cafe/filter">전체 조건 ›</Link></div><div className="cafe-quick">{[{ name: '당류 낮은 음료', caption: '≤10g', patch: { maxSugar: 10 }, icon: '◇', tone: 'green' }, { name: '저카페인 음료', caption: '≤50mg', patch: { maxCaffeine: 50 }, icon: '◒', tone: 'cream' }, { name: '저칼로리 음료', caption: '≤200kcal', patch: { maxKcal: 200 }, icon: '♨', tone: 'pink' }].map(tile => <button className={`cafe-quick-${tile.tone}`} key={tile.name} onClick={() => goResults(tile.patch)}><span aria-hidden="true">{tile.icon}</span><strong>{tile.name}</strong><small>({tile.caption})</small></button>)}</div></section>
      {groups.isError && <p role="alert">유형을 불러오지 못했습니다. <button onClick={() => void groups.refetch()}>다시 시도</button></p>}
      <details className="cafe-source-card"><summary>공식 영양정보 · 출처 안내</summary><p>공식 기본 레시피 기준 · 미공개는 0이 아닙니다. 디카페인은 0mg와 다릅니다.</p>{brands.data?.map(brand => <p key={brand.brandSlug}>{brand.brandName} · <time>{brand.checkedAt}</time>{brand.sourceUrls.map(url => <a key={url} href={url} target="_blank" rel="noopener noreferrer"> 공식 원문 ↗</a>)}</p>)}{brands.isError && <button onClick={() => void brands.refetch()}>출처 다시 시도</button>}</details>
    </> : drinkName ? <>
      {toolbar('메뉴 비교', '/cafe', true)}
      <section className="cafe-comparison-hero"><div className="cafe-hero-art"><CafeCup name={drinkName} group={rows[0]?.drinkGroup} /></div><div><h2>{drinkName}<br />카페별 비교</h2><p>같은 메뉴도 카페마다<br />영양정보가 달라요!</p></div></section>
      <Basis value={basis} onChange={value => update({ basis: value })} />
      {comparison.isPending ? <p role="status">음료 비교 자료 불러오는 중…</p> : comparison.isError ? <p role="alert">음료를 불러오지 못했습니다. <button onClick={() => void comparison.refetch()}>다시 시도</button></p> : !rows.length ? <p>조건에 맞는 음료가 없습니다.</p> : <>
        <div className="cafe-comparison-size"><span>사이즈 기준:</span><CafePopover label={Object.keys(selected).length ? '선택한 사이즈' : '기본 사이즈'}>{close => <><button onClick={() => { setSelected({}); close(); }}>기본 사이즈로 초기화</button>{comparison.data?.map(brand => <section key={brand.brandSlug} aria-label={`${brand.brandName} 사이즈`}><h3>{brand.brandName}</h3>{brand.variants.map(variant => <button key={variant.drinkKey} aria-pressed={(selected[brand.brandSlug] ?? brand.representative.drinkKey) === variant.drinkKey} onClick={() => { setSelected(previous => ({ ...previous, [brand.brandSlug]: variant.drinkKey })); close(); }}>{variantLabel(variant)}</button>)}</section>)}</>}</CafePopover></div>
        <table className="cafe-table"><caption className="cafe-sr-only">{drinkName} 카페별 영양정보 비교 · {basis === 'serving' ? '1회 제공량' : '100ml당'} 기준</caption><thead><tr><th scope="col">카페 / 사이즈</th>{metrics.map(metric => <th scope="col" key={metric}>{metricNames[metric]}<small>({metricUnits[metric]})</small></th>)}</tr></thead><tbody>{rows.map(drink => <Fragment key={drink.brandSlug}><tr><th scope="row"><Link className="cafe-table-brand" to={`/cafe/drinks/${drink.drinkKey}?basis=${basis}`} state={{ returnTo: identity }}><CafeBrandBadge slug={drink.brandSlug} name={drink.brandName} /><span>{drink.brandName}<small>{variantLabel(drink)}</small></span></Link></th>{metrics.map(metric => <td key={metric} className={`cafe-metric-cell--${metric}`}><Metric drink={drink} metric={metric} basis={basis} /></td>)}</tr>{cafeMinimumRows(rows, 'sugar', basis).some(row => row.drinkKey === drink.drinkKey) && <tr className="cafe-minimum-row"><td colSpan={4}><span className="cafe-minimum-badge">당류 가장 낮아요!</span></td></tr>}</Fragment>)}</tbody></table>
        <section className="cafe-recommendation"><span aria-hidden="true">✓</span><div><h2>이런 분께 추천해요!</h2>{metrics.map(metric => { const best = cafeMinimumRows(rows, metric, basis); return best.length ? <p key={metric}>{metricNames[metric]}를 줄이고 싶다면 {best.map(row => row.brandName).join(', ')} {drinkName}{best.length > 1 ? '가 공동으로 가장 낮아요.' : '가 가장 낮아요.'}</p> : <p key={metric}>{metricNames[metric]}는 공개 수치가 없어 추천할 수 없어요.</p>; })}</div></section>
        <p className="cafe-note">선택한 {basis === 'serving' ? '1회 제공량' : '100ml'} 기준 비교입니다. 브랜드별 제공량과 레시피가 다릅니다. 수치가 같은 브랜드를 모두 안내하며 미공개 값은 비교하지 않습니다.</p>
      </>}
      <button className="cafe-search-link" aria-label="음료 이름 검색" onClick={openSearch}><CafeIcon kind="search" />다른 음료 검색</button>{nearby}
    </> : drinkKey ? <section className="cafe-detail" aria-label="음료 상세">
      <header className="cafe-toolbar"><button className="cafe-icon-button" aria-label={returnTo ? '비교로 돌아가기' : '음료 탐색'} onClick={() => returnTo ? navigate(-1) : navigate('/cafe')}><CafeIcon kind="back" /></button><span className="cafe-toolbar-spacer" /><button className="cafe-icon-button" aria-label="공유" onClick={() => void share()}><CafeIcon kind="share" /></button></header>
      {detail.isPending ? <p role="status">음료 정보를 불러오는 중…</p> : detail.isError ? <div role="alert"><h1>{(detail.error as { response?: { status?: number } }).response?.status === 404 ? '이 음료를 찾을 수 없습니다' : '음료 정보를 불러오지 못했습니다'}</h1><button onClick={() => void detail.refetch()}>다시 시도</button></div> : detail.data && <>
        <section className="cafe-detail-hero"><div className="cafe-hero-art"><CafeCup name={detail.data.menuName} group={detail.data.drinkGroup} /></div><div><p>{detail.data.brandName}</p><h1>{detail.data.menuName}</h1><CafePopover label={variantLabel(detail.data)}>{close => <>{(detailVariants.data?.find(brand => brand.brandSlug === detail.data!.brandSlug)?.variants ?? [detail.data]).map(variant => <button key={variant.drinkKey} aria-pressed={variant.drinkKey === drinkKey} onClick={() => { navigate(`/cafe/drinks/${variant.drinkKey}?basis=${detailBasis}`, { replace: true, state: location.state }); close(); }}>{variantLabel(variant)}</button>)}{detailVariants.isError && <button onClick={() => void detailVariants.refetch()}>다른 사이즈 다시 불러오기</button>}</>}</CafePopover></div></section>
        <MetricCells drink={detail.data} basis={detailBasis} /><p className="cafe-metric-basis-label">{detailBasis === 'serving' ? '1회 제공량 기준' : '100ml당 기준 · 한 잔 섭취량과 다릅니다'}</p>
        <div role="tablist" aria-label="음료 상세 정보" className="cafe-detail-tabs">{[{ value: 'nutrition', label: '영양정보' }, { value: 'sizes', label: '사이즈별 정보' }, ...(detail.data.notes?.trim() ? [{ value: 'description', label: '제품 설명' }] : [])].map(tab => <button key={tab.value} role="tab" id={`cafe-tab-${tab.value}`} aria-controls="cafe-detail-panel" aria-selected={detailTab === tab.value} tabIndex={detailTab === tab.value ? 0 : -1} onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const tabs = Array.from(event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
          const index = tabs.indexOf(event.currentTarget);
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
          tabs[next].focus(); tabs[next].click();
        }} onClick={() => setDetailTab(tab.value)}>{tab.label}</button>)}</div>
        <section className="cafe-nutrition" id="cafe-detail-panel" role="tabpanel" aria-labelledby={`cafe-tab-${detailTab}`}>
          {detailTab === 'nutrition' ? <><div className="cafe-section-heading"><h2>영양정보</h2><small>1회 제공량 기준 · {volumeLabel(detail.data)}</small></div><dl className="cafe-facts">{metrics.map(metric => <div key={metric}><dt>{metricNames[metric]}</dt><dd><Metric drink={detail.data!} metric={metric} /></dd></div>)}</dl><h3>100ml당 영양정보</h3><MetricCells drink={detail.data} basis="100ml" muted /><Basis value={detailBasis} onChange={setDetailBasis} /><details><summary>추가 영양성분</summary><dl className="cafe-facts">{[['나트륨', detail.data.sodiumMg, 'mg'], ['탄수화물', detail.data.carbsG, 'g'], ['지방', detail.data.fatG, 'g'], ['포화지방', detail.data.satFatG, 'g'], ['단백질', detail.data.proteinG, 'g']].map(([name, value, unit]) => <div key={String(name)}><dt>{name}</dt><dd>{typeof value !== 'number' || !Number.isFinite(value) ? '미공개' : `${value} ${unit}`}</dd></div>)}</dl>{detail.data.allergens && <p>알레르기: {detail.data.allergens}</p>}</details></> : detailTab === 'sizes' ? <><h2>사이즈별 정보</h2>{detailVariants.isPending && detail.data.drinkName && <p role="status">사이즈 정보를 불러오는 중…</p>}<ul className="cafe-size-list">{(detailVariants.data?.find(brand => brand.brandSlug === detail.data!.brandSlug)?.variants ?? [detail.data]).map(variant => <li key={variant.drinkKey}><Link to={`/cafe/drinks/${variant.drinkKey}?basis=${detailBasis}`} replace state={location.state}>{variantLabel(variant)}</Link><MetricCells drink={variant} /></li>)}</ul>{detail.data.volumeSource === 'BRAND_SIZE_TABLE' && <p className="cafe-note">{volumeExplanation}</p>}</> : <><h2>제품 설명</h2><p>{detail.data.notes}</p></>}
        </section>
        <section className="cafe-source-card"><h2>출처</h2><CafeSources drink={detail.data} /></section>
        <p className="cafe-note">{detail.data.priceKrw == null ? '공식 미공개 · 가격 정보 미제공' : `${detail.data.priceKrw.toLocaleString()}원`}. 브랜드 기본 레시피 기준이며 매장별 판매 여부는 확인되지 않았습니다.</p>{nearby}
      </>}
    </section> : <>
      {conditionResults ? toolbar('조건 검색 결과', `/cafe/filter?${writeCafeFilters(filters)}`) : <header className="cafe-search-toolbar"><Link to="/cafe" className="cafe-icon-button" aria-label="카페 홈으로"><CafeIcon kind="back" /></Link>{searchForm}</header>}
      {conditionResults && <div className="cafe-condition-chips" aria-label="적용된 조건">{([{ key: 'maxSugar', label: '당류', unit: 'g' }, { key: 'maxCaffeine', label: '카페인', unit: 'mg' }, { key: 'maxKcal', label: '칼로리', unit: 'kcal' }] as const).map(chip => filters[chip.key] !== undefined && <button key={chip.key} onClick={() => update({ [chip.key]: undefined })}>{chip.label} ≤ {filters[chip.key]}{chip.unit}<span aria-label="조건 삭제">×</span></button>)}{filters.caffeine && <button onClick={() => update({ caffeine: undefined })}>{filters.caffeine === 'decaf' ? '디카페인' : filters.caffeine === 'zero' ? '공식 0mg' : '공식 0·디카페인'} ×</button>}{filters.group && <button onClick={() => update({ group: undefined })}>{Array.isArray(filters.group) ? filters.group.join(' · ') : filters.group} ×</button>}</div>}
      <CafeCategoryChips filters={filters} path={conditionResults ? "/cafe/results" : "/cafe/search"} />
      {!conditionResults && <nav className="cafe-brand-tabs" aria-label="카페별 검색 결과"><button aria-pressed={!filters.brand?.length} onClick={() => update({ brand: [] })}>전체 {allCount.isError ? '조회 실패' : allCount.data?.totalElements ?? '…'}</button>{brands.data?.map((brand, i) => brandCounts[i].isSuccess && brandCounts[i].data.totalElements === 0 ? null : <button key={brand.brandSlug} aria-pressed={filters.brand?.includes(brand.brandSlug) ?? false} onClick={() => update({ brand: [brand.brandSlug] })}>{brand.brandName} {brandCounts[i].isError ? '조회 실패' : brandCounts[i].data?.totalElements ?? '…'}</button>)}</nav>}
      {listControls}
      {groups.isError && <p className="cafe-note">유형 정보 조회 실패 <button onClick={() => void groups.refetch()}>유형 다시 시도</button></p>}
      <div className="cafe-result-heading"><span role="status">{drinks.isPending ? '음료를 불러오는 중…' : drinks.isError ? '검색 결과를 확인할 수 없습니다' : `검색 결과 ${drinks.data?.totalElements ?? 0}개`}</span><small>{basis === 'serving' ? '1회 제공량 기준' : '100ml당 기준'}</small></div>
      {drinks.isPending ? <div aria-busy="true" className="cafe-loading">{[1, 2, 3].map(row => <div key={row} />)}</div> : drinks.isError ? <p role="alert">음료를 불러오지 못했습니다. <button onClick={() => void drinks.refetch()}>다시 시도</button></p> : !drinks.data?.content.length ? <div className="cafe-empty"><p>조건에 맞는 음료가 없습니다.</p><Link to="/cafe/filter">조건 변경</Link><Link to="/cafe/search">조건 초기화</Link></div> : <>
        <ol className="cafe-cards" aria-label="음료 비교">{drinks.data.content.map(drink => <li key={drink.drinkKey}><Link className="cafe-result-card" id={`drink-${drink.drinkKey}`} to={`/cafe/drinks/${drink.drinkKey}?basis=${basis}`} state={{ returnTo: identity }} onClick={() => positions.set(identity, { scroll: window.scrollY, focus: `drink-${drink.drinkKey}` })}><div className="cafe-card-art"><CafeCup name={drink.menuName} group={drink.drinkGroup} /></div><div className="cafe-card-content"><div className="cafe-card-heading"><CafeBrandBadge slug={drink.brandSlug} name={drink.brandName} /><div><span>{drink.brandName}</span><h2>{drink.menuName}</h2></div></div><p className="cafe-card-size">{variantLabel(drink)}</p><MetricCells drink={drink} basis={basis} muted={conditionResults} /></div></Link></li>)}</ol>
        <nav aria-label="결과 페이지" className="cafe-pagination"><button disabled={!filters.page} onClick={() => setParams(writeCafeFilters({ ...filters, page: (filters.page ?? 0) - 1 }))}>이전</button><span>{(filters.page ?? 0) + 1} 페이지</span><button disabled={((filters.page ?? 0) + 1) * (filters.size ?? 20) >= drinks.data.totalElements} onClick={() => setParams(writeCafeFilters({ ...filters, page: (filters.page ?? 0) + 1 }))}>다음</button></nav>
      </>}
      {basis === '100ml' && !!drinks.data?.content.length && <p className="cafe-note">공개된 양수 용량이 있는 음료만 100ml당 산출할 수 있습니다. 산출 불가는 0이 아닙니다.</p>}
      {nearby}
    </>}
    {shareMessage && <p role="status" className="cafe-share-message">{shareMessage}</p>}
    {!nearbyOpen && !filterPage && <Footer />}
  </main>;
}
