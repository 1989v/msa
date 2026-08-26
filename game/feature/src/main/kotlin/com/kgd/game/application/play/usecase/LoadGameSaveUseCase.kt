package com.kgd.game.application.play.usecase

import com.kgd.game.application.play.port.SaveSnapshot

/** 로그인 사용자는 memberId 로, 게스트는 이어하기 코드로 자기 세이브를 찾는다. 읽기는 잠그지 않는다 */
interface LoadGameSaveUseCase {
    fun execute(query: Query): SaveSnapshot?

    data class Query(val slug: String, val memberId: Long?, val code: String?, val holder: String)
}
