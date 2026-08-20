package com.kgd.blog.domain

import com.kgd.blog.domain.model.BlogProfile
import com.kgd.blog.domain.model.ProfileRole
import com.kgd.blog.domain.model.ProfileStatus
import com.kgd.common.exception.BusinessException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class BlogProfileTest : BehaviorSpec({

    fun profile(
        handle: String? = "kgd",
        displayName: String = "권기덕",
        role: ProfileRole = ProfileRole.AUTHOR,
        status: ProfileStatus = ProfileStatus.ACTIVE,
    ) = BlogProfile(
        id = 1L,
        memberId = 7L,
        handle = handle,
        displayName = displayName,
        bio = null,
        avatarUrl = null,
        role = role,
        status = status,
    )

    given("작성 권한을 판정할 때") {

        `when`("승인된 활성 저자면") {
            then("쓸 수 있다") {
                profile().canWrite() shouldBe true
            }
        }

        `when`("승인 대기 중이면") {
            then("쓸 수 없다") {
                profile(status = ProfileStatus.PENDING).canWrite() shouldBe false
                shouldThrow<BusinessException> { profile(status = ProfileStatus.PENDING).requireCanWrite() }
            }
        }

        `when`("독자면") {
            then("쓸 수 없다") {
                profile(handle = null, role = ProfileRole.READER).canWrite() shouldBe false
            }
        }
    }

    given("정지된 계정은") {
        val suspended = profile(status = ProfileStatus.SUSPENDED)

        then("글도 댓글도 막힌다 — 글만 막으면 처분이 무력해진다") {
            suspended.canWrite() shouldBe false
            suspended.canInteract() shouldBe false
            shouldThrow<BusinessException> { suspended.requireCanInteract() }
        }
    }

    given("독자 프로필은") {
        val reader = BlogProfile.newReader(memberId = 7L, displayName = "익명독자")

        then("댓글은 되지만 글은 안 된다") {
            reader.canInteract() shouldBe true
            reader.canWrite() shouldBe false
            reader.hasPublicSpace() shouldBe false
        }
    }

    given("핸들을 검증할 때") {

        `when`("형식이 맞지 않으면") {
            then("거부한다") {
                shouldThrow<BusinessException> { BlogProfile.validateHandle("KGD") }
                shouldThrow<BusinessException> { BlogProfile.validateHandle("ab") }
                shouldThrow<BusinessException> { BlogProfile.validateHandle("-abc") }
                shouldThrow<BusinessException> { BlogProfile.validateHandle("a_bc") }
            }
        }

        `when`("호스트의 실제 경로와 겹치면") {
            then("거부한다 — 그 경로가 통째로 가려진다") {
                shouldThrow<BusinessException> { BlogProfile.validateHandle("posts") }
                shouldThrow<BusinessException> { BlogProfile.validateHandle("studio") }
            }
        }
    }

    given("저자인데 핸들이 없으면") {
        then("만들 수 없다 — 작성자 공간 주소가 생기지 않는다") {
            shouldThrow<BusinessException> { profile(handle = null) }
        }
    }
})
