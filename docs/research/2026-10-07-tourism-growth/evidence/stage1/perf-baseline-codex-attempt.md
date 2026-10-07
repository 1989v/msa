측정 시도 KST: 2026-10-08T04:35:23+09:00 | 도구: Node22.22.3/npm10.9.8/Lighthouse13.5.0/Chrome154.0.8037.98 | 표본: 완료0/계획15(페이지별0/5) | 명령: bash lh/run.sh (Chrome headless + node lh/measure.mjs)

# 공개 관광 사이트 Lighthouse 기준선 — 실행 불가

Chrome headless가 시작 직후 `Abort trap: 6`으로 종료됐다. CDP 연결은 `ECONNREFUSED 127.0.0.1:9337`로 실패했으며 Lighthouse 측정은 시작되지 않았다. 설치된 도구의 버전은 확인했지만 성능 기준선은 확보하지 못했다. [실패 증거와 실행 스크립트](lh/startup-failure.md)를 보존했다. 실행 환경 제한이 원인인지는 미확인이다.

## 범위와 실행 조건

- detail: `https://place.1989v.com/attractions/1`, hub: `https://place.1989v.com/`, region: `https://place.1989v.com/regions/11`; 각 5회 계획, 완료 0회.
- 계획: Lighthouse 13.5.0, performance, mobile, screenEmulation.mobile, throttlingMethod=simulate, JSON, quiet, 실행 간 10초. fullPageScreenshot 비활성화.
- 계획 UA: `/json/version`의 Chrome UA에서 HeadlessChrome만 Chrome으로 치환. Chrome 시작 실패로 UA 값 및 실제 적용은 미확인.
- 계획 제어: 모든 CDP Fetch Request를 직렬 처리하고 HTTPS place/API만 허용; 허용 요청 간 최소 250ms(초당 최대 4), 전체 2000건. 다른 호스트 요청은 차단 후 호스트·수 기록. CDP 연결 이전 종료되어 제어 및 차단은 실제 적용되지 않았다.
- 측정 코드가 보낸 대상 사이트 요청: 0건(최초 로컬 CDP 조회 실패 후 종료). 하위 리소스 요청/차단: 0건 관측. Chrome 내부 초기화 트래픽은 관측되지 않아 전체 프로세스 트래픽 총량은 미확인. npm registry 접근은 도구 설치에만 사용했다.
- 독립 프로필은 이 작업이 생성한 `lh/profile`만 사용하도록 지정했으며 종료 trap에서 삭제했다. 사용자 Chrome/MCP 프로필에 접근하지 않았다. PID 92580의 Abort 종료와 cleanup의 kill/wait 시도를 확인했다. `pgrep -fl 'Google Chrome.*headless'`는 `sysmond service not found / Cannot get process list`로 실패하여 전역 잔류 0 검증은 미확인이다.

## 예정 표본 15행

모든 시간 열 단위는 ms, score는 0–100, CLS는 무단위다. `—`는 미측정이다. lcp-breakdown-insight의 TTFB/자원 지연/자원 전송/렌더 지연과 합계는 확보되지 않았다.

| 페이지 | 회차 | 상태 | score | sim LCP | sim FCP | CLS | obs LCP | obs FCP | obs TTFB | breakdown합 | 합-obs LCP | 일치 |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| detail | 1 | 미측정 | — | — | — | — | — | — | — | — | — | 미확인 |
| detail | 2 | 미측정 | — | — | — | — | — | — | — | — | — | 미확인 |
| detail | 3 | 미측정 | — | — | — | — | — | — | — | — | — | 미확인 |
| detail | 4 | 미측정 | — | — | — | — | — | — | — | — | — | 미확인 |
| detail | 5 | 미측정 | — | — | — | — | — | — | — | — | — | 미확인 |
| hub | 1 | 미측정 | — | — | — | — | — | — | — | — | — | 미확인 |
| hub | 2 | 미측정 | — | — | — | — | — | — | — | — | — | 미확인 |
| hub | 3 | 미측정 | — | — | — | — | — | — | — | — | — | 미확인 |
| hub | 4 | 미측정 | — | — | — | — | — | — | — | — | — | 미확인 |
| hub | 5 | 미측정 | — | — | — | — | — | — | — | — | — | 미확인 |
| region | 1 | 미측정 | — | — | — | — | — | — | — | — | — | 미확인 |
| region | 2 | 미측정 | — | — | — | — | — | — | — | — | — | 미확인 |
| region | 3 | 미측정 | — | — | — | — | — | — | — | — | — | 미확인 |
| region | 4 | 미측정 | — | — | — | — | — | — | — | — | — | 미확인 |
| region | 5 | 미측정 | — | — | — | — | — | — | — | — | — | 미확인 |

합계 일치 기준은 원본 ms 값으로 `abs(breakdown합 - observed LCP) <= 1ms`(표시 반올림 오차)로 계획했다. 실제 값이 없어 허용오차 적합 여부를 판단하지 않았다.

## 페이지별 통계와 LCP 요소

| 페이지 | n | score 중앙값 | sim LCP/FCP 중앙값 | obs LCP/FCP/TTFB 중앙값 | LCP 요소 반복성 | breakdown 각단계/obsLCP 비율 |
|---|---:|---|---|---|---|---|
| detail | 0 | 미확인 | 미확인 | 미확인 | 미확인 | 미확인 |
| hub | 0 | 미확인 | 미확인 | 미확인 | 미확인 | 미확인 |
| region | 0 | 미확인 | 미확인 | 미확인 | 미확인 | 미확인 |

lighthouseVersion/configSettings의 실측 결과, throttling 파라미터, emulatedFormFactor, metrics.items[0], lcp-breakdown-insight duration 및 node selector/nodeLabel/snippet은 모두 미확인이다. JSON 15개를 생성하지 않았고 대체값을 만들지 않았다.

`simulate`는 수집한 실행 자료에 설정된 네트워크·CPU 모델을 적용해 지표를 산출하는 방식이고 observed는 해당 수집 실행의 관측 지표다. 이번 실행에서는 두 값 모두 없으므로 차이·병목·성능 점수를 해석할 수 없다. 후속 가설은 측정 가능한 실행 환경에서 Chrome 시작과 CDP 연결을 확보할 수 있는지이며, 그 뒤 동일 제한으로 첫 측정부터 다시 수행해야 한다. 외부 호스트 차단이 있을 경우 콘텐츠/레이아웃/LCP가 달라질 수 있어 차단 목록을 결과와 함께 해석해야 한다.
