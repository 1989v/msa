# 블로그 플랫폼 — Tasks

ADR-0072 / spec.md 기준. 그룹 순서대로 진행하고, 그룹마다 커밋한다.

## TG1 — 모듈 골격 + 스키마

- [x] T1.1 `settings.gradle.kts` 에 `blog:domain`, `blog:feature` 등록
- [x] T1.2 `blog/domain/build.gradle.kts`, `blog/feature/build.gradle.kts` 작성
      (deal 것을 기준으로. feature 에 `org.commonmark:commonmark` 추가)
- [x] T1.3 `code-dictionary/app/build.gradle.kts` 에 `:blog:feature` 의존 추가 (main + test)
- [x] T1.4 `DataSourceConfig.entityManagerFactory().packages(...)` 에 `com.kgd.blog` 추가
- [x] T1.5 `V14__blog.sql` — 7개 테이블 + 카테고리 시드 + `display_service` blog 타일
- [x] 검증: `./gradlew :code-dictionary:app:test` (컨텍스트 로드 — 엔티티 미등록 조기 검출)

## TG2 — 도메인 (`:blog:domain`)

- [x] T2.1 `BlogProfile` + `ProfileRole`/`ProfileStatus` — `canWrite()`, `canInteract()`
- [x] T2.2 `BlogCategory` — `MAX_DEPTH=3`, `pathOf()`, 재부모화 시 하위 경로 재계산
- [x] T2.3 `BlogPost` — 상태 전이, `isOwnedBy()`, 슬러그 생성, `readingMinutes`
- [x] T2.4 `BlogComment`, `VoterKey`
- [x] T2.5 Kotest BehaviorSpec 전 항목 (권한·전이·깊이·한글 제목 슬러그)
- [x] 검증: `./gradlew :blog:domain:test`

## TG3 — 영속 + 공개 조회 API

- [x] T3.1 JPA 엔티티 7종 + 리포지토리 (enum STRING, FK-as-ID)
- [x] T3.2 `BlogQueryService` — 목록/상세/카테고리 트리/작성자 공간
- [x] T3.3 `BlogViewService` — 원장 INSERT 성공 시에만 카운터 증가, 봇 UA 제외
- [x] T3.4 `BlogPublicController` — §4.1
- [x] T3.5 서비스 단위 테스트 (MockK)
- [x] 검증: `./gradlew :blog:feature:test`

## TG4 — 상호작용 (좋아요 · 평점 · 댓글)

- [x] T4.1 `BlogReactionService` — 좋아요 토글(멱등), 평점 upsert/철회, 집계 갱신
- [x] T4.2 `BlogCommentService` — 작성/수정/소프트삭제, 1단계 대댓글, `canInteract()` 검사
- [x] T4.3 컨트롤러 §4.2 / §4.3 댓글 파트
- [x] T4.4 테스트: 중복 좋아요, 평점 갱신, 정지 계정 차단, 삭제된 댓글 표시
- [x] 검증: `./gradlew :blog:feature:test`

## TG5 — 작성자 API + 어드민 API

- [x] T5.1 `BlogAuthorService` — 프로필 CRUD, 저자 신청, 내 글 CRUD (`isOwnedBy` 강제)
- [x] T5.2 `BlogAdminService` — 카테고리·프로필 승인·전체 글·댓글 모더레이션·조회 추이
- [x] T5.3 컨트롤러 §4.3 / §4.4
- [x] T5.4 소유권 위반(타인 글 수정 시도) 403 테스트 — 이 테스트가 요구의 핵심이다
- [x] 검증: `./gradlew :blog:feature:test`

## TG6 — 서버 meta 주입 HTML

- [x] T6.1 `ShellHtmlProvider` — portal-fe index.html 페치 + Caffeine 5분 + stale 유지
- [x] T6.2 `BlogMetaRenderer` — seo 블록 교체, `#root` 본문 주입, commonmark(escapeHtml=true)
- [x] T6.3 `BlogPageController` — `GET /posts/{slug}`, `GET /authors/{handle}`
      (미발행/없는 슬러그는 404 HTML, `noindex`)
- [x] T6.4 테스트: 셸 정상/실패/부재 3경로, 메타 문구가 `copy.mjs` 규칙과 일치
- [x] 검증: `./gradlew :blog:feature:test`

## TG7 — 게이트웨이 + 인프라

- [x] T7.1 `GatewayRouteConfig.kt` 라우트 6종 (좁은 경로 먼저)
- [x] T7.2 ingress — TLS host 목록 + `blog.1989v.com` 블록 (`/api`, `/posts`, `/authors`, `/`)
- [x] T7.3 NetworkPolicy — code-dictionary → portal-fe:80
- [ ] T7.4 DNS `blog` proxied 레코드 + OAuth 리다이렉트 URI 등록 (**사용자 작업** — 코드 밖)
- [x] 검증: `./gradlew :gateway:build`

## TG8 — 에디터 의존성

- [x] T8.1 admin-fe 에 `marked` + `dompurify` 추가 (portal-fe 에는 이미 있다)

## TG9 — portal-fe

- [x] T9.1 `seo/copy.mjs` — `BLOG_ORIGIN` + 메타/JSON-LD 함수
- [x] T9.2 `shell/serviceHref.ts` `SUBDOMAIN_ORIGIN.blog` **(체크리스트 4항목)**
- [x] T9.3 `App.tsx` — `isBlogHost` 분기 + apex `/blog` 리다이렉트 + 라우트
- [x] T9.4 `api/blogApi.ts`
- [x] T9.5 화면 6종 + `SharePanel` (k-heritage 토큰, `docs/design/k-heritage.html` 선참조)
- [x] T9.6 `scripts/prerender-seo.mjs` — `_hosts/blog…`, robots, sitemap, llms.txt
- [x] 검증: `pnpm tsc --noEmit && pnpm test && pnpm build`

## TG10 — admin-fe

- [x] T10.1 `api/blogApi.ts` + 화면 4종 + 라우트/메뉴 등록
- [x] 검증: `pnpm tsc --noEmit && pnpm test && pnpm build`

## TG11 — 문서 동기화 + 최종 검증

- [x] T11.1 `CLAUDE.md` — 서비스 표 / FE 진입 구조 표 / 서브도메인 체크리스트
- [x] T11.2 `blog/CLAUDE.md` + `blog/glossary.md`, `docs/context-map.md`
- [ ] T11.3 `docs/doc-index.lock.json` 갱신 — **보류**. 레포 전반으로 밀려 있어(문서 245→299)
      재생성분 5,699줄 중 blog 관련이 14줄뿐이다. 별건 청소로 돌린다
- [ ] T11.4 FE 시각 검증 (CDP 4조합) — **배포 후**. blog 호스트가 뜨고 데이터가 있어야
      색 대비·테마 분기를 실제 값으로 잴 수 있다
- [ ] T11.5 `./gradlew build` 전체 / `portal-fe: pnpm build` — **차단됨**. portal-fe 의 `tsc -b` 가
      place 화면 타입 오류(`L.pickRegion` 등, 병행 세션 작업)로 막혀 있다. blog 코드 자체는
      `vite build` + 프리렌더 + 전체 테스트로 검증했다

---

## 검증 기록 (2026-08-21)

| 항목 | 결과 |
|---|---|
| `:blog:domain:test` + `:blog:feature:test` | 59건 통과 |
| `:code-dictionary:app:test --tests *ContextLoadSpec*` | 통과 — MySQL 컨테이너에 `V14 - blog` 마이그레이션 적용 확인 |
| `:gateway:compileKotlin` | 통과 |
| admin-fe `tsc -b && vite build` | 통과 |
| portal-fe `vite build` + `prerender-seo.mjs` | 통과 — `_hosts/blog.1989v.com.html` · robots · sitemap · llms.txt 생성 |
| 도메인 프레임워크 의존 | 없음 |
| Blog.css hex 직접 입력 | 없음 (토큰만 사용) |
