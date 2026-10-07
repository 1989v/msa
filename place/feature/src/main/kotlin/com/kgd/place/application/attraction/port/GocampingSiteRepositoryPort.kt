package com.kgd.place.application.attraction.port

import com.kgd.place.domain.attraction.model.GocampingSite

interface GocampingSiteRepositoryPort {
    /** 받은 곳만 덮는다 — 원천에서 빠진 곳은 지우지 않는다. 반환은 반영한 행 수. */
    fun upsertAll(sites: List<GocampingSite>): Int
}
