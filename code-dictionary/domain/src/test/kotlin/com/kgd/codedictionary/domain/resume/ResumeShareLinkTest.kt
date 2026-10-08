package com.kgd.codedictionary.domain.resume

import com.kgd.codedictionary.domain.resume.model.ResumeShareLink
import com.kgd.common.exception.BusinessException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.time.LocalDateTime

/**
 * 단축 코드 형식은 토큰처럼 생성·복원 두 시점 모두에서 검사한다. 복원에서 빠지면 DB 에 잘못 들어간
 * 값이 조용히 해석 경로까지 흘러간다.
 */
class ResumeShareLinkTest : BehaviorSpec({

    val token = "abcdefghijklmnopqrstuvwxyz012345"

    fun restore(shortCode: String) = ResumeShareLink.restore(
        id = 1L,
        token = token,
        shortCode = shortCode,
        label = "OO사 백엔드",
        note = null,
        createdAt = LocalDateTime.now(),
        revokedAt = null,
    )

    given("10자 base62 코드면") {
        then("생성·복원 모두 통과하고 코드를 그대로 갖는다") {
            ResumeShareLink.create(token = token, shortCode = "Ab3dE6gH9k", label = "OO사").shortCode shouldBe "Ab3dE6gH9k"
            restore("0000000000").shortCode shouldBe "0000000000"
        }
    }

    given("형식을 어긴 코드면") {
        val invalid = listOf("Ab3dE6gH9", "Ab3dE6gH9kX", "Ab3dE6gH9-", "Ab3dE6gH9_", "Ab3dE6gH9 ", "Ab3dE6gH9한", "")

        then("생성에서 거절한다") {
            invalid.forEach { code ->
                shouldThrow<BusinessException> { ResumeShareLink.create(token = token, shortCode = code, label = "OO사") }
            }
        }

        then("복원에서도 거절한다") {
            invalid.forEach { code -> shouldThrow<BusinessException> { restore(code) } }
        }

        then("형식 판정 함수도 같은 답을 낸다") {
            invalid.forEach { ResumeShareLink.isValidShortCode(it) shouldBe false }
            ResumeShareLink.isValidShortCode("Ab3dE6gH9k") shouldBe true
        }
    }
})
