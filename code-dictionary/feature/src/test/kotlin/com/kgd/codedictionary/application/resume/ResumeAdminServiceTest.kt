package com.kgd.codedictionary.application.resume

import com.kgd.codedictionary.application.resume.dto.ResumeShareLinkCreateRequest
import com.kgd.codedictionary.application.resume.port.ResumeAccessLogRepositoryPort
import com.kgd.codedictionary.application.resume.port.ResumeDocumentRepositoryPort
import com.kgd.codedictionary.application.resume.port.ResumeSettingRepositoryPort
import com.kgd.codedictionary.application.resume.port.ResumeShareLinkRepositoryPort
import com.kgd.codedictionary.application.resume.service.ResumeAdminService
import com.kgd.codedictionary.domain.resume.model.ResumeShareLink
import com.kgd.common.shortlink.ShortLinkProperties
import com.kgd.common.shortlink.ShortLinks
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import java.time.LocalDateTime

/** 제출처 링크 생성 시 단축 코드 부여, 목록 응답의 `shortUrl`. */
class ResumeAdminServiceTest : BehaviorSpec({

    class Fixture(val service: ResumeAdminService, val links: ResumeShareLinkRepositoryPort)

    fun fixture(expose: Boolean): Fixture {
        val links = mockk<ResumeShareLinkRepositoryPort>()
        val accessLog = mockk<ResumeAccessLogRepositoryPort>()
        every { accessLog.countByShareLink() } returns emptyMap()
        every { links.save(any()) } answers {
            val l = firstArg<ResumeShareLink>()
            ResumeShareLink.restore(1L, l.token, l.shortCode, l.label, l.note, LocalDateTime.now(), null)
        }
        val service = ResumeAdminService(
            documentRepository = mockk<ResumeDocumentRepositoryPort>(),
            shareLinkRepository = links,
            accessLogRepository = accessLog,
            settingRepository = mockk<ResumeSettingRepositoryPort>(),
            shortLinks = ShortLinks(ShortLinkProperties(expose = expose)),
        )
        return Fixture(service, links)
    }

    given("링크를 만들면") {
        val f = fixture(expose = true)
        val checked = mutableListOf<String>()
        every { f.links.existsByShortCode(capture(checked)) } returnsMany listOf(true, false)
        val saved = slot<ResumeShareLink>()
        every { f.links.save(capture(saved)) } answers {
            val l = saved.captured
            ResumeShareLink.restore(1L, l.token, l.shortCode, l.label, l.note, LocalDateTime.now(), null)
        }

        val dto = f.service.createShareLink(ResumeShareLinkCreateRequest(label = "OO사 백엔드"))

        then("10자 base62 코드를 자동으로 붙인다") {
            ResumeShareLink.isValidShortCode(saved.captured.shortCode) shouldBe true
        }

        then("이미 쓰인 코드면 새로 뽑은 코드로 저장한다") {
            checked.size shouldBe 2
            (checked[0] == checked[1]) shouldBe false
            saved.captured.shortCode shouldBe checked[1]
        }

        then("응답의 단축 주소가 그 코드를 가리킨다") {
            dto.shortUrl shouldBe "https://1989v.com/r/${saved.captured.shortCode}"
        }
    }

    given("링크 목록을 내면") {
        val stored = ResumeShareLink.restore(
            5L, "abcdefghijklmnopqrstuvwxyz012345", "Ab3dE6gH9k", "OO사", null, LocalDateTime.now(), null,
        )

        `when`("노출 설정이 켜져 있으면") {
            val f = fixture(expose = true)
            every { f.links.findAll() } returns listOf(stored)

            then("shortUrl 을 싣는다") {
                f.service.listShareLinks().single().shortUrl shouldBe "https://1989v.com/r/Ab3dE6gH9k"
            }
        }

        `when`("노출 설정이 꺼져 있으면") {
            val f = fixture(expose = false)
            every { f.links.findAll() } returns listOf(stored)

            then("shortUrl 은 null 이다 — 해석 경로를 배포·실측하기 전에는 퍼뜨리지 않는다") {
                f.service.listShareLinks().single().shortUrl shouldBe null
            }
        }
    }
})
