package com.kgd.search.domain.query.model

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

            Then("「관광지」가 유형 필터가 된다") { r.facets["contentTypeId"] shouldBe "12" }
            Then("「갈만한」은 지워진다") { r.residual shouldBe "아이와" }
            Then("검색어가 남아 있다 — 「아이와」는 지우지 않는다") { r.residualIsEmpty shouldBe false }
        }

        When("「가볼만한 곳 추천」처럼 전부 불용어면") {
            val r = QueryIntent.analyze("가볼만한 곳 추천", lexicon)

            Then("유형만 남고 검색어는 사라진다") {
                r.facets["contentTypeId"] shouldBe "12"
                r.residualIsEmpty shouldBe true
            }
        }
    }

    Given("분류 이름이 섞인 질의") {
        When("「해수욕장」") {
            val r = QueryIntent.analyze("해수욕장", lexicon)

            Then("소분류 코드로 간다") {
                r.facets["lclsSystm3"] shouldBe "NA020100"
            }
            Then("검색어는 비고 필터만 남는다") { r.residualIsEmpty shouldBe true }
        }

        When("이름에 괄호·중점이 있어도") {
            val r = QueryIntent.analyze("자연경관(하천‧해양)", lexicon)

            Then("정규화해서 맞춘다") { r.facets["lclsSystm2"] shouldBe "NA02" }
        }
    }

    Given("뜻이 있는 말") {
        When("「야경 명소」") {
            val r = QueryIntent.analyze("야경 명소", lexicon)

            Then("「명소」는 유형으로 가고 「야경」은 검색어로 남는다") {
                r.facets["contentTypeId"] shouldBe "12"
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
                r.hasFilter shouldBe false
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
                QueryIntent.analyze("맛집", commerce).facets["contentTypeId"] shouldBe null
            }
        }

        When("관광 분류는 그대로 걸린다") {
            Then("해수욕장은 필터가 된다") {
                QueryIntent.analyze("해수욕장", commerce).facets["lclsSystm3"] shouldBe "NA020900"
            }
            Then("상업 의도가 아니다 — 랭킹 하향은 그대로 둔다") {
                QueryIntent.analyze("해수욕장", commerce).commerceIntent shouldBe false
            }
        }

        When("질의가 상점·시장을 직접 가리키면") {
            // 「야시장」의 정답은 전부 shopping 인데 상업 하향(0.35)이 잡음 아래로 내린다 (실측 0.681 → 0.030).
            Then("필터는 안 만들되 상업 의도를 표시한다") {
                val r = QueryIntent.analyze("야시장", commerce)
                r.hasFilter shouldBe false
                r.residual shouldBe "야시장"
                r.commerceIntent shouldBe true
            }
            Then("어절 끝이 market 이거나 대여·rental 이면 같다") {
                QueryIntent.analyze("night market", commerce).commerceIntent shouldBe true
                QueryIntent.analyze("hanbok rental", commerce).commerceIntent shouldBe true
                QueryIntent.analyze("한복 대여", commerce).commerceIntent shouldBe true
            }
            Then("음식어가 섞이면 상점 의도로 치지 않는다 — 먹거리촌은 culture 라 하향이 있어야 올라온다") {
                QueryIntent.analyze("전통시장 먹거리", commerce).commerceIntent shouldBe false
                QueryIntent.analyze("맛집", commerce).commerceIntent shouldBe false
            }
            Then("사전이 쇼핑 코드로 보내는 말은 상점 의도다") {
                QueryIntent.analyze("시장 구경", commerce).commerceIntent shouldBe true
            }
        }
    }

    Given("산업관광(EX06) 소분류 이름") {
        // 실제 코드표 값이다. 동의어 나열이 아니라 산업 나열이라 조각이 일반어를 가로챈다 —
        // 「traditional market food」가 EX060300 으로 좁혀져 0건 (실측).
        val industrial = QueryIntent.Lexicon.of(
            listOf(
                Triple("EX060300", 3, "Traditional / Local"),
                Triple("EX060600", 3, "자동차/조선/철강 등"),
                Triple("EX050100", 3, "온천 / 사우나 / 스파"),
            ),
        )

        When("조각으로 물으면") {
            Then("필터가 안 걸리고 검색어로 남는다") {
                val r = QueryIntent.analyze("traditional market food", industrial)
                r.hasFilter shouldBe false
                r.residual shouldBe "traditional market food"
                QueryIntent.analyze("조선 궁궐", industrial).hasFilter shouldBe false
            }
        }
        When("이름 전체로 물으면") {
            Then("여전히 걸린다") {
                QueryIntent.analyze("traditional / local", industrial).facets["lclsSystm3"] shouldBe "EX060300"
            }
        }
        When("산업관광 밖의 나열형 이름은") {
            Then("조각도 별칭이다") {
                QueryIntent.analyze("사우나", industrial).facets["lclsSystm3"] shouldBe "EX050100"
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
                QueryIntent.analyze("해수욕장", real).facets["lclsSystm3"] shouldBe "NA020900"
                QueryIntent.analyze("해변", real).facets["lclsSystm3"] shouldBe "NA020900"
            }
        }

        When("가운뎃점·빗금으로 이어 쓴 이름이면") {
            Then("각 조각이 모두 열쇠가 된다") {
                QueryIntent.analyze("늪", real).facets["lclsSystm3"] shouldBe "NA020400"
                QueryIntent.analyze("포구", real).facets["lclsSystm3"] shouldBe "NA020700"
            }
        }

        When("괄호 안에 구분자가 있으면") {
            Then("각 조각이 열쇠가 된다") {
                QueryIntent.analyze("하천", real).facets["lclsSystm2"] shouldBe "NA02"
                QueryIntent.analyze("해양", real).facets["lclsSystm2"] shouldBe "NA02"
            }
        }

        When("괄호 안이 한정어면") {
            // `Inline Skating (Indoor)` 의 「Indoor」를 별칭으로 만들면
            // 「indoor activities」가 인라인스케이트 소분류로 필터돼 0건이 된다 (실측).
            val qualifier = QueryIntent.Lexicon.of(
                listOf(Triple("LS010100", 3, "Inline Skating (Indoor)"), Triple("NA01", 2, "자연경관(산)")),
            )

            Then("별칭으로 쓰지 않는다") {
                QueryIntent.analyze("indoor", qualifier).facets["lclsSystm3"] shouldBe null
                QueryIntent.analyze("산", qualifier).hasFilter shouldBe false
            }
            Then("이름 전체로는 여전히 걸린다") {
                QueryIntent.analyze("inline skating (indoor)", qualifier).facets["lclsSystm3"] shouldBe "LS010100"
            }
        }

        When("이름 전체로 물어도") {
            Then("여전히 걸린다") {
                QueryIntent.analyze("자연경관(하천‧해양)", real).facets["lclsSystm2"] shouldBe "NA02"
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
                QueryIntent.analyze("natural scenery (rivers/marine)", bilingual).facets["lclsSystm2"] shouldBe "NA02"
            }
        }

        When("한글 이름으로 물어도") {
            Then("같은 코드로 간다") {
                QueryIntent.analyze("자연경관(하천‧해양)", bilingual).facets["lclsSystm2"] shouldBe "NA02"
            }
        }
    }

    Given("깊이가 같은 이름이 겹칠 때") {
        val ordered = QueryIntent.Lexicon.of(listOf(Triple("AA01", 2, "체험"), Triple("BB01", 2, "체험")))

        When("찾으면") {
            Then("나중에 넣은 것이 이긴다 — 호출자가 순서로 우선순위를 준다") {
                ordered.lookup("체험") shouldBe QueryIntent.Facet("lclsSystm2", "BB01")
            }
        }
    }

    Given("같은 이름이 두 깊이에 있을 때") {
        val ambiguous = QueryIntent.Lexicon.of(listOf(Triple("VE", 1, "체험"), Triple("VE0101", 2, "체험")))

        When("찾으면") {
            Then("좁게 말하는 쪽(깊은 코드)이 이긴다") {
                ambiguous.lookup("체험") shouldBe QueryIntent.Facet("lclsSystm2", "VE0101")
            }
        }
    }

    Given("타입 의도어 — 통합 검색의 대상 (searchTypes = true)") {
        When("「블로그 하이브리드 검색」") {
            val r = QueryIntent.analyze("블로그 하이브리드 검색", lexicon, searchTypes = true)
            Then("대상은 블로그 글이고 검색어에서 빠진다") {
                r.type shouldBe QueryIntent.Types.BLOG_POST
                r.residual shouldBe "하이브리드 검색"
                r.hasFilter shouldBe false
            }
        }
        When("「관광지 야경」") {
            val r = QueryIntent.analyze("관광지 야경", lexicon, searchTypes = true)
            Then("대상은 관광지, 그 안의 유형 필터도 같이 걸린다") {
                r.type shouldBe QueryIntent.Types.ATTRACTION
                r.facets shouldBe mapOf("contentTypeId" to "12")
                r.residual shouldBe "야경"
            }
        }
        When("타입 의도어가 없으면") {
            Then("대상은 null — 통합 검색은 전 타입을 본다") {
                QueryIntent.analyze("해수욕장", lexicon, searchTypes = true).type shouldBe null
            }
        }
        When("「game」 처럼 영어로 써도") {
            Then("같은 타입이다") {
                QueryIntent.analyze("puzzle game", lexicon, searchTypes = true).type shouldBe QueryIntent.Types.GAME
            }
        }
        When("대상이 정해진 화면(관광지 검색)에서는") {
            Then("「게임」을 대상 지시로 읽지 않는다 — 검색어로 남는다") {
                val r = QueryIntent.analyze("보드 게임 카페", lexicon)
                r.type shouldBe null
                r.residual shouldBe "보드 게임 카페"
            }
            Then("「관광지」의 유형 필터는 그대로 걸린다") {
                QueryIntent.analyze("관광지 야경", lexicon).facets shouldBe mapOf("contentTypeId" to "12")
            }
        }
    }

    Given("실내·실외 의도어") {
        When("「실내」·「indoor」만 치면") {
            Then("실내 필터가 되고 검색어는 남지 않는다") {
                listOf("실내", "indoor").forEach {
                    val u = QueryIntent.analyze(it)
                    u.facets[QueryIntent.SETTING_FIELD] shouldBe "indoor"
                    u.residual shouldBe null
                }
            }
        }
        When("「비 오는 날」을 띄어 쓰거나 조사를 붙여도") {
            Then("실내 필터가 되고 나머지 말만 검색어로 남는다") {
                listOf("비 오는 날 가볼만한 곳", "비가 오는 날 서울", "비 올 때 부산").forEach {
                    QueryIntent.analyze(it).facets[QueryIntent.SETTING_FIELD] shouldBe "indoor"
                }
                QueryIntent.analyze("비가 오는 날 서울").residual shouldBe "서울"
            }
        }
        When("「rainy day」 두 어절이면") {
            Then("실내 필터가 된다") {
                QueryIntent.analyze("rainy day seoul").facets[QueryIntent.SETTING_FIELD] shouldBe "indoor"
            }
        }
        When("「비빔밥」처럼 비로 시작하는 다른 말이면") {
            Then("필터를 만들지 않는다") {
                QueryIntent.analyze("비빔밥 맛집").facets[QueryIntent.SETTING_FIELD] shouldBe null
            }
        }
    }

    Given("띄어 쓴 불용구 — 어절 창 1~3") {
        // 관광지 경로로 부른다(attractionOnly) — 화면이 실제로 부르는 모양이다.
        fun place(q: String, lang: String = "ko") = QueryIntent.analyze(q, lexicon, lang = lang, attractionOnly = true)

        When("「아이랑 갈 만한 곳」") {
            Then("「갈 만한」·「곳」이 지워지고 「아이랑」만 남는다") { place("아이랑 갈 만한 곳").residual shouldBe "아이랑" }
        }
        When("「아이와 갈만한 곳」") {
            Then("붙여 쓴 것도 같다") { place("아이와 갈만한 곳").residual shouldBe "아이와" }
        }
        When("「부모님과 가기 좋은 곳」") {
            Then("「가기 좋은 곳」이 지워진다") { place("부모님과 가기 좋은 곳").residual shouldBe "부모님과" }
        }
        When("「가볼 만한 곳」") {
            val r = place("가볼 만한 곳")
            Then("세 어절 창이 유형 의도로 맞는다") {
                r.residual shouldBe null
                r.facets shouldBe mapOf("contentTypeId" to "12")
            }
        }
        When("「winter trip」(en)") {
            Then("영문 불용어 trip 이 지워진다") { place("winter trip", "en").residual shouldBe "winter" }
        }
        When("「things to do in busan」(en)") {
            Then("세 어절 영문 불용구도 지워진다") { place("things to do busan", "en").residual shouldBe "busan" }
        }
        When("「비 오는 날 갈만한 곳」") {
            val r = place("비 오는 날 갈만한 곳")
            Then("기존처럼 실내 필터만 남는다") {
                r.residual shouldBe null
                r.facets[QueryIntent.SETTING_FIELD] shouldBe "indoor"
            }
        }
        When("「야경 명소」") {
            Then("뜻이 있는 「야경」은 남는다") { place("야경 명소").residual shouldBe "야경" }
        }
        When("「갈 수 있는 곳」이 섞이면") {
            Then("「갈 수 있는」도 불용구다") { place("서울 갈 수 있는 곳").residual shouldBe "서울" }
        }
    }

    Given("통합 검색 경로(attractionOnly = false)") {
        When("「travel」·「place」") {
            Then("관광지 전용 영문 불용어는 지우지 않는다 — 다른 타입 결과가 통째로 바뀐다") {
                QueryIntent.analyze("travel", lexicon, searchTypes = true, lang = "en").residual shouldBe "travel"
                QueryIntent.analyze("place", lexicon, searchTypes = true, lang = "en").residual shouldBe "place"
            }
        }
        When("띄어 쓴 한국어 불용구") {
            Then("어절 창은 두 경로 공통이다") {
                QueryIntent.analyze("아이랑 갈 만한 곳", lexicon, searchTypes = true).residual shouldBe "아이랑"
            }
        }
    }

    Given("내용 없는 입력") {
        When("자모만인 「ㅁㄴㅇㄹ」") {
            Then("noContent 다") { QueryIntent.analyze("ㅁㄴㅇㄹ", attractionOnly = true).noContent shouldBe true }
        }
        When("기호만인 입력") {
            Then("noContent 다") { QueryIntent.analyze("ㅋㅋ !!", attractionOnly = true).noContent shouldBe true }
        }
        When("자모 뒤에 완성형이 붙은 「ㄱ경복궁」") {
            Then("noContent 가 아니다") { QueryIntent.analyze("ㄱ경복궁", attractionOnly = true).noContent shouldBe false }
        }
        When("라틴·숫자가 있으면") {
            Then("noContent 가 아니다") {
                QueryIntent.analyze("qwxzv", attractionOnly = true).noContent shouldBe false
                QueryIntent.analyze("63", attractionOnly = true).noContent shouldBe false
            }
        }
    }

    Given("조건어 → 속성 축 (관광지 경로)") {

        fun place(q: String, lang: String = "ko", skip: Set<QueryIntent.ConditionKind> = emptySet(), words: Boolean = true) =
            QueryIntent.analyze(q, lexicon, lang = lang, attractionOnly = true, conditionWords = words, skipConditions = skip)

        When("「주차 되는 해수욕장」") {
            val r = place("주차 되는 해수욕장")
            Then("주차 조건과 분류 필터가 되고 검색어는 남지 않는다") {
                r.conditions shouldBe listOf(QueryIntent.Condition(QueryIntent.ConditionKind.PARKING, "주차 되는"))
                r.facets["lclsSystm3"] shouldBe "NA020100"
                r.residual shouldBe null
            }
        }
        When("「주차가 되는 해수욕장」 — 머리말에 조사 「가」") {
            val r = place("주차가 되는 해수욕장")
            Then("조사를 떼고 같은 조건이 된다") {
                r.conditions.map { it.kind } shouldBe listOf(QueryIntent.ConditionKind.PARKING)
                r.conditions.single().phrase shouldBe "주차가 되는"
                r.residual shouldBe null
            }
        }
        When("「주차 되는 반려견 동반 해수욕장」 — 조건 둘") {
            val r = place("주차 되는 반려견 동반 해수욕장")
            Then("둘 다 옮기고 검색어는 남지 않는다") {
                r.conditions.map { it.kind } shouldBe listOf(QueryIntent.ConditionKind.PARKING, QueryIntent.ConditionKind.PET)
                r.residual shouldBe null
            }
        }
        When("「반려견과 함께 갈 수 있는 곳」") {
            val r = place("반려견과 함께 갈 수 있는 곳")
            Then("반려동물 동반(ALLOWED·PARTIAL)이 되고 검색어는 남지 않는다") {
                r.conditions.single().kind shouldBe QueryIntent.ConditionKind.PET
                r.conditions.single().values shouldBe setOf("ALLOWED", "PARTIAL")
                r.residual shouldBe null
            }
        }
        When("「무료로 볼 수 있는 곳」") {
            val r = place("무료로 볼 수 있는 곳")
            Then("다음 말을 불용구가 가져가므로 무료 입장이다") {
                r.conditions.map { it.kind } shouldBe listOf(QueryIntent.ConditionKind.ADMISSION)
                r.residual shouldBe null
            }
        }
        When("「무료 박물관」") {
            val r = place("무료 박물관")
            Then("다음 말이 유형 의도라 무료 입장이고 유형 필터도 걸린다") {
                r.conditions.map { it.kind } shouldBe listOf(QueryIntent.ConditionKind.ADMISSION)
                r.facets shouldBe mapOf("contentTypeId" to "14")
                r.residual shouldBe null
            }
        }
        When("「무료 셔틀」") {
            val r = place("무료 셔틀")
            Then("무료 단독 제한 — 조건 없이 검색어 그대로") {
                r.conditions shouldBe emptyList()
                r.residual shouldBe "무료 셔틀"
            }
        }
        When("「주차 무료 해수욕장」") {
            val r = place("주차 무료 해수욕장")
            Then("주차가 먼저 무료를 꼬리말로 가져간다 — 무료 입장은 없다") {
                r.conditions shouldBe listOf(QueryIntent.Condition(QueryIntent.ConditionKind.PARKING, "주차 무료"))
                r.residual shouldBe null
            }
        }
        When("「무료 주차장」") {
            val r = place("무료 주차장")
            Then("주차 꼬리말도 없고 무료 입장도 아니다 — 검색어 그대로") {
                r.conditions shouldBe emptyList()
                r.residual shouldBe "무료 주차장"
            }
        }
        When("「반려견 놀이터」") {
            val r = place("반려견 놀이터")
            Then("꼬리말이 없으면 조건이 아니다") {
                r.conditions shouldBe emptyList()
                r.residual shouldBe "반려견 놀이터"
            }
        }
        When("부정어가 붙으면") {
            Then("「반려동물 동반 불가」는 조건 없이 검색어 그대로") {
                val r = place("반려동물 동반 불가")
                r.conditions shouldBe emptyList()
                r.residual shouldBe "반려동물 동반 불가"
            }
            Then("「카드 결제 안 되는 곳」도 조건 없이 부정어까지 검색어로 남는다") {
                val r = place("카드 결제 안 되는 곳")
                r.conditions shouldBe emptyList()
                r.residual shouldBe "카드 결제 안 되는"
            }
        }
        When("en 「pet friendly」") {
            val r = place("pet friendly", lang = "en")
            Then("조건 없이 검색어 그대로") {
                r.conditions shouldBe emptyList()
                r.residual shouldBe "pet friendly"
            }
        }
        When("en 요청에 ko 전용 행의 말(「반려견 동반」·「유모차 대여」)") {
            Then("언어 열에 없어 옮기지 않는다 — en 원천에 값이 없어 늘 0건이 된다") {
                place("반려견 동반", lang = "en").conditions shouldBe emptyList()
                place("유모차 대여", lang = "en").residual shouldBe "유모차 대여"
            }
            Then("ko 요청이면 옮긴다") {
                place("반려견 동반").conditions.map { it.kind } shouldBe listOf(QueryIntent.ConditionKind.PET)
                place("유모차 대여").conditions.map { it.kind } shouldBe listOf(QueryIntent.ConditionKind.STROLLER_RENTAL)
            }
        }
        When("en 「free admission museum」") {
            val r = place("free admission museum", lang = "en")
            Then("무료 입장이다") {
                r.conditions.map { it.kind } shouldBe listOf(QueryIntent.ConditionKind.ADMISSION)
                r.conditions.single().phrase shouldBe "free admission"
            }
        }
        When("조건어 추출을 끄면(conditionWords = false — 해제·스위치·행사 분류)") {
            val r = place("주차 되는 해수욕장", words = false)
            Then("조건 없이 조건어가 검색어로 남는다") {
                r.conditions shouldBe emptyList()
                r.residual shouldBe "주차 되는"
            }
            Then("근거 잔여에서는 조건어 어절이 빠진다") { r.evidenceResidual shouldBe null }
        }
        When("한 축만 건너뛰면(skipConditions = PARKING)") {
            val r = place("주차 되는 반려견 동반 해수욕장", skip = setOf(QueryIntent.ConditionKind.PARKING))
            Then("주차만 빠지고 그 어절은 검색어로 남는다") {
                r.conditions.map { it.kind } shouldBe listOf(QueryIntent.ConditionKind.PET)
                r.residual shouldBe "주차 되는"
                r.evidenceResidual shouldBe null
            }
        }
        When("휠체어·카드") {
            Then("「휠체어 가능」·「카드결제 가능한 카페」") {
                place("휠체어 가능").conditions.map { it.kind } shouldBe listOf(QueryIntent.ConditionKind.BARRIER_FREE)
                place("카드 결제 되는 곳").conditions.map { it.kind } shouldBe listOf(QueryIntent.ConditionKind.CREDIT_CARD)
            }
            Then("붙여 쓴 「주차가능」도 머리말+꼬리말이다") {
                place("주차가능 해수욕장").conditions.map { it.kind } shouldBe listOf(QueryIntent.ConditionKind.PARKING)
            }
        }
        When("통합 검색 경로(attractionOnly = false)의 「카드 결제 할인」") {
            val r = QueryIntent.analyze("카드 결제 할인", lexicon, searchTypes = true)
            Then("조건 없이 잔여 그대로") {
                r.conditions shouldBe emptyList()
                r.residual shouldBe "카드 결제 할인"
            }
        }
        When("근거 잔여") {
            Then("「무료 셔틀」은 머리말 무료를 빼고 「셔틀」만 근거를 요구한다") {
                place("무료 셔틀").evidenceResidual shouldBe "셔틀"
            }
            Then("조건어가 없으면 잔여와 같다") { place("에펠탑").evidenceResidual shouldBe "에펠탑" }
        }
        When("한정 판정(narrowsByIntent)") {
            Then("조건만 있어도 참이고 hasFilter 는 그대로 거짓이다") {
                val r = place("반려견 동반")
                r.narrowsByIntent shouldBe true
                r.hasFilter shouldBe false
            }
        }
    }
})
