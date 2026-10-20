import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchCafeBrands, fetchCafeDrinks, fetchCafeGroups } from '../../api/rankingApi';
import type { CafeDrink, CafeFilters } from '../../api/rankingApi';
import ThemeToggle from '../../components/ThemeToggle';
import Footer from '../../components/Footer';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import { caffeineLabel, isCaffeineNone } from './cafeView';
import { readCafeFilters, writeCafeFilters } from './cafeUrl';
import './RankPage.css';
import './CafePage.css';

const quantity = (value: number | null, unit: string) => value === null ? '미공개' : `${value} ${unit}`;
function DrinkTable({ drinks }: { drinks: CafeDrink[] }) {
  return <div className="cafe-table-scroll"><table className="kh-table cafe-table">
    <caption>기본 레시피 1회 제공량 기준 · 미공개는 0이 아닙니다</caption>
    <thead><tr>{['브랜드', '메뉴', '온도', '사이즈', '용량', '당류', '카페인', '열량', '당류/100ml', '출처·확인일'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
    <tbody>{drinks.map(drink => <tr key={[drink.brandSlug, drink.menuName, drink.temperature, drink.sizeLabel, drink.caffeineStatus].join('|')}>
      <td>{drink.brandName}</td><th scope="row">{drink.menuName}</th><td>{drink.temperature ?? '미표시'}</td>
      <td>{drink.sizeLabel ?? '미표시'}</td><td>{quantity(drink.volumeMl, 'ml')}</td>
      <td>{quantity(drink.sugarG, 'g')}</td><td>{caffeineLabel(drink)}</td><td>{quantity(drink.kcal, 'kcal')}</td>
      <td>{drink.sugarPer100ml === null ? '산출 불가' : `${drink.sugarPer100ml} g`}</td>
      <td><a href={drink.sourceUrl} target="_blank" rel="noopener noreferrer">공식 원문</a><br /><time>{drink.checkedAt}</time></td>
    </tr>)}</tbody>
  </table></div>;
}

export default function CafePage() {
  useHeritageSurface();
  const [params, setParams] = useSearchParams();
  const filters = readCafeFilters(params);
  const setFilters = (change: (previous: CafeFilters) => CafeFilters) => setParams(writeCafeFilters(change(filters)));
  const update = (patch: Partial<CafeFilters>) => setFilters(previous => ({ ...previous, ...patch, page: 0 }));
  const brands = useQuery({ queryKey: ['cafe', 'brands'], queryFn: fetchCafeBrands });
  const groups = useQuery({ queryKey: ['cafe', 'groups'], queryFn: fetchCafeGroups });
  const drinks = useQuery({ queryKey: ['cafe', 'drinks', filters], queryFn: () => fetchCafeDrinks(filters) });
  const rows = (drinks.data?.content ?? []).filter(drink => filters.caffeine !== 'none' || isCaffeineNone(drink.caffeineStatus));
  const comparison = Array.from(new Set(rows.map(drink => drink.brandSlug)));
  return <main className="rank-page cafe-page">
    <header className="rank-header">
      <div className="rank-header__bar"><Link to="/" className="rank-header__brand">랭킹</Link><ThemeToggle /></div>
      <h1 className="rank-header__title kh-display">카페 음료 비교</h1>
      <p className="rank-header__subtitle">공식 영양정보 기준 · 기본 레시피 · 참고용이며 의료 상담이 아님</p>
      <p>디카페인에도 카페인이 남을 수 있습니다. 미공개·수치 미확정 항목은 수치 상한 검색에서 제외됩니다.</p>
    </header>
    <section className="rank-toolbar" aria-label="음료 검색 필터">
      <label className="rank-field">메뉴 검색<input className="rank-select" type="search" value={filters.q ?? ''} onChange={event => update({ q: event.target.value })} /></label>
      <fieldset className="cafe-brands"><legend>브랜드 (복수 선택)</legend>{brands.data?.map(brand => <label key={brand.brandSlug}>
        <input type="checkbox" checked={filters.brand?.includes(brand.brandSlug) ?? false} onChange={event => update({ brand: event.target.checked ? [...(filters.brand ?? []), brand.brandSlug] : filters.brand?.filter(value => value !== brand.brandSlug) })} />{brand.brandName} ({brand.count})
      </label>)}</fieldset>
      <label className="rank-field">유형<select className="rank-select" value={filters.group ?? ''} onChange={event => update({ group: event.target.value || undefined })}>
        <option value="">전체</option>{groups.data?.map(group => <option key={group.group} value={group.group}>{group.group} ({group.count})</option>)}
      </select></label>
      <label className="rank-field">온도<select className="rank-select" value={filters.temperature ?? ''} onChange={event => update({ temperature: event.target.value || undefined })}><option value="">전체</option><option value="HOT">HOT</option><option value="ICE">ICE</option></select></label>
      <fieldset><legend>당류 상한</legend>{[10, 25, 50].map(value => <button type="button" className="kh-button-ghost" key={value} aria-pressed={filters.maxSugar === value} onClick={() => update({ maxSugar: filters.maxSugar === value ? undefined : value })}>{value}g 이하</button>)}</fieldset>
      <label><input type="checkbox" checked={filters.caffeine === 'none'} onChange={event => update({ caffeine: event.target.checked ? 'none' : undefined })} />카페인 없음 (디카페인·0)</label>
      <label className="rank-field">낮은 순 정렬<select className="rank-select" value={filters.sort} onChange={event => update({ sort: event.target.value as CafeFilters['sort'] })}>
        <option value="sugar">당류</option><option value="caffeine">카페인</option><option value="kcal">열량</option><option value="sugarPer100ml">100ml당 당류</option>
      </select></label>
    </section>
    {drinks.isError && <p role="alert">음료를 불러오지 못했습니다. <button onClick={() => void drinks.refetch()}>다시 시도</button></p>}
    {drinks.isPending ? <p role="status">불러오는 중…</p> : <>
      <p role="status">{drinks.data?.totalElements ?? 0}개 결과 · 현재 페이지 {rows.length}개{filters.group && ' · 유형별 브랜드 비교'}</p>
      {!drinks.isError && rows.length === 0 && <p>조건에 맞는 음료가 없습니다.</p>}
      {filters.group ? <div className="cafe-comparison">{comparison.map(brand => <section key={brand}><h2>{rows.find(drink => drink.brandSlug === brand)?.brandName}</h2><DrinkTable drinks={rows.filter(drink => drink.brandSlug === brand)} /></section>)}</div> : <DrinkTable drinks={rows} />}
      <nav aria-label="결과 페이지" className="cafe-pagination">
        <button disabled={!filters.page} onClick={() => setFilters(previous => ({ ...previous, page: (previous.page ?? 0) - 1 }))}>이전</button>
        <span>{(filters.page ?? 0) + 1} 페이지</span>
        <button disabled={((filters.page ?? 0) + 1) * (filters.size ?? 50) >= (drinks.data?.totalElements ?? 0)} onClick={() => setFilters(previous => ({ ...previous, page: (previous.page ?? 0) + 1 }))}>다음</button>
      </nav>
    </>}
    <Footer />
  </main>;
}
