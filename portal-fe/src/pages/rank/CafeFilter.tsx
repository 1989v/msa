import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { fetchCafeDrinks, type CafeFilters } from '../../api/rankingApi';
import { writeCafeFilters } from './cafeUrl';
import { CafeIcon } from './CafeArt';

const conditions = [
  { key: 'maxSugar', name: '당류', unit: 'g', max: 50, step: 1, presets: [5, 10, 20, 30] },
  { key: 'maxCaffeine', name: '카페인', unit: 'mg', max: 200, step: 5, presets: [0, 50, 100] },
  { key: 'maxKcal', name: '칼로리', unit: 'kcal', max: 500, step: 10, presets: [100, 200, 300] },
] as const;
export default function CafeFilter({ filters }: { filters: CafeFilters }) {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<CafeFilters>(() => ({ ...filters, maxSugar: filters.maxSugar ?? 10, maxCaffeine: filters.maxCaffeine ?? 50, maxKcal: filters.maxKcal ?? 200, page: 0 }));
  const [tab, setTab] = useState('당류');
  const [debounced, setDebounced] = useState(draft);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  useEffect(() => { const timer = setTimeout(() => setDebounced(draft), 300); return () => clearTimeout(timer); }, [draft]);
  const current = JSON.stringify(draft) === JSON.stringify(debounced);
  const count = useQuery({ queryKey: ['cafe', 'count', debounced], queryFn: () => fetchCafeDrinks({ ...debounced, page: 0, size: 1 }), retry: false });
  return <section className="cafe-filter-page" aria-label="조건으로 찾기">
    <header className="cafe-toolbar"><Link to="/cafe" className="cafe-icon-button" aria-label="카페 홈으로"><CafeIcon kind="back" /></Link><h1>조건으로 찾기</h1></header>
    <div className="cafe-tabs" role="group" aria-label="조건 종류">{['당류', '카페인', '칼로리', '디카페인'].map(name => <button key={name} aria-pressed={tab === name} onClick={() => { setTab(name); sectionRefs.current[name]?.scrollIntoView?.({ block: 'center', behavior: 'auto' }); }}>{name}</button>)}</div>
    {conditions.map(condition => <section className="cafe-condition" key={condition.key} ref={element => { sectionRefs.current[condition.name] = element; }}>
      <label htmlFor={`cafe-${condition.key}`}><b>{condition.name} 조건</b> <span>({condition.unit})</span></label>
      <strong>{draft[condition.key]}{condition.unit} 이하</strong>
      <input id={`cafe-${condition.key}`} type="range" min="0" max={Math.max(condition.max, draft[condition.key] ?? 0)} step={(draft[condition.key] ?? 0) % condition.step === 0 ? condition.step : 'any'} value={draft[condition.key] ?? 0} aria-valuetext={`${draft[condition.key]}${condition.unit} 이하`} onChange={event => setDraft(previous => ({ ...previous, [condition.key]: Number(event.target.value) }))} />
      <div className="cafe-range-labels"><span>0{condition.unit}</span><span>{Math.max(condition.max, draft[condition.key] ?? 0)}{condition.unit}</span></div>
      <div className="cafe-presets">{condition.presets.map(value => <button key={value} aria-pressed={draft[condition.key] === value} onClick={() => setDraft(previous => ({ ...previous, [condition.key]: value }))}>{value}{condition.unit} 이하</button>)}</div>
    </section>)}
    <section className="cafe-condition" ref={element => { sectionRefs.current['디카페인'] = element; }}>
      <h2>디카페인</h2><label className="cafe-check"><input type="checkbox" checked={draft.caffeine === 'decaf'} onChange={event => setDraft(previous => ({ ...previous, caffeine: event.target.checked ? 'decaf' : undefined, caffeineStatus: [] }))} />디카페인 음료만 보기</label>
      <p className="cafe-note">디카페인은 0mg와 다릅니다. 미공개 수치는 상한 검색에서 제외됩니다. 조건은 1회 제공량 기준입니다.</p>
    </section>
    <div className="cafe-filter-dock"><button className="cafe-primary-button" disabled={!current || count.isFetching || !count.data || count.isError} onClick={() => navigate(`/cafe/results?${writeCafeFilters(draft)}`)}>조건에 맞는 음료 찾기 {count.isError ? '(조회 실패)' : !current || count.isFetching ? '(확인 중…)' : `(${count.data?.totalElements ?? 0}개)`}</button>{count.isError && <p role="alert">개수를 불러오지 못했습니다. <button onClick={() => void count.refetch()}>다시 시도</button></p>}</div>
  </section>;
}
