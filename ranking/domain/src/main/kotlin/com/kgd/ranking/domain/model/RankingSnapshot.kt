package com.kgd.ranking.domain.model

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import java.math.BigDecimal
import java.time.Instant

/**
 * 한 시점의 순위 묶음 (ADR-0081).
 *
 * 순위를 "현재값"으로 덮어쓰지 않고 시점마다 남기는 이유는 등락 때문이다 — "지난주 대비 ↑3"
 * 은 이전 시점이 남아 있어야만 만들 수 있고, 그게 랭킹 서비스의 거의 유일한 재방문 동기다.
 * 부수로 시계열(유가 추이·개폐업 추이)이 공짜로 남는다.
 */
data class RankingSnapshot(
    val id: Long?,
    val boardId: Long,
    val capturedAt: Instant,
    val entryCount: Int,
)

/**
 * 순위 한 줄.
 *
 * **이 타입은 무엇이 좋은 주유소인지 모른다.** 등수와 점수와 표시용 [payload] 만 안다.
 * 점수를 만드는 규칙은 도메인별 수집기·점수기에 남는다. 도메인 이질성(브랜드·셀프여부 /
 * kcal·나트륨 / 인허가일자)을 정규 컬럼으로 펴면 nullable 이 끝없이 늘고 도메인마다
 * 마이그레이션이 붙는다.
 */
data class RankingEntry(
    val rank: Int,
    /** 대상 식별자 — `gas:{opinetId}` 꼴의 opaque 문자열. wishlist targetKey 와 같은 규약 */
    val subjectKey: String,
    val subjectName: String,
    val score: BigDecimal,
    /** 직전 스냅샷의 순위. **null 은 신규 진입**이지 0 이나 최하위가 아니다 */
    val prevRank: Int?,
    val payload: Map<String, Any?> = emptyMap(),
) {
    init {
        if (rank < 1) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "순위는 1 이상이어야 합니다: $rank")
        }
        if (subjectKey.isBlank()) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "대상 식별자는 비어 있을 수 없습니다")
        }
        if (prevRank != null && prevRank < 1) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "직전 순위는 1 이상이거나 null 이어야 합니다: $prevRank")
        }
    }

    val movement: Movement get() = Movement.of(rank, prevRank)
}

/**
 * 직전 스냅샷 대비 등락.
 *
 * [New] 가 [Same] 과 분리돼 있는 것이 핵심이다. 신규 진입을 0 칸 이동으로 뭉개면 화면이
 * "변화 없음"으로 그려서, 처음 순위에 든 대상이 가장 눈에 안 띄게 된다.
 */
sealed interface Movement {
    /** 직전 스냅샷에 없던 대상 */
    data object New : Movement

    data object Same : Movement

    /** 순위가 [places] 칸 올랐다 (숫자는 작아졌다) */
    data class Up(val places: Int) : Movement

    data class Down(val places: Int) : Movement

    companion object {
        fun of(rank: Int, prevRank: Int?): Movement = when {
            prevRank == null -> New
            prevRank == rank -> Same
            prevRank > rank -> Up(prevRank - rank)
            else -> Down(rank - prevRank)
        }
    }
}
