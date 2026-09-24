package com.kgd.codedictionary.application.graph.port

import com.kgd.codedictionary.application.graph.dto.CodeRefDto
import com.kgd.codedictionary.application.graph.dto.EvidenceDto

/** 온톨로지 증거층 읽기 — 근거와 질문 */
interface ConceptEvidenceQueryPort {
    fun evidenceOf(conceptId: String): List<EvidenceDto>
    fun questionsOf(conceptId: String): List<String>
    fun codeOf(conceptId: String): List<CodeRefDto>
}
