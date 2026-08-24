# Blog Service

블로그 플랫폼 (`blog.1989v.com`) — 계층 카테고리 + 다중 저자 + 댓글·평점·좋아요·조회수.
ADR: `docs/adr/ADR-0072-blog-platform.md` · spec: `docs/specs/2026-08-21-blog-platform/`

## Modules

| Gradle path | 역할 |
|---|---|
| `:blog:domain` | Pure Kotlin 도메인 (권한·소유권·상태 전이·카테고리 경로) |
| `:blog:feature` | Spring 라이브러리 (비-bootable). **`code-dictionary:app` 이 흡수** |

무료 티어 단일 노드라 신규 상시 파드를 만들지 않는다 (ADR-0059 game, ADR-0069 deal 과 같은 폴드).
스키마도 code-dictionary 것을 공유하고, 마이그레이션은 **스키마 주인 쪽**에 둔다
(`code-dictionary/app/src/main/resources/db/migration/V14__blog.sql`) — Flyway 히스토리가 하나이므로
버전 수열도 하나여야 한다.

## Commands

```bash
./gradlew :blog:domain:test              # 도메인 테스트 (Spring context 없음)
./gradlew :blog:feature:test             # 서비스 단위 테스트 (MockK)
./gradlew :code-dictionary:app:test      # 폴드 컨텍스트 로드 검증
```

## 폴드 시 반드시 함께 고치는 세 곳

| 파일 | 무엇 | 빠뜨리면 |
|---|---|---|
| `code-dictionary/.../CodeDictionaryApplication.kt` | `scanBasePackages` 에 `com.kgd.blog` | **조용한 404** — 컨텍스트는 뜨고 Flyway 도 도는데 컨트롤러가 하나도 매핑되지 않는다 |
| `code-dictionary/.../DataSourceConfig.kt` | `entityManagerFactory().packages(...)` | 기동 실패 (`not a managed type`) |
| `code-dictionary/.../CodeDictionaryJpaConfig.kt` | `@EnableJpaRepositories` basePackages | 리포지토리 빈 없음 |

`@EntityScan` 은 먹지 않는다 — 호스트가 EMF 를 명시 정의해 Boot 자동 구성이 back-off 한 상태다.

**첫 줄이 가장 위험하다.** 기동 실패는 파드가 안 뜨니 즉시 보이지만, 스캔 누락은 앱이 건강하게
뜬 채로 그 도메인만 404 라 배포가 성공한 것처럼 보인다. `CodeDictionaryContextLoadSpec` 의
"폴드된 도메인의 컨트롤러가 전부 빈으로 등록된다" 케이스가 이걸 잡는다 — 새 도메인을 폴드하면
거기에 한 줄을 더한다.

## 마이그레이션은 불변이다

`V14__blog.sql` 을 커밋한 뒤 고쳤다가 code-dictionary 전체가 CrashLoopBackOff 로 떨어졌다
(2026-08-21). main 이 곧 배포 브랜치라 **커밋한 순간 이미 운영에 적용됐을 수 있다** —
로컬 브랜치 감각으로 마이그레이션을 되고치면 안 된다. 바꿔야 하면 언제나 다음 번호(V15)다.

## 도메인 규칙 (도메인이 강제 — 서비스로 새지 않게)

- **작성 권한 = `blog_profile.role=AUTHOR AND status=ACTIVE`** (`BlogProfile.canWrite()`).
  전역 `Role` enum(ROLE_USER/SELLER/ADMIN)은 건드리지 않는다. 게이트웨이는 "로그인했는가"까지만 보고,
  "쓸 수 있는가"·"내 글인가"는 서비스가 판정한다 — 소유권은 엣지가 알 수 없는 정보다.
- **정지(SUSPENDED)는 글쓰기와 댓글을 함께 막는다** (`canInteract()`). 글만 막으면 처분이 무력해진다.
- **`PUBLISHED → DRAFT` 는 없다.** 발행된 주소가 공유된 뒤 사라지면 링크가 죽는다 → `ARCHIVED`.
- **슬러그는 수정 시 바뀌지 않는다.** 화면뿐 아니라 서비스가 무시한다.
- **신원을 사칭하는 말은 핸들·표시명 양쪽에서 막는다** (`RESERVED_NAME_TERMS`, 부분 일치).
  경로 충돌용 `RESERVED_HANDLES`(정확히 일치)와 목적이 달라 목록을 합치지 않는다 —
  저쪽은 `posts` 만 막으면 되지만 이쪽은 `admin-2`·`블로그관리자` 처럼 붙여 쓴 게 더 그럴듯하다.
  브랜드 이름(`1989v`)도 여기 있어 아무도 사이트를 자칭할 수 없다. 같은 이유로 어드민 자동 생성
  프로필의 이름은 `관리자` 가 아니라 `편집자` 다 — 금칙어를 남에게만 걸면 진짜와 사칭을 구분할 수 없다.
- 카테고리 최대 3단. 부모가 바뀌면 **하위 전체의 `path` 를 다시 쓴다** (`BlogAdminService.updateCategory`).
- 대댓글은 1단계까지. 삭제는 소프트 삭제 — 행을 지우면 대댓글이 부모를 잃는다.

## 조회수·좋아요·평점

- 조회수의 진실은 `blog_post_view` 원장이고 `blog_post.view_count` 는 파생값이다.
  `INSERT IGNORE` 로 (글, 방문자, 날짜) 하루 1표. **봇 UA 는 세지 않는다.**
- 집계 실패가 글 조회를 막지 않는다 — 예외는 삼키고 warn 만 남긴다.
- 좋아요·평점은 **익명 허용**. 표 주인은 회원 id > 방문자 id(`X-Visitor-Id`) 순.
- 카운터 UPDATE 는 `@Modifying(clearAutomatically, flushAutomatically)` 를 켠다.
  끄면 같은 트랜잭션에서 방금 올린 값을 1차 캐시의 옛 엔티티로 다시 읽는다.

## 글 상세 HTML (ADR-0072 §6)

`GET /posts/{slug}` · `GET /authors/{handle}` 은 JSON 이 아니라 **HTML** 이다.
백엔드가 클러스터 내부에서 `http://portal-fe/index.html` 을 받아 `<!--seo:start-->…<!--seo:end-->`
를 페이지 메타로 갈고 `#root` 에 크롤러용 본문을 넣는다 (빌드타임 프리렌더와 같은 계약).

- 셸 캐시 5분, 실패 시 마지막 정상본, 그것도 없으면 SPA 없는 최소 HTML
- 서버 렌더 마크다운은 raw HTML 을 **이스케이프**한다 (`escapeHtml(true)`)
- `blog/feature` 의 `BlogSeoCopy` 는 `portal-fe/src/seo/copy.mjs` 와 **쌍**이다 — 문구는 함께 고친다
- NetworkPolicy `18-allow-blog-shell-fetch` 가 없으면 셸 페치가 막혀 전부 최소 HTML 로 떨어진다

## API 요약

| Prefix | 인증 | 설명 |
|---|---|---|
| `GET /api/v1/blog/posts`, `/posts/{slug}`, `/categories`, `/authors/{handle}` | 공개 | 목록·상세·트리·작성자 공간 |
| `POST /api/v1/blog/posts/*/like`, `PUT` · `DELETE ./rating` | 익명 허용 + RateLimit | 좋아요·평점 |
| `/api/v1/blog/comments/**` | ROLE_USER+ + RateLimit | 댓글 작성·수정·삭제 |
| `/api/v1/blog/me/**` | ROLE_USER+ | 스튜디오 (프로필·저자 신청·내 글) |
| `/api/v1/admin/blog/**` | ROLE_ADMIN | 분류·저자 승인·전체 글·댓글 모더레이션 |
| `GET /posts/{slug}`, `/authors/{handle}` | 공개 | meta 주입 HTML (blog 호스트 ingress 만) |

## 아직 없는 것

- **이미지 업로드** — 오브젝트 스토리지 클라이언트가 플랫폼에 없다. 외부 URL 입력만 지원.
- **전문 검색** — OpenSearch 는 있지만 글이 쌓이기 전 색인 파이프라인은 유지비만 든다.
- **예약 발행** — 폴드된 라이브러리가 호스트에 `@EnableScheduling` 을 얹는 일이라 뺐다.
