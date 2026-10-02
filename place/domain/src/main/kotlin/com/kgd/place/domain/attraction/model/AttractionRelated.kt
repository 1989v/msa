package com.kgd.place.domain.attraction.model

/**
 * 연관 관광지 — 한국관광공사 빅데이터 `TarRlteTarService1` 의 출발 관광지 하나와 그 달의 연관 대상(최대 50, 순위 순).
 *
 * 원천 식별자(`tAtsCd`)는 32자 해시라 TourAPI contentId 와 이어지지 않는다 — 출발·대상 모두 이름 + 시군구로 국문 관광지에 잇는다
 * (place-ingest `name_match.py`, 집중률과 공용). [relatedRaw] 는 원천 행 배열 원문이고, 매칭 결과([attractionId] · [matchMethod] ·
 * [targets])가 파생 값이다. 못 이은 출발·대상도 저장한다 — 원천 전부 적재(data-sources.md §0 ①).
 */
data class AttractionRelated(
    val tAtsCd: String,
    val tAtsNm: String,
    val signguCd: String,
    val baseYm: String,
    val relatedRaw: String,
    val attractionId: Long?,
    val matchMethod: NameMatch,
    val targets: List<RelatedTarget>,
) {
    init {
        require(SIGUNGU_CODE.matches(signguCd)) { "시군구 코드는 5자리 숫자여야 합니다: $signguCd" }
        require(BASE_YM.matches(baseYm)) { "기준 월은 yyyyMM 이어야 합니다: $baseYm" }
        require(tAtsCd.isNotBlank() && tAtsNm.isNotBlank()) { "출발 관광지 식별자·이름이 비었습니다: $signguCd" }
        require((attractionId != null) == matchMethod.linked) { "매칭 방법과 관광지 id 가 어긋납니다: $tAtsNm $matchMethod $attractionId" }
        require(targets.map { it.rank }.toSet().size == targets.size) { "연관 대상 순위가 겹칩니다: $tAtsNm" }
    }

    /**
     * 화면에 내는 대상(순위 순) — 출발이 [NameMatch.SERVED] 로 이어졌을 때만, 우리 관광지 행(상세 페이지가 있는 것)에
     * [NameMatch.SERVED] 로 이어진 대상. 원천 분류(관광지 · 음식 · 숙박)는 보지 않는다 — 우리 음식점·숙박 행으로 이어지면 링크할
     * 곳이 있으니 낸다(화면은 원천 소분류로 음식점·숙박임을 밝힌다). 이어지지 않은 대상은 링크할 곳이 없어 내지 않는다.
     * 자기 자신 · 출발과 같은 이름 · 이미 나온 관광지는 뺀다. 개수는 자르지 않는다 — 재색인이 활성 문서만 남긴 뒤 자른다.
     */
    fun servedTargets(): List<RelatedTarget> {
        if (attractionId == null || matchMethod !in NameMatch.SERVED) return emptyList()
        val startName = squash(tAtsNm)
        val seen = mutableSetOf(attractionId)
        return targets.sortedBy { it.rank }.filter { t ->
            t.matchMethod in NameMatch.SERVED && t.attractionId != null &&
                squash(t.name) != startName && seen.add(t.attractionId)
        }
    }

    companion object {
        private val SIGUNGU_CODE = Regex("\\d{5}")
        private val BASE_YM = Regex("\\d{4}(0[1-9]|1[0-2])")

        private fun squash(name: String) = name.filterNot { it.isWhitespace() }

        /**
         * 원천 출발 이름 둘 이상이 한 관광지에 이어졌을 때 하나만 고른다 — 매칭이 더 확실한 쪽(정확 > 정규화 > 포함),
         * 같으면 더 최근 달, 그다음 화면에 낼 대상이 많은 쪽.
         */
        fun preferred(rows: List<AttractionRelated>): Map<Long, AttractionRelated> =
            rows.filter { it.attractionId != null }.groupBy { it.attractionId!! }.mapValues { (_, same) ->
                same.sortedWith(
                    compareBy<AttractionRelated> { it.matchMethod.ordinal }
                        .thenByDescending { it.baseYm }
                        .thenByDescending { it.servedTargets().size },
                ).first()
            }
    }
}

/** 연관 대상 한 건 — 원천 순위·이름·분류 3단·대상 시군구와, 대상 시군구 국문 행에 이은 결과. */
data class RelatedTarget(
    val rank: Int,
    val name: String,
    val lcls: String?,
    val mcls: String?,
    val scls: String?,
    val signguCd: String?,
    val attractionId: Long?,
    val matchMethod: NameMatch,
) {
    init {
        require(rank >= 1) { "연관 순위는 1 이상이어야 합니다: $rank" }
        require((attractionId != null) == matchMethod.linked) { "대상 매칭 방법과 관광지 id 가 어긋납니다: $name $matchMethod $attractionId" }
    }
}
