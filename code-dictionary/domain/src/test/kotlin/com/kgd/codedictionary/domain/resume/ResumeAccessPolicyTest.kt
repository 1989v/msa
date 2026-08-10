package com.kgd.codedictionary.domain.resume

import com.kgd.codedictionary.domain.resume.model.ResumeShareLink
import com.kgd.codedictionary.domain.resume.model.ResumeVisibility
import com.kgd.codedictionary.domain.resume.policy.ResumeAccessPolicy
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.time.LocalDateTime

class ResumeAccessPolicyTest : BehaviorSpec({

    fun link(revokedAt: LocalDateTime? = null) = ResumeShareLink.restore(
        id = 1L,
        token = "abcdefghijklmnop",
        label = "OO사 백엔드",
        note = null,
        createdAt = LocalDateTime.now(),
        revokedAt = revokedAt,
    )

    given("전체 공개 상태일 때") {
        val visibility = ResumeVisibility.PUBLIC

        `when`("토큰 없이 열람하면") {
            then("열람할 수 있다") {
                ResumeAccessPolicy.canRead(visibility, null) shouldBe true
            }
        }

        `when`("폐기된 토큰으로 열람하면") {
            then("공개 상태이므로 그대로 열람할 수 있다") {
                ResumeAccessPolicy.canRead(visibility, link(revokedAt = LocalDateTime.now())) shouldBe true
            }
        }
    }

    given("토큰 전용 상태일 때") {
        val visibility = ResumeVisibility.TOKEN_ONLY

        `when`("토큰이 없으면") {
            then("열람할 수 없다") {
                ResumeAccessPolicy.canRead(visibility, null) shouldBe false
            }
        }

        `when`("유효한 토큰이면") {
            then("열람할 수 있다") {
                ResumeAccessPolicy.canRead(visibility, link()) shouldBe true
            }
        }

        `when`("폐기된 토큰이면") {
            then("열람할 수 없다") {
                ResumeAccessPolicy.canRead(visibility, link(revokedAt = LocalDateTime.now())) shouldBe false
            }
        }
    }
})
