package com.kgd.codedictionary.application.sync.service

import com.kgd.codedictionary.application.concept.port.ConceptRepositoryPort
import com.kgd.codedictionary.application.index.port.ConceptIndexRepositoryPort
import com.kgd.codedictionary.application.ontology.port.OntologySyncStatePort
import com.kgd.codedictionary.application.search.port.ConceptIndexingPort
import com.kgd.codedictionary.application.sync.dto.IndexSyncJob
import com.kgd.codedictionary.application.sync.dto.IndexSyncStatus
import com.kgd.codedictionary.application.sync.dto.SyncOutcome
import com.kgd.codedictionary.application.sync.port.IndexAliasPort
import com.kgd.codedictionary.application.sync.usecase.SyncConceptIndexUseCase
import com.kgd.codedictionary.domain.index.model.CodeLocation
import com.kgd.codedictionary.domain.index.model.ConceptIndex
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.beans.factory.annotation.Value
import org.springframework.data.domain.Pageable
import org.springframework.stereotype.Service
import java.lang.management.ManagementFactory
import java.util.concurrent.Executor
import java.util.concurrent.RejectedExecutionException

/**
 * 개념 → 검색 색인. 새 인덱스를 만들어 채운 뒤 별칭을 원자적으로 옮긴다.
 *
 * 파드 간 단일 실행 — 온톨로지 상태 행의 리스를 잡은 쪽만 돈다. 수동 요청도 같은 리스를 탄다.
 * 롤링 배포 중 겹친 두 파드가 각각 색인하면 늦게 끝난 옛 색인이 별칭을 되돌리기 때문이다.
 */
@Service
class SyncService(
    private val conceptRepository: ConceptRepositoryPort,
    private val indexRepository: ConceptIndexRepositoryPort,
    private val indexingPort: ConceptIndexingPort,
    private val aliasManager: IndexAliasPort,
    private val jobRegistry: IndexSyncJobRegistry,
    private val syncState: OntologySyncStatePort,
    @Qualifier("indexSyncExecutor") private val executor: Executor,
    @Value("\${opensearch.index-name:concept-index}") private val alias: String,
    @Value("\${opensearch.retention:2}") private val retention: Int,
) : SyncConceptIndexUseCase {
    private val log = KotlinLogging.logger {}

    override fun submit(): IndexSyncJob {
        val (job, created) = jobRegistry.submitOrExisting()
        // 이미 진행 중인 잡(중복 submit)은 다시 시작하지 않는다
        if (!created) return job
        try {
            executor.execute { runJob(job.jobId) }
        } catch (e: RejectedExecutionException) {
            log.warn { "[${job.jobId}] 색인 실행기가 가득 찼다 — 잠시 뒤 다시 요청한다" }
            jobRegistry.markFailed(job.jobId, "색인 실행기가 가득 찼다")
        }
        return job
    }

    override fun get(jobId: String): IndexSyncJob? = jobRegistry.get(jobId)

    private fun runJob(jobId: String) {
        jobRegistry.update(jobId) { it.copy(status = IndexSyncStatus.RUNNING) }
        try {
            when (val outcome = syncNow()) {
                is SyncOutcome.Done -> {
                    jobRegistry.markRunning(jobId, outcome.newIndex)
                    jobRegistry.markSuccess(jobId, outcome.indexedCount)
                }
                SyncOutcome.Busy -> jobRegistry.markFailed(jobId, "다른 인스턴스가 색인 중이다")
            }
        } catch (e: Exception) {
            log.error(e) { "[$jobId] sync failed: ${e.message}" }
            jobRegistry.markFailed(jobId, e.message ?: e.javaClass.simpleName)
        }
    }

    override fun syncNow(): SyncOutcome {
        var target = syncState.tryAcquireLease(OWNER, LEASE_SECONDS) ?: return SyncOutcome.Busy
        try {
            repeat(MAX_ROUNDS) {
                val newIndex = aliasManager.createTimestampedIndexName(alias)
                val total = buildIndex(newIndex)
                // 교체 직전 재확인 — 색인하는 동안 온톨로지가 새로 적용됐으면 이 인덱스는 옛 내용이다
                val current = syncState.readState().contentHash.orEmpty()
                if (current != target) {
                    log.info { "색인 중 내용이 바뀌었다(${target.take(8)} → ${current.take(8)}) — $newIndex 를 버리고 다시 돈다" }
                    aliasManager.deleteIndex(newIndex)
                    target = current
                    syncState.retarget(OWNER, current)
                    return@repeat
                }
                aliasManager.swapAlias(alias, newIndex, retention)
                syncState.recordDerived(OWNER, target)
                log.info { "sync completed: alias '$alias' → '$newIndex' ($total docs, target ${target.take(8)})" }
                return SyncOutcome.Done(newIndex, total, target)
            }
            error("색인하는 동안 내용이 ${MAX_ROUNDS}번 연속 바뀌었다 — 다음 기회에 다시 돈다")
        } finally {
            syncState.releaseLease(OWNER)
        }
    }

    private fun buildIndex(newIndex: String): Int {
        aliasManager.createIndex(newIndex)
        val concepts = conceptRepository.findAllWithSynonyms()
        indexingPort.updateSynonyms(newIndex, concepts.associate { it.conceptId to (it.synonyms + it.name) })

        val conceptMap = concepts.associateBy { it.conceptId }
        val codeEntries = indexRepository.findAll(Pageable.unpaged()).content
            .mapNotNull { idx -> conceptMap[idx.conceptId]?.let { it to idx } }
        val conceptOnlyEntries = concepts.map { concept ->
            concept to ConceptIndex.create(
                conceptId = concept.conceptId,
                location = CodeLocation(filePath = "N/A", lineStart = 1, lineEnd = 1),
                description = concept.description,
            )
        }
        indexingPort.bulkIndex(newIndex, codeEntries)
        indexingPort.bulkIndex(newIndex, conceptOnlyEntries)
        return codeEntries.size + conceptOnlyEntries.size
    }

    companion object {
        private const val LEASE_SECONDS = 300L
        private const val MAX_ROUNDS = 3

        /** 파드 이름(호스트명) + pid — 리스 소유자 */
        val OWNER: String = ManagementFactory.getRuntimeMXBean().name.take(64)
    }
}
