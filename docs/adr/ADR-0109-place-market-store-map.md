# ADR-0109 — Place 시장·구역·가게 지도와 원천 보호

## Status
Accepted (2026-10-15) — 사용자 승인 WU-1. P1~P3 요구사항은 `docs/specs/2026-10-15-market-store-map/prd.md`, 순서는 `tasks.md`.

## Context
전통시장 관광지에는 시장 소속·골목·건물·층별 점포가 필요하다. 온누리 가맹점은 시장 밖 점포도 포함하고, 상가정보는 시장 소속을 주지 않는다. 운영자와 상인회가 판정과 누락 점포를 보완해야 하며 재적재가 그 입력을 지워서는 안 된다.

`pois`는 원천별 POI 전체 동기화와 geo_distance 조회를 위한 모델이다. 시장별 소속·구역 계층·참고 핀·편집 근거를 섞으면 기존 POI 교체 작업이 편집 데이터를 삭제할 수 있다. 신규 상시 파드 없이 `place:domain` / `place:feature`에 구현한다(ADR-0083 레이어 표준).

## Decision

1. V36으로 `market`, `market_zone`, `market_store`, `market_store_override`, `market_change_log`, `market_steward` 여섯 테이블을 만든다. utf8mb4, enum VARCHAR + JPA STRING, 참조는 plain ID를 사용한다. member는 다른 서비스이므로 DB FK를 만들지 않는다.
2. **원천 층**은 조회용 컬럼과 전체 payload JSON을 함께 가진다. 시장은 `source_raw`, 가게는 원천별 `onnuri_raw`와 `sangga_raw`를 분리해 두 원천을 모두 보존한다. 주소·업종·건물·동·층·호와 원천 키는 컬럼, 나머지 원천 필드 및 원문 좌표·날짜는 JSON에 그대로 싣는다. 원천 payload를 정규화된 DTO로 다시 만들지 않는다(`data-sources.md` §0). 실제 원천 연동 및 대장 3종 등록은 WU-2에서 한다.
3. **판정 층**은 시장 유형, 소속 `IN/OUT/UNKNOWN`, 구역 ID, 좌표·핀 종류와 필드별 override이다. `market_store_override(store_id, field)` 한 행이 현재 덮어쓰기이며 value는 field enum에 따라 검증한다. NULL은 품목·구역·좌표의 명시적 해제다. 이유·작성 회원·ADMIN/STEWARD 출처를 필수로 둔다. 표시 projection만 override를 적용하며 원천 객체나 JSON은 변경하지 않는다. 기본 노출은 IN과 UNKNOWN이며, UNKNOWN은 좌표를 숨겨 지도 핀 없이 목록에만 보인다. OUT은 includeOutside 조회에서만 보인다. 좌표 override 필드 자체도 위도·경도 쌍으로 존재해야 한다(원천 좌표에 기대어 한 축만 저장하지 않는다). 좌표는 쌍이며 저장 전에 현재 override와 제안 필드를 합성해 잘못된 값이나 불완전한 쌍을 거부한다. 좌표 NULL 해제처럼 둘을 함께 바꾸는 경우 동일 점포 필드 묶음을 한 트랜잭션으로 저장한다.
4. **추가 층**은 `market_store.source=MANUAL`, `market_zone.source=MANUAL` 행이다. 수동 가게의 ADMIN/STEWARD·작성 회원을 보존한다. REFERENCE 핀은 참조 가게 ID·상대 위치·메모를 가진다. 구역은 parent ID로 건물→층을 표현하며 이름·폴리곤·정렬은 편집 데이터다.
5. 자연 키는 시장의 `attraction_content_id`(언어별 관광지 ID가 아니라 공유 content ID)와 전통시장 원천 키, 구역의 `(market_id, source, source_key)`, 가게의 `(market_id, source, source_key)`다. 온누리/상가 키는 시장 안에서 각각 UNIQUE이며 서로 매칭한 한 점포가 두 키를 가진다. MANUAL은 원천 키가 없어도 되며 대리 ID로 편집한다. 원천 키 변화 시 재매칭 정책은 WU-2에서 구현한다.
6. 재적재는 자연 키로 **같은 ID를 UPDATE**한다. DELETE/TRUNCATE 후 재삽입을 금지한다. 가게 원천 재적재는 MANUAL 입력을 받지 않고 override를 건드리지 않는다. 보강 원천 payload가 없는 입력은 기존 보강 JSON과 좌표·업종·건물·동·층·호 컬럼을 함께 보존한다. 자동 구역 재적재는 기존 이름·폴리곤·정렬을 보존한다. 시장 fallback 입력은 이미 매칭한 원천을 제거하지 않는다. 분기별 미관측 원천의 삭제·비활성화는 이번 골격에서 제공하지 않는다. WU-2/5에서 재적재 전후 MANUAL·override 수 및 편집값 보존을 검증한다.
7. 시장별 권한은 `market_steward(market_id, member_id)` UNIQUE 행의 PENDING/ACTIVE/SUSPENDED/REJECTED 상태가 갖는다. JWT 전역 역할에 시장 목록을 넣지 않는다. ADR-0072의 `blog_profile`과 같이 다음 요청마다 DB의 ACTIVE와 시장 범위를 확인하면 정지는 토큰 만료를 기다리지 않는다. ADMIN은 기존 전역 운영 권한을 사용한다. 승인자와 승인 시각을 보존한다. 실제 인증 경로·승인·편집은 WU-7 범위다.
8. `market_change_log`는 append-only 전후 JSON·대상·동작·회원·actor를 보관한다. override의 이전 값을 여기 기록하는 편집 트랜잭션과 되돌리기는 WU-5에서 구현한다. 골격 save port는 로그를 수정·일괄 삭제하는 연산을 제공하지 않는다.

## Alternatives Considered

- **pois 확장**: 시장과 무관한 POI 적재·검색 모델에 구역·소속·권한·override 생명주기를 결합하므로 제외했다.
- **원천 컬럼 직접 편집**: 다음 적재가 편집을 지우고 원천 판정 근거를 잃으므로 제외했다.
- **JWT에 시장 권한 보관**: 권한 정지와 토큰 만료 사이 지연, 시장별 스코프의 중복 진실이 생기므로 제외했다.
- **원천마다 가게 별도 테이블**: 매칭한 점포의 override·구역 배정이 두 곳으로 갈라지므로 한 행 안 원천별 키와 JSON을 선택했다.

## Consequences

시장 데이터는 기존 POI 적재와 독립적으로 진화하고, 조회 시 원천과 편집 출처를 함께 보여줄 수 있다. 원천 JSON 저장 비용과 표시값 합성 비용이 추가된다. 시장별 key 조회 인덱스와 한 번의 store-ID override 조회를 사용한다.

WU-1은 순수 도메인, query/save port, usecase/service, JPA 어댑터와 스키마 골격만 제공한다. 수집·반경/밀도 임계값·컨트롤러·편집/이력 트랜잭션·권한 요청 처리·UI는 후속 WU이며 이 ADR이 그 기능의 완료를 뜻하지 않는다. 컴파일과 Market 단위 테스트는 검증하지만 운영 MySQL에 마이그레이션을 적용하지 않는다.
