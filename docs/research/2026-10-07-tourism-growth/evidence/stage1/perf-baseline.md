측정 시각(KST): 2026-10-08 04:44 기준 완료 | 도구: Lighthouse 13.5.0, throttling simulate, formFactor mobile, Chrome headless(new), 세션 스크래치패드 프로필 | 표본: 3페이지 × 5회 = 15/15 완료 | 명령: `npx --yes lighthouse@13.5.0 <url> --only-categories=performance --form-factor=mobile --screenEmulation.mobile --throttling-method=simulate --output=json` (실행 사이 10초, 순차)

# S1-5 — 성능 기준선 (시뮬레이션 지표와 관측 지표를 구분)

코덱스 샌드박스에서는 Chrome 이 `Abort trap: 6` 으로 못 떠서(`lh/startup-failure.md`) 이 측정은 세션 셸에서 직접 돌렸다. 각 실행의 원본 JSON 은 `lh/<page>-run<i>.json`.

- **시뮬레이션**(`largest-contentful-paint`·`first-contentful-paint` numericValue): Lighthouse lantern 모델이 4G·CPU 4배 조건으로 계산한 값. 보고서 상단 점수의 근거.
- **관측**(`metrics.observedLargestContentfulPaint` 등): 실제 트레이스에서 읽은 값(스로틀 없음). `lcp-breakdown-insight` 의 단계 합은 이 값과 같아야 한다.
- **LCP 요소**: breakdown 에 「리소스 로드」 단계가 없으면 텍스트/비이미지로 분류. selector 는 인사이트가 노드를 주는 경우에만 적는다.

## 실행별 값

| 페이지 | 실행 | 성능 | 시뮬 LCP | 시뮬 FCP | CLS | 관측 LCP | 관측 FCP | 관측 TTFB | 분해 단계(관측) | 합 = 관측 LCP? | LCP 요소 | 전송 | 미사용 JS |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---|---:|---:|
| detail | 1 | 69 | 2.9s | 2.9s | 0.22 | 2293ms | 2293ms | 2048ms | Time to first byte 2048 + Element render delay 245 | 예 | text/other | 6,540KiB | 875KiB |
| detail | 2 | 46 | 8.7s | 4.9s | 0.22 | 1259ms | 844ms | 667ms | Time to first byte 667 + Element render delay 591 | 예 | text/other | 6,524KiB | 872KiB |
| detail | 3 | 46 | 8.7s | 5.0s | 0.22 | 1315ms | 847ms | 684ms | Time to first byte 684 + Element render delay 630 | 예 | text/other | 6,552KiB | 875KiB |
| detail | 4 | 55 | 27.0s | 8.0s | 0.00 | 2624ms | 2624ms | 510ms | Time to first byte 510 + Element render delay 2114 | 예 | text/other | 6,551KiB | 875KiB |
| detail | 5 | 46 | 8.9s | 4.9s | 0.22 | 1309ms | 876ms | 693ms | Time to first byte 693 + Element render delay 617 | 예 | text/other | 6,552KiB | 875KiB |
| hub | 1 | 35 | 18.5s | 4.8s | 0.74 | 1894ms | 697ms | 537ms | Time to first byte 537 + Resource load delay 955 + Resource load duration 398 + Element render delay 5 | 예 | image | 5,000KiB | 873KiB |
| hub | 2 | 58 | 21.9s | 4.9s | 0.05 | 2025ms | 738ms | 556ms | Time to first byte 556 + Resource load delay 1056 + Resource load duration 408 + Element render delay 6 | 예 | image | 4,994KiB | 873KiB |
| hub | 3 | 58 | 19.4s | 5.1s | 0.00 | 1984ms | 873ms | 630ms | Time to first byte 630 + Resource load delay 1029 + Resource load duration 319 + Element render delay 6 | 예 | image | 5,004KiB | 873KiB |
| hub | 4 | 58 | 22.3s | 5.1s | 0.05 | 2188ms | 736ms | 524ms | Time to first byte 524 + Resource load delay 1161 + Resource load duration 494 + Element render delay 9 | 예 | image | 4,993KiB | 873KiB |
| hub | 5 | 34 | 26.0s | 5.0s | 0.74 | 3365ms | 813ms | 562ms | Time to first byte 562 + Resource load delay 1655 + Resource load duration 302 + Element render delay 846 | 예 | image | 5,016KiB | 869KiB |
| region | 1 | 50 | 8.9s | 4.9s | 0.25 | 1505ms | 993ms | 761ms | Time to first byte 761 + Element render delay 745 | 예 | text/other | 4,371KiB | 460KiB |
| region | 2 | 82 | 3.0s | 3.0s | 0.16 | 940ms | 940ms | 742ms | Time to first byte 742 + Element render delay 198 | 예 | text/other | 4,371KiB | 462KiB |
| region | 3 | 61 | 8.4s | 5.0s | 0.09 | 1372ms | 874ms | 564ms | Time to first byte 564 + Element render delay 808 | 예 | text/other | 4,371KiB | 462KiB |
| region | 4 | 63 | 8.9s | 4.9s | 0.03 | 1420ms | 909ms | 607ms | Time to first byte 607 + Element render delay 813 | 예 | text/other | 4,371KiB | 460KiB |
| region | 5 | 56 | 19.5s | 7.8s | 0.00 | 2475ms | 2475ms | 377ms | Time to first byte 377 + Element render delay 2099 | 예 | text/other | 4,371KiB | 462KiB |

## 페이지별 중앙값 (5회)

| 페이지 | URL | 성능 | 시뮬 LCP | 시뮬 FCP | CLS | 관측 LCP | 관측 FCP | 관측 TTFB | 시뮬 LCP 범위 | 관측 LCP 범위 | LCP 요소 일치 |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|---|
| detail | https://place.1989v.com/attractions/1 | 46 | 8.7s | 4.9s | 0.22 | 1315ms | 876ms | 684ms | 2.9~27.0s | 1259~2624ms | 예 |
| hub | https://place.1989v.com/ | 58 | 21.9s | 5.0s | 0.05 | 2025ms | 738ms | 556ms | 18.5~26.0s | 1894~3365ms | 예 |
| region | https://place.1989v.com/regions/11 | 61 | 8.9s | 4.9s | 0.09 | 1420ms | 940ms | 607ms | 3.0~19.5s | 940~2475ms | 예 |

## 페이지별 관찰 (이 측정에서 확인된 사실)

- **상세·지역**: 15회 중 10회 모두 LCP 요소가 텍스트(리소스 로드 단계 없음). 관측 LCP = TTFB(377~2,048ms) + 렌더 지연(198~2,114ms). 시뮬레이션 LCP 는 2.9~27.0s 로 편차가 커서 단일 값으로 쓸 수 없다.
- **허브**: 5회 모두 LCP 요소가 **이미지**이고, 관측 LCP 의 가장 큰 단계가 「Resource load delay」(955~1,655ms) 다. 즉 이미지가 늦게 발견된다(JS 렌더 뒤 삽입). 허브에서는 LCP 이미지의 조기 발견(preload·SSR 마크업)이 실제 지렛대가 될 수 있다. 상세의 「히어로 img SSR」 주장을 철회한 것과 다른 페이지다. 허브 CLS 가 두 번 0.74 로 튀는 것도 별도 확인 대상.
- 전송량은 상세 6.5MB · 허브 5.0MB · 지역 4.4MB 로 안정적이고, 미사용 JS 절감 가능량은 Lighthouse 추정 기준 각 행 참고.

## 읽는 법 (사실만)

- 시뮬레이션 LCP 와 관측 LCP 의 차이는 lantern 의 네트워크·CPU 스로틀 모델에서 온다. 두 값은 같은 것을 설명하지 않으므로 한 표 안에서 섞지 않는다.
- 「합 = 관측 LCP」 열이 전부 「예」이면 분해값은 관측 LCP 의 구성이고, 시뮬레이션 LCP 의 구성이 아니다.
- 원인은 여기서 단정하지 않는다. 다음 측정에서 확인할 가설: ① 관측 LCP 에서 렌더 지연 비중이 큰 실행은 JS 실행/CSS 차단 ② TTFB 편차는 엣지 캐시 HIT/MISS ③ 시뮬레이션 LCP 편차는 네트워크 의존 그래프(지도·폰트·번들)의 크기.
- `<main>` 랜드마크·히어로 `<img>` SSR 은 성능 항목이 아니라 접근성·이미지 SEO·CLS 항목이다.
