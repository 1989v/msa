package com.kgd.codedictionary.application.graph.usecase

import com.kgd.codedictionary.application.graph.dto.ConceptAtlasDto

/** 도메인 열한 개(1차 노드)와 그 사이 간선 수 */
interface ConceptAtlasUseCase {
    fun getAtlas(): ConceptAtlasDto
}
