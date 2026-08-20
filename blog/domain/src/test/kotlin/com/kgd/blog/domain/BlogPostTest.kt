package com.kgd.blog.domain

import com.kgd.blog.domain.model.BlogPost
import com.kgd.blog.domain.model.PostStatus
import com.kgd.common.exception.BusinessException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldStartWith
import java.time.LocalDateTime

class BlogPostTest : BehaviorSpec({

    val now = LocalDateTime.of(2026, 8, 21, 10, 0)

    fun post(
        authorProfileId: Long = 1L,
        status: PostStatus = PostStatus.PUBLISHED,
        summary: String? = "요약",
        body: String = "본문",
    ) = BlogPost(
        id = 10L,
        authorProfileId = authorProfileId,
        categoryId = 3L,
        slug = "hello-world",
        title = "안녕",
        summary = summary,
        body = body,
        coverImageUrl = null,
        status = status,
        publishedAt = if (status == PostStatus.PUBLISHED) now else null,
    )

    given("소유권을 판정할 때") {

        `when`("작성자 본인이면") {
            then("수정할 수 있다") {
                post().isOwnedBy(1L) shouldBe true
                post().requireEditableBy(1L, isAdmin = false)
            }
        }

        `when`("다른 저자면") {
            then("거부한다 — 요구의 핵심이다") {
                post().isOwnedBy(2L) shouldBe false
                shouldThrow<BusinessException> { post().requireEditableBy(2L, isAdmin = false) }
            }
        }

        `when`("로그인하지 않았으면") {
            then("거부한다") {
                post().isOwnedBy(null) shouldBe false
                shouldThrow<BusinessException> { post().requireEditableBy(null, isAdmin = false) }
            }
        }

        `when`("어드민이면") {
            then("남의 글도 수정할 수 있다") {
                post().requireEditableBy(2L, isAdmin = true)
            }
        }
    }

    given("상태를 바꿀 때") {

        then("발행된 글은 초안으로 되돌릴 수 없다 — 공유된 주소가 죽는다") {
            shouldThrow<BusinessException> { post().requireTransitionTo(PostStatus.DRAFT) }
            PostStatus.PUBLISHED.canTransitionTo(PostStatus.ARCHIVED) shouldBe true
        }

        then("초안은 예약·발행·보관으로 갈 수 있다") {
            val draft = post(status = PostStatus.DRAFT)
            draft.requireTransitionTo(PostStatus.SCHEDULED)
            draft.requireTransitionTo(PostStatus.PUBLISHED)
            draft.requireTransitionTo(PostStatus.ARCHIVED)
        }

        then("보관된 글은 다시 발행할 수 있다") {
            post(status = PostStatus.ARCHIVED).requireTransitionTo(PostStatus.PUBLISHED)
        }

        then("같은 상태로의 전이는 통과시킨다") {
            post().requireTransitionTo(PostStatus.PUBLISHED)
        }
    }

    given("발행 상태인데 발행 시각이 없으면") {
        then("만들 수 없다") {
            shouldThrow<BusinessException> { post().copy(publishedAt = null) }
        }
    }

    given("슬러그를 정할 때") {

        `when`("입력이 있으면") {
            then("그대로 쓴다") {
                BlogPost.resolveSlug("my-post", "아무 제목", now, "abc123") shouldBe "my-post"
            }
        }

        `when`("입력이 형식에 맞지 않으면") {
            then("거부한다") {
                shouldThrow<BusinessException> { BlogPost.resolveSlug("My_Post", "t", now, "abc123") }
            }
        }

        `when`("입력이 없고 제목이 영문이면") {
            then("제목에서 뽑는다") {
                BlogPost.resolveSlug(null, "Hello Kotlin World!", now, "abc123") shouldBe "hello-kotlin-world"
            }
        }

        `when`("입력이 없고 제목이 한글이면") {
            then("날짜+시드로 간다 — 이게 기본 경로다") {
                BlogPost.resolveSlug(null, "검색 색인 이야기", now, "AbC12345XYZ") shouldStartWith "20260821-abc12345"
            }
        }
    }

    given("읽는 시간을 계산할 때") {
        then("최소 1분이고 글자 수에 비례한다") {
            BlogPost.readingMinutesOf("짧다") shouldBe 1
            BlogPost.readingMinutesOf("가".repeat(500)) shouldBe 1
            BlogPost.readingMinutesOf("가".repeat(501)) shouldBe 2
        }
    }

    given("메타 설명을 만들 때") {

        `when`("요약이 있으면") {
            then("요약을 쓴다") {
                post().descriptionOrExcerpt() shouldBe "요약"
            }
        }

        `when`("요약이 없으면") {
            then("본문에서 마크다운을 걷어내고 뽑는다 — 설명이 비면 공유 카드가 통째로 빈다") {
                val body = "# 제목\n\n**굵게** 쓴 [링크](https://x.com) 문장입니다."
                post(summary = null, body = body).descriptionOrExcerpt() shouldBe "제목 굵게 쓴 링크 문장입니다."
            }
        }
    }
})
