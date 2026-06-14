package com.kgd.place.application.poi.port

import com.kgd.place.domain.poi.model.PoiDocument

interface PoiIndexPort {
    /** poi 인덱스가 없으면 매핑과 함께 생성 (best-effort). */
    fun ensureIndex()
    fun index(doc: PoiDocument)
    fun bulkIndex(docs: List<PoiDocument>)
}
