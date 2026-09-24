package com.kgd.codedictionary.application.ontology.service

import com.kgd.codedictionary.application.ontology.dto.ApplyOutcome
import com.kgd.codedictionary.application.ontology.dto.ApplyReport
import com.kgd.codedictionary.application.ontology.port.OntologySourcePort
import com.kgd.codedictionary.application.ontology.port.OntologyStorePort
import com.kgd.codedictionary.application.ontology.usecase.ApplyOntologyUseCase
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import org.springframework.transaction.support.TransactionOperations

/**
 * 적용 계약(스펙 SR-4.3) — 단위는 manifest 전체다.
 *
 * 파일을 읽고 검증하는 것은 트랜잭션 밖에서, 상태 행 잠금·revision 가드·적용·기록은 한 트랜잭션 안에서 한다.
 * 실패하면 전부 롤백되고 예외가 호출자(로더)로 나간다 — 로더는 기동을 멈추지 않는다.
 */
@Service
class OntologyApplyService(
    private val source: OntologySourcePort,
    private val store: OntologyStorePort,
    private val tx: TransactionOperations,
    @Value("\${ontology.app-version:unknown}") private val appVersion: String,
) : ApplyOntologyUseCase {
    private val log = KotlinLogging.logger {}

    override fun applyFromSource(): ApplyReport {
        val loaded = source.load()
        loaded.ontology.validateOrThrow()
        val fileRevision = loaded.ontology.manifest.revision

        return tx.execute {
            val state = store.lockState()
            when {
                fileRevision < state.revision -> {
                    log.warn { "온톨로지 파일 revision $fileRevision 이 DB ${state.revision} 보다 낮다 — 옛 이미지로 보고 적용하지 않는다" }
                    ApplyReport(ApplyOutcome.SKIPPED_OLDER, fileRevision, state.revision)
                }
                fileRevision == state.revision && loaded.contentHash == state.contentHash ->
                    ApplyReport(ApplyOutcome.SKIPPED_SAME, fileRevision, state.revision)
                fileRevision == state.revision -> throw OntologyRevisionNotBumpedException(fileRevision)
                else -> {
                    val (concepts, edges, released) = store.apply(loaded.ontology)
                    store.recordApplied(fileRevision, loaded.contentHash, appVersion)
                    log.info { "온톨로지 revision ${state.revision} → $fileRevision 적용: 개념 $concepts · 간선 $edges · 관리 해제 $released" }
                    ApplyReport(ApplyOutcome.APPLIED, fileRevision, state.revision, concepts, edges, released)
                }
            }
        }!!
    }
}

/** 같은 revision 인데 내용이 다르다 — 파일을 고치고 manifest revision 을 올리지 않은 것 */
class OntologyRevisionNotBumpedException(revision: Int) :
    IllegalStateException("온톨로지 revision $revision 의 내용이 DB 에 적용된 것과 다르다 — manifest.yaml 의 revision 을 올려야 한다")
