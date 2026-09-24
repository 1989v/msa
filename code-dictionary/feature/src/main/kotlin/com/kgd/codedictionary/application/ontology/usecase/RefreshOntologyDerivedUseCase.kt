package com.kgd.codedictionary.application.ontology.usecase

/** 적용된 온톨로지를 따라 캐시·검색 색인을 갱신한다 */
interface RefreshOntologyDerivedUseCase {
    /** `content_hash ≠ derived_hash` 인 동안 갱신을 시도한다. 수렴하면 true */
    fun refreshIfStale(): Boolean
}
