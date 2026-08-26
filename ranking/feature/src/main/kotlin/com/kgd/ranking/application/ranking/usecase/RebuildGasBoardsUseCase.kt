package com.kgd.ranking.application.ranking.usecase

/** 적재된 주유소로 시군구 × 유종 리더보드 스냅샷을 다시 만든다 (ADR-0081 §1). */
interface RebuildGasBoardsUseCase {
    fun execute(command: Command): Result

    data class Command(val sourceLabel: String)
    data class Result(val boards: Int, val entries: Int)
}
