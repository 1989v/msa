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

    Given("음식·쇼핑 계열 의도어") {
        // 이 화면은 관광지 검색이고 랭킹이 이미 음식·쇼핑을 내린다.
        // 유형/분류로 승격하면 그 정책을 뒤집어 음식점만 남는다 (실측 nDCG 0.4451 → 0.0356).
        val commerce = QueryIntent.Lexicon.of(
            listOf(
                Triple("SH06", 2, "시장"),
                Triple("EX060800", 3, "화장품/주류/먹거리"),
                Triple("NA020900", 3, "해변. 해수욕장"),
            ),
        )

        When("「전통시장 먹거리」") {
            val r = QueryIntent.analyze("전통시장 먹거리", commerce)

            Then("필터를 만들지 않는다") {
                r.hasFilter shouldBe false
            }
            Then("검색어로 남는다 — BM25 와 벡터가 쓴다") {
                r.residual shouldBe "전통시장 먹거리"
            }
        }

        When("「맛집」처럼 유형을 뒤집는 말이면") {
            Then("유형 필터가 안 걸린다") {
                QueryIntent.analyze("맛집", commerce).contentTypeId shouldBe null
            }
        }

        When("관광 분류는 그대로 걸린다") {
            Then("해수욕장은 필터가 된다") {
                QueryIntent.analyze("해수욕장", commerce).lclsCode shouldBe "NA020900"
            }
        }
    }

    Given("원천 이름이 동의어를 담고 있을 때") {
        // 실제 코드표 값들이다 — 손으로 만든 예가 아니다.
        val real = QueryIntent.Lexicon.of(
            listOf(
                Triple("NA020900", 3, "해변. 해수욕장"),
                Triple("NA020400", 3, "연못·늪"),
                Triple("NA020700", 3, "항구/포구"),
                Triple("NA02", 2, "자연경관(하천‧해양)"),
            ),
        )

        When("마침표로 이어 쓴 이름의 뒷말로 물으면") {
            Then("같은 코드로 간다 — 이름 전체로만 열쇠를 만들면 못 찾는다") {
                QueryIntent.analyze("해수욕장", real).lclsCode shouldBe "NA020900"
                QueryIntent.analyze("해변", real).lclsCode shouldBe "NA020900"
            }
        }

        When("가운뎃점·빗금으로 이어 쓴 이름이면") {
            Then("각 조각이 모두 열쇠가 된다") {
                QueryIntent.analyze("늪", real).lclsCode shouldBe "NA020400"
                QueryIntent.analyze("포구", real).lclsCode shouldBe "NA020700"
            }
        }

        When("괄호 안에 구분자가 있으면") {
            Then("각 조각이 열쇠가 된다") {
                QueryIntent.analyze("하천", real).lclsCode shouldBe "NA02"
                QueryIntent.analyze("해양", real).lclsCode shouldBe "NA02"
            }
        }

        When("괄호 안이 한정어면") {
            // `Inline Skating (Indoor)` 의 「Indoor」를 별칭으로 만들면
            // 「indoor activities」가 인라인스케이트 소분류로 필터돼 0건이 된다 (실측).
            val qualifier = QueryIntent.Lexicon.of(
                listOf(Triple("LS010100", 3, "Inline Skating (Indoor)"), Triple("NA01", 2, "자연경관(산)")),
            )

            Then("별칭으로 쓰지 않는다") {
                QueryIntent.analyze("indoor", qualifier).lclsCode shouldBe null
                QueryIntent.analyze("산", qualifier).lclsCode shouldBe null
            }
            Then("이름 전체로는 여전히 걸린다") {
                QueryIntent.analyze("inline skating (indoor)", qualifier).lclsCode shouldBe "LS010100"
            }
        }

        When("이름 전체로 물어도") {
            Then("여전히 걸린다") {
                QueryIntent.analyze("자연경관(하천‧해양)", real).lclsCode shouldBe "NA02"
            }
        }
    }

    Given("한영 이름을 한 사전에 넣었을 때") {
        // 원천이 같은 코드에 두 이름을 준다 — 손으로 쓰지 않은 한영 동의어다.
        val bilingual = QueryIntent.Lexicon.of(
            listOf(
                Triple("NA02", 2, "Natural Scenery (Rivers/Marine)"),
                Triple("NA02", 2, "자연경관(하천‧해양)"),
            ),
        )

        When("영문 이름으로 물어도") {
            Then("같은 코드로 간다 — 문서 언어와 무관하게 필터가 걸린다") {
                QueryIntent.analyze("natural scenery (rivers/marine)", bilingual).lclsCode shouldBe "NA02"
            }
        }

        When("한글 이름으로 물어도") {
            Then("같은 코드로 간다") {
                QueryIntent.analyze("자연경관(하천‧해양)", bilingual).lclsCode shouldBe "NA02"
            }
        }
    }

    Given("깊이가 같은 이름이 겹칠 때") {
        val ordered = QueryIntent.Lexicon.of(listOf(Triple("AA01", 2, "체험"), Triple("BB01", 2, "체험")))

        When("찾으면") {
            Then("나중에 넣은 것이 이긴다 — 호출자가 순서로 우선순위를 준다") {
                ordered.lookup("체험") shouldBe ("BB01" to 2)
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
