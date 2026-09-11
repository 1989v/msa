-- ADR-0072 / ADR-0093 ③ — 블로그 플랫폼 (blog.1989v.com) 전용 스키마 `blog_db`.
--
-- 원래는 code-dictionary 스키마를 공유했다. ADR-0093 이 blog 를 content 파드로 옮기면서
-- 스키마 공유는 「서비스 간 DB 공유 금지」 위반이 되므로 자기 스키마로 뗀다.
--
-- 정의는 code-dictionary 의 V14 에서 옮기되 **V15 가 적용된 최종 상태**로 적었다
-- (blog_post.status 에서 SCHEDULED 제거). 새 스키마는 처음부터 최종형이면 된다 —
-- 옛 스키마의 ALTER 이력까지 재연할 이유가 없다.
--
-- **시드(카테고리·display_service)는 가져오지 않는다.** 기존 행은 전환 시점의 일회성
-- 복사로 옮기므로, 여기서 시드를 넣으면 복사와 충돌한다(deal 에서 겪어 지웠다).
-- display_service 는 애초에 code-dictionary 테이블이다.

CREATE TABLE blog_profile (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    member_id BIGINT NOT NULL,
    handle VARCHAR(30),
    display_name VARCHAR(40) NOT NULL,
    bio VARCHAR(300),
    avatar_url VARCHAR(1000),
    role VARCHAR(16) NOT NULL DEFAULT 'READER',
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    approved_at DATETIME,
    approved_by_member_id BIGINT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_blog_profile_member (member_id),
    UNIQUE KEY uk_blog_profile_handle (handle),
    INDEX idx_blog_profile_role_status (role, status),
    CONSTRAINT chk_blog_profile_role CHECK (role IN ('READER', 'AUTHOR')),
    CONSTRAINT chk_blog_profile_status CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 계층 카테고리 — 인접 리스트(parent_id) + 물질화 경로(path).
-- 서브트리 조회는 path prefix 하나로 끝나고, 이동은 부모를 바꾼 뒤 하위 path 를 다시 쓴다.
-- 깊이 상한 3단은 도메인이 강제한다 (상한이 없으면 실수로 만든 5단이 URL·브레드크럼·
-- 사이트맵에 그대로 새어 나간다).
CREATE TABLE blog_category (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    parent_id BIGINT,
    slug VARCHAR(60) NOT NULL,
    name VARCHAR(60) NOT NULL,
    description VARCHAR(300),
    depth INT NOT NULL DEFAULT 1,
    path VARCHAR(200) NOT NULL,
    order_no INT NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'OPEN',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_blog_category_path (path),
    UNIQUE KEY uk_blog_category_parent_slug (parent_id, slug),
    INDEX idx_blog_category_status_order (status, order_no),
    CONSTRAINT chk_blog_category_status CHECK (status IN ('OPEN', 'HIDDEN')),
    CONSTRAINT chk_blog_category_depth CHECK (depth BETWEEN 1 AND 3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 카운터(view/like/comment/rating)는 비정규화다. 목록 화면마다 집계 쿼리를 돌리면 글이
-- 늘수록 목록이 느려진다. 갱신은 원장 INSERT 가 성공했을 때만 한다.
--
-- PUBLISHED → DRAFT 전이는 도메인에서 막는다. 발행된 주소가 공유된 뒤 사라지면 링크가 죽는다 —
-- 내릴 때는 ARCHIVED 로 간다.
CREATE TABLE blog_post (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    author_profile_id BIGINT NOT NULL,
    category_id BIGINT NOT NULL,
    slug VARCHAR(80) NOT NULL,
    title VARCHAR(200) NOT NULL,
    summary VARCHAR(300),
    body MEDIUMTEXT NOT NULL,
    cover_image_url VARCHAR(1000),
    status VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    published_at DATETIME,
    reading_minutes INT NOT NULL DEFAULT 1,
    view_count BIGINT NOT NULL DEFAULT 0,
    like_count BIGINT NOT NULL DEFAULT 0,
    comment_count BIGINT NOT NULL DEFAULT 0,
    rating_sum BIGINT NOT NULL DEFAULT 0,
    rating_count BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_blog_post_slug (slug),
    INDEX idx_blog_post_status_published (status, published_at DESC),
    INDEX idx_blog_post_category (category_id, status, published_at DESC),
    INDEX idx_blog_post_author (author_profile_id, status, published_at DESC),
    CONSTRAINT chk_blog_post_status CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 조회 원장. 조회수의 진실은 이 테이블이고 blog_post.view_count 는 그 파생값이다.
-- Redis 를 쓰지 않는 이유: code-dictionary:app 에 Redis 의존성이 없고, 조회수 하나를 위해
-- 새 커넥션 풀을 붙이지 않는다. 부수 효과로 날짜별 추이가 남아 작성자 대시보드가 된다.
CREATE TABLE blog_post_view (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    post_id BIGINT NOT NULL,
    visitor_key VARCHAR(64) NOT NULL,
    view_date DATE NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_blog_post_view (post_id, visitor_key, view_date),
    INDEX idx_blog_post_view_date (post_id, view_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 좋아요·평점은 익명 허용 (ADR-0072 §5). 투표 키는 회원 id 또는 게이트웨이 X-Visitor-Id.
CREATE TABLE blog_post_like (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    post_id BIGINT NOT NULL,
    voter_type VARCHAR(8) NOT NULL,
    voter_key VARCHAR(64) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_blog_post_like (post_id, voter_type, voter_key),
    CONSTRAINT chk_blog_post_like_voter CHECK (voter_type IN ('MEMBER', 'VISITOR'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE blog_post_rating (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    post_id BIGINT NOT NULL,
    voter_type VARCHAR(8) NOT NULL,
    voter_key VARCHAR(64) NOT NULL,
    -- 엔티티가 Kotlin Int 라 INT 로 둔다. 옛 스키마는 TINYINT 였고, 운영 파드가
    -- ddl-auto=none 이라 검증을 안 해서 어긋남이 안 드러났다(place.depth 와 같은 건).
    -- 새 스키마는 처음부터 맞춘다 — 값 범위는 아래 CHECK 가 1..5 로 잡는다.
    score INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_blog_post_rating (post_id, voter_type, voter_key),
    CONSTRAINT chk_blog_post_rating_voter CHECK (voter_type IN ('MEMBER', 'VISITOR')),
    CONSTRAINT chk_blog_post_rating_score CHECK (score BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 댓글만 로그인을 요구한다 (profile_id NOT NULL). 삭제는 소프트 삭제 —
-- 행을 지우면 대댓글이 부모를 잃는다.
CREATE TABLE blog_comment (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    post_id BIGINT NOT NULL,
    profile_id BIGINT NOT NULL,
    parent_id BIGINT,
    body VARCHAR(2000) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'VISIBLE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_blog_comment_post (post_id, status, created_at),
    INDEX idx_blog_comment_profile (profile_id, created_at),
    CONSTRAINT chk_blog_comment_status CHECK (status IN ('VISIBLE', 'HIDDEN', 'DELETED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 카테고리 시드 — 요구된 두 축(기술 / 일상)의 3단 예시까지.
-- path 는 도메인이 조립하는 값과 같은 규칙이어야 한다 (`/{root}/{child}/{leaf}`).
