package com.kgd.codedictionary.application.graph.port

import com.kgd.codedictionary.application.graph.dto.AtlasConceptRow
import com.kgd.codedictionary.application.graph.dto.AtlasEdgeRow

/** 아틀라스 집계 읽기 — 온톨로지가 관리하는 개념과, 양 끝이 모두 관리 개념인 간선 */
interface ConceptAtlasQueryPort {
    fun managedConcepts(): List<AtlasConceptRow>
    fun managedEdges(): List<AtlasEdgeRow>
}
