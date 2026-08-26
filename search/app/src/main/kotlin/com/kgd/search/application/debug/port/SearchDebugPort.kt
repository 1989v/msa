package com.kgd.search.application.debug.port

import com.kgd.search.application.debug.usecase.DebugSearchUseCase

/**
 * 디버그 조회 — 랭킹 질의 조립·리랭킹·OpenSearch 호출이 전부 인프라라 통째로 뒤에 둔다.
 * 조립된 결과만 넘어오므로 application 은 OpenSearch 타입을 보지 않는다.
 */
interface SearchDebugPort {
    fun debug(query: String, variant: String, topK: Int): DebugSearchUseCase.DebugResult
    fun rawQuery(command: DebugSearchUseCase.RawQueryCommand): DebugSearchUseCase.RawQueryResult
}
