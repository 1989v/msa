package com.kgd.ads.domain.token.policy

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.string.shouldNotContain

class VisitorHashTest : BehaviorSpec({
    given("방문자 id") {
        `when`("해시하면") {
            then("같은 id 는 같은 값, 다른 id 는 다른 값이고 원문이 드러나지 않는다") {
                VisitorHash.of("vid-abc") shouldBe VisitorHash.of("vid-abc")
                VisitorHash.of("vid-abc") shouldNotBe VisitorHash.of("vid-abd")
                VisitorHash.of("vid-abc") shouldNotContain "vid-abc"
                VisitorHash.of("vid-abc").length shouldBe 32
            }
        }
    }
})
