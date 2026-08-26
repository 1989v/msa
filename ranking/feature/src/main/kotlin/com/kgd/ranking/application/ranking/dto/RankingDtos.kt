package com.kgd.ranking.application.ranking.dto

import com.kgd.ranking.domain.model.Movement
import java.math.BigDecimal
import java.time.Instant

/** 등락 — 화면이 배지 하나로 그릴 수 있게 종류와 칸 수를 나눠 준다. */
data class MovementResponse(val type: String, val places: Int? = null) {
    companion object {
        fun of(movement: Movement): MovementResponse = when (movement) {
            Movement.New -> MovementResponse("NEW")
            Movement.Same -> MovementResponse("SAME")
            is Movement.Up -> MovementResponse("UP", movement.places)
            is Movement.Down -> MovementResponse("DOWN", movement.places)
        }
    }
}

data class RankingEntryResponse(
    val rank: Int,
    val subjectKey: String,
    val subjectName: String,
    val score: BigDecimal,
    val movement: MovementResponse,
    val payload: Map<String, Any?>,
)

/** 보드 목록 한 줄 — 1등만 미리 보여 준다(목록에서 전체 엔트리를 실을 이유가 없다). */
data class RankingBoardSummary(
    val slug: String,
    val title: String,
    val subtitle: String?,
    val scopeKey: String,
    val scopeName: String,
    val unit: String,
    val sourceLabel: String,
    val capturedAt: Instant?,
    val entryCount: Int,
    val topName: String?,
    val topScore: BigDecimal?,
)

data class RankingBoardDetail(
    val slug: String,
    val title: String,
    val subtitle: String?,
    val scopeKey: String,
    val scopeName: String,
    val unit: String,
    val sourceLabel: String,
    val capturedAt: Instant?,
    val entries: List<RankingEntryResponse>,
)

/** 보드가 존재하는 지역만 내보낸다 — 고를 수 있는 것과 실제로 데이터가 있는 것이 같아야 한다. */
data class RankingScopeResponse(val code: String, val name: String)
