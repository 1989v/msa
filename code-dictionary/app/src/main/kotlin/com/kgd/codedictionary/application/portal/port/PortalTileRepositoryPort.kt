package com.kgd.codedictionary.application.portal.port

import com.kgd.codedictionary.domain.portal.model.PortalTile

interface PortalTileRepositoryPort {
    /** 공개 노출 대상. HIDDEN 제외는 저장소 경계에서 끝낸다 — 호출부가 잊을 수 있는 필터를 남기지 않는다. */
    fun findAllVisible(): List<PortalTile>

    /** 어드민 전용 — HIDDEN 포함 전체 */
    fun findAll(): List<PortalTile>

    fun save(tile: PortalTile): PortalTile

    fun delete(id: Long)
}
