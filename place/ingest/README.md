# place-ingest — 관광지 수집 배치 (ADR-0065 / ADR-0070)

한국관광공사 **TourAPI 4.0** 데이터를 `place` 서비스(SSOT)에 적재하는 CronJob 이미지.
`search-batch` 가 `attractions` 인덱스로 재색인하고 `place.1989v.com` 이 읽는다.

**외부 :443 을 부르는 유일한 place 계열 파드다.** 상시 파드인 `place` 에는 egress 를 열지
않는다 — 배치가 필요로 하는 외부 접근 때문에 상시 노출면을 늘리지 않기 위해서다
(`k8s/base/network-policy/11-allow-egress-https-public.yaml`).

## 파이프라인

```
TourAPI(KorService2/EngService2)
  ──place-ingest──▶ POST place:8096/api/places/attractions/bulk   (contentId+lang 멱등 upsert)
  ──attraction-reindex CronJob──▶ OpenSearch "attractions" (alias swap)
  ──▶ GET /api/search/attractions?keyword=&lang=&lat=&lng=&radiusKm=
```

국문(KorService2)과 영문(EngService2)은 contentId 체계가 달라 **언어별 별도 레코드**로 적재한다.

## 잡

| `--job` | 하는 일 | 스케줄 |
|---|---|---|
| `overview` | 개요 하루치 수집(ko/en 각 1,000) → 적재 → negative cache 기록 | `place-ingest-overview` 매일 KST 04:00 |
| `stats` | 잔량만 출력 (TourAPI 호출 0) | 수동 |
| `sync` | 목록 전량 재동기화 → 적재 | 수동 (원천 스키마가 바뀔 때) |
| `links` | 유튜브·네이버 블로그 수집 → 적재 (우선순위 큐에서 N건) | `place-ingest-links` 매시 17분 |
| `admin-regions` | 법정동코드 자료 → 행정구역 적재 (+시군구 좌표 계산) | 수동 (자료가 갱신될 때) |

재색인은 이 이미지가 트리거하지 않는다 — Job 생성 RBAC 을 얻는 대신 `attraction-reindex`
CronJob 이 30분 뒤(KST 04:30)에 돈다.

## 수동 실행

```bash
kubectl -n commerce create job --from=cronjob/place-ingest-overview place-ingest-overview-manual
kubectl -n commerce logs -f job/place-ingest-overview-manual

# 잔량만 (TourAPI 호출 0)
kubectl -n commerce run place-ingest-stats --rm -it --restart=Never \
  --image=commerce/place-ingest:latest --env=PLACE_API=http://place:8096 -- --job=stats
```

로컬(k3d)에서는 `PLACE_API` 만 바꿔 그대로 돌린다.

```bash
PLACE_API=http://localhost:8096 TOUR_API_KEY='...' python3 -m src.main --job=stats
```

## 키

| 환경변수 | 발급 | 비고 |
|---|---|---|
| `TOUR_API_KEY` | data.go.kr — TourAPI 4.0 국문(KorService2) + 영문(EngService2) | Encoding 키, 추가 인코딩 금지. 미설정 시 `DATA_GO_KR_KEY` 재사용 |
| `YOUTUBE_API_KEY` | Google Cloud — YouTube Data API v3 | `search.list` 는 건당 100 units, 일 10,000 units → **하루 100 관광지** |
| `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` | 네이버 개발자센터 — 검색 API | 일 25,000콜. 없으면 이 소스만 건너뛴다 |

클러스터에서는 Secret `place-ingest-secrets` 의 `tour-api-key`. 운영은 SealedSecret
(`k8s/infra/prod/sealed-secrets/README.md`).

```bash
kubectl -n commerce create secret generic place-ingest-secrets \
  --from-literal=tour-api-key="$TOUR_API_KEY" \
  --from-literal=youtube-api-key="$YOUTUBE_API_KEY" \
  --from-literal=naver-client-id="$NAVER_CLIENT_ID" \
  --from-literal=naver-client-secret="$NAVER_CLIENT_SECRET"
```

> 공공누리 출처표시: "한국관광공사 TourAPI". 원천 raw 응답은 레포에 커밋하지 않는다.

## 지켜야 할 것

### bulk upsert 는 전체 동기화다 — 부분 전송 금지

`Attraction.syncFrom` 이 **보내지 않은 필드를 null 로 덮는다.** 예외는 개요 하나뿐
(`overview = source.overview ?: overview`). 검증용으로 부분 레코드를 보냈다가 경복궁 행의
주소·이미지·분류를 날린 적이 있다. 한 필드만 고치려면 현재 레코드를 읽어 그 위에 덮어써서
**전체 레코드**를 보낸다 (`backfill_overview.UPSERT_FIELDS` 방식).

### 수집만 따로 돌리지 말 것

중복 호출을 막는 기준이 "place SSOT 에 개요가 있는가" 하나뿐이라, 적재를 미루면 다음 실행이
같은 레코드를 그대로 다시 부른다(실측 30/30 재호출). `--job=overview` 가 수집·적재·기록을
한 단위로 묶는 이유다.

### negative cache 에 실패를 넣지 말 것

원천이 개요를 빈 값으로 주는 레코드는 `attraction_overview_probes` 에 기록해 다음 실행에서
제외한다. **429·네트워크 실패는 기록하지 않는다** — 넣으면 그 레코드가 영영 재시도되지 않는다.

### TourAPI 구 코드는 폐기 중이다

`areaBasedList2` 를 areaCode 없이 부르면 `areacode`·`cat1~3` 이 100% 빈 문자열로 온다.
**신체계(`lclsSystm1~3`, `lDongRegnCd`)가 원본**이고 구 코드는 파생이다. 지역을 지정해 순회하면
areaCode 자체가 없는 레코드 **43%** 를 통째로 놓치므로, 무지정 페이징으로 전량을 받고
`sync_tour.py` 의 `LDONG_TO_AREA`·`LCLS1_MAP` 으로 역산한다.

### 영상 수집의 예산은 place 가 센다 — 수집기가 세지 않는다

파드가 매번 새로 뜨므로 프로세스 안에 카운터를 두면 소용이 없다. place 가 그날의
`last_attempt_at` 개수로 남은 예산을 계산해 `pending` 의 개수를 잘라 준다.
`collected_at` 이 아니라 `last_attempt_at` 인 이유는 **빈 결과와 실패도 호출을 썼기** 때문이다.

**쿼터 소진은 403(reason=quotaExceeded)이고 429 가 아니다.** 만나면 그 실행을 즉시 멈춘다 —
남은 큐를 계속 두드려도 답이 같고 로그만 쌓인다.

`links: []`(원천이 0건이라고 답함)와 `failed: true`(답 자체를 못 받음)를 섞지 않는다.
서버가 전자는 30일 뒤, 후자는 하루 뒤로 재시도를 잡는다.

### 일일 한도는 (서비스 × 오퍼레이션)별로 따로다

KorService2 가 429 여도 EngService2 는 살아 있고, `areaBasedList2` 도 별도 한도라 목록
재수집은 영향받지 않는다 (실측).

## 행정구역 적재 (ADR-0071)

```bash
python3 -m src.main --job=admin-regions --file ~/Downloads/법정동코드_전체자료.txt
```

### 자료 내려받기 (한 번)

1. <https://www.code.go.kr/stdcode/regCodeL.do> — 행정표준코드관리시스템 › 법정동코드목록조회
   (로그인 불필요, 공공누리 제1유형)
2. 좌측 **"법정동 코드 전체자료"** 를 받는다. 검색 조건으로 거른 결과가 아니라 **전체자료**여야
   한다 — 조건부 목록은 시도 행이 빠져 시군구의 상위를 못 찾는다.
3. 받은 파일은 탭 구분 텍스트다. 인코딩은 CP949 또는 UTF-8 이고 파서가 알아서 판별한다.

```
법정동코드      법정동명                폐지여부
1100000000      서울특별시              존재
1111000000      서울특별시 종로구        존재
1111010100      서울특별시 종로구 청운동  존재
```

폐지여부 컬럼이 없는 형식이어도 동작한다(그 경우 폐지 필터가 적용되지 않을 뿐이다).

스크립트로 긁지 않는 이유: 다운로드가 세션·폼 파라미터에 묶여 있어 자동화하면 정부 포털의
내부 폼을 역공학하는 셈이 된다. 자료는 자주 바뀌지 않으므로 한 번 받아 두면 된다.

읍면동과 폐지 코드는 버리고 시도·시군구만 담는다.

**좌표**는 자료에 없어 그 시군구 관광지 좌표의 평균으로 채운다. 지도를 어디에 놓을지 정하는
값이라 행정 중심점일 필요가 없다. 관광지가 없는 시군구는 좌표 없이 둔다 — 지어낸 값보다 낫다.

**영문명**도 자료에 없다 (컬럼은 법정동코드/법정동명/폐지여부 뿐).

- **시도는 `SIDO_EN` 상수**다 (2026-08-20 자 자료 기준 16개). 수가 적고 공식 표기가
  확립돼 있어 고정하는 편이 낫다. 코드로 잡는다 — 한글명도 코드도 바뀌지만 코드가 덜 바뀐다.
  자료를 다시 받았는데 상수에 없는 코드가 나오면 잡이 `[!]` 경고를 찍는다.
- **시군구는 영문 관광지 주소의 최빈값**이다. `161 Sajik-ro, Jongno-gu, Seoul` → `Jongno-gu`.
  어느 칸을 볼지는 **법정동 한글명의 단어 수**가 정한다 — `전주시 완산구`(2단어)는
  `Wansan-gu, Jeonju-si` 처럼 한 칸 더 앞을 함께 본다. `tokens[-2]` 로 고정하면 시 아래
  자치구에서 한 칸 밀린다.

> **첫 실행 후 출력된 영문명을 한 번 훑을 것.** 원천이 **일관되게** 틀린 값을 주면 최빈값으로도
> 안 걸러진다 — 인천 서구가 137건 모두 `Seohae-gu` 로 온다(맞는 표기는 `Seo-gu`).
> 잡의 마지막에 시도별로 한 줄씩 찍으므로 그 자리에서 확인하면 된다.

### 행정구역은 개편된다 — 자료를 믿고 상수를 고친다

2026-08-20 자 자료 실측: **시도 15 + 세종(합성) · 시군구 269**.

- 광주광역시(29)와 전라남도(46)는 **폐지**되고 `전남광주통합특별시`(12)로 합쳐졌다.
  TourAPI 영문 주소의 `Jeonnam-Gwangju Special Metropolitan City` 는 오류가 아니라 이 이름이다.
- 강원도(42) → 강원특별자치도(51), 전라북도(45) → 전북특별자치도(52).
- **세종은 시도 행이 없다.** 자료에 `3600000000` 이 없고 `3611000000 세종특별자치시` 만 있어,
  그대로 두면 드릴다운에서 사라진다. 파서가 자식의 이름으로 시도 행을 만들어 붙인다.

## 배포 전 확인

```bash
cd place/ingest && python3 -m tests.smoke_test
```

가짜 place API 로 수집 경로를 끝까지 태운다. CI 게이트가 아니라 수동 확인이고, 잡으려는 건
하나다 — **원천이 빈 개요를 준 것과 429·네트워크 실패를 섞지 않는가.**

## 진단

```bash
python3 -m src.sync_tour --dump-keys                        # 응답 필드 확인 (스키마 드리프트)
python3 -m src.sync_tour --from-sample --out /tmp/a.jsonl   # 키 없이 동봉 샘플 (ko 20 + en 10)
```

TourAPI v2 응답 필드명은 개편 이력이 있어(2024 KorService→KorService2) 불일치 시
`fetch_area_based` 의 키만 보정하면 된다.

## 출력 스키마 (1줄 = 1관광지, 값 없는 필드 생략)

```json
{"contentId":"126508","lang":"ko","title":"경복궁","address":"...","areaCode":"1","sigunguCode":"23",
 "category":"history","cat1":"A02","cat2":"A0201","cat3":"A02010100",
 "latitude":37.5788,"longitude":126.977,"imageUrl":"...","tel":"...","overview":"...",
 "sourceModifiedAt":"2026-08-01T12:00:00"}
```
