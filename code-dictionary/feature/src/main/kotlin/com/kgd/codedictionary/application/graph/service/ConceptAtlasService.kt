package com.kgd.codedictionary.application.graph.service

import com.kgd.codedictionary.application.graph.dto.AtlasDomainDto
import com.kgd.codedictionary.application.graph.dto.AtlasLinkDto
import com.kgd.codedictionary.application.graph.dto.ConceptAtlasDto
import com.kgd.codedictionary.application.graph.port.ConceptAtlasQueryPort
import com.kgd.codedictionary.application.graph.usecase.ConceptAtlasUseCase
import com.kgd.codedictionary.application.ontology.port.OntologySourcePort
import org.springframework.stereotype.Service

/**
 * 도메인 순서와 루트는 이미지에 실린 온톨로지 파일(manifest)에서, 개수는 적용된 DB 에서 읽는다.
 * 파일에는 있는데 아직 적용되지 않은 도메인은 싣지 않는다 — 화면이 빈 도메인을 열게 두지 않는다.
 */
@Service
class ConceptAtlasService(
    private val query: ConceptAtlasQueryPort,
    private val source: OntologySourcePort,
) : ConceptAtlasUseCase {

    /** 파일은 이미지에 굳어 있어 한 번만 읽는다 */
    private val layout: List<Pair<String, String>> by lazy {
        val ontology = source.load().ontology
        val roots = ontology.domains.associate { it.fileDomain to it.root }
        ontology.manifest.domains.mapNotNull { d -> roots[d]?.let { d to it } }
    }

    override fun getAtlas(): ConceptAtlasDto {
        val rows = query.managedConcepts()
        val byDomain = rows.groupBy { it.domain }
        val byId = rows.associateBy { it.conceptId }

        val domains = layout.mapNotNull { (domain, rootId) ->
            val members = byDomain[domain] ?: return@mapNotNull null
            val root = byId[rootId] ?: return@mapNotNull null
            AtlasDomainDto(
                domain = domain,
                rootId = rootId,
                name = root.name,
                description = root.description,
                conceptCount = members.size,
                kindCounts = members.groupingBy { it.kind ?: "UNKNOWN" }.eachCount(),
                codeRefCount = members.sumOf { it.codeRefCount },
                conceptIds = members.map { it.conceptId },
            )
        }
        val shown = domains.map { it.domain }.toSet()
        val links = query.managedEdges()
            .filter { it.fromDomain != it.toDomain && it.fromDomain in shown && it.toDomain in shown }
            .groupingBy { minOf(it.fromDomain, it.toDomain) to maxOf(it.fromDomain, it.toDomain) }
            .eachCount()
            .map { (pair, count) -> AtlasLinkDto(pair.first, pair.second, count) }
            .sortedByDescending { it.count }
        return ConceptAtlasDto(domains, links)
    }
}
