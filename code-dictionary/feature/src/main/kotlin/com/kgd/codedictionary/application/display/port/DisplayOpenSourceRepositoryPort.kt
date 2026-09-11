package com.kgd.codedictionary.application.display.port

import com.kgd.codedictionary.domain.display.model.DisplayOpenSource

interface DisplayOpenSourceRepositoryPort {
    /** 전시 대상 — active 만. 필터는 저장소 경계에서 끝낸다 (DisplayServiceRepositoryPort 와 같은 규칙). */
    fun findAllActive(): List<DisplayOpenSource>
}
