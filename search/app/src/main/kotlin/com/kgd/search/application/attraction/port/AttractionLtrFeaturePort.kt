package com.kgd.search.application.attraction.port

/**
 * LTR 피처 중 색인에 다시 물어야 하는 것 — 후보마다 다른 질의로 잰 순위·점수.
 * 질의 모양은 학습 피처를 뽑은 스크립트(`scripts/search-eval/ltr-offline/features.sh`, `pool.sh`)와 같아야 한다.
 */
interface AttractionLtrFeaturePort {
    /**
     * [candidateIds] 각각의 피처. 결과에 없는 후보는 순위 [LtrRetrievalFeatures.ABSENT_RANK] · 점수 0 이다.
     * 색인 호출이 실패하면 예외를 던진다 — 빈 피처로 채점하면 순서가 조용히 틀린다.
     */
    fun features(keyword: String, lang: String, vector: List<Float>, candidateIds: List<String>): Map<String, LtrRetrievalFeatures>
}

/** 학습 행의 같은 이름 열과 짝을 이룬다(`a_rank` · `b_rank` · `bm_*` · `phrase_title` · `knn`). */
data class LtrRetrievalFeatures(
    /** BM25 단독 상위 20 안의 순위 */
    val aRank: Int = ABSENT_RANK,
    /** BM25 상위 20 과 벡터 상위 20 을 RRF 로 합친 순위 */
    val bRank: Int = ABSENT_RANK,
    val bmTitle: Double = 0.0,
    val bmOverview: Double = 0.0,
    val bmAddress: Double = 0.0,
    val bmAll: Double = 0.0,
    val phraseTitle: Double = 0.0,
    /** 벡터 이웃 100 안의 점수 */
    val knn: Double = 0.0,
) {
    companion object {
        /** 상위 20 밖 — 학습 행도 20 으로 적었다 */
        const val ABSENT_RANK = 20
    }
}
