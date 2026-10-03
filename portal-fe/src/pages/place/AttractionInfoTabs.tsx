import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { PlaceLang } from '../../api/placeApi';
import { attractionPath } from '../../seo/copy.mjs';
import { BARRIER_FREE_DETAILS, BARRIER_FREE_TITLE } from './placeAttributes';

type Tab = 'visit' | 'access' | 'region';

const UI = {
  ko: {
    visit: '방문 정보',
    region: '지역 안 위치',
    group: '관광지 정보',
    fold: '접근성 상세 접기',
    composite: '복합공간',
    sameAs: (kind: string) => `같은 장소의 ${kind} 정보`,
    kind: { '12': '관광지', '14': '문화시설', '15': '행사', '25': '여행코스', '28': '레포츠', '32': '숙박', '38': '쇼핑', '39': '음식점' } as Record<string, string>,
    other: '다른',
  },
  en: {
    visit: 'At a glance',
    region: 'In the area',
    group: 'About this place',
    fold: 'Hide accessibility details',
    composite: 'Multi-use place',
    sameAs: (kind: string) => `${kind} listing for this place`,
    kind: { '76': 'Attraction', '78': 'Culture', '85': 'Event', '75': 'Leisure', '80': 'Stay', '79': 'Shopping', '82': 'Dining' } as Record<string, string>,
    other: 'Another',
  },
} as const;

/**
 * 지도 위 정보 묶음 — 방문 정보 · 접근성 · 지역 안 위치를 탭 하나로, 내용은 칩으로.
 * 그릴 것이 있는 탭만 둔다. 같은 장소가 다른 유형으로도 올라와 있으면(복합공간) 지역 탭에서 그 등록으로 잇는다.
 * 서버 렌더 본문은 세 절을 그대로 쌓아 둔다(색인용) — 탭은 화면에서만 접는다.
 */
export default function AttractionInfoTabs({
  badges,
  wellness,
  accessIcons,
  accessRows,
  phrase,
  hub,
  samePlace,
  lang,
}: {
  badges: string[];
  wellness: string | null;
  accessIcons: string[];
  accessRows: Array<{ key: string; label: string; value: string }>;
  phrase: string | null;
  hub: { to: string; label: string } | null;
  samePlace: Array<{ id: string; contentTypeId?: string | null }>;
  lang: PlaceLang;
}) {
  const L = UI[lang];
  const [picked, setPicked] = useState<Tab>('visit');
  const [accessOpen, setAccessOpen] = useState(false);
  const title: Record<Tab, string> = { visit: L.visit, access: BARRIER_FREE_TITLE[lang], region: L.region };
  const has: Record<Tab, boolean> = {
    visit: badges.length > 0 || wellness != null,
    access: accessIcons.length > 0 || accessRows.length > 0,
    region: phrase != null || hub != null || samePlace.length > 0,
  };
  const tabs = (['visit', 'access', 'region'] as const).filter((t) => has[t]);
  if (tabs.length === 0) return null;
  const current = tabs.includes(picked) ? picked : tabs[0];

  return (
    <div className="place-info-tabs" data-place-section="info">
      <div className="place-tabs" role="tablist" aria-label={L.group}>
        {tabs.map((t) => (
          <button
            type="button"
            role="tab"
            key={t}
            className="place-tab"
            aria-selected={t === current}
            onClick={() => setPicked(t)}
          >
            {title[t]}
          </button>
        ))}
      </div>
      <section
        role="tabpanel"
        className="place-info-panel"
        aria-label={title[current]}
        data-place-section={current === 'access' ? 'barrier-free' : current}
        data-open={accessOpen || undefined}
      >
        {current === 'visit' && (
          <ul className="place-chip-list">
            {badges.map((b) => (
              <li key={b} className="place-info-chip">{b}</li>
            ))}
            {wellness && <li className="place-info-chip" data-place-section="wellness">{wellness}</li>}
          </ul>
        )}
        {current === 'access' && (
          <>
            <ul className="place-chip-list">
              {accessIcons.map((b) => (
                <li key={b} className="place-info-chip">{b}</li>
              ))}
              {accessRows.length > 0 && (
                <li>
                  <button
                    type="button"
                    className="place-info-chip place-info-chip-button"
                    aria-expanded={accessOpen}
                    onClick={() => setAccessOpen((v) => !v)}
                  >
                    {accessOpen ? L.fold : BARRIER_FREE_DETAILS[lang](accessRows.length)}
                  </button>
                </li>
              )}
            </ul>
            {/* 원천 문장은 펼치기 전에도 DOM 에 둔다 — 고치지 않은 원문이 읽기 도구·검색에 닿게 */}
            <dl className="place-detail-info-list place-info-detail" hidden={!accessOpen}>
              {accessRows.map((r) => (
                <div className="place-detail-info-row" key={r.key}>
                  <dt>{r.label}</dt>
                  <dd>{r.value}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
        {current === 'region' && (
          <ul className="place-chip-list">
            {phrase && <li className="place-info-chip">{phrase}</li>}
            {hub && (
              <li>
                <Link className="place-info-chip place-info-chip-link" to={hub.to}>
                  {hub.label}
                </Link>
              </li>
            )}
            {samePlace.length > 0 && <li className="place-info-chip place-info-chip-mark">{L.composite}</li>}
            {samePlace.map((s) => (
              <li key={s.id}>
                <Link className="place-info-chip place-info-chip-link" to={attractionPath(lang, s.id)}>
                  {L.sameAs((s.contentTypeId && L.kind[s.contentTypeId]) || L.other)}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
