# Blog — 유비쿼터스 언어

> BC: blog · 관련 ADR: ADR-0072 · 매핑: `docs/context-map.md`

| 용어 | 유형 | 정의 | 피해야 할 표현 | 코드 |
|---|---|---|---|---|
| BlogProfile | Aggregate | 블로그 안의 신원. **작성 권한의 원본**이며 독자와 저자를 한 테이블에 담는다 | "블로그 계정"(회원과 혼동), "Author"(독자도 포함하므로 좁다) | `blog/domain/.../BlogProfile.kt` |
| ProfileRole | VO | `READER`(첫 댓글 시 자동 생성) / `AUTHOR`(승인된 저자) | "권한", "Role"(전역 RBAC 의 `Role` 과 다른 축) | `BlogEnums.kt` |
| ProfileStatus | VO | `PENDING` / `ACTIVE` / `SUSPENDED`. 정지는 글쓰기와 댓글을 함께 막는다 | "탈퇴"(회원 상태는 member BC 소관) | `BlogEnums.kt` |
| handle | VO | 작성자 공간 URL 세그먼트(`/authors/{handle}`). 저자만 갖는다 | "닉네임"(표시명은 `displayName` 으로 따로 있다) | `BlogProfile.validateHandle` |
| BlogCategory | Aggregate | 계층 분류. 인접 리스트 + 물질화 경로(`path`), 최대 3단 | "태그"(태그는 없다), "섹션" | `BlogCategory.kt` |
| path | VO | `/tech/server/search`. 서브트리 조회의 prefix이자 URL 세그먼트 | "카테고리 코드"(코드는 없다) | `BlogCategory.pathOf` |
| BlogPost | Aggregate | 글. 소유권 판정(`isOwnedBy`)과 상태 전이의 주인 | "아티클", "콘텐츠" | `BlogPost.kt` |
| PostStatus | VO | `DRAFT` / `PUBLISHED` / `ARCHIVED`. `PUBLISHED → DRAFT` 는 없다 | "비공개"(내림은 `ARCHIVED`), "예약"(P1 에 없다) | `BlogEnums.kt` |
| slug | VO | 글의 주소 세그먼트. 발행 후 변경 불가 | "permalink"(전체 URL 을 뜻해 혼동) | `BlogPost.resolveSlug` |
| BlogComment | Entity | 댓글. 대댓글 1단계, 소프트 삭제 | "리플", "코멘트" | `BlogComment.kt` |
| VoterKey | VO | 좋아요·평점의 1표 식별자. 회원 id 또는 방문자 id | "userId"(익명 표를 담지 못한다) | `VoterKey.kt` |
| 조회 원장 | Entity | `blog_post_view`. 조회수의 진실이고 `view_count` 는 파생값 | "조회 로그"(로그는 버려도 되는 것으로 읽힌다) | `BlogPostViewJpaEntity` |
| 셸(shell) | 개념 | portal-fe 의 `index.html`. 백엔드가 받아 meta 를 주입해 글 상세로 내보낸다 | "템플릿"(서버 템플릿 엔진이 아니다) | `ShellHtmlProvider` |

## Cross-Context 주의

- **Member** — `blog_profile.member_id` 는 member BC 의 회원을 가리키는 FK-as-ID 다.
  블로그는 회원의 이름을 가져오지 않는다(표시명을 블로그에서 따로 정한다) — 서비스 간 호출과
  NetworkPolicy 확장을 피한 결정이다 (ADR-0072).
- **Role** — auth BC 의 `Role`(ROLE_USER/SELLER/ADMIN)과 blog 의 `ProfileRole` 은 다른 축이다.
  전자는 "플랫폼에서 무엇을 할 수 있는가", 후자는 "블로그에서 글을 쓸 수 있는가".
- **Category** — deal BC 의 `DealCategory` 는 계층이 없고 코드 기반이다. 이름만 같다.
