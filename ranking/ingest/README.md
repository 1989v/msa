# ranking-ingest — 오피넷 주유소 수집 (ADR-0081)

전국 주유소·가격을 하루 1회 받아 랭킹 서비스에 적재한다. 외부 `:443` 을 부르는 것은
이 CronJob 파드뿐이다 — 상시 파드(code-dictionary)에는 egress 를 열지 않는다.

**사용자 요청은 오피넷을 부르지 않는다.** 오피넷 갱신이 일 단위라 실시간 호출은 같은 값을
받으려고 한도를 태우는 일이고, 외부 한도를 트래픽에 묶으면 인기가 생기는 순간 서비스가 죽는다.

## 실행

```bash
# 키 없이 적재 경로만 (샘플 6줄 → 주유소 5곳)
cd ranking/ingest && python3 -m src.main --job=gas-stations --file src/stations.sample.jsonl

# 실수집
export OPINET_API_KEY='...'
python3 -m src.main --job=gas-stations
python3 -m src.main --job=gas-boards      # 적재분으로 보드 스냅샷 생성
```

| 환경변수 | 기본값 | 용도 |
|---|---|---|
| `OPINET_API_KEY` | — | 오피넷 무료 API 키. 없으면 `--file` 경로만 동작 |
| `RANKING_API` | `http://code-dictionary:8089` | 적재 대상 |
| `OPINET_API` | `https://www.opinet.co.kr/api` | 원천 |

## 검증

```bash
python3 -m tests.test_katec    # KATEC → WGS84 골든 좌표 (PROJ 대비 4cm 이내)
python3 -m tests.smoke_test    # 가짜 API 로 수집 경로 E2E
```

## 좌표 — 이 잡에서 가장 조용히 틀리는 곳

원천의 `GIS_X_COOR`/`GIS_Y_COOR` 는 위경도가 아니라 **KATEC(TM128)** 이다. 값이 십만 단위라
위경도로 착각해도 그럴듯해 보이고, 그대로 저장하면 **지도 핀만 전부 어긋난다.**

- 변환은 여기(수집기)서 한다. 서버가 하면 원천 좌표계가 도메인에 새어든다
- **원천 KATEC 도 함께 보낸다** — 변환 규칙이 틀렸을 때 되돌릴 근거가 DB 안에 있어야 한다
- 변환 결과가 한반도 밖이면 좌표를 비운다. 엉뚱한 핀을 조용히 찍는 것보다 낫다
- `pyproj` 를 쓰지 않는다 — PROJ 데이터까지 끌고 와 이미지가 수십 MB 커진다. 대신 표준
  공식을 직접 펴고 **PROJ 로 뽑은 골든 좌표**로 검증한다 (`tests/test_katec.py`)

## 유종 병합 — 나눠 보내면 지워진다

오피넷은 (지역 × 유종)으로 답한다. 적재는 **전체 동기화**라 유종을 나눠 보내면 뒤에 보낸
유종이 앞 유종의 가격 행을 지운다. `_merge_by_station` 이 주유소 단위로 합친 뒤 보낸다.

## 한도

무료 API 의 일일 한도가 공개돼 있지 않다(OQ-3). 한도 초과(429 또는 본문 메시지)를 만나면
**그 실행을 즉시 멈추고 아무것도 적재하지 않는다** — 부분 적재를 남기면 다음 실행이 나머지를 지운다.

유료 오퍼레이션(`최저가 Top20`·`시군구 평균가`)은 부르지 않는다. 무료 수집분으로 우리가
직접 집계하면 같은 결과가 나온다.

## 출처 표기

화면에 **"출처: 한국석유공사 오피넷"** 을 표기한다. 보드 행이 `source_label` 로 들고 다니므로
화면 코드가 원천마다 분기하지 않는다.
