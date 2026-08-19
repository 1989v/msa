package com.kgd.deal.domain

import com.kgd.common.exception.BusinessException
import com.kgd.deal.domain.model.DisplayStatus
import com.kgd.deal.domain.model.Offer
import com.kgd.deal.domain.model.RevenueType
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.time.LocalDateTime

class OfferTest : BehaviorSpec({

    val now = LocalDateTime.of(2026, 8, 19, 12, 0)

    fun offer(
        slug: String = "coupang-rocket",
        merchant: String = "쿠팡",
        title: String = "로켓와우 신규가입",
        benefit: String = "첫 달 무료",
        targetUrl: String = "https://link.coupang.com/a/abcdef",
        revenueType: RevenueType = RevenueType.AFFILIATE,
        network: String? = "COUPANG_PARTNERS",
        status: DisplayStatus = DisplayStatus.OPEN,
        validFrom: LocalDateTime? = null,
        validUntil: LocalDateTime? = null,
    ) = Offer(
        id = null,
        slug = slug,
        categoryId = 1L,
        merchant = merchant,
        title = title,
        benefit = benefit,
        summary = null,
        targetUrl = targetUrl,
        revenueType = revenueType,
        network = network,
        status = status,
        validFrom = validFrom,
        validUntil = validUntil,
        orderNo = 10,
    )

    given("오퍼를 만들 때") {

        `when`("slug 가 소문자-숫자-하이픈 형식이 아니면") {
            then("거부한다 — 공유되는 주소다") {
                shouldThrow<BusinessException> { offer(slug = "Coupang") }
                shouldThrow<BusinessException> { offer(slug = "coupang_rocket") }
                shouldThrow<BusinessException> { offer(slug = "-coupang") }
                shouldThrow<BusinessException> { offer(slug = "coupang-") }
                shouldThrow<BusinessException> { offer(slug = "ab") }
            }
        }

        `when`("링크가 https 가 아니면") {
            then("거부한다") {
                shouldThrow<BusinessException> { offer(targetUrl = "http://link.coupang.com/a/x") }
                shouldThrow<BusinessException> { offer(targetUrl = "/relative/path") }
            }
        }

        `when`("제휴 링크인데 네트워크가 없으면") {
            then("거부한다 — 정산 대조가 불가능해진다") {
                shouldThrow<BusinessException> { offer(revenueType = RevenueType.AFFILIATE, network = null) }
                shouldThrow<BusinessException> { offer(revenueType = RevenueType.AFFILIATE, network = " ") }
            }
        }

        `when`("제휴가 아닌데 네트워크가 붙어 있으면") {
            then("거부한다 — 고지 판정이 흔들린다") {
                shouldThrow<BusinessException> { offer(revenueType = RevenueType.PLAIN, network = "LINKPRICE") }
            }
        }

        `when`("종료 시각이 시작 시각보다 앞이거나 같으면") {
            then("거부한다") {
                shouldThrow<BusinessException> {
                    offer(validFrom = now, validUntil = now.minusDays(1))
                }
                shouldThrow<BusinessException> { offer(validFrom = now, validUntil = now) }
            }
        }

        `when`("제휴가 아니고 네트워크도 없으면") {
            then("허용한다 — 단순 혜택 링크의 정상 형태다") {
                offer(revenueType = RevenueType.PLAIN, network = null).requiresDisclosure() shouldBe false
            }
        }
    }

    given("전시 여부를 판정할 때") {

        `when`("기간 제한이 없으면") {
            then("OPEN 인 동안 항상 보인다") {
                offer().isVisibleAt(now) shouldBe true
            }
        }

        `when`("시작 시각과 정확히 같은 순간이면") {
            then("보인다 — 시작 시각은 포함이다") {
                offer(validFrom = now).isVisibleAt(now) shouldBe true
            }
        }

        `when`("시작 전이면") {
            then("보이지 않는다") {
                offer(validFrom = now.plusSeconds(1)).isVisibleAt(now) shouldBe false
            }
        }

        `when`("종료 시각과 정확히 같은 순간이면") {
            then("보이지 않는다 — 종료 시각은 제외다") {
                offer(validUntil = now).isVisibleAt(now) shouldBe false
            }
        }

        `when`("종료 직전이면") {
            then("보인다") {
                offer(validUntil = now.plusSeconds(1)).isVisibleAt(now) shouldBe true
            }
        }

        `when`("기간은 유효하지만 OPEN 이 아니면") {
            then("보이지 않는다") {
                offer(status = DisplayStatus.PREOPEN).isVisibleAt(now) shouldBe false
                offer(status = DisplayStatus.HOLD).isVisibleAt(now) shouldBe false
            }
        }
    }

    given("고지 대상을 판정할 때") {
        then("제휴 링크만 대상이다") {
            offer(revenueType = RevenueType.AFFILIATE).requiresDisclosure() shouldBe true
            offer(revenueType = RevenueType.PLAIN, network = null).requiresDisclosure() shouldBe false
        }
    }
})
