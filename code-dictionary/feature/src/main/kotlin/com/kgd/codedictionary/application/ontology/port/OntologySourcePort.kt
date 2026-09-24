package com.kgd.codedictionary.application.ontology.port

import com.kgd.codedictionary.application.ontology.dto.LoadedOntology

/** 온톨로지 원본(레포 파일 묶음)을 읽는다. 검증은 하지 않는다 — 도메인이 한다 */
interface OntologySourcePort {
    fun load(): LoadedOntology
}
