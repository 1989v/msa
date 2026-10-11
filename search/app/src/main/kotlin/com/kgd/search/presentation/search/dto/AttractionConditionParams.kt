package com.kgd.search.presentation.search.dto

import com.kgd.search.domain.query.model.QueryIntent

/**
 * 속성 축 ↔ API 파라미터 이름의 **유일한 표**. 컨트롤러의 `@RequestParam(name = …)` 과 응답 `interpretedConditions`,
 * 해제 파라미터 `skipCondition` 이 모두 이 상수를 쓴다 — 도메인은 API 문자열을 모른다.
 */
object AttractionConditionParams {
    const val PARKING = "parking"
    const val ADMISSION = "admission"
    const val PET = "pet"
    const val STROLLER_RENTAL = "strollerRental"
    const val BARRIER_FREE = "barrierFree"
    const val CREDIT_CARD = "creditCard"

    fun paramOf(kind: QueryIntent.ConditionKind): String = when (kind) {
        QueryIntent.ConditionKind.PARKING -> PARKING
        QueryIntent.ConditionKind.ADMISSION -> ADMISSION
        QueryIntent.ConditionKind.PET -> PET
        QueryIntent.ConditionKind.STROLLER_RENTAL -> STROLLER_RENTAL
        QueryIntent.ConditionKind.BARRIER_FREE -> BARRIER_FREE
        QueryIntent.ConditionKind.CREDIT_CARD -> CREDIT_CARD
    }

    /** `skipCondition` 값 → 축. 모르는 이름은 버린다(해제할 해석이 없다). */
    fun kindsOf(params: List<String>?): Set<QueryIntent.ConditionKind> {
        val wanted = params.orEmpty().flatMap { it.split(",") }.map { it.trim() }.toSet()
        return QueryIntent.ConditionKind.entries.filter { paramOf(it) in wanted }.toSet()
    }

    /** 응답 한 줄 — 칩을 켠 것과 같은 `param=value`. 여러 값은 쉼표로 잇는다(`pet=ALLOWED,PARTIAL`). */
    fun toResponse(condition: QueryIntent.Condition) = InterpretedCondition(
        param = paramOf(condition.kind),
        value = condition.values.joinToString(","),
        phrase = condition.phrase,
    )

    data class InterpretedCondition(val param: String, val value: String, val phrase: String)
}
