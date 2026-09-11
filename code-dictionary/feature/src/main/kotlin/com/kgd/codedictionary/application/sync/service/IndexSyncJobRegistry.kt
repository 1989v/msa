package com.kgd.codedictionary.application.sync.service

import com.kgd.codedictionary.application.sync.dto.IndexSyncJob
import com.kgd.codedictionary.application.sync.dto.IndexSyncStatus
import org.springframework.stereotype.Component
import java.time.Instant
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

@Component
class IndexSyncJobRegistry {

    private val jobs = ConcurrentHashMap<String, IndexSyncJob>()

    /** 진행 중인 잡이 있으면 그 잡을 반환 (중복 실행 방지). 없으면 새 잡을 만들어 PENDING 으로 등록. */
    fun submit(): IndexSyncJob {
        val running = jobs.values.firstOrNull { it.status == IndexSyncStatus.PENDING || it.status == IndexSyncStatus.RUNNING }
        if (running != null) return running

        val job = IndexSyncJob(
            jobId = UUID.randomUUID().toString(),
            status = IndexSyncStatus.PENDING,
            startedAt = Instant.now()
        )
        jobs[job.jobId] = job
        return job
    }

    fun get(jobId: String): IndexSyncJob? = jobs[jobId]

    fun update(jobId: String, mutate: (IndexSyncJob) -> IndexSyncJob): IndexSyncJob? =
        jobs.computeIfPresent(jobId) { _, current -> mutate(current) }

    fun markRunning(jobId: String, newIndex: String) =
        update(jobId) { it.copy(status = IndexSyncStatus.RUNNING, newIndex = newIndex) }

    fun markSuccess(jobId: String, indexedCount: Int) =
        update(jobId) { it.copy(status = IndexSyncStatus.SUCCESS, finishedAt = Instant.now(), indexedCount = indexedCount) }

    fun markFailed(jobId: String, error: String) =
        update(jobId) { it.copy(status = IndexSyncStatus.FAILED, finishedAt = Instant.now(), error = error) }
}
