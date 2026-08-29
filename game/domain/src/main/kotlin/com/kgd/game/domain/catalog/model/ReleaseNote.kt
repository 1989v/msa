package com.kgd.game.domain.catalog.model

import java.time.LocalDate

/**
 * 게임 한 판(버전)의 변경 기록.
 *
 * 게임마다 표를 따로 두지 않는다 — 전 게임이 같은 패널을 쓰므로 형태가 갈리면
 * 화면이 게임마다 달라진다. 본문은 문단이다: 「무엇이 바뀌었나」를 읽으러 온
 * 자리라 한 줄로 자르면 바꾼 이유가 사라진다.
 */
data class ReleaseNote(
    val version: String,
    val releasedAt: LocalDate,
    val body: String,
    val bodyEn: String?,
)
