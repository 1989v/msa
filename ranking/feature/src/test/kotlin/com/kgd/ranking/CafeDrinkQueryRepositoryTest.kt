package com.kgd.ranking

import com.kgd.ranking.application.cafe.dto.CafeDrinkQuery
import com.kgd.ranking.domain.cafe.model.CaffeineStatus
import com.kgd.ranking.infrastructure.persistence.entity.CafeDrinkJpaEntity
import com.kgd.ranking.infrastructure.persistence.repository.CafeDrinkQueryRepository
import com.querydsl.jpa.impl.JPAQueryFactory
import io.kotest.core.spec.style.BehaviorSpec
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
        Then("브랜드·유형별 집계는 행수와 출처·확인일을 반환한다") {
            repository.groups().single().count shouldBe 4
            repository.brands().map { it.count } shouldBe listOf(2L, 2L)
            repository.brands().first().sourceUrls shouldBe listOf("https://example.com/menu")
        }
    }
})
