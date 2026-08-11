# 포털 메인(1989v.com) 개편 — 결정 기록

- 작성: 2026-08-11
- 상태: **§5 결정 완료, 구현 착수**
- 분리 사유: 같은 세션에서 `resume.1989v.com`(경력)을 먼저 구현하느라 중단. 경력 사실과
  개인 프로젝트 기술 설명이 한 세션에 섞이면 기여 범위 제약이 흐려져 별도 트랙으로 뗀다.

> **방향 전환 (§3 전면 개정)**: 최초 설계는 메인 전체를 경력 도메인 5종의 드릴다운
> 포트폴리오 탐색기로 만드는 안이었다. 논의 결과 메인의 성격을 **"나"라는 브랜드 +
> 내가 만든 서비스 도메인의 큐레이션 런처**로 바꿨다. 드릴다운 구조는 폐기하지 않고
> 하단 포트폴리오 섹션(타임라인)으로 접어 넣는다.

---

## 1. 요청 원문

> 메인페이지가 포트폴리오 목적이었는데 주니어 개발자의 기능 과시가 됐다.
> 11년차 시니어 포트폴리오가 녹아든 페이지로 개편하고, **도메인별 진입점을 두고
> 클릭하면 세부적으로 좁혀나가는 플로우**를 원한다.

이어진 구체화:

> 메인은 '나'라는 브랜드와 내 서비스가 제공하는 도메인을 큐레이션하는 목적.
> 한국 관광 검색 / 게임 / IT / 커머스 / 풀필먼트 등. 구현되는 대로 활성화하고
> 그 전까지는 딤드 처리. 하단에 포트폴리오 섹션을 두고 시간순 타임라인으로
> 이력이나 프로젝트를 서술.

---

## 2. 현재 메인 진단 (합의됨)

진입점은 `portal-fe/src/pages/SearchPage.tsx` (라우트 `/`). `HomePage.tsx` 는 라우팅에 없는
죽은 파일이다.

| 순서 | 섹션 | 문제 |
|---|---|---|
| 1 | GNB 로고 "Code Dictionary" | 브랜드가 사람이 아니라 도구 |
| 2 | Hero — 카운터(Concepts/Services/Code Refs) | **볼륨 자랑**. 판단이 아니라 개수 |
| 3~5 | CategoryChips → SearchBar → Carousel3D(5종) | 렌더링 능력 과시. "무엇을 결정했나"가 없음 |
| 6 | PopularConcepts | 〃 |
| 7 | **QuizSection** | 시니어 포트폴리오에서 가장 강한 마이너스 신호 |
| 8 | ServiceCatalog | 서비스 나열뿐, 분리 근거 없음 |
| 9 | AboutSection | 사람이 퀴즈 게임 *뒤*에 등장 |

핵심 문제 3가지:

1. **주장이 없다** — 전부 "할 수 있다"의 나열.
2. **깊이가 없다** — 개념 클릭 시 `DetailSidePanel` 이 옆으로 열리는 게 전부.
3. **진짜 자산이 메인에서 안 보인다** — 운영 중인 서비스들, OCI 무료티어 실운영.

> **ADR 개수는 셀링포인트로 쓰지 않는다.** 몇 달 만에 쌓인 63건은 볼륨 자랑과 같은 실수이고,
> 타임스탬프·문체 균일성으로 티가 난다. ADR 은 **특정 결정 서술의 근거 링크로만** 인용한다.

---

## 3. 확정된 방향

### 3.1 역할 분담

| 사이트 | 담당 | 소스 |
|---|---|---|
| `resume.1989v.com` | **회사에서 한 일** (성과·기여 범위·상세 서술) | 이력서 DB, 토큰 게이트 (ADR-0064) |
| `1989v.com` 메인 | **서비스 큐레이션 + 개인 프로젝트 + 재직 기간·직무** | msa 레포 + 공개 API |

두 사이트는 **서로 링크만 걸고 내용을 복제하지 않는다.**

경계선은 회사 단위가 아니라 **서술 깊이**에 있다. 재직 기간과 직무는 메인에 공개하고,
그 회사에서 무엇을 했는지는 게이트 뒤에 남는다 (ADR-0064 개정 대상).

### 3.2 메인의 성격

메인은 **브랜드 + 내가 만든 서비스 도메인의 런처**다. 포트폴리오 탐색기가 아니다.
방문자가 첫 화면에서 하는 일은 "무엇을 만들었는지 훑고 하나를 골라 들어가는 것"이다.

### 3.3 메인 구조

```
1  브랜드 히어로 — 1989v + 한 줄 정체성
2  도메인 타일 그리드 — 활성 / 준비중(딤드)
3  포트폴리오 섹션 — 시간순 타임라인
4  About
5  Footer
```

### 3.4 도메인 타일

축은 `msa` 서비스 목록도, 경력 도메인 5종도 아니다. **방문자가 실제로 들어가서 쓸 수
있는 진입점**이다.

| 타일 | 진입 | 상태 |
|---|---|---|
| 한국 관광 검색 | `place.1989v.com` | 활성 (ADR-0065) |
| 게임 | `game.1989v.com` | 활성 (ADR-0059) |
| IT | `/tech` | 활성 — 개념 사전·그래프·트리맵 |
| 커머스 | `/shop` | 활성, **"데모" 명시** — 실서비스가 아님을 타일에서 밝힌다 |
| 포트폴리오 | `/portfolio` | 활성 |
| 풀필먼트 | — | **준비중(딤드)** — 백엔드만 있고 FE 없음 |

**전시 대상 아님**: 퀀트 · 기프티콘 · 에이전트뷰어. 프라이빗 서비스이며 `shell/placeholders.tsx`
껍데기만 있다. 딤드로도 노출하지 않고 **테이블에 행도 만들지 않는다** — 껍데기가 많을수록
"진행 중인 게 많다"가 아니라 "끝맺은 게 없다"로 읽힌다.

기존 `service` 테이블(`/api/v1/services`)은 **백엔드 마이크로서비스 목록**이라 재사용하지
않는다. `product:8081`·`gateway:8080`·`common`(라이브러리)·`discovery`(ADR-0019에서 삭제됨)가
섞여 있고 `place`·`game` 은 없다. 사용자 진입점과 성격이 다르다.

### 3.5 포트폴리오 섹션 — 시간순 타임라인

최초 설계의 L0~L3 드릴다운이 여기로 접힌다.

```
회사 재직 기간 = 배경 막대 (회사명 · 기간 · 직무)
개인 프로젝트  = 타임라인 위의 점 (제목 · 기간 · 요약 · 성과지표 · 태그)
       ↓ 클릭
/portfolio 상세 (기존 카드 화면)
```

**공개 범위 불변식**: `company_id IS NOT NULL` 인 프로젝트는 어떤 공개 경로로도 나가지
않는다. 회사는 재직 기간·직무만, 회사에서 한 일은 게이트 뒤다. 리포지토리 쿼리에
못박고 테스트로 고정한다.

카테고리 축(`search`/`display`/`commerce`/`platform`/`ai-engineering`)은 타임라인 항목의
태그로 계속 쓴다.

### 3.6 기존 시각화 처리

3D 그래프 · 트리맵 · 히트맵은 **삭제가 아니라 이동**. 현 `SearchPage` 를 통째로 `/tech`
라우트로 옮기고 IT 타일이 받는다. 코드는 그대로 재사용하고 진입 맥락만 바뀐다.

**퀴즈는 제거한다.** 시각화 3종과 달리 데이터 시각화 역량의 증거로 재해석될 여지가 없어
어디에 두든 같은 감점이다. 다만 지우는 것은 `QuizSection` 뿐이다 (§6 참조).

### 3.7 콘텐츠 소스

**서버 드리븐(DB) + 어드민 CRUD.** 전시 목록·상태를 `display_service` 테이블에 두고
admin.1989v.com 에서 관리한다. 서비스가 완성되면 어드민에서 딤드를 풀 수 있다.

---

## 4. 재사용 가능한 자산

이력서 작업(ADR-0064)에서 **같은 5개 카테고리**가 이미 DB 에 들어갔다.

| 자산 | 위치 | 상태 |
|---|---|---|
| `resume_category` | V8 시드 | `search`/`display`/`commerce`/`platform`/`ai-engineering` |
| `resume_company` | V7 | 회사명·기간·직무 — 타임라인 배경 막대 소스 |
| `resume_project` | V7 | `company_id NULL` = 개인 프로젝트. 기간·카테고리·성과지표·태그 보유 |
| 이력서 어드민 CRUD | `/api/v1/admin/resume/{companies,categories,projects,skill-groups}` | **쓰기 경로 존재** |
| 이력서 어드민 화면 | admin-fe `/resume`, `/resume/profile` | 존재 |
| 카테고리별 프로젝트 렌더 | `portal-fe/src/pages/resume/ResumeSections.tsx` | 타임라인 카드 UI 원형 |
| 포트폴리오 카드 API | `GET /api/v1/portfolio/cards`, `/cards/{id}` | 공개 조회 전용 |

> **정정**: 이 문서의 이전 판은 포트폴리오 카드에 "어드민 CRUD"가 있다고 적었으나 사실이
> 아니다. `PortfolioCardController` 에는 공개 GET 2개뿐이고 쓰기 경로가 없다.
> 반대로 `resume_project` 는 어드민 CRUD와 관리 화면이 모두 갖춰져 있다. 이 사실이
> §5-2 의 결정을 뒤집었다.

---

## 5. 결정된 답

| # | 질문 | 결정 |
|---|---|---|
| 1 | 전시 도메인의 증거 부족 | **재프레이밍** — 증거는 원래 있었고 한 서비스만 봐서 못 찾았다. `game`(큐레이션 행) → `analytics`(스코어 산출) → `experiment`(A/B 검증) 3단 파이프라인으로 서술. 새 코드 없음 |
| 2 | `resume_*` 공유 vs 분리 | **`resume_project` 재사용 + 공개 API 신설.** 어드민 CRUD·관리 화면이 이미 있어 신규 파일이 가장 적다. 공개 경로는 `company_id IS NULL` 로 못박고 프로젝트 DTO 에 회사 연결 필드를 두지 않는다 |
| 3 | `docs/portfolio/` 서술을 가져올지 | **가져오지 않는다.** 축이 다르고(기술 9분류 ≠ 경력 5도메인) 어디에도 배포돼 있지 않다. DB 가 원본, docs 는 집필 재료 |
| 4 | GNB 로고 | **`1989v` + 페이지 성격 부제** (메인 / 게임 / 장소 …) |
| 5 | QuizSection | **완전 제거** (§3.6) |
| 6 | `/portfolio` 와 새 메인의 관계 | **병존, 역할 분리.** 메인 = 타임라인(개요), `/portfolio` = 카드 상세·검색·정렬 |

추가 결정:

| 항목 | 결정 |
|---|---|
| 타일 구성 | OPEN 5 + PREOPEN 1 (풀필먼트). 퀀트·기프티콘·에이전트뷰어는 행 자체를 만들지 않음 |
| 커머스 타일 | 활성 + "데모" 명시 |
| 타일 데이터 소스 | DB `display_service` + 어드민 CRUD (리소스명은 `display/services` — `tile` 은 표현 형태라 URL·도메인에 쓰지 않는다) |
| 타임라인 범위 | 개인 프로젝트 + 재직 기간·직무. 회사에서 한 일은 게이트 뒤 |

---

## 6. 관련 파일

```
portal-fe/src/App.tsx                       라우팅 — / 교체, /tech 신설
portal-fe/src/pages/SearchPage.tsx          → /tech 로 이동 (내용 유지, 퀴즈만 제거)
portal-fe/src/pages/HomePage.tsx            죽은 파일 — 삭제
portal-fe/src/components/GNB.tsx            로고 → 1989v + 페이지 부제
portal-fe/src/components/quiz/QuizSection.* 삭제 (나머지 quiz/ 파일은 유지 —
                                            MemoryGame·FillBlankQuiz·CodeMagnifier·
                                            ConceptCascade 는 게임 플랫폼이 실제로 서빙한다)
portal-fe/src/components/graph/             유지 — /tech 에서 계속 사용
portal-fe/src/components/ServiceCatalog.tsx 백엔드 서비스 목록 — 메인에서 내림
portal-fe/src/components/AboutSection.tsx   새 메인 하단으로
portal-fe/src/pages/PortfolioPage.tsx       유지 — 타임라인 항목의 목적지

code-dictionary/app/src/main/resources/db/migration/V9__display_service.sql 신규
code-dictionary/.../{domain,application,infrastructure,presentation}/display/  신규 (전시 공개/어드민)
code-dictionary/.../presentation/portfolio/                               타임라인 공개 API 추가
admin/frontend/src/pages/DisplayServicesPage.tsx                          신규

docs/adr/ADR-0064-resume-site-gated-serving.md   개정 — 재직 기간·직무 공개
docs/adr/ADR-0066-portal-main-service-launcher.md 신규
```

---

## 7. 다음 단계

§5 결정이 모두 확정됐다. ADR-0066 작성 → 백엔드(타일 + 타임라인) → 어드민 화면 →
portal-fe 메인 순으로 구현한다.
