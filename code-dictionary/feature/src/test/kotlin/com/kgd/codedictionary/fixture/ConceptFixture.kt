package com.kgd.codedictionary.fixture

import com.kgd.codedictionary.domain.concept.model.Concept
import com.kgd.codedictionary.domain.concept.model.ConceptCategory
import com.kgd.codedictionary.domain.concept.model.ConceptLevel
import com.kgd.codedictionary.domain.index.model.CodeLocation
import com.kgd.codedictionary.domain.index.model.ConceptIndex

/**
 * Concept / ConceptIndex 테스트 픽스처 빌더.
 *
 * - test-quality.md §Test Data Fixture Convention (lines 108-124) 컨벤션 따름.
 * - 모든 인자는 default 값 보유 → 테스트는 관심 필드만 명시.
 * - `indexCount` 는 Concept 도메인 필드가 아니라 ConceptIndex 집계 결과이므로,
 *   별도 헬퍼(`createWithIndexCount`, `indexesFor`) 로 ConceptIndex 합성을 제공.
 * - `large(count)` 는 perf / payload size 검증용 합성 데이터 (균등 카테고리 분포 + 30/55/15 level 비율).
 */
object ConceptFixture {

    /**
     * 기본 Concept 빌더.
     *
     * `Concept.restore` 사용 — id 부여 가능 (treemap 정렬 시 placeholder 결정에 id 필요).
     */
    fun create(
        id: Long? = 1L,
        conceptId: String = "default-concept",
        name: String = "Default Concept",
        category: ConceptCategory = ConceptCategory.ARCHITECTURE,
        level: ConceptLevel = ConceptLevel.BEGINNER,
        description: String = "default description",
        synonyms: List<String> = emptyList(),
        relatedConceptIds: List<String> = emptyList(),
    ): Concept = Concept.restore(
        id = id,
        conceptId = conceptId,
        name = name,
        category = category,
        level = level,
        description = description,
        synonyms = synonyms,
        relatedConceptIds = relatedConceptIds,
    )

    /**
     * conceptId 기준 ConceptIndex 합성. indexCount=N 시뮬레이션.
     *
     * GraphService.loadAllConceptsWithIndexCounts() 가 `indexes.groupBy { it.conceptId }.size`
     * 로 indexCount 를 산출하므로, 동일 conceptId 의 Index 를 N 개 만들어 indexCount=N 표현.
     */
    fun indexesFor(conceptId: String, count: Int): List<ConceptIndex> =
        (1..count).map { idx ->
            ConceptIndex.create(
                conceptId = conceptId,
                location = CodeLocation(
                    filePath = "src/main/kotlin/Sample$idx.kt",
                    lineStart = idx,
                    lineEnd = idx + 1,
                ),
                codeSnippet = "fun sample$idx() {}",
                description = "sample $idx",
            )
        }

    /**
     * 다수 concept 의 indexCount 매핑을 ConceptIndex 리스트로 펼침.
     */
    fun indexesFromMap(indexCountByConceptId: Map<String, Int>): List<ConceptIndex> =
        indexCountByConceptId.flatMap { (conceptId, count) -> indexesFor(conceptId, count) }

    /**
     * 대량 concept 합성 (perf / payload size 검증용).
     *
     * - 13 카테고리 균등 분포 — count / 13 + 나머지
     * - level 비율 ~30/55/15 (BEGINNER/INTERMEDIATE/ADVANCED)
     * - id 1..count 순차, conceptId = "concept-$i"
     */
    fun large(count: Int = 500): List<Concept> {
        val categories = ConceptCategory.entries
        val levels = listOf(
            ConceptLevel.BEGINNER, ConceptLevel.INTERMEDIATE, ConceptLevel.ADVANCED,
        )
        return (1..count).map { i ->
            val level = when (((i - 1) * 100 / count)) {
                in 0..29 -> levels[0]
                in 30..84 -> levels[1]
                else -> levels[2]
            }
            create(
                id = i.toLong(),
                conceptId = "concept-$i",
                name = "Concept $i",
                category = categories[(i - 1) % categories.size],
                level = level,
                description = "auto-generated #$i",
            )
        }
    }
}
