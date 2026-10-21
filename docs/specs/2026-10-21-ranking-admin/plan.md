# 랭킹 하위 데이터 관리 — 어드민 기획안

작성일: 2026-10-21. 상태: 검토 초안. 대상: `rank.1989v.com`의 카페·주유소 데이터.

산출물은 이 문서와 [screens.md](screens.md)다. 코드·설정·DB·ADR을 변경하지 않으며 커밋·푸시하지 않는다.
본문의 **[확인]**은 현재 워크트리의 파일 근거, **[제안]**은 구현 전 검토할 설계다. 운영 배포 상태와 운영 DB 수치는 검증하지 않았다.

## 1. 목적과 근거

사용자 원문: “이거 랭킹 하위 데이터도 관리할 수 있는 어드민 페이지도 필요할듯”.

**[제안]** 운영자가 공식 원천을 보존하면서 음료·유형·출처 오류를 교정하고, 다음 적재 뒤에도 교정을 추적하는 운영 도구를 만든다.
주유소는 보드·스냅샷의 신선도와 완결성을 읽는 데 집중한다. 일반 CRUD로 원천 행과 순위 원장을 직접 고치지 않는다.

근거 경로는 저장소 루트 기준이다. 아래 ID를 본문의 사실·판단 근거로 사용한다.

| ID | 파일 경로 | 확인 내용 |
|---|---|---|
| E1 | `ranking/CLAUDE.md` | 모듈, 자연키, 카페·주유소 적재 제약, 전용 TM |
| E2 | `docs/adr/ADR-0081-ranking-leaderboard-platform.md` §1·3·5·9 | 스냅샷 원장, 외부 호출 분리, 수집 범위, 카페 슬라이스 |
| E3 | `docs/specs/2026-10-21-cafe-compare-redesign/plan.md`의 이후 후보·§5·6 | 어드민 요구, 과거 집계, 매장 매핑 선행 조건 |
| E4 | `admin/CLAUDE.md` | FE 전용, 도메인별 API 소유, 운영 화면 밀도 |
| E5 | `admin/frontend/src/App.tsx`, `admin/frontend/src/components/layout/{AppLayout,Sidebar}.tsx` | 전용 admin 호스트 루트 라우팅, 셸·역할 상태, 사이드바 |
| E6 | `admin/frontend/src/pages/DealOffersPage.tsx`, `admin/frontend/src/api/deals.ts` | 견본: 필터·상태 요약·목록·편집·재조회·빈 상태 |
| E7 | `deal/feature/src/main/kotlin/com/kgd/deal/presentation/controller/DealAdminController.kt` | `/api/v1/admin/deal`과 `ApiResponse`, 게이트웨이 권한 의존 |
| E8 | `ads/feature/src/main/kotlin/com/kgd/ads/presentation/admin/controller/AdsAdminController.kt`, `ads/feature/src/main/kotlin/com/kgd/ads/presentation/support/RequestIdentity.kt` | 서비스의 관리자 신원 검사, 행위자 전달 |
| E9 | `gateway/src/main/kotlin/com/kgd/gateway/config/GatewayRouteConfig.kt`, `gateway/src/main/kotlin/com/kgd/gateway/filter/AuthenticationGatewayFilter.kt` | adminConfig, JWT 역할 검사·신원 헤더 주입, CONTENT_URI |
| E10 | `docs/conventions/entity-mutation.md`, `docs/architecture/data-sources.md` §0·9 | 전체 동기화와 부분 수정 분리, 외부 데이터 3규칙·원천 대장 |
| E11 | `ranking/ingest/src/cafe_load.py`, `ranking/feature/src/main/kotlin/com/kgd/ranking/presentation/controller/CafeDrinkController.kt` | 브랜드별 내부 bulk, 빈 파일 건너뜀, 공개 상세 API |
| E12 | `ranking/feature/src/main/kotlin/com/kgd/ranking/application/cafe/service/CafeDrinkService.kt`, `ranking/feature/src/main/kotlin/com/kgd/ranking/infrastructure/persistence/adapter/CafeDrinkRepositoryAdapter.kt` | 자연키 중복 검사, 브랜드 삭제·flush·재삽입 |
| E13 | `ranking/domain/src/main/kotlin/com/kgd/ranking/domain/cafe/model/{CafeDrinkKey,CafeDrink,CupVolumes}.kt` | v1 자연키 인코딩, 메뉴명 유형 규칙, 용량·농도 파생 |
| E14 | `ranking/feature/src/main/kotlin/com/kgd/ranking/infrastructure/persistence/repository/CafeDrinkQueryRepository.kt`, `ranking/feature/src/main/resources/rankingdb/migration/{V2__cafe_drink,V3__cafe_cup_volume}.sql` | DB 필터·정렬·집계, 원천·파생 컬럼, 브랜드 출처 집계 |
| E15 | `ranking/feature/src/main/kotlin/com/kgd/ranking/application/ranking/service/GasBoardRebuildService.kt`, `ranking/feature/src/main/kotlin/com/kgd/ranking/infrastructure/persistence/entity/RankingJpaEntities.kt` | TOP20, 엔트리 후 최신 포인터, 30일 정리, 보드·스냅샷 필드 |
| E16 | `ranking/feature/src/main/kotlin/com/kgd/ranking/infrastructure/config/RankingDataSourceConfig.kt` | content 폴드·ranking_db·rankingTransactionManager |
| E17 | `DESIGN.md`, `docs/standards/design-md.md`, `admin/frontend/src/api/client.ts`, `admin/frontend/src/hooks/useAuth.ts` | 토큰, HttpOnly 쿠키 세션, 조회 재시도·쓰기 타임아웃 처리 |

## 2. 현재 사실과 설계 공백

| 구분 | 확인한 사실 | 설계에 미치는 영향 |
|---|---|---|
| [확인] 카페 전체 동기화 | 요청에 등장한 브랜드만 삭제 후 재삽입한다. 빈 요청은 삭제하지 않는다. 로더는 브랜드별로 전송한다. E11·E12 | ID와 원천 행에 붙인 수기 값은 지속 식별자로 사용할 수 없다 |
| [확인] 자연키 | `(brand_slug, menu_name, temperature, size_label, caffeine_status)`. 온도·사이즈 null은 빈 문자열. `CafeDrinkKey`의 `v1_` 키가 있다. E1·E13 | 교정은 기존 drinkKey와 자연키 기준으로 연결한다 |
| [확인] 유형·농도 | 유형은 메뉴명 규칙, 컵용량과 농도는 도메인 getter로 다시 계산한다. 조회·필터는 저장 컬럼도 사용한다. E13·E14 | DB override만 추가하면 응답과 필터가 달라질 수 있다 |
| [확인] 브랜드 메타 | 행별 sourceUrl·checkedAt를 집계한다. URL은 복수이며 날짜는 최댓값이다. E14 | 브랜드 확인일을 바꿨다고 모든 행을 재확인한 것으로 처리하면 안 된다 |
| [확인] 적재 이력 공백 | 확인한 카페 경로는 응답 행 수·브랜드와 로더 stdout을 남긴다. 별도 실행 원장은 없다. E11·E12·E14 | 과거 적재 날짜·행 수는 복원했다고 표시할 수 없다 |
| [확인] 주유소 | 시군구×유종 TOP20 범위이며 전국 전량이 아니다. 스냅샷 엔트리 저장 후 latestSnapshotId를 갱신한다. E1·E2·E15 | 지연·누락·포인터 이상을 읽으며 순위 숫자를 직접 수정하지 않는다 |
| [확인] 현재 배선 | ranking-public은 CONTENT_URI=`http://content:8097`. ranking-admin 라우트는 없다. E9 | 서비스 구현만으로 외부 접근이 열리지 않는다 |
| [확인] 문서와 코드 차이 | admin 문서는 `/admin/*`로 설명하지만 App.tsx는 전용 admin 호스트의 `/`부터 라우팅한다. ADR-0081 초기 폴드 설명보다 §9·현재 코드가 최신이다. E2·E4·E5·E9·E16 | 신규 FE 경로는 admin 호스트의 `/ranking/*`, API는 content로 설계한다 |

**[확인]** E3에는 과거 ‘기타 461행’ 집계가 있다. 현재 유형 규칙은 E13을 기준으로 한다.
**[제안]** 요구된 ‘기타 157행’은 일괄 교정 수용 시나리오로 사용한다. 현재 운영 실측으로 단정하지 않으며 화면 건수는 API가 계산한다.

## 3. 관리 대상과 우선순위

다음 표는 모두 **[제안]**이다. 대상 사용자는 `ROLE_ADMIN` 운영자다. P1에는 별도 편집자 역할을 만들지 않는다.

| 순위·단계 | 관리 대상 | 과업·허용 변경 | 제외·경계 |
|---|---|---|---|
| 1 / P1 | 카페 음료 행 | 검색·필터·상세, 영양 수치·용량·표시명·메모 교정 | 원천 변경·원천 행 생성·삭제 제외 |
| 2 / P1 | drink_group | 단일·일괄 유형 교정, 교정 해제 | 원천 메뉴명 변경, 분류 코드 실행 편집 제외 |
| 3 / P1 | 브랜드 출처 URL·확인일 | 복수 공식 URL 목록과 운영 검증일 관리, 행 출처 교정 | 브랜드 확인일로 행별 확인일 덮기 금지 |
| 4 / P1 | 적재 이력 | 언제·대상 브랜드·시도/반영/제거 행 수·성공/실패 조회 | 파일 업로드·수집 시작·bulk 외부 노출 제외 |
| 5 / P1 | 충돌·감사 | 충돌 검토, 필드별 재승인·해제, 변경 이력·되돌리기 | 감사 로그 직접 수정·삭제 제외 |
| 6 / P1 | 주유소 보드·스냅샷 | 지역·유종·보드 상태·최신 시각·엔트리 수·포인터 정합 조회 | 가격·순위·스냅샷 삭제·재생성 버튼 제외 |
| 7 / P2 이후 | 매장↔브랜드 매핑 | 후보 검토·확정·해제, 원천 변경 충돌 | place 원천 DB 직접 접근, 매장별 메뉴 판매 보증 제외 |

### P1 편집 필드 계약

**[제안]** 편집 가능 필드를 서버 allowlist로 고정한다.

- `displayName`, `drinkGroup`, `adminNote`: 표시명과 운영 판단이다. 원천 `menu_name`·`notes`는 보존한다.
- `kcal`, `sugarG`, `caffeineMg`, `sodiumMg`, `carbsG`, `fatG`, `satFatG`, `proteinG`, `volumeMl`: 공식 근거가 있는 수치 교정이다. 수치는 0 이상, 용량은 양수 또는 명시적 미확정이다. 저장 정밀도는 기존 DECIMAL(14,4) 범위를 따른다.
- `sourceUrl`, `checkedAt`: 해당 행의 근거 URL·공식 자료 확인일 교정이다. URL은 https만, 날짜는 미래 불가다. `raw_nutrition`은 열람만 한다.
- 브랜드의 `officialUrls[]`, `verifiedAt`, `verificationNote`는 별도 메타다. URL 1개 이상, 확인일은 미래 불가다. 저장만으로 URL 접속·스크래핑을 실행하지 않는다.

**[제안]** brandSlug·menuName·temperature·sizeLabel·caffeineStatus는 자연키 구성 요소이므로 P1 수정 불가다.
이 값의 오류는 원천 재적재 후 신규 키로 검토한다. 기존 키의 교정을 새 키에 자동 이전하지 않는다.
카페인 상태 교정과 자연키 이전 도구는 P2에 별도 설계한다.
가격은 현재 공식 원천이 없으므로 교정 대상에서 제외한다. 출처: E1·E10·E13·E14.

**[제안]** 영양 null은 ‘미확정’으로 유지한다. 빈 입력을 0으로 변환하지 않는다.
ZERO 상태에는 caffeineMg=0만 허용하며 SET_UNKNOWN은 거절한다. UNDISCLOSED에 수치를 교정하려면 상태 검토가 선행되므로 P1에서는 거절한다.
DECAF는 0과 합치지 않으며, 원천 g을 ml로 추정하지 않는다. 근거 URL·수정 사유는 모든 변경에 필수다.

## 4. 교정 보존 방식 비교와 권고

아래 대안·판정은 **[제안]**이다. 실제 스키마 변경은 이 문서 승인 후 ADR 검토·마이그레이션 설계로 진행한다.

| 대안 | 재적재 대응 | 장점 | 비용·위험 | 판정 |
|---|---|---|---|---|
| A. 자연키 기반 별도 교정 테이블 | 원천 행과 독립. 브랜드 삭제 대상에서 제외하고 새 행에 재적용 | 교정·감사·사라진 키 보존, 출처와 운영 판단 분리 | 조회용 유효값 투영·충돌 검출·원천과 교정 동시성 필요 | **권고** |
| B. cafe_drink에 override 컬럼 추가 | 현재 delete/insert 전에 자연키별 override를 추출·복구하거나 sync를 upsert로 전환 | 단순 필드 읽기, 조인 감소 | 삭제 경로 한 곳 누락 시 유실. 사라진 행의 교정 보존에는 결국 별도 저장소 필요. 필드 증가 | 비권고 |
| C. 원천 JSONL을 운영자가 수정 후 재적재 | 다음 수집 파일에도 변경을 합쳐야 유지 | 적재 경로 재사용 | 공식 원천과 교정 혼합, 감사·동시 편집 취약, 수집 갱신 때 다시 유실 | 제외 |

### A안의 저장 경계

**[제안]** 다음 이름은 논리 모델 초안이다. 최종 DDL·인덱스·보관 정책은 구현 전 검토한다.

| 논리 저장소 | 주요 필드·책임 |
|---|---|
| cafe_drink | 원천 25필드·raw·notes 보존. 기존 기본 파생값과 신규 `effective_*` 투영을 분리 |
| cafe_drink_override | 원천 drinkKey/자연키 + field별 operation·value·baseline·상태, revision, 근거 URL·확인일. `(drinkKey, field)` 유일 |
| cafe_brand_verification | brandSlug, 복수 officialUrls, verifiedAt, 검증 메모, revision. 행별 sourceUrl·checkedAt와 독립 |
| ranking_ingest_run | runId, job, brand, 시작·종료, 실행자/잡 식별자, 상태, 행 수, 데이터 세대, 오류 요약 |
| ranking_admin_audit | auditId·operationId, actorId, 서버 UTC 시각, 대상 자연키·필드, 변경 전후·상태·revision, 사유·근거, revertOf |

**[제안]** 키는 E13의 v1 인코딩을 재사용하며 별도 문자열 이어붙이기 키를 만들지 않는다.
DB collation과 애플리케이션 비교 차이로 복수 키가 동일 행에 대응하면 적재를 거절한다. 구현 시 대소문자·유니코드·null/빈 문자열 회귀를 검증한다.
교정은 cafe_drink.id에 FK로 연결하지 않으며 원천 삭제 cascade를 타지 않는다.
필드별 상태 레코드에 conflictId와 검출 runId를 두며, 같은 미해결 충돌은 중복 생성하지 않는다.
키 재등장은 CONFLICT에 KEY_REAPPEARED 사유를 붙이고 현재 기준 재승인을 요구한다.

### 유효값과 공개 조회

**[제안]** 우선순위는 `ACTIVE 교정 > 현재 원천/기본 파생값`이다.
필드 operation은 `SET(value)`, `SET_UNKNOWN`, `RESET`으로 분리한다. SET_UNKNOWN은 교정된 미확정, RESET은 교정 해제다.
요청에 없는 필드는 변경하지 않는다. 화면의 빈 입력만으로 SET_UNKNOWN을 만들지 않는다.
SET_UNKNOWN은 nullable 수치·운영 메모에만 허용한다. 유형·표시명·URL·확인일 등 필수값은 SET 또는 RESET만 허용한다.

**[제안]** 실효 영양·용량을 먼저 결정하고 컵용량·volumeSource·100ml 수치를 도메인 규칙으로 다시 산출한다.
유형은 기본 분류 뒤 ACTIVE drinkGroup 교정을 적용한다.
용량 SET은 검증된 컵용량을 직접 사용하고 출처를 `ADMIN_VERIFIED`로 표시한다.
용량 SET_UNKNOWN은 원천 ml·컵용량 원문·브랜드 사이즈표 추론을 모두 차단한다. 유효 컵용량과 100ml 수치는 null이다.
용량 RESET만 현재 원천과 기존 CupVolumes 규칙으로 돌아간다. 교정값을 단순 null 입력으로 넘겨 다시 추론하지 않도록 상태를 도메인 계산에 전달한다.

**[제안]** 공개 목록·상세·필터·정렬·groups·brands가 같은 유효값을 사용하도록 조회 투영을 통일한다.
현재 도메인 getter·entity 매핑·Querydsl 경로를 함께 수정해야 한다. 기존 getter가 교정 유형을 다시 분류해 지우면 안 된다.
관리자 상세에는 `source`, `derived`, `override`, `effective`를 분리하고, 공개 상세에는 공식 원천 링크와 교정 근거를 구분해 제공한다.
표시명은 공개 검색에도 반영하되 원천 메뉴명 검색은 유지한다. 공개 URL의 drinkKey는 바꾸지 않는다.

### 다음 적재의 순서와 원자성

다음 절차는 모두 **[제안]**이다.

1. 수신 시 runId를 발급하고 실행 시작을 별도 짧은 트랜잭션으로 기록한다. 요청 구조·중복 키·정밀도·브랜드를 검증한다.
2. 대상 브랜드의 잠금을 잡는다. bulk·단일 교정·일괄 교정·되돌리기가 같은 잠금을 사용하며, 복수 브랜드는 slug 순으로 잡는다.
3. 기존 교정 baseline과 신규 원천을 자연키로 대조한다. 이번 적재에 없는 브랜드는 건드리지 않는다.
4. `rankingTransactionManager`의 한 트랜잭션 안에서 해당 브랜드 원천 삭제·재삽입, 기본 파생, 교정 상태 판정, 유효값 투영을 처리한다.
5. `ACTIVE` 필드는 재적용한다. 충돌 필드는 교정을 보존한 채 적용을 중지하고 신규 원천/파생값으로 조회한다. 다른 필드의 ACTIVE 교정은 유지한다.
6. 새 브랜드 generation·감사 이벤트·성공 run 결과를 같은 트랜잭션으로 확정한 뒤 커밋한다. 공개 조회는 완성 전·후 상태만 읽는다.
7. 실패하면 원천·교정 상태·투영·generation을 전부 롤백하고 별도 트랜잭션으로 FAILED를 남긴다. 중단된 RUNNING은 15분 뒤 INTERRUPTED로 식별한다.

**[제안]** 기존 bulk DTO의 원천 필드는 축소하지 않는다. 관리자 DTO를 수집기 전체 동기화 DTO로 되돌려 보내지 않는다.
새 원천 필드가 생기면 수집기 전송·DTO·저장·조회 왕복 계약을 함께 갱신한다. 관리자 교정은 부분 변경 메서드로 분리한다.
브랜드별 HTTP 요청이므로 한 로더 실행의 일부 브랜드만 성공할 수 있다. 전체 실행의 PARTIAL과 브랜드별 SUCCESS/FAILED를 구분한다.
출처: E10~E14·E16.

### 충돌 판정과 해결

**[제안]** 교정 저장 시 필드별 기준 원천값과 의존값을 baseline으로 저장한다.
일반 수치는 해당 원천 필드·servingBasis를, 용량은 volumeMl·servingBasis·temperature·sizeLabel·용량 규칙 버전을 비교한다.
유형은 menuName·sourceCategory·분류 규칙 버전을 비교한다. URL·날짜만 바뀐 경우는 수치 충돌로 만들지 않고 원천 갱신 알림으로 남긴다.

| 상태·사건 | 다음 적재·공개 동작 [제안] | 운영자 처리 |
|---|---|---|
| ACTIVE, 기준 원천 동일 | 교정 재적용 | 별도 작업 없음 |
| CONFLICT, 기준 원천·의존값 변경 | 해당 필드 교정 적용 중지. 현재 원천/파생값 표시 | 이전 원천·새 원천·교정·현재 유효값을 비교 |
| 새 원천이 교정값과 같아짐 | CONFLICT의 ‘원천과 일치’ 사유로 표시 | 교정 해제를 권고하며 자동 이력 삭제 금지 |
| ORPHANED, 자연키 소멸 | 교정·감사 유지, 공개 행 없음 | 누락·이름/상태 변경 검토. 다른 키에 자동 이전 금지 |
| 소멸 키가 재등장 | 검토 대기로 전환, 교정 자동 적용 보류 | 현재 원천 기준 재승인 후 ACTIVE |
| 무관한 필드만 변경 | 해당 교정 유지, 변경 요약 알림 | 필요 시 검토 |
| 형식 오류·중복 키 | 적재 실패, 직전 데이터 유지 | FAILED 이력 확인 |

**[제안]** 해결 액션은 ‘새 원천 채택=교정 해제’, ‘교정 유지=현재 원천으로 baseline 재설정’, ‘새 교정값 입력’이다.
사유와 근거를 다시 받아 감사에 남긴다. 검토 화면 이후 원천 generation이 바뀌면 409로 거절한다.
CONFLICT와 ORPHANED를 남겨 둔 채 알림만 닫는 동작은 P1에 넣지 않는다.

## 5. 감사·되돌리기·동시 편집

다음 정책은 모두 **[제안]**이다.

- 누가: 게이트웨이가 확인한 `X-User-Id`의 회원 ID를 서버에서 받는다. 클라이언트의 actorId·시각은 신뢰하지 않는다. 이메일·이름을 감사 키로 복제하지 않는다.
- 언제·무엇: 서버 UTC 시각, 자연키·필드, 원천 기준값, 이전/이후 교정과 유효값, 사유·근거 URL·확인일을 기록한다. UI는 KST와 시간대를 표시한다.
- 쓰기와 감사는 동일 TM·동일 트랜잭션이다. 감사 저장 실패 시 교정도 실패한다. bulk 자동 충돌 전환도 SYSTEM 행위자로 기록한다.
- 모든 수정에 `expectedRevision`과 `sourceGeneration`을 요구한다. 불일치는 409이며 마지막 쓰기로 덮어쓰지 않는다.
- 일괄 수정은 최대 200행, 명시적 키 집합과 previewToken을 쓴다. 전부 성공하거나 전부 취소하며 operationId 하나와 행별 감사 기록을 남긴다.
- 되돌리기는 과거 감사 기록 삭제가 아니라 새 보상 변경이다. 대상 필드가 해당 operation의 직후 revision 그대로이고 원천 generation도 동일할 때만 역적용한다.
- 이후 편집·재적재·충돌이 있으면 409로 중단하고 현재 기준으로 새 교정을 작성한다. 일괄 되돌리기 중 한 행이라도 달라졌으면 전체 취소한다.
- ACTIVE 교정 해제 시 현재 원천/파생값으로 돌아간다. 과거 원천을 복원하거나 브랜드 bulk를 역실행하지 않는다.
- 모든 관리자 쓰기는 클라이언트가 미리 생성한 UUID operationId를 idempotencyKey로 사용한다. 서버는 이 ID로 결과를 보관하므로 응답 유실 후에도 조회할 수 있다.
- 타임아웃 뒤에는 같은 operationId로 결과를 조회한다. 결과가 아직 없으면 성공·실패를 단정하지 않고 같은 키·같은 본문으로 재시도한다. 다른 본문은 409다.
- 재전송은 revision·generation·preview 만료 검사보다 기존 멱등 결과 조회를 우선한다. 완료 결과는 그대로 반환하고, 진행 중이면 중복 실행하지 않는다.
- operationId의 유일성 잠금으로 동시 중복 요청을 직렬화한다. 원천 변경·감사·성공 결과는 동일 트랜잭션으로 커밋하며 결과 저장 실패 시 함께 롤백한다.
- 감사 기록은 P1 운영 중 자동 삭제하지 않는다. 1년 보관을 승인 후보로 두고, 만료 정리·회원 삭제 정책·크기 예산은 운영 전 확정한다. 주유소 스냅샷의 30일 정리와 분리한다.

## 6. API 초안·권한·라우트

아래 API는 모두 **[제안] 신규**다. 기본 prefix는 `/api/v1/admin/ranking`이다.
`ApiResponse<T>`를 사용하고 페이지 응답은 `items,total,page,size`다. page는 0부터, 기본 size=50·최대 200이다.

| 메서드·하위 경로 | 계약·핵심 응답 | 화면 |
|---|---|---|
| GET `/cafe/drinks` | q, brand[], group, groupBasis=effective/derived, temperature, caffeineStatus[], correctionState, checkedBefore, sort, page/size. 원천·교정 요약·유효값·revision·generation | S1 |
| GET `/cafe/drinks/{drinkKey}` | source 전체·raw·derived·override·effective·출처·충돌·감사 요약 | S2 |
| PATCH `/cafe/drinks/{drinkKey}/corrections` | field별 SET/SET_UNKNOWN/RESET, reason, evidenceUrl, evidenceCheckedAt, expectedRevision, sourceGeneration | S2 |
| GET `/cafe/groups` | 기본/유효 유형별 전체 행 수와 교정·충돌 건수. 허용 유형 목록 | S1·S3 |
| POST `/cafe/group-corrections/preview` | 선택 keys≤200·targetGroup·사유·근거. 서버가 baseline·revision·generation 고정, 변경/동일/차단 행과 5분 유효 previewToken 반환 | S3 |
| POST `/cafe/group-corrections` | previewToken, idempotencyKey. 명시적 대상만 재검증·원자 반영, operationId·변경 건수 반환 | S3 |
| GET `/cafe/brands` | 브랜드별 행별 원천 URL 집합·최신/최저 확인일·미확정 수·운영 검증 메타 | S6 |
| PATCH `/cafe/brands/{brandSlug}/verification` | officialUrls[], verifiedAt, verificationNote, expectedRevision, reason | S6 |
| GET `/ingest-runs` | job, brand, status, from/to, page/size. runId·시작/종료·행 수·오류 요약·교정 재적용/충돌/소멸 수 | S4 |
| GET `/ingest-runs/{runId}` | 브랜드별 결과, 입력/반영/제거 수, 오류 코드·실패 단계, generation·연결 충돌 | S4 |
| GET `/conflicts` | brand, field, state, runId, page/size. 현재/이전 원천·교정·검출 시각 | S5 |
| POST `/conflicts/{conflictId}/resolve` | action=ADOPT_SOURCE/KEEP_CORRECTION/REPLACE, value, 근거·사유, expectedRevision, sourceGeneration | S5 |
| GET `/audit-events` | targetKey, actorId, operationId, 기간, page/size. 전후 차이·되돌리기 가능 여부와 불가 사유 | S2·S7 |
| POST `/operations/{operationId}/revert` | expectedRevisions, sourceGenerations, reason, idempotencyKey. 새 operationId 반환 | S7 |
| GET `/operations/{operationId}` | 처리 결과·대상·감사 연결. 결과 불명 시 조회 | S2·S3·S7 |
| GET `/gas/boards` | scope, fuel, status, health, page/size. latestSnapshotId·capturedAt·저장 count·실제 count·상태 | S8 |
| GET `/gas/boards/{boardId}/snapshots` | capturedAt·entryCount·실제 count·최신 여부, 보관된 스냅샷 페이지 | S8 |
| GET `/gas/snapshots/{snapshotId}` | 순위·score·prevRank·subjectKey·payload, 보드 연결·정합 결과 | S8 |

### 요청·응답의 공통 세부

**[제안]** PATCH는 변경 필드만 전달하며 원천 전체 DTO를 받지 않는다. RESET과 명시적 미확정은 구별한다.
서버는 알 수 없는 필드·잘못된 enum·부정 수치·비정상 키·초과 페이지 크기를 400으로 반환한다.
200/201 성공 응답에는 operationId·newRevision·newGeneration을 필요한 범위에서 제공한다.
401은 미인증, 403은 역할 부족, 404는 없는 대상, 409는 revision/generation/preview/멱등성 충돌이다.
모든 관리자 쓰기에 operationId/idempotencyKey·expectedRevision·근거·사유를 요구한다.
다수 행은 revision 집합 또는 previewToken으로 이를 대체하며, 원천과 무관한 브랜드 검증에는 sourceGeneration이 필요 없다.
브랜드 검증의 officialUrls·verifiedAt는 근거 URL·확인일을 겸한다.
쓰기 타임아웃은 자동 성공으로 처리하지 않는다. 원천 raw·내부 오류 상세는 공개 API에 넣지 않는다.

### 권한과 게이트웨이 영향

- **[확인]** E7의 deal은 게이트웨이 검사에 의존한다. E8의 ads는 서비스에서도 RequestIdentity.admin으로 역할·신원을 확인한다.
- **[확인]** E9의 adminConfig는 ROLE_ADMIN을 요구하고 JWT 검사 뒤 X-User-Id·X-User-Roles를 주입한다. 쿠키 쓰기는 Origin/Referer 검사도 거친다.
- **[제안]** ranking은 ads 방식으로 모든 관리자 조회·쓰기에서 신원과 ROLE_ADMIN을 검사한다. 파싱은 공통 신원 규약을 따르고 임의 `@PreAuthorize`만으로 보호됐다고 간주하지 않는다.
- **[제안]** `ranking-admin` 라우트에 `/api/v1/admin/ranking/**` + adminConfig + stripPrefix(0) + CONTENT_URI를 추가한다. 공개 ranking 라우트를 넓혀 받지 않는다.
- **[제안]** content 직접 접근은 ingress 미노출·신뢰된 내부 경로로 제한한다. 서비스의 헤더 검사는 게이트웨이 신뢰 경계 안에서만 유효하다. 외부에서 위조 헤더만 보내 관리자 쓰기가 되면 출시 불가다.
- **[제안]** admin-fe는 기존 같은 오리진 apiClient·HttpOnly 쿠키 흐름을 쓴다. 권한 숨김은 편의 기능이다. 새 토큰 저장·관리자 자동 부여 기능은 만들지 않는다.
- **[제안]** admin 호스트의 기존 `/api` 게이트웨이 전달 구성을 구현 때 확인한다. 별도 rank 호스트 admin UI·신규 상시 파드는 만들지 않는다. `/internal/ranking/**`는 계속 미노출한다.

## 7. 적재·주유소 상태의 운영 정의

다음은 모두 **[제안]**이다.

### 적재 이력

카페 로더 실행에 parentRunId를 부여하고 브랜드별 API 실행을 연결한다.
요청 수신 이후 서버 원장 기록만 P1의 보장 범위다. HTTP 호출 전 파일 파싱·접속 실패도 보려면 로더가 내부 실행 보고 경로로 보고해야 한다.
해당 내부 보고 경로는 외부 admin API와 분리하고 인증된 잡만 사용한다. 원문 JSONL·비밀키·전체 stacktrace는 이력 화면에 싣지 않는다.

행 수는 `attemptedRows`, `committedRows`, `removedRows`, `overrideReapplied`, `conflictFields`, `orphanedKeys`를 구분한다.
실패 시 committedRows=0이며 이전 저장 행 수는 별도다. 기존 데이터에 첫 수집일을 추정해서 채우지 않는다.
도입 전은 ‘이력 수집 이전’으로 표시하고, 파일 checkedAt와 서버 적재 시각을 서로 대체하지 않는다.

### 주유소 보드·스냅샷

보드 status와 운영 진단 health를 별도 컬럼으로 표시한다.
정상은 최신 포인터가 존재하고 엔트리 실제 수가 entryCount와 같으며 갱신이 36시간 이내인 경우다.
36시간 초과는 지연, latestSnapshotId 없음은 미생성, 포인터 대상 없음·수 불일치·중복 순위는 정합 오류다.
이 수치는 목표 정책이며 실제 SLA 확정값이 아니다. 아직 배치 시도 기록이 없으면 원인을 ‘실패’로 단정하지 않는다.

TOP20이므로 20행 미만은 곧 오류가 아니다. prevRank=null은 ‘신규 진입’이며 0으로 바꾸지 않는다.
보존기간 30일이 지난 과거 스냅샷은 ‘보관기간 경과 또는 없음’으로 표시한다. 삭제된 자료의 복원이 가능하다고 안내하지 않는다.
P1에서는 재생성·최신 포인터 변경·원천 가격 수정 동작을 제공하지 않는다. 출처: E1·E2·E15.

## 8. 단계와 측정 가능한 수용 기준

다음은 모두 **[제안] 목표**다. 구현 결과나 통과 기록이 아니다.

### P1 — 카페 교정 운영과 읽기 전용 상태 관리

순서는 ① 교정·감사·실효값 계약 ② 브랜드 bulk 재적용·충돌 ③ 관리자 API·권한 라우트 ④ S1~S8 화면이다.
교정 UI만 먼저 배포하고 보존·감사를 나중에 붙이는 순서는 허용하지 않는다.

| ID | 수용 기준·검증 방법 |
|---|---|
| AC1 | 2브랜드 fixture 중 1브랜드만 bulk 후 해당 원천만 교체된다. 다른 브랜드·교정·감사 유실 0건. 빈 bulk 삭제 0건 |
| AC2 | 동일 자연키 행 ID가 바뀌는 재적재를 2회 수행해 ACTIVE 교정 100% 유지. null/빈 온도·사이즈, 일반/디카페인 동명 변형이 서로 섞이는 사례 0건 |
| AC3 | 교정 중인 원천 수치·유형 의존값 변경, 키 소멸·재등장 fixture 각각에서 규정된 충돌/소멸 상태와 현재 원천 공개값을 검증한다 |
| AC4 | 수기 수정 전후 원천 25필드·raw·notes 해시 동일. RESET/SET_UNKNOWN/SET(0) 결과가 다르고, 음수·미공개 카페인 추정·g→ml 추정 허용 0건 |
| AC5 | 유효값 교정 후 공개 목록·상세·정렬·상한·유형 수·브랜드 출처가 일치한다. 페이지 처리 전 필터·정렬하며 반올림 전 수치로 순서를 검증한다. 용량 SET_UNKNOWN 뒤 100ml 값은 모두 null이며, RESET 뒤에만 기존 추론이 재개된다 |
| AC6 | 157개 ‘기타’ fixture를 페이지 간 선택해 미리보기·유형 변경한다. 선택하지 않은 행 변경 0건. preview 뒤 1행 수정/재적재 시 409와 전체 변경 0건 |
| AC7 | 저장·해제·재승인·일괄·되돌리기마다 행위자·서버 시각·전후 값·근거·사유 기록 100%. 감사 저장 실패를 주입하면 데이터 변경 0건 |
| AC8 | 단일·157행 operation의 되돌리기로 이전 교정 상태 복구. 후속 편집/재적재 시 409. 과거 원천 복원·감사 삭제 0건. 저장·일괄·브랜드 검증·충돌 해결·되돌리기의 응답 유실 후 같은 operationId로 조회·재전송해 추가 변경/감사 0건 |
| AC9 | 관리자 전체 API의 무인증=401, 일반/판매자=403, 관리자=정상 응답을 검증한다. 위조 신원 헤더·쿠키의 비신뢰 출처 쓰기 차단, internal 외부 미노출을 확인한다 |
| AC10 | 적재 성공·검증 실패·DB 실패·중단·브랜드 부분 성공 각각 이력에 시각·브랜드·입력/반영 수·상태가 일치한다. 중단 RUNNING은 15분 이후 구분 가능 |
| AC11 | 브랜드 검증일 수정 후 행별 checkedAt 불변. 복수 공식 URL·미확인 상태 유지, ‘미확인=허가’ 표현 0건 |
| AC12 | 주유소 정상/36시간 지연/최신 없음/count 불일치/prevRank=null/과거 없음 fixture의 상태 문구가 S8과 일치한다. 쓰기 버튼·가격 수정 API 0개 |
| AC13 | 1280×800에서 S1 주요 열과 페이지 제어에 페이지 가로 넘침 0px. S2 원천·교정 나란히 표시. 200% 확대·키보드 탐색·빈/오류/403 상태 검수 |
| AC14 | 동일 브랜드 bulk와 교정의 동시 실행 10회에서 원천·투영·감사 불일치 0건. 최대 200행 일괄 처리가 운영 유사 데이터에서 P95 3초 이내이며 단일 저장 P95 1초 이내를 목표로 측정 |

### P2 이후

**[제안]** 우선순위는 충돌 운영 결과로 재조정한다.

1. 자연키 변경·카페인 상태 교정·재연결 도구와 규칙 버전 관리. 다른 변형에 교정이 붙는 사례 0건을 회귀 기준으로 둔다.
2. 매장↔브랜드 검토 화면. place가 원천 SSOT를 유지하며 source+sourceKey, 이전/현재 상호·지점·주소, CONFIRMED/REVIEW/UNMAPPED를 관리한다. 서비스 간 DB 공유는 금지한다.
3. E3 P2의 지역·브랜드 표본 검수와 정밀도 98% 기준, coverage·갱신일·재수집 보존 조건을 충족한 뒤 매핑 확정 기능을 연다. 지도·매장 메뉴/가격/재고 확정은 별도 범위다.
4. 자동 수집 실행·재시도·스냅샷 재생성은 내부 실행 권한·중복 방지·외부 한도 정책을 별도 승인한 후 검토한다.

## 9. 요약과 사용자 결정 필요 항목

**[제안 요약]** admin-fe에 랭킹 관리 메뉴를 추가하고 ranking이 전용 관리자 API를 소유한다.
자연키 기반 별도 교정 테이블을 권고하며, 재적재 후 원천 변경 충돌은 필드별 적용 중지와 재검토로 처리한다.
P1은 카페 교정·일괄 유형 처리·브랜드 검증·적재/감사/충돌·읽기 전용 주유소 상태까지다.

| 사용자 결정 필요 항목 | 권고 초안 | 결정 영향 |
|---|---|---|
| 교정 저장 방식 | A안 별도 테이블 | 향후 ADR·DDL·조회 투영 범위 |
| 원천 변경 시 공개값 | 충돌 필드는 신규 원천으로 복귀, 교정은 보존 | 미검토 교정의 지속 노출 여부 |
| P1 수정 범위 | 자연키·카페인 상태 제외, 수치·유형·출처 우선 | 상태 오류를 교정할 운영 절차 |
| P1 출시 묶음 | S1~S8, 주유소는 읽기 전용 | 최소 출시 일정·화면 범위 |
| 감사·진단 기준 | 감사 1년 보관 후보, 지연 36시간 | 운영 전 개인정보·스토리지 정책 검토 |

사용자 결정은 이 기획 초안의 승인과 분리해 기록한다. 승인 전 코드·마이그레이션·운영 데이터 변경을 시작하지 않는다.
