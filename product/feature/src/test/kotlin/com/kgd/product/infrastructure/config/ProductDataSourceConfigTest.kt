package com.kgd.product.infrastructure.config

import io.kotest.core.spec.style.BehaviorSpec
import io.mockk.mockk
import io.mockk.verify
import jakarta.persistence.EntityManagerFactory

/**
 * 앱 수명의 EntityManager 는 JDBC 커넥션 하나를 영영 쥔다 — MySQL 이 8시간 뒤 끊으면 그 뒤로는
 * 모든 상품 조회가 `Connection is closed` 다(2026-09-14~17 실제 장애). 쿼리 팩토리는 트랜잭션에
 * 묶인 공유 EntityManager 로만 만든다: 배선 시점에는 EntityManager 를 하나도 열지 않는다.
 */
class ProductDataSourceConfigTest : BehaviorSpec({
    given("product EntityManagerFactory") {
        val emf = mockk<EntityManagerFactory>(relaxed = true)

        `when`("productJpaQueryFactory 를 만들면") {
            ProductDataSourceConfig().productJpaQueryFactory(emf)

            then("EntityManager 를 열지 않는다 — 트랜잭션마다 빌려 쓴다") {
                verify(exactly = 0) { emf.createEntityManager() }
                verify(exactly = 0) { emf.createEntityManager(any<Map<String, Any>>()) }
            }
        }
    }
})
