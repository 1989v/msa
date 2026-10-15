# P4 API 계약 — 골목 구조 보강

정본: prd.md §11. 병렬 작업(WU-10·11·12·13·14)이 같은 모양을 쓰도록 고정한다. 좌표는 모두 `[lat, lng]` 숫자 배열. 응답은 `ApiResponse<T>`.

## 공통 타입

```jsonc
Boundary  = { "polygon": [[lat,lng], ...], "source": "OSM"|"DERIVED"|"MANUAL", "osmId": "way/123"|null }
Path      = { "id": 1, "name": "오리로964번길"|null, "named": true, "geometry": [[lat,lng], ...], "source": "OSM"|"MANUAL" }
Entrance  = { "id": 1, "lat": 37.47, "lng": 126.85, "pathId": 1|null, "label": "오리로964번길 입구"|null, "source": "OSM"|"MANUAL" }
RoadRule  = { "id": 1, "roadName": "오리로", "buildingNoFrom": 2|null, "buildingNoTo": 40|null, "membership": "IN"|"OUT", "reason": "..." }
Geo       = { "centerLat": 37.48, "centerLng": 126.85, "radiusM": 300, "centerOverridden": false, "radiusOverridden": false }
RejudgeResult = { "changedStores": 12 }
```

## 공개 (WU-12) — 기존 `GET /api/v1/place/markets/{contentId}` 응답에 필드 추가

```jsonc
{ ...기존 필드,
  "boundary": Boundary | null,          // source 는 그대로, osmId 는 null 로 내지 않아도 됨
  "paths": [ Path ],                    // 빈 배열 가능
  "entrances": [ Entrance ],
  "attribution": ["© OpenStreetMap contributors"],  // boundary/paths 가 하나라도 OSM 이면
  "stores": [ { ...기존 가게 필드, "pathId": 1|null } ]   // needsReview·judgedBy 는 공개에 없음
}
```
경계가 null 이고 paths 가 비면 FE 는 지금 화면 그대로.

## 어드민 (WU-11 구현, WU-13 사용) — `/api/v1/admin/place/markets/{marketId}`

| 메서드·경로 | 바디 | 응답 |
|---|---|---|
| GET `/geometry` | | `{ boundary, paths, entrances, roadRules, geo, background: { roads: [{ name, highway, geometry }] }, attribution }` |
| PUT `/boundary` | `{ polygon, reason }` | `{ boundary, rejudge: RejudgeResult }` (source=MANUAL) |
| POST `/boundary/reset` | `{ to: "OSM"|"DERIVED", reason }` | 같음 |
| POST `/paths` · PUT `/paths/{id}` · DELETE `/paths/{id}?reason=` | `{ name, geometry, reason }` | `{ path, rejudge }` |
| POST `/entrances` · PUT/DELETE `/entrances/{id}` | `{ lat, lng, pathId, label, reason }` | `{ entrance }` |
| POST `/road-rules` · PUT/DELETE `/road-rules/{id}` | `RoadRule - id + reason` | `{ roadRule, rejudge }` |
| PUT `/geo` | `{ centerLat, centerLng, radiusM, reason }` (null = 덮어쓰기 해제) | `{ geo, rejudge }` |
| GET `/needs-review` | | `[ { storeId, name, roadAddress, lat, lng, pathId, suggestedPathId } ]` |
| PUT `/stores/{storeId}/path` | `{ pathId, reason }` | `{ rejudge }` |

reason 은 필수(빈 문자열 400). 모든 쓰기는 `market_change_log` 에 남고 기존 `POST /changes/{logId}/revert` 로 되돌린다.

## 내부 적재 (WU-10 호출, WU-11 쪽 JVM 구현) — `/internal/markets`

| 메서드·경로 | 바디 |
|---|---|
| PUT `/{marketId}/osm` | `{ fetchedAt, raw: { boundary: <overpass json>|null, paths: <json>, roads: <json> }, boundary: { polygon, source: "OSM"|"DERIVED", osmId }|null, paths: [ { osmWayId, name, geometry } ] }` — MANUAL 경계·MANUAL 선은 바꾸지 않는다. OSM 선은 osmWayId 로 upsert |
| POST `/{marketId}/rejudge` | (없음) → `RejudgeResult` |

시장 목록은 기존 내부 API(GET 시장 id·중심·유형)를 쓴다.

## 상인회 변경 요청 (WU-14)

`POST /api/v1/place/markets/{id}/manage/geometry-requests` `{ kind: "BOUNDARY"|"PATH"|"ENTRANCE"|"NOTE", geometry: [[lat,lng],...]|null, description }` → `{ id, status: "PENDING" }`.
어드민 `GET /api/v1/admin/place/markets/geometry-requests?status=`, `PUT …/geometry-requests/{id}` `{ action: "APPROVE"|"REJECT", reason }`.
