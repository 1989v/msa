package com.kgd.ranking

import com.kgd.ranking.application.cafe.dto.CafeDrinkQuery
import com.kgd.ranking.domain.cafe.model.CaffeineStatus
import com.kgd.ranking.infrastructure.persistence.entity.CafeDrinkJpaEntity
import com.kgd.ranking.infrastructure.persistence.repository.CafeDrinkQueryRepository
import com.querydsl.jpa.impl.JPAQueryFactory
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.assertions.throwables.shouldThrow
import com.kgd.ranking.domain.cafe.model.CafeDrinkKey
import io.kotest.matchers.shouldBe
import org.hibernate.cfg.Configuration
import org.springframework.data.domain.PageRequest
import java.math.BigDecimal

/** Runs the real Querydsl predicates against a local SQL DB; no external service required. */
class CafeDrinkQueryRepositoryTest : BehaviorSpec({
    val factory = Configuration().addAnnotatedClass(CafeDrinkJpaEntity::class.java)
        .setProperty("hibernate.connection.driver_class", "org.h2.Driver")
        .setProperty("hibernate.connection.url", "jdbc:h2:mem:cafe;DB_CLOSE_DELAY=-1")
        .setProperty("hibernate.hbm2ddl.auto", "create-drop")
        .buildSessionFactory()
    val em = factory.createEntityManager()
    val repository = CafeDrinkQueryRepository(JPAQueryFactory(em))
    beforeSpec {
        em.transaction.begin()
        listOf(
            cafeItem("a", "일반 라떼").copy(sugarG = BigDecimal("20")),
            cafeItem("a", "디카페인 라떼", CaffeineStatus.DECAF).copy(sugarG = BigDecimal("10"), caffeineMg = BigDecimal("5")),
            cafeItem("b", "제로 라떼", CaffeineStatus.ZERO).copy(sugarG = BigDecimal.ZERO, caffeineMg = BigDecimal.ZERO),
            cafeItem("b", "미공개 라떼", CaffeineStatus.UNDISCLOSED).copy(sugarG = null, caffeineMg = null),
        ).forEach { em.persist(CafeDrinkJpaEntity.fromDomain(it.toDomain())) }
        em.transaction.commit()
        em.clear()
    }
    afterSpec { em.close(); factory.close() }
    Given("공개·0·디카페인·미공개 네 음료") {
        Then("카페인 없음은 ZERO+DECAF만 반환하고 미공개는 섞이지 않는다") {
            val result = repository.search(CafeDrinkQuery(caffeine = "none"), PageRequest.of(0, 50))
            result.totalElements shouldBe 2
            result.content.map { it.caffeineStatus }.toSet() shouldBe setOf(CaffeineStatus.ZERO, CaffeineStatus.DECAF)
        }
        Then("브랜드 복수와 메뉴 부분검색·상한·유형·온도를 함께 적용한다") {
            val query = CafeDrinkQuery(q = "라떼", brands = listOf("a", "b"), group = "라떼", temperature = "ICE", maxSugar = BigDecimal("10"), maxCaffeine = BigDecimal("5"))
            repository.search(query, PageRequest.of(0, 50)).totalElements shouldBe 2
            repository.search(query.copy(brands = listOf("a")), PageRequest.of(0, 50)).totalElements shouldBe 1
        }
        Then("100ml당 수치가 낮은 순이며 null은 뒤로 보내고 count는 페이지 제한이 없다") {
            val result = repository.search(CafeDrinkQuery(sort = "sugarPer100ml", page = 1, size = 2), PageRequest.of(1, 2))
            result.totalElements shouldBe 4
            result.content.map { it.menuName } shouldBe listOf("일반 라떼", "미공개 라떼")
            result.content.first().sugarPer100ml shouldBe BigDecimal("5.0000")
        }
        Then("공식 0과 디카페인은 분리하고 반복 상태는 합집합으로 필터한다") {
            repository.search(CafeDrinkQuery(caffeine = "zero"), PageRequest.of(0, 20)).content.map { it.caffeineStatus } shouldBe listOf(CaffeineStatus.ZERO)
            repository.search(CafeDrinkQuery(caffeine = "decaf"), PageRequest.of(0, 20)).content.map { it.caffeineStatus } shouldBe listOf(CaffeineStatus.DECAF)
            repository.search(CafeDrinkQuery(caffeineStatus = listOf(CaffeineStatus.ZERO, CaffeineStatus.DECAF)), PageRequest.of(0, 20)).totalElements shouldBe 2
            shouldThrow<IllegalArgumentException> { CafeDrinkQuery(caffeine = "none", caffeineStatus = listOf(CaffeineStatus.ZERO)) }
        }
        Then("안정 상세키는 동일 자연키 재적재와 무관하고 잘못된 키는 찾지 못한다") {
            val row = repository.search(CafeDrinkQuery(caffeine = "zero"), PageRequest.of(0, 20)).content.single()
            repository.find(row.drinkKey) shouldBe row
            repository.find("invalid") shouldBe null
            repository.find(CafeDrinkKey.of(cafeItem("deleted", "삭제 메뉴").toDomain())) shouldBe null
            val source = cafeItem("b", "제로 라떼", CaffeineStatus.ZERO).toDomain()
            CafeDrinkKey.of(source) shouldBe CafeDrinkKey.of(source.copy(sugarG = BigDecimal("99")))
        }
        Then("세 지표의 100ml 정렬은 기준을 적용하고 상한은 1회량으로 유지한다") {
            listOf("sugar", "caffeine", "kcal").forEach { metric ->
                val result = repository.search(CafeDrinkQuery(basis = "100ml", sort = metric), PageRequest.of(0, 20))
                result.totalElements shouldBe 4
                if (metric != "kcal") result.content.last().menuName shouldBe "미공개 라떼"
            }
            repository.search(CafeDrinkQuery(basis = "100ml", maxSugar = BigDecimal("5")), PageRequest.of(0, 20)).totalElements shouldBe 1
        }
        Then("normalized names aggregate distinct brands and all source rows") {
            repository.names("라떼").sumOf { it.rowCount } shouldBe 4L
            repository.names("제로").single().brandCount shouldBe 1
            repository.variants("제로라떼").single().menuName shouldBe "제로 라떼"
            repository.search(CafeDrinkQuery(direction = "desc"), PageRequest.of(0, 20)).content.last().menuName shouldBe "미공개 라떼"
        }
        Then("브랜드·유형별 집계는 행수와 출처·확인일을 반환한다") {
            repository.groups().single().count shouldBe 4
            repository.brands().map { it.count } shouldBe listOf(2L, 2L)
            repository.brands().first().sourceUrls shouldBe listOf("https://example.com/menu")
        }
    }
    Given("표시 반올림이 같고 용량이 없는 별도 변형") {
        Then("원래 비율로 전체 정렬하고 용량 없는 행을 남겨 마지막에 둔다") {
            em.transaction.begin()
            listOf(
                cafeItem("precision-a", "__precise A").copy(volumeMl = BigDecimal("100000"), sugarG = BigDecimal("1.0002"), caffeineMg = BigDecimal("1.0002"), kcal = BigDecimal("1.0002")),
                cafeItem("precision-b", "__precise B").copy(volumeMl = BigDecimal("100000"), sugarG = BigDecimal("1.0001"), caffeineMg = BigDecimal("1.0001"), kcal = BigDecimal("1.0001")),
                cafeItem("precision-c", "__precise C").copy(volumeMl = null, servingBasis = null, sizeLabel = null),
            ).forEach { em.persist(CafeDrinkJpaEntity.fromDomain(it.toDomain())) }
            em.transaction.commit()
            em.clear()
            try {
                listOf("sugar", "caffeine", "kcal").forEach { metric ->
                    val result = repository.search(CafeDrinkQuery(q = "__precise", sort = metric, basis = "100ml"), PageRequest.of(0, 20))
                    result.content.map { it.brandSlug } shouldBe listOf("precision-b", "precision-a", "precision-c")
                    result.content.last().sugarPer100ml shouldBe null
                    result.content.last().caffeinePer100ml shouldBe null
                    result.content.last().kcalPer100ml shouldBe null
                    val secondPage = repository.search(CafeDrinkQuery(q = "__precise", sort = metric, basis = "100ml", page = 1, size = 1), PageRequest.of(1, 1))
                    secondPage.totalElements shouldBe 3
                    secondPage.content.single().brandSlug shouldBe "precision-a"
                }
            } finally {
                em.transaction.begin()
                em.createQuery("delete from CafeDrinkJpaEntity where brandSlug like 'precision-%'").executeUpdate()
                em.transaction.commit()
                em.clear()
            }
        }
    }

    Given("undisclosed status with an otherwise numeric caffeine value") {
        Then("unavailable caffeine remains last for serving and concentration in both directions") {
            em.transaction.begin()
            listOf(
                cafeItem("status-a", "__status A").copy(caffeineMg = BigDecimal("100")),
                cafeItem("status-b", "__status B").copy(caffeineMg = BigDecimal("200")),
                cafeItem("status-c", "__status C", CaffeineStatus.UNDISCLOSED).copy(caffeineMg = BigDecimal.ZERO),
            ).forEach { em.persist(CafeDrinkJpaEntity.fromDomain(it.toDomain())) }
            em.transaction.commit(); em.clear()
            try {
                listOf("serving", "100ml").forEach { basis ->
                    repository.search(CafeDrinkQuery(q = "__status", sort = "caffeine", basis = basis), PageRequest.of(0, 20))
                        .content.map { it.brandSlug } shouldBe listOf("status-a", "status-b", "status-c")
                    repository.search(CafeDrinkQuery(q = "__status", sort = "caffeine", basis = basis, direction = "desc"), PageRequest.of(0, 20))
                        .content.map { it.brandSlug } shouldBe listOf("status-b", "status-a", "status-c")
                }
            } finally {
                em.transaction.begin()
                em.createQuery("delete from CafeDrinkJpaEntity where brandSlug like 'status-%'").executeUpdate()
                em.transaction.commit(); em.clear()
            }
        }
    }
    Given("EX variants across temperatures, source names and brands") {
        Then("autocomplete consolidates all source rows with one normalized name") {
            em.transaction.begin()
            listOf(cafeItem("ex-a", "(EX) HOT 연유 카페 라떼"), cafeItem("ex-a", "(EX) ICED 연유 카페 라떼"),
                cafeItem("ex-b", "연유 카페 라떼 (EX)")).forEach { em.persist(CafeDrinkJpaEntity.fromDomain(it.toDomain())) }
            em.transaction.commit(); em.clear()
            try {
                val name = repository.names("연유 카페 라떼").single()
                name.drinkName shouldBe "연유카페라떼"
                name.brandCount shouldBe 2
                name.rowCount shouldBe 3L
                repository.variants(name.drinkName).size shouldBe 3
            } finally {
                em.transaction.begin()
                em.createQuery("delete from CafeDrinkJpaEntity where brandSlug like 'ex-%'").executeUpdate()
                em.transaction.commit(); em.clear()
            }
        }
    }

})
