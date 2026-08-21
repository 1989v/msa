import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAdminRegions, type AdminRegion, type PlaceLang } from '../../api/placeApi';
import KhSheet from '../../components/shell/KhSheet';

/**
 * 지역 선택 바텀시트 (모바일 <900px 전용).
 *
 * 데스크톱의 칩 드릴다운(RegionDrilldown)은 시군구 30개가 화면 절반을 덮는 칩 벽이 되어
 * 좁은 화면에 맞지 않는다 — 현재 선택을 트리거 버튼 하나("서울 · 강남구")로 접고,
 * 시트 안에서 시도 → 시군구 두 단계로 내려간다. 데이터 계약과 건수 규칙은
 * RegionDrilldown 과 동일하다 (관광 분류만 센다, ADR-0071 §3).
 */
const UI = {
  ko: { label: '지역 선택', all: '전체 지역', allIn: '전체', back: '‹ 시·도', loading: '지역을 불러오는 중…' },
  en: { label: 'Choose a region', all: 'All regions', allIn: 'All', back: '‹ Provinces', loading: 'Loading regions…' },
} as const;

function label(region: AdminRegion, lang: PlaceLang): string {
  return (lang === 'en' && region.nameEn) || region.name;
}

export default function RegionSheet({
  lang,
  sidoCode,
  sigunguCode,
  onChange,
  onClose,
}: {
  lang: PlaceLang;
  sidoCode: string | null;
  sigunguCode: string | null;
  onChange: (next: { sidoCode: string | null; sigunguCode: string | null; region?: AdminRegion }) => void;
  onClose: () => void;
}) {
  const L = UI[lang];
  // 시트 안 탐색 위치 — 선택과 별개다. 고르기 전까지는 바깥 상태를 건드리지 않는다.
  const [browseSido, setBrowseSido] = useState<string | null>(sidoCode);

  const { data: sidos, isLoading } = useQuery({
    queryKey: ['admin-regions', 'SIDO', lang],
    queryFn: () => fetchAdminRegions({ level: 'SIDO', lang }),
    staleTime: 30 * 60_000,
  });

  const { data: sigungus } = useQuery({
    queryKey: ['admin-regions', 'SIGUNGU', browseSido, lang],
    queryFn: () => fetchAdminRegions({ level: 'SIGUNGU', parent: browseSido!, lang }),
    enabled: browseSido != null,
    staleTime: 30 * 60_000,
  });

  const pick = (next: { sidoCode: string | null; sigunguCode: string | null; region?: AdminRegion }) => {
    onChange(next);
    onClose();
  };

  const current = browseSido ? (sidos ?? []).find((s) => s.code === browseSido) : null;

  return (
    <KhSheet label={L.label} onClose={onClose}>
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
          {(sidos ?? []).map((region) => (
            <li key={region.code}>
              <button
                type="button"
                className="place-region-row kh-press"
                aria-current={region.code === sidoCode ? 'true' : undefined}
                onClick={() => setBrowseSido(region.code)}
              >
                <span>{label(region, lang)}</span>
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
            // 호출자 계약은 RegionDrilldown 과 동일 — sigunguCode 는 시도 2자리를 뗀 나머지다
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
