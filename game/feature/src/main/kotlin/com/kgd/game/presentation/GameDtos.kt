package com.kgd.game.presentation

data class StartSessionRequest(
    val gameId: String,
    val daily: Boolean = false,
)

data class StartSessionResponse(
    val sessionId: String,
    val gameId: String,
    val seed: Int,
    val dailyDate: String?,
    val token: String,
)

data class InputEventDto(val tick: Int, val command: String)

data class ReplayDto(
    val gameId: String,
    val seed: Int,
    val totalTicks: Int,
    val inputs: List<InputEventDto>,
)

data class SubmitScoreRequest(
    val sessionId: String,
    val token: String,
    val claimedScore: Int,
    val replay: ReplayDto,
    val clientDurationMs: Long,
    val nickname: String,
)

data class SubmitScoreResponse(
    val accepted: Boolean,
    val score: Int,
    val verification: String,
    val allTimeRank: Int,
    val dailyRank: Int?,
    val reason: String?,
)

data class LeaderboardEntryDto(
    val rank: Int,
    val nickname: String,
    val score: Int,
    val status: String,
)

data class DailyInfoDto(
    val gameId: String,
    val date: String,
    val seed: Int,
)
