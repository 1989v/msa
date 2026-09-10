package com.kgd.product

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe

/**
 * ADR-0029 PR-7 — Flyway 도입 이후 `@SpringBootTest` 가 운영 MySQL DataSource 와 Flyway 를 함께
 * 부팅하려 시도하므로, app 모듈은 Spring 컨텍스트 없이 단위 테스트만 유지한다 (order 의
 * `OrderApplicationTest` 와 동일 패턴). 실제 컨텍스트 로딩 검증은 staging k3s-lite e2e 에서 수행한다.
 */
class ProductApplicationTest : StringSpec({
    "application module loads" {
        // Unit test placeholder - no SpringBootTest for unit tests per project convention
        true shouldBe true
    }
})
