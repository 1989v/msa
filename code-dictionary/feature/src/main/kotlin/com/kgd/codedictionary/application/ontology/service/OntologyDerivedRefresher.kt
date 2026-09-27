package com.kgd.codedictionary.application.ontology.service

import com.kgd.codedictionary.application.ontology.port.OntologySyncStatePort
import com.kgd.codedictionary.application.ontology.usecase.RefreshOntologyDerivedUseCase
import com.kgd.codedictionary.application.sync.dto.SyncOutcome
import com.kgd.codedictionary.application.sync.usecase.SyncConceptIndexUseCase
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Value
import org.springframework.cache.annotation.CacheEvict
import org.springframework.stereotype.Service

/**
 * 파생물 갱신은 DB 적용과 분리해 기억하고 재시도한다.
 *
 * `derived_hash` 는 색인이 끝난 뒤에만 적히므로, 파드가 중간에 죽어도 다음 부팅이 두 해시가 다른 것을 보고 다시 돈다.
 * 다른 파드가 색인 중(Busy)이거나 실패하면 제한된 backoff 로 다시 시도하고, 끝내 안 되면 다음 부팅에 맡긴다.
 */
@Service
class OntologyDerivedRefresher(
    private val syncState: OntologySyncStatePort,
    private val sync: SyncConceptIndexUseCase,
    @Value("\${ontology.sync.backoff-ms:5000,15000,45000}") private val backoffMs: List<Long>,
) : RefreshOntologyDerivedUseCase {
    private val log = KotlinLogging.logger {}

    @CacheEvict(value = ["conceptCategoryStats"], allEntries = true, beforeInvocation = true)
    override fun refreshIfStale(): Boolean {
        for (attempt in 0..backoffMs.size) {
            val state = syncState.readState()
            if (state.contentHash == state.derivedHash) return true
            val waitMs = backoffMs.getOrNull(attempt)
            try {
                when (val outcome = sync.syncNow()) {
                    // 끝난 뒤 다시 본다 — 그 사이 새 revision 이 적용됐으면 한 번 더 돈다
                    is SyncOutcome.Done -> continue
                    SyncOutcome.Busy -> log.info { "다른 인스턴스가 색인 중 — ${waitMs ?: 0}ms 뒤 다시 본다" }
                }
            } catch (e: Exception) {
                log.error(e) { "온톨로지 파생물 갱신 실패 (시도 ${attempt + 1}) — ${waitMs ?: 0}ms 뒤 다시 한다" }
            }
            if (waitMs == null) break
            Thread.sleep(waitMs)
        }
        val state = syncState.readState()
        val converged = state.contentHash == state.derivedHash
        if (!converged) log.warn { "온톨로지 파생물이 아직 옛 상태다 (content ${state.contentHash?.take(8)} · derived ${state.derivedHash?.take(8)}) — 다음 부팅에 다시 본다" }
        return converged
    }
}
