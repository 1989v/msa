package com.kgd.blog.domain.model

/**
 * 블로그 신원의 종류 (ADR-0072 §2).
 *
 * 독자와 저자를 **한 테이블**에 담는다. 프로필을 둘로 쪼개면 같은 사람의 표시명이
 * 화면마다 달라진다.
 */
enum class ProfileRole {
    /** 첫 댓글 시 자동 생성. 글은 쓸 수 없다 */
    READER,

    /** 어드민 승인을 거친 저자. 자기 공간(`/authors/{handle}`)을 갖는다 */
    AUTHOR,
}

enum class ProfileStatus {
    /** 저자 신청 후 승인 대기 */
    PENDING,
    ACTIVE,

    /** 정지. 글쓰기뿐 아니라 댓글도 막힌다 — 글만 막으면 정지 처분이 사실상 무력해진다 */
    SUSPENDED,
}

enum class CategoryStatus {
    OPEN,

    /** 목록·네비에서 감춘다. 이미 발행된 글의 주소는 살아 있다 */
    HIDDEN;

    val visible: Boolean get() = this == OPEN
}

/**
 * 글의 생애 (ADR-0072).
 *
 * `PUBLISHED → DRAFT` 는 없다. 발행된 주소가 공유된 뒤 사라지면 링크가 죽는다 —
 * 내릴 때는 [ARCHIVED] 로 간다.
 */
enum class PostStatus {
    DRAFT,
    SCHEDULED,
    PUBLISHED,
    ARCHIVED;

    /** 공개 조회·사이트맵·색인 대상인가 */
    val publiclyVisible: Boolean get() = this == PUBLISHED

    fun canTransitionTo(next: PostStatus): Boolean = when (this) {
        DRAFT -> next in setOf(SCHEDULED, PUBLISHED, ARCHIVED)
        SCHEDULED -> next in setOf(DRAFT, PUBLISHED, ARCHIVED)
        PUBLISHED -> next == ARCHIVED
        ARCHIVED -> next == PUBLISHED
    }
}

enum class CommentStatus {
    VISIBLE,

    /** 모더레이션으로 감춤. 복구 가능 */
    HIDDEN,

    /** 작성자가 지움. 행은 남긴다 — 지우면 대댓글이 부모를 잃는다 */
    DELETED;

    val readable: Boolean get() = this == VISIBLE
}

/** 좋아요·평점의 투표 주체 (ADR-0072 §5 — 익명 허용) */
enum class VoterType {
    /** 로그인 회원. 게이트웨이가 검증한 `X-User-Id` */
    MEMBER,

    /** 비로그인. 게이트웨이 `VisitorIdFilter` 가 심는 `X-Visitor-Id` */
    VISITOR,
}
