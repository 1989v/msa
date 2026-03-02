package com.kgd.gateway

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe

class GatewayApplicationTest : StringSpec({
    "GatewayApplication exists" {
        GatewayApplication::class.simpleName shouldBe "GatewayApplication"
    }
})
