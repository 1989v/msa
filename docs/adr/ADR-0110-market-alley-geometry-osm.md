# ADR-0110 — 시장 경계·골목 기하와 OSM 재판정

## Status
Accepted (2026-10-15), WU-9. 공개 표시의 라이선스 검토는 WU-12 이전에 다시 수행한다.

## Context
P1의 도로명·반경 판정은 큰길과 안쪽 골목을 구분하지 못한다. 광명 표본에서는 경계 안 153곳 중 오리로 12곳·광명로 17곳을 함께 보여야 한다. 원천을 보존하면서 시장 경계, 골목 선, 도로 규칙을 편집하고 재판정할 별도 모델이 필요하다(PRD §11, ADR-0109).

## Decision
1. OSM(OpenStreetMap, ODbL 1.0)의 시장 경계와 골목 선을 채택한다. V37은 `market_boundary`(시장별 하나), `market_path`, `market_entrance`, `market_road_rule`, `market_osm_raw`를 추가한다. 원본은 종류별 전체 JSON과 수집 시각으로 보존한다. 좌표 JSON은 `[latitude, longitude]` 배열이다. JPA enum은 STRING, 참조는 ID이며 기존 place 모듈 안에서 ADR-0083의 UseCase 인터페이스·Port·Adapter를 따른다.
2. 운영 범위는 **지도 표시용으로만 사용하고 데이터 자체를 공개 배포하지 않는 것**이다. 공개·어드민 지도에 `© OpenStreetMap contributors`를 표시한다. share-alike 적용 범위를 줄이려는 프로젝트 운영 가정이며, 표시만으로 ODbL 의무가 면제된다는 법적 판단은 아니다. 파생 DB에서 만든 공개 지도(Produced Work)도 ODbL §4.4/§4.6 의무가 생길 수 있다. [OSMF 공식 라이선스 FAQ](https://osmfoundation.org/wiki/Licence/Licence_and_Legal_FAQ)를 근거로 WU-12 공개 노출 전 및 다운로드/API 데이터 배포가 필요해질 때 라이선스·공개 방식·파생 DB 제공 의무를 재검토한다. 이번 WU는 공개 API를 추가하지 않는다.
3. 소속 판정 순서는 **가게 MEMBERSHIP override → 경계 → 도로 규칙 → 기존 적재 membership**이다. 경계가 있되 좌표가 없으면 UNKNOWN이며 도로 규칙으로 건너뛰지 않는다. 도로 규칙의 양쪽 건물번호가 NULL이면 도로 전체, 한쪽만 있으면 그 방향으로 열린 구간이다. 건물번호는 주소의 해당 도로명 뒤 주번호를 사용한다. 겹친 규칙은 ID 오름차순 첫 일치 규칙을 사용한다.
4. `market_store.membership`, 원천 주소·좌표·JSON은 유지하고 `judged_membership`, `judged_by`, `path_id`, `needs_review`만 별도로 갱신한다. 재판정은 시장 잠금을 잡고 한 시장의 원천 가게와 override를 읽어 같은 트랜잭션에서 수행한다. 네 파생 값 중 하나라도 바뀐 **가게 수**를 반환한다. MANUAL 가게는 재판정하지 않는다. 원천 재적재도 기존 파생 값과 시장 중심/반경 override를 보존한다.
5. IN 가게의 유효 좌표에서 주소 도로명과 이름이 같은 골목 선이 25m 이내에 있으면 그중 가장 가까운 선으로 배정한다. 없으면 가장 가까운 선과 `needs_review=true`를 기록한다. 선이 없거나 좌표가 없거나 IN이 아니면 path는 NULL, review는 false이며 P1 구역은 그대로 둔다. 거리는 위도별 경도 축척을 적용한 시장 규모 평면 근사다.
6. OSM 경계가 없을 때의 초안은 IN 가게 좌표의 볼록 껍질을 기본 20m 여유로 둘러싼 DERIVED 다각형이다. 여유는 16방향 외접 버퍼의 볼록 껍질로 근사한다. 출입구 후보는 경계와 골목 선의 실제 교차 좌표이며 1cm 이내 중복은 합친다. 경계 접촉·경계 위 주행은 출입구로 세지 않는다.
7. 운영자가 고친 MANUAL 경계·골목은 원천 갱신으로 대체하지 않는다. 원본 갱신은 별도 raw 테이블에 남긴다. 수동 출입구·도로 규칙은 적재 쓰기 대상이 아니다. 변경 이력 target은 BOUNDARY·PATH·ENTRANCE·ROAD_RULE·MARKET_GEO를 추가한다. 실제 적재와 편집 쓰기·이력·되돌리기는 WU-10/11에서 이 계약을 적용한다.

## Alternatives Considered
- 도로명·반경만 유지: 큰길 점포와 안쪽 통로의 실제 연결 구조를 나타내지 못한다.
- 재판정으로 원천 membership 수정: 적재 근거를 잃고 다음 동기화가 편집 결과를 지운다.
- OSM 파생 데이터를 즉시 공개 배포: 라이선스 범위와 제공 방식을 별도 결정해야 하므로 이번 범위에서 제외한다.
- PostGIS 공간 연산: 시장 규모 연산에 별도 DB 운영이 필요해 순수 Kotlin 기하를 선택한다.

## Consequences
원천을 다시 호출하지 않고 경계·규칙으로 한 시장을 재판정할 수 있다. 파생 값과 기하 저장 비용, 공개 전 ODbL 검토가 추가된다. 광명 고정 픽스처의 원시 poly·ped·stores 좌표/도로명으로 기대값을 재계산하며 분석 스크립트의 cur·점포별 poly·snap·sd는 입력으로 사용하지 않는다. 공개 API·화면·적재 endpoint는 후속 WU 범위다.

## 상인회 변경 요청
V38 `market_geometry_request`에 ACTIVE 상인회의 그림과 설명을 별도 보관한다. 요청은 승인 후에도 판정 입력이 아니며, 승인은 상태·결정자·시각·필수 사유만 기록한다. 운영자는 승인된 요청 링크에서 그림을 초안으로 가져온 뒤 일반 편집 저장 경로로 반영하고, 저장 사유에 요청 번호를 넣어 `market_change_log`에 남긴다. WU-14는 승인 및 편집 링크까지만 제공하며 자동 반영·편집기 구현은 하지 않는다. `applied_change_log_id`는 향후 실제 편집 연결용으로 NULL을 유지한다.
