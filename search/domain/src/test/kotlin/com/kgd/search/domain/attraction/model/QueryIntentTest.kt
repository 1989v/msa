package com.kgd.search.domain.attraction.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class QueryIntentTest : BehaviorSpec({

    val lexicon = QueryIntent.Lexicon.of(
        listOf(
            Triple("NA", 1, "자연관광"),
            Triple("NA02", 2, "자연경관(하천‧해양)"),
            Triple("NA020100", 3, "해수욕장"),
            Triple("HS", 1, "역사관광"),
        ),
    )

    Given("의도어만으로 된 질의") {
        When("「아이와 갈만한 관광지」") {
            val r = QueryIntent.analyze("아이와 갈만한 관광지", lexicon)

            Then("「관광지」가 유형 필터가 된다") { r.contentTypeId shouldBe "12" }
            Then("「갈만한」은 지워진다") { r.residual shouldBe "아이와" }
            Then("검색어가 남아 있다 — 「아이와」는 지우지 않는다") { r.residualIsEmpty shouldBe false }
        }

        When("「가볼만한 곳 추천」처럼 전부 불용어면") {
            val r = QueryIntent.analyze("가볼만한 곳 추천", lexicon)

            Then("유형만 남고 검색어는 사라진다") {
                r.contentTypeId shouldBe "12"
                r.residualIsEmpty shouldBe true
            }
        }
    }

    Given("분류 이름이 섞인 질의") {
        When("「해수욕장」") {
            val r = QueryIntent.analyze("해수욕장", lexicon)

            Then("소분류 코드로 간다") {
                r.lclsCode shouldBe "NA020100"
                r.lclsDepth shouldBe 3
            }
            Then("검색어는 비고 필터만 남는다") { r.residualIsEmpty shouldBe true }
        }

        When("이름에 괄호·중점이 있어도") {
            val r = QueryIntent.analyze("자연경관(하천‧해양)", lexicon)

            Then("정규화해서 맞춘다") { r.lclsCode shouldBe "NA02" }
        }
    }

    Given("뜻이 있는 말") {
        When("「야경 명소」") {
            val r = QueryIntent.analyze("야경 명소", lexicon)

            Then("「명소」는 유형으로 가고 「야경」은 검색어로 남는다") {
                r.contentTypeId shouldBe "12"
                r.residual shouldBe "야경"
            }
        }

        When("아무 의도어도 없으면") {
            val r = QueryIntent.analyze("경복궁", lexicon)

            Then("원문 그대로 통과한다") {
                r.residual shouldBe "경복궁"
                r.hasFilter shouldBe false
            }
        }
    }

    Given("사전이 비어 있을 때") {
        When("분류 이름을 쳐도") {
            val r = QueryIntent.analyze("해수욕장", QueryIntent.Lexicon.EMPTY)

            Then("검색어로 남는다 — 사전이 없다고 질의를 잃지 않는다") {
                r.residual shouldBe "해수욕장"
                r.lclsCode shouldBe null
            }
        }
    }

    Given("같은 이름이 두 깊이에 있을 때") {
        val ambiguous = QueryIntent.Lexicon.of(listOf(Triple("VE", 1, "체험"), Triple("VE0101", 2, "체험")))

        When("찾으면") {
            Then("좁게 말하는 쪽(깊은 코드)이 이긴다") {
                ambiguous.lookup("체험") shouldBe ("VE0101" to 2)
            }
        }
    }
})
