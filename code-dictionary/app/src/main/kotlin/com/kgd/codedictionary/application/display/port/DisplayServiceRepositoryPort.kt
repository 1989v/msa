package com.kgd.codedictionary.application.display.port

import com.kgd.codedictionary.domain.display.model.DisplayService

interface DisplayServiceRepositoryPort {
    /** 전시 대상. HOLD 제외는 저장소 경계에서 끝낸다 — 호출부가 잊을 수 있는 필터를 남기지 않는다. */
    fun findAllDisplayed(): List<DisplayService>

    /** 어드민 전용 — HOLD 포함 전체 */
    fun findAll(): List<DisplayService>

    fun save(service: DisplayService): DisplayService

    fun delete(id: Long)
}
