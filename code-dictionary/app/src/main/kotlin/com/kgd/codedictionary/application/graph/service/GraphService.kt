package com.kgd.codedictionary.application.graph.service

import com.kgd.codedictionary.application.concept.port.ConceptRepositoryPort
import com.kgd.codedictionary.application.graph.dto.*
import com.kgd.codedictionary.application.index.port.ConceptIndexRepositoryPort
import com.kgd.codedictionary.domain.concept.model.Concept
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.cache.annotation.Cacheable
import org.springframework.stereotype.Service

@Service
class GraphService(
    private val conceptRepository: ConceptRepositoryPort,
    private val indexRepository: ConceptIndexRepositoryPort
) {
    private val log = KotlinLogging.logger {}

    fun getGraphData(): GraphDataDto {
        val (concepts, indexCountMap, totalIndexCount) = loadAllConceptsWithIndexCounts()

        val nodes = concepts.map { concept ->
            GraphNodeDto(
                id = concept.conceptId,
                name = concept.name,
                category = concept.category.name,
                level = concept.level.name,
                indexCount = indexCountMap[concept.conceptId] ?: 0,
                relatedCount = concept.relatedConceptIds.size,
                description = concept.description
            )
        }

        val conceptIdSet = concepts.map { it.conceptId }.toSet()
        val links = concepts.flatMap { concept ->
            concept.relatedConceptIds
                .filter { it in conceptIdSet }
                .map { relatedId ->
                    GraphLinkDto(
                        source = concept.conceptId,
                        target = relatedId,
                        type = "RELATED"
                    )
                }
        }.distinctBy { setOf(it.source, it.target) }

        val byCategory = aggregateByCategory(concepts)
        val byLevel = aggregateByLevel(concepts)
        val matrix = concepts.groupBy { it.category.name }.mapValues { (_, categoryConcepts) ->
            categoryConcepts.groupBy { it.level.name }.mapValues { it.value.size }
        }

        val stats = GraphStatsDto(
            totalConcepts = concepts.size,
            totalIndexes = totalIndexCount.toLong(),
            byCategory = byCategory,
            byLevel = byLevel,
            matrix = matrix
        )

        return GraphDataDto(nodes = nodes, links = links, stats = stats)
    }

    /**
     * 트리맵 stats endpoint.
     *
     * - 캐시 hit 시 트랜잭션 미오픈 (spec.md §4.3) — `@Transactional` 미사용 의도적
     * - 카테고리 정렬: indexCount 합계 desc (Q2 1차안)
     * - filter.includeZeroIndex=false 시 indexCount=0 concept 제외, 단 카테고리가 비면 placeholder 1 개 보존 (Q4)
     * - 빈 카테고리(concept 0 개) 응답 제외 (Q3)
     */
    @Cacheable(value = ["conceptCategoryStats"], key = "#filter")
    fun getCategoryStats(filter: CategoryStatsFilter): TreemapDataDto {
        log.info { "stats.treemap request filter=$filter" }
        val started = System.currentTimeMillis()

        val (allConcepts, indexCountMap, _) = try {
            loadAllConceptsWithIndexCounts()
        } catch (e: Exception) {
            log.error(e) { "stats.treemap repo_failure" }
            throw e
        }

        // 1. 카테고리 필터 적용 (대소문자 무관, uppercase 매칭)
        val targetCategories = filter.categories?.takeIf { it.isNotEmpty() }?.map { it.uppercase() }?.toSet()
        val filteredConcepts = if (targetCategories != null) {
            allConcepts.filter { it.category.name in targetCategories }
        } else {
            allConcepts
        }

        // 2. 카테고리별 그룹화
        val groupedByCategory: Map<String, List<Concept>> = filteredConcepts.groupBy { it.category.name }

        // 3. 카테고리별 concept → TreemapConceptDto 변환 (includeZeroIndex 정책 적용)
        val categoryDtos = groupedByCategory.mapNotNull { (categoryName, conceptsInCategory) ->
            if (conceptsInCategory.isEmpty()) return@mapNotNull null

            val withCounts = conceptsInCategory.map { c -> c to (indexCountMap[c.conceptId] ?: 0) }

            val effective = if (filter.includeZeroIndex) {
                withCounts
            } else {
                val nonZero = withCounts.filter { it.second > 0 }
                if (nonZero.isNotEmpty()) {
                    nonZero
                } else {
                    // 카테고리 전체 indexCount=0 → placeholder 1 개 보존 (Q4)
                    val placeholder = withCounts.minByOrNull { it.first.id ?: Long.MAX_VALUE }
                        ?: withCounts.first()
                    listOf(placeholder)
                }
            }

            // concept 정렬: indexCount desc → name asc
            val conceptDtos = effective
                .sortedWith(compareByDescending<Pair<Concept, Int>> { it.second }.thenBy { it.first.name })
                .map { (concept, count) ->
                    TreemapConceptDto(
                        conceptId = concept.conceptId,
                        name = concept.name,
                        level = concept.level.name,
                        indexCount = count
                    )
                }

            val totalIndexCount = conceptDtos.sumOf { it.indexCount }

            TreemapCategoryDto(
                name = categoryName,
                totalConcepts = conceptDtos.size,
                totalIndexCount = totalIndexCount,
                concepts = conceptDtos
            )
        }.sortedWith(
            // 카테고리 정렬: indexCount 합계 desc → name asc
            compareByDescending<TreemapCategoryDto> { it.totalIndexCount }.thenBy { it.name }
        )

        // 4. totals 집계 — 응답에 포함된 concept 만 합산하여 응답 일관성 보장
        val effectiveConcepts: List<Pair<Concept, Int>> = categoryDtos.flatMap { categoryDto ->
            categoryDto.concepts.mapNotNull { conceptDto ->
                filteredConcepts.firstOrNull { it.conceptId == conceptDto.conceptId }
                    ?.let { it to conceptDto.indexCount }
            }
        }

        val byLevel = effectiveConcepts.groupBy { it.first.level.name }.mapValues { it.value.size }
        val byCategory = categoryDtos.associate { it.name to it.totalConcepts }
        val totalConcepts = effectiveConcepts.size
        val totalIndexCount = categoryDtos.sumOf { it.totalIndexCount }

        val totals = TreemapTotalsDto(
            byLevel = byLevel,
            byCategory = byCategory,
            totalConcepts = totalConcepts,
            totalIndexCount = totalIndexCount
        )

        val elapsedMs = System.currentTimeMillis() - started
        if (elapsedMs > SLOW_QUERY_THRESHOLD_MS) {
            log.warn { "stats.treemap cache_miss elapsedMs=$elapsedMs" }
        }

        return TreemapDataDto(categories = categoryDtos, totals = totals)
    }

    /**
     * Concept 전체 + indexCount 매핑을 단일 read 로 로드.
     * `getGraphData()` / `getCategoryStats()` 양쪽에서 재사용.
     */
    private fun loadAllConceptsWithIndexCounts(): Triple<List<Concept>, Map<String, Int>, Int> {
        val concepts = conceptRepository.findAllList()
        val allIndexes = indexRepository.findAll()
        val indexCountMap = allIndexes.groupBy { it.conceptId }.mapValues { it.value.size }
        return Triple(concepts, indexCountMap, allIndexes.size)
    }

    private fun aggregateByLevel(concepts: List<Concept>): Map<String, Int> =
        concepts.groupBy { it.level.name }.mapValues { it.value.size }

    private fun aggregateByCategory(concepts: List<Concept>): Map<String, Int> =
        concepts.groupBy { it.category.name }.mapValues { it.value.size }

    companion object {
        private const val SLOW_QUERY_THRESHOLD_MS = 100L
    }
}
