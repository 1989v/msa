package com.kgd.codedictionary.application.resume

import com.kgd.codedictionary.application.resume.port.ResumeShareLinkRepositoryPort
import com.kgd.codedictionary.application.resume.port.ResumeShortLinkClickRepositoryPort
import com.kgd.codedictionary.application.resume.service.ResumeShortLinkService
import com.kgd.codedictionary.application.resume.usecase.ResolveResumeShortLinkUseCase.Outcome
import com.kgd.codedictionary.domain.resume.model.ResumeShareLink
import com.kgd.common.shortlink.ShortLinkProperties
import com.kgd.common.shortlink.ShortLinks
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import java.time.LocalDateTime

/**
 * 해석 결과 종류(로그용)와 클릭 적재. 302 의 모양은 `ResumeShortLinkControllerTest` 가 본다.
 */
class ResumeShortLinkServiceTest : BehaviorSpec({

    val code = "Ab3dE6gH9k"

    fun link(revokedAt: LocalDateTime?) = ResumeShareLink.restore(
        id = 3L,
        token = "abcdefghijklmnopqrstuvwxyz012345",
        shortCode = code,
        label = "OO사",
        note = null,
        createdAt = LocalDateTime.now(),
        revokedAt = revokedAt,
    )

    fun service(found: ResumeShareLink?, clicks: ResumeShortLinkClickRepositoryPort = mockk()): ResumeShortLinkService {
        val links = mockk<ResumeShareLinkRepositoryPort>()
        every { links.findByShortCode(code) } returns found
        return ResumeShortLinkService(links, clicks, ShortLinks(ShortLinkProperties()))
    }

    given("링크 상태별로 해석하면") {
        then("isUsable() 이 참인 링크만 열린다 — 폐기·없음은 종류만 다르고 모두 홈") {
            service(link(revokedAt = null)).execute("/$code").let {
                it.outcome shouldBe Outcome.RESOLVED
                it.location shouldBe "https://resume.1989v.com/?k=abcdefghijklmnopqrstuvwxyz012345"
            }
            service(link(revokedAt = LocalDateTime.now())).execute("/$code").let {
                it.outcome shouldBe Outcome.REVOKED
                it.shareLinkId shouldBe 3L
                it.location shouldBe "https://resume.1989v.com/"
            }
            service(found = null).execute("/$code").outcome shouldBe Outcome.NOT_FOUND
            service(found = null).execute("/not-a-code").outcome shouldBe Outcome.MALFORMED
            service(found = null).execute("/$code/x").outcome shouldBe Outcome.MALFORMED
            service(found = null).execute("/list").outcome shouldBe Outcome.HOME
        }
    }

    given("클릭을 적재하면") {
        val clicks = mockk<ResumeShortLinkClickRepositoryPort>()
        every { clicks.record(any(), any()) } returns Unit
        service(found = null, clicks = clicks).execute(3L)

        then("링크 id 와 시각만 포트로 넘긴다 — 리퍼러·UA 는 받는 자리가 없다") {
            verify(exactly = 1) {
                clicks.record(3L, match { it.isAfter(LocalDateTime.now().minusMinutes(1)) })
            }
        }
    }
})
