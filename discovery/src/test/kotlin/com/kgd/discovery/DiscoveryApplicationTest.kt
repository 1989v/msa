package com.kgd.discovery

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldNotBe
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.test.context.ActiveProfiles

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class DiscoveryApplicationTest(
    @LocalServerPort private val port: Int
) : BehaviorSpec({

    given("Discovery 서비스 기동 시") {
        `when`("Spring 컨텍스트가 로드되면") {
            then("서비스가 정상적으로 기동되어야 한다") {
                port shouldNotBe 0
            }
        }
    }
})
