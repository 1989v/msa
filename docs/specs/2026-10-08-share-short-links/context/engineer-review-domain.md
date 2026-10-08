# Engineer Review — Domain

- 대상: `docs/specs/2026-10-08-share-short-links/spec.md` (+ `planning/requirements.md`, `context/open-questions.yml`, `docs/adr/ADR-0103-share-short-links.md`)
- 차원: domain (체크리스트 `hns/0.16.1/skills/spec-review/reviewers/domain/checklist.md`)
- 일자: 2026-10-08
- KB 기준(개념 페이지, 1989v 볼트): [[dry]] · [[modular-monolith-fold]] · [[external-data-ingestion-rules]]

## Seed Discovery

1. 스펙·요구사항·열린 질문·ADR-0103 전문
2. 같은 폴더: `planning/*`, `context/open-questions.yml` (Q1~Q3 closed)
3. 표준: `docs/context-map.md`, `blog/glossary.md`, `code-dictionary/glossary.md`, `game/CLAUDE.md`, `place/CLAUDE.md`, `blog/CLAUDE.md`, ADR-0064/0077/0089
4. 코드: `ResumeShareLink.kt`, `ResumeAccessPolicy.kt`, `ResumeAdminService.kt`, `V6__resume.sql`, `Game.kt`, `GameCatalogAdapters.kt`, `GameQueryService.kt`, `BlogEnums.kt`, `BlogQueryService.kt`, `Attraction.kt`, `AttractionRepositoryAdapter.kt`, `AttractionPage.tsx`, `content/app/build.gradle.kts`, `atlas/app/build.gradle.kts`

## 체크리스트 판정

| # | 항목 | 판정 | 근거 |
|---|---|---|---|
| C1 | BC 경계 명확·누수 없음 | 통과 | 해석을 대상 도메인이 각자 한다(spec.md:45-46, ADR-0103:33-37). 폴드 위치가 실제와 맞다 — `content/app/build.gradle.kts:13-16`(place·game·blog), `atlas/app/build.gradle.kts:10`(code-dictionary=resume). 원장을 도메인별로 두는 결정(spec.md:67)은 [[modular-monolith-fold]] 「원장·배치는 그것을 아는 도메인 모듈에 둔다」와 맞다 |
| C2 | Glossary 존재 | **미흡** | D1 |
| C3 | 스펙 어휘 ↔ glossary | **미흡** | D1 (신조어 미등재) |
| C4 | `Avoid:` 동의어 미사용 | **미흡** | D2 |
| C5 | 스펙 ↔ 코드 어휘 일치 | **미흡** | D3, D4 |
| C6 | Aggregate 불변식 명시·강제 가능 | **미흡** | D5, D6, D7, D8 |
| C7 | 도메인 이벤트 범위 | 해당 없음 | 이벤트를 새로 만들지 않는다. 클릭 기록은 동기 저장이고 실패해도 302 가 나간다(spec.md:69) |
| C8 | 교차 aggregate 직접 참조 없음 | 통과 | "다른 도메인을 호출하지 않는다"(spec.md:46). 코덱은 도메인 어휘가 없는 `common` 의 순수 함수(spec.md:32) |
| C9 | VO / Entity 분류 | 통과(권고 1) | 공개 콘텐츠 코드는 저장하지 않는 파생값이고(spec.md:29), 디코더는 예외 대신 해석 실패를 돌려준다(spec.md:33) — VO 로 맞다. 이력서 코드는 `ResumeShareLink` 엔티티의 속성이다(spec.md:38). 권고: 코드 타입에 이름(예: `ShortCode`)을 붙여 glossary 에 올린다(D1) |
| R1 | 이력서 원장 중복 | **미흡** | D9 |

## Findings

### D1. glossary 누락 + 신조어 미등재 — REVISE

- `docs/context-map.md:16-33` 의 BC 표에 **place·game·deal·ranking 이 없다**. 이번 스펙이 다루는 네 도메인 중 blog 만 glossary 가 있다(`blog/glossary.md`).
- resume 는 code-dictionary BC 안에 있는데 `code-dictionary/glossary.md` 는 Concept·ConceptIndex·Service·CodeLocation 만 다룬다(§2·§3). `ResumeShareLink`·「제출처 링크」·「공유 토큰」이 등재돼 있지 않다.
- 스펙이 새로 만드는 용어가 어디에도 정의돼 있지 않다: 「단축 주소」「코드」(공개 콘텐츠 코드 / 이력서 코드, spec.md:26·36), 「해석」(spec.md:43), 「`list` 별칭」(spec.md:21), 「클릭 원장」「누적 클릭 수」(spec.md:67-68).
- 수정: 스펙 확정 뒤 `/hns:glossary` 를 돌려 ① context-map 에 place·game 행 추가 ② 위 용어를 각 BC glossary 에 넣는다. 특히 「코드」는 code-dictionary 의 `Service.code`(카탈로그 식별자, glossary §2 Service)와 이름이 겹치므로 `ShortCode` 처럼 구분되는 이름을 쓴다.

### D2. blog glossary 의 `Avoid` 어휘 「비공개」 사용 — REVISE (경계 사례)

- 스펙: 해석 실패 분류를 「형식 오류·대상 없음·**비공개**·철회」로 묶고(spec.md:52), 로그 분류에도 같은 말을 쓴다(spec.md:76). 이 분류는 blog 의 `DRAFT`/`ARCHIVED` 에도 적용된다.
- 표준: `blog/glossary.md:14` PostStatus 의 피해야 할 표현 — 「"비공개"(내림은 `ARCHIVED`)」.
- 판정 메모: 체크리스트를 글자 그대로 읽으면 BLOCK 이다. 다만 스펙은 blog 의 상태 이름으로 「비공개」를 쓰지 않는다. 글에 대해서는 「`PUBLISHED` 만 연다」고 정확히 적었고(spec.md:49), 「비공개」는 네 도메인을 가로지르는 결과 분류 이름으로 쓰였다. 단어 하나를 바꾸면 풀리므로 REVISE 로 둔다. 부모가 BLOCK 으로 올려도 근거는 같다.
- 수정: 결과 분류를 「공개 아님」으로 바꾸고, 도메인별로 무엇에 대응하는지 한 줄씩 적는다 — blog `!PostStatus.publiclyVisible`, game `!Game.isPlayable()`, resume `!ResumeShareLink.isUsable()`(D5).

### D3. 「철회」 ↔ 코드·ADR 의 「폐기」 — REVISE

- 스펙: 「철회한 링크」(spec.md:40), 「철회되지 않은 링크만」(spec.md:51), 「철회」(spec.md:52), 「철회로만 끈다」(spec.md:98). ADR-0103:31 도 같은 말을 쓴다.
- 기존 어휘: `ResumeShareLink.kt:21` 「폐기되지 않았으면 열람 가능」, `ADR-0064-resume-site-gated-serving.md:53` 「폐기·미존재 토큰」, `:102` 「발급/폐기 시각」, 코드 메서드 `revokeShareLink`(`ResumeAdminService.kt:86`), 컬럼 `revokedAt`.
- 한 개념에 두 이름이 생긴다. 수정: 스펙과 ADR-0103 의 「철회」를 「폐기」로 바꾼다.

### D4. 「비공개 게임」 경로는 존재하지 않는다 — REVISE

- 스펙: 「비공개 게임의 입장 게이트는 목적지 페이지가 처리한다」(spec.md:50). 요구사항도 「비공개 게임(ADR-0089) 판정은 …」이라고 쓴다(requirements.md:48-49).
- 실제 모델: ADR-0089 는 이것을 **비밀 게임**이라 부르고(`ADR-0089-private-games.md:3`), **「카탈로그에는 넣지 않는다」**(`:51`)고 정했다. 명단도 `game_slug` 로 건다(`:45`). 카탈로그 행이 없으니 id 가 없고, id 에서 만드는 `/g/` 코드도 생기지 않는다. 스펙 문장은 일어날 수 없는 경로를 설명한다. 이름도 ADR 과 다르다.
- 수정: spec.md:50 의 뒤 절을 「비밀 게임(ADR-0089)은 카탈로그 행이 없어 단축 코드를 갖지 않는다」로 바꾼다.

### D5. 공개 판정을 인프라 상수가 아니라 도메인 술어로 지정 — REVISE

- 스펙: 「기존 규칙을 그대로 쓴다」(spec.md:49)는 옳다. 그런데 재사용 표가 게임의 공개 상태 근거로 인프라 상수 `GameCatalogAdapters.kt:46`(`PUBLIC_STATUSES`)를 가리킨다(spec.md:88).
- 도메인이 이미 가진 술어:
  - game `Game.isPlayable()` — `game/domain/.../Game.kt:153`. 상세 API 가 이것을 쓴다(`GameQueryService.kt:170`).
  - blog `PostStatus.publiclyVisible` — `blog/domain/.../BlogEnums.kt:47`. 상세는 아직 `status != PUBLISHED` 로 직접 비교한다(`BlogQueryService.kt:118`).
  - resume `ResumeShareLink.isUsable()` — `ResumeShareLink.kt:22`.
- 리졸버가 인프라 집합이나 `== PUBLISHED` 를 다시 쓰면 같은 규칙의 사본이 하나 더 생긴다([[dry]] — 지식의 중복). 수정: SR-4 에 도메인별 술어 이름을 적고, 재사용 표의 게임 행을 `Game.isPlayable()` 로 바꾼다.

### D6. 관광지 식별자에는 언어가 들어 있다 — 목적지 주소가 이를 빠뜨렸다 — REVISE

- 스펙: 관광지 목적지는 `place.1989v.com/attractions/{id}` 하나다(spec.md:22-23).
- 모델: 국문·영문은 별도 행이고 자연키는 `(contentId, lang)` 이다(`place/domain/.../Attraction.kt:8`). 상세 화면은 **경로로 UI 언어를 정한다**(`portal-fe/src/pages/place/AttractionPage.tsx:89`). `/en/attractions/{ko-id}` 같은 어긋난 주소를 canonical 로 수습하는 코드가 이미 있다(`:132-134`).
- 결과: 영문 관광지의 단축 주소는 영문 콘텐츠를 국문 UI 로 연다. canonical 도 요청 주소와 다르다.
- 수정: SR-1 목적지를 「`lang=en` 이면 `/en/attractions/{id}`, 아니면 `/attractions/{id}`」로 적는다. 결정은 place 리졸버가 행의 `lang` 으로 한다.

### D7. 이력서 코드 불변식을 aggregate 가 지키게 — REVISE

- 스펙은 불변식 넷을 적는다: 10자 base62, 유일, 바꾸지 않음, 마이그레이션 뒤 빈 행 없음(spec.md:38-40). 어디서 강제하는지는 적지 않았다.
- 기존 패턴: `ResumeShareLink` 는 토큰 형식을 `TOKEN_PATTERN` 으로 `restore` 에서 검사하고(`ResumeShareLink.kt:28,47-49`), 필드는 전부 `val` 이다(`:13-18`).
- 수정:
  ① `ResumeShareLink` 에 `val shortCode` 를 두고, `create`/`restore` 에서 `^[0-9A-Za-z]{10}$` 를 검사한다.
  ② 「빈 행 없음」은 UNIQUE 만으로 지켜지지 않는다. 백필 뒤 `NOT NULL` 로 바꾸는 단계를 SR-3 에 적는다.
  ③ UNIQUE 충돌 시 처리를 적는다(재생성 N회). 59비트라 드물지만 생성 경로가 실패하면 링크 발급 전체가 실패한다.

### D8. 누적 클릭 수를 어느 aggregate 에 둘지 정하지 않았다 — REVISE

- 스펙: 「대상별 누적 클릭 수를 원장과 별도로 유지한다」(spec.md:68). 위치는 없다. Q3 의 권고안은 「대상 행의 누적 카운트 컬럼」이었다(`open-questions.yml:22`).
- 대상 행에 컬럼을 두면 두 도메인에서 깨진다.
  - game: 「실시간 카운터를 Game row 에 두지 않는다」(`game/CLAUDE.md:293`). 카운터는 `GameStats` 프로젝션이 갖는다.
  - place: 관광지 upsert 는 기존 행을 도메인 객체로 읽어 `syncFrom` 한 뒤 **엔티티를 새로 만들어 `saveAll`** 한다(`AttractionRepositoryAdapter.kt:39-43`). 카운터를 도메인에 안 실으면 매일 수집이 0/null 로 덮는다. 실으면 수집 트랜잭션과 클릭 증가가 서로의 값을 덮는다. [[external-data-ingestion-rules]] ③ 「전체 동기화 경로는 왕복 양쪽을 함께 갱신한다」가 정확히 이 함정을 다룬다.
- 수정: SR-6 에 도메인별 위치를 적는다. game 은 `GameStats`(또는 별도 카운트 표), place 는 `attractions` 밖의 별도 카운트 표(대상 id 키). blog 는 이미 `blog_post` 에 파생 카운터가 있어 같은 방식이 맞다(`blog/glossary.md:18`). 증가는 원자적 `UPDATE … SET n = n + 1` 로 한다는 것도 함께 적는다.

### D9. 이력서: 같은 사실을 두 원장이 다른 보존기간으로 센다 — REVISE

- 스펙: 이력서도 클릭 원장 + 누적 수를 갖고 90일로 정리한다(spec.md:67-70, 「네 원장을 90일」).
- 기존 모델: 제출처별 열람은 이미 `resume_access_log(share_link_id, …)` 가 남긴다(`V6__resume.sql:33-41`). 어드민 링크 목록은 이것으로 `visitCount` 를 내준다(`ResumeAdminService.kt:62-74`). 보존기간은 **365일**이고 이유도 적혀 있다 — 「**통계가 아니다.** 지원부터 결과까지 몇 달씩 걸리므로 90일이면 진행 중인 건의 기록이 사라진다」(`ADR-0077-ledger-retention.md:46`).
- `/r/` 클릭은 302 뒤 `?k=` 로 들어가 열람 기록도 남긴다. 「이 제출처가 열었는가」가 두 원장에 들어가고, 하나는 90일 뒤 사라지고 하나는 365일 남는다. 어드민에는 숫자 둘이 보인다([[dry]]).
- 수정: 둘 중 하나를 고른다.
  (a) 이력서는 클릭 원장에서 뺀다. `/r/` 은 302 만 하고, 진실은 열람 기록이다. SR-6 의 「네 원장」은 「세 원장」이 된다.
  (b) 남긴다면 「단축 클릭」과 「열람」을 glossary 에서 구분하고, 90일인 이유를 ADR-0077 표에 함께 적는다.

## 요약

| 판정 | 이슈 수 |
|---|---|
| REVISE | 9 (D1~D9) |

BLOCK 은 없다. 경계 사례는 D2 하나다(체크리스트 글자대로면 BLOCK, 단어 교체로 풀림). BC 경계, 교차 참조 없음, 해석 책임을 대상 도메인에 둔 결정은 표준과 맞다.

VERDICT: REVISE

## Round 2

- 일자: 2026-10-08
- 대상: 개정 spec.md, `context/review-verdict.md`(C1~C26 매핑), ADR-0103
- 1차 줄 번호는 개정 전 기준이다. 아래 줄 번호는 개정본 기준이다.

### 1차 발견 해소 여부

| 1차 | 심판 id | 해소 | 근거(개정 spec) |
|---|---|---|---|
| D1 glossary | C22 (MINOR로 강등) | 강등 범위 안에서 해소 | 타입 이름 `ShortCode` 명시 — spec.md:27. glossary 등재는 강등 판정을 따라 재제기하지 않는다 |
| D2 「비공개」 | C23 (MINOR로 강등) | 해소 | 결과 분류가 「공개 아님」 — spec.md:58, :94 |
| D3 「철회」→「폐기」 | C24 (기각) | spec 쪽은 해소 | spec.md:46 「폐기(`revoke`)」, :58, :94, :126. ADR 쪽은 아래 N1 |
| D4 비밀 게임 | C18 | 해소 | spec.md:57 「비밀 게임(ADR-0089)은 카탈로그 행이 없어 코드 자체가 없다」 |
| D5 도메인 술어 | C3 | 해소 | spec.md:54-56 (`Game.isPlayable()`, `PostStatus.publiclyVisible`, `ResumeShareLink.isUsable()`), 재사용 표 spec.md:115. 인프라 상수 `PUBLIC_STATUSES` 참조 제거 |
| D6 관광지 언어 | C4 | 해소 | spec.md:22 「영문 행은 `/en/attractions/{id}`」. 코드는 행 id 에서 나오고 국·영문이 별도 행이라(`Attraction.kt:8`) 행마다 목적지가 하나로 정해진다 |
| D7 이력서 코드 불변식 | C7 | 해소 | 형식 검사를 `ResumeShareLink` 생성·복원 시점에 — spec.md:42. 백필 뒤 `NOT NULL`+`UNIQUE` — :43-44. 충돌 시 재추첨 — :41. 불변 — :46 |
| D8 누적 수 위치 | C2 | 해소 | 별도 집계 테이블 + `INSERT … ON DUPLICATE KEY UPDATE`, 대상 행 컬럼 금지와 그 이유(game 규칙·관광지 일괄 덮어쓰기) — spec.md:84-85 |
| D9 이력서 두 원장 | C1 | 해소 (1차 수정안 (b) 형태) | 이력서 원장은 링크 id·시각만, 365일 — spec.md:82. 「단축 주소로 들어온 횟수」와 기존 `visitCount`(페이지 열람)를 다른 숫자로 구분 — :83. ADR-0077 표 갱신 — :89 |

### 개정이 새로 만든 이슈

#### N1. 스펙은 「폐기」, ADR-0103 은 여전히 「철회」 — MINOR

- D3 자체는 C24 로 기각됐으므로 재제기하지 않는다. 새로 생긴 것은 **스펙과 ADR 사이의 불일치**다.
- 스펙: spec.md:46 「폐기(`revoke`)한 링크의 코드는 해석에 실패한다」, :126 「폐기로만 끈다」.
- ADR: `docs/adr/ADR-0103-share-short-links.md:31` 「철회한 링크의 코드는 해석에 실패한다」.
- 같은 결정을 두 문서가 다른 이름으로 적는다. 수정: ADR-0103:31 의 「철회한」을 「폐기한」으로 바꾼다.

#### N2. ADR-0103 관련 목록의 ADR-0089 이름 — MINOR

- 스펙은 「비밀 게임(ADR-0089)」으로 고쳤다(spec.md:57). ADR-0089 제목도 「비밀 게임」이다(`ADR-0089-private-games.md:3`).
- ADR-0103:4 는 「ADR-0089(비공개 게임)」으로 남아 있다. 수정: 「ADR-0089(비밀 게임)」.

두 건 모두 단어 교체이고 모델·불변식에는 영향이 없다. 진행을 막지 않는다.

### 그 밖에 확인한 것 (이슈 아님)

- 관광지 `shortUrl` 을 search:app 상세 응답에서 계산하는 결정(spec.md:69-70)은 search 가 place 저장소를 읽지 않고 `common` 코덱만 부른다. 교차 aggregate 참조가 아니다. 「search 문서 id = place 관광지 id」 전제를 스펙이 명시했다(:70).
- 공개 판정에서 관광지는 「존재 여부」(spec.md:56) — place 에 공개 상태 술어가 없으므로 기존 상세와 같은 기준을 쓴 것이 맞다.

### Round 2 요약

| 구분 | 수 |
|---|---|
| 1차 발견 해소 | 9/9 (D1·D2 는 강등 범위 안에서) |
| 신규 | 2 (N1·N2, 둘 다 MINOR) |

VERDICT: SHIP
