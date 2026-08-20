package com.kgd.blog.domain

import com.kgd.blog.domain.model.BlogComment
import com.kgd.blog.domain.model.CommentStatus
import com.kgd.blog.domain.model.VoterKey
import com.kgd.blog.domain.model.VoterType
import com.kgd.common.exception.BusinessException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class BlogCommentTest : BehaviorSpec({

    fun comment(profileId: Long = 1L, parentId: Long? = null, body: String = "잘 봤습니다") =
        BlogComment(
            id = 5L,
            postId = 10L,
            profileId = profileId,
            parentId = parentId,
            body = body,
            status = CommentStatus.VISIBLE,
        )

    given("댓글을 수정할 때") {
        then("본인 또는 어드민만 가능하다") {
            comment().requireEditableBy(1L, isAdmin = false)
            comment().requireEditableBy(9L, isAdmin = true)
            shouldThrow<BusinessException> { comment().requireEditableBy(9L, isAdmin = false) }
        }
    }

    given("대댓글을 달 때") {
        then("최상위 댓글에만 달 수 있다 — 모바일에서 3단은 읽을 수 없다") {
            BlogComment.requireTopLevelParent(comment())
            shouldThrow<BusinessException> { BlogComment.requireTopLevelParent(comment(parentId = 5L)) }
        }
    }

    given("본문 길이가 범위를 벗어나면") {
        then("거부한다") {
            shouldThrow<BusinessException> { comment(body = "  ") }
            shouldThrow<BusinessException> { comment(body = "가".repeat(BlogComment.MAX_BODY + 1)) }
        }
    }

    given("삭제된 댓글은") {
        then("행이 남는다 — 지우면 대댓글이 부모를 잃는다") {
            CommentStatus.DELETED.readable shouldBe false
            CommentStatus.VISIBLE.readable shouldBe true
        }
    }

    given("투표자를 식별할 때") {

        `when`("로그인 상태면") {
            then("회원 키가 이긴다 — 쿠키를 지울 때마다 표가 새로 생기면 안 된다") {
                VoterKey.of("7", "visitor-abc") shouldBe VoterKey(VoterType.MEMBER, "7")
            }
        }

        `when`("비로그인이면") {
            then("방문자 키를 쓴다") {
                VoterKey.of(null, "visitor-abc") shouldBe VoterKey(VoterType.VISITOR, "visitor-abc")
            }
        }

        `when`("둘 다 없으면") {
            then("거부한다") {
                shouldThrow<BusinessException> { VoterKey.of(null, null) }
                shouldThrow<BusinessException> { VoterKey.of("", "  ") }
            }
        }
    }
})
