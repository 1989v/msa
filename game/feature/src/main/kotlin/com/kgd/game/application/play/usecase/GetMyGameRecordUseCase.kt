package com.kgd.game.application.play.usecase

import com.kgd.game.application.play.dto.MyGameRecordDto

/**
 * 한 회원이 이 게임에서 남긴 것 — 플레이 횟수·시간·최고 기록·이어하기 유무.
 *
 * 상세 화면의 개인 기록 패널이 쓴다. 로그인하지 않았으면 부르지 않는다 —
 * 게스트에게 빈 패널을 보여 주면 "기록이 없다" 와 "로그인이 필요하다" 가 구분되지 않는다.
 */
interface GetMyGameRecordUseCase {
    fun execute(query: Query): MyGameRecordDto

    data class Query(val slug: String, val memberId: Long)
}
