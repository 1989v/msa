package com.kgd.gateway

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldNotBe

class GatewayApplicationTest : StringSpec({
    "GatewayApplication class should be loadable" {
        GatewayApplication::class.java shouldNotBe null
    }
})
