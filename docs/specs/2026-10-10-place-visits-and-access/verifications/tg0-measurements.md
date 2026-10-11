# TG0 원천 실측 (2026-10-11 KST)

운영 조회는 전부 `ssh msa-oci` 경유 읽기(`oci-mysql` = `ssh msa-oci` → `sudo k3s kubectl exec -n commerce mysql-0` → `mysql`, 그리고
`sudo k3s kubectl -n commerce logs`)다. 운영 쓰기 0건. 원천 파일은 스크래치패드의 빈 새 디렉터리에 받았고 파이썬은 `-I` 로 돌렸다.
원천 헤더·표본 행은 `source-sample.md` 에 있다.

## 요약

| 항목 | 결과 | 영향 |
|---|---|---|
| 0.1 원천 형식 | 철도 XLSX 1,099행 · 15열 · 313,132 B / 버스 CSV **CP949** 227,065행 · 9열 · 20,735,435 B. 둘 다 위도·경도 순 | 최대 바이트: 철도 939,396 · 버스 62,206,305 |
| 0.2 받기 (Q3) | 둘 다 **로그인 없이** 200. 철도는 고정 주소(KRIC `id=32&operation=1`), 버스는 `atchFileId` 가 든 주소 | 버스 주소는 갱신(다음 2026-10-30) 때 바뀔 가능성이 높다 → env 교체(권고안 그대로) |
| 0.3 철도 좌표계 (Q5) | **WGS84** — 운영 관광지 중 역 이름을 가진 곳 거리 3~12m, 버스(WGS84 표기) 「{역}역」 정류장과 중앙값 72m | 변환 없음 |
| 0.4 잡 메모리 | 최대 RSS: 버스 전 행을 dict 로 한꺼번에 들면 374 MiB, 2,000행 묶음 스트리밍이면 215 MiB | `limits.memory: 512Mi`(air-stations 와 같음) · 스트리밍 필수 |
| 0.5 찜 분포 | `wishlist_items` 전체 14행, ATTRACTION 4행(4대상 × 1명). **3명 이상 대상 0** | 「많이 찜한 곳」 절·찜 근거 줄은 운영에서 지금 안 나온다 → CDP 표본 없음, 컴포넌트 테스트로만 |
| 0.6 클릭 분포 | 최근 재색인: 클릭 신호 12곳, **최소 표본(5) 이상 0곳** | 「이 사이트에서 많이 누른 곳」·클릭 근거 줄도 운영 표본 없음 |
| 0.7 외지인 정의 (Q11) | 원천 정의상 **통근·통학 제외** | 근거 줄에 「통근 포함」을 붙이지 않는다 |
| 0.8 버스 연계 판정 | 이름 대응 가능(원천 도시 160개 전부 시군구로 이어짐). 대응 없는 시군구 6, 정류장 100개 미만 13 | 판정안: 이름 대응 + 시군구 정류장 수 ≥ 100 (아래, 사용자 확인 필요) |

## 0.1 · 0.2 원천 파일 받기

```bash
# 빈 새 디렉터리에 받는다
mkdir -p $SCRATCH/dl-bus && cd $SCRATCH/dl-bus
curl -sS -m 300 -L -D headers.txt -o bus.bin \
  'https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=FILE_000000003558143&fileDetailSn=1&insertDataPrcus=N'
# → 200 20735435, Content-Disposition: attachment; filename="2025정류장현황(EUCKR)_20251209.csv"

mkdir -p $SCRATCH/dl-rail && cd $SCRATCH/dl-rail
curl -sS -m 300 -L -D headers.txt -o rail.bin \
  'https://data.kric.go.kr/rips/dataset/download.file?type=filedata&id=32&operation=1'
# → 200 313132, Content-Disposition: attachment; filename="전체_도시철도역사정보_20260630.xlsx"
```

- 쿠키·Referer·키 없이 둘 다 받혔다(로그인 불필요).
- **철도 원천은 data.go.kr 판(15013205, `국가철도공단_도시광역철도_역사정보_20241231`, 1,073행)보다 KRIC 판이 새것이다**(`20260630`, 1,099행).
  data.go.kr 페이지의 「제공형태」가 이 KRIC 상세(`https://data.kric.go.kr/rips/M_01_01/detail.do?id=32`)를 가리킨다. KRIC 다운로드 주소는
  파일 이름이 아니라 `id=32&operation=1` 이라 갱신 뒤에도 같은 주소일 가능성이 높다. KRIC 상세의 「업데이트주기 없음 · 차기등록예정일 2031-12-19」는
  data.go.kr 의 「연간 · 2026-12-20」과 어긋난다 — 갱신 시점은 data.go.kr 표기를 따른다.
- 버스 주소는 첨부 파일 id(`atchFileId=FILE_000000003558143`) 를 담는다. 이 id 가 다음 등록(2026-10-30 예정) 때 바뀌는지는 그 날 뒤에야 볼 수 있다.
  페이지의 `fn_fileDataDown('15067528', 'uddi:f74b9799-…', …)` 도 판마다 다른 값으로 보인다. → **Q3 답: 로그인 불필요, 버스 주소는 갱신 때 바뀔 수 있어 env 로 둔다(권고안 유지)**.
  2026-10-30 이후 페이지의 `fileDownload.do?atchFileId=` 값을 다시 읽어 이 문서에 적는다.
- 포털 표기 행 수와 실제가 다르다: 버스 표기 206,022 ↔ 실제 227,065, 철도 data.go.kr 표기 1,073 ↔ KRIC 실제 1,099.
- 판정 스크립트: `tg0-scripts/bus_probe.py`, `rail_probe.py`(stdlib `zipfile`+`xml.etree` 로 XLSX 를 읽는다 — `place/ingest` 에 openpyxl 의존이 없다).

## 0.3 철도 좌표계 (Q5)

운영 관광지 ACTIVE 67,440행의 `(id, lang, 시군구, lat, lng, title)` 을 받아 대조했다.

```bash
ssh msa-oci 'P=$(sudo k3s kubectl -n commerce get secret mysql-root -o jsonpath="{.data.MYSQL_ROOT_PASSWORD}" | base64 -d);
  sudo k3s kubectl -n commerce exec mysql-0 -- mysql -uroot -p"$P" --default-character-set=utf8mb4 -B -N place_db -e
  "SELECT id, lang, CONCAT(ldong_regn_cd, ldong_signgu_cd), latitude, longitude, title FROM attractions WHERE status=\"ACTIVE\""' > attractions.tsv
# → 67440 행 (ko 52,140 · en 15,300)
python3 -I tg0-scripts/rail_wgs2.py rail.bin attractions.tsv bus.bin tg0-scripts
```

- 제목이 정확히 「{역}역」인 관광지는 0이라, 제목에 「{역}역」이 **들어간** 국문 관광지 485건의 같은 역 최근접 거리를 봤다.
  상위 5곳(역사 안 매장·광장): 올리브영 인천터미널역점 3m · 국회의사당역점 4m · 아트박스 작전역사점 5m · 올리브영 동대구역사점 7m · 용산역광장 7m.
  485건 중 300m 안 403, 1km 안 443(나머지는 「○○역 근처 식당」처럼 역에서 떨어진 곳).
- 버스 원천(포털이 WGS84 로 표기)의 「{역}역」 정류장과 같은 역: 508역, 거리 중앙값 72m · p90 161m · 300m 안 498.
- KATEC 이면 수십 km 단위로 어긋난다. → **Q5 답: WGS84. 변환하지 않는다.**

## 0.4 잡 메모리

같은 맥(Python 3.14.6)에서 `resource.getrusage` 최대 RSS 를 쟀다. 관광지 목록 쪽 응답 실물 한 쪽(`/api/places/attractions?afterId=0&size=200`,
공개 GET, 1,119,615 B)을 338번 파싱하며 쪽마다 `(id, lat, lng)` 만 남겼다(= 67,600행).

```text
python3 -I tg0-scripts/rss_probe.py page.json attractions.tsv bus.bin rail.bin tg0-scripts
start: max RSS 19.0 MiB
attractions projected (67600 rows, 338 pages x 1119615 B): max RSS 40.4 MiB
bus full dicts (227065): max RSS 326.3 MiB
bus chunks serialized: max RSS 329.1 MiB
tuples only (bus 227060, rail 1099): max RSS 374.3 MiB

python3 -I tg0-scripts/rss_stream.py bus.bin        # 디코드한 원문 + 2,000행 묶음만 dict, 계산용 튜플은 전부
projection 67440: max RSS 25.2 MiB
decoded text: max RSS 78.9 MiB
streamed, tuples 227060: max RSS 215.1 MiB
```

- **`place_client.fetch_attractions()` 를 그대로 쓰면 안 된다** — 관광지 전 필드 dict 를 전량 쌓는다. 한 쪽 200행이 1.1 MB 라 6.7만 행이면
  JSON 만 약 377 MB, 파이썬 객체로는 그 몇 배다. SR-6.1 의 「ACTIVE 의 `(id, lat, lng)` 만 남긴다」는 **쪽마다 투영**해야 성립한다(TG5 구현 주의).
- 버스 원천 전 행을 dict 로 한꺼번에 들면 최대 374 MiB, 묶음 스트리밍이면 215 MiB. 리눅스 컨테이너는 맥과 수치가 조금 다르다.
  → **`resources: requests 256Mi / limits 512Mi`**(air-stations CronJob 과 같은 값), 버스 원천은 스트리밍으로 읽는다.

## 0.5 찜 분포

```bash
oci-mysql wishlist_db "SELECT COUNT(*) total FROM wishlist_items;
  SELECT target_type, COUNT(*) n, COUNT(DISTINCT target_key) keys_ FROM wishlist_items GROUP BY target_type;
  SELECT c AS saves, COUNT(*) targets FROM (SELECT target_key, COUNT(*) c FROM wishlist_items
    WHERE target_type='ATTRACTION' GROUP BY target_key) t GROUP BY c ORDER BY c;"
```

| 값 | 결과 |
|---|---|
| `wishlist_items` 전체 행 | 14 |
| ATTRACTION / BLOG_POST / GAME | 4행(4대상) / 3행 / 7행 |
| 찜 수별 ATTRACTION 대상 | 1명 4곳 — **3명 이상 0곳** |

- 인덱스 마이그레이션 검토 문턱(수십만 행)에서 한참 멀다 — 집계 질의는 지금 그대로 둔다.
- SR-3.4 「많이 찜한 곳」 절과 상세 찜 근거 줄은 배포 직후 운영 어디에서도 안 나온다(데이터 규칙으로 숨는다, Q8 권고와 같다).

## 0.6 클릭 분포

```bash
ssh msa-oci 'sudo k3s kubectl -n commerce logs attraction-reindex-29861130-zjzdf | grep "클릭 신호"'
# 2026-10-10T21:30:14Z … 클릭 신호 12곳 적재 (2026-09-27..2026-10-10), 최소 표본(5) 이상 0곳
# 하루 전(attraction-reindex-29859690-s89fc): 클릭 신호 12곳 적재 (2026-09-26..2026-10-09), 최소 표본(5) 이상 0곳
```

- `uniqueClickers14d ≥ 5` 관광지 0곳 → 그런 곳이 3곳 이상인 시군구도 0.
- 재색인 소요 기준값(변경 전): `attractionApiReindexJob … COMPLETED in 4m18s295ms`(2026-10-10 21:30 UTC 회차). TG6 전후 비교에 쓴다.

### CDP 표본 페이지 (TG6.6)

| 근거 | 근거 있는 표본 | 근거 없는 페이지(절 숨김) |
|---|---|---|
| `KTO_REGION_VISITORS`(시도 순위) | 서울 `11` · 부산 `26` 시도 페이지 | 세종 `36` · 제주 `50`(시군구 3개 미만) |
| `SITE_SAVES` | **없음(0곳)** — 컴포넌트 테스트로만 확인 | 아무 시군구(예: 종로구 `11110`) |
| `SITE_CLICKS` | **없음(0곳)** — 컴포넌트 테스트로만 확인 | 아무 시군구(예: 종로구 `11110`) |

## 0.7 외지인 정의 · 시도 상위 10 (Q11)

원천 정의(data.go.kr 15101972 상세 설명 원문, 2026-10-11 페이지에서 읽음):

> ㈜케이티(내국인)와 SK텔레콤(주)(외국인)의 이동통신 데이터를 기반으로 제공되는 광역 및 기초지자체별 방문자 수 정보입니다. ‘방문자’는 거주, 통근, 통학 등의 일상생활권을 벗어나 관광 등의 목적으로 한 장소에 일정시간 머문 사람으로, 정확한 방문목적을 알 수 없는 데이터 특성상의 한계로 ‘관광객’과 동일하게 정의되지 않습니다. 또한 방문자 수는 일자별 순방문자 수로서, 특정 방문자가 2박 3일간 한 지역을 방문했을 경우 3명으로

→ **Q11 답: 정의상 통근·통학 제외. 근거 줄에 「통근 포함」을 붙이지 않는다.** 다만 아래 서울 상위가 강남·서초(업무지구)인 것은
「일상생활권」 판정이 추정이라 업무 방문이 섞일 수 있음을 보여 준다 — 이 인용을 `data-sources.md` 방문자 절에 옮길 때(TG2) 「추정」을 함께 적는다.

다 받은 달: 서울 시군구 25개가 2026-08 의 31일을 전부 가졌고(2026-09 는 10일까지) — 마지막 다 받은 달 **2026-08**.

```bash
oci-mysql place_db "SELECT DATE_FORMAT(base_ymd,'%Y-%m') m, COUNT(DISTINCT region_code) codes, COUNT(DISTINCT base_ymd) days
  FROM region_visitor_daily WHERE region_level='SIGUNGU' AND region_code LIKE '11%' GROUP BY m ORDER BY m;"
# 2025-09 … 2026-08: codes 25, days = 그 달 일수 · 2026-09: codes 25, days 10
oci-mysql place_db "SET NAMES utf8mb4; SELECT LEFT(region_code,2) sido, region_code, MAX(region_nm),
  SUM(IF(tou_div_cd='2',tou_num_value,0)) outsiders, SUM(IF(tou_div_cd='3',tou_num_value,0)) foreigners, … 
  FROM region_visitor_daily WHERE region_level='SIGUNGU' AND base_ymd BETWEEN '2026-08-01' AND '2026-08-31'
  AND LEFT(region_code,2) IN ('11','26') GROUP BY region_code ORDER BY sido, total DESC;"
```

서울 2026-08 외지인+외국인 상위 10 (명, 반올림):

| 순위 | 코드 | 시군구 | 외지인 | 외국인 | 합 | (참고) 현지인 |
|---|---|---|---|---|---|---|
| 1 | 11680 | 강남구 | 18,558,922 | 1,042,586 | 19,601,508 | 16,962,792 |
| 2 | 11650 | 서초구 | 15,251,058 | 476,392 | 15,727,450 | 11,340,217 |
| 3 | 11140 | 중구 | 11,720,366 | 2,750,815 | 14,471,181 | 4,060,693 |
| 4 | 11110 | 종로구 | 11,980,077 | 1,403,863 | 13,383,940 | 4,774,326 |
| 5 | 11710 | 송파구 | 11,569,681 | 376,894 | 11,946,575 | 14,145,499 |
| 6 | 11170 | 용산구 | 10,576,465 | 1,046,502 | 11,622,966 | 4,981,106 |
| 7 | 11440 | 마포구 | 10,138,401 | 1,285,526 | 11,423,927 | 7,614,103 |
| 8 | 11560 | 영등포구 | 10,426,840 | 549,529 | 10,976,368 | 9,100,350 |
| 9 | 11500 | 강서구 | 8,229,001 | 498,070 | 8,727,070 | 9,462,362 |
| 10 | 11410 | 서대문구 | 7,650,419 | 434,305 | 8,084,724 | 4,980,010 |

부산 2026-08 상위 10:

| 순위 | 코드 | 시군구 | 외지인 | 외국인 | 합 |
|---|---|---|---|---|---|
| 1 | 26350 | 해운대구 | 6,987,719 | 799,339 | 7,787,057 |
| 2 | 26230 | 부산진구 | 6,288,244 | 454,407 | 6,742,651 |
| 3 | 26440 | 강서구 | 3,832,091 | 698,506 | 4,530,596 |
| 4 | 26500 | 수영구 | 3,953,107 | 314,328 | 4,267,435 |
| 5 | 26710 | 기장군 | 3,806,236 | 295,883 | 4,102,119 |
| 6 | 26110 | 중구 | 3,376,240 | 436,340 | 3,812,580 |
| 7 | 26170 | 동구 | 3,385,330 | 366,455 | 3,751,785 |
| 8 | 26260 | 동래구 | 3,647,581 | 43,778 | 3,691,359 |
| 9 | 26290 | 남구 | 2,757,647 | 271,883 | 3,029,530 |
| 10 | 26470 | 연제구 | 2,735,586 | 76,149 | 2,811,735 |

- 숫자는 **일자별 순방문자 합**이다(원천 정의 「2박 3일이면 3명」). 화면 「약 N명」은 「한 달 동안 하루하루 머문 사람 수의 합」이라 실제 사람 수보다 크다 —
  「기준 보기」에 이 정의를 적어야 오해가 없다(TG2 에서 반영할 것, 아래 open question).

## 0.8 버스 원천 연계 판정

원천 `도시코드` 는 TAGO 도시 코드(광역 2자리, 시·군 5자리)라 시군구 코드와 다르다. `도시명`(「경기도 수원시」「부산광역시」)으로 이었다.

```bash
python3 -I tg0-scripts/bus_namemap.py bus.bin regions.tsv     # regions.tsv = administrative_regions 285행(운영, 읽기)
python3 -I tg0-scripts/bus_cover.py   bus.bin attractions.tsv regions.tsv
```

이름 대응 규칙(160개 원천 도시 전부 이어졌다, 못 이은 원천 도시 0):
- 시도 이름 정규화: 전라북도 → 52, 전라남도 → 12, 광주광역시 → 12 의 자치구 5개(12210·12240·12270·12300·12330). 2자리 코드 도시(광역·특별자치)는 그 시도의 시군구 전부.
- 시 이름이 구를 가진 시(수원시 등)는 `{시}` 와 `{시} {구}` 전부.
- 옛 이름: 충청북도 청원군 → 청주시, 충청남도 연기군 → 세종 전체, 경상남도 마산시·진해시 → 창원시, 대구광역시 군위군 → 대구 군위군.

결과:

| 구분 | 시군구 |
|---|---|
| 원천 도시가 없는 시군구(6) | 보성군 12750 · 화순군 12760 · 강진군 12780 · 계룡시 44250 · 화천군 51790 · 고성군(강원) 51820 |
| 이어지지만 정류장 100개 미만(13) | 증평군 1 · 담양군 2 · 양구군 2 · 동해시 4 · 완주군 14 · 익산시 15 · 강릉시 20 · 횡성군 20 · 속초시 53 · 정선군 58 · 영광군 63 · 평창군 63 · 인제군 63 |

- 정류장 수가 적은 곳은 그 지자체 BIS 가 아니다. `관리도시명` 이 `경기BIS`(경기 광역버스 경유 정류장, 예: 강릉 「홍제2교(미정차)」)이거나
  `TSBIS` 일부다 — 강릉시 20개 = 경기BIS 13 + TSBIS 7, 속초 53 = 4 + 49, 울릉군 116 = TSBIS 116. `TSBIS` 가 무엇을 담는지는 원천 문서에 없다.
- 2자리 도시 코드(광역 전체)를 시도 전부로 펴면 대구 군위군(2023 편입)도 대구BIS 연계로 잡힌다 — 원천 「대구광역시 군위군」 56행이 따로 있으므로
  광역 코드는 「원천에 별도 도시 행이 있는 시군구는 빼고」 편다(TG5 상수에서).
  그래서 **이름만으로 「연계」 판정하면 강릉(관광지 1,024곳)이 「주변에 정류장 없음」으로 보인다**(국문 관광지 중 500m 안 정류장이 있는 곳 90/1,024).
- 거리 대안(「관광지 10km 안 유효 정류장 0」)은 국문 관광지 52,140 중 626곳(1.2%)만 미연계로 잡는다 — 강릉은 이웃·경유 정류장 때문에 대부분 「연계」로 나와 같은 문제를 못 푼다.
- 국문 관광지 중 500m 안 유효 정류장이 있는 곳: 42,198 / 52,140 (81%).

**판정안(권고): 시군구가 이름 대응되고 그 시군구로 이어진 원천 정류장이 100개 이상이면 연계, 아니면 미연계(「이 지역은 버스정류장 위치 자료가 없습니다」).**
100 은 위 표의 100 미만 최댓값(63)과 그다음 값(울릉군 116 — 섬이라 작다) 사이에 둔 값이고, 근거는 분포의 빈틈뿐이다. 이 값은 spec 이 정하지 않은 새 하한이라 open question 으로 올린다.
대응표(시도 정규화 + 옛 이름 4줄)는 ingest 상수로 두고, 원천 도시 하나라도 못 이으면 Job 을 실패시키는 편이 헤더 검사와 같은 결이다.

## 부수 발견 (TG5 에 넘김)

1. **철도 「역번호」는 자연 키가 아니다** — 1,099행 중 고유 907, `(역번호, 노선번호)` 도 5쌍 겹친다(`source-sample.md`). SR-5.4 의 「철도 역사 코드」 를 키로 쓰면 행이 합쳐진다.
2. `데이터기준일자` 가 ISO · 엑셀 일련번호 · 빈 값 세 모양 — 파생 날짜 컬럼이 필요하다.
3. 버스 CSV 는 CP949 — UTF-8 로 읽으면 첫 바이트에서 실패한다.
4. 포털 표기 행 수 ≠ 실제 행 수 — ±20% 검사는 이전 활성 회차 기준이어야 한다(spec 그대로).
5. 철도는 KRIC 판(20260630)이 data.go.kr 판(20241231)보다 새것 — 받는 주소는 KRIC 로, 화면 출처는 「국가철도공단 도시철도 역사정보」 그대로.
