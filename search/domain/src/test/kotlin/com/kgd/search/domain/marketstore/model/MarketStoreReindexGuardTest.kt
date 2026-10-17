package com.kgd.search.domain.marketstore.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.assertions.throwables.shouldThrow

class MarketStoreReindexGuardTest : BehaviorSpec({
    given("market-store completeness") {
        then("exactly 5 percent is accepted") { MarketStoreReindexGuard.check(1, 20) }
        then("above 5 percent fails") { shouldThrow<IllegalStateException> { MarketStoreReindexGuard.check(1, 19) } }
        then("empty run fails") { shouldThrow<IllegalStateException> { MarketStoreReindexGuard.check(0, 0) } }
    }
})
