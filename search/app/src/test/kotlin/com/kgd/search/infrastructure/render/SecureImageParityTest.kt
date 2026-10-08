package com.kgd.search.infrastructure.render

import com.kgd.search.domain.attraction.model.AttractionSeoText
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldHaveAtLeastSize
import io.kotest.matchers.shouldBe
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper

/**
 * 서버 사진 주소 규칙 ≡ 화면 사진 주소 규칙.
 *
 * 기대값은 `portal-fe/src/seo/__tests__/secureImageUrl.test.ts` 가 copy.mjs `secureImageUrl` 의 **출력**으로
 * 쓴 골든이다. 같은 입력을 [AttractionSeoText.secureImageUrl] 에 넣어 비교한다. CI 가 골든을 다시 만들어
 * `git diff`·`git status` 로 막으므로, copy.mjs 만 바뀌면 거기서, 서버만 바뀌면 여기서 빨개진다.
 */
class SecureImageParityTest : BehaviorSpec({

    val mapper = ObjectMapper()
    val golden = mapper.readTree(
        SecureImageParityTest::class.java.getResourceAsStream("/render/secure-image-golden.json")!!.readAllBytes(),
    )

    fun JsonNode.text(field: String): String? = get(field)?.takeUnless { it.isNull }?.asString()

    given("copy.mjs 가 만든 사진 주소 골든") {
        val cases = (0 until golden["cases"].size()).map { golden["cases"][it] }

        then("바뀌는 사례와 그대로인 사례가 둘 다 있다") {
            cases.filter { it.text("input") != it.text("expected") } shouldHaveAtLeastSize 1
            cases.filter { it.text("input") == it.text("expected") } shouldHaveAtLeastSize 1
        }

        cases.forEach { case ->
            then(case.text("name")!!) {
                AttractionSeoText.secureImageUrl(case.text("input")) shouldBe case.text("expected")
            }
        }
    }
})
