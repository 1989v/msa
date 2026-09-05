package com.kgd.game.domain.access.model

import java.time.LocalDateTime

/**
 * 「이 회원은 이 비밀 게임에 들어갈 수 있다」 한 줄.
 *
 * **카탈로그(`game`) 행과 이어 두지 않는다.** 비밀 게임은 카탈로그에 없는 것이 정상이고,
 * 있어도 목록에 안 나온다. 슬러그로만 잇는 이유가 그것이다 — 카탈로그 행이 없다고
 * 허용 명단까지 사라지면, 나중에 공개로 돌릴 때 명단을 다시 만들어야 한다.
 *
 * **정적 파일까지 막기 위한 것이다.** 게임 파일은 nginx 가 그대로 내주므로, 목록에서
 * 빼는 것만으로는 주소를 아는 사람에게 열려 있다. 이 표를 보는 곳은 요청마다 도는
 * 관문(ingress `auth-url`)이다.
 */
data class PrivateGameAccess(
    val id: Long? = null,
    val gameSlug: String,
    val memberId: Long,
    /** 누구인지 사람이 알아보게 적어 두는 메모. 판정에는 안 쓴다. */
    val note: String? = null,
    val createdAt: LocalDateTime = LocalDateTime.now(),
) {
    init {
        require(gameSlug.isNotBlank()) { "게임 슬러그가 비어 있다" }
        require(memberId > 0) { "회원 번호가 잘못됐다: $memberId" }
    }
}
