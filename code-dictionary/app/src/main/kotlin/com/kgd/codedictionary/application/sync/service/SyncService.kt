package com.kgd.codedictionary.application.sync.service

import com.kgd.codedictionary.application.concept.port.ConceptRepositoryPort
import com.kgd.codedictionary.application.index.port.ConceptIndexRepositoryPort
import com.kgd.codedictionary.application.search.port.ConceptIndexingPort
import com.kgd.codedictionary.application.sync.dto.IndexSyncJob
import com.kgd.codedictionary.domain.index.model.CodeLocation
import com.kgd.codedictionary.domain.index.model.ConceptIndex
import com.kgd.codedictionary.infrastructure.opensearch.adapter.IndexAliasManager
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.data.domain.Pageable
import org.springframework.scheduling.annotation.Async
import org.springframework.stereotype.Service

@Service
class SyncService(
    private val conceptRepository: ConceptRepositoryPort,
    private val indexRepository: ConceptIndexRepositoryPort,
    private val indexingPort: ConceptIndexingPort,
    private val aliasManager: IndexAliasManager,
    private val jobRegistry: IndexSyncJobRegistry,
    @Value("\${opensearch.index-name:concept-index}") private val alias: String,
    @Value("\${opensearch.retention:2}") private val retention: Int
) {
    private val log = LoggerFactory.getLogger(javaClass)

    /** 동기 트리거 — jobId 즉시 반환, 백그라운드에서 실행됨 */
    fun submit(): IndexSyncJob {
        val job = jobRegistry.submit()
        runAsyncIfPending(job)
        return job
    }

    fun get(jobId: String): IndexSyncJob? = jobRegistry.get(jobId)

    private fun runAsyncIfPending(job: IndexSyncJob) {
        if (job.finishedAt != null) return
        // 이미 RUNNING 인 잡 (중복 submit) 은 다시 시작하지 않음
        if (job.newIndex != null) return
        runAsync(job.jobId)
    }

    @Async("indexSyncExecutor")
    fun runAsync(jobId: String) {
        val newIndex = aliasManager.createTimestampedIndexName(alias)
        jobRegistry.markRunning(jobId, newIndex)

        try {
            // 1. 새 인덱스 생성
            aliasManager.createIndex(newIndex)
            log.info("[{}] new index created: {}", jobId, newIndex)

            // 2. synonym 적용 (close/open 사이클)
            val concepts = conceptRepository.findAllWithSynonyms()
            val synonymMap = concepts.associate { it.conceptId to (it.synonyms + it.name) }
            indexingPort.updateSynonyms(newIndex, synonymMap)

            // 3. concept_index 매핑 + concept-only 문서 bulk
            val allIndices = indexRepository.findAll(Pageable.unpaged())
            val conceptMap = concepts.associateBy { it.conceptId }
            val codeEntries = allIndices.content.mapNotNull { idx ->
                conceptMap[idx.conceptId]?.let { it to idx }
            }
            val conceptOnlyEntries = concepts.map { concept ->
                concept to ConceptIndex.create(
                    conceptId = concept.conceptId,
                    location = CodeLocation(filePath = "N/A", lineStart = 1, lineEnd = 1),
                    description = concept.description
                )
            }
            indexingPort.bulkIndex(newIndex, codeEntries)
            indexingPort.bulkIndex(newIndex, conceptOnlyEntries)
            val total = codeEntries.size + conceptOnlyEntries.size
            log.info("[{}] bulk indexed {} docs ({} code + {} concept-only)", jobId, total, codeEntries.size, conceptOnlyEntries.size)

            // 4. atomic alias swap + 옛 인덱스 retention 정리
            aliasManager.swapAlias(alias, newIndex, retention)
            jobRegistry.markSuccess(jobId, total)
            log.info("[{}] sync completed: alias '{}' → '{}'", jobId, alias, newIndex)
        } catch (e: Exception) {
            log.error("[{}] sync failed: {}", jobId, e.message, e)
            jobRegistry.markFailed(jobId, e.message ?: e.javaClass.simpleName)
        }
    }
}
