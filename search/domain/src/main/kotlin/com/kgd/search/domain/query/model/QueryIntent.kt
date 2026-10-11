package com.kgd.search.domain.query.model

import com.kgd.search.domain.attraction.model.Admission
import com.kgd.search.domain.attraction.model.AttributeSelection
import com.kgd.search.domain.attraction.model.Availability

/**
 * 쿼리 언더스탠딩 — 의도어를 **검색어에서 빼서 필터로 옮긴다** (ADR-0090 개정).
 *
 * 왜 필요한가: 형태소 분석기는 「아이와 갈만한 관광지」를 `아이·와·갈만·하·ㄴ·관광·지` 로 쪼개고,
 * BM25 는 그 조각을 전부 내용어로 채점한다. 그래서 `아이`+`와` 가 「아이와즈」에 걸리고
 * `관광` 이 「관광특구」를 `title^3` 으로 끌어올린다 — 뜻이 아니라 글자가 이긴다.
 *
 * **벡터 레그에는 적용하지 않는다.** 문장의 뜻이 그 레그의 전부라, 잘라내면 지금 잘 하는 것을 망친다.
 * 자르는 대상은 BM25 레그뿐이고, 이 클래스는 그 잔여 검색어와 필터를 만든다.
 *
 * 의도는 네 갈래로 나간다.
 * - **타입 의도**(「블로그」·「게임」·「관광지」)는 검색 대상 [Understood.type] 이 된다 — 통합 검색이 쓴다.
 * - **분류 의도**는 [Understood.facets] (인덱스 필드 → 값) 가 된다. 유형(`관광지`→`contentTypeId=12`)은 원천이
 *   정한 뜻이라 코드에 두고, 분류(`해수욕장`→`lclsSystm3=NA020100`)는 원천 코드표에서 온다 — 손으로 쓰면
 *   원천이 분류를 늘릴 때마다 배포해야 한다.
 * - **상업 의도**는 필터가 아니라 랭킹 스위치다 ([Understood.commerceIntent]).
 * - **조건 의도**(「주차 되는」·「반려견 동반」)는 허브 칩과 같은 속성 선택 [Understood.conditions] 가 된다 — 관광지 경로만.
 *   머리말과 꼬리말이 함께 있어야 하고 부정어가 붙으면 옮기지 않는다. API 이름(`parking=YES`)은 presentation 이 정한다.
 */
object QueryIntent {

    /** 통합 검색의 문서 타입 — wishlist 의 대상 타입과 이름을 맞춘다. */
    object Types {
        const val ATTRACTION = "attraction"
        const val BLOG_POST = "blog_post"
        const val GAME = "game"
        const val CONCEPT = "concept"
        const val PRODUCT = "product"
        const val DEAL_OFFER = "deal_offer"
        const val SERVICE = "service"
    }

    /**
     * 검색 대상을 고르는 말. 통합 검색에서 `type` 필터가 되고, 관광지 검색처럼 대상이 정해진 화면에서는 무시된다.
     * 「관광지」는 여기서 대상(attraction)이고 아래 [TYPE_INTENTS] 에서는 그 안의 유형(`contentTypeId=12`)이다 — 둘 다 걸린다.
     */
    val SEARCH_TYPE_INTENTS: Map<String, String> = mapOf(
        "관광지" to Types.ATTRACTION, "여행지" to Types.ATTRACTION, "명소" to Types.ATTRACTION, "attraction" to Types.ATTRACTION,
        "블로그" to Types.BLOG_POST, "블로그글" to Types.BLOG_POST, "포스트" to Types.BLOG_POST, "blog" to Types.BLOG_POST, "post" to Types.BLOG_POST,
        "게임" to Types.GAME, "game" to Types.GAME,
        "개념" to Types.CONCEPT, "용어" to Types.CONCEPT, "concept" to Types.CONCEPT,
        "상품" to Types.PRODUCT, "product" to Types.PRODUCT,
        "혜택" to Types.DEAL_OFFER, "딜" to Types.DEAL_OFFER, "deal" to Types.DEAL_OFFER,
        "서비스" to Types.SERVICE, "service" to Types.SERVICE,
    )

    /**
     * 원천 관광 유형(`contenttypeid`). 값의 뜻은 TourAPI 가 고정한 것이라 코드에 둔다.
     * 표기 변형은 같은 값을 가리키는 것만 담는다 — 「가족여행」처럼 대상이 섞인 말은 넣지 않는다
     * (그건 문서 속성이 아니라 뜻이고, 벡터 레그가 답한다).
     */
    val TYPE_INTENTS: Map<String, String> = mapOf(
        "관광지" to "12", "여행지" to "12", "명소" to "12", "가볼만한곳" to "12", "가볼만한 곳" to "12",
        "문화시설" to "14", "박물관" to "14", "미술관" to "14",
        "축제" to "15", "행사" to "15", "공연" to "15",
        "레포츠" to "28", "체험" to "28",
        "숙박" to "32",
    )

    /** 관광 유형 필터가 걸리는 인덱스 필드 */
    const val CONTENT_TYPE_FIELD = "contentTypeId"

    /**
     * 주로 즐기는 곳(`setting`) — place 가 분류 규칙과 로컬 LLM 판정으로 채운 파생 값이다.
     * 「비 오는 날」은 실내를 찾는 말이라 같은 값으로 보낸다. 띄어 쓴 형태는 [RAINY_DAY] 가 먼저 붙인다.
     */
    val SETTING_INTENTS: Map<String, String> = mapOf(
        "실내" to "indoor", "실내관광지" to "indoor", "실내여행지" to "indoor",
        "비오는날" to "indoor", "비올때" to "indoor",
        "indoor" to "indoor", "rainyday" to "indoor", "rainydays" to "indoor",
        "야외" to "outdoor", "outdoor" to "outdoor",
    )

    /** 실내·실외 필터가 걸리는 인덱스 필드 */
    const val SETTING_FIELD = "setting"

    /** 「비 오는 날」·「비가 오는 날」·「비 올 때」 — 조사가 끼면 네 어절이라 어절 창(최대 셋)이 못 잡아 먼저 붙인다 */
    private val RAINY_DAY = Regex("""비\s*(?:가\s*)?(?:오는\s*날|올\s*때)""")

    /** 분류체계 코드가 걸리는 필드 — 깊이(1·2·3)가 어느 필드인지 정한다 */
    fun lclsField(depth: Int): String = "lclsSystm$depth"

    /**
     * **음식·쇼핑으로 유형을 뒤집지 않는다.**
     *
     * 이 화면은 관광지 검색이고, 랭킹은 이미 음식·쇼핑을 내리고 있다
     * (`attraction-ranking` 의 sight 3.0 / commerce 0.35 — 적재량의 62% 가 그쪽이라 관광 의도를 밀어낸다).
     * 그런데 「맛집」·「먹거리」·「시장」을 유형 필터로 승격하면 **그 정책을 정확히 뒤집어** 음식점만 남는다.
     *
     * 실측(2026-09-10 · 판정 2,141건): 「전통시장 먹거리」 nDCG 0.4451 → 0.0356,
     * 「야시장」 0.6809 → 0.0298. 화면에는 봉평전통시장 메밀카페·할매닭발·남선옥이 나왔다.
     * 「먹거리」는 소분류 `EX060800 화장품/주류/먹거리` 의 별칭이기도 해서 더 좁게 잘렸다.
     *
     * 이 말들은 관광 맥락의 **수식어**지 유형 전환 지시가 아니다. 검색어로 남겨 BM25·벡터가 쓰게 둔다.
     */
    private val COMMERCE_PREFIXES = setOf("FD", "SH", "AC")

    /**
     * 코드 접두만으로는 부족하다. 「먹거리」는 `EX060800 화장품/주류/먹거리`(체험관광 아래)라
     * `FD`·`SH` 어디에도 안 걸리면서 실제로는 상업 시설을 가리킨다.
     * 관광 맥락의 수식어로 쓰이는 말은 **어느 코드로 가든** 필터로 승격하지 않는다.
     */
    private val FOOD_WORDS: Set<String> = setOf(
        "맛집", "음식", "음식점", "먹거리", "먹을거리", "카페", "술집", "주점",
        "food", "restaurant", "cafe",
    )
    private val SHOP_WORDS: Set<String> = setOf(
        "시장", "쇼핑", "대여", "렌탈",
        "market", "markets", "shopping", "rental", "rent",
    )
    private val COMMERCE_WORDS: Set<String> = FOOD_WORDS + SHOP_WORDS

    /** 「야시장」·「전통시장」·「night market」 — 어절 끝이 이것이면 상점 의도다. */
    private val SHOP_SUFFIXES: Set<String> = setOf("시장", "market", "markets")

    /**
     * **산업관광(EX06) 소분류 이름은 동의어 나열이 아니라 산업 나열이다** —
     * `전통/향토산업` · `자동차/조선/철강 등` · `Traditional / Local` · `Cosmetics / Alcohol / Food`.
     * 조각을 별칭으로 만들면 「전통」·「조선」·「traditional」·「food」가 이 소분류로 필터된다.
     * 실측: 「traditional market food」가 `EX060300` 으로 좁혀져 0건, 「traditional」 1건.
     * 이 아래는 이름 전체로만 걸리게 둔다.
     */
    private val NO_ALIAS_SPLIT_PREFIXES = setOf("EX06")

    /**
     * 혼자서는 아무것도 가리키지 않는 말. 지우지 않으면 BM25 가 이것들로 문서를 고른다.
     * **한 단어라도 뜻이 있는 말은 넣지 않는다** — 「야경」·「실내」는 지우면 안 된다.
     */
    val STOP_PHRASES: Set<String> = setOf(
        "갈만한", "가볼만한", "가볼만", "갈만", "가기좋은", "가기 좋은", "좋은", "괜찮은",
        "추천", "추천해줘", "추천좀", "어디", "어디가", "곳", "데", "장소", "스팟",
        "인기", "유명한", "유명", "베스트", "best",
        "갈수있는", "볼수있는", "가볼수있는", "가기좋은곳",
    )

    /**
     * 관광지 검색에서만 지우는 영문 불용어. **통합 검색에서는 지우지 않는다** — 거기서 잔여가 비면 다른 타입 검색이
     * 전체 목록 + 인기순으로 바뀌어, 「travel」로 찾던 블로그 글이 통째로 다른 결과가 된다.
     */
    val ATTRACTION_STOP_PHRASES: Set<String> = setOf(
        "trip", "trips", "travel", "places", "place", "spots", "spot", "visit", "to visit", "things to do",
    )

    /** 질의에서 읽은 조건이 걸리는 속성 축. [values] 는 그 축에서 고르는 도메인 값이다(긍정 값만). */
    enum class ConditionKind(val values: Set<String>) {
        PARKING(setOf(Availability.YES.name)),
        ADMISSION(setOf(Admission.FREE.name)),
        PET(AttributeSelection.PET_CHOICES.map { it.name }.toSet()),
        STROLLER_RENTAL(setOf(Availability.YES.name)),
        BARRIER_FREE(setOf("WHEELCHAIR")),
        CREDIT_CARD(setOf(Availability.YES.name)),
    }

    /** 조건어 하나 — 어느 축의 어떤 값으로 읽었는지와 그렇게 읽은 원문 어절. API 이름은 presentation 이 붙인다. */
    data class Condition(val kind: ConditionKind, val phrase: String, val values: Set<String> = kind.values)

    /**
     * 조건어 표의 한 행. **머리말과 꼬리말이 함께 있어야** 조건이다 — 「반려견 놀이터」는 반려견 시설을 찾는 말이지
     * 반려견 동반 조건이 아니다. 무료 입장만 꼬리말 없이 성립한다([needsTail]).
     * [langs] 에 없는 언어는 옮기지 않는다 — 그 언어 원천에 값이 없어 필터가 늘 0건을 만든다.
     */
    private class ConditionRule(
        val kind: ConditionKind,
        heads: Set<String>,
        tails: Set<String>,
        val langs: Set<String>,
        val needsTail: Boolean = true,
    ) {
        val heads: Set<String> = heads.map { normalize(it) }.toSet()
        val tails: Set<String> = tails.map { normalize(it) }.toSet()
        val headsLongestFirst: List<String> = this.heads.sortedByDescending { it.length }
    }

    /** **순서가 규칙이다** — 주차가 먼저 어절을 가져가서 「주차 무료」의 무료는 주차 꼬리말이 된다. */
    private val CONDITION_RULES: List<ConditionRule> = listOf(
        ConditionRule(
            ConditionKind.PARKING,
            heads = setOf("주차", "주차장", "parking"),
            tails = setOf("되는", "돼요", "가능", "가능한", "있는", "편한", "무료", "available", "lot", "free"),
            langs = setOf("ko", "en"),
        ),
        ConditionRule(
            ConditionKind.ADMISSION,
            heads = setOf("무료", "무료입장", "입장무료", "공짜", "free admission", "free entry", "free entrance"),
            tails = emptySet(),
            langs = setOf("ko", "en"),
            needsTail = false,
        ),
        ConditionRule(
            ConditionKind.PET,
            heads = setOf("반려동물", "반려견", "애견", "강아지"),
            tails = setOf("동반", "함께", "같이", "가능", "입장", "출입"),
            langs = setOf("ko"),
        ),
        ConditionRule(
            ConditionKind.STROLLER_RENTAL,
            heads = setOf("유모차"),
            tails = setOf("대여", "빌려주는", "렌탈"),
            langs = setOf("ko"),
        ),
        ConditionRule(
            ConditionKind.BARRIER_FREE,
            heads = setOf("휠체어"),
            tails = setOf("가능", "대여", "접근", "이용", "되는"),
            langs = setOf("ko"),
        ),
        ConditionRule(
            ConditionKind.CREDIT_CARD,
            heads = setOf("카드", "신용카드"),
            tails = setOf("결제", "되는", "가능"),
            langs = setOf("ko"),
        ),
    )

    /** 「무료」 단독은 다음 말이 없거나 쿼리 언더스탠딩이 가져갈 때만 무료 입장이다 — 「무료 셔틀」은 입장료 얘기가 아니다. */
    private const val BARE_FREE = "무료"

    /** 머리말 끝에서 떼고 비교하는 조사 — 「주차가 되는」·「반려견과 함께」·「무료로」. 긴 것부터 뗀다. */
    private val HEAD_PARTICLES: List<String> =
        listOf("이랑", "으로", "하고", "가", "이", "은", "는", "과", "와", "랑", "로", "도").sortedByDescending { it.length }

    /** 이 말이 꼬리말 뒤에 오면 조건으로 읽지 않는다 — 부정 필터 길은 열지 않고, 말은 검색어로 남긴다. */
    private val NEGATIONS_KO: List<String> = listOf("안", "못", "불가", "불가능", "금지")
    private val NEGATIONS_EN: Set<String> = setOf("no", "not")

    /** 인덱스 필드 하나에 거는 값. 분류 사전의 항목이자 [Understood.facets] 의 원소다. */
    data class Facet(val field: String, val value: String)

    /** 분석 결과. 전부 「없음」일 수 있고, 그때는 아무것도 바꾸지 않은 것과 같다. */
    data class Understood(
        /** BM25 레그에 넘길 검색어. 의도어만으로 이루어진 질의면 null 이다. */
        val residual: String?,
        /** 검색 대상 타입 ([Types]). 타입 의도어가 없으면 null — 통합 검색은 전 타입을 본다. */
        val type: String? = null,
        /** 인덱스 필드 → 값. 관광지는 `contentTypeId` · `lclsSystm1~3`. */
        val facets: Map<String, String> = emptyMap(),
        /**
         * 질의가 **상점·시장을 직접 가리킨다** (음식은 아니다). 필터로는 안 올리지만(위 COMMERCE 주석),
         * 이때는 랭킹의 상업 하향(sight 3.0 / commerce 0.35)도 꺼야 한다 — 「야시장」의 정답은
         * 전부 `shopping` 인데 하향이 그것을 잡음 아래로 내린다.
         * 실측(2026-09-13): 「야시장」 nDCG 0.681 → 0.030, 「night market」 0.864 → 0.349,
         * 「hanbok rental」 0.848 → 0.456 — 셋 다 정답이 `SH` 였다.
         *
         * **음식 의도는 반대다** — 「전통시장 먹거리」의 정답은 `culture` 로 실린 먹거리촌·먹자골목이라
         * 하향이 있어야 상점 전통시장이 밀려난다 (하향을 끄니 0.693 → 0.390). 음식어가 있으면 켠 채 둔다.
         */
        val commerceIntent: Boolean = false,
        /** 완성형 음절·라틴 글자·숫자가 하나도 없다(자모·기호만). 관광지 검색은 색인을 부르지 않고 0건을 낸다. */
        val noContent: Boolean = false,
        /** 조건어를 속성 선택으로 옮긴 것(관광지 경로만). 옮긴 어절은 [residual] 에 없다. */
        val conditions: List<Condition> = emptyList(),
        /**
         * 어휘 근거를 요구할 잔여 — [residual] 에서 조건어 표의 머리말·꼬리말 어절을 **늘** 뺀 것이다.
         * 조건으로 읽지 않은 경우(해제·부정어·통합 검색)에도 빼서, 「주차 되는」 같은 말이 근거 요구를 만들지 않게 한다.
         */
        val evidenceResidual: String? = residual,
    ) {
        /** 검색어가 남지 않았다 = 순위를 정할 키워드 신호가 없다. */
        val residualIsEmpty: Boolean get() = residual.isNullOrBlank()

        val hasFilter: Boolean get() = facets.isNotEmpty()

        /** 쿼리 언더스탠딩이 결과 집합을 좁혔다 — 분류·유형·실내외 필터나 조건이 하나라도 있다. */
        val narrowsByIntent: Boolean get() = facets.isNotEmpty() || conditions.isNotEmpty()
    }

    /**
     * 분류 이름 사전 — 이름(정규화) → [Facet]. 관광지는 `place` 의 `attraction_category_codes` 에서 만든다.
     *
     * 이름이 겹칠 때 **깊은 쪽이 이긴다** — 좁게 말하는 쪽이 사용자의 뜻에 가깝다.
     * 깊이가 같으면 **나중에 넣은 것이 이긴다** — 호출자가 순서로 우선순위를 준다
     * (한영 이름을 한 사전에 넣을 때 요청 언어를 뒤에 깔면 그쪽이 이긴다).
     */
    class Lexicon(entries: Map<String, Pair<Facet, Int>> = emptyMap()) {
        private val byName: Map<String, Pair<Facet, Int>> = entries

        fun lookup(phrase: String): Facet? = byName[phrase]?.first

        /** 가장 긴 이름부터 맞춰야 「자연경관」이 「자연」에 먼저 먹히지 않는다. */
        val phrasesLongestFirst: List<String> = byName.keys.sortedByDescending { it.length }

        companion object {
            val EMPTY = Lexicon()

            /** 관광지 분류 코드표 — (코드, 깊이, 이름). 깊이가 걸릴 필드를 정한다. */
            fun of(codes: List<Triple<String, Int, String>>): Lexicon {
                val map = mutableMapOf<String, Pair<Facet, Int>>()
                codes.forEach { (code, depth, name) ->
                    val keys = if (NO_ALIAS_SPLIT_PREFIXES.any { code.startsWith(it) }) setOf(normalize(name)) else aliasesOf(name)
                    val facet = Facet(lclsField(depth), code)
                    keys.forEach { key ->
                        val existing = map[key]
                        if (existing == null || depth >= existing.second) map[key] = facet to depth
                    }
                }
                return Lexicon(map)
            }

            /**
             * **원천 이름 자체가 동의어를 담고 있다** — `해변. 해수욕장` · `연못·늪` · `항구/포구` ·
             * `자연경관(하천‧해양)`. 이름을 통째로만 열쇠로 쓰면 「해수욕장」이 안 걸린다(실측).
             *
             * 그래서 셋을 다 등록한다: 이름 전체 · 괄호 밖을 쪼갠 것 · 괄호 안을 쪼갠 것.
             * 사전을 손으로 채우지 않고 얻는 별칭이라, 원천이 이름을 고치면 따라 바뀐다.
             */
            fun aliasesOf(name: String): Set<String> {
                val outside = name.replace(PARENTHETICAL, " ")
                // **괄호 안은 구분자가 있을 때만 별칭이다.** 대부분은 개념이 아니라 한정어다 —
                // `Inline Skating (Indoor)` · `(ATV)` · `(드론)` · `자연경관(산)`.
                // 실측(코드표 617행): 괄호가 있는 이름 ko 4 · en 7 중 구분자가 든 것은 각 1개뿐이다.
                // 한정어를 별칭으로 만들면 「indoor activities」가 인라인스케이트 소분류로 필터돼 0건이 된다.
                val inside = PARENTHETICAL.findAll(name).map { it.groupValues[1] }
                    .filter { SEPARATORS.containsMatchIn(it) }
                    .joinToString(" ")
                return (listOf(name) + SEPARATORS.split(outside) + SEPARATORS.split(inside))
                    .map { normalize(it) }
                    .filter { it.isNotBlank() }
                    .toSet()
            }

            private val PARENTHETICAL = Regex("""[(（]([^)）]*)[)）]""")
            private val SEPARATORS = Regex("""[.,/·∙‧・]""")
        }
    }

    /** 비교용 정규화 — 공백·중점을 없애고 소문자로. 원천 이름에 `자연경관(하천‧해양)` 같은 표기가 섞여 있다. */
    fun normalize(text: String): String =
        text.lowercase().replace(Regex("""[\s‧·・/]"""), "")

    /**
     * 질의 하나를 분석한다.
     *
     * 어절 단위로 자르고, **긴 것부터** 맞춘다(어절 창 1~3). 형태소로 쪼개지 않는 이유는 그 쪼갬이 애초에
     * 이 문제를 만들었기 때문이다 — 「아이와」를 `아이`+`와` 로 나누면 다시 「아이와즈」에 걸린다.
     * 창은 공백을 뺀 이어붙임으로 맞춰서 「갈 만한」과 「갈만한」이 같은 말이 된다.
     *
     * @param searchTypes 타입 의도어([SEARCH_TYPE_INTENTS])를 읽을지. **대상이 정해진 화면(관광지 검색)은 false** —
     *   거기서 「게임」·「상품」을 대상 지시로 읽어 검색어에서 빼면 그 말로 찾던 문서를 놓친다.
     * @param lang 요청 언어. 조건어 표의 언어 열과 맞춘다. null 은 ko 로 본다.
     * @param attractionOnly 관광지 검색 경로인지. 영문 불용어([ATTRACTION_STOP_PHRASES])와 조건어 추출은 여기서만 한다 —
     *   통합 검색은 잔여를 다른 타입 검색에 넘기므로, 거기서 말을 지우면 그 타입 결과가 바뀐다.
     * @param conditionWords 조건어를 속성 선택으로 옮길지(관광지 경로일 때만 뜻이 있다). false 면 조건어는 검색어로 남는다.
     * @param skipConditions 이 축은 옮기지 않는다 — 그 어절은 검색어로 남는다.
     */
    fun analyze(
        rawQuery: String,
        lexicon: Lexicon = Lexicon.EMPTY,
        searchTypes: Boolean = false,
        lang: String? = null,
        attractionOnly: Boolean = false,
        conditionWords: Boolean = attractionOnly,
        skipConditions: Set<ConditionKind> = emptySet(),
    ): Understood {
        val noContent = hasNoContent(rawQuery)
        val raw = RAINY_DAY.replace(rawQuery.trim()) { it.value.replace(Regex("""\s|가(?=\s*오)"""), "") }
        val words = raw.split(Regex("""\s+""")).filter { it.isNotBlank() }
        if (words.isEmpty()) return Understood(residual = null, noContent = noContent)

        // **질의 전체를 한 구절로 먼저 맞춘다.** 아래 어절 창은 최대 세 어절이라
        // 「Natural Scenery (Rivers/Marine)」 처럼 긴 이름을 영영 못 잡는다.
        val wholeNormalized = normalize(raw)
        match(wholeNormalized, lexicon, searchTypes)?.let { whole ->
            return Understood(residual = null, type = whole.type, facets = whole.facets, noContent = noContent)
        }

        val stops = if (attractionOnly) normalizedAttractionStopPhrases else normalizedStopPhrases
        val consumed = BooleanArray(words.size)
        val conditions = if (attractionOnly && conditionWords) {
            extractConditions(words, (lang?.lowercase() ?: "ko"), skipConditions, consumed) { j ->
                takenByIntent(words, j, consumed, lexicon, searchTypes, stops)
            }
        } else {
            emptyList()
        }

        var type: String? = null
        val facets = linkedMapOf<String, String>()
        var shop = isShop(wholeNormalized, lexicon)
        var food = isFood(wholeNormalized, lexicon)
        val kept = mutableListOf<String>()

        var i = 0
        while (i < words.size) {
            if (consumed[i]) {
                i += 1
                continue
            }
            val two = window(words, i, 2, consumed)
            val one = normalize(words[i])

            if (two != null && isShop(two, lexicon)) shop = true
            if (isShop(one, lexicon)) shop = true
            if (two != null && isFood(two, lexicon)) food = true
            if (isFood(one, lexicon)) food = true

            // 긴 창부터 — 의도어와 불용구를 같은 창에서 본다. 「가볼 만한 곳」은 세 어절 창이 유형 의도로 잡는다.
            var taken = 0
            for (size in MAX_WINDOW downTo 1) {
                val joined = window(words, i, size, consumed) ?: continue
                val hit = match(joined, lexicon, searchTypes)
                if (hit != null) {
                    type = type ?: hit.type
                    hit.facets.forEach { (field, value) -> facets.putIfAbsent(field, value) }
                    taken = size
                    break
                }
                if (joined in stops) {
                    taken = size
                    break
                }
            }
            if (taken == 0) {
                kept += words[i]
                i += 1
            } else {
                i += taken
            }
        }

        val residual = kept.joinToString(" ").ifBlank { null }
        return Understood(
            residual = residual,
            type = type,
            facets = facets,
            // 음식어가 하나라도 있으면 상점 의도로 치지 않는다 — 「전통시장 먹거리」는 먹거리가 머리다
            commerceIntent = shop && !food,
            noContent = noContent,
            conditions = conditions,
            evidenceResidual = withoutConditionWords(kept),
        )
    }

    /** 어절 창의 최대 크기 — 「가볼 만한 곳」·「갈 수 있는」이 세 어절이다. */
    private const val MAX_WINDOW = 3

    /** [start] 부터 [size] 어절을 정규화해 이은 것. 끝을 넘거나 조건어로 옮긴 어절이 끼면 null. */
    private fun window(words: List<String>, start: Int, size: Int, consumed: BooleanArray): String? {
        if (start + size > words.size) return null
        if ((start until start + size).any { consumed[it] }) return null
        return normalize(words.subList(start, start + size).joinToString(""))
    }

    /** 완성형 음절·라틴 글자·숫자가 하나도 없다(자모·기호만, 「ㅁㄴㅇㄹ」). 찾을 내용이 없는 입력이다. */
    fun hasNoContent(text: String): Boolean = text.none { it.isContentChar() }

    private fun Char.isContentChar(): Boolean =
        this in '\uAC00'..'\uD7A3' || isDigit() ||
            (isLetter() && Character.UnicodeScript.of(code) == Character.UnicodeScript.LATIN)

    /** [j] 에서 시작하는 말을 쿼리 언더스탠딩이 가져가는가(유형·분류·실내외·불용구). */
    private fun takenByIntent(
        words: List<String>,
        j: Int,
        consumed: BooleanArray,
        lexicon: Lexicon,
        searchTypes: Boolean,
        stops: Set<String>,
    ): Boolean = (MAX_WINDOW downTo 1).any { size ->
        window(words, j, size, consumed)?.let { it in stops || match(it, lexicon, searchTypes) != null } == true
    }

    /**
     * 조건어 표([CONDITION_RULES])를 순서대로 훑어 축마다 첫 조건 하나를 옮긴다. 옮긴 어절은 [consumed] 에 표시한다.
     * [takenByIntent] 는 「무료」 단독 판정에 쓴다 — 다음 말을 쿼리 언더스탠딩이 가져가면 무료 입장으로 읽는다.
     */
    private fun extractConditions(
        words: List<String>,
        lang: String,
        skip: Set<ConditionKind>,
        consumed: BooleanArray,
        takenByIntent: (Int) -> Boolean,
    ): List<Condition> = CONDITION_RULES
        .filter { lang in it.langs && it.kind !in skip }
        .mapNotNull { rule ->
            words.indices.firstNotNullOfOrNull { i -> matchCondition(rule, words, i, consumed, takenByIntent) }
                ?.let { (range, condition) ->
                    range.forEach { consumed[it] = true }
                    condition
                }
        }

    private fun matchCondition(
        rule: ConditionRule,
        words: List<String>,
        i: Int,
        consumed: BooleanArray,
        takenByIntent: (Int) -> Boolean,
    ): Pair<IntRange, Condition>? {
        if (consumed[i]) return null
        // 머리말과 꼬리말을 붙여 쓴 한 어절 — 「주차가능」·「반려견동반」
        if (rule.needsTail && gluedHeadTail(normalize(words[i]), rule) && !isNegation(words.getOrNull(i + 1))) {
            return (i..i) to Condition(rule.kind, words[i])
        }
        // 머리말은 두 어절(「free admission」)까지 본다 — 긴 것부터
        for (size in 2 downTo 1) {
            val joined = window(words, i, size, consumed) ?: continue
            val head = stripParticle(joined, rule.heads) ?: continue
            val next = i + size
            if (!rule.needsTail) {
                if (!admissionHolds(head, words, i, next, takenByIntent)) return null
                if (isNegation(words.getOrNull(next))) return null
                return (i until next) to Condition(rule.kind, words.subList(i, next).joinToString(" "))
            }
            if (next >= words.size || consumed[next]) return null
            if (normalize(words[next]) !in rule.tails) return null
            if (isNegation(words.getOrNull(next + 1))) return null
            return (i..next) to Condition(rule.kind, words.subList(i, next + 1).joinToString(" "))
        }
        return null
    }

    /**
     * 무료 입장의 두 제한. 앞이나 뒤 어절이 주차 머리말이면 주차 얘기다(「무료 주차장」).
     * 「무료」 단독은 다음 말이 없거나 쿼리 언더스탠딩이 가져갈 때만 성립한다(「무료 박물관」은 되고 「무료 셔틀」은 안 된다).
     */
    private fun admissionHolds(head: String, words: List<String>, start: Int, next: Int, takenByIntent: (Int) -> Boolean): Boolean {
        val parkingHeads = CONDITION_RULES.first { it.kind == ConditionKind.PARKING }.heads
        val neighbours = listOfNotNull(words.getOrNull(start - 1), words.getOrNull(next))
        if (neighbours.any { stripParticle(normalize(it), parkingHeads) != null }) return false
        if (head == BARE_FREE && next < words.size && !takenByIntent(next)) return false
        return true
    }

    /** 머리말 + (조사) + 꼬리말이 한 어절이다. */
    private fun gluedHeadTail(normalized: String, rule: ConditionRule): Boolean =
        rule.headsLongestFirst.any { head ->
            normalized.startsWith(head) && normalized.length > head.length &&
                normalized.removePrefix(head).let { rest ->
                    rest in rule.tails || HEAD_PARTICLES.any { p -> rest.startsWith(p) && rest.removePrefix(p) in rule.tails }
                }
        }

    /** 그대로 또는 끝 조사 하나를 떼서 [heads] 에 있으면 그 머리말. */
    private fun stripParticle(normalized: String, heads: Set<String>): String? {
        if (normalized in heads) return normalized
        return HEAD_PARTICLES.firstNotNullOfOrNull { p ->
            normalized.takeIf { it.endsWith(p) }?.removeSuffix(p)?.takeIf { it in heads }
        }
    }

    private fun isNegation(word: String?): Boolean {
        val n = word?.let { normalize(it) } ?: return false
        return n in NEGATIONS_EN || NEGATIONS_KO.any { n.startsWith(it) }
    }

    /** 조건어 표의 머리말·꼬리말 어절(붙여 쓴 것·조사 붙은 것 포함)을 뺀 나머지. 남는 것이 없으면 null. */
    private fun withoutConditionWords(kept: List<String>): String? {
        val out = mutableListOf<String>()
        var i = 0
        while (i < kept.size) {
            val pair = if (i + 1 < kept.size) normalize(kept[i] + kept[i + 1]) else null
            if (pair != null && pair in allConditionHeads) {
                i += 2
                continue
            }
            val one = normalize(kept[i])
            val vocabulary = stripParticle(one, allConditionHeads) != null || one in allConditionTails ||
                CONDITION_RULES.any { gluedHeadTail(one, it) }
            if (!vocabulary) out += kept[i]
            i += 1
        }
        return out.joinToString(" ").ifBlank { null }
    }

    /** 상점 의도어이거나(끝이 「시장」·「market」 포함), 사전이 쇼핑·숙박 코드로 보내는 말. */
    private fun isShop(normalized: String, lexicon: Lexicon): Boolean =
        normalized in normalizedShopWords ||
            SHOP_SUFFIXES.any { normalized.endsWith(it) } ||
            lexicon.lookup(normalized)?.let { it.isLcls && (it.value.startsWith("SH") || it.value.startsWith("AC")) } == true

    /** 음식 의도어이거나 사전이 음식(FD) 코드로 보내는 말. */
    private fun isFood(normalized: String, lexicon: Lexicon): Boolean =
        normalized in normalizedFoodWords ||
            lexicon.lookup(normalized)?.let { it.isLcls && it.value.startsWith("FD") } == true

    private val Facet.isLcls: Boolean get() = field.startsWith("lclsSystm")

    private val normalizedStopPhrases: Set<String> = STOP_PHRASES.map { normalize(it) }.toSet()
    private val normalizedAttractionStopPhrases: Set<String> =
        normalizedStopPhrases + ATTRACTION_STOP_PHRASES.map { normalize(it) }
    private val allConditionHeads: Set<String> by lazy { CONDITION_RULES.flatMap { it.heads }.toSet() }
    private val allConditionTails: Set<String> by lazy { CONDITION_RULES.flatMap { it.tails }.toSet() }
    private val normalizedCommerceWords: Set<String> = COMMERCE_WORDS.map { normalize(it) }.toSet()
    private val normalizedShopWords: Set<String> = SHOP_WORDS.map { normalize(it) }.toSet()
    private val normalizedFoodWords: Set<String> = FOOD_WORDS.map { normalize(it) }.toSet()
    private val normalizedTypeIntents: Map<String, String> =
        TYPE_INTENTS.entries.associate { normalize(it.key) to it.value }
    private val normalizedSettingIntents: Map<String, String> =
        SETTING_INTENTS.entries.associate { normalize(it.key) to it.value }
    private val normalizedSearchTypes: Map<String, String> =
        SEARCH_TYPE_INTENTS.entries.associate { normalize(it.key) to it.value }

    /** 어절 창 하나가 뜻하는 것 — 타입과 필터. 둘 다 없으면 match 는 null 이다. */
    private data class Hit(val type: String?, val facets: Map<String, String>)

    /** 타입·유형 의도가 먼저다 — 「관광지」는 분류가 아니라 대상과 유형을 가리킨다. */
    private fun match(normalized: String, lexicon: Lexicon, searchTypes: Boolean): Hit? {
        if (normalized in normalizedCommerceWords) return null
        val type = if (searchTypes) normalizedSearchTypes[normalized] else null
        normalizedTypeIntents[normalized]?.let { return Hit(type, mapOf(CONTENT_TYPE_FIELD to it)) }
        // 분류 사전보다 먼저 본다 — 「indoor」가 `Inline Skating (Indoor)` 소분류로 새지 않게.
        normalizedSettingIntents[normalized]?.let { return Hit(type, mapOf(SETTING_FIELD to it)) }
        if (type != null) return Hit(type, emptyMap())
        lexicon.lookup(normalized)?.let { facet ->
            // 같은 이유로 분류 의도도 음식(FD)·쇼핑(SH)·숙박(AC) 으로는 필터를 만들지 않는다.
            if (facet.isLcls && COMMERCE_PREFIXES.any { facet.value.startsWith(it) }) return null
            return Hit(null, mapOf(facet.field to facet.value))
        }
        return null
    }
}
