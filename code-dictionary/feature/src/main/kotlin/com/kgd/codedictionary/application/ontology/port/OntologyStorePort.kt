package com.kgd.codedictionary.application.ontology.port

import com.kgd.codedictionary.application.ontology.dto.OntologyState
import com.kgd.codedictionary.domain.concept.ontology.ConceptOntology

/**
 * 온톨로지를 DB 에 적용한다. [lockState] 와 [apply]·[recordApplied] 는 호출자의 한 트랜잭션 안에서 부른다.
 */
interface OntologyStorePort {
    /** 상태 행을 `FOR UPDATE` 로 잠그고 읽는다 — 동시에 뜬 로더는 여기서 줄을 선다 */
    fun lockState(): OntologyState

    /**
     * 파일이 나열한 개념을 upsert(kind·managed_by 포함)하고 동의어·근거·질문을 교체하고,
     * 파일에서 빠진 관리 개념을 관리 해제하고, `concept_edge` 전체를 파일의 간선으로 바꾼다.
     * @return (개념 수, 간선 수, 관리 해제 수)
     */
    fun apply(ontology: ConceptOntology): Triple<Int, Int, Int>

    fun recordApplied(revision: Int, contentHash: String, appVersion: String)
}
