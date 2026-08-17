# 관광지 오픈데이터 시드 (ADR-0065 K-관광 검색)

한국관광공사 **TourAPI 4.0** 관광지 데이터를 `place` 서비스(SSOT)에 적재하고
search 가 `attractions` 인덱스로 재색인하여 국문/영문 관광지 검색·지도 탐색에 활용하는 ETL.

## 파이프라인

```
TourAPI(KorService2/EngService2)
  ──sync_tour.py──▶ attractions.jsonl (lang 별 레코드)
  ──POST /api/places/attractions/bulk──▶ place MySQL(SSOT, contentId+lang 멱등 upsert)
  ──search-batch attractionApiReindexJob──▶ OpenSearch "attractions" (alias swap)
  ──▶ GET /api/search/attractions?keyword=&lang=&lat=&lng=&radiusKm=
```

국문(KorService2)과 영문(EngService2)은 contentId 체계가 달라 **언어별 별도 레코드**로 적재한다.

## 키 (data.go.kr — 식품 트랙과 같은 계정에서 발급 가능)

| 환경변수 | 활용신청 대상 | 비고 |
|---|---|---|
| `TOUR_API_KEY` | 한국관광공사 TourAPI 4.0 국문(KorService2) + 영문(EngService2) | Encoding 키, 추가 인코딩 금지. 미설정 시 `DATA_GO_KR_KEY` 재사용 |

> 공공누리 출처표시: "한국관광공사 TourAPI". 원천 raw 응답은 레포에 커밋하지 않는다.

## 1) 정규화 (로컬 실행 — egress 하드닝으로 클러스터 내 직접 호출 대신, P2 에서 CronJob 화)

```bash
export TOUR_API_KEY='...'

python3 sync_tour.py --service kor --out attractions.jsonl                 # 국문 관광지 전국 (기본 2000건)
python3 sync_tour.py --service eng --out attractions.en.jsonl              # 영문
python3 sync_tour.py --service kor --area 1 --limit 500                    # 서울만
python3 sync_tour.py --service kor --with-overview --overview-cap 200      # 개요 텍스트 조인 (건당 1콜)
python3 sync_tour.py --dump-keys                                           # 응답 필드 진단 (스펙 확인)

# 키 없이 — 동봉 샘플 (ko 20 + en 10, 실좌표·개요 포함)
python3 sync_tour.py --from-sample --out attractions.jsonl
```

- `--content-type`: attraction(기본)/culture/leisure/shopping/food — 국문·영문 contentTypeId 차이는 스크립트가 흡수
- 카테고리는 cat1/cat2 를 언어 중립 슬러그(nature/history/culture/leisure/shopping/food/stay/etc)로 매핑
- 좌표 없는 행은 제외 (지도·근방검색 불가)

## 2) 적재 (place bulk API)

```bash
# 로컬/포트포워딩 기준. 운영은 OCI 에서 ConfigMap 주입 후 place 파드가 직접 읽지 않고
# 아래처럼 API 경유가 기본이다 (2000건/청크 제한 — jq 로 분할)
curl -X POST http://localhost:8096/api/places/attractions/bulk \
  -H 'Content-Type: application/json' \
  -d "{\"attractions\": $(cat attractions.jsonl | jq -s .)}"
```

## 3) 재색인 + 검증

```bash
kubectl -n commerce create job --from=cronjob/attraction-reindex attraction-reindex-manual

curl 'https://api.1989v.com/api/search/attractions?keyword=궁궐&lang=ko'
curl 'https://api.1989v.com/api/search/attractions?keyword=palace&lang=en'
curl 'https://api.1989v.com/api/search/attractions?lat=37.57&lng=126.97&radiusKm=5&sort=distance'
```

## 4) 개요(overview) 점진 수집

목록 조회는 100건/콜이지만 개요는 `detailCommon2` 로 **건당 1콜**이라 하루에 다 못 받는다.
일일 한도는 **(서비스 × 오퍼레이션)별로 따로**다 — KorService2 가 429 여도 EngService2 는 살아 있고,
`areaBasedList2` 도 별도 한도라 목록 재수집은 영향받지 않는다.

```bash
TOUR_API_KEY='...' ./overview_daily.sh        # ko 1000 + en 1000 수집 → 적재 → 재색인
./overview_daily.sh --stats                   # 잔량만 확인 (API 호출 없음)
```

**수집만 따로 돌리지 말 것.** 중복 호출을 막는 기준이 "place SSOT 에 개요가 있는가" 하나뿐이라,
적재를 미루면 다음 실행이 같은 레코드를 그대로 다시 부른다(실측 30/30 재호출). `overview_daily.sh`
가 수집·적재·재색인을 한 단위로 묶는 이유다.

- 우선순위: 관광지 분류(nature/history/culture/leisure) → 이미지 보유 → contentId
- 원천이 개요를 빈 값으로 주는 레코드는 `~/.local/state/1989v/tour-overview-empty.txt` 에 기록해
  다음 실행에서 제외한다 (DB 에는 "없음 확인" 을 표현할 자리가 없다). 429·네트워크 실패는 기록하지 않는다
- **부분 전송 금지** — bulk upsert 는 전체 동기화라 보내지 않은 필드가 null 로 덮인다.
  개요만 예외로 보존된다(`Attraction.syncFrom`)

## 출력 스키마 (1줄 = 1관광지, 값 없는 필드 생략)

```json
{"contentId":"126508","lang":"ko","title":"경복궁","address":"...","areaCode":"1","sigunguCode":"23",
 "category":"history","cat1":"A02","cat2":"A0201","cat3":"A02010100",
 "latitude":37.5788,"longitude":126.977,"imageUrl":"...","tel":"...","overview":"...",
 "sourceModifiedAt":"2026-08-01T12:00:00"}
```

⚠ TourAPI v2 응답 필드명은 개편 이력이 있어(2024 KorService→KorService2) 첫 실행 시
`--dump-keys` 로 실제 필드를 확인할 것 — 불일치 시 `fetch_area_based` 의 키만 보정하면 된다.
