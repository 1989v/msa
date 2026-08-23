package com.kgd.codedictionary.application.techdomain.service

import com.kgd.codedictionary.application.techdomain.port.TechDomainRepositoryPort
import com.kgd.codedictionary.domain.techdomain.model.TechDomain
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify

/**
 * /tech 도메인 맵 루트 조회 (GET /api/v1/tech/domains).
 *
 * 지키려는 것은 둘이다 — **순서·활성 필터는 저장소가 끝낸 상태로 온다**(서비스가 다시 거르지
 * 않는다), 그리고 **개념 매핑을 그대로 내보낸다**(FE 가 category 로 재유도하지 않도록).
 */
class TechDomainQueryServiceTest : BehaviorSpec({

    val repository = mockk<TechDomainRepositoryPort>()
    val service = TechDomainQueryService(repository)

    fun domain(code: String, label: String, orderNo: Int, conceptIds: List<String>) = TechDomain(
        id = null,
        code = code,
        label = label,
        tagline = "$label 요약",
        orderNo = orderNo,
        active = true,
        conceptIds = conceptIds,
    )

    given("활성 도메인이 있을 때") {
        every { repository.findAllActiveOrdered() } returns listOf(
            domain("search", "검색", 10, listOf("inverse-index", "bulk-indexing")),
            domain("order", "주문·결제", 30, listOf("saga-pattern", "idempotency")),
        )

        val result = service.activeDomains()

        `when`("저장소를 부르면") {
            then("활성 전용 조회만 쓴다 — 서비스에서 다시 거르지 않는다") {
                verify(exactly = 1) { repository.findAllActiveOrdered() }
            }
        }

        `when`("응답을 만들면") {
            then("저장소가 준 순서를 그대로 유지한다") {
                result.map { it.code } shouldContainExactly listOf("search", "order")
            }

            then("코드·라벨·태그라인·개념 목록이 실린다") {
                val search = result.first()
                search.label shouldBe "검색"
                search.tagline shouldBe "검색 요약"
                search.conceptIds shouldContainExactly listOf("inverse-index", "bulk-indexing")
            }
        }
    }

    given("한 개념이 여러 도메인에 걸쳐 있을 때") {
        every { repository.findAllActiveOrdered() } returns listOf(
            domain("partner", "파트너 연동", 40, listOf("idempotency", "retry-pattern")),
            domain("ingest", "데이터 수집", 60, listOf("idempotency", "rate-limiting")),
        )

        `when`("응답을 만들면") {
            then("도메인마다 중복해서 내보낸다 — 배타적으로 나누면 사실이 아니게 된다") {
                service.activeDomains().filter { "idempotency" in it.conceptIds }.map { it.code } shouldContainExactly
                    listOf("partner", "ingest")
            }
        }
    }

    given("활성 도메인이 하나도 없을 때") {
        every { repository.findAllActiveOrdered() } returns emptyList()

        `when`("조회하면") {
            then("빈 목록을 낸다 — FE 가 카테고리 폴백으로 넘어갈 신호다") {
                service.activeDomains() shouldBe emptyList()
            }
        }
    }
})
