/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { searchRouteGas, type RouteGasSearchResponse } from '../../api/rankingApi';
import Footer from '../../components/Footer';
import ThemeToggle from '../../components/ThemeToggle';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import {
  RANK_COVERAGE_NOTE,
  RANK_DETOUR_NOTE,
  RANK_GAS_SOURCE,
  rankRouteMeta,
} from '../../seo/copy.mjs';
import { useSeo } from '../../seo/useSeo';
import { loadGoogleMaps, mapsApiKey } from '../place/googleMaps';
import { decodePolyline, formatPrice } from './rankView';
import './RankPage.css';

// ADR-0081 §7 — 경로 위 주유소 찾기.
//
// 출발·도착은 **지도 클릭**으로 받는다. 주소 자동완성(Places Autocomplete)은 세션당 과금이라
// 무료 범위 안에서 도는 이 서비스의 전제와 맞지 않는다 — 지도를 이미 띄우는 화면이라
// 클릭 두 번이면 같은 일을 한다.

type Point = { lat: number; lng: number };

const PRODUCTS = [
  { code: 'B027', label: '휘발유' },
  { code: 'D047', label: '경유' },
];

const KOREA_CENTER = { lat: 36.5, lng: 127.8 };

export default function RankRoutePage() {
  useHeritageSurface();
  useSeo(rankRouteMeta());

  const mapHost = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const routeLineRef = useRef<any>(null);

  // 출발·도착을 한 덩이로 두면 클릭 핸들러가 **직전 상태만 보고** 다음 값을 정할 수 있다.
  // 따로 두면 지도 리스너가 초기 클로저에 갇혀, 어느 쪽을 찍는 중인지 ref 로 흘려야 한다.
  const [points, setPoints] = useState<{ origin: Point | null; destination: Point | null }>({
    origin: null,
    destination: null,
  });
  const [productCode, setProductCode] = useState('B027');
  const [detourLimitMin, setDetourLimitMin] = useState(5);
  const [selfOnly, setSelfOnly] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const { origin, destination } = points;
  const picking: 'origin' | 'destination' = origin === null ? 'origin' : 'destination';
  // 키 유무는 빌드 시점에 정해진 값이라 렌더 중에 판정한다 — 효과에서 setState 로 알릴 일이 아니다
  const mapError = !mapsApiKey()
    ? '지도 키가 설정되지 않아 경로 탐색을 쓸 수 없습니다. 리더보드는 그대로 이용할 수 있습니다.'
    : loadError;

  const search = useMutation<RouteGasSearchResponse, Error>({
    mutationFn: () =>
      searchRouteGas({
        origin: { latitude: origin!.lat, longitude: origin!.lng },
        destination: { latitude: destination!.lat, longitude: destination!.lng },
        productCode,
        detourLimitMin,
        selfOnly,
        brands: [],
      }),
  });

  useEffect(() => {
    if (!mapsApiKey()) return;
    let cancelled = false;
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !mapHost.current) return;
        const map = new maps.Map(mapHost.current, {
          center: KOREA_CENTER,
          zoom: 7,
          disableDefaultUI: true,
          zoomControl: true,
        });
        mapRef.current = map;
        map.addListener('click', (event: any) => {
          const point = { lat: event.latLng.lat(), lng: event.latLng.lng() };
          // 첫 클릭 출발, 둘째 도착, 셋째부터는 새로 시작 — 다시 찍으려고 버튼을 누를 필요가 없다
          setPoints((prev) =>
            prev.origin === null || prev.destination !== null
              ? { origin: point, destination: null }
              : { ...prev, destination: point },
          );
        });
      })
      .catch(() => {
        if (!cancelled) setLoadError('지도를 불러오지 못했습니다.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 마커·경로선은 지도 객체가 소유한다 — 다시 그릴 때 이전 것을 반드시 걷어낸다.
  useEffect(() => {
    const maps = window.google?.maps;
    const map = mapRef.current;
    if (!maps || !map) return;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    routeLineRef.current?.setMap(null);
    routeLineRef.current = null;

    const pin = (point: Point, label: string) =>
      markersRef.current.push(new maps.Marker({ position: point, map, label }));

    if (origin) pin(origin, '출');
    if (destination) pin(destination, '도');

    const result = search.data;
    if (result?.encodedPolyline) {
      const path = decodePolyline(result.encodedPolyline);
      routeLineRef.current = new maps.Polyline({ path, map, strokeWeight: 4, strokeOpacity: 0.8 });
      const bounds = new maps.LatLngBounds();
      path.forEach((p) => bounds.extend(p));
      if (!bounds.isEmpty()) map.fitBounds(bounds);
    }
    result?.candidates.forEach((c, index) => {
      if (c.latitude == null || c.longitude == null) return;
      markersRef.current.push(
        new maps.Marker({
          position: { lat: c.latitude, lng: c.longitude },
          map,
          label: String(index + 1),
          title: `${c.name} · ${formatPrice(c.price)}원`,
        }),
      );
    });
  }, [origin, destination, search.data]);

  const ready = origin !== null && destination !== null;
  const result = search.data;

  return (
    <div className="rank-page">
      <header className="rank-header">
        <div className="rank-header__bar">
          <Link className="rank-header__brand kh-display" to="/">
            ← 랭킹
          </Link>
          <ThemeToggle />
        </div>
        <h1 className="rank-header__title kh-display">
          가는 길 위의 <span className="kh-display-accent">싼 주유소</span>
        </h1>
        <p className="rank-header__subtitle">
          지도를 눌러 출발지와 도착지를 찍으면 그 경로에서 조건에 맞는 주유소를 값싼 순으로 찾습니다.
        </p>
      </header>

      {mapError ? (
        <p className="rank-state kh-status-error">{mapError}</p>
      ) : (
        <>
          <div className="rank-route__picker">
            <span className={`rank-pill kh-mono${picking === 'origin' ? ' is-active' : ''}`}>
              출발 {origin ? '✓' : '— 지도를 누르세요'}
            </span>
            <span className={`rank-pill kh-mono${picking === 'destination' ? ' is-active' : ''}`}>
              도착 {destination ? '✓' : '— 지도를 누르세요'}
            </span>
            <button
              type="button"
              className="rank-pill kh-button-ghost"
              onClick={() => {
                setPoints({ origin: null, destination: null });
                search.reset();
              }}
            >
              다시 찍기
            </button>
          </div>

          <div className="rank-route__map" ref={mapHost} aria-label="경로 지도" />

          <div className="rank-toolbar">
            <label className="rank-field">
              <span className="kh-section-label">유종</span>
              <select
                className="rank-select"
                value={productCode}
                onChange={(e) => setProductCode(e.target.value)}
              >
                {PRODUCTS.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="rank-field">
              <span className="kh-section-label">이탈 허용</span>
              <select
                className="rank-select"
                value={detourLimitMin}
                onChange={(e) => setDetourLimitMin(Number(e.target.value))}
              >
                {[0, 3, 5, 10, 15].map((m) => (
                  <option key={m} value={m}>
                    {m === 0 ? '경로 위만' : `약 ${m}분`}
                  </option>
                ))}
              </select>
            </label>
            <label className="rank-check">
              <input
                type="checkbox"
                checked={selfOnly}
                onChange={(e) => setSelfOnly(e.target.checked)}
              />
              <span>셀프만</span>
            </label>
            <button
              type="button"
              className="rank-submit kh-button"
              disabled={!ready || search.isPending}
              onClick={() => search.mutate()}
            >
              {search.isPending ? '찾는 중…' : '찾기'}
            </button>
          </div>
        </>
      )}

      <main className="rank-main">
        {search.isError && (
          <p className="rank-state kh-status-error">
            {(search.error as any)?.response?.data?.error?.message ?? '경로를 찾지 못했습니다.'}
          </p>
        )}

        {result && (
          <>
            <p className="rank-route__summary kh-mono">
              {(result.distanceMeters / 1000).toFixed(1)}km · 약 {result.durationMinutes}분
              {result.averagePrice != null && ` · 경로 평균 ${formatPrice(result.averagePrice)}원`}
            </p>
            {result.candidates.length === 0 ? (
              <p className="rank-state">조건에 맞는 주유소가 없습니다. 이탈 허용을 늘려 보세요.</p>
            ) : (
              <ol className="rank-list">
                {result.candidates.map((c, index) => (
                  <li key={c.opinetId} className="rank-row kh-slab">
                    <span className="rank-row__rank kh-mono">{index + 1}</span>
                    <span className="rank-row__body">
                      <span className="rank-row__name">{c.name}</span>
                      {c.roadAddress && <span className="rank-row__addr">{c.roadAddress}</span>}
                      <span className="rank-row__tags">
                        {c.brandName && <span className="rank-tag kh-caps">{c.brandName}</span>}
                        {c.isSelf && <span className="rank-tag kh-caps is-self">셀프</span>}
                        <span className="rank-tag kh-caps">약 {c.detourMinutes}분 이탈</span>
                        {c.savingsPerLiter > 0 && (
                          <span className="rank-tag kh-caps is-save">
                            평균 대비 {c.savingsPerLiter}원 절약
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="rank-row__score kh-mono">
                      {formatPrice(c.price)}
                      <em>원/L</em>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </main>

      <Footer>
        <p>{RANK_DETOUR_NOTE}</p>
        <p>{RANK_COVERAGE_NOTE}</p>
        <p>{result?.sourceLabel ? `출처: ${result.sourceLabel}` : RANK_GAS_SOURCE}</p>
      </Footer>
    </div>
  );
}
