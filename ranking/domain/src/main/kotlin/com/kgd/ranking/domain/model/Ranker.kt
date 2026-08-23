package com.kgd.ranking.domain.model

import java.math.BigDecimal

/**
 * 점수가 매겨진 대상 하나.
 *
 * 점수가 어떻게 나왔는지는 도메인 밖의 일이다 — 여기 들어올 때는 이미 매겨져 있다.
 */
data class ScoredSubject(
    val subjectKey: String,
    val subjectName: String,
    val score: BigDecimal,
    val payload: Map<String, Any?> = emptyMap(),
)

/**
 * 점수 목록을 순위로 바꾼다 (ADR-0081).
 *
 * 동점은 **같은 순위를 받고 다음 순위는 건너뛴다** (1, 1, 3 — standard competition ranking).
 * 스포츠 순위와 같은 관례이고, 사람들이 "공동 2위 다음은 4위"를 기대하는 방식이다.
 */
object Ranker {

    /**
     * @param previousRanks 직전 스냅샷의 `subjectKey → rank`. 비어 있으면 전부 신규 진입이다.
     *
     * **이번 목록에 없는 대상은 결과에 넣지 않는다.** 직전 순위를 유령으로 남기면 화면이
     * 사라진 주유소를 계속 보여준다.
     */
    fun rank(
        subjects: List<ScoredSubject>,
        direction: SortDirection,
        previousRanks: Map<String, Int> = emptyMap(),
    ): List<RankingEntry> {
        // 동점자 사이 순서를 subjectKey 로 고정한다. 정렬이 불안정하면 같은 입력이 실행마다
        // 다른 순서로 나와 화면의 줄 순서가 매일 뒤바뀐다 (순위 숫자는 같은데 목록이 흔들린다).
        val sorted = subjects.sortedWith(
            when (direction) {
                SortDirection.ASC -> compareBy<ScoredSubject> { it.score }.thenBy { it.subjectKey }
                SortDirection.DESC -> compareByDescending<ScoredSubject> { it.score }.thenBy { it.subjectKey }
            },
        )

        var groupScore: BigDecimal? = null
        var groupRank = 0

        return sorted.mapIndexed { index, subject ->
            // BigDecimal 은 `==` 가 scale 까지 본다 — 1000 과 1000.0 이 다른 값이 된다.
            // 수집 경로마다 scale 이 달라질 수 있어 동점 판정은 반드시 compareTo 다.
            val tied = groupScore != null && groupScore!!.compareTo(subject.score) == 0
            if (!tied) {
                groupScore = subject.score
                groupRank = index + 1
            }
            RankingEntry(
                rank = groupRank,
                subjectKey = subject.subjectKey,
                subjectName = subject.subjectName,
                score = subject.score,
                prevRank = previousRanks[subject.subjectKey],
                payload = subject.payload,
            )
        }
    }
}
