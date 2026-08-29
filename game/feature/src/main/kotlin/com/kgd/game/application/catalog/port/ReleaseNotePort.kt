package com.kgd.game.application.catalog.port

import com.kgd.game.domain.catalog.model.ReleaseNote

interface ReleaseNotePort {
    /** 최신 판이 먼저 온다 — 화면이 정렬을 다시 하지 않는다. */
    fun findBySlug(slug: String): List<ReleaseNote>
}
