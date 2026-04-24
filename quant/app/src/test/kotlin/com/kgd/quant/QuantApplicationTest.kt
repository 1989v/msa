package com.kgd.quant

import io.kotest.core.spec.style.StringSpec
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles

@SpringBootTest
@ActiveProfiles("test")
class QuantApplicationTest : StringSpec({
    "context loads" {}
})
