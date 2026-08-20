-- ADR-0072 — 블로그 플랫폼 (blog.1989v.com).
--
-- deal 과 같이 code-dictionary 스키마를 공유한다. 전용 datasource 를 두지 않는 이유도 같다 —
-- 독립 쓰기 경로가 없고 라이프사이클이 display_service 와 같다. 스키마 주인이 마이그레이션도
-- 소유하므로 여기(호스트의 db/migration)에 둔다. Flyway 히스토리가 하나이므로 버전 수열도 하나다.

-- 블로그 신원. **독자와 저자를 한 테이블에 담는다** — 프로필을 둘로 쪼개면 같은 사람의
-- 표시명이 화면마다 달라진다.
--
-- 작성 권한 = (role = 'AUTHOR' AND status = 'ACTIVE'). 전역 Role enum(ROLE_USER/SELLER/ADMIN)에
-- ROLE_AUTHOR 를 더하지 않은 이유는 ADR-0072 §2 — 역할 하나로는 핸들·표시명을 담지 못해
-- 어차피 이 테이블이 필요하고, 권한 진실이 JWT 클레임과 두 군데로 갈리면 정지 처분이
-- 토큰 만료 전까지 먹지 않는다.
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
    score TINYINT NOT NULL,
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
INSERT INTO blog_category (parent_id, slug, name, description, depth, path, order_no) VALUES
    (NULL, 'tech',  '기술', '서버 · 검색 · 데이터 · 프런트엔드', 1, '/tech',  10),
    (NULL, 'life',  '일상', '취미 · 기록 · 생각',                1, '/life',  20);

INSERT INTO blog_category (parent_id, slug, name, description, depth, path, order_no)
SELECT id, 'server', '서버', '백엔드 · 인프라 · 운영', 2, '/tech/server', 10 FROM blog_category WHERE path = '/tech'
UNION ALL SELECT id, 'data', '데이터', '파이프라인 · 저장소 · 분석', 2, '/tech/data', 20 FROM blog_category WHERE path = '/tech'
UNION ALL SELECT id, 'frontend', '프런트엔드', '웹 · UI · 성능', 2, '/tech/frontend', 30 FROM blog_category WHERE path = '/tech'
UNION ALL SELECT id, 'hobby', '취미', '게임 · 만들기 · 수집', 2, '/life/hobby', 10 FROM blog_category WHERE path = '/life'
UNION ALL SELECT id, 'note', '기록', '읽은 것 · 다녀온 곳', 2, '/life/note', 20 FROM blog_category WHERE path = '/life';

INSERT INTO blog_category (parent_id, slug, name, description, depth, path, order_no)
SELECT id, 'search', '검색', '색인 · 랭킹 · 질의', 3, '/tech/server/search', 10 FROM blog_category WHERE path = '/tech/server'
UNION ALL SELECT id, 'game', '게임', '플레이 기록 · 만든 게임', 3, '/life/hobby/game', 10 FROM blog_category WHERE path = '/life/hobby';

-- 메인 런처 전시 타일 (ADR-0066). href 는 상대 경로 — 절대 URL 을 박으면 apex 의
-- 서브도메인 리다이렉트 로직을 우회하고 로컬 개발에서도 프로덕션으로 튄다.
-- code 가 이미 있으면 건드리지 않는다 (어드민에서 손본 값을 배포가 되돌리면 안 된다).
INSERT IGNORE INTO display_service (code, label, tagline, href, status, order_no) VALUES
    ('blog', '블로그', '기술 · 일상 · 기록', '/blog', 'OPEN', 25);
