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
    Given("24 published variants spanning brands") {
        val port = mockk<CafeDrinkRepositoryPort>()
        val variants = (1..22).map { index -> CafeDrinkResponse.of(cafeItem("a", "라떼 (L)").copy(sizeLabel = "L$index", sugarG = BigDecimal.ONE).toDomain()) } +
            listOf(CafeDrinkResponse.of(cafeItem("a", "라떼 (R)").copy(sizeLabel = "R", sugarG = BigDecimal("30")).toDomain()),
                CafeDrinkResponse.of(cafeItem("b", "라떼 (R)").copy(sizeLabel = "R", sugarG = BigDecimal("10")).toDomain()),
                CafeDrinkResponse.of(cafeItem("c", "라떼 (R)").copy(sizeLabel = "R", sugarG = null).toDomain()))
        every { port.variants("라떼") } returns variants
        val service = CafeDrinkService(port)
        Then("all variants survive and sort uses displayed basic size, never hidden minimum; null stays last") {
            val result = service.compare("라떼", CafeDrinkQuery())
            result.map { it.brandSlug } shouldBe listOf("b", "a", "c")
            result[1].variants.size shouldBe 23
            result[1].representative.sugarG shouldBe BigDecimal("30")
            service.compare("라떼", CafeDrinkQuery(direction = "desc")).map { it.brandSlug } shouldBe listOf("a", "b", "c")
            service.compare("라떼", CafeDrinkQuery(brands = listOf("b"))).size shouldBe 1
        }
    }
    Given("rounded concentrations conceal different raw ratios") {
        val port = mockk<CafeDrinkRepositoryPort>()
        val service = CafeDrinkService(port)
        val variants = listOf("a" to "333", "b" to "333.01", "c" to null).map { (brand, volume) ->
            CafeDrinkResponse.of(cafeItem(brand, "라떼").copy(sugarG = BigDecimal.ONE,
                caffeineMg = BigDecimal.ONE, kcal = BigDecimal.ONE, volumeMl = volume?.let(::BigDecimal),
                servingBasis = null, sizeLabel = null).toDomain())
        }
        every { port.variants("라떼") } returns variants
        Then("all concentration metrics order unrounded ratios and retain unavailable volume last in both directions") {
            variants.take(2).map { it.sugarPer100ml }.distinct() shouldBe listOf(BigDecimal("0.3003"))
            listOf("sugar", "caffeine", "kcal", "sugarPer100ml").forEach { metric ->
                service.compare("라떼", CafeDrinkQuery(sort = metric, basis = "100ml")).map { it.brandSlug } shouldBe listOf("b", "a", "c")
                service.compare("라떼", CafeDrinkQuery(sort = metric, basis = "100ml", direction = "desc")).map { it.brandSlug } shouldBe listOf("a", "b", "c")
            }
        }
    }
    Given("grouped search spans raw pages and hidden nutrient minima") {
        val port = mockk<CafeDrinkRepositoryPort>()
        val normal = CafeDrinkResponse.of(cafeItem("a", "라떼").toDomain()).copy(drinkKey = "ice-small", drinkName = "라떼", temperature = "ICE", sizeLabel = "S", cupVolumeMl = BigDecimal("250"), sugarG = BigDecimal("20"))
        val rows = (1..201).map { normal.copy(drinkKey = "large-$it", sizeLabel = "L", cupVolumeMl = BigDecimal("500"), sugarG = BigDecimal.ONE) } + listOf(
            normal.copy(drinkKey = "decaf", caffeineStatus = CaffeineStatus.DECAF, sugarG = BigDecimal.ZERO), normal,
            normal.copy(drinkKey = "hot-small", temperature = "HOT", sugarG = BigDecimal("10")),
            normal.copy(brandSlug = "b", brandName = "B", drinkKey = "b-hot", temperature = "HOT", sugarG = BigDecimal("15")))
        every { port.search(any()) } answers { val q = firstArg<CafeDrinkQuery>(); CafeDrinkPage(rows.drop(q.page * q.size).take(q.size), rows.size.toLong(), q.page, q.size) }
        every { port.variants("라떼") } returns rows
        val service = CafeDrinkService(port)
        Then("brand paging keeps all variants together and compare shares ICE/smallest/ordinary defaults with fallback") {
            val first = service.grouped(CafeDrinkQuery(size = 1))
            first.totalElements shouldBe 2
            first.menuCount shouldBe 2
            first.brandGroups!!.single().brandSlug shouldBe "b"
            val second = service.grouped(CafeDrinkQuery(size = 1, page = 1))
            val menu = second.brandGroups!!.single().menus.single()
            menu.variants.size shouldBe 204
            menu.representative.drinkKey shouldBe "ice-small"
            service.compare("라떼", CafeDrinkQuery()).first { it.brandSlug == "a" }.representative.drinkKey shouldBe "ice-small"
            service.compare("라떼", CafeDrinkQuery(temperature = "HOT")).first { it.brandSlug == "a" }.representative.drinkKey shouldBe "hot-small"
        }
    }

    Given("matching names and decaf availability across brands") {
        val port = mockk<CafeDrinkRepositoryPort>()
        val basic = CafeDrinkResponse.of(cafeItem("a", "라떼").toDomain()).copy(drinkName = "라떼", drinkKey = "exact")
        val rows = listOf(basic, basic.copy(drinkName = "라떼모카", drinkKey = "prefix"),
            basic.copy(drinkName = "바닐라라떼", drinkKey = "contains"),
            basic.copy(drinkKey = "decaf", caffeineStatus = CaffeineStatus.DECAF),
            basic.copy(brandSlug = "b", drinkKey = "b"))
        every { port.search(any()) } answers { val q = firstArg<CafeDrinkQuery>(); CafeDrinkPage(rows, rows.size.toLong(), q.page, q.size) }
        every { port.variants("라떼") } returns rows.filter { it.drinkName == "라떼" }
        val service = CafeDrinkService(port)
        Then("one best menu represents each brand and facets ignore brand selection") {
            val result = service.grouped(CafeDrinkQuery(q = "라떼", brands = listOf("a")))
            result.content.map { it.drinkKey } shouldBe listOf("exact")
            result.brandGroups!!.single().menus.map { it.representative.drinkName } shouldBe listOf("라떼", "라떼모카", "바닐라라떼")
            result.brandCounts.size shouldBe 2
        }
        Then("decaf selects an actual decaf variant and counts excluded brands") {
            val result = service.grouped(CafeDrinkQuery(q = "라떼", caffeine = "decaf"))
            result.content.map { it.drinkKey } shouldBe listOf("decaf")
            result.excludedDecafBrandCount shouldBe 1
            service.compare("라떼", CafeDrinkQuery(caffeine = "decaf")).single().representative.drinkKey shouldBe "decaf"
        }
    }

    Given("a broad query where each cafe also has a shorter unrelated menu") {
        val port = mockk<CafeDrinkRepositoryPort>()
        val base = CafeDrinkResponse.of(cafeItem("a", "카페라떼").toDomain()).copy(drinkName = "카페라떼", drinkKey = "a-cafe")
        val rows = listOf(base, base.copy(drinkName = "숏라떼", drinkKey = "a-short"),
            base.copy(brandSlug = "b", brandName = "B", drinkKey = "b-cafe"), base.copy(brandSlug = "b", brandName = "B", drinkName = "꿀라떼", drinkKey = "b-honey"),
            base.copy(brandSlug = "c", brandName = "C", drinkName = "곡물라떼", drinkKey = "c-grain"))
        every { port.search(any()) } answers { val q = firstArg<CafeDrinkQuery>(); CafeDrinkPage(rows, rows.size.toLong(), q.page, q.size) }
        val service = CafeDrinkService(port)
        Then("the name most cafes share represents them and a cafe without it keeps its closest menu") {
            val result = service.grouped(CafeDrinkQuery(q = "라떼"))
            result.brandGroups!!.associate { it.brandSlug to it.menus.first().representative.drinkKey } shouldBe mapOf("a" to "a-cafe", "b" to "b-cafe", "c" to "c-grain")
        }
    }

})
