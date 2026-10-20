package com.kgd.ranking

import com.kgd.ranking.application.cafe.dto.*
import com.kgd.ranking.application.cafe.port.CafeDrinkRepositoryPort
import com.kgd.ranking.application.cafe.service.CafeDrinkService
import com.kgd.ranking.domain.cafe.model.CaffeineStatus
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.assertions.throwables.shouldThrow
import io.mockk.*
import java.math.BigDecimal

class CafeDrinkServiceTest : BehaviorSpec({
    Given("서로 다른 브랜드가 이미 적재되어 있을 때") {
        val existing = mutableListOf(cafeItem("first", "옛 메뉴").toDomain(), cafeItem("other", "보존 메뉴").toDomain())
        val port = mockk<CafeDrinkRepositoryPort>()
        every { port.deleteByBrands(any()) } answers { existing.removeAll { it.brandSlug in firstArg<Set<String>>() }; Unit }
        every { port.saveAll(any()) } answers { existing.addAll(firstArg()); Unit }
        val service = CafeDrinkService(port)
        When("first 브랜드만 새로 보내면") {
            val result = service.execute(CafeDrinkBulkRequest(listOf(cafeItem("first", "새 메뉴"))))
            Then("전달된 브랜드만 교체하고 타 브랜드는 유지한다") {
                result.replacedBrands shouldBe setOf("first")
                existing.map { it.menuName }.toSet() shouldBe setOf("새 메뉴", "보존 메뉴")
                verifyOrder { port.deleteByBrands(setOf("first")); port.saveAll(any()) }
            }
        }
    }
    Given("빈 파일에 해당하는 요청") {
        val port = mockk<CafeDrinkRepositoryPort>()
        Then("어떤 브랜드도 삭제하지 않는다") {
            CafeDrinkService(port).execute(CafeDrinkBulkRequest(emptyList())).received shouldBe 0
            verify { port wasNot Called }
        }
    }
    Given("이름이 같은 일반 음료와 디카페인") {
        val port = mockk<CafeDrinkRepositoryPort>(relaxed = true)
        val service = CafeDrinkService(port)
        Then("두 판 모두 적재되고 같은 판의 중복 요청은 삭제 전에 거부한다") {
            val normal = cafeItem()
            val decaf = normal.copy(caffeineStatus = CaffeineStatus.DECAF)
            service.execute(CafeDrinkBulkRequest(listOf(normal, decaf))).received shouldBe 2
            clearMocks(port)
            shouldThrow<IllegalArgumentException> { service.execute(CafeDrinkBulkRequest(listOf(normal, normal))) }
            verify { port wasNot Called }
        }
    }
    Given("카페인 없음 필터와 농도 조회") {
        val port = mockk<CafeDrinkRepositoryPort>()
        val service = CafeDrinkService(port)
        val query = CafeDrinkQuery(caffeine = "none", sort = "sugarPer100ml")
        every { port.search(query) } returns CafeDrinkPage(listOf(CafeDrinkResponse.of(cafeItem(status = CaffeineStatus.ZERO).copy(caffeineMg = BigDecimal.ZERO).toDomain())), 1, 0, 50)
        Then("필터를 포트에 전달하며 용량 기반 파생값을 반환한다") {
            val response = service.execute(query)
            response.content.single().sugarPer100ml shouldBe BigDecimal("2.0000")
            response.content.single().caffeinePer100ml shouldBe BigDecimal("0.0000")
            verify(exactly = 1) { port.search(query) }
        }
    }
})
