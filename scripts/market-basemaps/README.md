# 시장 바탕 이미지

MapLibre GL JS **4.7.1**(unpkg) + OpenFreeMap **positron / fiord**를 전용 헤드리스 Chrome에서 렌더한다. 웹페이지 UI 조작이나 사용자 Chrome 연결 없이 임시 프로필·로컬 HTTP 서버를 만들고 종료 시 제거한다. Node 22 이상, Google Chrome, curl이 필요하다. Linux 표준 경로와 macOS `/Applications/Google Chrome.app`을 탐지하며 다른 위치는 `CHROME_BIN`으로 지정한다. Chrome이 없으면 명시적으로 실패한다.

```sh
cd scripts/market-basemaps
npm install --no-package-lock --ignore-scripts
cd ../..
node scripts/market-basemaps/render.mjs --only 132180,132183 --theme light --out ./out
```

`--only`는 쉼표·공백 구분 contentId, 생략하면 공개 `/api/v1/place/markets/content-ids` 전체다. `--theme light|dark|both` 기본 both. 상세는 `/{contentId}?lang=ko`의 `success/data` envelope를 읽는다. **로컬 기본 실행은 파일만 쓴다. PAR 환경변수가 있어도 `--upload` 없이는 업로드하지 않는다.** 생성물은 `out/markets/{contentId}/z18-{light|dark}.png`, `index-{theme}.json`, 집계 `index.json`이다. 출력 디렉터리는 실행마다 비어 있는 별도 경로를 권장한다.

계약: **1536 × 1152 px, deviceScaleFactor 1, Web Mercator, zoom 18, bearing/pitch 0**. 중심은 `boundary.polygon`의 `[lat,lng]` 꼭짓점 산술평균(끝의 중복 닫힘 점 제외), 경계가 없으면 `market.latitude/longitude`다. 잘못된 경계·결측 좌표를 0으로 바꾸지 않는다. 컨트롤·로고·출처·핀·경계 등 오버레이는 이미지에 없다. FE가 출처를 표시한다. map idle + style/전체 tile 로딩 후 두 animation frame을 기다려 캡처한다. 타일·glyph·style 오류 및 시간 초과는 시장별 최대 **3회** 시도한다. API 25초, 렌더 90초, CDP 15초, Chrome 시작 20초, PUT 120초로 제한한다.

## 운영

`.github/workflows/market-basemaps.yml`: 매주 일요일 UTC 20:00(월요일 KST 05:00), 수동 실행은 `contentIds`(공백 구분, 공란 전체), `theme`(기본 both). light/dark 잡은 PNG만 업로드하고 실패율 초과 시에도 manifest artifact를 남긴다. 마지막 잡이 선택된 테마들을 합쳐 **한 번만** `markets/index.json`을 업로드한다. 고정 concurrency group과 `cancel-in-progress: false`로 실행 간 덮어쓰기를 직렬화한다. 실행당 잡 제한 300분.

버킷 공개 읽기를 설정하고, 객체 쓰기가 가능한 **버킷 범위 PAR**을 발급해 저장소 Actions secret `MARKET_BASEMAP_PAR`에 전체 HTTPS URL(`/o/`로 끝남)을 넣는다. 백업 PAR과 별개로 관리하고 만료 전 교체한다. PAR에 `markets/{contentId}/z18-{theme}.png`를 덧붙여 `curl -fsS -X PUT -H Content-Type:image/png --data-binary @file`로 쓴다. JSON도 같은 PUT이다. PAR은 로그·오류에 출력하지 않는다. 공개 읽기 prefix:

`https://objectstorage.ap-chuncheon-1.oraclecloud.com/n/axyooxbyk5yv/b/msa-market-basemap/o/`

명시적 업로드는 렌더 명령에 `--upload`를 붙인다. `--merge-index --theme both --out ./out --upload`가 manifest들을 검증·집계하고 최종 index를 게시한다. CI와 같은 분리 방식이며 렌더 단계는 원격 index를 쓰지 않는다.

index 계약은 `{renderedAt, styleVersion, theme, requestedContentIds, contentIds, failed, themes}`. `requestedContentIds`는 요청한 고유 시장 전체, `contentIds`는 **선택된 모든 테마가 성공한** 시장, `failed`는 `{contentId,error,theme}`별 실패다. `themes.light|dark`에 테마별 시각·요청·성공·실패를 보존한다. 오류는 URL 비밀값을 담지 않는다. 테마별 실패 시장 / 요청 시장이 **5% 초과**면 manifest와 최종 index를 쓴 뒤 exit 1; 정확히 5%는 허용한다. 빈 전체 목록은 실패한다. 성공 PNG는 보존하며 실패 객체의 이전 버전은 삭제하지 않는다. index는 최신 실행 결과이며 버킷 전체 존재 목록이 아니다. 테마 artifact가 누락되면 최종 index를 게시하지 않는다. 원천 스타일 URL은 고정 snapshot이 아니므로 `styleVersion`은 렌더 설정 버전이며 실제 데이터 고정 버전은 아니다.

## 출처·라이선스

화면에 **OpenFreeMap · OpenMapTiles · © OpenStreetMap contributors**와 각각의 링크를 표시해야 한다([OpenFreeMap](https://openfreemap.org/), [OpenMapTiles](https://openmaptiles.org/), [OSM 저작권/ODbL](https://www.openstreetmap.org/copyright)). OpenMapTiles 스타일은 BSD 3-Clause / CC BY 4.0, OSM 데이터는 ODbL 1.0, MapLibre GL JS는 BSD 3-Clause다. 이미지는 OSM 데이터에서 만든 Produced Work이며 원천 데이터 재배포의 라이선스와 구별한다. PNG에서 출처를 숨기는 것은 FE의 가시적 출처 표기를 전제로 한다. 네이버·카카오·구글 지도 이미지를 저장하지 않는다.
