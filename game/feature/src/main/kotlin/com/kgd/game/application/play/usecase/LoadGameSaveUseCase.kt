package com.kgd.game.application.play.usecase

import com.kgd.game.application.play.port.SaveSnapshot

/**
 * 로그인 사용자는 memberId 로, 게스트는 이어하기 코드로 자기 세이브를 찾는다.
 *
 * 로그인 중이어도 코드를 함께 받는다 — 계정 슬롯이 비어 있으면 그 코드의 게스트 세이브로
 * 폴백하고, 다음 저장에서 그 행이 계정으로 승계된다.
 */
interface LoadGameSaveUseCase {
    fun execute(query: Query): SaveSnapshot?

    data class Query(val slug: String, val memberId: Long?, val code: String?)
}
