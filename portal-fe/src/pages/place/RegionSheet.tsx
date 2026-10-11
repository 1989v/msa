import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAdministrativeRegions, type AdministrativeRegion, type PlaceLang } from '../../api/placeApi';
import KhSheet from '../../components/shell/KhSheet';
import { nearestRegion } from './googleMaps';

/**
 * 지역 선택 시트 — 두 폭 공통 (ADR-0071 §3). 좁은 화면은 바텀시트, 넓은 화면은 호출자가
 * `kh-sheet--dialog` 를 넘겨 가운데 다이얼로그로 띄운다.
 *
 * 칩으로 펼치면 시군구 30개가 화면 절반을 덮는 칩 벽이 된다 — 현재 선택을 트리거 버튼 하나
 * ("서울 · 강남구")로 접고, 시트 안에서 시도 → 시군구 두 단계로 내려간다. 건수는 관광 분류만 센다.
 *
 * 좌표(`origin`)가 있으면 그 위치의 시도를 시도 목록 **맨 앞으로 올리기만** 하고 「현재 위치」 표시를
 * 단다 — 자동으로 고르지 않는다. 지금 있는 곳이 곧 가려는 곳은 아니다.
 */
const UI = {
  ko: { label: '지역 선택', all: '전체 지역', allIn: '전체', back: '‹ 시·도', loading: '지역을 불러오는 중…', near: '현재 위치' },
  en: { label: 'Choose a region', all: 'All regions', allIn: 'All', back: '‹ Provinces', loading: 'Loading regions…', near: 'Near you' },
} as const;

function label(region: AdministrativeRegion, lang: PlaceLang): string {
  return (lang === 'en' && region.nameEn) || region.name;
}

export default function RegionSheet({
  lang,
  sidoCode,
  sigunguCode,
  origin,
  className,
  onChange,
  onClose,
}: {
  lang: PlaceLang;
  sidoCode: string | null;
  sigunguCode: string | null;
  /** 기기 좌표 — 가까운 시도를 앞으로 올린다 */
  origin?: { lat: number; lng: number } | null;
  /** KhSheet 변형 클래스 — 넓은 화면은 `kh-sheet--dialog` */
  className?: string;
  onChange: (next: { sidoCode: string | null; sigunguCode: string | null; region?: AdministrativeRegion }) => void;
  onClose: () => void;
}) {
  const L = UI[lang];
  // 시트 안 탐색 위치 — 선택과 별개다. 고르기 전까지는 바깥 상태를 건드리지 않는다.
  const [browseSido, setBrowseSido] = useState<string | null>(sidoCode);

  const { data: sidos, isLoading } = useQuery({
    queryKey: ['administrative-regions', 'SIDO', lang],
    queryFn: () => fetchAdministrativeRegions({ level: 'SIDO', lang }),
    staleTime: 30 * 60_000,
  });

  const { data: sigungus } = useQuery({
    queryKey: ['administrative-regions', 'SIGUNGU', browseSido, lang],
    queryFn: () => fetchAdministrativeRegions({ level: 'SIGUNGU', parent: browseSido!, lang }),
    enabled: browseSido != null,
    staleTime: 30 * 60_000,
  });

  const pick = (next: { sidoCode: string | null; sigunguCode: string | null; region?: AdministrativeRegion }) => {
    onChange(next);
    onClose();
  };

  const current = browseSido ? (sidos ?? []).find((s) => s.code === browseSido) : null;
  const nearCode = origin && sidos ? (nearestRegion(sidos, origin.lat, origin.lng)?.code ?? null) : null;
  // 가까운 시도를 맨 앞으로. 정렬만 바꾸고 선택은 사용자가 한다.
  const orderedSidos = nearCode
    ? [...(sidos ?? [])].sort((a, b) => Number(b.code === nearCode) - Number(a.code === nearCode))
    : (sidos ?? []);

  return (
    <KhSheet label={L.label} onClose={onClose} className={className}>
      {isLoading && <p className="place-region-hint">{L.loading}</p>}

      {!isLoading && !current && (
        <ul className="place-region-sheet-list">
          <li>
            <button
              type="button"
              className="place-region-row kh-press"
              aria-current={sidoCode == null ? 'true' : undefined}
              onClick={() => pick({ sidoCode: null, sigunguCode: null })}
            >
              <span>{L.all}</span>
            </button>
          </li>
          {orderedSidos.map((region) => (
            <li key={region.code}>
              <button
                type="button"
                className="place-region-row kh-press"
                aria-current={region.code === sidoCode ? 'true' : undefined}
                onClick={() => setBrowseSido(region.code)}
              >
                <span>
                  {region.code === nearCode && <span className="place-region-near">{L.near}</span>}
                  {label(region, lang)}
                </span>
                <span className="place-region-row-meta">
                  {region.attractionCount != null && (
                    <span className="place-region-count">{region.attractionCount.toLocaleString()}</span>
                  )}
                  <span aria-hidden="true">›</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!isLoading && current && (
        <ul className="place-region-sheet-list">
          <li>
            <button type="button" className="place-region-row kh-press" onClick={() => setBrowseSido(null)}>
              <span className="place-region-row-back">{L.back}</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className="place-region-row kh-press"
              aria-current={sidoCode === current.code && sigunguCode == null ? 'true' : undefined}
              onClick={() => pick({ sidoCode: current.code, sigunguCode: null, region: current })}
            >
              <span>
                {label(current, lang)} {L.allIn}
              </span>
              {current.attractionCount != null && (
                <span className="place-region-count">{current.attractionCount.toLocaleString()}</span>
              )}
            </button>
          </li>
          {(sigungus ?? []).map((region) => {
            // 호출자 계약 — sigunguCode 는 시도 2자리를 뗀 나머지다(행정구역 코드 5자리 중 뒤 3자리)
            const shortCode = region.code.slice(2);
            return (
              <li key={region.code}>
                <button
                  type="button"
                  className="place-region-row kh-press"
                  aria-current={shortCode === sigunguCode ? 'true' : undefined}
                  onClick={() => pick({ sidoCode: region.parentCode, sigunguCode: shortCode, region })}
                >
                  <span>{label(region, lang)}</span>
                  {region.attractionCount != null && (
                    <span className="place-region-count">{region.attractionCount.toLocaleString()}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </KhSheet>
  );
}
