package com.kgd.quant

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe

/**
 * ADR-0093 — quant 가 sideapp 에 폴드되면서 `@SpringBootApplication` 이 sideapp:app 으로 갔다.
 * 폴드된 feature 모듈은 Spring 컨텍스트 없이 단위 테스트만 둔다(order·product 와 같은 패턴).
 * 컨텍스트 로드 검증은 `SideappContextLoadSpec` 이 세 도메인을 한 번에 한다.
 */
class QuantApplicationTest : StringSpec({
    "application module loads" {
        true shouldBe true
    }
})
