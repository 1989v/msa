# 포털 메인(1989v.com) 포트폴리오 개편 — 핸드오프

- 작성: 2026-08-11
- 상태: **설계만 합의됨, 구현 착수 전**
- 분리 사유: 같은 세션에서 `resume.1989v.com`(경력)을 먼저 구현하느라 중단. 경력 사실과
  개인 프로젝트 기술 설명이 한 세션에 섞이면 기여 범위 제약이 흐려져 별도 트랙으로 뗀다.

---

## 1. 요청 원문

> 메인페이지가 포트폴리오 목적이었는데 주니어 개발자의 기능 과시가 됐다.
> 11년차 시니어 포트폴리오가 녹아든 페이지로 개편하고, **도메인별 진입점을 두고
> 클릭하면 세부적으로 좁혀나가는 플로우**를 원한다.

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

1. **주장이 없다** — 전부 "할 수 있다"의 나열. 시니어는 "이렇게 판단했고, 무엇을 포기했고,
   결과가 이랬다"로 읽혀야 한다.
2. **깊이가 없다** — 개념 클릭 시 `DetailSidePanel` 이 옆으로 열리는 게 전부. 수평 이동이지
   심화가 아니다. 드릴다운 레이어 0개.
3. **진짜 자산이 메인에서 안 보인다** — `docs/portfolio/` 9문서(1,799줄), OCI 무료티어 실운영.

> **ADR 개수는 셀링포인트로 쓰지 않는다.** 몇 달 만에 쌓인 63건은 볼륨 자랑과 같은 실수이고,
> 타임스탬프·문체 균일성으로 티가 난다. ADR 은 **특정 결정 서술의 근거 링크로만** 인용한다.

---

## 3. 확정된 방향

### 3.1 역할 분담 (중요)

| 사이트 | 담당 | 소스 |
|---|---|---|
| `resume.1989v.com` | **경력** (회사·기간·성과·기여 범위) | 이력서 DB (ADR-0064) |
| `1989v.com` 메인 | **서비스 소개 + 개인 프로젝트 기술 상세** | msa 레포 |

두 사이트는 **서로 링크만 걸고 내용을 복제하지 않는다.**

### 3.2 메인의 성격

메인은 **"내가 만든 서비스들"의 소개 페이지**다. 포트폴리오/이력서는 링크로 나간다.

### 3.3 도메인 축 = 실제로 다뤄온 문제 도메인

`msa` 서비스 목록이 아니라 **경력 도메인** 5종을 L0 진입점으로 세운다.

| 도메인 | 레포 내 증거 | 강도 |
|---|---|---|
| 검색 | `search/` 4모듈(OpenSearch), `place/` geo_distance, code-dictionary 색인·자동완성 | 강함 |
| 전시 | `game/domain/.../catalog/GameCollection.kt` 정도 | **약함** |
| 커머스 | `product`·`order`·`inventory`·`fulfillment`·`warehouse`, Saga, `/shop` 라이브 데모 | 강함 |
| 인프라·플랫폼 | K8s 2-mode, OCI 무료티어 실운영, GitOps, XtraBackup PITR, Jib | 강함 |
| AI 엔지니어링 | `ai/` 서브모듈 — 플러그인 11종, 하네스 표준 | 강함 |

> **전시만 레포 증거가 거의 없다.** 증거 없는 도메인이 빈 껍데기로 보이면 전체 신뢰도가 깎인다.
> 서술 밀도로 승부하거나 `game` 큐레이션을 소규모 증거로 붙이는 선택지가 있다. **미결정.**

### 3.4 드릴다운 구조

```
L0  검색 | 전시 | 커머스 | 인프라·플랫폼 | AI 엔지니어링
      ↓ 클릭
L1  이 도메인에서 무엇을 풀었나 / 어떤 결정을 했나 / 무엇을 포기했나
      ↓
L2  개별 케이스 — 트레이드오프, 실제 수치, 라이브 데모
      ↓
L3  증거 — 코드 경로 / 개념 그래프 노드 / (해당되면) 결정 근거 링크
```

### 3.5 기존 시각화 처리

3D 그래프 · 트리맵 · 히트맵 · 퀴즈는 **삭제가 아니라 강등**. 메인에서 내리고 "Frontend &
Visualization" 성격의 L2 증거물로 배치한다. 과시가 아니라 *데이터 시각화 역량의 증거*로
의미가 바뀐다. 코드는 그대로 재사용하고 라우팅과 진입 맥락만 바꾼다.

### 3.6 콘텐츠 소스

**서버 드리븐(DB) 기본.** 빌드타임 정적 생성이나 캐시는 대안으로 검토 대상.
(이력서에서 같은 판단을 했고 ADR-0064 에 근거가 정리돼 있다.)

---

## 4. 이미 만들어져 있어 재사용 가능한 것

이력서 작업(ADR-0064)에서 **같은 5개 카테고리**가 이미 DB 에 들어갔다.

| 자산 | 위치 | 비고 |
|---|---|---|
| `resume_category` | V8 시드 | `search`/`display`/`commerce`/`platform`/`ai-engineering` — L0 축과 동일 |
| `resume_project` | V7 | 카테고리·회사·기간·성과지표·상세 slug 를 가진 프로젝트 엔티티 |
| 카테고리별 프로젝트 렌더 | `portal-fe/src/pages/resume/ResumeSections.tsx` | 드릴다운 카드 UI 원형 |
| 포트폴리오 카드 API | `/api/v1/portfolio/cards` | impact/period/role/tags + 어드민 CRUD |
| `docs/portfolio/` 9문서 | 1,799줄, 코드경로 인용 포함 | L1/L2 서술 재료 |

> **설계 포크**: 메인 포트폴리오가 `resume_*` 테이블을 공유할지, 별도 도메인을 둘지 결정 필요.
> 공유하면 카테고리 관리가 한 곳이지만 이력서(경력)와 포트폴리오(개인 프로젝트)의 성격 차이가
> 뭉갠다. 별도로 두면 카테고리가 두 벌이 된다. **미결정.**

---

## 5. 미해결 질문

1. **전시 도메인의 증거 부족**을 어떻게 메울 것인가
2. `resume_*` 스키마 **공유 vs 분리**
3. L1/L2 서술을 `docs/portfolio/` 에서 **가져올지, 새로 쓸지** (가져오면 문서-DB 이중 사본 문제)
4. GNB 로고 "Code Dictionary" → 무엇으로 바꿀지 (브랜드 정체성)
5. `QuizSection` 을 강등할지 **완전 제거**할지
6. 기존 `PortfolioPage.tsx`(`/portfolio`)와 새 메인의 관계 — 흡수인지 병존인지

---

## 6. 관련 파일

```
portal-fe/src/pages/SearchPage.tsx          현재 메인 (개편 대상)
portal-fe/src/pages/HomePage.tsx            죽은 파일 — 라우팅 없음, 정리 대상
portal-fe/src/components/HeroSection.tsx    카운터 (볼륨 지표)
portal-fe/src/components/quiz/              강등/제거 대상
portal-fe/src/components/graph/             강등 대상 (재사용)
portal-fe/src/components/ServiceCatalog.tsx 서비스 나열
portal-fe/src/components/AboutSection.tsx   사람 소개 (현재 최하단)
portal-fe/src/pages/PortfolioPage.tsx       기존 포트폴리오 화면
docs/portfolio/                             9개 도메인 심화문서
docs/adr/ADR-0064-resume-site-gated-serving.md  이력서 설계 (역할 분담 근거)
```

---

## 7. 다음 세션 시작 지점

이 문서의 **§5 미해결 질문 6개를 먼저 정리**한 뒤 스펙으로 넘어간다.
특히 2번(스키마 공유 여부)이 나머지 구현 방향을 좌우한다.
