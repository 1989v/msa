package com.kgd.search.domain.attraction.model

/**
 * 질의 이해 — 의도어를 **검색어에서 빼서 필터로 옮긴다** (ADR-0090 개정).
 *
 * 왜 필요한가: 형태소 분석기는 「아이와 갈만한 관광지」를 `아이·와·갈만·하·ㄴ·관광·지` 로 쪼개고,
 * BM25 는 그 조각을 전부 내용어로 채점한다. 그래서 `아이`+`와` 가 「아이와즈」에 걸리고
 * `관광` 이 「관광특구」를 `title^3` 으로 끌어올린다 — 뜻이 아니라 글자가 이긴다.
 *
 * **벡터 레그에는 적용하지 않는다.** 문장의 뜻이 그 레그의 전부라, 잘라내면 지금 잘 하는 것을 망친다.
 * 자르는 대상은 BM25 레그뿐이고, 이 클래스는 그 잔여 검색어와 필터를 만든다.
 *
 * 사전은 두 갈래다.
 * - **유형 의도**(`관광지`→`contentTypeId=12`)는 원천이 정한 뜻이라 코드에 둔다.
 * - **분류 의도**(`해수욕장`→`NA020100`)는 원천 코드표에서 온다 — 손으로 쓰면 원천이 분류를
 *   늘릴 때마다 배포해야 한다.
 */
object QueryIntent {

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
    private val COMMERCE_WORDS: Set<String> = setOf(
        "맛집", "음식", "음식점", "먹거리", "먹을거리", "시장", "쇼핑", "카페", "술집", "주점",
        "food", "restaurant", "market", "shopping", "cafe",
    )

    /**
     * 혼자서는 아무것도 가리키지 않는 말. 지우지 않으면 BM25 가 이것들로 문서를 고른다.
     * **한 단어라도 뜻이 있는 말은 넣지 않는다** — 「야경」·「실내」는 지우면 안 된다.
     */
    val STOP_PHRASES: Set<String> = setOf(
        "갈만한", "가볼만한", "가볼만", "갈만", "가기좋은", "가기 좋은", "좋은", "괜찮은",
        "추천", "추천해줘", "추천좀", "어디", "어디가", "곳", "데", "장소", "스팟",
        "인기", "유명한", "유명", "베스트", "best",
    )

    /** 분석 결과. 넷 다 「없음」일 수 있고, 그때는 아무것도 바꾸지 않은 것과 같다. */
    data class Understood(
        /** BM25 레그에 넘길 검색어. 의도어만으로 이루어진 질의면 null 이다. */
        val residual: String?,
        val contentTypeId: String? = null,
        /** 분류체계 코드와 그 깊이 — 깊이가 어느 필드에 걸지 정한다(1→lclsSystm1). */
        val lclsCode: String? = null,
        val lclsDepth: Int? = null,
    ) {
        /** 검색어가 남지 않았다 = 순위를 정할 키워드 신호가 없다. */
        val residualIsEmpty: Boolean get() = residual.isNullOrBlank()

        val hasFilter: Boolean get() = contentTypeId != null || lclsCode != null
    }

    /**
     * 분류 이름 사전. `place` 의 `attraction_category_codes` 에서 만든다.
     *
     * 이름이 겹칠 때 **깊은 쪽이 이긴다** — 좁게 말하는 쪽이 사용자의 뜻에 가깝다.
     * 깊이가 같으면 **나중에 넣은 것이 이긴다** — 호출자가 순서로 우선순위를 준다
     * (한영 이름을 한 사전에 넣을 때 요청 언어를 뒤에 깔면 그쪽이 이긴다).
     */
    class Lexicon(entries: Map<String, Pair<String, Int>> = emptyMap()) {
        private val byName: Map<String, Pair<String, Int>> = entries

        fun lookup(phrase: String): Pair<String, Int>? = byName[phrase]

        /** 가장 긴 이름부터 맞춰야 「자연경관」이 「자연」에 먼저 먹히지 않는다. */
        val phrasesLongestFirst: List<String> = byName.keys.sortedByDescending { it.length }

        companion object {
            val EMPTY = Lexicon()

            fun of(codes: List<Triple<String, Int, String>>): Lexicon {
                val map = mutableMapOf<String, Pair<String, Int>>()
                codes.forEach { (code, depth, name) ->
                    aliasesOf(name).forEach { key ->
                        val existing = map[key]
                        if (existing == null || depth >= existing.second) map[key] = code to depth
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
                val inside = PARENTHETICAL.findAll(name).map { it.groupValues[1] }.joinToString(" ")
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
     * 어절 단위로 자르고, **긴 것부터** 맞춘다. 형태소로 쪼개지 않는 이유는 그 쪼갬이 애초에
     * 이 문제를 만들었기 때문이다 — 「아이와」를 `아이`+`와` 로 나누면 다시 「아이와즈」에 걸린다.
     */
    fun analyze(raw: String, lexicon: Lexicon = Lexicon.EMPTY): Understood {
        val words = raw.trim().split(Regex("""\s+""")).filter { it.isNotBlank() }
        if (words.isEmpty()) return Understood(residual = null)

        // **질의 전체를 한 구절로 먼저 맞춘다.** 아래 어절 창은 최대 두 어절이라
        // 「Natural Scenery (Rivers/Marine)」 처럼 긴 이름을 영영 못 잡는다.
        match(normalize(raw), lexicon)?.let { whole ->
            return Understood(residual = null, contentTypeId = whole.first,
                              lclsCode = whole.second?.first, lclsDepth = whole.second?.second)
        }

        var contentTypeId: String? = null
        var lcls: Pair<String, Int>? = null
        val kept = mutableListOf<String>()

        // 붙여 쓴 말("가볼만한곳")과 띄어 쓴 말("가볼만한 곳")을 함께 잡으려면 이어붙인 것도 봐야 한다.
        var i = 0
        while (i < words.size) {
            val two = if (i + 1 < words.size) normalize(words[i] + words[i + 1]) else null
            val one = normalize(words[i])

            val twoHit = two?.let { match(it, lexicon) }
            if (twoHit != null) {
                contentTypeId = contentTypeId ?: twoHit.first
                lcls = lcls ?: twoHit.second
                i += 2
                continue
            }
            val oneHit = match(one, lexicon)
            if (oneHit != null) {
                contentTypeId = contentTypeId ?: oneHit.first
                lcls = lcls ?: oneHit.second
                i += 1
                continue
            }
            if (one !in normalizedStopPhrases) kept += words[i]
            i += 1
        }

        return Understood(
            residual = kept.joinToString(" ").ifBlank { null },
            contentTypeId = contentTypeId,
            lclsCode = lcls?.first,
            lclsDepth = lcls?.second,
        )
    }

    private val normalizedStopPhrases: Set<String> = STOP_PHRASES.map { normalize(it) }.toSet()
    private val normalizedCommerceWords: Set<String> = COMMERCE_WORDS.map { normalize(it) }.toSet()
    private val normalizedTypeIntents: Map<String, String> =
        TYPE_INTENTS.entries.associate { normalize(it.key) to it.value }

    /** 유형 의도가 먼저다 — 「관광지」는 분류가 아니라 유형을 가리킨다. */
    private fun match(normalized: String, lexicon: Lexicon): Pair<String?, Pair<String, Int>?>? {
        if (normalized in normalizedCommerceWords) return null
        normalizedTypeIntents[normalized]?.let { return it to null }
        lexicon.lookup(normalized)?.let { hit ->
            // 같은 이유로 분류 의도도 음식(FD)·쇼핑(SH)·숙박(AC) 으로는 필터를 만들지 않는다.
            if (COMMERCE_PREFIXES.any { hit.first.startsWith(it) }) return null
            return null to hit
        }
        return null
    }
}
