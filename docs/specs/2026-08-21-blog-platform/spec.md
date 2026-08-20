# 블로그 플랫폼 — Spec

- 일자: 2026-08-21
- ADR: `docs/adr/ADR-0072-blog-platform.md`
- 호스트: `blog.1989v.com`

## 1. 모듈 구성

```
blog/domain/     :blog:domain    순수 코틀린 (Spring 없음)
blog/feature/    :blog:feature   Spring 라이브러리 (비-bootable, code-dictionary:app 이 흡수)
```

- 패키지: `com.kgd.blog`
- `settings.gradle.kts` 에 `blog:domain`, `blog:feature` 추가
- `code-dictionary/app/build.gradle.kts` 에 `implementation(project(":blog:feature"))`
  + `testImplementation(project(":blog:feature"))`
- `DataSourceConfig.entityManagerFactory().packages("com.kgd.codedictionary", "com.kgd.deal", "com.kgd.blog")`
- `:blog:feature` 신규 의존성: `org.commonmark:commonmark` (서버 렌더용, 단일 라이브러리)

## 2. 도메인 모델 (`:blog:domain`)

| 타입 | 역할 |
|---|---|
| `BlogProfile` | 블로그 신원. 독자/저자 공용. 작성 가능 판정을 자기가 안다 |
| `ProfileRole` | `READER` / `AUTHOR` |
| `ProfileStatus` | `PENDING` / `ACTIVE` / `SUSPENDED` |
| `BlogCategory` | 계층 카테고리. `path` 조립·깊이 상한을 자기가 강제 |
| `BlogPost` | 글. 상태 전이·소유권 판정·슬러그 생성 규칙 보유 |
| `PostStatus` | `DRAFT` / `SCHEDULED` / `PUBLISHED` / `ARCHIVED` |
| `BlogComment` | 댓글. 1단계 대댓글, 소프트 삭제 |
| `CommentStatus` | `VISIBLE` / `HIDDEN` / `DELETED` |
| `VoterKey` | `voterType(MEMBER\|VISITOR)` + `key` 값 객체 |

### 핵심 규칙 (도메인이 강제 — 서비스로 새지 않게)

- `BlogProfile.canWrite()` = `role == AUTHOR && status == ACTIVE`
- `BlogPost.isOwnedBy(profileId)` — 수정·삭제·발행의 유일한 소유권 판정
- `BlogCategory.MAX_DEPTH = 3`. 초과 시 `INVALID_INPUT`
- `BlogCategory.pathOf(parentPath, slug)` — `/tech/server/search`
- 슬러그: `^[a-z0-9][a-z0-9-]{2,79}$`. 미입력 시 제목에서 ASCII 슬러그를 뽑고,
  한글 등으로 비면 `yyyyMMdd-{base36}` 로 생성 (한글 제목이 기본이라 이 경로가 정상 경로다)
- `handle`: `^[a-z0-9][a-z0-9-]{2,29}$` + 예약어 차단
- `PostStatus` 전이: `DRAFT → SCHEDULED → PUBLISHED → ARCHIVED`, `PUBLISHED → DRAFT` 금지
  (발행된 주소가 공유된 뒤 사라지면 링크가 죽는다. 내릴 때는 `ARCHIVED`)
- `readingMinutes` = 본문 글자수 기준 파생값. 저장 시 계산

## 3. 스키마 — `code-dictionary/app/src/main/resources/db/migration/V14__blog.sql`

```
blog_profile
  id, member_id UNIQUE, handle UNIQUE NULL, display_name, bio(300), avatar_url(1000),
  role, status, approved_at, approved_by_member_id, created_at, updated_at
  INDEX (role, status)

blog_category
  id, parent_id NULL, slug, name, description(300), depth, path UNIQUE, order_no, status,
  created_at, updated_at
  UNIQUE (parent_id, slug)
  INDEX (status, order_no)

blog_post
  id, author_profile_id, category_id, slug UNIQUE, title(200), summary(300),
  body MEDIUMTEXT, cover_image_url(1000) NULL, status, published_at NULL, reading_minutes,
  view_count, like_count, comment_count, rating_sum, rating_count,
  created_at, updated_at
  INDEX (status, published_at DESC)
  INDEX (category_id, status, published_at DESC)
  INDEX (author_profile_id, status, published_at DESC)

blog_post_view          -- 중복 방지 원장 (조회수의 진실은 여기서 파생)
  id, post_id, visitor_key(64), view_date DATE, created_at
  UNIQUE (post_id, visitor_key, view_date)
  INDEX (post_id, view_date)

blog_post_like
  id, post_id, voter_type, voter_key(64), created_at
  UNIQUE (post_id, voter_type, voter_key)

blog_post_rating
  id, post_id, voter_type, voter_key(64), score TINYINT, created_at, updated_at
  UNIQUE (post_id, voter_type, voter_key)
  CHECK (score BETWEEN 1 AND 5)

blog_comment
  id, post_id, profile_id, parent_id NULL, body(2000), status, created_at, updated_at
  INDEX (post_id, status, created_at)
  INDEX (profile_id, created_at)
```

- 모든 enum 은 `VARCHAR` + `CHECK` (jpa-persistence 컨벤션의 `EnumType.STRING`)
- 카테고리 시드: `기술`(server/search/frontend/data), `일상`(취미/기록), `취미 > 게임`
- `display_service` 에 `INSERT IGNORE` 로 `blog` 타일 한 행 (`href='/blog'`, order 25)
- 카운터(`view_count`/`like_count`/`comment_count`/`rating_*`)는 비정규화. 집계 쿼리를
  목록 화면마다 돌리면 글이 늘수록 목록이 느려진다. 갱신은 원장 INSERT 성공 시에만

## 4. API

### 4.1 공개 (인증 없음)

```
GET  /api/v1/blog/posts?categoryPath=&handle=&page=&size=     발행글 목록
GET  /api/v1/blog/posts/{slug}                                 글 상세 (+조회수 집계)
GET  /api/v1/blog/categories                                   카테고리 트리
GET  /api/v1/blog/authors/{handle}                             작성자 공간 (프로필 + 글 목록)
GET  /api/v1/blog/posts/{slug}/comments                        댓글 목록
```

### 4.2 익명 허용 쓰기 (`optionalUserConfig` + Rate Limiter)

```
POST   /api/v1/blog/posts/{slug}/like       좋아요 토글  → { liked, likeCount }
PUT    /api/v1/blog/posts/{slug}/rating     평점 1~5     → { average, count, myScore }
DELETE /api/v1/blog/posts/{slug}/rating     평점 철회
```

투표 키: 로그인 시 `MEMBER:{X-User-Id}`, 아니면 `VISITOR:{X-Visitor-Id}`.

### 4.3 로그인 필요 (`userConfig`, ROLE_USER+)

```
GET  /api/v1/blog/me/profile                내 블로그 프로필 (없으면 404 → 생성 유도)
PUT  /api/v1/blog/me/profile                표시명·소개·아바타
POST /api/v1/blog/me/author-application     저자 신청 (role=AUTHOR, status=PENDING)
GET  /api/v1/blog/me/posts?status=          내 글 목록
POST /api/v1/blog/me/posts                  작성        ← canWrite() 검사
PUT  /api/v1/blog/me/posts/{id}             수정        ← isOwnedBy() 검사
DELETE /api/v1/blog/me/posts/{id}           삭제        ← isOwnedBy() 검사
POST /api/v1/blog/me/posts/{id}/publish     발행/예약   ← isOwnedBy() 검사
POST   /api/v1/blog/comments                댓글 작성 { postSlug, parentId?, body }
PUT    /api/v1/blog/comments/{id}           내 댓글 수정
DELETE /api/v1/blog/comments/{id}           내 댓글 삭제 (soft)
```

- 첫 댓글 시 `blog_profile(role=READER, status=ACTIVE)` 자동 생성. 표시명은 요청에서 받되
  이후 요청은 저장된 값을 쓴다
- `canWrite()` 실패 → `403 FORBIDDEN`, `isOwnedBy()` 실패 → `403 FORBIDDEN`
- **`status=SUSPENDED` 는 작성뿐 아니라 댓글도 막는다.** 글만 막고 댓글을 열어 두면 정지 처분이
  사실상 무력해진다 — `BlogProfile.canInteract()` 를 도메인에 두어 두 경로가 같은 판정을 쓴다
- 로그인 댓글도 Rate Limiter 를 건다. 스팸은 익명에서만 오지 않는다
- **초안 미리보기**: `GET /api/v1/blog/me/posts/{id}` 는 소유자에게 `DRAFT`/`SCHEDULED` 도
  돌려준다. 공개 `GET /api/v1/blog/posts/{slug}` 는 `PUBLISHED` 만 — 미발행 슬러그는 404

### 4.4 어드민 (`adminConfig`, ROLE_ADMIN)

```
GET|POST|PUT|DELETE  /api/v1/admin/blog/categories[/{id}]
GET                  /api/v1/admin/blog/profiles?role=&status=
PUT                  /api/v1/admin/blog/profiles/{id}/status      승인·정지
GET|POST|PUT|DELETE  /api/v1/admin/blog/posts[/{id}]              전체 글 (내 글 작성 경로)
PUT                  /api/v1/admin/blog/posts/{id}/status
GET                  /api/v1/admin/blog/comments?status=
PUT                  /api/v1/admin/blog/comments/{id}/status      숨김·복구
GET                  /api/v1/admin/blog/posts/{id}/views?from=&to=  일별 조회 추이
```

### 4.5 HTML 렌더 (blog 호스트 전용, 인증 없음)

```
GET /posts/{slug}        meta 주입된 index.html
GET /authors/{handle}    meta 주입된 index.html
```

`ShellHtmlProvider` 가 `http://portal-fe/index.html` 을 RestClient 로 받아 Caffeine 에 5분
캐시. 실패 시 마지막 정상본 유지, 그것도 없으면 메타+본문만의 최소 HTML.
치환은 프리렌더와 동일 계약: `<!--seo:start-->…<!--seo:end-->` 교체 +
`<div id="root">…</div>` 주입.

## 5. 게이트웨이 라우트 (`GatewayRouteConfig.kt`)

좁은 경로를 먼저 선언한다 (선언 순서가 곧 우선순위).

```
/api/v1/admin/blog/**                     adminConfig
/api/v1/blog/me/**                        userConfig
/api/v1/blog/comments/**                  userConfig + RateLimiter
/api/v1/blog/posts/*/like                 optionalUser + RateLimiter
/api/v1/blog/posts/*/rating               optionalUser + RateLimiter
/api/v1/blog/**                           public
/posts/**, /authors/**                    public (HTML)
```

전부 `CODE_DICTIONARY_URI` 로 간다.

## 6. 인프라

- `k8s/overlays/oci-arm/ingresses/commerce-platform.yaml` — TLS host 목록에 `blog.1989v.com`
  추가 + host 블록 (`/api`, `/posts`, `/authors` → gateway, `/` → portal-fe).
  WS/SSE 는 열지 않는다
- DNS: `blog` A/CNAME proxied(orange). Origin 인증서 불요 (와일드카드)
- NetworkPolicy: code-dictionary → portal-fe(:80) 인그레스 허용 한 줄. 외부 egress 없음

## 7. 프런트엔드

### 7.1 portal-fe

```
src/pages/blog/BlogHomePage.tsx        최신 글 + 카테고리 네비
src/pages/blog/BlogPostPage.tsx        본문 + 좋아요/평점/댓글/공유
src/pages/blog/SharePanel.tsx          링크 복사 · Web Share API · X/카카오/링크드인
src/pages/blog/BlogCategoryPage.tsx    /c/{path}
src/pages/blog/BlogAuthorPage.tsx      /authors/{handle}
src/pages/blog/BlogStudioPage.tsx      /studio — 내 글 목록·프로필·저자 신청
src/pages/blog/BlogEditorPage.tsx      /studio/write, /studio/edit/:id
src/api/blogApi.ts
```

- `App.tsx`: `isBlogHost` 분기 + apex `/blog` → 서브도메인 리다이렉트 (deal 패턴)
- `shell/serviceHref.ts`: `SUBDOMAIN_ORIGIN` 에 `blog: BLOG_ORIGIN` **(빠뜨리면 타일이 apex 를 건다)**
- `seo/copy.mjs`: `BLOG_ORIGIN`, `blogHubMeta()`, `blogPostMeta()`, `blogAuthorMeta()`,
  `articleJsonLd()`, `breadcrumbJsonLd()` — 서버 렌더와 프리렌더가 같은 문구를 쓰도록
  **문자열 SSOT 는 여기 하나**. 서버(Kotlin)는 같은 규칙을 옮겨 담고 테스트로 고정
- `scripts/prerender-seo.mjs`: `_hosts/blog.1989v.com.html`, `seo/blog…/robots.txt`,
  `sitemap.xml`(발행글 + 카테고리), `llms.txt`
- `nginx.conf`: `map $host $host_robots_tag` 에 blog 는 **추가하지 않는다**(색인 대상)
- 본문 렌더: `marked` + `dompurify`. 디자인은 `DESIGN.md` §12 `k-heritage` 토큰 사용
  (브랜드 면 — `docs/design/k-heritage.html` 을 먼저 열 것)
- **공유 링크는 canonical 절대 URL(`https://blog.1989v.com/posts/{slug}`) 하나만 쓴다.**
  현재 주소를 그대로 복사하면 쿼리스트링·앵커가 섞여 같은 글이 여러 주소로 돌아다닌다.
  `navigator.share` 미지원 브라우저는 클립보드 복사로 폴백

### 7.2 admin-fe

```
src/pages/blog/BlogPostsPage.tsx        목록 + 작성/수정 (기본 작성 경로)
src/pages/blog/BlogCategoriesPage.tsx   트리 CRUD
src/pages/blog/BlogAuthorsPage.tsx      저자 승인·정지
src/pages/blog/BlogCommentsPage.tsx     모더레이션
```

### 7.3 공용 에디터

`packages/design-system` 에 `MarkdownEditor` 추가 → 0.5.0 → `scripts/sync-design-system.sh`
로 portal-fe / admin-fe 재배포. 두 벌을 만들면 미리보기 규칙이 갈린다.

## 8. 테스트

- `:blog:domain` — Kotest BehaviorSpec. 권한(`canWrite`/`isOwnedBy`), 상태 전이,
  카테고리 깊이·경로, 슬러그 생성(한글 제목 포함)
- `:blog:feature` — MockK 로 서비스 단위 테스트. 조회 중복 방지, 좋아요 토글 멱등,
  평점 갱신, 댓글 소프트 삭제, meta 주입 HTML 조립(셸 실패 폴백 포함)
- `code-dictionary:app` — Testcontainers 컨텍스트 로드 (blog 엔티티가 EMF 에 잡히는지).
  이 테스트가 deal 폴드 때의 "not a managed type" 을 다시 잡는다
- portal-fe/admin-fe — Vitest. seo copy 스냅샷, 권한 분기 렌더

## 9. 검증

```
./gradlew :blog:domain:test :blog:feature:test :code-dictionary:app:test
cd portal-fe && pnpm tsc --noEmit && pnpm test
cd admin/frontend && pnpm tsc --noEmit && pnpm test
```

FE 화면은 `docs/standards/fe-visual-verification.md` 의 CDP 측정으로 확인 (기기×사이트 4조합).

## 10. 문서 동기화

- `CLAUDE.md` — 서비스 표에 `blog` 행, FE 진입 구조 표에 `blog.1989v.com` 행,
  새 서브도메인 체크리스트 4항목 반영
- `docs/context-map.md` — BC 매핑에 blog 추가
- `docs/doc-index.json` — 신규 문서 등록 (`doc_map.py`)
